import { useState, useEffect, useRef, useCallback } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";
const WS_URL   = "ws://localhost:8000/ws";

// ── Static topology (positions only — data comes from backend) ────────────────
const NODES = [
  { id: "CORE-ATL-01", type: "core", label: "Core ATL",    x: 400, y: 200 },
  { id: "CORE-NYC-01", type: "core", label: "Core NYC",    x: 700, y: 150 },
  { id: "EDGE-ATL-01", type: "edge", label: "Edge ATL-1",  x: 200, y: 350 },
  { id: "EDGE-ATL-02", type: "edge", label: "Edge ATL-2",  x: 400, y: 400 },
  { id: "EDGE-NYC-01", type: "edge", label: "Edge NYC-1",  x: 650, y: 320 },
  { id: "EDGE-NYC-02", type: "edge", label: "Edge NYC-2",  x: 820, y: 300 },
  { id: "PEER-IX-01",  type: "peer", label: "IX Peer 1",   x: 550, y: 100 },
  { id: "PEER-IX-02",  type: "peer", label: "IX Peer 2",   x: 900, y: 180 },
  { id: "POP-ATL-01",  type: "pop",  label: "POP Atlanta", x: 120, y: 480 },
  { id: "POP-NYC-01",  type: "pop",  label: "POP New York",x: 760, y: 430 },
];

const LINKS = [
  { source: "CORE-ATL-01", target: "CORE-NYC-01", capacity: 100 },
  { source: "CORE-ATL-01", target: "EDGE-ATL-01", capacity: 40 },
  { source: "CORE-ATL-01", target: "EDGE-ATL-02", capacity: 40 },
  { source: "CORE-NYC-01", target: "EDGE-NYC-01", capacity: 40 },
  { source: "CORE-NYC-01", target: "EDGE-NYC-02", capacity: 40 },
  { source: "CORE-ATL-01", target: "PEER-IX-01",  capacity: 50 },
  { source: "CORE-NYC-01", target: "PEER-IX-02",  capacity: 50 },
  { source: "EDGE-ATL-01", target: "POP-ATL-01",  capacity: 20 },
  { source: "EDGE-ATL-02", target: "POP-ATL-01",  capacity: 20 },
  { source: "EDGE-NYC-01", target: "POP-NYC-01",  capacity: 20 },
  { source: "EDGE-NYC-02", target: "POP-NYC-01",  capacity: 20 },
  { source: "PEER-IX-01",  target: "PEER-IX-02",  capacity: 80 },
];

