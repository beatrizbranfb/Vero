from enum import Enum


class Message(Enum):
    """Textos mostrados ao usuário, em linguagem simples (RNF02)."""

    VALOR_INVALIDO = "O valor da conta precisa ser maior que zero."
    VALOR_MUITO_ALTO = "O valor da conta é muito alto. Confira e tente novamente."
    DATA_INVALIDA = (
        "A data de vencimento não está correta, verifique e tente novamente."
    )
    CATEGORIA_INEXISTENTE = "Essa categoria não existe. Escolha outra."

    def __init__(self, message: str):
        self.message = message
