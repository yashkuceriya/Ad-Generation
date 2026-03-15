"""Ad results endpoints with user-scoped image caching."""

from __future__ import annotations

import hashlib
import json
import os
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from server.state import RunStore
from server.sse import SSEBroadcaster
from src.iterate.image_iterator import ImageIterator
from src.iterate.best_selector import BestSelector
from src.models import AdStatus
from src.tracking.cost_tracker import PipelineMetrics
from config.settings import IMAGES_DIR

router = APIRouter()

_generating: set[str] = set()
_gen_lock = threading.Lock()


class GenerateImageRequest(BaseModel):
    client_id: str = "default"
    force_regenerate: bool = False


class RefineRequest(BaseModel):
    instruction: str
    client_id: str = "default"


class ApproveRequest(BaseModel):
    approved_by: str
    notes: str = ""


class RejectRequest(BaseModel):
    rejected_by: str
    reason: str


def _user_cache_dir(client_id: str, brief_id: str) -> str:
    safe_client = client_id.replace("/", "_").replace("..", "_")[:64]
    path = os.path.join(IMAGES_DIR, "users", safe_client, brief_id)
    os.makedirs(path, exist_ok=True)
    return path


def _prompt_hash(prompt: str) -> str:
    return hashlib.sha256(prompt.encode()).hexdigest()[:12]


def _cache_manifest_path(cache_dir: str) -> str:
    return os.path.join(cache_dir, "cache_manifest.json")


def _load_cache_manifest(cache_dir: str) -> dict:
    path = _cache_manifest_path(cache_dir)
    if os.path.exists(path):
        try:
            with open(path) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_cache_manifest(cache_dir: str, manifest: dict) -> None:
    path = _cache_manifest_path(cache_dir)
    with open(path, "w") as f:
        json.dump(manifest, f, indent=2, default=str)


def _gen_key(client_id: str, brief_id: str) -> str:
    return f"{client_id}::{brief_id}"


@router.get("")
def list_ads(
    sort_by: str = Query("score", enum=["score", "cost", "brief_id"]),
    min_score: float = Query(0.0),
    audience: str | None = Query(None),
    client_id: str | None = Query(None),
):
    store = RunStore()
    results = store.get_all_results()

    # Exclude in-progress ads that have no iterations yet (avoids IndexError on best_copy)
    results = [r for r in results if r.copy_iterations]

    if audience:
        results = [r for r in results if r.brief.audience_segment.value == audience]

    if min_score > 0:
        results = [r for r in results if r.best_copy.evaluation.weighted_average >= min_score]

    if sort_by == "score":
        results.sort(key=lambda r: r.best_copy.evaluation.weighted_average, reverse=True)
    elif sort_by == "cost":
        results.sort(key=lambda r: r.total_cost_usd)
    else:
        results.sort(key=lambda r: r.brief_id)

    return [_serialize_result(r, client_id=client_id) for r in results]


@router.get("/{brief_id}")
def get_ad(brief_id: str, client_id: str | None = Query(None)):
    store = RunStore()
    result = store.get_result(brief_id)
    if not result:
        raise HTTPException(404, f"Ad {brief_id} not found")
    return _serialize_result(result, client_id=client_id)


