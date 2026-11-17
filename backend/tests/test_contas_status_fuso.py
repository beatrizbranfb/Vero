"""Situação da conta na virada do dia, no fuso de Brasília (RF32, critério 3).

O servidor roda em UTC. Entre 21h e 23h59 em Brasília já é o dia seguinte em UTC,
e a conta que vence "hoje" não pode aparecer como atrasada nesse intervalo.
"""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.modulos.contas import modelos
from app.modulos.contas.esquemas import StatusConta
from app.modulos.contas.modelos import Conta


def _congelar_relogio(monkeypatch: pytest.MonkeyPatch, agora_utc: datetime) -> None:
    class RelogioParado(datetime):
        @classmethod
        def now(cls, tz=None):  # noqa: ANN001, ANN206
            return agora_utc.astimezone(tz) if tz else agora_utc.replace(tzinfo=None)

    monkeypatch.setattr(modelos, "datetime", RelogioParado)


def _status(vencimento: date) -> StatusConta:
    return Conta(vencimento_em=vencimento, pagamento_em=None).status


@pytest.mark.parametrize(
    ("agora_utc", "esperado"),
    [
        # 10/03 às 22h em Brasília = 11/03 à 1h em UTC: ainda é o dia do vencimento
        (datetime(2026, 3, 11, 1, 0, tzinfo=UTC), StatusConta.A_VENCER),
        # 10/03 às 23h59 em Brasília
        (datetime(2026, 3, 11, 2, 59, tzinfo=UTC), StatusConta.A_VENCER),
        # 11/03 à 0h em Brasília: venceu ontem
        (datetime(2026, 3, 11, 3, 0, tzinfo=UTC), StatusConta.EM_ATRASO),
        # 10/03 à 0h em Brasília = 10/03 às 3h em UTC
        (datetime(2026, 3, 10, 3, 0, tzinfo=UTC), StatusConta.A_VENCER),
    ],
)
def test_conta_que_vence_hoje_na_virada_do_dia(
    monkeypatch: pytest.MonkeyPatch, agora_utc: datetime, esperado: StatusConta
) -> None:
    _congelar_relogio(monkeypatch, agora_utc)

    assert _status(date(2026, 3, 10)) == esperado


def test_conta_de_ontem_fica_em_atraso_logo_depois_da_meia_noite(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 11/03 às 0h01 em Brasília
    _congelar_relogio(monkeypatch, datetime(2026, 3, 11, 3, 1, tzinfo=UTC))

    assert _status(date(2026, 3, 10)) == StatusConta.EM_ATRASO
    assert _status(date(2026, 3, 11)) == StatusConta.A_VENCER


def test_conta_paga_nunca_fica_em_atraso(monkeypatch: pytest.MonkeyPatch) -> None:
    _congelar_relogio(monkeypatch, datetime(2026, 3, 20, 12, 0, tzinfo=UTC))
    conta = Conta(
        vencimento_em=date(2026, 3, 1),
        pagamento_em=datetime(2026, 3, 2, tzinfo=UTC) - timedelta(hours=1),
    )

    assert conta.status == StatusConta.PAGA
