"""Resilient LLM call wrapper with retry + fallback model routing."""

from __future__ import annotations

import time
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage

from src.tracking.cost_tracker import PipelineMetrics
from config.settings import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    LLM_MAX_RETRIES,
    LLM_RETRY_BASE_DELAY,
)


def resilient_invoke(
    llm: ChatOpenAI,
    messages: list[BaseMessage],
    config: dict[str, Any],
    *,
    fallback_model: str | None = None,
    fallback_temperature: float | None = None,
    fallback_max_tokens: int | None = None,
) -> Any:
    """Invoke an LLM with retry + exponential backoff, then fallback model.

    Args:
        llm: Primary LangChain LLM instance.
        messages: Messages to send.
        config: LangChain invoke config (callbacks, metadata, tags).
        fallback_model: OpenRouter model ID to try if primary exhausts retries.
        fallback_temperature: Temperature for fallback model (defaults to primary).
        fallback_max_tokens: Max tokens for fallback model (defaults to primary).

    Returns:
        LLM response object.

    Raises:
        The last exception if both primary and fallback fail.
    """
    metrics = PipelineMetrics()

    # --- Primary model with retries ---
    last_exc: Exception | None = None
    for attempt in range(LLM_MAX_RETRIES):
        try:
            return llm.invoke(messages, config=config)
        except Exception as exc:
            last_exc = exc
            if attempt < LLM_MAX_RETRIES - 1:
                delay = LLM_RETRY_BASE_DELAY * (2 ** attempt)
                print(
                    f"[self-heal] Primary LLM attempt {attempt + 1}/{LLM_MAX_RETRIES} "
                    f"failed ({type(exc).__name__}: {exc}). Retrying in {delay}s..."
                )
                metrics.record_retry()
                time.sleep(delay)
            else:
                metrics.record_retry()

    # --- Fallback model ---
    if fallback_model is None:
        raise last_exc  # type: ignore[misc]

    print(
        f"[self-heal] Primary model exhausted {LLM_MAX_RETRIES} retries. "
        f"Falling back to {fallback_model}"
    )
    metrics.record_fallback()

    # Build a one-off fallback LLM with the same base config
    temperature = fallback_temperature
    if temperature is None:
        temperature = llm.temperature  # type: ignore[union-attr]
    max_tokens = fallback_max_tokens
    if max_tokens is None:
        max_tokens = llm.max_tokens  # type: ignore[union-attr]

    fallback_llm = ChatOpenAI(
        model=fallback_model,
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE_URL,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    # Single attempt on fallback (no retry loop — keep it simple)
    return fallback_llm.invoke(messages, config=config)
