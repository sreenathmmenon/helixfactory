from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from helixfactory.services.errors import HelixFactoryError

logger = logging.getLogger("helixfactory.api")


class ErrorResponse(BaseModel):
    error: dict = Field(
        examples=[
            {
                "code": "repository_not_found",
                "message": "Repository was not found.",
                "requestId": "req-123",
                "details": {},
            }
        ]
    )


def error_payload(code: str, message: str, request_id: str, details: dict | None = None) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "requestId": request_id,
            "details": details or {},
        }
    }


def install_error_handlers(app) -> None:
    @app.exception_handler(HelixFactoryError)
    async def handle_domain_error(request: Request, exc: HelixFactoryError) -> JSONResponse:
        request_id = f"req-{uuid4().hex[:12]}"
        logger.warning("Domain error %s on %s: %s", request_id, request.url.path, exc, exc_info=True)
        return JSONResponse(
            status_code=getattr(exc, "status_code", 400),
            content=error_payload(getattr(exc, "code", "domain_error"), str(exc), request_id, getattr(exc, "details", None)),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        request_id = f"req-{uuid4().hex[:12]}"
        logger.info("Validation error %s on %s: %s", request_id, request.url.path, exc)
        return JSONResponse(
            status_code=422,
            content=error_payload("validation_error", "The request is invalid. Check the highlighted fields and try again.", request_id, {"errors": exc.errors()}),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        request_id = f"req-{uuid4().hex[:12]}"
        logger.exception("Unhandled error %s on %s", request_id, request.url.path)
        return JSONResponse(
            status_code=500,
            content=error_payload("internal_error", "HelixFactory hit an unexpected error. The action was not completed.", request_id),
        )
