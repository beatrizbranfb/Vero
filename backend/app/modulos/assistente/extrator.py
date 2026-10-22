import re
import unicodedata
from dataclasses import dataclass
from enum import Enum
from rapidfuzz import process,fuzz

class TipoTransacao(str, Enum):
    GASTO = "GASTO"
    RECEITA = "RECEITA"
    DESCONHECIDO = "DESCONHECIDO"

@dataclass
class IntencaoMensagem:
    tipo: TipoTransacao
    # Valor em centavos
    valor: int | None
    categoria: str
    descricao: str
    sucesso: bool

CATEGORIAS: dict[str, list[str]] = {
    # Gastos
    "Farmácia": ["farmacia", "remedio", "drogaria", "medicamento", "dipirona", "pomada"],
    "Alimentação": ["mercado", "supermercado", "padaria", "comida", "feira", "acougue", "almoco", "jantar", "pao", "leite"],
    "Transporte": ["uber", "taxi", "onibus", "gasolina", "combustivel", "passagem", "metro"],
    "Saúde": ["medico", "consulta", "exame", "dentista", "hospital", "clinica", "fisioterapia"],
    "Moradia": ["aluguel", "condominio", "luz", "agua", "gas", "energia", "internet"],
    "Lazer": ["passeio", "viagem", "cinema", "restaurante", "bar", "presente"],

    # Receitas
    "Aposentadoria": ["aposentadoria", "inss", "beneficio"],
    "Salário": ["salario", "pagamento", "vale", "adiantamento"],
    "Renda Extra": ["bico", "venda", "freela", "renda", "reembolso", "pix"],
}

VERBOS_RECEITA = ["recebi", "caiu", "ganhei", "entrou", "recebimento", "deposito", "receber"]
VERBOS_GASTO = ["gastei", "comprei", "paguei", "foi", "deu", "custou", "pagamento", "gasto", "comprar"]

def normalizar_texto(texto: str) -> str:
    texto = texto.lower()
    return "".join(
        c for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )

# Retorna em centavos.
def extrair_valor(texto: str) -> int | None:
    padrao = r'(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)'
    matches = re.finditer(padrao, texto.lower())

    for match in matches:
        num_str = match.group(1)
        if not num_str:
            continue
        try:
            if "." in num_str and "," in num_str:
                num_str = num_str.replace(".", "").replace(",", ".")
            elif "," in num_str:
                num_str = num_str.replace(",", ".")
            elif "." in num_str and len(num_str.split(".")[1]) == 3:
                num_str = num_str.replace(".", "")

            valor_float = float(num_str)
            if valor_float > 0:
                return int(round(valor_float * 100))
        except ValueError:
            continue
    
    return None

def identificar_categoria(texto_normalizado: str, tipo: TipoTransacao) -> str:
    todas_palavras = texto_normalizado.split()
    melhor_score = 0.0
    melhor_categoria = "Outros" if tipo == TipoTransacao.GASTO else "Outras Receitas"
    for categoria, sinonimos in CATEGORIAS.items():
        for palavra in todas_palavras:
            if len(palavra) < 3:
                continue
            
            resultado = process.extractOne(
                palavra, 
                sinonimos, 
                scorer=fuzz.ratio, 
                score_cutoff=75.0  # Limiar de confiança de 75%
            )

            if resultado:
                _, score, _ = resultado
                if score > melhor_score:
                    melhor_score = score
                    melhor_categoria = categoria

    return melhor_categoria

def processar_texto_mensagem(texto: str) -> IntencaoMensagem:
    texto_norm = normalizar_texto(texto)
    valor = extrair_valor(texto)
    
    tipo = TipoTransacao.DESCONHECIDO
    
   
    bool_receita = any(termo in texto_norm for termo in VERBOS_RECEITA)
    bool_gasto = any(termo in texto_norm for termo in VERBOS_GASTO)

    if bool_receita and not bool_gasto:
        tipo = TipoTransacao.RECEITA
    elif bool_gasto:
        tipo = TipoTransacao.GASTO
    elif "aposentadoria" in texto_norm or "salario" in texto_norm:
        tipo = TipoTransacao.RECEITA
    elif valor is not None:
        tipo = TipoTransacao.GASTO
    
    categoria = identificar_categoria(texto_norm, tipo)
    sucesso = (valor is not None) and (tipo != TipoTransacao.DESCONHECIDO)
    return IntencaoMensagem(
        tipo=tipo,
        valor=valor,
        categoria=categoria,
        descricao=texto.strip(),
        sucesso=sucesso
    )
    