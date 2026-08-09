from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str

    # ── Assistant (in-app chatbot) ───────────────────────────────────────────
    # Provider keys. Both are Optional on purpose: a missing key is a *degraded
    # capability* reported by GET /assistant/health, never a boot failure — the
    # rest of the API (transactions, budgets, auth) must keep serving.
    #
    #   both unset          -> chat unavailable, app still runs
    #   GROQ_API_KEY unset  -> voice unavailable; chat falls to NVIDIA
    #   NVIDIA_API_KEY unset-> chat is Groq-only (no fallback), voice unaffected
    GROQ_API_KEY: str | None = None
    NVIDIA_API_KEY: str | None = None

    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"

    # Both providers serve the same model under the same id, which is what makes
    # transparent failover possible without a second prompt or tool schema.
    ASSISTANT_MODEL: str = "openai/gpt-oss-120b"
    WHISPER_MODEL: str = "whisper-large-v3-turbo"

    # ── Chat failover ────────────────────────────────────────────────────────
    # Comma-separated, tried in order. Groq first because measured
    # time-to-first-token is ~0.5-1s against NVIDIA's 0.7-45s (and occasionally
    # never); NVIDIA second because Groq's free tier caps at 8k tokens/minute
    # ORG-WIDE, so overflow needs somewhere to go. Two vendors also means a
    # single provider outage degrades chat rather than removing it.
    CHAT_PROVIDER_ORDER: str = "groq,nvidia"

    # Per-provider read timeouts. Deliberately asymmetric: Groq answers in under
    # a second, so a short ceiling means we give up and fail over quickly instead
    # of making the user wait. NVIDIA is the slow-but-usually-works fallback and
    # gets room to breathe — measured up to 45s.
    GROQ_READ_TIMEOUT: float = 25.0
    NVIDIA_READ_TIMEOUT: float = 120.0

    # low | medium | high. gpt-oss thinks before answering and that time lands
    # entirely in time-to-first-token, which on a phone reads as a hung app.
    ASSISTANT_REASONING_EFFORT: str = "low"

    # Hard ceilings. MAX_AUDIO_SECONDS mirrors the client's 60s recorder stop —
    # duplicated here because the client's limit is a UX affordance, not a
    # guarantee (a modified client can post anything).
    MAX_AUDIO_SECONDS: int = 60
    MAX_AUDIO_BYTES: int = 8 * 1024 * 1024
    # Caps the agent loop so a model that keeps requesting tools can't spin.
    MAX_TOOL_ROUNDS: int = 4
    ASSISTANT_MAX_TOKENS: int = 800

    class Config:
        env_file = ".env"
        # pydantic-settings v2 rejects undeclared env vars by default, so any
        # variable this class doesn't name (SECRET_KEY, plus whatever Render
        # injects) would raise at import. Settings should only care about the
        # keys it declares — everything else is somebody else's business.
        # (SECRET_KEY is read directly via os.getenv in app/core/security.py.)
        extra = "ignore"

settings = Settings()
