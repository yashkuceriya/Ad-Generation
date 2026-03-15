"""SSE event stream endpoint."""

import asyncio
import json

from fastapi import APIRouter
from starlette.responses import StreamingResponse

from server.sse import SSEBroadcaster

router = APIRouter()


@router.get("/stream")
async def event_stream():
    broadcaster = SSEBroadcaster()
    queue = broadcaster.subscribe()

    async def generate():
        try:
            # Send initial heartbeat
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"

            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"data: {json.dumps(event, default=str)}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            broadcaster.unsubscribe(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
