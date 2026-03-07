from fastapi import APIRouter
from pydantic import BaseModel

from nocagent.core.agent_loop import noc_agent
from nocagent.core.learner import learner
from nocagent.core.anomaly_detector import anomaly_detector

router = APIRouter(prefix="/api/v1", tags=["agent"])


class ModeRequest(BaseModel):
    mode: str


@router.get("/agent/status")
async def get_agent_status():
    return noc_agent.status


@router.post("/agent/pause")
async def pause_agent():
    await noc_agent.pause()
    return {"status": "paused"}


@router.post("/agent/resume")
async def resume_agent():
    await noc_agent.resume()
    return {"status": "resumed"}


@router.post("/agent/mode")
async def set_agent_mode(req: ModeRequest):
    noc_agent.set_mode(req.mode)
    return {"status": "mode_changed", "mode": req.mode}


@router.get("/learning/thresholds")
async def get_thresholds():
    return anomaly_detector.thresholds


@router.get("/learning/effectiveness")
async def get_effectiveness():
    return await learner.get_effectiveness()
