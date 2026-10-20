import AxeBuilder from "@axe-core/playwright";
import { expect, Page, test } from "@playwright/test";

// Fluxo crítico da S1: cadastro → login com PIN → registrar gasto → ver saldo.
// Os seletores usam papéis e rótulos acessíveis: se o teste não encontra um
// elemento, o leitor de tela também não encontra.

const PIN = "1234";
// O código de verificação em staging vem de um provedor simulado (nunca SMS real).
const CODIGO_VERIFICACAO = process.env.E2E_CODIGO_VERIFICACAO ?? "000000";

function celularFicticio(): string {
  const sufixo = String(Date.now()).slice(-8);
  return `61 9${sufixo}`;
}

async function digitarNoTeclado(page: Page, digitos: string) {
  for (const d of digitos) {
    await page.getByRole("button", { name: d, exact: true }).click();
  }
}

async function semViolacoesGraves(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const graves = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(graves, graves.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
}

async function semRolagemHorizontal(page: Page) {
  const largura = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(largura).toBeLessThanOrEqual(0);
}

test("cadastro, login com PIN, registro de gasto e saldo atualizado", async ({ page }) => {
  const celular = celularFicticio();

  await test.step("cadastro por celular (RF03)", async () => {
    await page.goto("/cadastro");
    await semViolacoesGraves(page);
    await semRolagemHorizontal(page);

    await page.getByLabel(/nome/i).fill("Maria Teste");
    await page.getByLabel(/celular/i).fill(celular);
    await expect(page.getByLabel(/e-?mail/i)).toHaveCount(0);
    await page.getByRole("button", { name: /continuar|cadastrar/i }).click();

    await page.getByLabel(/código/i).fill(CODIGO_VERIFICACAO);
    await page.getByRole("button", { name: /confirmar/i }).click();
  });

  await test.step("criação do PIN (RF01)", async () => {
    await digitarNoTeclado(page, PIN);
    await digitarNoTeclado(page, PIN); // confirmação
    await page.getByRole("button", { name: /confirmar|salvar/i }).click();
  });

  await test.step("login com PIN (RF01)", async () => {
    await page.context().clearCookies();
    await page.goto("/entrar");
    await page.getByLabel(/celular/i).fill(celular);
    await page.getByRole("button", { name: /continuar/i }).click();
    await semViolacoesGraves(page);
    await digitarNoTeclado(page, PIN);
    await page.getByRole("button", { name: /entrar/i }).click();
  });

  const saldo = page.getByTestId("saldo-disponivel");
  let saldoInicial = 0;

  await test.step("saldo na tela inicial (RF19)", async () => {
    await expect(page.getByText(/disponível no mês/i)).toBeVisible();
    saldoInicial = paraCentavos(await saldo.innerText());
    await semViolacoesGraves(page);
    await semRolagemHorizontal(page);
  });

  await test.step("registrar gasto com teclado e categoria (RF08, RF09)", async () => {
    await page.getByRole("button", { name: /registrar gasto|novo gasto/i }).click();

    const salvar = page.getByRole("button", { name: /salvar/i });
    await digitarNoTeclado(page, "1250");
    await expect(page.getByText("R$ 12,50")).toBeVisible();

    await page.getByRole("button", { name: /mercado/i }).click();
    await semViolacoesGraves(page);
    await salvar.click();
    await expect(page.getByRole("status")).toBeVisible();
  });

  await test.step("saldo atualizado após o gasto (RF19)", async () => {
    await expect.poll(async () => paraCentavos(await saldo.innerText())).toBe(saldoInicial - 1250);
  });
});

test("valor zero não pode ser salvo (RF08)", async ({ page }) => {
  test.skip(!process.env.E2E_CELULAR || !process.env.E2E_PIN, "requer usuário de teste em staging");
  await page.goto("/entrar");
  await page.getByLabel(/celular/i).fill(process.env.E2E_CELULAR!);
  await page.getByRole("button", { name: /continuar/i }).click();
  await digitarNoTeclado(page, process.env.E2E_PIN!);
  await page.getByRole("button", { name: /entrar/i }).click();

  await page.getByRole("button", { name: /registrar gasto|novo gasto/i }).click();
  await page.getByRole("button", { name: /mercado/i }).click();
  await expect(page.getByRole("button", { name: /salvar/i })).toBeDisabled();
});

function paraCentavos(texto: string): number {
  const negativo = texto.includes("-");
  const digitos = texto.replace(/\D/g, "");
  return (negativo ? -1 : 1) * Number(digitos || 0);
}
