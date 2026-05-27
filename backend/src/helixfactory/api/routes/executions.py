from fastapi import APIRouter
from pydantic import BaseModel

from helixfactory.api.schemas.models import AgentExecution
from helixfactory.services.errors import NotFoundError
from helixfactory.services.execution_orchestrator import ExecutionOrchestrator

router = APIRouter()
service = ExecutionOrchestrator()
executions: dict[str, AgentExecution] = {}


class ExecutionRequest(BaseModel):
    repositoryId: str
    summary: str


@router.post("/executions", response_model=AgentExecution)
def submit_execution(request: ExecutionRequest) -> AgentExecution:
    execution = service.submit(request.repositoryId, request.summary)
    executions[execution.id] = execution
    return execution


@router.get("/executions/{execution_id}", response_model=AgentExecution)
def get_execution(execution_id: str) -> AgentExecution:
    if execution_id not in executions:
        raise NotFoundError("Execution was not found.", {"executionId": execution_id})
    return executions[execution_id]
