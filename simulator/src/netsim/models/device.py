from datetime import datetime

from sqlalchemy import String, Float, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from netsim.models.base import Base


class DeviceMetric(Base):
    __tablename__ = "device_metrics"

    time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True
    )
    device_id: Mapped[str] = mapped_column(String, primary_key=True)
    cpu_utilization: Mapped[float] = mapped_column(Float, nullable=True)
    memory_utilization: Mapped[float] = mapped_column(Float, nullable=True)
    temperature_celsius: Mapped[float] = mapped_column(Float, nullable=True)
    uptime_seconds: Mapped[int] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=True)
