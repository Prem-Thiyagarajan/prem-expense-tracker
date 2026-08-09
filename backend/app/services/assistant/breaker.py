# File: app/services/assistant/breaker.py
"""A minimal circuit breaker, used to isolate the Groq (voice) dependency.

Why this exists: during a Groq outage every mic press would otherwise wait out
the full HTTP timeout before failing. That burns the user's time and our
request quota to learn something we already knew. Once the breaker is open we
fail instantly and the client disables the mic — while text chat, which never
touches Groq, keeps working normally.

Deliberately per-process and in-memory: Render runs a single web service, and a
breaker that resets on deploy is the correct failure mode (a fresh process
should re-probe rather than inherit a stale "everything is down").
"""
import threading
import time


class CircuitBreaker:
    def __init__(self, name: str, failure_threshold: int = 3, reset_after_seconds: float = 60.0):
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_after_seconds = reset_after_seconds
        self._lock = threading.Lock()
        self._consecutive_failures = 0
        self._opened_at: float | None = None
        self.last_error: str | None = None

    @property
    def is_open(self) -> bool:
        """True when calls should be short-circuited.

        Reading this also performs the half-open transition: once the cooldown
        has elapsed we report closed so exactly one probe call is allowed
        through. If that probe fails, `record_failure` re-opens immediately.
        """
        with self._lock:
            if self._opened_at is None:
                return False
            if time.monotonic() - self._opened_at >= self.reset_after_seconds:
                self._opened_at = None
                self._consecutive_failures = 0
                return False
            return True

    def record_success(self) -> None:
        with self._lock:
            self._consecutive_failures = 0
            self._opened_at = None
            self.last_error = None

    def record_failure(self, error: str | None = None) -> None:
        with self._lock:
            self._consecutive_failures += 1
            self.last_error = error
            if self._consecutive_failures >= self.failure_threshold:
                self._opened_at = time.monotonic()

    def seconds_until_retry(self) -> int:
        with self._lock:
            if self._opened_at is None:
                return 0
            remaining = self.reset_after_seconds - (time.monotonic() - self._opened_at)
            return max(0, int(remaining))


# One breaker for Groq only. Chat (NVIDIA) intentionally has none: a chat
# failure is reported inline in the stream and retried by the user, and sharing
# a breaker between providers is exactly the coupling this design forbids.
groq_breaker = CircuitBreaker("groq", failure_threshold=3, reset_after_seconds=60.0)
