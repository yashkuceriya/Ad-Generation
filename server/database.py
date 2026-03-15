"""PostgreSQL persistence layer for ad results and run history."""

from __future__ import annotations

import os
from datetime import datetime

from sqlalchemy import create_engine, Column, String, Float, Boolean, DateTime, Integer, Text, LargeBinary
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "")

# Railway uses postgres:// but SQLAlchemy 2.x requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


class Base(DeclarativeBase):
    pass


class AdResultRow(Base):
    __tablename__ = "ad_results"

    brief_id = Column(String, primary_key=True)
    data = Column(JSONB, nullable=False)
    weighted_average = Column(Float, default=0.0)
    status = Column(String, default="iterating")
    total_cost_usd = Column(Float, default=0.0)
    early_stopped = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RunHistoryRow(Base):
    __tablename__ = "run_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    total_ads = Column(Integer, default=0)
    avg_score = Column(Float, default=0.0)
    pass_rate = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    elapsed_seconds = Column(Float, default=0.0)
    brief_ids = Column(JSONB, default=list)


class ImageRow(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    brief_id = Column(String, nullable=False, index=True)
    client_id = Column(String, nullable=False, default="default")
    cache_key = Column(String, nullable=False)
    iteration_number = Column(Integer, nullable=False)
    image_data = Column(LargeBinary, nullable=False)
    image_metadata = Column("metadata", JSONB, default=dict)
    best_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class CostLedgerRow(Base):
    __tablename__ = "cost_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_timestamp = Column(DateTime, default=datetime.utcnow)
    model = Column(String)
    step_name = Column(String)
    pipeline_stage = Column(String)
    brief_id = Column(String)
    iteration = Column(Integer, default=0)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    latency_ms = Column(Float, default=0.0)
    cost_usd = Column(Float, default=0.0)


class ParseTelemetryRow(Base):
    __tablename__ = "parse_telemetry"

    id = Column(Integer, primary_key=True, autoincrement=True)
    json_ok = Column(Integer, default=0)
    json_extract = Column(Integer, default=0)
    regex_fallback = Column(Integer, default=0)
    default_fallback = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None and DATABASE_URL:
        _engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5)
    return _engine


def get_session() -> Session | None:
    global _SessionLocal
    engine = get_engine()
    if engine is None:
        return None
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=engine)
    return _SessionLocal()


def init_db() -> bool:
    """Create tables if they don't exist. Returns True if DB is available."""
    engine = get_engine()
    if engine is None:
        return False
    Base.metadata.create_all(engine)
    return True


def db_available() -> bool:
    return bool(DATABASE_URL)


def save_image_to_db(
    brief_id: str,
    client_id: str,
    cache_key: str,
    iteration_number: int,
    image_bytes: bytes,
    image_metadata: dict | None = None,
    best_index: int = 0,
) -> bool:
    """Save an image to the database. Returns True on success."""
    session = get_session()
    if not session:
        return False
    try:
        row = ImageRow(
            brief_id=brief_id,
            client_id=client_id,
            cache_key=cache_key,
            iteration_number=iteration_number,
            image_data=image_bytes,
            image_metadata=image_metadata or {},
            best_index=best_index,
        )
        session.add(row)
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        print(f"  DB image save error: {e}")
        return False
    finally:
        session.close()


def get_image_from_db(brief_id: str, client_id: str, iteration: int = -1) -> bytes | None:
    """Retrieve an image from DB. If iteration=-1, returns best image."""
    session = get_session()
    if not session:
        return None
    try:
        query = session.query(ImageRow).filter_by(brief_id=brief_id, client_id=client_id)
        if iteration >= 0:
            row = query.filter_by(iteration_number=iteration).first()
        else:
            # Get the best image (any row has best_index)
            first = query.first()
            if first:
                row = query.filter_by(iteration_number=first.best_index).first()
            else:
                row = None
        return row.image_data if row else None
    except Exception as e:
        print(f"  DB image load error: {e}")
        return None
    finally:
        session.close()


