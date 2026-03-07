from enum import StrEnum


class IncidentSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class IncidentStatus(StrEnum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    ACTION_PENDING = "action_pending"
    RESOLVED = "resolved"
    CLOSED = "closed"


class DecisionStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"
    FAILED = "failed"


class AgentMode(StrEnum):
    AUTONOMOUS = "autonomous"
    SUPERVISED = "supervised"
    OBSERVE_ONLY = "observe-only"


class AutonomyTier(int):
    """1=auto, 2=auto+audit, 3=recommend, 4=escalate"""
    pass