@router.post("/{brief_id}/generate-image")
def generate_image(brief_id: str, req: GenerateImageRequest | None = None):
    if req is None:
        req = GenerateImageRequest()

    store = RunStore()
    result = store.get_result(brief_id)
    if not result:
        raise HTTPException(404, f"Ad {brief_id} not found")

    gen_key = _gen_key(req.client_id, brief_id)

    with _gen_lock:
        if gen_key in _generating:
            return {"status": "in_progress", "brief_id": brief_id}
        _generating.add(gen_key)

    client_id = req.client_id
    force = req.force_regenerate

    def _generate():
        broadcaster = SSEBroadcaster()
        try:
            cache_dir = _user_cache_dir(client_id, brief_id)
            manifest = _load_cache_manifest(cache_dir)

            best_copy = result.best_copy.ad_copy
            cache_key = _prompt_hash(
                f"{best_copy.headline}|{best_copy.primary_text[:100]}|"
                f"{result.brief.audience_segment.value}|{result.brief.campaign_goal.value}"
            )

            cached_entry = manifest.get(cache_key)
            if cached_entry and not force:
                cached_files = cached_entry.get("image_files", [])
                if cached_files and all(os.path.exists(f) for f in cached_files):
                    PipelineMetrics().record_image_cache(hit=True)
                    print(f"  [Image] Cache hit for {brief_id} (client={client_id[:16]}..., key={cache_key})")

                    from src.models import ImageIteration as ImgIterModel
                    cached_iterations = []
                    for ci in cached_entry.get("iterations", []):
                        cached_iterations.append(ImgIterModel.model_validate(ci))

                    if cached_iterations:
                        selector = BestSelector()
                        best_idx = selector.select_best_image(cached_iterations)

                        broadcaster.broadcast_sync("image_generated", {
                            "brief_id": brief_id,
                            "best_image_index": best_idx,
                            "iterations": [it.model_dump() for it in cached_iterations],
                            "score": cached_iterations[best_idx].evaluation.average_score,
                            "cache_hit": True,
                            "cache_key": cache_key,
                            "client_id": client_id,
                        })
                        with _gen_lock:
                            _generating.discard(gen_key)
                        return

            iterator = ImageIterator()
            selector = BestSelector()

            def on_iter(img_iter):
                broadcaster.broadcast_sync("image_iteration_complete", {
                    "brief_id": brief_id,
                    "iteration": img_iter.iteration_number,
                    "score": img_iter.evaluation.average_score,
                    "brand_consistency": img_iter.evaluation.brand_consistency,
                    "engagement_potential": img_iter.evaluation.engagement_potential,
                    "text_image_alignment": img_iter.evaluation.text_image_alignment,
                    "rationale": (img_iter.evaluation.rationale or "")[:150],
                    "client_id": client_id,
                })

            PipelineMetrics().record_image_cache(hit=False, force=force)
            image_iterations = iterator.iterate(
                ad_copy=best_copy,
                brief=result.brief,
                on_iteration=on_iter,
            )
            best_idx = selector.select_best_image(image_iterations)

            manifest[cache_key] = {
                "image_files": [it.image_path for it in image_iterations],
                "iterations": [it.model_dump() for it in image_iterations],
                "best_image_index": best_idx,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "client_id": client_id,
                "brief_id": brief_id,
            }
            _save_cache_manifest(cache_dir, manifest)

            broadcaster.broadcast_sync("image_generated", {
                "brief_id": brief_id,
                "best_image_index": best_idx,
                "iterations": [it.model_dump() for it in image_iterations],
                "score": image_iterations[best_idx].evaluation.average_score if image_iterations else 0,
                "cache_hit": False,
                "cache_key": cache_key,
                "client_id": client_id,
            })
            with _gen_lock:
                _generating.discard(gen_key)
        except Exception as e:
            print(f"  [Image] Generation thread failed for {brief_id}: {e}")
            import traceback
            traceback.print_exc()
            broadcaster.broadcast_sync("image_error", {
                "brief_id": brief_id,
                "error": str(e),
                "client_id": client_id,
            })
            with _gen_lock:
                _generating.discard(gen_key)

    thread = threading.Thread(target=_generate, daemon=True)
    thread.start()

    return {"status": "generating", "brief_id": brief_id, "client_id": req.client_id}


