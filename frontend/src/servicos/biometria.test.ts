import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from '@simplewebauthn/browser';
import { requisicao, salvarToken } from './api';
import {
  ativarBiometria,
  biometriaAtivaNesteAparelho,
  entrarComBiometria,
  jaPerguntouBiometria,
  marcarBiometriaPerguntada,
  mensagemErroBiometria,
  pedirDesafioBiometria,
  telefoneDaBiometria,
} from './biometria';

vi.mock('@simplewebauthn/browser', async (original) => ({
  ...(await original<typeof import('@simplewebauthn/browser')>()),
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));

vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  requisicao: vi.fn(),
  salvarToken: vi.fn(),
}));

const DESAFIO = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
const ID_USUARIO = '0b6f3c3e-8d1a-4c55-9f0e-2a7b9d1c4e21';

const tokenDe = (sub: string): string =>
  `x.${btoa(JSON.stringify({ sub }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}.y`;

const erroComNome = (name: string): Error => {
  const erro = new Error(name);
  erro.name = name;
  return erro;
};

/** Corpo JSON enviado na chamada n da API. */
const corpoEnviado = (n: number): unknown =>
  JSON.parse(vi.mocked(requisicao).mock.calls[n][1]?.body as string);

describe('serviço de biometria (RF02)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('começa sem a digital ativada neste aparelho', () => {
    expect(biometriaAtivaNesteAparelho()).toBe(false);
    expect(telefoneDaBiometria()).toBeNull();
  });

  it('lembra por celular que já perguntou sobre a digital', () => {
    marcarBiometriaPerguntada('(61) 98888-7777');
    expect(jaPerguntouBiometria('61988887777')).toBe(true);

    // Outra pessoa no mesmo aparelho ainda recebe a pergunta
    expect(jaPerguntouBiometria('(61) 97777-6666')).toBe(false);
  });

  it('pede o desafio pelo celular, só com os números', async () => {
    vi.mocked(requisicao).mockResolvedValue({ desafio: DESAFIO });

    await expect(pedirDesafioBiometria('(61) 98888-7777')).resolves.toBe(
      DESAFIO
    );
    expect(vi.mocked(requisicao).mock.calls[0][0]).toBe(
      '/api/v1/auth/webauthn/start'
    );
    expect(corpoEnviado(0)).toEqual({ usuario_telefone: '61988887777' });
  });

  it('ativa a digital e manda a chave pública para a API', async () => {
    localStorage.setItem('vero_token', tokenDe(ID_USUARIO));
    vi.mocked(startRegistration).mockResolvedValue({
      id: 'cred-123',
      rawId: 'cred-123',
      type: 'public-key',
      clientExtensionResults: {},
      response: {
        clientDataJSON: 'x',
        attestationObject: 'y',
        publicKey: 'chave-publica',
      },
    });
    vi.mocked(requisicao).mockResolvedValue({
      sucesso: true,
      mensagem: 'Registro biométrico concluído.',
    });

    await expect(ativarBiometria(DESAFIO, '(61) 98888-7777')).resolves.toMatch(
      /pronto!/i
    );

    const opcoes = vi.mocked(startRegistration).mock.calls[0][0];
    expect(opcoes.challenge).toBe(DESAFIO);
    expect(opcoes.authenticatorSelection?.userVerification).toBe('required');
    expect(vi.mocked(requisicao).mock.calls[0][0]).toBe(
      '/api/v1/auth/webauthn/finish'
    );
    expect(corpoEnviado(0)).toEqual({
      id_usuario_acompanhante: ID_USUARIO,
      credential_public_key: 'chave-publica',
      credential_id: 'cred-123',
      quantidade: 0,
    });
    expect(biometriaAtivaNesteAparelho()).toBe(true);
    expect(telefoneDaBiometria()).toBe('61988887777');
  });

  it('não ativa sem a pessoa estar logada', async () => {
    await expect(ativarBiometria(DESAFIO, '61988887777')).rejects.toThrow(
      /PIN/
    );
    expect(startRegistration).not.toHaveBeenCalled();
  });

  it('entra com a digital e guarda o token quando a API entrega um', async () => {
    localStorage.setItem('vero_biometria_ativa', 'true');
    localStorage.setItem('vero_biometria_credencial', 'cred-123');
    localStorage.setItem('vero_biometria_telefone', '61988887777');
    vi.mocked(requisicao)
      .mockResolvedValueOnce({ desafio: DESAFIO })
      .mockResolvedValueOnce({
        sucesso: true,
        mensagem: 'Acesso com biometria liberado',
        access_token: 'token-novo',
      });

    const resultado = await entrarComBiometria();

    expect(resultado.entrou).toBe(true);
    expect(salvarToken).toHaveBeenCalledWith('token-novo');
    const opcoes = vi.mocked(startAuthentication).mock.calls[0][0];
    expect(opcoes.challenge).toBe(DESAFIO);
    expect(opcoes.allowCredentials?.[0].id).toBe('cred-123');
    expect(vi.mocked(requisicao).mock.calls[1][0]).toBe(
      '/api/v1/auth/webauthn/login'
    );
    expect(corpoEnviado(1)).toEqual({ usuario_telefone: '61988887777' });
  });

  it('pede o PIN quando a API libera mas não manda o token', async () => {
    vi.mocked(requisicao)
      .mockResolvedValueOnce({ desafio: DESAFIO })
      .mockResolvedValueOnce({
        sucesso: true,
        mensagem: 'Acesso com biometria liberado',
      });

    const resultado = await entrarComBiometria('(61) 98888-7777');

    expect(resultado).toEqual({
      entrou: false,
      mensagem: expect.stringMatching(/digite seu PIN/),
    });
    expect(salvarToken).not.toHaveBeenCalled();
  });

  it('mostra o motivo quando a API recusa a digital', async () => {
    vi.mocked(requisicao)
      .mockResolvedValueOnce({ desafio: DESAFIO })
      .mockResolvedValueOnce({
        sucesso: false,
        mensagem: 'Nenhuma credencial biométrica registrada.',
      });

    await expect(entrarComBiometria('61988887777')).rejects.toThrow(
      /nenhuma credencial/i
    );
  });

  it('pede o celular quando não sabe de quem é a digital', async () => {
    await expect(entrarComBiometria()).rejects.toThrow(/celular/);
    expect(requisicao).not.toHaveBeenCalled();
  });

  it('explica em palavras simples quando a pessoa cancela', () => {
    expect(mensagemErroBiometria(erroComNome('NotAllowedError'))).toMatch(
      /não foi confirmada/
    );
  });

  it('avisa quando a digital já está ativada neste aparelho', () => {
    const erro = new WebAuthnError({
      message: 'já existe',
      code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
      cause: erroComNome('InvalidStateError'),
    });
    expect(mensagemErroBiometria(erro)).toMatch(/já está ativada/);
  });

  it('sugere o PIN quando o endereço não permite biometria', () => {
    expect(mensagemErroBiometria(erroComNome('SecurityError'))).toMatch(/PIN/);
  });

  it('tem uma mensagem para qualquer outro erro', () => {
    expect(mensagemErroBiometria('???')).toMatch(/PIN/);
  });
});
