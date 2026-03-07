from pydantic_settings import BaseSettings


class SimulatorSettings(BaseSettings):
    model_config = {"env_prefix": "", "case_sensitive": False}

    # Server
    simulator_host: str = "0.0.0.0"
    simulator_port: int = 8000

    # Database
    database_url: str = "postgresql+asyncpg://netops:netops@localhost:5432/netops"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Telemetry
    telemetry_interval_seconds: int = 5

    # Logging
    log_level: str = "INFO"


settings = SimulatorSettings()
