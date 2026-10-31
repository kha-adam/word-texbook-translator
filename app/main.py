from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.middleware import RequestBodyLimitMiddleware
from app.routes import router
from app.schemas import HealthResponse

app = FastAPI(title="Cinabre")

app.add_middleware(RequestBodyLimitMiddleware, max_body_size=105 * 1024 * 1024)

app.include_router(router)

FRONTEND_DIR = Path(settings.frontend_dir)


def frontend_page(name: str) -> FileResponse:
    path = FRONTEND_DIR / name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Frontend is not built")
    return FileResponse(path)


@app.get("/viewer", include_in_schema=False)
def viewer_page():
    return frontend_page("viewer.html")


@app.get("/login", include_in_schema=False)
def login_page():
    return frontend_page("login.html")


@app.get("/signup", include_in_schema=False)
def signup_page():
    return frontend_page("signup.html")


@app.get("/health", response_model=HealthResponse)
def health_check():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": "ok",
    }


if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
