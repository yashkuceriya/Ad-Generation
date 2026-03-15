"""PostgreSQL persistence layer for ad results and run history."""

from __future__ import annotations

import os
from datetime import datetime

from sqlalchemy import create_engine, Column, String, Float, Boolean, DateTime, Integer, Text
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