@router.post("/{brief_id}/refine")
def refine_ad(brief_id: str, req: RefineRequest):
    """Human-in-the-loop: apply a manual refinement instruction to an ad."""
    store = RunStore()
    result = store.get_result(brief_id)
    if not result:
        raise HTTPException(404, f"Ad {brief_id} not found")

    if not req.instruction or not req.instruction.strip():
        raise HTTPException(400, "Refinement instruction cannot be empty")

    def _refine():
        broadcaster = SSEBroadcaster()
        try:
            from src.generate.copy_generator import CopyGenerator
            from src.evaluate.copy_evaluator import CopyEvaluator
            from src.iterate.best_selector import BestSelector as CopyBestSelector
            from src.models import CopyIteration

            generator = CopyGenerator()
            evaluator = CopyEvaluator()

            best_copy = result.best_copy
            current_copy = best_copy.ad_copy
            evaluation = best_copy.evaluation

            manual_feedback = (
                f"HUMAN INSTRUCTION (highest priority): {req.instruction}\n\n"
                + generator.build_refinement_prompt(current_copy, evaluation)
            )

            next_iter_num = len(result.copy_iterations) + 1

            ad_copy, gen_costs = generator.generate(
                brief=result.brief,
                iteration=next_iter_num,
                feedback=manual_feedback,
                previous_copy=current_copy,
            )

            new_eval, eval_costs = evaluator.evaluate(
                ad_copy=ad_copy, brief=result.brief, iteration=next_iter_num,
            )

            new_iteration = CopyIteration(
                iteration_number=next_iter_num,
                ad_copy=ad_copy,
                evaluation=new_eval,
                refinement_feedback=f"[Human] {req.instruction}",
                costs=gen_costs + eval_costs,
            )

            result.copy_iterations.append(new_iteration)

            selector = CopyBestSelector()
            result.best_copy_index = selector.select_best_copy(result.copy_iterations)
            result.compute_totals()
            store.update_result(result)

            broadcaster.broadcast_sync("copy_iteration_complete", {
                "brief_id": brief_id,
                "iteration": next_iter_num,
                "score": new_eval.weighted_average,
                "weakest_dimension": new_eval.weakest_dimension,
                "headline": ad_copy.headline,
                "human_steered": True,
            })
        except Exception as e:
            print(f"  [Refine] Failed for {brief_id}: {e}")
            import traceback
            traceback.print_exc()
            broadcaster.broadcast_sync("pipeline_error", {
                "brief_id": brief_id,
                "error": f"Refinement failed: {str(e)}",
            })

    thread = threading.Thread(target=_refine, daemon=True)
    thread.start()
    return {"status": "refining", "brief_id": brief_id}


@router.post("/{brief_id}/compliance")
def check_compliance(brief_id: str):
    """Run compliance check on an ad's best copy."""
    store = RunStore()
    result = store.get_result(brief_id)
    if not result:
        raise HTTPException(404, f"Ad {brief_id} not found")
    if not result.copy_iterations:
        raise HTTPException(400, "Ad has no copy iterations yet")

    from src.evaluate.compliance_checker import ComplianceChecker
    from src.models import ComplianceResult as ComplianceResultModel
    from src.models import ComplianceViolation as ComplianceViolationModel

    checker = ComplianceChecker()
    best_copy = result.best_copy.ad_copy
    compliance = checker.check(best_copy)

    result.compliance = ComplianceResultModel(
        passes=compliance.passes,
        violations=[
            ComplianceViolationModel(
                severity=v.severity, field=v.field, rule=v.rule,
                message=v.message, suggestion=v.suggestion,
            )
            for v in compliance.violations
        ],
        score=compliance.score,
    )
    store.update_result(result)

    return result.compliance.model_dump()


