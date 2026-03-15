"""Configuration and settings for the ad generation pipeline."""

import os
from dotenv import load_dotenv

load_dotenv()

# --- API Keys ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
if not OPENROUTER_API_KEY:
    import warnings
    warnings.warn(
        "OPENROUTER_API_KEY not set — LLM calls will fail. "
        "Set it in .env or as an environment variable.",
        stacklevel=1,
    )
LANGSMITH_API_KEY = os.getenv("LANGSMITH_API_KEY", "")
LANGSMITH_PROJECT = os.getenv("LANGSMITH_PROJECT", "nerdy-ad-engine")

# --- OpenRouter Base URL ---
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# --- Model Configuration (OpenRouter model IDs) ---
# Fast + cheap for drafts (creative copy generation)
MODEL_DRAFT = os.getenv("MODEL_DRAFT", "google/gemini-3-flash-preview")
# Same quality model for targeted refinement
MODEL_REFINE = os.getenv("MODEL_REFINE", "google/gemini-3-flash-preview")
# Cheapest model for evaluation (most frequent calls — 5 dims × iterations × briefs)
MODEL_EVAL = os.getenv("MODEL_EVAL", "google/gemini-3.1-flash-lite-preview")
# Vision model for image evaluation (needs multimodal)
MODEL_VISION = os.getenv("MODEL_VISION", "google/gemini-3-flash-preview")
# Image generation model (Gemini with native image output)
MODEL_IMAGE = os.getenv("MODEL_IMAGE", "google/gemini-3.1-flash-image-preview")

# --- Fallback Models (self-healing pipeline) ---
MODEL_DRAFT_FALLBACK = os.getenv("MODEL_DRAFT_FALLBACK", "google/gemini-2.5-flash-preview")
MODEL_REFINE_FALLBACK = os.getenv("MODEL_REFINE_FALLBACK", "google/gemini-2.5-flash-preview")
MODEL_EVAL_FALLBACK = os.getenv("MODEL_EVAL_FALLBACK", "google/gemini-2.0-flash-exp:free")

# --- Retry Settings (self-healing pipeline) ---
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "3"))
LLM_RETRY_BASE_DELAY = float(os.getenv("LLM_RETRY_BASE_DELAY", "1.0"))

# --- Available Models (curated list for UI selection) ---
AVAILABLE_MODELS = {
    "text": [
        "google/gemini-3-flash-preview",
        "google/gemini-3.1-flash-lite-preview",
        "google/gemini-2.5-flash-preview",
        "google/gemini-2.5-pro-preview-06-05",
        "anthropic/claude-sonnet-4",
        "anthropic/claude-haiku-4",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "meta-llama/llama-4-maverick",
        "deepseek/deepseek-r1",
    ],
    "vision": [
        "google/gemini-3-flash-preview",
        "google/gemini-2.5-flash-preview",
        "google/gemini-2.5-pro-preview-06-05",
        "anthropic/claude-sonnet-4",
        "openai/gpt-4o",
    ],
    "image": [
        "google/gemini-3.1-flash-image-preview",
        "google/gemini-2.0-flash-exp:free",
    ],
}

# --- Cost Per Token (USD) — OpenRouter pricing ---
COST_PER_TOKEN = {
    "google/gemini-3-flash-preview": {"input": 0.0000005, "output": 0.000003},
    "google/gemini-3.1-flash-lite-preview": {"input": 0.00000025, "output": 0.0000015},
    "google/gemini-3.1-flash-image-preview": {"input": 0.0000005, "output": 0.000003, "per_image": 0.06},
}

# --- Pipeline Settings ---
MAX_COPY_ITERATIONS = int(os.getenv("MAX_COPY_ITERATIONS", "3"))
MAX_IMAGE_ITERATIONS = int(os.getenv("MAX_IMAGE_ITERATIONS", "3"))
QUALITY_THRESHOLD = float(os.getenv("QUALITY_THRESHOLD", "7.0"))
EARLY_STOP_THRESHOLD = float(os.getenv("EARLY_STOP_THRESHOLD", "9.0"))
RANDOM_SEED = 42

# --- LLM Settings ---
LLM_TEMPERATURE = 0.7          # Creative temp for initial drafts
LLM_REFINE_TEMPERATURE = 0.4   # Lower temp for refinement — more controlled edits
LLM_EVAL_TEMPERATURE = 0.1     # Low temp for consistent evaluation
LLM_MAX_OUTPUT_TOKENS = 2048

# --- Output Paths ---
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")
IMAGES_DIR = os.path.join(OUTPUT_DIR, "images")
VISUALIZATIONS_DIR = os.path.join(OUTPUT_DIR, "visualizations")
REPORTS_DIR = os.path.join(OUTPUT_DIR, "reports")
