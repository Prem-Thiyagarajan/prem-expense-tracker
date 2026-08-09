# File: app/services/assistant/providers.py
"""HTTP clients for the two assistant providers.

Chat (NVIDIA NIM) and voice (Groq Whisper) get SEPARATE httpx clients with
separate timeouts, and only Groq has a circuit breaker. That separation is the
whole mechanism behind "a Groq outage must not disable the assistant" — there
is no shared connection pool, no shared breaker, and no code path where
`stream_chat` awaits anything belonging to Groq.
"""
import logging
from typing import Any, AsyncIterator

import httpx

from app.core.config import settings
from .breaker import groq_breaker

logger = logging.getLogger(__name__)


class VoiceUnavailable(Exception):
    """Voice is down (outage, bad key, or breaker open). Mic should disable."""
    def __init__(self, reason: str, retry_after: int = 60):
        super().__init__(reason)
        self.reason = reason
        self.retry_after = retry_after


class VoiceBusy(Exception):
    """Groq rate-limited us. Transient — the mic stays enabled."""
    def __init__(self, retry_after: int = 10):
        super().__init__("Voice is busy")
        self.retry_after = retry_after


class ChatUnavailable(Exception):
    """Chat provider is unreachable or misconfigured."""


# ── Capability reporting ────────────────────────────────────────────────────

def chat_available() -> bool:
    return bool(settings.NVIDIA_API_KEY)


def voice_status() -> tuple[bool, str | None]:
    """(available, reason_if_not) — drives the client's mic state."""
    if not settings.GROQ_API_KEY:
        return False, "not_configured"
    if groq_breaker.is_open:
        return False, "provider_unavailable"
    return True, None


# ── Chat: NVIDIA NIM, OpenAI-compatible streaming ───────────────────────────

async def stream_chat(
    messages: list[dict[str, Any]],
    tools: list[dict] | None = None,
    tool_choice: str = "auto",
) -> AsyncIterator[dict]:
    """Yield raw OpenAI-style streaming chunks (the `choices[0].delta` objects).

    The caller assembles text deltas and tool calls; this layer only owns
    transport and leaves interpretation to the agent loop.
    """
    if not settings.NVIDIA_API_KEY:
        raise ChatUnavailable("NVIDIA_API_KEY is not configured")

    payload: dict[str, Any] = {
        "model": settings.ASSISTANT_MODEL,
        "messages": messages,
        "stream": True,
        "max_tokens": settings.ASSISTANT_MAX_TOKENS,
        "temperature": 0.3,
        # gpt-oss reasons before answering, and that thinking time lands entirely
        # in time-to-first-token. Measured on this endpoint: "low" cut reasoning
        # from ~235 to ~96 chars and first token from ~9.8s to ~7.7s with no
        # visible quality loss on these short, tool-grounded answers.
        # (chat_template_kwargs {"thinking": false} is silently ignored here —
        # it measured *slower* and still emitted reasoning. Don't reach for it.)
        "reasoning_effort": settings.ASSISTANT_REASONING_EFFORT,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = tool_choice

    headers = {
        "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }

    # Connect fast-fails on a dead host; read is generous because time-to-first-
    # token on this shared endpoint is both long and erratic — the same prompt
    # measured 7.7s, 9.8s and 35.6s across consecutive runs.
    timeout = httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                f"{settings.NVIDIA_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode("utf-8", "replace")[:400]
                    logger.error("NVIDIA chat %s: %s", response.status_code, body)
                    raise ChatUnavailable(f"Chat provider returned {response.status_code}")

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        return
                    try:
                        import json as _json
                        yield _json.loads(data)
                    except ValueError:
                        continue
    except httpx.HTTPError as exc:
        logger.error("NVIDIA chat transport error: %s", exc)
        raise ChatUnavailable("Could not reach the chat provider") from exc


# ── Voice: Groq Whisper, OpenAI-compatible multipart ────────────────────────

async def transcribe(
    audio_bytes: bytes, filename: str, content_type: str, vocab_hint: str | None
) -> str:
    """Send one clip to Groq and return the transcript.

    `vocab_hint` biases decoding toward the user's real category and merchant
    names, which is the difference between "Swiggy" and "swig ee".
    """
    if not settings.GROQ_API_KEY:
        raise VoiceUnavailable("not_configured")

    if groq_breaker.is_open:
        raise VoiceUnavailable("provider_unavailable", groq_breaker.seconds_until_retry())

    data = {
        "model": settings.WHISPER_MODEL,
        # Pinning English stops Whisper from deciding mid-clip that Indian-English
        # is Hindi/Tamil and returning a non-Latin script the model can't use.
        "language": "en",
        "response_format": "json",
        "temperature": "0",
    }
    if vocab_hint:
        data["prompt"] = vocab_hint[:800]

    timeout = httpx.Timeout(connect=10.0, read=60.0, write=60.0, pool=10.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{settings.GROQ_BASE_URL}/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                files={"file": (filename, audio_bytes, content_type)},
                data=data,
            )
    except httpx.HTTPError as exc:
        groq_breaker.record_failure(str(exc))
        logger.error("Groq transcribe transport error: %s", exc)
        raise VoiceUnavailable("provider_unavailable") from exc

    # 429 is Groq's own rate limit. It is transient and common under bursts, so
    # it must NOT trip the breaker — otherwise one busy moment disables the mic
    # for a full cooldown. This is the key distinction in the error taxonomy.
    if response.status_code == 429:
        retry_after = response.headers.get("retry-after")
        try:
            seconds = int(float(retry_after)) if retry_after else 10
        except ValueError:
            seconds = 10
        raise VoiceBusy(seconds)

    if response.status_code in (401, 403):
        groq_breaker.record_failure(f"auth {response.status_code}")
        logger.error(
            "Groq rejected our credentials (%s) — check GROQ_API_KEY", response.status_code
        )
        raise VoiceUnavailable("provider_unavailable")

    if response.status_code >= 400:
        groq_breaker.record_failure(f"http {response.status_code}")
        logger.error(
            "Groq transcribe %s: %s",
            response.status_code,
            response.text[:300],
        )
        raise VoiceUnavailable("provider_unavailable")

    groq_breaker.record_success()
    try:
        return (response.json().get("text") or "").strip()
    except ValueError as exc:
        raise VoiceUnavailable("provider_unavailable") from exc
