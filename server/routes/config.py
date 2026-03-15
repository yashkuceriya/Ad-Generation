"""Configuration endpoint — returns non-sensitive engine settings."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config.settings as settings
from config.evaluation_rubrics import DIMENSION_WEIGHTS
from config.brand_guidelines import BRAND_VOICE, BRAND_NAME

router = APIRouter()


class UpdateModelsRequest(BaseModel):
    draft: str | None = None
    refine: str | None = None
    evaluation: str | None = None
    vision: str | None = None
    image: str | None = None


class UpdatePipelineRequest(BaseModel):
    max_copy_iterations: int | None = None
    max_image_iterations: int | None = None
    quality_threshold: float | None = None
    early_stop_threshold: float | None = None


def _get_models():
    return {
        "draft": settings.MODEL_DRAFT,
        "refine": settings.MODEL_REFINE,
        "evaluation": settings.MODEL_EVAL,
        "vision": settings.MODEL_VISION,
        "image": settings.MODEL_IMAGE,
    }


@router.get("")
def get_config():
    return {
        "models": _get_models(),
        "temperatures": {
            "draft": settings.LLM_TEMPERATURE,
            "refine": settings.LLM_REFINE_TEMPERATURE,
            "evaluation": settings.LLM_EVAL_TEMPERATURE,
        },
        "max_output_tokens": settings.LLM_MAX_OUTPUT_TOKENS,
        "pipeline": {
            "max_copy_iterations": settings.MAX_COPY_ITERATIONS,
            "max_image_iterations": settings.MAX_IMAGE_ITERATIONS,
            "quality_threshold": settings.QUALITY_THRESHOLD,
            "early_stop_threshold": settings.EARLY_STOP_THRESHOLD,
        },
        "dimension_weights": DIMENSION_WEIGHTS,
        "cost_per_token": {
            model: {
                "input": rates["input"],
                "output": rates["output"],
                **({"per_image": rates["per_image"]} if "per_image" in rates else {}),
            }
            for model, rates in settings.COST_PER_TOKEN.items()
        },
        "brand": {
            "name": BRAND_NAME,
            "voice": BRAND_VOICE["tone"],
            "principles": BRAND_VOICE["principles"],
        },
        "available_models": settings.AVAILABLE_MODELS,
    }


@router.patch("/models")
def update_models(req: UpdateModelsRequest):
    """Update model assignments at runtime. Changes take effect on next pipeline run."""
    all_available = set()
    for models in settings.AVAILABLE_MODELS.values():
        all_available.update(models)

    updates = {}
    if req.draft is not None:
        settings.MODEL_DRAFT = req.draft
        updates["draft"] = req.draft
    if req.refine is not None:
        settings.MODEL_REFINE = req.refine
        updates["refine"] = req.refine
    if req.evaluation is not None:
        settings.MODEL_EVAL = req.evaluation
        updates["evaluation"] = req.evaluation
    if req.vision is not None:
        settings.MODEL_VISION = req.vision
        updates["vision"] = req.vision
    if req.image is not None:
        settings.MODEL_IMAGE = req.image
        updates["image"] = req.image

    if not updates:
        raise HTTPException(400, "No model updates provided")

    return {"updated": updates, "models": _get_models()}


@router.patch("/pipeline")
def update_pipeline(req: UpdatePipelineRequest):
    """Update pipeline settings at runtime."""
    updates = {}
    if req.max_copy_iterations is not None:
        if not 1 <= req.max_copy_iterations <= 10:
            raise HTTPException(400, "max_copy_iterations must be 1-10")
        settings.MAX_COPY_ITERATIONS = req.max_copy_iterations
        updates["max_copy_iterations"] = req.max_copy_iterations
    if req.max_image_iterations is not None:
        if not 1 <= req.max_image_iterations <= 10:
            raise HTTPException(400, "max_image_iterations must be 1-10")
        settings.MAX_IMAGE_ITERATIONS = req.max_image_iterations
        updates["max_image_iterations"] = req.max_image_iterations
    if req.quality_threshold is not None:
        if not 1.0 <= req.quality_threshold <= 10.0:
            raise HTTPException(400, "quality_threshold must be 1.0-10.0")
        settings.QUALITY_THRESHOLD = req.quality_threshold
        updates["quality_threshold"] = req.quality_threshold
    if req.early_stop_threshold is not None:
        if not 1.0 <= req.early_stop_threshold <= 10.0:
            raise HTTPException(400, "early_stop_threshold must be 1.0-10.0")
        settings.EARLY_STOP_THRESHOLD = req.early_stop_threshold
        updates["early_stop_threshold"] = req.early_stop_threshold

    if not updates:
        raise HTTPException(400, "No pipeline updates provided")

    return {
        "updated": updates,
        "pipeline": {
            "max_copy_iterations": settings.MAX_COPY_ITERATIONS,
            "max_image_iterations": settings.MAX_IMAGE_ITERATIONS,
            "quality_threshold": settings.QUALITY_THRESHOLD,
            "early_stop_threshold": settings.EARLY_STOP_THRESHOLD,
        },
    }
