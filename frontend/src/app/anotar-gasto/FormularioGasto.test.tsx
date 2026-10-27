import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FormularioGasto } from "./FormularioGasto";

// Mesmos seletores do E2E (e2e/tests/fluxo-principal.spec.ts): papel + nome acessível.
async function digitar(user: ReturnType<typeof userEvent.setup>, digitos: string) {
  for (const d of digitos) {
    await user.click(screen.getByRole("button", { name: d }));
  }
}

function valorNaTela() {
  return screen.getByTestId("valor-digitado").textContent;
}

describe("FormularioGasto (US03)", () => {
  it("mostra o valor em R$ enquanto digita: 1250 → R$ 12,50", async () => {
    const user = userEvent.setup();
    render(<FormularioGasto />);

    expect(valorNaTela()).toBe("R$ 0,00");
    await digitar(user, "1");
    expect(valorNaTela()).toBe("R$ 0,01");
    await digitar(user, "250");
    expect(valorNaTela()).toBe("R$ 12,50");
  });

  it("tem os dígitos de 0 a 9, Apagar e Limpar visíveis", () => {
    render(<FormularioGasto />);
    for (const d of "0123456789") {
      expect(screen.getByRole("button", { name: d })).toBeVisible();
    }
    expect(screen.getByRole("button", { name: "Apagar" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Limpar" })).toBeVisible();
  });

  it("Apagar remove o último dígito e Limpar zera", async () => {
    const user = userEvent.setup();
    render(<FormularioGasto />);

    await digitar(user, "1250");
    await user.click(screen.getByRole("button", { name: "Apagar" }));
    expect(valorNaTela()).toBe("R$ 1,25");

    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(valorNaTela()).toBe("R$ 0,00");
  });

  it("não deixa salvar valor vazio ou zero", async () => {
    const user = userEvent.setup();
    const onSalvar = vi.fn();
    render(<FormularioGasto onSalvar={onSalvar} />);

    const salvar = screen.getByRole("button", { name: /salvar/i });
    expect(salvar).toBeDisabled();
    expect(salvar).toHaveAccessibleDescription(/maior que zero/i);

    await digitar(user, "0");
    expect(salvar).toBeDisabled();

    await digitar(user, "5");
    expect(salvar).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Apagar" }));
    expect(salvar).toBeDisabled();

    await user.click(salvar);
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it("salva o valor em centavos e confirma com mensagem de status", async () => {
    const user = userEvent.setup();
    const onSalvar = vi.fn();
    render(<FormularioGasto onSalvar={onSalvar} />);

    await digitar(user, "1250");
    await user.click(screen.getByRole("button", { name: /salvar/i }));

    expect(onSalvar).toHaveBeenCalledWith(1250);
    expect(screen.getByRole("status")).toHaveTextContent("Gasto de R$ 12,50 anotado.");
    expect(valorNaTela()).toBe("R$ 0,00");
  });

  it("aceita o teclado do computador", async () => {
    const user = userEvent.setup();
    render(<FormularioGasto />);

    await user.keyboard("1250");
    expect(valorNaTela()).toBe("R$ 12,50");
    await user.keyboard("{Backspace}");
    expect(valorNaTela()).toBe("R$ 1,25");
    await user.keyboard("{Escape}");
    expect(valorNaTela()).toBe("R$ 0,00");
  });

  it("avisa quando chega ao valor máximo", async () => {
    const user = userEvent.setup();
    render(<FormularioGasto />);

    await digitar(user, "999999999");
    expect(valorNaTela()).toBe("R$ 999.999,99");
    expect(screen.getByText(/valor máximo/i)).toBeVisible();
  });
});
