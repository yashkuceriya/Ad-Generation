"""FastAPI application for Nerdy Ad Engine."""

import asyncio
import os
import sys
from contextlib import asynccontextmanager

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from server.state import RunStore
from server.sse import SSEBroadcaster
from server.routes import pipeline, ads, costs, briefs, events, calibration, config
from server.routes.trust import router as trust_router
from config.settings import IMAGES_DIR


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    loop = asyncio.get_event_loop()
    broadcaster = SSEBroadcaster()
    broadcaster.set_loop(loop)

    store = RunStore()
    loaded = store.load_existing_results()
    if loaded:
        print(f"  Loaded {loaded} existing ad results from previous run")

    yield
    # Shutdown (nothing needed)


app = FastAPI(
    title="Nerdy Ad Engine",
    description="Autonomous ad generation pipeline for Varsity Tutors SAT Prep",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount image directory
os.makedirs(IMAGES_DIR, exist_ok=True)
app.mount("/static/images", StaticFiles(directory=IMAGES_DIR), name="images")

# Register routes
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["Pipeline"])
app.include_router(ads.router, prefix="/api/ads", tags=["Ads"])
app.include_router(costs.router, prefix="/api/costs", tags=["Costs"])
app.include_router(briefs.router, prefix="/api/briefs", tags=["Briefs"])
app.include_router(events.router, prefix="/api/events", tags=["Events"])
app.include_router(calibration.router, prefix="/api/calibration", tags=["Calibration"])
app.include_router(config.router, prefix="/api/config", tags=["Config"])
app.include_router(trust_router, prefix="/api/trust", tags=["trust"])


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "nerdy-ad-engine"}


# Serve frontend static files (built React app)
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Serve React SPA — all non-API routes return index.html."""
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
