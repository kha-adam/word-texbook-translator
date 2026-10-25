from fastapi import FastAPI, UploadFile, File
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from dotenv import load_dotenv
import os
import io
import pytesseract
from PIL import Image

from app.translator import translate

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
    image = image.convert("L")
    image = image.resize((image.width * 2, image.height * 2), Image.LANCZOS)
    text = pytesseract.image_to_string(image, lang='rus', config="--psm 6")
    try:
        translation = translate(text, "ru", "en")
    except Exception as e:
        translation = None
        print("translation failed:", e)
    return {"text": text, "translation": translation}

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")