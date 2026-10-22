from fastapi import FastAPI
from app.modulos.identidade.router import router as identidade_router
from app.modulos.assistente.router import router as whatsapp_router
from app.nucleo.config import settings
from app.nucleo.erros import registrar_tratadores

app = FastAPI(title=settings.APP_NAME)
registrar_tratadores(app)

# Rotas
app.include_router(identidade_router)
app.include_router(whatsapp_router)

@app.get("/")
def health_check():
    return {"status": "online", "app": settings.APP_NAME}
