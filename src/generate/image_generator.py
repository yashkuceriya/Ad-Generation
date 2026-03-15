"""Image generation for ad creatives using Gemini via OpenRouter."""

from __future__ import annotations

import os
import time
import json
import base64

import requests as http_requests

from src.models import AdBrief, AdCopy, StepCost
from src.tracking.cost_tracker import CostTracker
from src.tracking.rate_limiter import RateLimiter
from config.settings import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    MODEL_IMAGE,
    IMAGES_DIR,
)
from config.brand_guidelines import IMAGE_GUIDELINES


IMAGE_PROMPT_TEMPLATE = """Create a high-end Facebook/Instagram ad image for Varsity Tutors SAT test prep.

VISUAL CONCEPT: {subject}

AD CONTEXT:
- Headline: {headline}
- Message: {primary_text}
- Audience: {audience}
- Goal: {campaign_goal}

IMAGE QUALITY:
- High resolution, sharp focus, crisp details throughout — no softness or blur anywhere
- Clean composition with no compression artifacts, noise, or pixelation
- Studio-quality product photography aesthetic with professional lighting and color grading
- Output at 1080x1080 square format, 1:1 aspect ratio, pixel-perfect for retina displays

ART DIRECTION:
- Photography style: Bright, warm, natural lighting. Shot on iPhone aesthetic — authentic not stock.
- Color palette: Clean blue (#1A73E8) as accent, warm natural tones, bright and airy
- Composition: Subject centered or rule-of-thirds. Lots of breathing room. Uncluttered.
- Mood: Confident, hopeful, empowering. Genuine smiles, not posed.
- Include subtle branded text overlay: bold headline in clean sans-serif font. Keep text minimal (headline only, 5-8 words max).
- Typography: White or dark text with subtle shadow/backdrop for readability
- DO NOT: use clip art, stock photo clichés, dark/gloomy colors, excessive text, or cluttered layouts
- DO: Show diversity, real-feeling moments, aspirational but achievable success"""


REFINEMENT_IMAGE_PROMPT = """Create an IMPROVED version of a Varsity Tutors SAT prep ad image. This is iteration {iteration} of {max_iterations}.

═══ PREVIOUS SCORES ═══
- Brand Consistency: {prev_brand}/10
- Engagement Potential: {prev_engage}/10
- Text-Image Alignment: {prev_align}/10
- Overall Average: {prev_avg}/10
- Weakest Dimension: {weakest_dim}

═══ EVALUATOR FEEDBACK ═══
{feedback}

═══ SPECIFIC IMPROVEMENTS NEEDED ═══
{suggestions}

═══ IMPROVEMENT TARGET ═══
Your goal: raise the weakest dimension ({weakest_dim}) by at least 1 point while maintaining or improving all other scores.

═══ PROTECT WHAT WORKS ═══
- Any dimension scoring 8+ MUST be preserved — do not regress on strengths
- Keep the same overall composition approach if it scored well
- Maintain brand color usage (blue #1A73E8) if brand consistency was high

═══ FIX WHAT'S WEAK ═══
- Focus creative energy on the weakest dimension
- If Brand Consistency is weak: ensure blue accent color, clean modern aesthetic, diverse students
- If Engagement Potential is weak: add visual drama — stronger contrast, more dynamic composition, eye-catching focal point
- If Text-Image Alignment is weak: make the image directly illustrate the headline message, ensure text overlay is legible

═══ AD CONTEXT ═══
- Headline: {headline}
- Message: {primary_text}
- Audience: {audience}
- Goal: {campaign_goal}

═══ IMAGE QUALITY (CRITICAL) ═══
- Maintain or improve image sharpness and detail clarity compared to the previous version
- Fix any blurriness, soft focus, or compression artifacts from the previous version
- Every element must be crisp and high-resolution — no muddy textures or noise

═══ ART DIRECTION (ALWAYS APPLY) ═══
- 1:1 square format (1080x1080), bright natural lighting, authentic photography style
- Blue (#1A73E8) accent color, warm natural tones, clean and uncluttered
- Diverse students, genuine expressions, empowering mood
- Subtle headline text overlay in clean sans-serif (white or dark with shadow)
- DO NOT: clip art, stock clichés, dark/gloomy colors, excessive text, cluttered layouts"""


