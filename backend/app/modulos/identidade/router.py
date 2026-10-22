from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.modulos.identidade import servico
from app.modulos.identidade.esquemas import (
    CadastroEntrada,
    DefinirPinEntrada,
    LoginPinEntrada,
    LoginSenhaEntrada,
    TokenSaida,
    UsuarioSaida,
)
from app.modulos.identidade.mensagens import Message
from app.modulos.identidade.modelos import Usuario
from app.modulos.identidade.seguranca import criar_token, usuario_atual
from app.modulos.identidade.servico import Attempts
from app.nucleo.banco import obter_sessao

router = APIRouter(prefix="/api/v1/auth", tags=["autenticação"])


@router.post(
    "/cadastro", response_model=UsuarioSaida, status_code=status.HTTP_201_CREATED
)
def cadastrar(
    dados: CadastroEntrada, sessao: Session = Depends(obter_sessao)
) -> Usuario:
    try:
        return servico.cadastrar(sessao, dados)
    except servico.TelefoneJaCadastrado:
        raise HTTPException(
            status.HTTP_409_CONFLICT, Message.TELEFONE_JA_CADASTRADO.message
        ) from None
    except servico.EmailJaCadastrado:
        raise HTTPException(
            status.HTTP_409_CONFLICT, Message.EMAIL_JA_CADASTRADO.message
        ) from None


@router.post("/login", response_model=TokenSaida)
def entrar_com_senha(
    dados: LoginSenhaEntrada, sessao: Session = Depends(obter_sessao)
) -> TokenSaida:
    return _entrar(
        sessao,
        dados.telefone,
        dados.senha,
        "senha",
        Attempts.DURACAO_TOKEN_SENHA.value,
        Message.DADOS_DE_ENTRADA_ERRADOS.message,
    )


@router.post("/pin", response_model=TokenSaida)
def entrar_com_pin(
    dados: LoginPinEntrada, sessao: Session = Depends(obter_sessao)
) -> TokenSaida:
    return _entrar(
        sessao,
        dados.telefone,
        dados.pin,
        "pin",
        Attempts.DURACAO_TOKEN_PIN.value,
        Message.PIN_ERRADO.message,
    )


@router.put("/pin", status_code=status.HTTP_204_NO_CONTENT)
def definir_pin(
    dados: DefinirPinEntrada,
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> Response:
    # usuario_atual usa a mesma sessão: o FastAPI reaproveita a dependência na requisição
    servico.definir_pin(sessao, usuario, dados.pin)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _entrar(
    sessao: Session,
    telefone: str,
    segredo: str,
    metodo: str,
    duracao: timedelta,
    mensagem_erro: str,
) -> TokenSaida:
    try:
        usuario = servico.autenticar(sessao, telefone, segredo, metodo)
    except servico.CredenciaisInvalidas:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, mensagem_erro) from None
    except servico.PinNaoCriado:
        raise HTTPException(
            status.HTTP_409_CONFLICT, Message.PIN_NAO_CRIADO.message
        ) from None
    except servico.ContaBloqueada as erro:
        segundos = erro.segundos_restantes
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            Message.CONTA_BLOQUEADA.message.format(segundos=segundos),
            headers={"Retry-After": str(segundos)},
        ) from None

    token = criar_token(usuario.id, metodo, duracao)
    return TokenSaida(access_token=token, expira_em=int(duracao.total_seconds()))