const INITIAL_TELEMETRY = {
  "CORE-ATL-01": { latency: 2.1, packetLoss: 0.01, utilization: 42, health: 100, status: "healthy" },
  "CORE-NYC-01": { latency: 1.8, packetLoss: 0.00, utilization: 38, health: 100, status: "healthy" },
  "EDGE-ATL-01": { latency: 3.2, packetLoss: 0.02, utilization: 55, health: 98,  status: "healthy" },
  "EDGE-ATL-02": { latency: 2.9, packetLoss: 0.01, utilization: 48, health: 100, status: "healthy" },
  "EDGE-NYC-01": { latency: 2.4, packetLoss: 0.00, utilization: 61, health: 97,  status: "healthy" },
  "EDGE-NYC-02": { latency: 2.1, packetLoss: 0.01, utilization: 44, health: 100, status: "healthy" },
  "PEER-IX-01":  { latency: 4.1, packetLoss: 0.03, utilization: 72, health: 95,  status: "healthy" },
  "PEER-IX-02":  { latency: 3.8, packetLoss: 0.02, utilization: 68, health: 96,  status: "healthy" },
  "POP-ATL-01":  { latency: 5.2, packetLoss: 0.04, utilization: 81, health: 92,  status: "warning" },
  "POP-NYC-01":  { latency: 4.9, packetLoss: 0.03, utilization: 77, health: 94,  status: "healthy" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusColor(status) {
  if (status === "critical") return "#ff3b3b";
  if (status === "warning")  return "#f0a500";
  return "#00e676";
}
function riskColor(score) {
  if (score >= 85) return "#ff3b3b";
  if (score >= 60) return "#f0a500";
  return "#00e676";
}
function actionBadge(type) {
  if (type === "auto")     return { bg: "#003322", border: "#00e676", text: "#00e676", label: "AUTO" };
  if (type === "approve")  return { bg: "#332200", border: "#f0a500", text: "#f0a500", label: "APPROVE" };
  return                          { bg: "#330011", border: "#ff3b3b", text: "#ff3b3b", label: "ESCALATE" };
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NetOpsAgent() {
  const [telemetry, setTelemetry]         = useState(INITIAL_TELEMETRY);
  const [tick, setTick]                   = useState(0);
  const [incidents, setIncidents]         = useState([]);
  const [activeIncident, setActiveIncident] = useState(null);
  const [agentState, setAgentState]       = useState("observing");
  const [agentLog, setAgentLog]           = useState([]);
  const [actionQueue, setActionQueue]     = useState([]);
  const [executedActions, setExecutedActions] = useState([]);
  const [selectedNode, setSelectedNode]   = useState(null);
  const [view, setView]                   = useState("topology");
  const [pulseNodes, setPulseNodes]       = useState(new Set());
  const [wsStatus, setWsStatus]           = useState("connecting"); // connecting | live | offline
  const [agentStats, setAgentStats]       = useState(null);
  const wsRef = useRef(null);

  const addLog = useCallback((type, msg) => {
    setAgentLog(prev => [{
      id: Date.now() + Math.random(), type, msg,
      time: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 100));
  }, []);

  // ── WebSocket Connection ───────────────────────────────────────────────────
  useEffect(() => {
    let reconnectTimer = null;

    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsStatus("live");
          addLog("observe", "🔌 Connected to Neurotech NOC backend (WebSocket)");
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        };

        ws.onclose = () => {
          setWsStatus("offline");
          addLog("observe", "⚠️ Backend disconnected — reconnecting in 3s...");
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setWsStatus("offline");
        };
      } catch (e) {
        setWsStatus("offline");
        reconnectTimer = setTimeout(connect, 3000);
      }
    }

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  // Heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch agent stats periodically
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const r = await fetch(`${API_BASE}/agent/stats`);
        if (r.ok) setAgentStats(await r.json());
      } catch {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  function handleMessage(msg) {
    switch (msg.type) {
      case "init":
        if (msg.telemetry) setTelemetry(msg.telemetry);
        if (msg.incidents) setIncidents(msg.incidents);
        if (msg.actions)   setExecutedActions(msg.actions);
        addLog("observe", `📡 Backend sync complete — ${Object.keys(msg.telemetry || {}).length} nodes loaded`);
        break;

      case "telemetry":
        setTelemetry(msg.data);
        setTick(msg.tick);
        if (msg.anomalies?.length > 0) {
          const affected = msg.anomalies.flatMap(a => a.affected);
          setPulseNodes(new Set(affected));
          setTimeout(() => setPulseNodes(new Set()), 3000);
          msg.anomalies.forEach(a => {
            addLog("alert", `⚠️ Anomaly signal: ${a.name} on ${a.affected.join(", ")} [${a.severity}]`);
          });
        }
        if (msg.tick % 5 === 0) {
          addLog("observe", `📡 Telemetry tick T+${msg.tick}: all nodes nominal`);
        }
        break;

      case "agent_state":
        setAgentState(msg.state);
        if (msg.state === "reasoning") {
          addLog("reason", `🧠 Agent reasoning about: ${msg.anomaly?.name}`);
        }
        break;

      case "incident":
        setIncidents(prev => [msg.incident, ...prev]);
        setActiveIncident(msg.incident);
        setActionQueue(msg.incident.actions || []);
        setView("agent");
        addLog("alert", `🔴 INCIDENT: ${msg.incident.name} — Risk Score: ${msg.incident.riskScore}`);
        addLog("reason", `🧠 ${msg.incident.hypothesis?.slice(0, 90)}...`);
        break;

      case "action_executed":
        setExecutedActions(prev => [msg.action, ...prev]);
        setActionQueue(prev => prev.filter(a => a.id !== msg.action.id));
        addLog("action", `✅ ${msg.action.approvedBy ? "OPERATOR APPROVED" : "AUTO-EXECUTED"}: ${msg.action.label}`);
        break;

      case "action_rejected":
        setActionQueue(prev => prev.filter(a => a.id !== msg.action.id));
        addLog("action", `🚫 REJECTED: ${msg.action.label}`);
        break;

      case "action_rolled_back":
        addLog("action", `↩️ ROLLED BACK: ${msg.action.label}`);
        break;

      case "pong":
        break;
    }
  }

  // ── API Actions ────────────────────────────────────────────────────────────
  const handleApproveAction = async (action) => {
    try {
      const r = await fetch(`${API_BASE}/actions/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, incident_id: activeIncident?.id }),
      });
      if (!r.ok) throw new Error("Approval failed");
    } catch (e) {
      addLog("action", `❌ Failed to approve: ${action.label}`);
    }
  };

  const handleRejectAction = async (action) => {
    try {
      await fetch(`${API_BASE}/actions/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, incident_id: activeIncident?.id }),
      });
    } catch {}
  };

  const handleRollback = async (actionId) => {
    try {
      await fetch(`${API_BASE}/actions/rollback/${actionId}`, { method: "POST" });
    } catch {}
  };

  const triggerScenario = async (scenarioId) => {
    try {
      await fetch(`${API_BASE}/simulate/scenario/${scenarioId}`, { method: "POST" });
      addLog("observe", `🧪 Scenario injected: ${scenarioId}`);
    } catch {}
  };

  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: "#050a0f", minHeight: "100vh",
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      color: "#c8d8e8", display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;700;800&display=swap');
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0a1520}::-webkit-scrollbar-thumb{background:#1e3a5a;border-radius:2px}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.15)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes slide-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ring{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.5);opacity:0}}
        .pulse-node{animation:pulse .8s ease-in-out infinite}
        .blink{animation:blink 1s step-end infinite}
        .slide-in{animation:slide-in .3s ease}
        .nav-btn{background:transparent;border:1px solid #1a3a5a;color:#6a9fc0;padding:6px 16px;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:.08em;transition:all .2s}
        .nav-btn:hover{border-color:#3a7fc0;color:#c0e0ff}
        .nav-btn.active{border-color:#00aaff;color:#00aaff;background:#001a2e}
        .action-btn{border:none;padding:6px 14px;cursor:pointer;font-family:inherit;font-size:10px;letter-spacing:.06em;font-weight:700;transition:all .15s}
        .action-btn:hover{filter:brightness(1.3)}
        .scenario-btn{background:#0a1520;border:1px solid #1a3a5a;color:#5a8aaa;padding:5px 12px;cursor:pointer;font-family:inherit;font-size:9px;letter-spacing:.08em;transition:all .2s}
        .scenario-btn:hover{border-color:#f0a500;color:#f0a500}
      `}</style>

      {/* Header */}
      <div style={{ background:"#070e17", borderBottom:"1px solid #0d2035", padding:"0 20px", display:"flex", alignItems:"center", gap:20, height:48, flexShrink:0 }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:"#00aaff", letterSpacing:".12em" }}>
          NEUROTECH <span style={{color:"#3a6a8a"}}>NOC</span>
        </div>
        <div style={{flex:1}}/>
        <div style={{ display:"flex", gap:20, alignItems:"center", fontSize:11 }}>
          {/* WS status */}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span className={wsStatus==="live"?"blink":""} style={{ width:6, height:6, borderRadius:"50%", background: wsStatus==="live"?"#00e676":wsStatus==="connecting"?"#f0a500":"#ff3b3b", display:"inline-block" }}/>
            <span style={{ color:"#5a8aaa" }}>
              {wsStatus==="live" ? "LIVE" : wsStatus==="connecting" ? "CONNECTING" : "OFFLINE"}
            </span>
          </div>
          <span style={{color:"#2a4a6a"}}>|</span>
          <span style={{color:"#5a8aaa"}}>T+{String(tick).padStart(4,"0")}s</span>
          <span style={{color:"#2a4a6a"}}>|</span>
          <span style={{ color: incidents.filter(i=>i.status==="active").length>0?"#ff3b3b":"#5a8aaa" }}>
            {incidents.filter(i=>i.status==="active").length} INCIDENTS
          </span>
          {agentStats && (
            <>
              <span style={{color:"#2a4a6a"}}>|</span>
              <span style={{color:"#5a8aaa"}}>{agentStats.successRate}% SUCCESS RATE</span>
            </>
          )}
        </div>
      </div>

      {/* Nav */}
      <div style={{ background:"#060d15", borderBottom:"1px solid #0d2035", padding:"0 20px", display:"flex", gap:2, alignItems:"center" }}>
        {[["topology","TOPOLOGY MAP"],["agent","AGENT REASONING"],["actions","ACTION QUEUE"],["log","TELEMETRY LOG"],["scenarios","SCENARIOS"]].map(([id,label])=>(
          <button key={id} className={`nav-btn ${view===id?"active":""}`} onClick={()=>setView(id)}>
            {label}
            {id==="actions" && actionQueue.filter(a=>a.type!=="auto").length>0 && (
              <span style={{marginLeft:6,background:"#ff3b3b",color:"#fff",borderRadius:8,padding:"1px 6px",fontSize:9}}>
                {actionQueue.filter(a=>a.type!=="auto").length}
              </span>
            )}
          </button>
        ))}
        <div style={{flex:1}}/>
        {wsStatus === "offline" && (
          <span style={{fontSize:9,color:"#ff7070",padding:"0 12px"}}>⚠️ Backend offline — start server on port 8000</span>
        )}
      </div>

      {/* Main */}
      <div style={{ flex:1, overflow:"hidden", display:"flex" }}>

        {/* Sidebar */}
        <div style={{ width:220, background:"#060d15", borderRight:"1px solid #0d2035", overflowY:"auto", flexShrink:0, padding:"12px 0" }}>
          <div style={{ padding:"0 14px 8px", fontSize:9, color:"#3a6a8a", letterSpacing:".12em" }}>NETWORK NODES</div>
          {NODES.map(node => {
            const t = telemetry[node.id] || {};
            const status = t.status || "healthy";
            const isPulsing = pulseNodes.has(node.id);
            return (
              <div key={node.id} onClick={()=>setSelectedNode(selectedNode===node.id?null:node.id)}
                style={{ padding:"8px 14px", cursor:"pointer", background:selectedNode===node.id?"#0a1f35":"transparent", borderLeft:`2px solid ${selectedNode===node.id?"#00aaff":"transparent"}`, transition:"all .15s" }}>
                <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:3 }}>
                  <span className={isPulsing?"pulse-node":""} style={{ width:7, height:7, borderRadius:"50%", background:statusColor(status), flexShrink:0 }}/>
                  <span style={{ fontSize:10, color:"#a0c8e8", fontWeight:500 }}>{node.id}</span>
                </div>
                {selectedNode===node.id && (
                  <div style={{ fontSize:9, color:"#5a8aaa", paddingLeft:14, display:"grid", gridTemplateColumns:"auto auto", gap:"2px 12px" }}>
                    <span>LAT</span><span style={{color:"#c0d8f0"}}>{(t.latency||0).toFixed(1)}ms</span>
                    <span>LOSS</span><span style={{color:(t.packetLoss||0)>.5?"#f0a500":"#c0d8f0"}}>{(t.packetLoss||0).toFixed(3)}%</span>
                    <span>UTIL</span><span style={{color:(t.utilization||0)>85?"#ff3b3b":"#c0d8f0"}}>{(t.utilization||0).toFixed(0)}%</span>
                    <span>HLTH</span><span style={{color:(t.health||0)<88?"#f0a500":"#c0d8f0"}}>{(t.health||0).toFixed(0)}</span>
                  </div>
                )}
              </div>
            );
          })}
          {incidents.length>0 && (
            <>
              <div style={{ padding:"16px 14px 8px", fontSize:9, color:"#3a6a8a", letterSpacing:".12em", marginTop:8, borderTop:"1px solid #0d2035" }}>INCIDENTS</div>
              {incidents.slice(0,8).map(inc=>(
                <div key={inc.id} onClick={()=>{setActiveIncident(inc);setView("agent");}}
                  style={{ padding:"7px 14px", cursor:"pointer", borderLeft:`2px solid ${inc.riskScore>=85?"#ff3b3b":"#f0a500"}` }}>
                  <div style={{ fontSize:9, color:inc.riskScore>=85?"#ff7070":"#f0c040", fontWeight:700 }}>{inc.name}</div>
                  <div style={{ fontSize:9, color:"#3a6a8a" }}>{inc.time}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Main Panel */}
        <div style={{ flex:1, overflow:"auto", padding:20 }}>

          {/* TOPOLOGY */}
          {view==="topology" && (
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:"#3a6a8a", letterSpacing:".14em", marginBottom:16 }}>NETWORK TOPOLOGY — LIVE VIEW</div>
              <div style={{ position:"relative", background:"#060d15", border:"1px solid #0d2035", borderRadius:4, overflow:"hidden" }}>
                <svg width="100%" height="560" style={{position:"absolute",top:0,left:0,opacity:.07}}>
                  <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00aaff" strokeWidth=".5"/></pattern></defs>
                  <rect width="100%" height="100%" fill="url(#grid)"/>
                </svg>
                <svg width="100%" height="560" viewBox="0 0 1050 560" style={{position:"relative"}}>
                  {LINKS.map((link,i)=>{
                    const src=nodeMap[link.source], tgt=nodeMap[link.target];
                    const srcT=telemetry[link.source]||{}, tgtT=telemetry[link.target]||{};
                    const avgUtil=((srcT.utilization||0)+(tgtT.utilization||0))/2;
                    const linkColor=avgUtil>90?"#ff3b3b":avgUtil>70?"#f0a500":"#1a4a7a";
                    if(!src||!tgt) return null;
                    return (
                      <g key={i}>
                        <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} stroke={linkColor} strokeWidth={avgUtil>90?3:avgUtil>70?2:1.5} strokeDasharray={avgUtil>90?"6,3":"none"} opacity={.7}/>
                        <text x={(src.x+tgt.x)/2} y={(src.y+tgt.y)/2-5} fill="#2a5a7a" fontSize="8" textAnchor="middle">{link.capacity}G</text>
                      </g>
                    );
                  })}
                  {NODES.map(node=>{
                    const t=telemetry[node.id]||{};
                    const status=t.status||"healthy";
                    const color=statusColor(status);
                    const isPulsing=pulseNodes.has(node.id);
                    const r={core:22,edge:16,peer:14,pop:12}[node.type]||14;
                    return (
                      <g key={node.id} onClick={()=>setSelectedNode(selectedNode===node.id?null:node.id)} style={{cursor:"pointer"}}>
                        {isPulsing&&<circle cx={node.x} cy={node.y} r={r+8} fill="none" stroke={color} strokeWidth="2" style={{animation:"ring 1s ease-out infinite"}} opacity=".5"/>}
                        <circle cx={node.x} cy={node.y} r={r} fill="#060d15" stroke={color} strokeWidth={selectedNode===node.id?3:1.5} opacity={.95}/>
                        <circle cx={node.x} cy={node.y} r={r*.45} fill={color} opacity={.8}/>
                        <text x={node.x} y={node.y+r+14} fill="#7aaac8" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono">{node.label}</text>
                        <text x={node.x} y={node.y+r+24} fill={(t.utilization||0)>85?"#f0a500":"#3a6a8a"} fontSize="8" textAnchor="middle">{(t.utilization||0).toFixed(0)}%</text>
                      </g>
                    );
                  })}
                </svg>
                <div style={{position:"absolute",bottom:12,right:16,display:"flex",gap:16,fontSize:9,color:"#3a6a8a"}}>
                  {[["#00e676","HEALTHY"],["#f0a500","WARNING"],["#ff3b3b","CRITICAL"]].map(([c,l])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:c,display:"inline-block"}}/>{l}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginTop:16 }}>
                {[
                  {label:"AVG LATENCY",val:(Object.values(telemetry).reduce((s,t)=>s+(t.latency||0),0)/NODES.length).toFixed(1)+"ms",warn:false},
                  {label:"MAX UTILIZATION",val:Math.max(...Object.values(telemetry).map(t=>t.utilization||0)).toFixed(0)+"%",warn:Math.max(...Object.values(telemetry).map(t=>t.utilization||0))>85},
                  {label:"NODES WARNING",val:Object.values(telemetry).filter(t=>t.status==="warning").length,warn:Object.values(telemetry).filter(t=>t.status==="warning").length>0},
                  {label:"NODES CRITICAL",val:Object.values(telemetry).filter(t=>t.status==="critical").length,warn:Object.values(telemetry).filter(t=>t.status==="critical").length>0},
                ].map(card=>(
                  <div key={card.label} style={{background:"#060d15",border:`1px solid ${card.warn?"#3a2000":"#0d2035"}`,padding:"12px 16px"}}>
                    <div style={{fontSize:9,color:"#3a6a8a",letterSpacing:".1em",marginBottom:6}}>{card.label}</div>
                    <div style={{fontSize:24,fontFamily:"'Syne',sans-serif",fontWeight:700,color:card.warn?"#f0a500":"#c0e0ff"}}>{card.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AGENT REASONING */}
          {view==="agent" && (
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:11,color:"#3a6a8a",letterSpacing:".14em",marginBottom:16}}>AGENT REASONING ENGINE — CLAUDE AI</div>
              <div style={{display:"flex",gap:10,marginBottom:20}}>
                {["observing","reasoning","acting"].map(state=>(
                  <div key={state} style={{flex:1,padding:"10px 14px",background:agentState===state?"#001a2e":"#060d15",border:`1px solid ${agentState===state?"#00aaff":"#0d2035"}`,textAlign:"center"}}>
                    <div style={{fontSize:9,letterSpacing:".12em",color:agentState===state?"#00aaff":"#3a6a8a",fontWeight:agentState===state?700:400}}>
                      {agentState===state&&<span className="blink">▶ </span>}{state.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
              {activeIncident ? (
                <div className="slide-in">
                  <div style={{background:"#0a0d15",border:`1px solid ${riskColor(activeIncident.riskScore)}30`,padding:"14px 18px",marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,color:"#e0f0ff",marginBottom:4}}>{activeIncident.name}</div>
                        <div style={{fontSize:9,color:"#3a6a8a"}}>ID: {activeIncident.id} · {activeIncident.time} · Nodes: {activeIncident.affected?.join(", ")}</div>
                        {activeIncident.timeToImpact && (
                          <div style={{fontSize:9,color:"#f0a500",marginTop:4}}>⏱ Time to customer impact: {activeIncident.timeToImpact}</div>
                        )}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:9,color:"#3a6a8a",marginBottom:2}}>RISK SCORE</div>
                        <div style={{fontSize:28,fontFamily:"'Syne',sans-serif",fontWeight:800,color:riskColor(activeIncident.riskScore)}}>{activeIncident.riskScore}</div>
                        {activeIncident.confidence && (
                          <div style={{fontSize:9,color:"#3a6a8a"}}>confidence: {activeIncident.confidence}%</div>
                        )}
                      </div>
                    </div>
                    <div style={{background:"#0d2035",height:4,borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${activeIncident.riskScore}%`,background:riskColor(activeIncident.riskScore),transition:"width .5s",borderRadius:2}}/>
                    </div>
                  </div>
                  <div style={{background:"#060d15",border:"1px solid #0d2035",borderLeft:"3px solid #00aaff",padding:"14px 18px",marginBottom:12}}>
                    <div style={{fontSize:9,color:"#00aaff",letterSpacing:".12em",marginBottom:8}}>CLAUDE AI HYPOTHESIS</div>
                    <div style={{fontSize:11,lineHeight:1.7,color:"#a0c8e8"}}>{activeIncident.hypothesis}</div>
                  </div>
                  <div style={{background:"#060d15",border:"1px solid #0d2035",borderLeft:"3px solid #f0a500",padding:"14px 18px",marginBottom:16}}>
                    <div style={{fontSize:9,color:"#f0a500",letterSpacing:".12em",marginBottom:8}}>ROOT CAUSE ASSESSMENT</div>
                    <div style={{fontSize:11,lineHeight:1.7,color:"#a0c8e8"}}>{activeIncident.rootCause}</div>
                  </div>
                  <div style={{fontSize:9,color:"#3a6a8a",letterSpacing:".12em",marginBottom:10}}>PROPOSED INTERVENTIONS</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {activeIncident.actions?.map(action=>{
                      const badge=actionBadge(action.type);
                      const isQueued=actionQueue.some(a=>a.id===action.id);
                      const isExecuted=executedActions.some(a=>a.id===action.id);
                      return (
                        <div key={action.id} style={{background:"#060d15",border:`1px solid ${badge.border}30`,padding:"12px 16px",display:"flex",gap:14,alignItems:"flex-start"}}>
                          <div style={{background:badge.bg,border:`1px solid ${badge.border}`,color:badge.text,fontSize:8,padding:"2px 8px",letterSpacing:".1em",fontWeight:700,whiteSpace:"nowrap"}}>{badge.label}</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11,color:"#c0d8f0",fontWeight:500,marginBottom:4}}>{action.label}</div>
                            <div style={{fontSize:10,color:"#5a8aaa",lineHeight:1.5}}>{action.detail}</div>
                            {action.rollback && <div style={{fontSize:9,color:"#3a5a3a",marginTop:3}}>↩ Rollback: {action.rollback}</div>}
                            <div style={{fontSize:9,color:"#3a6a8a",marginTop:4}}>ETA: {action.eta}</div>
                          </div>
                          <div>
                            {isExecuted ? (
                              <span style={{fontSize:9,color:"#00e676"}}>✓ DONE</span>
                            ) : isQueued && action.type!=="auto" ? (
                              <div style={{display:"flex",gap:6}}>
                                <button className="action-btn" onClick={()=>handleApproveAction(action)} style={{background:"#003322",color:"#00e676",border:"1px solid #00e67640"}}>APPROVE</button>
                                <button className="action-btn" onClick={()=>handleRejectAction(action)} style={{background:"#330011",color:"#ff7070",border:"1px solid #ff3b3b40"}}>REJECT</button>
                              </div>
                            ) : action.type==="auto" && !isExecuted ? (
                              <span style={{fontSize:9,color:"#5a8aaa"}}>PENDING...</span>
                            ) : action.type==="escalate" ? (
                              <span style={{fontSize:9,color:"#ff7070"}}>AWAITING NOC</span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{background:"#060d15",border:"1px solid #0d2035",padding:"40px",textAlign:"center"}}>
                  <div style={{fontSize:11,color:"#3a6a8a"}}>No active incidents · Claude AI monitoring {NODES.length} nodes</div>
                  <div style={{fontSize:9,color:"#1a3a5a",marginTop:8}}>
                    {wsStatus==="live" ? "Agent is live — anomalies will appear here automatically" : "⚠️ Start backend server to enable real AI reasoning"}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ACTION QUEUE */}
          {view==="actions" && (
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:11,color:"#3a6a8a",letterSpacing:".14em",marginBottom:16}}>ACTION CONTROL CENTER</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
                {[
                  {tier:"TIER 1 — AUTO",desc:"Executed automatically. Low blast radius, fully reversible.",color:"#00e676",actions:["ECMP rebalancing","BGP soft suppression","Traffic pre-positioning","Metric adjustment"]},
                  {tier:"TIER 2 — OPERATOR APPROVAL",desc:"Queued for human review before execution.",color:"#f0a500",actions:["QoS policy changes","BFD timer adjustments","Rate limiting","Controlled failover"]},
                  {tier:"TIER 3 — ESCALATION",desc:"Requires NOC engineer + change management.",color:"#ff3b3b",actions:["Emergency capacity","Physical dispatch","IX peer failover","Core routing changes"]},
                ].map(tier=>(
                  <div key={tier.tier} style={{background:"#060d15",border:`1px solid ${tier.color}25`,padding:"14px 16px"}}>
                    <div style={{fontSize:9,color:tier.color,fontWeight:700,letterSpacing:".1em",marginBottom:6}}>{tier.tier}</div>
                    <div style={{fontSize:9,color:"#5a8aaa",lineHeight:1.6,marginBottom:10}}>{tier.desc}</div>
                    <div style={{borderTop:`1px solid ${tier.color}15`,paddingTop:8}}>
                      {tier.actions.map(a=><div key={a} style={{fontSize:9,color:"#3a6a8a",padding:"2px 0"}}>· {a}</div>)}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:9,color:"#3a6a8a",letterSpacing:".12em",marginBottom:10}}>EXECUTION HISTORY ({executedActions.length} actions)</div>
              {executedActions.length===0 ? (
                <div style={{background:"#060d15",border:"1px solid #0d2035",padding:"20px",textAlign:"center",fontSize:10,color:"#3a6a8a"}}>No actions executed yet</div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {executedActions.slice(0,20).map((action,i)=>{
                    const badge=actionBadge(action.type);
                    return (
                      <div key={i} style={{background:"#060d15",border:"1px solid #0d2035",padding:"10px 14px",display:"flex",gap:12,alignItems:"center"}}>
                        <span style={{color:action.outcome==="success"?"#00e676":"#ff3b3b",fontSize:12}}>{action.outcome==="success"?"✓":"✗"}</span>
                        <div style={{background:badge.bg,border:`1px solid ${badge.border}`,color:badge.text,fontSize:8,padding:"1px 6px"}}>{badge.label}</div>
                        <span style={{fontSize:10,color:"#a0c8e8",flex:1}}>{action.label}</span>
                        <span style={{fontSize:9,color:"#3a6a8a"}}>{action.executedAt ? new Date(action.executedAt).toLocaleTimeString() : ""}</span>
                        {action.outcome==="success" && action.status!=="rolled_back" && (
                          <button onClick={()=>handleRollback(action.id)} style={{fontSize:9,background:"#1a0d00",border:"1px solid #3a2000",color:"#f0a500",padding:"2px 8px",cursor:"pointer",fontFamily:"inherit"}}>ROLLBACK</button>
                        )}
                        {action.status==="rolled_back" && <span style={{fontSize:9,color:"#f0a500"}}>↩ ROLLED BACK</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TELEMETRY LOG */}
          {view==="log" && (
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:11,color:"#3a6a8a",letterSpacing:".14em",marginBottom:16}}>TELEMETRY & AGENT LOG</div>
              <div style={{background:"#060d15",border:"1px solid #0d2035",padding:"14px",fontFamily:"'JetBrains Mono',monospace",fontSize:10,height:520,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                {agentLog.map(entry=>{
                  const colors={observe:"#3a6a8a",alert:"#ff7070",reason:"#b0d0f0",action:"#00e676"};
                  return (
                    <div key={entry.id} className="slide-in" style={{display:"flex",gap:12,color:colors[entry.type]||"#5a8aaa",lineHeight:1.5}}>
                      <span style={{color:"#2a4a6a",flexShrink:0}}>{entry.time}</span>
                      <span>{entry.msg}</span>
                    </div>
                  );
                })}
                {agentLog.length===0&&<span style={{color:"#2a4a6a"}}>Waiting for backend connection...</span>}
              </div>
            </div>
          )}

          {/* SCENARIOS */}
          {view==="scenarios" && (
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:11,color:"#3a6a8a",letterSpacing:".14em",marginBottom:16}}>SCENARIO INJECTION — TESTING PANEL</div>
              <div style={{background:"#0a0d10",border:"1px solid #1a3a1a",padding:"10px 16px",marginBottom:20,fontSize:10,color:"#5a9a5a"}}>
                ⚠️ These inject real failure scenarios into the backend simulator. Claude AI will analyze and respond to each one.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
                {[
                  {id:"congestion-atl",name:"Atlanta Congestion Cascade",desc:"Simulates evening traffic surge overwhelming Atlanta PoP uplinks. Tests ECMP rebalancing and QoS logic.",severity:"warning",nodes:"POP-ATL-01, EDGE-ATL-01/02"},
                  {id:"bgp-flap",name:"BGP Route Flap NYC",desc:"BFD timer mismatch causes repeated BGP session resets. Tests protocol-layer anomaly detection.",severity:"critical",nodes:"PEER-IX-02, CORE-NYC-01"},
                  {id:"fiber-cut",name:"Fiber Degradation ATL-Core",desc:"Progressive optical power degradation on core uplink. Tests predictive failure detection.",severity:"critical",nodes:"CORE-ATL-01"},
                  {id:"ddos",name:"DDoS Absorption Event",desc:"Large volumetric attack absorbed at IX peers, stressing core nodes.",severity:"critical",nodes:"PEER-IX-01/02, CORE-ATL-01/NYC-01"},
                ].map(s=>(
                  <div key={s.id} style={{background:"#060d15",border:`1px solid ${s.severity==="critical"?"#3a0d0d":"#1a3a0d"}`,padding:"16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:12,color:"#e0f0ff"}}>{s.name}</div>
                      <span style={{fontSize:8,padding:"2px 8px",background:s.severity==="critical"?"#330011":"#332200",border:`1px solid ${s.severity==="critical"?"#ff3b3b":"#f0a500"}`,color:s.severity==="critical"?"#ff7070":"#f0c040"}}>{s.severity.toUpperCase()}</span>
                    </div>
                    <div style={{fontSize:10,color:"#5a8aaa",lineHeight:1.6,marginBottom:8}}>{s.desc}</div>
                    <div style={{fontSize:9,color:"#3a6a8a",marginBottom:12}}>Affects: {s.nodes}</div>
                    <button className="scenario-btn" onClick={()=>triggerScenario(s.id)} style={{width:"100%",padding:"8px",fontSize:10}}>
                      ▶ INJECT SCENARIO
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{background:"#050810",borderTop:"1px solid #0d2035",padding:"6px 20px",display:"flex",gap:20,fontSize:9,color:"#2a4a6a",flexShrink:0}}>
        <span>NEUROTECH NOC v2.0</span><span>·</span>
        <span>Observe → Reason → Decide → Act → Learn</span><span>·</span>
        <span>{NODES.length} nodes · {LINKS.length} links</span>
        <div style={{flex:1}}/>
        {agentStats && <span>Actions: {agentStats.totalActions} · Success: {agentStats.successRate}% · Incidents: {agentStats.incidentsDetected}</span>}
        <span style={{color:wsStatus==="live"?"#2a6a3a":"#6a2a2a"}}>WS: {wsStatus.toUpperCase()}</span>
      </div>
    </div>
  );
}