class ImageGenerator:
    """Generates ad creative images using Gemini image model via OpenRouter."""

    def __init__(self):
        self.tracker = CostTracker()
        self.rate_limiter = RateLimiter()
        os.makedirs(IMAGES_DIR, exist_ok=True)

    def generate(
        self,
        ad_copy: AdCopy,
        brief: AdBrief,
        iteration: int = 1,
        max_iterations: int = 3,
        feedback: str | None = None,
        suggestions: list[str] | None = None,
        prev_scores: dict | None = None,
    ) -> tuple[str, str, StepCost]:
        """Generate an image. Returns (image_path, prompt_used, cost).

        prev_scores: dict with keys brand_consistency, engagement_potential,
                     text_image_alignment, average_score from previous evaluation.
        """
        subjects = IMAGE_GUIDELINES["subjects"]
        subject_idx = hash(brief.brief_id) % len(subjects)

        if feedback and prev_scores:
            # Determine weakest dimension
            dim_scores = {
                "Brand Consistency": prev_scores.get("brand_consistency", 5),
                "Engagement Potential": prev_scores.get("engagement_potential", 5),
                "Text-Image Alignment": prev_scores.get("text_image_alignment", 5),
            }
            weakest_dim = min(dim_scores, key=dim_scores.get)

            prompt = REFINEMENT_IMAGE_PROMPT.format(
                iteration=iteration,
                max_iterations=max_iterations,
                feedback=feedback,
                headline=ad_copy.headline,
                primary_text=ad_copy.primary_text[:100],
                audience=brief.audience_segment.value,
                campaign_goal=brief.campaign_goal.value,
                suggestions="\n".join(f"- {s}" for s in (suggestions or [])),
                prev_brand=prev_scores.get("brand_consistency", "N/A"),
                prev_engage=prev_scores.get("engagement_potential", "N/A"),
                prev_align=prev_scores.get("text_image_alignment", "N/A"),
                prev_avg=prev_scores.get("average_score", "N/A"),
                weakest_dim=weakest_dim,
            )
        elif feedback:
            # Fallback if no prev_scores provided (shouldn't happen normally)
            prompt = REFINEMENT_IMAGE_PROMPT.format(
                iteration=iteration,
                max_iterations=max_iterations,
                feedback=feedback,
                headline=ad_copy.headline,
                primary_text=ad_copy.primary_text[:100],
                audience=brief.audience_segment.value,
                campaign_goal=brief.campaign_goal.value,
                suggestions="\n".join(f"- {s}" for s in (suggestions or [])),
                prev_brand="N/A",
                prev_engage="N/A",
                prev_align="N/A",
                prev_avg="N/A",
                weakest_dim="unknown",
            )
        else:
            prompt = IMAGE_PROMPT_TEMPLATE.format(
                headline=ad_copy.headline,
                primary_text=ad_copy.primary_text[:100],
                audience=brief.audience_segment.value,
                campaign_goal=brief.campaign_goal.value,
                subject=subjects[subject_idx],
            )

        image_path = os.path.join(
            IMAGES_DIR, f"{brief.brief_id}_v{iteration}.png"
        )

        self.rate_limiter.wait_if_needed()

        start = time.perf_counter()

        try:
            self._generate_via_openrouter(prompt, image_path)
        except Exception as e:
            print(f"    [Image] Generation failed: {e}. Using placeholder.")
            image_path = self._create_placeholder(image_path, ad_copy)

        elapsed_ms = (time.perf_counter() - start) * 1000

        cost = self.tracker.record(
            model=MODEL_IMAGE,
            step_name="generate_image",
            pipeline_stage="image_generation",
            latency_ms=elapsed_ms,
            iteration=iteration,
            brief_id=brief.brief_id,
        )

        return image_path, prompt, cost

    def _generate_via_openrouter(self, prompt: str, output_path: str) -> None:
        """Generate image via Gemini image model on OpenRouter."""
        response = http_requests.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL_IMAGE,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 4096,
                # OpenRouter image generation parameters.
                # "size" and "quality" are supported by some models (e.g. DALL-E).
                # For Gemini image models via OpenRouter, image quality is primarily
                # controlled through the prompt. If OpenRouter adds model-specific
                # params (resolution, quality tier, etc.), set them here.
                # Ref: https://openrouter.ai/docs#image-generation
            },
            timeout=120,
        )

        if response.status_code != 200:
            raise RuntimeError(f"OpenRouter returned {response.status_code}: {response.text[:200]}")

        data = response.json()
        choice = data.get("choices", [{}])[0]
        msg = choice.get("message", {})

        image_bytes = None

        # Strategy 1: images array (some OpenRouter models)
        images = msg.get("images", [])
        if images:
            img_info = images[0]
            if isinstance(img_info, dict):
                url = img_info.get("image_url", {}).get("url", "") or img_info.get("url", "")
                if url.startswith("data:image"):
                    b64_data = url.split(",", 1)[1]
                    image_bytes = base64.b64decode(b64_data)
            elif isinstance(img_info, str) and len(img_info) > 100:
                image_bytes = base64.b64decode(img_info)

        # Strategy 2: content array with image_url parts
        if not image_bytes:
            content = msg.get("content", "")
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get("type") == "image_url":
                        url = part.get("image_url", {}).get("url", "")
                        if url.startswith("data:image"):
                            b64_data = url.split(",", 1)[1]
                            image_bytes = base64.b64decode(b64_data)
                            break
                    elif isinstance(part, dict) and part.get("type") == "image":
                        # Some models use "image" type with base64 data
                        b64 = part.get("data", "") or part.get("source", {}).get("data", "")
                        if b64:
                            image_bytes = base64.b64decode(b64)
                            break

        # Strategy 3: inline_data in content (Gemini-style)
        if not image_bytes:
            parts = msg.get("parts", [])
            for part in parts:
                if isinstance(part, dict) and "inline_data" in part:
                    b64 = part["inline_data"].get("data", "")
                    if b64:
                        image_bytes = base64.b64decode(b64)
                        break

        if not image_bytes:
            # Log the response for debugging
            print(f"    [Image] Response structure: {json.dumps({k: type(v).__name__ for k, v in msg.items()})}")
            if isinstance(msg.get("content"), str) and len(msg["content"]) < 500:
                print(f"    [Image] Content: {msg['content'][:300]}")
            raise RuntimeError(f"No image found in response. Keys: {list(msg.keys())}")

        with open(output_path, "wb") as f:
            f.write(image_bytes)

    def _create_placeholder(self, path: str, ad_copy: AdCopy) -> str:
        """Create a placeholder image if generation is unavailable."""
        try:
            from PIL import Image, ImageDraw, ImageFont

            img = Image.new("RGB", (1080, 1080), color=(26, 115, 232))
            draw = ImageDraw.Draw(img)

            # Try platform-specific fonts, fall back to Pillow default
            font_large = None
            font_small = None
            font_paths = [
                "/System/Library/Fonts/Helvetica.ttc",       # macOS
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Debian/Ubuntu
                "/usr/share/fonts/TTF/DejaVuSans.ttf",       # Arch
                "C:\\Windows\\Fonts\\arial.ttf",              # Windows
            ]
            for fp in font_paths:
                try:
                    font_large = ImageFont.truetype(fp, 48)
                    font_small = ImageFont.truetype(fp, 28)
                    break
                except (OSError, IOError):
                    continue
            if font_large is None:
                font_large = ImageFont.load_default()
                font_small = ImageFont.load_default()

            draw.text((100, 400), "Varsity Tutors", fill="white", font=font_large)
            headline = ad_copy.headline[:40]
            draw.text((100, 500), headline, fill="white", font=font_small)
            draw.text((100, 600), "SAT Test Prep", fill=(200, 220, 255), font=font_small)

            img.save(path, "PNG")
        except ImportError:
            with open(path, "wb") as f:
                f.write(b"\x89PNG\r\n\x1a\n")

        return path
