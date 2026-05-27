from fastapi import APIRouter

from helixfactory.api.schemas.models import GraphView
from helixfactory.api.schemas.requests import BlastRadiusRequest
from helixfactory.graph.blast_radius import BlastRadiusService

router = APIRouter()
service = BlastRadiusService()


@router.post("/changes/blast-radius", response_model=GraphView)
def calculate_blast_radius(request: BlastRadiusRequest) -> GraphView:
    return service.calculate(request)
