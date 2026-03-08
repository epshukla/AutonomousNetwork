"""
Indian Regulatory Compliance API — TRAI, DoT, CERT-In, DPDPA 2023.

All data is computed dynamically from in-memory network state and chaos engine.
No new database tables. Subscriber logs use seeded random for stable-looking data.
"""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from netsim.core.network_state import network_state
from netsim.chaos.engine import chaos_engine

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])

IST = timezone(timedelta(hours=5, minutes=30))

# ── Helpers ──────────────────────────────────────────────

INDIAN_IP_PREFIXES = ["103", "49", "14", "223"]
PROTOCOLS = ["PPPoE", "IPoE", "DHCP"]
OLT_DEVICES = [
    "olt-delhi-north-1",
    "olt-delhi-south-1",
    "olt-mumbai-central-1",
    "olt-mumbai-harbor-1",
]
MAC_VENDORS = ["AA:BB:CC", "00:1A:2B", "D4:6A:91", "F8:32:E4", "3C:22:FB"]

CONFIG_ACTIONS = [
    ("BGP policy updated", "config_change", "noc-admin"),
    ("ACL rule modified on core-delhi-1", "config_change", "noc-admin"),
    ("SNMP community string rotated", "config_change", "security-ops"),
    ("Interface description updated on agg-mumbai-1", "config_change", "noc-admin"),
    ("OSPF area 0 cost adjusted", "config_change", "noc-admin"),
    ("Firewall rule added — block port 445", "config_change", "security-ops"),
    ("QoS policy applied to edge-delhi-north", "config_change", "noc-admin"),
    ("Syslog server endpoint changed", "config_change", "noc-admin"),
    ("NTP source updated to ntp.npl.org.in", "config_change", "noc-admin"),
    ("RADIUS shared secret rotated", "config_change", "security-ops"),
    ("VLAN 100 created for enterprise tenant", "config_change", "noc-admin"),
    ("MPLS LDP session configured", "config_change", "noc-admin"),
]

ACCESS_ACTIONS = [
    ("admin@10.0.0.1 login via SSH", "access", "admin"),
    ("noc-viewer@10.0.0.2 login via HTTPS", "access", "noc-viewer"),
    ("security-ops@10.0.0.5 login via SSH", "access", "security-ops"),
    ("api-service@10.0.0.10 token refresh", "access", "api-service"),
    ("admin@10.0.0.1 logout", "access", "admin"),
    ("backup-svc@10.0.0.20 config export", "access", "backup-svc"),
    ("noc-viewer@10.0.0.2 viewed topology", "access", "noc-viewer"),
    ("admin@10.0.0.1 executed restart on edge-delhi-south", "access", "admin"),
]

SOURCE_IPS = ["10.0.0.1", "10.0.0.2", "10.0.0.5", "10.0.0.10", "10.0.0.20"]


def _get_active_scenario_names() -> set[str]:
    return {s["scenario"] for s in chaos_engine.get_active()}


def _seed_for_hour() -> int:
    """Deterministic seed based on current hour so logs look stable."""
    now = datetime.now(IST)
    h = f"{now.year}-{now.month}-{now.day}-{now.hour}"
    return int(hashlib.md5(h.encode()).hexdigest()[:8], 16)


# ── Endpoint 1: Compliance Status ────────────────────────

