from pydantic_settings import BaseSettings


class AgentSettings(BaseSettings):
    model_config = {"env_prefix": "", "case_sensitive": False}

    # Server
    agent_host: str = "0.0.0.0"
    agent_port: int = 8001

    # Database
    database_url: str = "postgresql+asyncpg://netops:netops@localhost:5432/netops"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Simulator
    simulator_url: str = "http://localhost:8000"

    # Claude
    claude_api_key: str = ""
    claude_model: str = "claude-sonnet-4-20250514"

    # Agent behavior
    agent_mode: str = "autonomous"  # autonomous | supervised | observe-only
    observe_interval_seconds: int = 30

    # Logging
    log_level: str = "INFO"


settings = AgentSettings()
