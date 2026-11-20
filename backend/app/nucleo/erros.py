"""Respostas de erro no formato Problem Details (RFC 9457), conforme D10."""

from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

MSG_DADOS_INVALIDOS = "Alguns dados não estão certos. Confira e tente de novo."


def problema(
    status: int, detalhe: str, headers: dict[str, str] | None = None, **extras: object
) -> JSONResponse:
    corpo = {
        "type": "about:blank",
        "title": HTTPStatus(status).phrase,
        "status": status,
        "detail": detalhe,
        **extras,
    }
    return JSONResponse(
        corpo,
        status_code=status,
        headers=headers,
        media_type="application/problem+json",
    )


async def tratar_http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return problema(exc.status_code, str(exc.detail), headers=exc.headers)


async def tratar_validacao(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    erros = [
        {
            "campo": str(erro["loc"][-1]),
            "mensagem": erro["msg"].removeprefix("Value error, "),
        }
        for erro in exc.errors()
    ]
    return problema(422, MSG_DADOS_INVALIDOS, erros=erros)


def registrar_tratadores(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, tratar_http)
    app.add_exception_handler(RequestValidationError, tratar_validacao)
