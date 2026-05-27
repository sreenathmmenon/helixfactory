from fastapi import APIRouter

from helixfactory.services.runtime import runtime

router = APIRouter()


@router.get("/ai/status")
def ai_status() -> dict:
    return runtime.ai_provider.status()
