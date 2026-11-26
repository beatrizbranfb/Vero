import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Entrar } from './Entrar';
import * as servicos from '../../servicos';

const mockNavegar = vi.fn();

vi.mock('../../router', () => ({
  useNavegacao: () => ({
    navegar: mockNavegar,
    rota: '/entrar',
  }),
}));

vi.mock('../../servicos', () => ({
  entrarComPin: vi.fn(),
  entrarComBiometria: vi.fn(),
  ativarBiometria: vi.fn(),
  biometriaAtivaNesteAparelho: vi.fn(),
  biometriaDisponivel: vi.fn(),
  jaPerguntouBiometria: vi.fn(),
  marcarBiometriaPerguntada: vi.fn(),
  mensagemErroBiometria: vi.fn(),
  pedirDesafioBiometria: vi.fn(),
  telefoneDaBiometria: vi.fn(),
  estaAutenticado: vi.fn(),
  limparSessao: vi.fn(),
  ErroApi: class ErroApi extends Error {
    detalhe: string;
    constructor(detalhe: string) {
      super(detalhe);
      this.detalhe = detalhe;
    }
  },
}));

describe('Página Entrar (Login no Vero com Teclado Físico)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(servicos.biometriaAtivaNesteAparelho).mockReturnValue(false);
    vi.mocked(servicos.biometriaDisponivel).mockResolvedValue(false);
    vi.mocked(servicos.jaPerguntouBiometria).mockReturnValue(false);
  });

  it('permite digitar o PIN usando o teclado físico do computador', async () => {
    vi.mocked(servicos.entrarComPin).mockResolvedValue({
      access_token: 'fake-token',
      token_type: 'bearer',
      expira_em: 7200,
    });

    render(<Entrar />);

    // Simula a digitação de 1, 2, 3, 4 no teclado físico
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: '4' });

    // O PIN deve ter 4 dígitos
    const pinDisplay = screen.getByLabelText(/PIN: 4 de 4 dígitos/i);
    expect(pinDisplay).toBeInTheDocument();

    // Pressiona Enter no teclado físico para autenticar
    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => {
      expect(servicos.entrarComPin).toHaveBeenCalledWith(
        '(61) 99999-8888',
        '1234'
      );
      expect(mockNavegar).toHaveBeenCalledWith('/inicio');
    });
  });

  it('permite apagar dígitos do PIN com a tecla Backspace', () => {
    render(<Entrar />);

    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '2' });
    expect(screen.getByLabelText(/PIN: 2 de 4 dígitos/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(screen.getByLabelText(/PIN: 1 de 4 dígitos/i)).toBeInTheDocument();
  });
});

