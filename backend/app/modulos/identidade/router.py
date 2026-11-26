import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integracoes.correio import obter_email
from app.modulos.identidade import recuperacao, servico
from app.modulos.identidade.esquemas import (
    CadastroEntrada,
    ConviteEntrada,
    ConviteRecebidoSaida,
    DesafioWebauthSaida,
    EntradaFinalizarRegistroWebauthn,
    EntradaLoginWebauthn,
    EsqueciPinEntrada,
    EsqueciPinSaida,
    LoginPinEntrada,
    RedefinirPinEntrada,
    SaidaLoginWebauthn,
    TokenSaida,
    TrocarPinEntrada,
    UsuarioSaida,
)
from app.modulos.identidade.mensagens import Message
from app.modulos.identidade.modelos import Acompanhante, Usuario
from app.modulos.identidade.seguranca import (
    criar_token,
    hash_telefone,
    usuario_atual,
)
from app.modulos.identidade.servico import Attempts
from app.nucleo.banco import obter_sessao
from app.nucleo.portas import PortaEmail

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
def entrar_com_pin(
    dados: LoginPinEntrada, sessao: Session = Depends(obter_sessao)
) -> TokenSaida:
    return _entrar(
        sessao,
        dados.telefone,
        dados.pin,
        Message.PIN_ERRADO.message,
    )


@router.post("/pin", response_model=TokenSaida, include_in_schema=False)
def entrar_com_pin_legacy(
    dados: LoginPinEntrada, sessao: Session = Depends(obter_sessao)
) -> TokenSaida:
    return entrar_com_pin(dados, sessao)


def _entrar(
    sessao: Session, telefone: str, segredo: str, mensagem_erro: str
) -> TokenSaida:
    try:
        usuario = servico.autenticar(sessao, telefone, segredo)
    except servico.CredenciaisInvalidas:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, mensagem_erro) from None
    except servico.ContaBloqueada as erro:
        raise _conta_bloqueada(erro) from None
    return _emitir_token(usuario)


@router.post(
    "/pin/esqueci",
    response_model=EsqueciPinSaida,
    status_code=status.HTTP_202_ACCEPTED,
)
def esqueci_pin(
    dados: EsqueciPinEntrada,
    tarefas: BackgroundTasks,
    sessao: Session = Depends(obter_sessao),
    email: PortaEmail = Depends(obter_email),
) -> EsqueciPinSaida:
    """Envia um código de 6 dígitos para o e-mail do cadastro.

    A resposta é a mesma com ou sem conta, para não revelar quem usa o Vero (RNF05).
    """
    try:
        resultado = recuperacao.pedir_codigo(sessao, dados.telefone)
    except recuperacao.EspereNovoCodigo as erro:
        segundos = erro.segundos_restantes
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            Message.ESPERE_NOVO_CODIGO.message.format(segundos=segundos),
            headers={"Retry-After": str(segundos)},
        ) from None
    except recuperacao.MuitosCodigos:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, Message.MUITOS_CODIGOS.message
        ) from None
    except recuperacao.RecuperacaoIndisponivel:
        raise _recuperacao_indisponivel() from None

    minutos = int(recuperacao.Limites.VALIDADE_CODIGO.value.total_seconds() // 60)
    if resultado is not None:
        usuario, codigo = resultado
        texto = Message.EMAIL_CODIGO.message.format(
            nome=usuario.nome, codigo=codigo, minutos=minutos
        )
        tarefas.add_task(
            recuperacao.enviar_codigo,
            email,
            usuario,
            dados.telefone,
            Message.EMAIL_ASSUNTO.message,
            texto,
        )
    return EsqueciPinSaida(
        mensagem=Message.CODIGO_ENVIADO.message.format(minutos=minutos),
        validade_minutos=minutos,
    )


@router.post("/pin/redefinir", response_model=TokenSaida)
def redefinir_pin(
    dados: RedefinirPinEntrada, sessao: Session = Depends(obter_sessao)
) -> TokenSaida:
    """Confere o código, grava o novo PIN e já entra na conta."""
    try:
        usuario = recuperacao.redefinir_pin(
            sessao, dados.telefone, dados.codigo, dados.novo_pin
        )
    except recuperacao.CodigoErrado:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, Message.CODIGO_ERRADO.message
        ) from None
    except recuperacao.RecuperacaoIndisponivel:
        raise _recuperacao_indisponivel() from None
    return _emitir_token(usuario)


@router.put("/pin", response_model=TokenSaida)
def trocar_pin(
    dados: TrocarPinEntrada,
    usuario: Usuario = Depends(usuario_atual),
    sessao: Session = Depends(obter_sessao),
) -> TokenSaida:
    """Troca o PIN de quem está logado. Devolve um token novo para este aparelho."""
    try:
        usuario = recuperacao.trocar_pin(
            sessao, usuario, dados.pin_atual, dados.novo_pin
        )
    except servico.CredenciaisInvalidas:
        # 400, e não 401, para o app não achar que a sessão terminou
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, Message.PIN_ATUAL_ERRADO.message
        ) from None
    except servico.ContaBloqueada as erro:
        raise _conta_bloqueada(erro) from None
    return _emitir_token(usuario)


