"""LLM tracing configuration — supports Langfuse and LangSmith callbacks."""

from __future__ import annotations

import os
from typing import Any


def _langfuse_enabled() -> bool:
    return bool(os.getenv("LANGFUSE_SECRET_KEY") and os.getenv("LANGFUSE_PUBLIC_KEY"))


def _langsmith_enabled() -> bool:
    return bool(os.getenv("LANGSMITH_API_KEY"))


def get_callbacks(
    pipeline_stage: str,
    iteration: int = 0,
    brief_id: str = "",
    extra_tags: list[str] | None = None,
) -> list[Any]:
    """Create LangChain callback list with tracing and metadata tags."""
    callbacks: list[Any] = []

    tags = [
        f"stage:{pipeline_stage}",
        f"iteration:{iteration}",
    ]
    if brief_id:
        tags.append(f"brief:{brief_id}")
    if extra_tags:
        tags.extend(extra_tags)

    # Langfuse (preferred if both are configured)
    if _langfuse_enabled():
        try:
            from langfuse.callback import CallbackHandler as LangfuseHandler

            handler = LangfuseHandler(
                secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
                public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
                host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
                tags=tags,
                metadata={
                    "pipeline_stage": pipeline_stage,
                    "iteration": iteration,
                    "brief_id": brief_id,
                },
                session_id=brief_id or None,
            )
            callbacks.append(handler)
        except ImportError:
            pass

    # LangSmith fallback
    elif _langsmith_enabled():
        try:
            from langchain_core.tracers import LangChainTracer

            tracer = LangChainTracer(
                project_name=os.getenv("LANGSMITH_PROJECT", "nerdy-ad-engine"),
                tags=tags,
            )
            callbacks.append(tracer)
        except ImportError:
            pass

    return callbacks


def get_run_metadata(
    pipeline_stage: str,
    iteration: int = 0,
    brief_id: str = "",
    step_name: str = "",
) -> dict[str, Any]:
    """Get metadata dict for attaching to LangChain invocations."""
    return {
        "pipeline_stage": pipeline_stage,
        "iteration": iteration,
        "brief_id": brief_id,
        "step_name": step_name,
    }