@router.post("/{brief_id}/variants")
def generate_variants(brief_id: str):
    """Generate A/B test variants for an ad's best copy."""
    store = RunStore()
    result = store.get_result(brief_id)
    if not result:
        raise HTTPException(404, f"Ad {brief_id} not found")
    if not result.copy_iterations:
        raise HTTPException(400, "Ad has no copy iterations yet")

    def _generate():
        broadcaster = SSEBroadcaster()
        try:
            from src.generate.variant_generator import VariantGenerator
            from src.models import ABVariant

            generator = VariantGenerator()
            best_copy = result.best_copy.ad_copy

            raw_variants = generator.generate_variants(
                ad_copy=best_copy,
                brief=result.brief,
            )

            result.variants = [
                ABVariant(
                    variant_type=v["variant_type"],
                    variant_hypothesis=v["variant_hypothesis"],
                    ad_copy=v["ad_copy"],
                    costs=v["costs"],
                )
                for v in raw_variants
            ]
            result.compute_totals()
            store.update_result(result)

            broadcaster.broadcast_sync("variants_generated", {
                "brief_id": brief_id,
                "count": len(result.variants),
                "types": [v.variant_type for v in result.variants],
            })
        except Exception as e:
            print(f"  [Variants] Failed for {brief_id}: {e}")
            import traceback
            traceback.print_exc()
            broadcaster.broadcast_sync("pipeline_error", {
                "brief_id": brief_id,
                "error": f"Variant generation failed: {str(e)}",
            })

    thread = threading.Thread(target=_generate, daemon=True)
    thread.start()
    return {"status": "generating_variants", "brief_id": brief_id}


@router.post("/{brief_id}/diversity")
def check_diversity(brief_id: str):
    """Run diversity check on an ad's copy against all other ads in the batch."""
    store = RunStore()
    result = store.get_result(brief_id)
    if not result:
        raise HTTPException(404, f"Ad {brief_id} not found")
    if not result.copy_iterations:
        raise HTTPException(400, "Ad has no copy iterations yet")

    from src.evaluate.diversity_checker import DiversityChecker
    from src.models import DiversityResult as DiversityResultModel
    from src.models import DiversityIssue as DiversityIssueModel

    checker = DiversityChecker()
    best_copy = result.best_copy.ad_copy

    all_results = store.get_all_results()
    existing = [
        (r.brief_id, r.copy_iterations[r.best_copy_index].ad_copy)
        for r in all_results
        if r.brief_id != brief_id and r.copy_iterations
    ]

    diversity = checker.check(best_copy, brief_id, existing)

    result.diversity = DiversityResultModel(
        is_diverse=diversity.is_diverse,
        issues=[
            DiversityIssueModel(
                severity=issue.severity, field=issue.field, rule=issue.rule,
                message=issue.message, similar_to=issue.similar_to,
                similarity=issue.similarity,
            )
            for issue in diversity.issues
        ],
        diversity_score=diversity.diversity_score,
        most_similar_id=diversity.most_similar_id,
        most_similar_score=diversity.most_similar_score,
    )
    store.update_result(result)

    return result.diversity.model_dump()


@router.post("/{brief_id}/approve")
def approve_ad(brief_id: str, req: ApproveRequest):
    """Mark an ad as human-approved."""
    store = RunStore()
    result = store.get_result(brief_id)
    if not result:
        raise HTTPException(404, f"Ad {brief_id} not found")

    if result.status == AdStatus.REJECTED.value:
        raise HTTPException(400, "Cannot approve a rejected ad. Re-run the pipeline first.")

    result.status = AdStatus.HUMAN_APPROVED.value
    result.approved_by = req.approved_by
    result.approved_at = datetime.now(timezone.utc).isoformat()
    result.approval_notes = req.notes or None
    store.update_result(result)

    broadcaster = SSEBroadcaster()
    broadcaster.broadcast_sync("ad_approved", {
        "brief_id": brief_id,
        "approved_by": req.approved_by,
        "status": result.status,
    })
    return {"status": result.status, "brief_id": brief_id, "approved_by": req.approved_by}


@router.post("/{brief_id}/reject")
def reject_ad(brief_id: str, req: RejectRequest):
    """Explicitly reject an ad."""
    store = RunStore()
    result = store.get_result(brief_id)
    if not result:
        raise HTTPException(404, f"Ad {brief_id} not found")

    if result.status == AdStatus.EXPERIMENT_READY.value:
        raise HTTPException(400, "Cannot reject an experiment-ready ad.")

    result.status = AdStatus.REJECTED.value
    result.rejection_reason = req.reason
    store.update_result(result)

    broadcaster = SSEBroadcaster()
    broadcaster.broadcast_sync("ad_rejected", {
        "brief_id": brief_id,
        "rejected_by": req.rejected_by,
        "reason": req.reason,
        "status": result.status,
    })
    return {"status": result.status, "brief_id": brief_id, "reason": req.reason}