@router.post(
    "/webauthn/start",
    response_model=DesafioWebauthSaida,
    status_code=status.HTTP_200_OK,
)
def start_webauthn(
    dados: EntradaLoginWebauthn, sessao: Session = Depends(obter_sessao)
) -> DesafioWebauthSaida:
    """inicia o fluxo de registro webauthn. retorna um challenge pro cliente"""
    usuario = sessao.scalar(
        select(Usuario).where(
            Usuario.hash_telefone == hash_telefone(dados.usuario_telefone)
        )
    )
    if usuario is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, Message.CONVIDADO_SEM_CONTA.message
        )
    desafio = servico.gerar_desafio_webauthn(usuario)
    sessao.commit()
    return DesafioWebauthSaida(desafio=desafio)


@router.post(
    "/webauthn/finish",
    response_model=SaidaLoginWebauthn,
    status_code=status.HTTP_200_OK,
)
def finish_webauthn(
    dados: EntradaFinalizarRegistroWebauthn, sessao: Session = Depends(obter_sessao)
) -> SaidaLoginWebauthn:
    """finaliza o registro webauthn, salvando a public key"""
    usuario = sessao.scalar(
        select(Usuario).where(Usuario.id == dados.id_usuario_acompanhante)
    )
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado.")
    servico.salvar_credencial_webauthn(
        sessao,
        usuario,
        dados.credential_public_key,
        dados.credential_id,
        dados.quantidade,
    )
    sessao.commit()
    return SaidaLoginWebauthn(sucesso=True, mensagem="Registro biométrico concluído.")


@router.post(
    "/webauthn/login",
    response_model=SaidaLoginWebauthn,
    status_code=status.HTTP_200_OK,
)
def login_webauthn(
    dados: EntradaLoginWebauthn, sessao: Session = Depends(obter_sessao)
) -> SaidaLoginWebauthn:
    """autentica o usuario usando a credencial"""
    usuario = sessao.scalar(
        select(Usuario).where(
            Usuario.hash_telefone == hash_telefone(dados.usuario_telefone)
        )
    )
    if usuario is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, Message.CONVIDADO_SEM_CONTA.message
        )
    if not servico.existe_credencial_webauthn(usuario, "credencial_padrao"):
        return SaidaLoginWebauthn(
            sucesso=False,
            mensagem="Nenhuma credencial biométrica registrada. "
            "Cadastre uma primeiro e tente novamente.",
        )

    # TODO: verificar challenge assinado contra a credencial guardada no banco.
    return SaidaLoginWebauthn(sucesso=True, mensagem="Acesso com biometria liberado")


def _emitir_token(usuario: Usuario, id_titular: uuid.UUID | None = None) -> TokenSaida:
    duracao = Attempts.DURACAO_TOKEN_PIN.value
    token = criar_token(
        usuario.id, "pin", duracao, usuario.versao_token, id_titular=id_titular
    )
    return TokenSaida(access_token=token, expira_em=int(duracao.total_seconds()))


def _conta_bloqueada(erro: servico.ContaBloqueada) -> HTTPException:
    segundos = erro.segundos_restantes
    return HTTPException(
        status.HTTP_429_TOO_MANY_REQUESTS,
        Message.CONTA_BLOQUEADA.message.format(segundos=segundos),
        headers={"Retry-After": str(segundos)},
    )


def _recuperacao_indisponivel() -> HTTPException:
    return HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE, Message.RECUPERACAO_INDISPONIVEL.message
    )


STATUS_ATIVOS = ("pendente", "autorizado")


def _buscar_convite(
    sessao: Session, id_titular: uuid.UUID, id_acompanhante: uuid.UUID
) -> Acompanhante | None:
    return sessao.get(Acompanhante, (id_titular, id_acompanhante))


@router.post(
    "/convidar-acompanhante", response_model=dict, status_code=status.HTTP_201_CREATED
)
def convidar_acompanhante(
    dados: ConviteEntrada,
    sessao: Session = Depends(obter_sessao),
    current_user: Usuario = Depends(usuario_atual),
) -> dict[str, str]:
    """Pessoa convida familiar para ser acompanhante.

    O familiar ou próximo recebe um convite e precisa aceitar explicitamente.
    """
    convidado = sessao.scalar(
        select(Usuario).where(Usuario.hash_telefone == hash_telefone(dados.telefone))
    )
    if convidado is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, Message.CONVIDADO_SEM_CONTA.message
        )
    if convidado.id == current_user.id:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            Message.CONVIDAR_A_SI_MESMO.message,
        )

    convite = _buscar_convite(sessao, current_user.id, convidado.id)
    if convite is not None and convite.status in STATUS_ATIVOS:
        raise HTTPException(status.HTTP_409_CONFLICT, Message.CONVITE_JA_EXISTE.message)
    if convite is None:
        convite = Acompanhante(
            id_usuario_titular=current_user.id,
            id_usuario_acompanhante=convidado.id,
        )
        sessao.add(convite)
    # Convite revogado antes: reaproveita a linha (a PK é o par de usuários)
    convite.status = "pendente"
    convite.ic_pode_editar = True
    convite.dh_aceite = None
    convite.dh_revogacao = None
    sessao.commit()

    return {
        "status": "convite_enviado",
        "convite_id": str(convite.id_usuario_acompanhante),
        "mensagem": f"Convite enviado para {convidado.nome}.",
    }


