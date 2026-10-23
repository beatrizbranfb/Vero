def formatar_moeda(centavos: int) -> str:
    reais = centavos / 100
    return f"R$ {reais:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def confirmacao_gasto(valor_centavos: int, categoria: str) -> str:
    valor = formatar_moeda(valor_centavos)
    return (
        f"Entendi! Você gastou {valor} com {categoria}.\n\n"
        f"Posso anotar esse gasto? (Responda com *Sim* ou *Não*)"
    )

def confirmacao_sucesso_gasto(valor_centavos: int, categoria: str) -> str:
    valor = formatar_moeda(valor_centavos)
    return f"Anotado! Já registrei o seu gasto de {valor} com {categoria}."

def confirmacao_renda(valor_centavos: int, categoria: str) -> str:
    valor = formatar_moeda(valor_centavos)
    return (
        f"Entendi! Você recebeu {valor} de {categoria}.\n\n"
        f"Posso anotar esse rendimento? (Responda com *Sim* ou *Não*)"
    )

def confirmacao_sucesso_renda(valor_centavos: int, categoria: str) -> str:
    valor = formatar_moeda(valor_centavos)
    return f"Anotado! Já registrei a sua entrada de {valor} de {categoria}."

def usuario_nao_encontrado() -> str:
    return (
        "Olá! Não encontrei o seu número cadastrado no Vero.\n\n"
        "Para começar a usar e cuidar do seu dinheiro, por favor, faça seu cadastro no nosso aplicativo."
    )

def mensagem_nao_compreendida() -> str:
    return (
        "Desculpe, não consegui entender bem o valor ou o que foi gasto.\n\n"
        "Você pode me mandar uma mensagem como:\n"
        "👉 *Gastei 35 na farmácia*\n"
        "👉 *Recebi 1500 da aposentadoria*"
    )

def registro_cancelado() -> str:
    return "Tudo bem, não anotei nada. Quando quiser registrar, é só me mandar!"

def confirmacao_expirada() -> str:
    return (
        "Como passei um tempinho sem resposta, acabei não anotando aquele valor por segurança.\n\n"
        "Se quiser registrar, pode me mandar novamente!"
    )