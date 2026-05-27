from fastapi import APIRouter

from helixfactory.api.schemas.requests import ArchitectureAnswer, ArchitectureQuestionRequest
from helixfactory.qa.service import ArchitectureQAService

router = APIRouter()
service = ArchitectureQAService()


@router.post("/qa/architecture", response_model=ArchitectureAnswer)
def ask_architecture_question(request: ArchitectureQuestionRequest) -> ArchitectureAnswer:
    return service.answer(request)
