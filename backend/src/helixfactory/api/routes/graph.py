from fastapi import APIRouter

from helixfactory.api.schemas.models import GraphPath, GraphView, NodeContext, NodeSource
from helixfactory.api.schemas.requests import GraphAskRequest, GraphPathRequest, GraphQueryRequest, NodeContextRequest, NodeSourceRequest, NodeSummaryRequest, NodeSummaryResponse
from helixfactory.graph.query_service import GraphQueryService

router = APIRouter()
service = GraphQueryService()


@router.post("/graph/query", response_model=GraphView)
def query_graph(request: GraphQueryRequest) -> GraphView:
    return service.query(request)


@router.get("/graph/overview", response_model=GraphView)
def graph_overview(repositoryId: str) -> GraphView:
    return service.overview(repositoryId)


@router.post("/graph/ask", response_model=GraphView)
def ask_graph(request: GraphAskRequest) -> GraphView:
    return service.ask(request)


@router.post("/qa/node-summary", response_model=NodeSummaryResponse)
def node_summary(request: NodeSummaryRequest) -> NodeSummaryResponse:
    return service.node_summary(request)


@router.post("/qa/node-context", response_model=NodeContext)
def node_context(request: NodeContextRequest) -> NodeContext:
    return service.node_context(request)


@router.post("/qa/node-source", response_model=NodeSource)
def node_source(request: NodeSourceRequest) -> NodeSource:
    return service.node_source(request)


@router.post("/graph/path", response_model=GraphPath)
def graph_path(request: GraphPathRequest) -> GraphPath:
    return service.path_between(request)
