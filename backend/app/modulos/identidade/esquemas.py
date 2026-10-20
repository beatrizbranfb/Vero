import re
import uuid
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, StringConstraints

from app.modulos.identidade import mensagens


def normalizar_telefone(valor: str) -> str:
    """Guarda o celular só com dígitos, com o código do país (ex.: 5561999998888)."""
    digitos = re.sub(r"\D", "", valor)
    if len(digitos) in (10, 11):
        digitos = "55" + digitos
    if not (len(digitos) in (12, 13) and digitos.startswith("55")):
        raise ValueError(mensagens.TELEFONE_INVALIDO)
    return digitos


def validar_pin(valor: str) -> str:
    if not re.fullmatch(r"\d{4,6}", valor):
        raise ValueError(mensagens.PIN_INVALIDO)
    return valor


def validar_senha(valor: str) -> str:
    if len(valor) < 8:
        raise ValueError(mensagens.SENHA_CURTA)
    # O bcrypt só aceita até 72 bytes
    if len(valor.encode()) > 72:
        raise ValueError(mensagens.SENHA_LONGA)
    return valor


Telefone = Annotated[str, AfterValidator(normalizar_telefone)]
Pin = Annotated[str, AfterValidator(validar_pin)]
Senha = Annotated[str, AfterValidator(validar_senha)]
Nome = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]


class CadastroEntrada(BaseModel):
    nome: Nome
    telefone: Telefone
    email: EmailStr
    senha: Senha


class LoginSenhaEntrada(BaseModel):
    telefone: Telefone
    senha: str


class LoginPinEntrada(BaseModel):
    telefone: Telefone
    pin: str


class DefinirPinEntrada(BaseModel):
    pin: Pin


class UsuarioSaida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nome: str
    telefone: str
    email: str
    tem_pin: bool


class TokenSaida(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expira_em: int
