from fastapi import APIRouter

from helixfactory.api.schemas.models import Repository
from helixfactory.api.schemas.requests import IngestRepositoryRequest
from helixfactory.ingestion.service import IngestionService
from helixfactory.services.errors import NotFoundError

router = APIRouter()
service = IngestionService()


@router.post("/repositories/ingest", response_model=Repository, status_code=202)
def ingest_repository(request: IngestRepositoryRequest) -> Repository:
    return service.ingest(str(request.url), request.branch, request.label)


@router.get("/repositories/{repository_id}", response_model=Repository)
def get_repository(repository_id: str) -> Repository:
    repository = service.get(repository_id)
    if not repository:
        raise NotFoundError("Repository was not found.", {"repositoryId": repository_id})
    return repository
