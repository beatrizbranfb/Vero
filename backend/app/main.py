from fastapi import FastAPI

from app.nucleo.config import settings
from app.nucleo.erros import registrar_tratadores

app = FastAPI(title=settings.APP_NAME)
registrar_tratadores(app)


@app.get("/")
def health_check():
    return {"status": "online", "app": settings.APP_NAME}
