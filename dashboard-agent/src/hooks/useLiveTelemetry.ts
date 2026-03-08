import { useState, useEffect, useRef } from 'react';
import {
  getTopologySnapshot,
  getDeviceTelemetry,
  type TopologyDevice,
  type TopologyLink,
  type DeviceTelemetryPoint,
} from '../api/agent';

const CORE_DEVICES = [
  'core-delhi-1',
  'core-delhi-2',
  'core-mumbai-1',
  'core-mumbai-2',
  'agg-delhi-1',
  'agg-mumbai-1',
];

export function useLiveTelemetry(pollInterval = 5000) {
  const [devices, setDevices] = useState<Record<string, TopologyDevice>>({});
  const [links, setLinks] = useState<Record<string, TopologyLink>>({});
  const [deviceTimeseries, setDeviceTimeseries] = useState<
    Record<string, DeviceTelemetryPoint[]>
  >({});
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchTopo = async () => {
      try {
        const snap = await getTopologySnapshot();
        if (mountedRef.current) {
          setDevices(snap.devices || {});
          setLinks(snap.links || {});
          setLoading(false);
        }
      } catch {
        /* ignore */
      }
    };

    const fetchTimeseries = async () => {
      try {
        const results = await Promise.all(
          CORE_DEVICES.map((id) =>
            getDeviceTelemetry(id, 10, '5s').then(
              (r) => [id, r.data] as const
            )
          )
        );
        if (mountedRef.current) {
          setDeviceTimeseries(Object.fromEntries(results));
        }
      } catch {
        /* ignore */
      }
    };

    fetchTopo();
    fetchTimeseries();
    const topoTimer = setInterval(fetchTopo, pollInterval);
    const tsTimer = setInterval(fetchTimeseries, 10000);

    return () => {
      mountedRef.current = false;
      clearInterval(topoTimer);
      clearInterval(tsTimer);
    };
  }, [pollInterval]);

  return { devices, links, deviceTimeseries, loading };
}
