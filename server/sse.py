"""Server-Sent Events broadcaster for live pipeline updates."""

from __future__ import annotations

import asyncio
import collections
import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)

EVENT_BUFFER_SIZE = 50


class SSEBroadcaster:
    """Fan-out event broadcaster for SSE clients."""

    _instance: SSEBroadcaster | None = None
    _init_lock = threading.Lock()

    def __new__(cls) -> SSEBroadcaster:
        with cls._init_lock:
            if cls._instance is None:
                inst = super().__new__(cls)
                inst._queues: list[asyncio.Queue] = []
                inst._lock = threading.Lock()
                inst._loop: asyncio.AbstractEventLoop | None = None
                inst._recent: collections.deque = collections.deque(maxlen=EVENT_BUFFER_SIZE)
                cls._instance = inst
        return cls._instance

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        with self._lock:
            for event in self._recent:
                q.put_nowait(event)
            self._queues.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        with self._lock:
            if q in self._queues:
                self._queues.remove(q)

    def broadcast(self, event_type: str, data: dict[str, Any]) -> None:
        """Thread-safe broadcast to all SSE clients."""
        payload = {"type": event_type, **data}
        with self._lock:
            self._recent.append(payload)
            queues = list(self._queues)
        for q in queues:
            if self._loop and self._loop.is_running():
                try:
                    self._loop.call_soon_threadsafe(q.put_nowait, payload)
                except RuntimeError:
                    logger.warning(
                        "Failed to deliver SSE event %s: event loop closed",
                        event_type,
                    )
                except Exception as exc:
                    logger.warning(
                        "Failed to deliver SSE event %s to a client: %s",
                        event_type,
                        exc,
                    )

    def broadcast_sync(self, event_type: str, data: dict[str, Any]) -> None:
        """Synchronous broadcast (for use from background threads)."""
        self.broadcast(event_type, data)
