from fastapi import FastAPI
from app.nucleo.config import settings
from app.modulos.assistente.router import router

app = FastAPI(title=settings.APP_NAME)

# Inclui as rotas do Whatsapp
app.include_router(router)

@app.get("/")
def health_check():
    return {"status": "online", "app": settings.APP_NAME}