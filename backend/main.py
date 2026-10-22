from fastapi import FastAPI


app = FastAPI(title="PageLens")

@app.get("/api/health")
def health_check():
    return {"status": "ok"}