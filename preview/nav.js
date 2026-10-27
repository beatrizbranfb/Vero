// Menu lateral de acesso às telas
(function () {
  const botao = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu-telas');
  const fundo = document.querySelector('.menu-fundo');
  const fechar = document.querySelector('.menu-fechar');

  function abrir() {
    menu.classList.add('aberto');
    fundo.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    fechar.focus();
  }

  function fecharMenu() {
    menu.classList.remove('aberto');
    fundo.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    botao.focus();
  }

  botao.addEventListener('click', abrir);
  fechar.addEventListener('click', fecharMenu);
  fundo.addEventListener('click', fecharMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('aberto')) fecharMenu();
  });
})();
