from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from dotenv import load_dotenv
import os
import io
import pytesseract
from PIL import Image
load_dotenv()

FRONTEND_DIR = os.getenv('FRONTEND_DIR')

app = FastAPI(title="PageLens")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/ocr")
async def ocr(file: UploadFile = File(...)):
    data = await file.read()
    image = Image.open(io.BytesIO(data))
    text = pytesseract.image_to_string(image, lang='rus', config="--psm 7")
    return {"text": text.strip()}

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")