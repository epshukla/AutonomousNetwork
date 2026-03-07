"""Claude tool-use tool definitions for the NOC Agent."""

AGENT_TOOLS = [
    {
        "name": "query_device_metrics",
        "description": "Query metrics for a network device. Returns CPU, memory, temperature, status over a time range.",
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {"type": "string", "description": "Device identifier, e.g. 'core-delhi-1'"},
                "time_range_minutes": {"type": "integer", "default": 30, "description": "How far back to query"},
            },
            "required": ["device_id"],
        },
    },
    {
        "name": "query_link_metrics",
        "description": "Query metrics for a network link. Returns utilization, latency, packet loss, throughput over a time range.",
        "input_schema": {
            "type": "object",
            "properties": {
                "link_id": {"type": "string", "description": "Link identifier, e.g. 'link-del-mum-primary'"},
                "time_range_minutes": {"type": "integer", "default": 30},
            },
            "required": ["link_id"],
        },
    },
    {
        "name": "get_network_topology",
        "description": "Get current network topology: all devices, links, and their status. Use to understand network structure.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "check_bgp_sessions",
        "description": "Check BGP peering sessions. Returns state, uptime, prefix counts, flap history.",
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {"type": "string", "description": "Optional: filter by device"},
            },
        },
    },
    {
        "name": "get_affected_customers",
        "description": "Estimate customers affected by an issue on a device or link.",
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {"type": "string"},
                "severity": {"type": "string", "enum": ["partial", "full"]},
            },
            "required": ["device_id", "severity"],
        },
    },
    {
        "name": "execute_reroute",
        "description": "Reroute traffic from one path to another. TIER 3: needs approval for inter-city reroutes.",
        "input_schema": {
            "type": "object",
            "properties": {
                "from_link": {"type": "string"},
                "to_link": {"type": "string"},
                "reason": {"type": "string"},
            },
            "required": ["from_link", "to_link", "reason"],
        },
    },
    {
        "name": "apply_rate_limit",
        "description": "Rate-limit a link or device to contain traffic floods. TIER 2: auto-approved with audit trail.",
        "input_schema": {
            "type": "object",
            "properties": {
                "target": {"type": "string", "description": "Device or link ID"},
                "limit_mbps": {"type": "number"},
                "duration_minutes": {"type": "integer"},
                "reason": {"type": "string"},
            },
            "required": ["target", "limit_mbps", "reason"],
        },
    },
    {
        "name": "restart_device",
        "description": "Restart a network device. TIER 4: always needs human approval.",
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {"type": "string"},
                "reason": {"type": "string"},
                "graceful": {"type": "boolean", "default": True},
            },
            "required": ["device_id", "reason"],
        },
    },
    {
        "name": "create_incident",
        "description": "Create a formal incident record for a significant network event.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "severity": {"type": "string", "enum": ["info", "warning", "critical", "emergency"]},
                "affected_devices": {"type": "array", "items": {"type": "string"}},
                "affected_links": {"type": "array", "items": {"type": "string"}},
                "root_cause_hypothesis": {"type": "string"},
                "recommended_actions": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["title", "severity", "root_cause_hypothesis"],
        },
    },
    {
        "name": "escalate_to_engineer",
        "description": "Escalate to human engineer with full context. TIER 4: use for high-risk situations.",
        "input_schema": {
            "type": "object",
            "properties": {
                "urgency": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                "context": {"type": "string"},
                "recommended_action": {"type": "string"},
            },
            "required": ["urgency", "context"],
        },
    },
    {
        "name": "query_past_incidents",
        "description": "Search past incidents for similar patterns to learn from history.",
        "input_schema": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string"},
                "device_id": {"type": "string"},
                "time_range_hours": {"type": "integer", "default": 24},
            },
            "required": ["keyword"],
        },
    },
]
