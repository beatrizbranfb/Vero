import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTempoReal } from './useTempoReal';

vi.mock('../servicos/api', () => ({
  obterToken: () => 'token-de-teste',
}));

class WebSocketDeTeste {
  static instancias: WebSocketDeTeste[] = [];

  onopen: ((evento: Event) => void) | null = null;
  onmessage: ((evento: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    WebSocketDeTeste.instancias.push(this);
  }

  send = vi.fn();
  close = vi.fn();
}

describe('useTempoReal', () => {
  afterEach(() => {
    WebSocketDeTeste.instancias = [];
    vi.unstubAllGlobals();
  });

  it('notifica quando uma conta é atualizada', () => {
    vi.stubGlobal('WebSocket', WebSocketDeTeste);
    const aoReceber = vi.fn();
    const { unmount } = renderHook(() => useTempoReal(aoReceber));
    const socket = WebSocketDeTeste.instancias[0];
    const evento = {
      tipo: 'conta_atualizada',
      dados: {
        id: 'conta-1',
        status: 'paga',
        pagamento_em: '2026-11-25T10:00:00+00:00',
      },
    };

    act(() => {
      socket.onmessage?.(
        new MessageEvent('message', { data: JSON.stringify(evento) })
      );
    });

    expect(aoReceber).toHaveBeenCalledWith(evento);
    unmount();
  });

  it('continua notificando quando uma transação é criada', () => {
    vi.stubGlobal('WebSocket', WebSocketDeTeste);
    const aoReceber = vi.fn();
    const { unmount } = renderHook(() => useTempoReal(aoReceber));
    const socket = WebSocketDeTeste.instancias[0];
    const evento = {
      tipo: 'transacao_criada',
      dados: {
        id: 'transacao-1',
        valor: '25.00',
        tipo: 'gasto',
        categoria: 'Alimentação',
        criado_em: '2026-11-25T10:00:00+00:00',
      },
    };

    act(() => {
      socket.onmessage?.(
        new MessageEvent('message', { data: JSON.stringify(evento) })
      );
    });

    expect(aoReceber).toHaveBeenCalledWith(evento);
    unmount();
  });
});
