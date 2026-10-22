from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.modulos.identidade import mensagens, servico
from app.modulos.identidade.esquemas import (
    CadastroEntrada,
    DefinirPinEntrada,
    LoginPinEntrada,
    LoginSenhaEntrada,
    TokenSaida,
    UsuarioSaida,
)
from app.modulos.identidade.modelos import Usuario
from app.modulos.identidade.seguranca import criar_token, usuario_atual
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
            status.HTTP_409_CONFLICT, mensagens.TELEFONE_JA_CADASTRADO
        ) from None
    except servico.EmailJaCadastrado:
        raise HTTPException(
            status.HTTP_409_CONFLICT, mensagens.EMAIL_JA_CADASTRADO
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
        servico.DURACAO_TOKEN_SENHA,
        mensagens.DADOS_DE_ENTRADA_ERRADOS,
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
        servico.DURACAO_TOKEN_PIN,
        mensagens.PIN_ERRADO,
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
            status.HTTP_409_CONFLICT, mensagens.PIN_NAO_CRIADO
        ) from None
    except servico.ContaBloqueada as erro:
        segundos = erro.segundos_restantes
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            mensagens.CONTA_BLOQUEADA.format(segundos=segundos),
            headers={"Retry-After": str(segundos)},
        ) from None

    token = criar_token(usuario.id, metodo, duracao)
    return TokenSaida(access_token=token, expira_em=int(duracao.total_seconds()))
