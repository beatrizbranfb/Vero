/**
 * Utilitário para leitura e interpretação de QR Codes de NFC-e (Nota Fiscal de Consumidor Eletrônica).
 */

export interface DadosNfce {
  valido: boolean;
  chaveAcesso?: string;
  uf?: string;
  estabelecimento: string;
  cnpj?: string;
  data: string; // YYYY-MM-DD
  centavos: number | null;
  urlOriginal: string;
  aviso?: string;
}

const CODIGOS_UF: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
};

export function formatarCnpj(cnpj: string): string {
  const limpo = cnpj.replace(/\D/g, '');
  if (limpo.length !== 14) return limpo;
  return limpo.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

function decodificarHexParaTexto(hex: string): string {
  try {
    if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
      return hex;
    }
    const bytes = new Uint8Array(
      hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return hex;
  }
}

function extrairDataDeTexto(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const decodificado = decodificarHexParaTexto(bruto.trim());
  const matchIso = decodificado.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
  }
  const matchBr = decodificado.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (matchBr) {
    return `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}`;
  }
  return null;
}

function extrairCentavos(
  bruto: string | number | null | undefined
): number | null {
  if (bruto === null || bruto === undefined || bruto === '') return null;
  if (typeof bruto === 'number') {
    return Number.isFinite(bruto) && bruto > 0 ? Math.round(bruto * 100) : null;
  }
  const limpo = bruto.trim().replace(',', '.');
  const num = Number(limpo);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function dataPadraoHoje(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function extrairDadosDaChave44(chave: string): {
  uf: string;
  cnpj: string;
  dataEstimada: string;
} {
  const codUf = chave.slice(0, 2);
  const uf = CODIGOS_UF[codUf] || 'BR';
  const ano = `20${chave.slice(2, 4)}`;
  const mes = chave.slice(4, 6);
  const cnpj = formatarCnpj(chave.slice(6, 20));

  const hoje = new Date();
  const anoAtual = String(hoje.getFullYear());
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia =
    ano === anoAtual && mes === mesAtual
      ? String(hoje.getDate()).padStart(2, '0')
      : '01';

  const mesValido = Number(mes) >= 1 && Number(mes) <= 12 ? mes : mesAtual;

  return {
    uf,
    cnpj,
    dataEstimada: `${ano}-${mesValido}-${dia}`,
  };
}

/**
 * Interpreta o conteúdo lido de um QR Code de nota fiscal (NFC-e v1, v2 ou JSON de teste).
 */
export function parsearQrCodeNfce(textoBruto: string): DadosNfce {
  const texto = textoBruto.trim();
  const hojeStr = dataPadraoHoje();

  if (!texto) {
    return {
      valido: false,
      estabelecimento: '',
      data: hojeStr,
      centavos: null,
      urlOriginal: texto,
    };
  }

  // 1. Suporte a payload JSON simplificado (útil para testes e integrações diretas)
  if (texto.startsWith('{') && texto.endsWith('}')) {
    try {
      const obj = JSON.parse(texto) as Record<string, unknown>;
      const centavos = extrairCentavos(
        (obj.valor as string | number | undefined) ??
          (obj.vNF as string | number | undefined)
      );
      const nome =
        typeof obj.estabelecimento === 'string'
          ? obj.estabelecimento.trim()
          : typeof obj.xNome === 'string'
            ? obj.xNome.trim()
            : '';
      const data =
        extrairDataDeTexto(
          typeof obj.data === 'string' ? obj.data : undefined
        ) || hojeStr;

      if (nome || centavos) {
        return {
          valido: true,
          estabelecimento: nome || 'Estabelecimento identificado',
          data,
          centavos,
          urlOriginal: texto,
        };
      }
    } catch {
      // Segue para tentativa de URL
    }
  }

  // 2. Tentativa de leitura como URL de SEFAZ (NFC-e v1.0 ou v2.0)
  let url: URL | null = null;
  try {
    url = new URL(texto);
  } catch {
    url = null;
  }

  if (url) {
    const params = url.searchParams;
    const parametroP = params.get('p');

    // Layout 2.0: ?p=CHAVE44|VERSAO|AMBIENTE|...
    if (parametroP) {
      const partes = parametroP.split('|');
      const possivelChave = (partes[0] || '').replace(/\D/g, '');

      if (possivelChave.length === 44) {
        const { uf, cnpj, dataEstimada } = extrairDadosDaChave44(possivelChave);
        const valorExtra = extrairCentavos(
          params.get('vNF') || params.get('valor')
        );
        const nomeExtra =
          params.get('estabelecimento') || params.get('xNome') || '';
        const dataExtra = extrairDataDeTexto(params.get('dhEmi'));

        return {
          valido: true,
          chaveAcesso: possivelChave,
          uf,
          cnpj,
          estabelecimento: nomeExtra.trim() || `Compra (${uf}) · CNPJ ${cnpj}`,
          data: dataExtra || dataEstimada,
          centavos: valorExtra,
          urlOriginal: texto,
          aviso:
            valorExtra === null
              ? 'QR Code da nota lido! A SEFAZ do estado não envia o valor dentro do código — digite ou confira o valor total abaixo.'
              : undefined,
        };
      }
    }

    // Layout 1.0: ?chNFe=CHAVE44&...&dhEmi=...&vNF=123.45
    const chNFe = (params.get('chNFe') || '').replace(/\D/g, '');
    const vNF = extrairCentavos(params.get('vNF') || params.get('valor'));
    const dhEmi = extrairDataDeTexto(params.get('dhEmi') || params.get('data'));
    const xNome = (
      params.get('xNome') ||
      params.get('estabelecimento') ||
      ''
    ).trim();

    if (chNFe.length === 44) {
      const { uf, cnpj, dataEstimada } = extrairDadosDaChave44(chNFe);
      return {
        valido: true,
        chaveAcesso: chNFe,
        uf,
        cnpj,
        estabelecimento: xNome || `Compra (${uf}) · CNPJ ${cnpj}`,
        data: dhEmi || dataEstimada,
        centavos: vNF,
        urlOriginal: texto,
        aviso:
          vNF === null
            ? 'Nota fiscal identificada, mas o valor total não veio no código. Informe o valor abaixo.'
            : undefined,
      };
    }

    // Fallback para URL da SEFAZ/Fazenda que contenha 44 dígitos na string
    const ehSefaz = /fazenda|sefaz|nfce|nfe|sat/i.test(
      url.hostname + url.pathname
    );
    const matchChave = texto.match(/\d{44}/);
    if (ehSefaz && matchChave) {
      const { uf, cnpj, dataEstimada } = extrairDadosDaChave44(matchChave[0]);
      return {
        valido: true,
        chaveAcesso: matchChave[0],
        uf,
        cnpj,
        estabelecimento: xNome || `Compra (${uf}) · CNPJ ${cnpj}`,
        data: dhEmi || dataEstimada,
        centavos: vNF,
        urlOriginal: texto,
        aviso:
          vNF === null
            ? 'Nota fiscal identificada, mas não foi possível consultar o valor automático na SEFAZ. Digite o valor total abaixo.'
            : undefined,
      };
    }
  }

  // 3. Chave de acesso pura de 44 dígitos (código de barras/QR numérico)
  const apenasDigitos = texto.replace(/\D/g, '');
  if (apenasDigitos.length === 44 && texto.length <= 54) {
    const { uf, cnpj, dataEstimada } = extrairDadosDaChave44(apenasDigitos);
    return {
      valido: true,
      chaveAcesso: apenasDigitos,
      uf,
      cnpj,
      estabelecimento: `Compra (${uf}) · CNPJ ${cnpj}`,
      data: dataEstimada,
      centavos: null,
      urlOriginal: texto,
      aviso:
        'Chave da nota fiscal identificada! Informe o valor total abaixo para concluir.',
    };
  }

  return {
    valido: false,
    estabelecimento: '',
    data: hojeStr,
    centavos: null,
    urlOriginal: texto,
  };
}

/**
 * Sugere uma categoria de gasto do Vero com base no nome do estabelecimento.
 */
export function sugerirCategoriaPorEstabelecimento(nome: string): string {
  const n = nome.toLowerCase();
  if (
    n.includes('mercado') ||
    n.includes('super') ||
    n.includes('atacad') ||
    n.includes('padaria') ||
    n.includes('horti') ||
    n.includes('açougue') ||
    n.includes('acougue') ||
    n.includes('mercearia')
  ) {
    return 'mercado';
  }
  if (
    n.includes('farm') ||
    n.includes('drog') ||
    n.includes('saude') ||
    n.includes('saúde') ||
    n.includes('medic')
  ) {
    return 'farmacia';
  }
  if (
    n.includes('posto') ||
    n.includes('combust') ||
    n.includes('uber') ||
    n.includes('transport') ||
    n.includes('estaciona')
  ) {
    return 'transporte';
  }
  if (
    n.includes('casa') ||
    n.includes('constru') ||
    n.includes('material') ||
    n.includes('moveis') ||
    n.includes('móveis')
  ) {
    return 'casa';
  }
  return 'mercado';
}
