"""Rate limiter for OpenRouter API limits."""

from __future__ import annotations

import threading
import time
import functools
from typing import Any


class RateLimiter:
    """Token bucket rate limiter for API calls.

    OpenRouter rate limits for Gemini models:
    - 15 requests per minute
    - 1,000,000 input tokens per minute
    - 1,500 requests per day
    """

    _instance: RateLimiter | None = None
    _init_lock = threading.Lock()

    def __new__(cls) -> RateLimiter:
        with cls._init_lock:
            if cls._instance is None:
                inst = super().__new__(cls)
                inst._last_call = 0.0
                inst._calls_this_minute = 0
                inst._minute_start = 0.0
                inst._calls_today = 0
                inst._day_start = time.time()
                inst.rpm_limit = 28  # Batched eval means fewer calls; 429 retry handles bursts
                inst.daily_limit = 1400  # Stay under 1500/day
                inst.min_delay = 0.5  # Minimal floor — rely on RPM counter + 429 retry
                cls._instance = inst
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        if cls._instance:
            cls._instance._calls_this_minute = 0
            cls._instance._minute_start = 0.0
            cls._instance._calls_today = 0
            cls._instance._day_start = time.time()

    def wait_if_needed(self) -> float:
        """Block until it's safe to make another API call. Returns wait time in seconds."""
        now = time.time()
        waited = 0.0

        # Reset minute counter if a minute has passed
        if now - self._minute_start >= 60:
            self._calls_this_minute = 0
            self._minute_start = now

        # Reset daily counter if a day has passed
        if now - self._day_start >= 86400:
            self._calls_today = 0
            self._day_start = now

        # Check daily limit
        if self._calls_today >= self.daily_limit:
            print(f"\n  [RateLimit] Daily limit ({self.daily_limit}) reached. Quota resets tomorrow.")
            raise RuntimeError(
                f"Daily API quota exhausted ({self._calls_today} calls). "
                f"Daily limit is ~1500 calls/day. Wait until tomorrow or use a different API key."
            )

        # Enforce minimum delay between calls
        elapsed = now - self._last_call
        if elapsed < self.min_delay:
            wait = self.min_delay - elapsed
            time.sleep(wait)
            waited = wait

        # Check per-minute limit
        if self._calls_this_minute >= self.rpm_limit:
            wait_until = self._minute_start + 61 - time.time()
            if wait_until > 0:
                print(f"  [RateLimit] RPM limit hit, waiting {wait_until:.0f}s...")
                time.sleep(wait_until)
                waited += wait_until
                self._calls_this_minute = 0
                self._minute_start = time.time()

        self._last_call = time.time()
        self._calls_this_minute += 1
        self._calls_today += 1

        return waited

    @property
    def calls_remaining_today(self) -> int:
        return max(0, self.daily_limit - self._calls_today)

    @property
    def status(self) -> dict:
        return {
            "calls_today": self._calls_today,
            "daily_limit": self.daily_limit,
            "remaining": self.calls_remaining_today,
            "calls_this_minute": self._calls_this_minute,
            "rpm_limit": self.rpm_limit,
        }


def rate_limited_retry(max_retries: int = 3, base_delay: float = 15.0):
    """Decorator that adds rate limiting + exponential backoff retry for 429 errors."""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            limiter = RateLimiter()
            last_error = None

            for attempt in range(max_retries + 1):
                limiter.wait_if_needed()

                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    error_str = str(e)
                    if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                        last_error = e
                        delay = base_delay * (2 ** attempt)
                        print(f"  [Retry] 429 error, attempt {attempt + 1}/{max_retries + 1}. "
                              f"Waiting {delay:.0f}s...")
                        time.sleep(delay)
                    else:
                        raise

            raise last_error or RuntimeError("Max retries exceeded")

        return wrapper
    return decorator
