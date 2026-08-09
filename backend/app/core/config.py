from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str

    # ── Assistant (in-app chatbot) ───────────────────────────────────────────
    # Two independent providers. Chat and voice must be able to fail separately,
    # so neither key is allowed to break the other feature:
    #
    #   NVIDIA_API_KEY unset -> chat unavailable, app still runs
    #   GROQ_API_KEY   unset -> voice unavailable, chat fully functional
    #
    # Both are Optional for exactly that reason. A missing key is a *degraded
    # capability* reported by GET /assistant/health, never a boot failure — the
    # rest of the API (transactions, budgets, auth) must keep serving.
    NVIDIA_API_KEY: str | None = None
    GROQ_API_KEY: str | None = None

    # Non-secret provider config. Defaults are the public endpoints; override
    # via env only if a provider moves or you pin a different model.
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    ASSISTANT_MODEL: str = "openai/gpt-oss-120b"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    WHISPER_MODEL: str = "whisper-large-v3-turbo"
    # low | medium | high. gpt-oss thinks before answering and that time is all
    # time-to-first-token, which on a phone reads as the app being broken.
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
