/**
 * Entrar com digital ou rosto (RF02 / US31), pelo padrão WebAuthn (passkeys).
 *
 * Quem confere a digital é o próprio celular: o Vero nunca recebe a digital nem o
 * rosto, só a chave pública do aparelho (RNF05). O PIN continua valendo sempre.
 *
 * Rotas da API: /api/v1/auth/webauthn/start, /finish e /login.
 */

import {
  browserSupportsWebAuthn,
  bufferToBase64URLString,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from '@simplewebauthn/browser';
import { extrairDigitos } from '../utils/telefone';
import { ErroApi, requisicao, salvarToken } from './api';
import { idUsuarioLogado } from './tourAudio';

/** Este aparelho já tem a digital ativada (mostra o botão na tela de Entrar). */
const CHAVE_ATIVA = 'vero_biometria_ativa';
/** Id da chave criada neste aparelho, para o celular ir direto a ela. */
const CHAVE_CREDENCIAL = 'vero_biometria_credencial';
/** Celular de quem ativou a digital neste aparelho (a API entra pelo celular). */
const CHAVE_TELEFONE = 'vero_biometria_telefone';
/** Já perguntamos a este celular, neste aparelho, se quer usar a digital. */
const PREFIXO_PERGUNTADA = 'vero_biometria_perguntada';

/** Tempo para a pessoa encostar o dedo ou olhar para o celular. */
const TEMPO_LIMITE = 60_000;

interface RespostaWebauthn {
  sucesso: boolean;
  mensagem: string;
  /** Token de sessão, quando a API passar a entregar um no login com digital. */
  access_token?: string;
}

export interface ResultadoBiometria {
  /** A pessoa já está dentro do Vero. */
  entrou: boolean;
  mensagem: string;
}

const lerLocal = (chave: string): string | null => {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
};

const gravarLocal = (chave: string, valor: string): void => {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    // Navegador sem armazenamento: só deixa de lembrar
  }
};

/** O aparelho tem leitor de digital ou de rosto que o navegador consegue usar. */
export const biometriaDisponivel = async (): Promise<boolean> => {
  if (!browserSupportsWebAuthn()) return false;
  try {
    return await platformAuthenticatorIsAvailable();
  } catch {
    return false;
  }
};

export const biometriaAtivaNesteAparelho = (): boolean =>
  lerLocal(CHAVE_ATIVA) === 'true';

/** Celular de quem ativou a digital neste aparelho, já formatável. */
export const telefoneDaBiometria = (): string | null =>
  lerLocal(CHAVE_TELEFONE);

const chavePerguntada = (telefone: string): string =>
  `${PREFIXO_PERGUNTADA}:${extrairDigitos(telefone)}`;

export const jaPerguntouBiometria = (telefone: string): boolean =>
  lerLocal(chavePerguntada(telefone)) === 'true';

export const marcarBiometriaPerguntada = (telefone: string): void =>
  gravarLocal(chavePerguntada(telefone), 'true');

/**
 * Pede à API um desafio para o celular assinar.
 *
 * Na tela de Entrar, isto acontece antes do PIN: a API renova a versão do token
 * ao gerar o desafio, e um token emitido antes dele deixaria de valer.
 */
export const pedirDesafioBiometria = async (
  telefone: string
): Promise<string> => {
  const { desafio } = await requisicao<{ desafio: string }>(
    '/api/v1/auth/webauthn/start',
    {
      method: 'POST',
      body: JSON.stringify({ usuario_telefone: extrairDigitos(telefone) }),
    }
  );
  return desafio;
};

const conferirResposta = (resposta: RespostaWebauthn): void => {
  // A API responde 200 também quando recusa; o motivo vem na mensagem
  if (!resposta.sucesso) throw new ErroApi(400, resposta.mensagem);
};

/**
 * Cria a chave no celular (pede a digital) e guarda a chave pública no Vero.
 * Precisa da pessoa já logada com o PIN e de um desafio da API.
 */