@router.get("/status")
async def compliance_status():
    active = _get_active_scenario_names()
    any_chaos = len(active) > 0

    def _check(name: str, default_status: str, default_detail: str,
               chaos_trigger: set[str] | None = None,
               chaos_status: str = "warning",
               chaos_detail: str = "") -> dict:
        if chaos_trigger and chaos_trigger & active:
            return {"name": name, "status": chaos_status, "detail": chaos_detail}
        return {"name": name, "status": default_status, "detail": default_detail}

    now = datetime.now(IST)
    last_audit = (now - timedelta(days=45)).strftime("%Y-%m-%d")
    next_audit = (now + timedelta(days=45)).strftime("%Y-%m-%d")

    bodies = [
        {
            "name": "TRAI License Conditions",
            "status": "violation" if {"fiber_cut", "device_failure"} & active else "compliant",
            "last_audit": last_audit,
            "next_audit": next_audit,
            "checks": [
                _check(
                    "Network Uptime SLA (99.95%)", "compliant",
                    "Current uptime exceeds TRAI mandate",
                    {"fiber_cut", "device_failure"}, "violation",
                    "Uptime dropped below 99.95% — active outage detected",
                ),
                _check(
                    "QoS Parameters", "compliant",
                    "Latency, jitter, packet loss within limits",
                    {"congestion_cascade"}, "warning",
                    "QoS degradation detected on congested links",
                ),
                _check(
                    "Subscriber Grievance Redressal", "compliant",
                    "All complaints resolved within 7 days",
                ),
                _check(
                    "Tariff Transparency", "compliant",
                    "Published tariffs match billing system",
                ),
            ],
        },
        {
            "name": "DoT Unified License / VNO",
            "status": "violation" if {"bgp_route_leak"} & active else "compliant",
            "last_audit": last_audit,
            "next_audit": (now + timedelta(days=90)).strftime("%Y-%m-%d"),
            "checks": [
                _check(
                    "Lawful Intercept Capability", "compliant",
                    "LI system operational and tested",
                ),
                _check(
                    "Routing Integrity", "compliant",
                    "No unauthorized route announcements",
                    {"bgp_route_leak"}, "violation",
                    "BGP route leak detected — unauthorized prefixes announced",
                ),
                _check(
                    "Spectrum Usage Compliance", "compliant",
                    "Within allocated spectrum bands",
                ),
                _check(
                    "Emergency Number Routing (112)", "compliant",
                    "Emergency calls routed correctly",
                ),
            ],
        },
        {
            "name": "CERT-In Directions 2022",
            "status": "warning" if {"ddos_attack"} & active else "compliant",
            "last_audit": (now - timedelta(days=30)).strftime("%Y-%m-%d"),
            "next_audit": (now + timedelta(days=60)).strftime("%Y-%m-%d"),
            "checks": [
                _check(
                    "6-Hour Incident Reporting", "compliant",
                    "All incidents reported within mandatory window",
                    {"ddos_attack"}, "warning",
                    "DDoS incident detected — 6-hour reporting deadline active",
                ),
                _check(
                    "Log Retention (180 days)", "compliant",
                    "Logs retained for 180 days as mandated",
                ),
                _check(
                    "ICT Infrastructure Audit", "compliant",
                    "Annual audit completed",
                ),
                _check(
                    "Vulnerability Disclosure", "compliant",
                    "No unpatched critical CVEs",
                    {"ddos_attack"}, "warning",
                    "Active attack may exploit unpatched vulnerability",
                ),
            ],
        },
        {
            "name": "DPDPA 2023 (Data Protection)",
            "status": "warning" if {"memory_leak"} & active else "compliant",
            "last_audit": (now - timedelta(days=60)).strftime("%Y-%m-%d"),
            "next_audit": (now + timedelta(days=120)).strftime("%Y-%m-%d"),
            "checks": [
                _check(
                    "Data Processing Purpose Limitation", "compliant",
                    "Processing limited to stated purposes",
                    {"memory_leak"}, "warning",
                    "Memory leak may cause unintended data retention",
                ),
                _check(
                    "Consent Management", "compliant",
                    "Valid consent obtained for all data processing",
                ),
                _check(
                    "Data Localization", "compliant",
                    "Subscriber data stored within India",
                ),
                _check(
                    "Breach Notification (72 hours)", "compliant",
                    "Notification procedures tested and operational",
                ),
            ],
        },
    ]

    # Overall status
    statuses = [b["status"] for b in bodies]
    if "violation" in statuses:
        overall = "violation"
    elif "warning" in statuses:
        overall = "warning"
    else:
        overall = "compliant"

    return {
        "bodies": bodies,
        "overall_status": overall,
        "ntp_synced": not any_chaos,
        "ntp_source": "ntp.npl.org.in",
        "checked_at": now.isoformat(),
    }


# ── Endpoint 2: Subscriber Session Logs ──────────────────

