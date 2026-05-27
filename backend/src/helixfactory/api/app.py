from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from helixfactory.api.errors import install_error_handlers
from helixfactory.api.routes import build_router
from helixfactory.services.config import load_settings


def create_app() -> FastAPI:
    settings = load_settings()
    app = FastAPI(title="HelixFactory Platform API", version="0.1.0")
    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_allowed_origins),
        allow_origin_regex=settings.cors_allowed_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "healthy"}

    app.include_router(build_router())
    return app


app = create_app()
