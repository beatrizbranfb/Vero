// Teclado do PIN de 4 números (login e criar PIN)
const VeroPin = (function () {
  const TAMANHO = 4;
  const casas = document.querySelectorAll('.pin-container .pin-digito');
  const aviso = document.getElementById('pin-aviso');
  let pin = '';

  function atualizar() {
    casas.forEach((casa, i) => {
      const preenchida = i < pin.length;
      casa.classList.toggle('filled', preenchida);
      casa.textContent = preenchida ? '•' : '';
    });
    document.querySelector('.pin-container').setAttribute('aria-label', `${pin.length} de ${TAMANHO} números digitados`);
    if (aviso && pin.length === TAMANHO) aviso.textContent = '';
  }

  function digitar(d) {
    if (pin.length < TAMANHO) { pin += d; atualizar(); }
  }

  function apagar() {
    pin = pin.slice(0, -1); atualizar();
  }

  function limpar() {
    pin = ''; atualizar();
  }

  // Avisa quando faltam números; devolve true se o PIN está completo
  function exigirCompleto() {
    if (pin.length === TAMANHO) return true;
    if (aviso) aviso.textContent = `Digite os ${TAMANHO} números do PIN.`;
    return false;
  }

  document.querySelectorAll('.keypad-grid .key-btn').forEach((botao) => {
    botao.addEventListener('click', () => {
      const texto = botao.textContent.trim();
      if (/^\d$/.test(texto)) digitar(texto);
      else if (texto === 'Limpar') limpar();
      else apagar();
    });
  });

  // Também aceita o teclado do computador, fora dos campos de texto
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (/^\d$/.test(e.key)) digitar(e.key);
    else if (e.key === 'Backspace') apagar();
    else if (e.key === 'Delete' || e.key === 'Escape') limpar();
  });

  atualizar();
  return { exigirCompleto, limpar };
})();
