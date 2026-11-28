import { useState, useEffect, useRef } from 'react';
import {
  Botao,
  CampoTexto,
  TecladoNumerico,
  AlertaStatus,
  IconDigital,
} from '../../components';
import { useNavegacao } from '../../router';
import {
  ativarBiometria,
  biometriaAtivaNesteAparelho,
  biometriaDisponivel,
  entrarComBiometria,
  entrarComPin,
  ErroApi,
  jaPerguntouBiometria,
  marcarBiometriaPerguntada,
  mensagemErroBiometria,
  pedirDesafioBiometria,
  telefoneDaBiometria,
} from '../../servicos';
import { formatarCelular, validarCelular } from '../../utils/telefone';
import logoVero from '../../assets/logoVero';
import styles from '../Cadastro/Cadastro.module.css';

export const Entrar = () => {
  const { navegar } = useNavegacao();
  // Quem ativou a digital neste aparelho já encontra o próprio celular
  const [celular, setCelular] = useState(() => {
    const salvo = telefoneDaBiometria();
    return salvo ? formatarCelular(salvo) : '(61) 99999-8888';
  });
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const campoCelularRef = useRef<HTMLInputElement>(null);

  // Entrar com digital ou rosto (RF02): o botão só aparece no aparelho que já
  // ativou e tem leitor biométrico
  const [podeBiometria, setPodeBiometria] = useState(false);
  // Depois do PIN, oferece ativar a digital uma vez por pessoa neste aparelho
  const [oferta, setOferta] = useState<'nao' | 'pergunta' | 'ativada'>('nao');
  const [mensagemOferta, setMensagemOferta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Desafio que o celular assina ao ativar a digital
  const desafioRef = useRef<string | null>(null);

  useEffect(() => {
    let ativo = true;
    if (biometriaAtivaNesteAparelho()) {
      biometriaDisponivel().then((disponivel) => {
        if (ativo) setPodeBiometria(disponivel);
      });
    }
    return () => {
      ativo = false;
    };
  }, []);

  const entrarComDigital = async () => {
    setCarregando(true);
    setErro(null);
    setAviso(null);
    try {
      const resultado = await entrarComBiometria(
        validarCelular(celular) ? celular : undefined
      );
      if (resultado.entrou) {
        navegar('/inicio');
      } else {
        setAviso(resultado.mensagem);
      }
    } catch (e) {
      setErro(e instanceof ErroApi ? e.detalhe : mensagemErroBiometria(e));
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Antes do PIN: se vamos oferecer a digital, já pede o desafio. A API renova a
   * versão do token ao gerar o desafio, então ele precisa vir antes do login.
   */
  const desafioParaOferta = async (): Promise<string | null> => {
    const oferecer =
      !biometriaAtivaNesteAparelho() &&
      !jaPerguntouBiometria(celular) &&
      (await biometriaDisponivel());
    if (!oferecer) return null;
    try {
      return await pedirDesafioBiometria(celular);
    } catch {
      // Sem desafio, só não oferece a digital desta vez
      return null;
    }
  };

  const responderOferta = async (aceitou: boolean) => {
    marcarBiometriaPerguntada(celular);
    if (!aceitou) {
      navegar('/inicio');
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      setMensagemOferta(
        await ativarBiometria(desafioRef.current ?? '', celular)
      );
      setOferta('ativada');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.detalhe : mensagemErroBiometria(e));
    } finally {
      setCarregando(false);
    }
  };

  const digitarPin = (digito: string) => {
    if (pin.length < 4 && !carregando) {
      setPin((anterior) => anterior + digito);
      if (erro) setErro(null);
    }
  };

  const apagarPin = () => {
    if (!carregando) {
      setPin((anterior) => anterior.slice(0, -1));
      if (erro) setErro(null);
    }
  };

  const entrar = async () => {
    if (!celular.trim() || !validarCelular(celular)) {
      setErro('Digite um número de celular válido com DDD.');
      return;
    }

    if (pin.length !== 4) {
      setErro('Digite os 4 números do seu PIN.');
      return;
    }

    setCarregando(true);
    setErro(null);
    setAviso(null);

    try {
      const desafio = await desafioParaOferta();
      await entrarComPin(celular, pin);
      // Depois do PIN: pergunta se quer usar a digital, uma vez só
      if (desafio) {
        desafioRef.current = desafio;
        setOferta('pergunta');
      } else {
        navegar('/inicio');
      }
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.detalhe);
      } else {
        setErro(
          'Não foi possível entrar no Vero. Verifique os dados e tente novamente.'
        );
      }
    } finally {
      setCarregando(false);
    }
  };

  // Suporte à digitação pelo teclado físico do computador
  useEffect(() => {
    const tratarTeclaPressionada = (evento: KeyboardEvent) => {
      // Na pergunta da digital não há PIN para digitar
      if (oferta !== 'nao') return;
      // Se o usuário estiver focado no campo de celular, o input nativo cuida da digitação
      const elementoAtivo = document.activeElement;
      const estaNoInputCelular =
        elementoAtivo &&
        elementoAtivo.tagName === 'INPUT' &&
        elementoAtivo !== document.body;

      if (evento.key === 'Enter') {
        evento.preventDefault();
        if (pin.length === 4) {
          entrar();
        } else if (estaNoInputCelular && validarCelular(celular)) {
          // Desfoca do celular para permitir digitar o PIN
          (elementoAtivo as HTMLElement).blur();
        }
        return;
      }

      if (estaNoInputCelular) {
        return;
      }

      if (/^[0-9]$/.test(evento.key)) {
        evento.preventDefault();
        digitarPin(evento.key);
      } else if (evento.key === 'Backspace') {
        evento.preventDefault();
        apagarPin();
      }
    };

    window.addEventListener('keydown', tratarTeclaPressionada);
    return () => window.removeEventListener('keydown', tratarTeclaPressionada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celular, pin, carregando, oferta]);

  if (oferta !== 'nao') {
    return (
      <div className={styles.pageContainer}>
        <header className={styles.navbar}>
          <img src={logoVero} alt="Vero" className={styles.logoImagem} />
        </header>

        <main style={{ maxWidth: '520px', margin: '0 auto', width: '100%' }}>
          <section className={styles.card} aria-live="polite">
            <div
              aria-hidden="true"
              style={{
                display: 'flex',
                justifyContent: 'center',
                color: 'var(--violeta-vero)',
                marginBottom: 16,
              }}
            >
              <IconDigital size={64} />
            </div>

            {oferta === 'pergunta' ? (
              <>
                <h1 className={styles.titulo}>
                  Quer entrar com a digital da próxima vez?
                </h1>
                <p className={styles.subtitulo}>
                  Você pode entrar no Vero com sua digital ou com o rosto, sem
                  digitar o PIN. A digital fica só no seu celular: o Vero nunca
                  recebe.
                </p>

                {erro && (
                  <div style={{ marginBottom: 20 }}>
                    <AlertaStatus tipo="erro">{erro}</AlertaStatus>
                  </div>
                )}

                <div style={{ display: 'grid', gap: 12 }}>
                  <Botao
                    variant="primary"
                    fullWidth
                    carregando={carregando}
                    onClick={() => responderOferta(true)}
                  >
                    Sim, usar minha digital
                  </Botao>
                  <Botao
                    variant="secondary"
                    fullWidth
                    disabled={carregando}
                    onClick={() => responderOferta(false)}
                  >
                    Agora não
                  </Botao>
                </div>
                <p className={styles.subtitulo} style={{ marginTop: 16 }}>
                  O PIN continua funcionando sempre.
                </p>
              </>
            ) : (
              <>
                <h1 className={styles.titulo}>Digital ativada</h1>
                <div style={{ marginBottom: 20 }}>
                  <AlertaStatus tipo="sucesso">{mensagemOferta}</AlertaStatus>
                </div>
                <Botao
                  variant="primary"
                  fullWidth
                  onClick={() => navegar('/inicio')}
                >
                  Continuar
                </Botao>
              </>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <header className={styles.navbar}>
        <a
          href="/"
          className={styles.brandLogo}
          onClick={(e) => {
            e.preventDefault();
            navegar('/');
          }}
          aria-label="Vero - Início"
        >
          <img src={logoVero} alt="" className={styles.logoImagem} />
        </a>

        <Botao variant="secondary" onClick={() => navegar('/cadastro')}>
          Criar conta
        </Botao>
      </header>

      <main style={{ maxWidth: '520px', margin: '0 auto', width: '100%' }}>
        <section className={styles.card} aria-live="polite">
          <h1 className={styles.titulo}>Entrar no Vero</h1>
          <p className={styles.subtitulo}>
            Digite seu celular e seu PIN de <strong>4 números</strong> usando
            seu teclado físico ou o teclado na tela.
          </p>

          {erro && (
            <div style={{ marginBottom: 20 }}>
              <AlertaStatus tipo="erro">{erro}</AlertaStatus>
            </div>
          )}

          {aviso && !erro && (
            <div style={{ marginBottom: 20 }}>
              <AlertaStatus tipo="sucesso">{aviso}</AlertaStatus>
            </div>
          )}

          {podeBiometria && (
            <div style={{ marginBottom: 24 }}>
              <Botao
                variant="primary"
                fullWidth
                carregando={carregando}
                onClick={entrarComDigital}
                icone={<IconDigital size={24} />}
              >
                Entrar com digital ou rosto
              </Botao>
              <p
                className={styles.subtitulo}
                style={{ textAlign: 'center', margin: '16px 0 0' }}
              >
                ou entre com o celular e o PIN
              </p>
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <CampoTexto
              ref={campoCelularRef}
              rotulo="Número de celular"
              placeholder="(61) 99999-8888"
              type="tel"
              inputMode="numeric"
              maxLength={15}
              value={celular}
              onChange={(e) => {
                setCelular(formatarCelular(e.target.value));
                if (erro) setErro(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && validarCelular(celular)) {
                  e.preventDefault();
                  campoCelularRef.current?.blur();
                }
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <span
              style={{
                display: 'block',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--ardosia)',
                marginBottom: 8,
              }}
            >
              Seu PIN de 4 números
            </span>

            <div
              className={styles.pinDisplay}
              tabIndex={0}
              role="textbox"
              aria-label={`PIN: ${pin.length} de 4 dígitos preenchidos. Digite os 4 números no teclado.`}
              onClick={() => {
                // Ao clicar no PIN, garante que o campo de celular perca o foco
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`${styles.pinDigito} ${
                    pin.length > i ? styles.pinDigitoPreenchido : ''
                  }`}
                >
                  {pin.length > i ? '●' : ''}
                </div>
              ))}
            </div>
          </div>

          <TecladoNumerico onDigito={digitarPin} onApagar={apagarPin} />

          <div style={{ marginTop: 24 }}>
            <Botao
              variant="primary"
              fullWidth
              disabled={pin.length !== 4 || carregando}
              onClick={entrar}
            >
              {carregando ? 'Entrando no Vero...' : 'Entrar'}
            </Botao>
          </div>
        </section>
      </main>
    </div>
  );
};