@router.get("/subscriber-logs")
async def subscriber_logs(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    subscriber_id: str | None = Query(None),
):
    # Total subscriber count from OLT devices
    total_subscribers = 0
    for dev in network_state.devices.values():
        if dev.subscribers:
            total_subscribers += dev.subscribers

    if total_subscribers == 0:
        total_subscribers = 48000  # Fallback

    seed = _seed_for_hour()
    rng = random.Random(seed)

    # Generate all sessions deterministically
    all_logs = []
    now = datetime.now(IST)

    for i in range(min(total_subscribers, 2000)):  # Cap generation at 2000
        rng_local = random.Random(seed + i)
        sub_id = f"SUB-{10000 + i:05d}"

        if subscriber_id and sub_id != subscriber_id:
            continue

        prefix = rng_local.choice(INDIAN_IP_PREFIXES)
        ip = f"{prefix}.{rng_local.randint(1, 254)}.{rng_local.randint(1, 254)}.{rng_local.randint(1, 254)}"
        mac_vendor = rng_local.choice(MAC_VENDORS)
        mac = f"{mac_vendor}:{rng_local.randint(0,255):02X}:{rng_local.randint(0,255):02X}:{rng_local.randint(0,255):02X}"
        olt = rng_local.choice(OLT_DEVICES)
        pon = f"gpon0/{rng_local.randint(0, 15)}/{rng_local.randint(1, 128)}"
        start_offset = rng_local.randint(0, 3600)
        start = now - timedelta(seconds=start_offset)
        duration = rng_local.randint(5, 720)
        status = "active" if start_offset < 1800 else "closed"
        protocol = rng_local.choice(PROTOCOLS)
        bytes_down = rng_local.randint(50_000_000, 5_000_000_000)
        bytes_up = rng_local.randint(5_000_000, 500_000_000)
        nat_ip = f"203.0.{rng_local.randint(100, 200)}.{rng_local.randint(1, 254)}"
        nat_start = rng_local.randint(1024, 60000)

        all_logs.append({
            "session_id": f"SESS-{hashlib.md5(f'{seed}-{i}'.encode()).hexdigest()[:12].upper()}",
            "subscriber_id": sub_id,
            "ip_address": ip,
            "mac_address": mac,
            "olt_device": olt,
            "pon_port": pon,
            "start_time": start.isoformat(),
            "duration_minutes": duration,
            "bytes_up": bytes_up,
            "bytes_down": bytes_down,
            "protocol": protocol,
            "status": status,
            "nat_ip": nat_ip,
            "nat_port_range": f"{nat_start}-{nat_start + 255}",
        })

    # Apply pagination
    total = len(all_logs)
    page = all_logs[offset:offset + limit]

    return {"logs": page, "total": total}


# ── Endpoint 3: Audit Trail ──────────────────────────────

@router.get("/audit-trail")
async def audit_trail(
    limit: int = Query(100, ge=1, le=500),
    category: str | None = Query(None),
):
    entries: list[dict] = []
    now = datetime.now(IST)

    # Source 1: Chaos history → alarm entries
    try:
        chaos_history = await chaos_engine.get_history(limit=20)
        for ch in chaos_history:
            entries.append({
                "timestamp": ch.get("started_at", now.isoformat()),
                "category": "alarm",
                "user": "system",
                "action": f"Chaos scenario: {ch.get('scenario_name', 'unknown')}",
                "detail": f"Status: {ch.get('status', 'unknown')}, "
                          f"ended: {ch.get('ended_at', 'ongoing')}",
                "source_ip": "127.0.0.1",
                "result": "success",
            })
    except Exception:
        pass  # DB might not be ready

    # Source 2: Active chaos → alarm entries
    for ac in chaos_engine.get_active():
        entries.append({
            "timestamp": ac.get("started_at", now.isoformat()),
            "category": "alarm",
            "user": "system",
            "action": f"Active chaos: {ac['scenario']}",
            "detail": f"Running for {ac.get('elapsed_seconds', 0):.0f}s",
            "source_ip": "127.0.0.1",
            "result": "success",
        })

    # Source 3: Synthetic config changes
    seed = _seed_for_hour()
    rng = random.Random(seed + 99)
    for i, (action, cat, user) in enumerate(CONFIG_ACTIONS):
        offset_min = rng.randint(5, 1440)
        ts = now - timedelta(minutes=offset_min)
        entries.append({
            "timestamp": ts.isoformat(),
            "category": cat,
            "user": user,
            "action": action,
            "detail": f"Change ID: CHG-{seed + i:06d}",
            "source_ip": rng.choice(SOURCE_IPS),
            "result": "success",
        })

    # Source 4: Synthetic access logs
    for i, (action, cat, user) in enumerate(ACCESS_ACTIONS):
        offset_min = rng.randint(1, 480)
        ts = now - timedelta(minutes=offset_min)
        entries.append({
            "timestamp": ts.isoformat(),
            "category": cat,
            "user": user,
            "action": action,
            "detail": "",
            "source_ip": rng.choice(SOURCE_IPS),
            "result": "success" if rng.random() > 0.05 else "failure",
        })

    # Source 5: Compliance check entries
    compliance_entries = [
        ("TRAI uptime report generated", "compliance", "system"),
        ("DoT quarterly filing submitted", "compliance", "compliance-officer"),
        ("CERT-In vulnerability scan completed", "compliance", "security-ops"),
        ("DPDPA consent audit passed", "compliance", "compliance-officer"),
        ("Annual TRAI infrastructure audit scheduled", "compliance", "compliance-officer"),
    ]
    for i, (action, cat, user) in enumerate(compliance_entries):
        offset_days = rng.randint(1, 30)
        ts = now - timedelta(days=offset_days)
        entries.append({
            "timestamp": ts.isoformat(),
            "category": cat,
            "user": user,
            "action": action,
            "detail": "",
            "source_ip": "10.0.0.1",
            "result": "success",
        })

    # Filter by category
    if category:
        entries = [e for e in entries if e["category"] == category]

    # Sort by timestamp descending
    entries.sort(key=lambda e: e["timestamp"], reverse=True)

    return entries[:limit]


