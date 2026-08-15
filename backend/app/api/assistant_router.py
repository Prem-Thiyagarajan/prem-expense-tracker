# File: app/api/assistant_router.py
"""In-app assistant: streaming chat, speech-to-text, and a capability probe.

Read-only. The assistant answers questions about the signed-in user's own data
and can point them at a screen, but it holds no write tools — see
app/services/assistant/tools.py for the reasoning.

Chat and voice fail independently by design: /chat never touches Groq and
/transcribe never touches NVIDIA, so an outage at one provider degrades exactly
one feature. /health reports the two capabilities separately so the client can
disable just the mic.
"""
import json
import logging
from typing import Any, AsyncIterator

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from jose import jwt
from sqlalchemy.orm import Session

from app.core import deps
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.assistant_schema import AssistantHealth, ChatRequest, TranscriptionOut
from app.services.assistant import providers
from app.services.assistant.prompts import build_system_prompt
from app.services.assistant.tools import TOOL_SCHEMAS, run_tool

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Assistant"])

# Navigate targets the model is allowed to emit. Anything outside these sets is
# dropped server-side, and the client re-validates against its own copy — a
# hallucinated route can never reach router.push().
ALLOWED_ROUTES = {
    "/", "/expenses", "/budget", "/trends", "/profile",
    "/manage/categories", "/manage/accounts", "/manage/tags",
}
ALLOWED_SHEETS = {
    "add-transaction", "budget-edit", "month-picker",
    "category-grid", "change-password", "upload-statements",
}

NAVIGATE_MARKER = "<<NAVIGATE"


def user_rate_key(request: Request) -> str:
    """Rate-limit per user, not per IP.

    slowapi's default keys on remote address, which on mobile carriers means one
    NAT gateway shares a bucket across thousands of unrelated users. We read the
    JWT subject instead; signature verification is the dependency's job, so an
    unverified read is fine here — a forged token still fails auth and never
    reaches the handler.
    """
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        try:
            claims = jwt.get_unverified_claims(auth[7:])
            subject = claims.get("sub")
            if subject:
                return f"user:{subject}"
        except Exception:
            pass
    client = request.client
    return f"ip:{client.host if client else 'unknown'}"


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _split_navigate(text: str) -> tuple[str, dict | None]:
    """Separate the trailing navigate marker from the visible answer."""
    index = text.find(NAVIGATE_MARKER)
    if index == -1:
        return text, None

    visible = text[:index].rstrip()
    tail = text[index + len(NAVIGATE_MARKER):]
    end = tail.find(">>")
    if end == -1:
        return visible, None

    try:
        raw = json.loads(tail[:end].strip())
    except (ValueError, TypeError):
        return visible, None
    if not isinstance(raw, dict):
        return visible, None

    route = raw.get("route")
    if route not in ALLOWED_ROUTES:
        logger.info("assistant proposed disallowed route %r", route)
        return visible, None

    action: dict[str, Any] = {"type": "navigate", "route": route}
    sheet = raw.get("open")
    if sheet in ALLOWED_SHEETS:
        action["open"] = sheet
    label = raw.get("label")
    action["label"] = str(label)[:40] if label else "Take me there"
    return visible, action


def _emittable(buffer: str) -> tuple[str, str]:
    """Split buffered text into (safe to send now, hold back).

    Holds back any tail that could be the start of the navigate marker, so the
    marker never flickers on screen before we recognise and strip it.
    """
    index = buffer.find(NAVIGATE_MARKER)
    if index != -1:
        return buffer[:index], buffer[index:]
    for size in range(len(NAVIGATE_MARKER) - 1, 0, -1):
        if buffer.endswith(NAVIGATE_MARKER[:size]):
            return buffer[:-size], buffer[-size:]
    return buffer, ""


