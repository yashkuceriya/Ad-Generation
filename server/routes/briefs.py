"""Brief configuration endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

from src.models import AudienceSegment, CampaignGoal
from config.brand_guidelines import PRODUCT_OFFERS, APPROVED_CTAS
from src.intelligence.brief_factory import TONES

router = APIRouter()


@router.get("/presets")
def get_presets():
    return {
        "audiences": [e.value for e in AudienceSegment],
        "goals": [e.value for e in CampaignGoal],
        "offers": PRODUCT_OFFERS,
        "tones": TONES,
        "ctas": APPROVED_CTAS,
    }
