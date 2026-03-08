"""Per-interface statistics derived from link state."""

from fastapi import APIRouter, HTTPException

from netsim.core.network_state import network_state

router = APIRouter(prefix="/api/v1/interfaces", tags=["interfaces"])


@router.get("/{device_id}")
async def get_interfaces(device_id: str):
    device = await network_state.get_device(device_id)
    if not device:
        raise HTTPException(status_code=404, detail=f"Device {device_id} not found")

    links = await network_state.get_links_for_device(device_id)

    # Build set of interfaces that are connected via links
    connected_interfaces: dict[str, dict] = {}
    for link in links:
        is_from = link.from_device == device_id
        iface_name = link.interface_from if is_from else link.interface_to
        other_device = link.to_device if is_from else link.from_device

        if not iface_name:
            continue

        # Derive per-interface metrics from the link
        throughput_bps = link.throughput_gbps * 1e9
        connected_interfaces[iface_name] = {
            "interface": iface_name,
            "status": "up" if link.status.value != "down" else "down",
            "admin_status": "up",
            "speed_gbps": link.capacity_gbps,
            "utilization_percent": round(link.utilization_percent, 2),
            "in_bps": round(throughput_bps * 0.55),  # Slightly asymmetric
            "out_bps": round(throughput_bps * 0.45),
            "in_errors": link.errors_in,
            "out_errors": link.errors_out,
            "connected_to": other_device,
            "link_id": link.link_id,
            "link_type": link.link_type,
        }

    # Remaining interfaces from device config that aren't connected to any link
    result = []
    for iface in device.interfaces:
        if iface in connected_interfaces:
            result.append(connected_interfaces[iface])
        else:
            result.append({
                "interface": iface,
                "status": "down",
                "admin_status": "down",
                "speed_gbps": 0,
                "utilization_percent": 0.0,
                "in_bps": 0,
                "out_bps": 0,
                "in_errors": 0,
                "out_errors": 0,
                "connected_to": None,
                "link_id": None,
                "link_type": None,
            })

    return {
        "device_id": device_id,
        "vendor": device.vendor,
        "model": device.model,
        "interface_count": len(device.interfaces),
        "interfaces": result,
    }