export const ativarBiometria = async (
  desafio: string,
  telefone: string
): Promise<string> => {
  const idUsuario = idUsuarioLogado();
  if (!idUsuario) {
    throw new ErroApi(401, 'Entre com o PIN antes de ativar a digital.');
  }
  const digitos = extrairDigitos(telefone);

  const credencial = await startRegistration({
    // O desafio vem em hexadecimal, que já é base64url válido
    challenge: desafio,
    rp: { id: window.location.hostname, name: 'Vero' },
    user: {
      id: bufferToBase64URLString(new TextEncoder().encode(idUsuario).buffer),
      name: digitos,
      displayName: telefone,
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 }, // ES256
      { type: 'public-key', alg: -257 }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
    attestation: 'none',
    timeout: TEMPO_LIMITE,
  });

  const chavePublica = credencial.response.publicKey;
  if (!chavePublica) {
    throw new ErroApi(
      400,
      'Este navegador não entregou a chave da digital. Continue com o PIN.'
    );
  }

  const resposta = await requisicao<RespostaWebauthn>(
    '/api/v1/auth/webauthn/finish',
    {
      method: 'POST',
      body: JSON.stringify({
        id_usuario_acompanhante: idUsuario,
        credential_public_key: chavePublica,
        credential_id: credencial.id,
        // Chave nova: nenhuma assinatura feita ainda
        quantidade: 0,
      }),
    }
  );
  conferirResposta(resposta);

  gravarLocal(CHAVE_ATIVA, 'true');
  gravarLocal(CHAVE_CREDENCIAL, credencial.id);
  gravarLocal(CHAVE_TELEFONE, digitos);
  return 'Pronto! Da próxima vez, você pode entrar com sua digital.';
};

/**
 * Entra com a digital: o celular confere a digital e a API libera o acesso.
 * Sem celular digitado, usa o de quem ativou a digital neste aparelho.
 */
export const entrarComBiometria = async (
  telefone?: string
): Promise<ResultadoBiometria> => {
  const digitos = telefone
    ? extrairDigitos(telefone)
    : (telefoneDaBiometria() ?? '');
  if (!digitos) {
    throw new ErroApi(400, 'Digite seu celular para entrar com a digital.');
  }

  const desafio = await pedirDesafioBiometria(digitos);
  const idCredencial = lerLocal(CHAVE_CREDENCIAL);
  await startAuthentication({
    challenge: desafio,
    rpId: window.location.hostname,
    allowCredentials: idCredencial
      ? [{ id: idCredencial, type: 'public-key', transports: ['internal'] }]
      : [],
    userVerification: 'required',
    timeout: TEMPO_LIMITE,
  });

  const resposta = await requisicao<RespostaWebauthn>(
    '/api/v1/auth/webauthn/login',
    {
      method: 'POST',
      body: JSON.stringify({ usuario_telefone: digitos }),
    }
  );
  conferirResposta(resposta);

  if (resposta.access_token) {
    salvarToken(resposta.access_token);
    return { entrou: true, mensagem: resposta.mensagem };
  }
  // A API confirmou a digital, mas ainda não abre a sessão sozinha
  return {
    entrou: false,
    mensagem: 'Digital confirmada. Para terminar de entrar, digite seu PIN.',
  };
};

/**
 * Mensagem simples para os erros do próprio aparelho (RNF02). Erros da API já
 * chegam com o texto pronto e não passam por aqui.
 */
export const mensagemErroBiometria = (erro: unknown): string => {
  const nome = erro instanceof Error ? erro.name : '';
  const codigo = erro instanceof WebAuthnError ? erro.code : '';
  if (
    codigo === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' ||
    nome === 'InvalidStateError'
  ) {
    return 'A digital já está ativada neste aparelho.';
  }
  if (nome === 'NotAllowedError' || codigo === 'ERROR_CEREMONY_ABORTED') {
    return 'A digital não foi confirmada. Tente de novo ou entre com o PIN.';
  }
  if (nome === 'SecurityError') {
    return 'Este endereço do Vero não permite usar a digital. Entre com o PIN.';
  }
  return 'Não foi possível usar a digital agora. Entre com o PIN.';
};
