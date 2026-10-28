import os

import httpx
from dotenv import load_dotenv

load_dotenv()

PROVIDER = os.getenv("TRANSLATOR")


def _libretranslate(text: str, source: str, target: str) -> str:
    url = "http://translator:5000" + "/translate"
    resp = httpx.post(
        url,
        json={"q": text, "source": source, "target": target, "format": "text"},
        timeout=10.0,
    )
    resp.raise_for_status()
    return resp.json()["translatedText"]


PROVIDERS = {"libretranslate": _libretranslate}


def translate(text, source, target):
    return PROVIDERS["libretranslate"](text, source, target)
