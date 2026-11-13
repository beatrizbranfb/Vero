import { describe, it, expect } from 'vitest';
import {
  parsearQrCodeNfce,
  sugerirCategoriaPorEstabelecimento,
  formatarCnpj,
} from './nfce';

describe('Utilitário NFC-e (QR Code de Nota Fiscal)', () => {
  it('formata CNPJ de 14 dígitos corretamente', () => {
    expect(formatarCnpj('12345678000199')).toBe('12.345.678/0001-99');
  });

  it('interpreta URL NFC-e v2.0 extraindo chave, UF, CNPJ e data', () => {
    const url =
      'https://www.fazenda.df.gov.br/nfce/qrcode?p=53261112345678000199650010000123451123456789|2|1|1|ABCDEF';
    const res = parsearQrCodeNfce(url);

    expect(res.valido).toBe(true);
    expect(res.uf).toBe('DF');
    expect(res.cnpj).toBe('12.345.678/0001-99');
    expect(res.chaveAcesso).toBe(
      '53261112345678000199650010000123451123456789'
    );
    expect(res.data.startsWith('2026-11-')).toBe(true);
    expect(res.centavos).toBeNull();
    expect(res.aviso).toBeTruthy();
  });

  it('interpreta URL NFC-e v1.0 extraindo valor total e data em hex', () => {
    // '2026-11-10' em hex = 323032362d31312d3130
    const url =
      'https://nfce.fazenda.sp.gov.br/consulta?chNFe=35261198765432000111650010000123451123456789&nVersao=100&tpAmb=1&dhEmi=323032362d31312d3130&vNF=142.90';
    const res = parsearQrCodeNfce(url);

    expect(res.valido).toBe(true);
    expect(res.uf).toBe('SP');
    expect(res.cnpj).toBe('98.765.432/0001-11');
    expect(res.data).toBe('2026-11-10');
    expect(res.centavos).toBe(14290);
    expect(res.aviso).toBeUndefined();
  });

  it('interpreta payload JSON de nota fiscal para testes/integrações', () => {
    const json = JSON.stringify({
      estabelecimento: 'Supermercado Atacadão',
      valor: 89.5,
      data: '2026-11-12',
    });
    const res = parsearQrCodeNfce(json);

    expect(res.valido).toBe(true);
    expect(res.estabelecimento).toBe('Supermercado Atacadão');
    expect(res.centavos).toBe(8950);
    expect(res.data).toBe('2026-11-12');
  });

  it('rejeita QR Code que não pertence a uma nota fiscal', () => {
    const res = parsearQrCodeNfce('https://google.com');
    expect(res.valido).toBe(false);
  });

  it('sugere categoria correta pelo nome do estabelecimento', () => {
    expect(sugerirCategoriaPorEstabelecimento('Drogaria São Paulo')).toBe(
      'farmacia'
    );
    expect(sugerirCategoriaPorEstabelecimento('Supermercado Dia')).toBe(
      'mercado'
    );
    expect(sugerirCategoriaPorEstabelecimento('Posto Ipiranga')).toBe(
      'transporte'
    );
  });
});