describe('Entrar com digital ou rosto (RF02)', () => {
  const token = {
    access_token: 'fake-token',
    token_type: 'bearer',
    expira_em: 7200,
  };

  const digitarPinEEntrar = () => {
    for (const tecla of ['1', '2', '3', '4', 'Enter']) {
      fireEvent.keyDown(window, { key: tecla });
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(servicos.biometriaAtivaNesteAparelho).mockReturnValue(false);
    vi.mocked(servicos.biometriaDisponivel).mockResolvedValue(true);
    vi.mocked(servicos.jaPerguntouBiometria).mockReturnValue(false);
    vi.mocked(servicos.telefoneDaBiometria).mockReturnValue(null);
    vi.mocked(servicos.pedirDesafioBiometria).mockResolvedValue(
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
    );
    vi.mocked(servicos.entrarComPin).mockResolvedValue(token);
  });

  it('não mostra o botão da digital no aparelho que ainda não ativou', async () => {
    render(<Entrar />);

    await waitFor(() =>
      expect(servicos.biometriaAtivaNesteAparelho).toHaveBeenCalled()
    );
    expect(
      screen.queryByRole('button', { name: /entrar com digital/i })
    ).not.toBeInTheDocument();
  });

  it('entra com a digital usando o celular digitado', async () => {
    vi.mocked(servicos.biometriaAtivaNesteAparelho).mockReturnValue(true);
    vi.mocked(servicos.entrarComBiometria).mockResolvedValue({
      entrou: true,
      mensagem: 'Acesso com biometria liberado',
    });

    render(<Entrar />);
    fireEvent.click(
      await screen.findByRole('button', { name: /entrar com digital/i })
    );

    await waitFor(() => {
      expect(servicos.entrarComBiometria).toHaveBeenCalledWith(
        '(61) 99999-8888'
      );
      expect(mockNavegar).toHaveBeenCalledWith('/inicio');
    });
  });

  it('já traz o celular de quem ativou a digital neste aparelho', () => {
    vi.mocked(servicos.telefoneDaBiometria).mockReturnValue('61988887777');

    render(<Entrar />);

    expect(screen.getByLabelText(/número de celular/i)).toHaveValue(
      '(61) 98888-7777'
    );
  });

  it('pede o PIN quando a API confirma a digital mas não abre a sessão', async () => {
    vi.mocked(servicos.biometriaAtivaNesteAparelho).mockReturnValue(true);
    vi.mocked(servicos.entrarComBiometria).mockResolvedValue({
      entrou: false,
      mensagem: 'Digital confirmada. Para terminar de entrar, digite seu PIN.',
    });

    render(<Entrar />);
    fireEvent.click(
      await screen.findByRole('button', { name: /entrar com digital/i })
    );

    expect(await screen.findByText(/digite seu PIN/i)).toBeInTheDocument();
    expect(mockNavegar).not.toHaveBeenCalled();
  });

  it('mostra a mensagem quando a digital não confere', async () => {
    vi.mocked(servicos.biometriaAtivaNesteAparelho).mockReturnValue(true);
    vi.mocked(servicos.entrarComBiometria).mockRejectedValue(
      new Error('cancelado')
    );
    vi.mocked(servicos.mensagemErroBiometria).mockReturnValue(
      'A digital não foi confirmada. Tente de novo ou entre com o PIN.'
    );

    render(<Entrar />);
    fireEvent.click(
      await screen.findByRole('button', { name: /entrar com digital/i })
    );

    expect(
      await screen.findByText(/a digital não foi confirmada/i)
    ).toBeInTheDocument();
    expect(mockNavegar).not.toHaveBeenCalled();
    // O PIN continua ali como alternativa
    expect(screen.getByLabelText(/PIN: 0 de 4 dígitos/i)).toBeInTheDocument();
  });

  it('depois do PIN, pergunta se quer usar a digital e respeita o "agora não"', async () => {
    render(<Entrar />);
    digitarPinEEntrar();

    expect(
      await screen.findByRole('heading', { name: /entrar com a digital/i })
    ).toBeInTheDocument();
    expect(mockNavegar).not.toHaveBeenCalled();
    // O desafio vem antes do PIN, para o token do PIN continuar valendo
    expect(
      vi.mocked(servicos.pedirDesafioBiometria).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(servicos.entrarComPin).mock.invocationCallOrder[0]
    );

    fireEvent.click(screen.getByRole('button', { name: /agora não/i }));

    expect(servicos.marcarBiometriaPerguntada).toHaveBeenCalledWith(
      '(61) 99999-8888'
    );
    expect(servicos.ativarBiometria).not.toHaveBeenCalled();
    expect(mockNavegar).toHaveBeenCalledWith('/inicio');
  });

  it('ativa a digital quando a pessoa aceita', async () => {
    vi.mocked(servicos.ativarBiometria).mockResolvedValue(
      'Pronto! Da próxima vez, você pode entrar com sua digital.'
    );

    render(<Entrar />);
    digitarPinEEntrar();
    fireEvent.click(
      await screen.findByRole('button', { name: /sim, usar minha digital/i })
    );

    expect(await screen.findByText(/pronto!/i)).toBeInTheDocument();
    expect(servicos.ativarBiometria).toHaveBeenCalledWith(
      'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      '(61) 99999-8888'
    );
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(mockNavegar).toHaveBeenCalledWith('/inicio');
  });

  it('não pergunta de novo a quem já respondeu', async () => {
    vi.mocked(servicos.jaPerguntouBiometria).mockReturnValue(true);

    render(<Entrar />);
    digitarPinEEntrar();

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/inicio'));
    expect(servicos.pedirDesafioBiometria).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', { name: /entrar com a digital/i })
    ).not.toBeInTheDocument();
  });

  it('segue para o início se a API não der o desafio', async () => {
    vi.mocked(servicos.pedirDesafioBiometria).mockRejectedValue(
      new Error('fora do ar')
    );

    render(<Entrar />);
    digitarPinEEntrar();

    await waitFor(() => expect(mockNavegar).toHaveBeenCalledWith('/inicio'));
    expect(
      screen.queryByRole('heading', { name: /entrar com a digital/i })
    ).not.toBeInTheDocument();
  });
});
