from fastapi import APIRouter

from helixfactory.api.routes import ai, audit, blast_radius, executions, graph, qa, repositories, skill_refinements
from helixfactory.api.routes import premortem


def build_router() -> APIRouter:
    router = APIRouter()
    router.include_router(ai.router)
    router.include_router(repositories.router)
    router.include_router(graph.router)
    router.include_router(premortem.router)
    router.include_router(blast_radius.router)
    router.include_router(qa.router)
    router.include_router(audit.router)
    router.include_router(executions.router)
    router.include_router(skill_refinements.router)
    return router