# ── Endpoint 4: SLA / Uptime Metrics ─────────────────────

@router.get("/sla")
async def sla_metrics():
    devices = network_state.devices
    links = network_state.links

    # Count devices by tier
    tier_map: dict[str, list] = {
        "core": [],
        "aggregation": [],
        "edge": [],
        "olt": [],
        "peering": [],
    }
    for d in devices.values():
        dtype = d.device_type
        if dtype == "core_router":
            tier_map["core"].append(d)
        elif dtype == "aggregation_router":
            tier_map["aggregation"].append(d)
        elif dtype == "edge_router":
            tier_map["edge"].append(d)
        elif dtype == "olt":
            tier_map["olt"].append(d)
        elif dtype == "peering_router":
            tier_map["peering"].append(d)

    # Overall uptime
    total = len(devices)
    up_count = sum(1 for d in devices.values() if d.status.value != "down")
    raw_uptime = (up_count / total * 100) if total > 0 else 100.0
    # Smooth to realistic 99.xx range
    overall_uptime = min(99.999, max(raw_uptime, 95.0))
    if raw_uptime == 100.0:
        overall_uptime = 99.97 + random.Random(_seed_for_hour()).uniform(0, 0.025)

    # Backbone uptime
    backbone_links = [l for l in links.values() if l.link_type == "fiber_backbone"]
    bb_total = len(backbone_links)
    bb_up = sum(1 for l in backbone_links if l.status.value != "down")
    backbone_uptime = (bb_up / bb_total * 100) if bb_total > 0 else 100.0
    if backbone_uptime == 100.0:
        backbone_uptime = 99.98 + random.Random(_seed_for_hour() + 1).uniform(0, 0.015)

    # MTTR
    mttr = 4.2
    try:
        history = await chaos_engine.get_history(limit=10)
        recent = [h for h in history if h.get("ended_at")]
        if recent:
            mttr = 4.2 + len(recent) * 0.8
    except Exception:
        pass

    # SLA
    sla_target = 99.95
    month_minutes = 30 * 24 * 60  # ~43200
    downtime_minutes = round(month_minutes * (1 - overall_uptime / 100), 2)

    # Incidents this month
    incidents = 0
    try:
        history = await chaos_engine.get_history(limit=50)
        incidents = len(history)
    except Exception:
        pass

    # Per-tier breakdown
    tiers = {}
    for tier_name, tier_devices in tier_map.items():
        if not tier_devices:
            continue
        tier_up = sum(1 for d in tier_devices if d.status.value != "down")
        tier_uptime = (tier_up / len(tier_devices) * 100) if tier_devices else 100.0
        tiers[tier_name] = {
            "uptime": round(tier_uptime, 3),
            "devices": len(tier_devices),
        }

    return {
        "overall_uptime_percent": round(overall_uptime, 4),
        "backbone_uptime_percent": round(backbone_uptime, 4),
        "mttr_minutes": round(mttr, 1),
        "sla_target": sla_target,
        "current_month_downtime_minutes": downtime_minutes,
        "incidents_this_month": incidents,
        "tiers": tiers,
    }


# ── Endpoint 5: CERT-In Incident Report ──────────────────

INCIDENT_CLASSIFICATIONS = {
    "network_intrusion": "Unauthorized Network Access / Intrusion",
    "data_breach": "Data Breach — Unauthorized Data Exfiltration",
    "dos_attack": "Denial of Service Attack",
    "malware": "Malware / Ransomware Infection",
    "unauthorized_access": "Unauthorized System Access",
}

