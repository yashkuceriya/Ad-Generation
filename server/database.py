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
        from sqlalchemy import func
        # Get one row per brief_id where iteration_number == best_index
        subq = (
            session.query(
                ImageRow.brief_id,
                func.min(ImageRow.best_index).label("best_idx"),
            )
            .filter_by(client_id=client_id)
            .group_by(ImageRow.brief_id)
            .subquery()
        )
        rows = (
            session.query(ImageRow)
            .join(subq, (ImageRow.brief_id == subq.c.brief_id) & (ImageRow.iteration_number == subq.c.best_idx))
            .filter(ImageRow.client_id == client_id)
            .all()
        )
        return {
            r.brief_id: {
                "iteration_number": r.iteration_number,
                "metadata": r.image_metadata,
                "best_index": r.best_index,
            }
            for r in rows
        }
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
