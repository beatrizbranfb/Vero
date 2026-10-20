from fastapi import FastAPI

from app.nucleo.config import settings

app = FastAPI(title=settings.APP_NAME)


@app.get("/")
def health_check():
    return {"status": "online", "app": settings.APP_NAME}