@router.post("/{brief_id}/mark-experiment-ready")
def mark_experiment_ready(brief_id: str):
    """Mark a human-approved ad as experiment-ready."""
    store = RunStore()
    result = store.get_result(brief_id)
    if not result:
        raise HTTPException(404, f"Ad {brief_id} not found")

    if result.status != AdStatus.HUMAN_APPROVED.value:
        raise HTTPException(
            400,
            f"Ad must be human_approved to mark experiment-ready. Current status: {result.status}",
        )

    result.status = AdStatus.EXPERIMENT_READY.value
    store.update_result(result)

    broadcaster = SSEBroadcaster()
    broadcaster.broadcast_sync("ad_experiment_ready", {
        "brief_id": brief_id,
        "status": result.status,
    })
    return {"status": result.status, "brief_id": brief_id}


@router.get("/{brief_id}/image/{filename:path}")
def serve_image(brief_id: str, filename: str):
    """Serve image files from IMAGES_DIR, supporting nested user-cache paths."""
    path = os.path.realpath(os.path.join(IMAGES_DIR, filename))
    if not path.startswith(os.path.realpath(IMAGES_DIR)):
        raise HTTPException(403, "Invalid path")
    if not os.path.exists(path):
        raise HTTPException(404, "Image not found")
    return FileResponse(path, media_type="image/png")


def _resolve_user_images(
    brief_id: str, client_id: str, *, prompt_hash: str | None = None,
) -> tuple[list[dict], int]:
    """Load image iterations from user-scoped cache.

    If *prompt_hash* is provided, returns the entry matching that specific copy
    variant. Falls back to the most-recent entry when no hash match is found.
    Returns (iterations, best_index).
    """
    cache_dir = os.path.join(IMAGES_DIR, "users",
                             client_id.replace("/", "_").replace("..", "_")[:64],
                             brief_id)
    manifest = _load_cache_manifest(cache_dir)
    if not manifest:
        return [], 0

    entry = None
    if prompt_hash and prompt_hash in manifest:
        entry = manifest[prompt_hash]
    else:
        entry = max(manifest.values(), key=lambda e: e.get("generated_at", ""))

    iterations = entry.get("iterations", [])
    best_idx = entry.get("best_image_index", 0)
    return iterations, best_idx


def _add_image_urls(data: dict, brief_id: str) -> None:
    """Add image_url fields to serialized image_iterations using IMAGES_DIR-relative paths."""
    images_real = os.path.realpath(IMAGES_DIR)
    for img_iter in data.get("image_iterations", []):
        raw_path = img_iter.get("image_path") or ""
        if not raw_path:
            continue
        real = os.path.realpath(raw_path)
        if real.startswith(images_real):
            rel = os.path.relpath(real, images_real)
            img_iter["image_url"] = f"/api/ads/{brief_id}/image/{rel}"
        else:
            filename = os.path.basename(raw_path)
            if filename:
                img_iter["image_url"] = f"/api/ads/{brief_id}/image/{filename}"


def _serialize_result(result, *, client_id: str | None = None) -> dict:
    """Serialize AdResult to dict, resolving user-scoped images when client_id is present."""
    data = result.model_dump()

    # Guard: can't resolve user images if no copy iterations yet
    if not result.copy_iterations:
        return data

    if client_id:
        best_copy = result.best_copy.ad_copy
        copy_hash = _prompt_hash(
            f"{best_copy.headline}|{best_copy.primary_text[:100]}|"
            f"{result.brief.audience_segment.value}|{result.brief.campaign_goal.value}"
        )
        user_iters, best_idx = _resolve_user_images(
            result.brief_id, client_id, prompt_hash=copy_hash,
        )
        if user_iters:
            data["image_iterations"] = user_iters
            data["best_image_index"] = best_idx

    _add_image_urls(data, result.brief_id)
    return data