def get_best_images_batch(client_id: str = "default") -> dict[str, dict]:
    """Get best image metadata for ALL briefs in one query. Returns {brief_id: {iteration_number, metadata}}."""
    session = get_session()
    if not session:
        return {}
    try:
        # Only select metadata columns, NOT image_data (which is huge)
        rows = (
            session.query(
                ImageRow.brief_id,
                ImageRow.iteration_number,
                ImageRow.image_metadata,
                ImageRow.best_index,
            )
            .filter_by(client_id=client_id)
            .order_by(ImageRow.brief_id, ImageRow.iteration_number)
            .all()
        )
        # Group by brief_id, pick the best iteration
        result: dict[str, dict] = {}
        by_brief: dict[str, list] = {}
        for r in rows:
            by_brief.setdefault(r.brief_id, []).append(r)

        for brief_id, brief_rows in by_brief.items():
            best_idx = brief_rows[0].best_index  # 0-based
            target_iter = best_idx + 1  # iteration_number is 1-based
            chosen = None
            for r in brief_rows:
                if r.iteration_number == target_iter:
                    chosen = r
                    break
            if not chosen:
                chosen = brief_rows[0]

            result[brief_id] = {
                "iteration_number": chosen.iteration_number,
                "metadata": chosen.image_metadata,
                "best_index": chosen.best_index,
            }
        return result
    except Exception as e:
        print(f"  DB batch image query error: {e}")
        return {}
    finally:
        session.close()


def get_all_images_for_brief(brief_id: str, client_id: str) -> list[dict]:
    """Get all image iterations for a brief from DB."""
    session = get_session()
    if not session:
        return []
    try:
        rows = (
            session.query(ImageRow)
            .filter_by(brief_id=brief_id, client_id=client_id)
            .order_by(ImageRow.iteration_number)
            .all()
        )
        return [
            {
                "iteration_number": r.iteration_number,
                "metadata": r.image_metadata,
                "best_index": r.best_index,
                "has_data": True,
            }
            for r in rows
        ]
    except Exception as e:
        print(f"  DB image query error: {e}")
        return []
    finally:
        session.close()


def save_cost_ledger_to_db(entries: list[dict]) -> bool:
    """Bulk-save cost ledger entries to DB. Returns True on success."""
    session = get_session()
    if not session:
        return False
    try:
        for e in entries:
            row = CostLedgerRow(
                model=e.get("model", ""),
                step_name=e.get("step_name", ""),
                pipeline_stage=e.get("pipeline_stage", ""),
                brief_id=e.get("brief_id", ""),
                iteration=e.get("iteration", 0),
                input_tokens=e.get("input_tokens", 0),
                output_tokens=e.get("output_tokens", 0),
                latency_ms=e.get("latency_ms", 0.0),
                cost_usd=e.get("cost_usd", 0.0),
            )
            session.add(row)
        session.commit()
        print(f"  DB: saved {len(entries)} cost ledger entries")
        return True
    except Exception as e:
        session.rollback()
        print(f"  DB cost ledger save error: {e}")
        return False
    finally:
        session.close()


def load_cost_ledger_from_db() -> list[dict]:
    """Load all cost ledger entries from DB."""
    session = get_session()
    if not session:
        return []
    try:
        rows = session.query(CostLedgerRow).order_by(CostLedgerRow.id).all()
        return [
            {
                "model": r.model,
                "step_name": r.step_name,
                "pipeline_stage": r.pipeline_stage,
                "brief_id": r.brief_id,
                "iteration": r.iteration,
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
                "latency_ms": r.latency_ms,
                "cost_usd": r.cost_usd,
            }
            for r in rows
        ]
    except Exception as e:
        print(f"  DB cost ledger load error: {e}")
        return []
    finally:
        session.close()


def save_parse_telemetry_to_db(ok: int, extract: int, regex: int, default: int) -> bool:
    """Save parse telemetry counters to DB."""
    session = get_session()
    if not session:
        return False
    try:
        row = session.query(ParseTelemetryRow).first()
        if row:
            row.json_ok = ok
            row.json_extract = extract
            row.regex_fallback = regex
            row.default_fallback = default
        else:
            row = ParseTelemetryRow(
                json_ok=ok, json_extract=extract,
                regex_fallback=regex, default_fallback=default,
            )
            session.add(row)
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        print(f"  DB parse telemetry save error: {e}")
        return False
    finally:
        session.close()


def load_parse_telemetry_from_db() -> dict | None:
    """Load parse telemetry from DB."""
    session = get_session()
    if not session:
        return None
    try:
        row = session.query(ParseTelemetryRow).first()
        if not row:
            return None
        return {
            "json_ok": row.json_ok,
            "json_extract": row.json_extract,
            "regex_fallback": row.regex_fallback,
            "default_fallback": row.default_fallback,
        }
    except Exception as e:
        print(f"  DB parse telemetry load error: {e}")
        return None
    finally:
        session.close()
