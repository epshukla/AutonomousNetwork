from fastapi import APIRouter
from pydantic import BaseModel

from netsim.chaos.engine import chaos_engine

router = APIRouter(prefix="/api/v1/chaos", tags=["chaos"])


class StartScenarioRequest(BaseModel):
    params: dict | None = None


@router.get("/scenarios")
async def list_scenarios():
    return chaos_engine.list_scenarios()


@router.post("/scenarios/{name}/start")
async def start_scenario(name: str, req: StartScenarioRequest | None = None):
    params = req.params if req else None
    return await chaos_engine.start_scenario(name, params)


@router.post("/scenarios/{name}/stop")
async def stop_scenario(name: str):
    return await chaos_engine.stop_scenario(name)


@router.get("/active")
async def get_active_scenarios():
    return chaos_engine.get_active()


@router.get("/history")
async def get_chaos_history(limit: int = 50):
    return await chaos_engine.get_history(limit)
