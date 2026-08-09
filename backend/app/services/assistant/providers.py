# File: app/services/assistant/providers.py
"""HTTP clients for the assistant's providers.

Chat runs on an ordered provider list (Groq, then NVIDIA) with transparent
failover. Voice runs on Groq alone, behind a circuit breaker.

The two features keep SEPARATE httpx clients, timeouts and failure handling, so
a provider problem degrades one without touching the other. Note the asymmetry
this creates now that Groq serves both: if Groq dies, chat silently fails over
to NVIDIA and keeps working, while voice goes unavailable. That is the intended
behaviour — text chat is the feature, voice is an input convenience.
"""
import json
import logging
from dataclasses import dataclass
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
    """Every configured chat provider failed, or none is configured."""


class _ProviderFailure(Exception):
    """One provider failed in a way worth retrying on the next one."""


# ── Chat providers ──────────────────────────────────────────────────────────

@dataclass(frozen=True)
class ChatProvider:
    name: str
    base_url: str
    api_key: str
    read_timeout: float


def _chat_providers() -> list[ChatProvider]:
    """The configured chat providers, in failover order.

    Providers without a key are skipped rather than erroring, so removing a key
    from the environment cleanly removes that provider from the chain.
    """
    catalogue = {
        "groq": (settings.GROQ_API_KEY, settings.GROQ_BASE_URL, settings.GROQ_READ_TIMEOUT),
        "nvidia": (settings.NVIDIA_API_KEY, settings.NVIDIA_BASE_URL, settings.NVIDIA_READ_TIMEOUT),
    }
    providers: list[ChatProvider] = []
    for name in (n.strip().lower() for n in settings.CHAT_PROVIDER_ORDER.split(",")):
        entry = catalogue.get(name)
        if not entry:
            continue
        key, base_url, timeout = entry
        if key:
            providers.append(ChatProvider(name, base_url, key, timeout))
    return providers


def chat_available() -> bool:
    return bool(_chat_providers())


def voice_status() -> tuple[bool, str | None]:
    """(available, reason_if_not) — drives the client's mic state."""
    if not settings.GROQ_API_KEY:
        return False, "not_configured"
    if groq_breaker.is_open:
        return False, "provider_unavailable"
    return True, None


def _build_payload(
    messages: list[dict[str, Any]], tools: list[dict] | None, tool_choice: str
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": settings.ASSISTANT_MODEL,
        "messages": messages,
        "stream": True,
        "max_tokens": settings.ASSISTANT_MAX_TOKENS,
        "temperature": 0.3,
        # gpt-oss reasons before answering and that time is all time-to-first-
        # token. "low" measurably cut reasoning output with no quality loss on
        # these short, tool-grounded answers.
        # (chat_template_kwargs {"thinking": false} is silently ignored by both
        # providers and measured *slower* — don't reach for it.)
        "reasoning_effort": settings.ASSISTANT_REASONING_EFFORT,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = tool_choice
    return payload


async def _stream_from(provider: ChatProvider, payload: dict[str, Any]) -> AsyncIterator[dict]:
    """Stream from one provider. Raises _ProviderFailure if the next should try."""
    headers = {
        "Authorization": f"Bearer {provider.api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    timeout = httpx.Timeout(
        connect=10.0, read=provider.read_timeout, write=30.0, pool=10.0
    )

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST", f"{provider.base_url}/chat/completions", json=payload, headers=headers
            ) as response:
                if response.status_code >= 400:
                    body = (await response.aread()).decode("utf-8", "replace")[:300]
                    # EVERY error is retryable on the next provider, including
                    # 4xx. An earlier version only retried 429/5xx on the theory
                    # that a 4xx means a malformed request that fails everywhere
                    # — but that is wrong for exactly the cases failover exists
                    # to survive: 401/403 is a bad key for THIS provider only,
                    # 404 is a model id this provider doesn't host, and a 400 can
                    # be one vendor rejecting a parameter the other accepts. The
                    # cost of being wrong here is one extra request on an error
                    # path; the cost of not retrying is an outage.
                    raise _ProviderFailure(f"HTTP {response.status_code}: {body}")

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        return
                    try:
                        yield json.loads(data)
                    except ValueError:
                        continue
    except httpx.HTTPError as exc:
        # Log the exception TYPE, not just str(exc): httpx transport errors
        # (ReadTimeout, RemoteProtocolError, ConnectError) frequently stringify
        # to an empty string, which turns a production log line into
        # "transport error: " and tells you nothing about what actually broke.
        raise _ProviderFailure(f"{type(exc).__name__}: {exc or '(no detail)'}") from exc


async def stream_chat(
    messages: list[dict[str, Any]],
    tools: list[dict] | None = None,
    tool_choice: str = "auto",
) -> AsyncIterator[dict]:
    """Yield raw OpenAI-style streaming chunks, failing over between providers.

    Failover is only attempted BEFORE the first chunk reaches the caller. Once
    tokens have been handed downstream they are already rendering in the user's
    bubble, so restarting on another provider would replay a second, different
    answer on top of the first. After that point a break is a break.
    """
    providers = _chat_providers()
    if not providers:
        raise ChatUnavailable("No chat provider is configured")

    payload = _build_payload(messages, tools, tool_choice)
    last_error: str | None = None

    for provider in providers:
        emitted = False
        is_fallback = provider is not providers[0]
        # Announce the fallback IN the stream, before the first real chunk. A
        # callback would not do: the caller is an `async for`, so its body only
        # runs when a chunk arrives — and the fallback's first chunk can be 100s
        # away, which is exactly the wait the warning exists to explain.
        # `__meta__` cannot collide with an OpenAI chunk; the caller skips it.
        if is_fallback:
            yield {"__meta__": {"fallback": provider.name}}
        try:
            async for chunk in _stream_from(provider, payload):
                emitted = True
                yield chunk
            if is_fallback:
                logger.info("chat served by fallback provider %s", provider.name)
            return
        except _ProviderFailure as exc:
            last_error = f"{provider.name}: {exc}"
            if emitted:
                logger.error("chat %s broke mid-answer: %s", provider.name, exc)
                raise ChatUnavailable(last_error) from exc
            logger.warning("chat %s failed before first token, trying next: %s", provider.name, exc)
            continue

    raise ChatUnavailable(last_error or "All chat providers failed")


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
        detail = f"{type(exc).__name__}: {exc or '(no detail)'}"
        groq_breaker.record_failure(detail)
        logger.error("Groq transcribe transport error: %s", detail)
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
        logger.error("Groq transcribe %s: %s", response.status_code, response.text[:300])
        raise VoiceUnavailable("provider_unavailable")

    groq_breaker.record_success()
    try:
        return (response.json().get("text") or "").strip()
    except ValueError as exc:
        raise VoiceUnavailable("provider_unavailable") from exc
