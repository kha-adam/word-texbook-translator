from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.middleware import RequestBodyLimitMiddleware
from app.routes import router
from app.schemas import HealthResponse

app = FastAPI(title="Langobook")

app.add_middleware(RequestBodyLimitMiddleware, max_body_size=105 * 1024 * 1024)

app.include_router(router)

FRONTEND_DIR = Path(settings.frontend_dir)


@app.get("/viewer", include_in_schema=False)
def login_page():
    return FileResponse(FRONTEND_DIR / "viewer.html")


@app.get("/login", include_in_schema=False)
def login_page():
    return FileResponse(FRONTEND_DIR / "login.html")


@app.get("/signup", include_in_schema=False)
def signup_page():
    return FileResponse(FRONTEND_DIR / "signup.html")


@app.get("/health", response_model=HealthResponse)
def health_check():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": "ok",
    }


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
