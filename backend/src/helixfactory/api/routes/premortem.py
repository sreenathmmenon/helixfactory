from fastapi import APIRouter

from helixfactory.api.schemas.requests import PreMortemRequest, PreMortemResult
from helixfactory.premortem.engine import PreMortemEngine

router = APIRouter()
service = PreMortemEngine()


@router.post("/changes/premortem", response_model=PreMortemResult)
def run_premortem(request: PreMortemRequest) -> PreMortemResult:
    return service.run(request)