@router.get("/convites-recebidos", response_model=list[ConviteRecebidoSaida])
def listar_convites_recebidos(
    sessao: Session = Depends(obter_sessao),
    current_user: Usuario = Depends(usuario_atual),
) -> list[ConviteRecebidoSaida]:
    linhas = sessao.execute(
        select(Acompanhante, Usuario.nome)
        .join(Usuario, Acompanhante.id_usuario_titular == Usuario.id)
        .where(
            Acompanhante.id_usuario_acompanhante == current_user.id,
            Acompanhante.status.in_(STATUS_ATIVOS),
        )
        .order_by(Acompanhante.dh_criacao.desc())
    ).all()
    return [
        ConviteRecebidoSaida(
            id_titular=convite.id_usuario_titular,
            nome_titular=nome,
            status=convite.status,
            data_convite=convite.dh_criacao,
        )
        for convite, nome in linhas
    ]


@router.post("/acompanhar/{id_usuario_titular}", response_model=TokenSaida)
def acompanhar(
    id_usuario_titular: uuid.UUID,
    sessao: Session = Depends(obter_sessao),
    current_user: Usuario = Depends(usuario_atual),
) -> TokenSaida:
    convite = _buscar_convite(sessao, id_usuario_titular, current_user.id)
    if convite is None or convite.status != "autorizado":
        raise HTTPException(status.HTTP_403_FORBIDDEN, Message.ACESSO_REVOGADO.message)
    return _emitir_token(current_user, id_titular=id_usuario_titular)


@router.post(
    "/aceitar-convite/{id_usuario_titular}",
    response_model=dict,
    status_code=status.HTTP_200_OK,
)
def aceitar_convite(
    id_usuario_titular: uuid.UUID,
    sessao: Session = Depends(obter_sessao),
    current_user: Usuario = Depends(usuario_atual),
) -> dict[str, str]:
    """A pessoa convidada aceita explicitamente o convite do titular."""
    convite = _buscar_convite(sessao, id_usuario_titular, current_user.id)
    if convite is None or convite.status != "pendente":
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, Message.CONVITE_NAO_ENCONTRADO.message
        )
    convite.dh_aceite = datetime.now(UTC)
    convite.status = "autorizado"
    sessao.commit()

    return {
        "status": "acesso_liberado",
        "mensagem": "Seu acesso ao perfil foi liberado.",
    }


@router.post(
    "/revogar-acesso/{convite_id}", response_model=dict, status_code=status.HTTP_200_OK
)
def revogar_acesso(
    convite_id: uuid.UUID,
    sessao: Session = Depends(obter_sessao),
    current_user: Usuario = Depends(usuario_atual),
) -> dict[str, str]:
    """O titular revoga o acesso do acompanhante (convite_id = id do acompanhante)."""
    convite = _buscar_convite(sessao, current_user.id, convite_id)
    if convite is None or convite.status not in STATUS_ATIVOS:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, Message.CONVITE_NAO_ENCONTRADO.message
        )
    convite.status = "revogado"
    convite.dh_revogacao = datetime.now(UTC)
    sessao.commit()

    return {"status": "revogado", "mensagem": "Acesso revogado com sucesso."}


@router.get(
    "/contas-com-acompanhantes",
    response_model=list[dict[str, str | datetime | bool | None]],
    status_code=status.HTTP_200_OK,
)
def listar_acompanhantes(
    sessao: Session = Depends(obter_sessao),
    current_user: Usuario = Depends(usuario_atual),
):
    stmt = (
        select(
            Acompanhante.id_usuario_acompanhante,
            Usuario.nome,
            Acompanhante.dh_criacao,
            Acompanhante.ic_pode_editar,
            Acompanhante.dh_aceite,
        )
        .join(Usuario, Acompanhante.id_usuario_acompanhante == Usuario.id)
        .where(
            Acompanhante.id_usuario_titular == current_user.id,
            Acompanhante.status == "autorizado",
        )
    )

    resultados = sessao.execute(stmt).all()

    return [
        {
            "id": str(row.id_usuario_acompanhante),
            "usuario": row.nome,
            "data_convite": row.dh_criacao,
            "pode_editar": row.ic_pode_editar,
            "data_aceite": row.dh_aceite,
        }
        for row in resultados
    ]