async def _run_agent(
    db: Session, user: User, body: ChatRequest
) -> AsyncIterator[str]:
    """Agent loop: call the model, run any tools it asks for, stream the answer."""
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": build_system_prompt(body.month)}
    ]
    # Trim history to the last 20 turns — enough for context, bounded for cost.
    messages.extend({"role": m.role, "content": m.content} for m in body.messages[-20:])

    try:
        for _ in range(settings.MAX_TOOL_ROUNDS):
            answer = ""
            pending = ""
            announced_thinking = False
            tool_calls: dict[int, dict[str, Any]] = {}

            async for chunk in providers.stream_chat(messages, tools=TOOL_SCHEMAS):
                # The provider layer announces a drop to the fallback in-stream.
                # It is much slower, so tell the UI immediately rather than
                # leaving the user watching a spinner for up to ~100s.
                if "__meta__" in chunk:
                    if chunk["__meta__"].get("fallback"):
                        yield _sse({"type": "status", "state": "fallback"})
                    continue

                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}

                # Reasoning tokens are never forwarded: they must not reach the
                # user's bubble or the navigate parser. Announce once so the UI
                # can show a "thinking" state instead of dead air.
                if delta.get("reasoning_content") and not announced_thinking:
                    announced_thinking = True
                    yield _sse({"type": "status", "state": "thinking"})

                for call in delta.get("tool_calls") or []:
                    slot = tool_calls.setdefault(
                        call.get("index", 0), {"name": "", "args": "", "id": ""}
                    )
                    if call.get("id"):
                        slot["id"] = call["id"]
                    fn = call.get("function") or {}
                    if fn.get("name"):
                        slot["name"] = fn["name"]
                    if fn.get("arguments"):
                        slot["args"] += fn["arguments"]

                piece = delta.get("content")
                if piece:
                    answer += piece
                    pending += piece
                    send, pending = _emittable(pending)
                    if send:
                        yield _sse({"type": "delta", "text": send})

            if tool_calls:
                # Record the assistant's tool-call turn, then each result, and
                # loop so the model can answer using what it just fetched.
                messages.append(
                    {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [
                            {
                                "id": c["id"] or f"call_{i}",
                                "type": "function",
                                "function": {"name": c["name"], "arguments": c["args"] or "{}"},
                            }
                            for i, c in sorted(tool_calls.items())
                        ],
                    }
                )
                for i, call in sorted(tool_calls.items()):
                    yield _sse({"type": "tool", "name": call["name"]})
                    result = run_tool(
                        db, user.id, call["name"], call["args"], body.month
                    )
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": call["id"] or f"call_{i}",
                            "name": call["name"],
                            "content": result,
                        }
                    )
                continue

            # No tool calls: this was the final answer. `pending` is already part
            # of `answer` (each piece is appended to both), so re-split the whole
            # answer and emit only what the hold-back buffer never released.
            emitted = len(answer) - len(pending)
            visible, action = _split_navigate(answer)
            if len(visible) > emitted:
                yield _sse({"type": "delta", "text": visible[emitted:]})
            if action:
                yield _sse(action)
            yield _sse({"type": "done"})
            return

        # Tool budget exhausted without a final answer.
        yield _sse(
            {
                "type": "error",
                "code": "tool_loop_exhausted",
                "message": "I couldn't finish that one. Try asking a simpler question.",
            }
        )
        yield _sse({"type": "done"})

    except providers.ChatUnavailable as exc:
        logger.error("assistant chat unavailable: %s", exc)
        yield _sse(
            {
                "type": "error",
                "code": "chat_unavailable",
                "message": "The assistant is unavailable right now. Please try again shortly.",
            }
        )
        yield _sse({"type": "done"})
    except Exception:
        logger.exception("assistant chat failed for user %s", user.id)
        yield _sse(
            {
                "type": "error",
                "code": "internal",
                "message": "Something went wrong. Please try again.",
            }
        )
        yield _sse({"type": "done"})


@router.post("/chat")
# 20/min was set before the provider capacity was known and was fiction: Groq's
# free tier allows roughly 5 questions per MINUTE across the whole organisation,
# not per user. This cap's real job is stopping one user consuming that shared
# budget alone; overflow beyond it is absorbed by the NVIDIA fallback.
@limiter.limit("12/minute", key_func=user_rate_key)
async def chat(
    request: Request,
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Stream an assistant reply as SSE.

    Event types: status | delta | tool | navigate | error | done.
    Errors arrive as an SSE `error` event rather than an HTTP status, because by
    the time one occurs the 200 response has usually already begun streaming.
    """
    if not providers.chat_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "chat_unavailable", "message": "Assistant is not configured."},
        )

    return StreamingResponse(
        _run_agent(db, current_user, body),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # stops proxies buffering the stream
        },
    )


@router.post("/transcribe", response_model=TranscriptionOut)
@limiter.limit("10/minute", key_func=user_rate_key)
async def transcribe(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
):
    """Transcribe one short audio clip via Groq Whisper.

    A failure here NEVER affects chat — the client disables only the mic. The
    60-second recording limit is enforced client-side (we can't read duration
    without decoding); the byte cap below is the server-side abuse backstop.
    """
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail={"code": "empty_audio", "message": "No audio received."})
    if len(audio) > settings.MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "audio_too_large",
                "message": f"Recordings are capped at {settings.MAX_AUDIO_SECONDS} seconds.",
            },
        )

    # Bias decoding toward names this user actually has, so "Swiggy" and their
    # own category names survive transcription.
    hint = None
    try:
        from app.crud import account_crud, category_crud

        names = [c.name for c in (category_crud.get_all_categories(db, user_id=current_user.id) or [])]
        names += [a.name for a in (account_crud.get_all_accounts(db, user_id=current_user.id) or [])]
        if names:
            # A BARE comma-separated list, deliberately not a sentence.
            # Whisper's `prompt` biases decoding, and it will happily transcribe
            # the prompt itself when the audio is quiet or ambiguous. An earlier
            # version led with "Expense tracking. Categories and accounts:" and
            # that phrase was being prepended to real user speech. A word list
            # has no grammar for it to echo.
            hint = ", ".join(names[:40])
    except Exception:
        logger.warning("could not build vocab hint", exc_info=True)

    try:
        text = await providers.transcribe(
            audio,
            filename=file.filename or "audio.m4a",
            content_type=file.content_type or "audio/m4a",
            vocab_hint=hint,
        )
    except providers.VoiceBusy as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "voice_busy", "message": "Voice is busy — try again in a moment."},
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc
    except providers.VoiceUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "voice_unavailable",
                "message": "Voice input is temporarily unavailable — you can still type.",
            },
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc

    return TranscriptionOut(text=text)


@router.get("/health", response_model=AssistantHealth)
def assistant_health(current_user: User = Depends(deps.get_current_active_user)):
    """Capability probe the client polls to decide whether to enable the mic."""
    voice_ok, reason = providers.voice_status()
    return AssistantHealth(
        chat=providers.chat_available(), voice=voice_ok, voice_reason=reason
    )