REMEDIATION_MAP = {
    "network_intrusion": [
        "Isolated affected network segment",
        "Blocked suspicious source IPs at edge firewall",
        "Initiated forensic packet capture analysis",
        "Rotated all affected credentials",
        "Enhanced IDS/IPS rule signatures",
        "Notified CERT-In within 6-hour window",
    ],
    "data_breach": [
        "Identified scope of data exposure",
        "Revoked compromised access tokens",
        "Notified affected data principals per DPDPA Section 8",
        "Engaged external forensics team",
        "Filed preliminary report with CERT-In",
        "Implemented additional DLP controls",
    ],
    "dos_attack": [
        "Activated DDoS mitigation — upstream scrubbing",
        "Rate-limited affected ingress interfaces",
        "Enabled BGP blackhole routing for attack traffic",
        "Coordinated with upstream ISP for source filtering",
        "Notified CERT-In of volumetric attack",
        "Scaled bandwidth on affected links",
    ],
    "malware": [
        "Quarantined affected systems",
        "Initiated full system scan across infrastructure",
        "Blocked C2 communication endpoints",
        "Restored systems from verified clean backups",
        "Updated endpoint protection signatures",
        "Submitted malware samples to CERT-In",
    ],
    "unauthorized_access": [
        "Disabled compromised user accounts",
        "Enforced MFA on all administrative access",
        "Reviewed and rotated all SSH keys",
        "Audited access logs for lateral movement",
        "Implemented network segmentation enhancements",
        "Filed incident report with CERT-In",
    ],
}


@router.get("/certin-report")
async def certin_report(
    incident_type: str = Query("network_intrusion"),
):
    now = datetime.now(IST)
    classification = INCIDENT_CLASSIFICATIONS.get(
        incident_type,
        INCIDENT_CLASSIFICATIONS["network_intrusion"],
    )

    # Build timeline from chaos history or synthetic
    timeline = []
    try:
        history = await chaos_engine.get_history(limit=5)
        if history:
            for h in history[:3]:
                timeline.append({
                    "event": f"Incident detected: {h.get('scenario_name', 'unknown')}",
                    "time": h.get("started_at", now.isoformat()),
                })
                if h.get("ended_at"):
                    timeline.append({
                        "event": f"Incident resolved: {h.get('scenario_name', 'unknown')}",
                        "time": h["ended_at"],
                    })
    except Exception:
        pass

    if not timeline:
        # Synthetic timeline
        timeline = [
            {"event": "Anomaly detected by monitoring system", "time": (now - timedelta(hours=2)).isoformat()},
            {"event": "Incident confirmed and classified", "time": (now - timedelta(hours=1, minutes=45)).isoformat()},
            {"event": "Response team activated", "time": (now - timedelta(hours=1, minutes=30)).isoformat()},
            {"event": "Mitigation measures deployed", "time": (now - timedelta(hours=1)).isoformat()},
            {"event": "Incident contained", "time": (now - timedelta(minutes=30)).isoformat()},
            {"event": "Post-incident review initiated", "time": now.isoformat()},
        ]

    # Affected systems
    affected = [
        d.device_id for d in network_state.devices.values()
        if d.status.value != "healthy"
    ]
    if not affected:
        affected = ["None — all systems operational"]

    # Remediation
    remediation = REMEDIATION_MAP.get(
        incident_type,
        REMEDIATION_MAP["network_intrusion"],
    )

    # Reporting compliance
    detection_time = now - timedelta(hours=1)
    deadline = detection_time + timedelta(hours=6)
    within_6_hours = now <= deadline

    return {
        "organization": "ISP Network Operations — Autonomous NOC",
        "sector": "Telecommunications",
        "incident_classification": classification,
        "incident_type": incident_type,
        "severity": "high" if incident_type in ("data_breach", "dos_attack") else "medium",
        "timeline": timeline,
        "affected_systems": affected,
        "remediation_steps": remediation,
        "reporting_compliance": {
            "within_6_hours": within_6_hours,
            "reported_at": now.isoformat(),
            "deadline": deadline.isoformat(),
            "regulation": "CERT-In Directions dated 28.04.2022",
        },
        "contact": {
            "name": "Network Operations Center",
            "designation": "Chief Information Security Officer",
            "phone": "+91-11-2436-XXXX",
            "email": "cert-reporting@isp-noc.in",
        },
        "generated_at": now.isoformat(),
    }
