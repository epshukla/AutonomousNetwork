from datetime import datetime

from sqlalchemy import String, Float, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from netsim.models.base import Base


class LinkMetric(Base):
    __tablename__ = "link_metrics"

    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True
    )
    link_id: Mapped[str] = mapped_column(String, primary_key=True)
    utilization_percent: Mapped[float] = mapped_column(Float, nullable=True)
    throughput_gbps: Mapped[float] = mapped_column(Float, nullable=True)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=True)
    packet_loss_percent: Mapped[float] = mapped_column(Float, nullable=True)
    errors_in: Mapped[int] = mapped_column(Integer, nullable=True)
    errors_out: Mapped[int] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=True)


class BgpMetric(Base):
    __tablename__ = "bgp_metrics"

    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True
    )
    device_id: Mapped[str] = mapped_column(String, primary_key=True)
    peer_as: Mapped[int] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=True)
    prefixes_received: Mapped[int] = mapped_column(Integer, nullable=True)
    flap_count: Mapped[int] = mapped_column(Integer, nullable=True)
