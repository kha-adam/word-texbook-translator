from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from dotenv import load_dotenv
import os

load_dotenv()

FRONTEND_DIR = os.getenv('FRONTEND_DIR')

app = FastAPI(title="PageLens")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}