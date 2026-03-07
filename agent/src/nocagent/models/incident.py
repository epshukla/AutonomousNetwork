from datetime import datetime

from sqlalchemy import String, Integer, DateTime, Text, Float
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from nocagent.models.base import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="open")
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()"
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    affected_devices: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    affected_links: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    root_cause_hypothesis: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_root_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_customer_impact: Mapped[int | None] = mapped_column(Integer, nullable=True)
    claude_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
