from fastapi import APIRouter, Request, BackgroundTasks, Header, HTTPException, status
import httpx
from app.nucleo.config import settings

router = APIRouter()

@router.post("/webhook/whatsapp")
async def receber_mensagem(request: Request, background_tasks: BackgroundTasks, apikey: str = Header(None, alias="apikey")):
    
    if not apikey or apikey != settings.AUTHENTICATION_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso não autorizado: API Key inválida ou ausente."
        )
    
    payload = await request.json()
    event = payload.get("event", "")

    # Filtra apenas mensagens recebidas no evento
    if event == "messages.upsert":
        data = payload.get("data", {})
        key = data.get("key", {})

        remetente = key.get("remoteJid", "")

        # Ignora mensagens enviadas pelo próprio assistente
        if not key.get("fromMe") and remetente and not remetente.endswith("@broadcast") and not remetente.endswith("@g.us"):

            # Extrai o texto da mensagem
            message_content = data.get("message", {})
            texto = (
                message_content.get("conversation") or
                message_content.get("extendedTextMessage", {}).get("text")
            )

            if texto:
                print(f"\n[Whatsapp] Mensagem de {remetente}: {texto}")
                # Processa a resposta em background para responder ao webhook
                background_tasks.add_task(processar_responder, remetente, texto)

    return {"status": "SUCCESS"}

async def processar_responder(remetente: str, texto: str):
    # Lógica do assistente (LLM / Agente)
    resposta_ia = f"Recebi sua mensagem no Vero: '{texto}'"

    await enviar_mensagem(remetente, resposta_ia)

async def enviar_mensagem(destinatario: str, texto: str):
    url = f"{settings.EVOLUTION_URL}/message/sendText/{settings.INSTANCE_NAME}"
    headers = {
        "apikey": settings.AUTHENTICATION_API_KEY,
        "Content-Type": "application/json"
    }

    numero = destinatario.split("@")[0] if "@" in destinatario else destinatario

    body = {
        "number": numero,
        "text": texto
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=body, headers=headers)
            response.raise_for_status()
            print(f"Mensagem enviada para {numero}")
        except Exception as e:
            print(f"[Erro de envio] Falha ao enviar mensagem para {destinatario}: {e}")
