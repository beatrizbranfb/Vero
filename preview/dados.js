// Dados do mês (gastos, dinheiro que entrou e meta) guardados no navegador
const VeroDados = (function () {
  const CHAVE = 'vero-preview-mes';
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const diaHoje = hoje.getDate();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

  // Exemplo inicial para o preview não começar vazio
  function exemplo() {
    const dia = (d) => Math.min(d, diaHoje);
    return {
      mes: mesAtual,
      meta: 2000,
      itens: [
        { id: 1, dia: dia(1), tipo: 'entrada', valor: 2200, categoria: 'Entrou dinheiro' },
        { id: 2, dia: dia(3), tipo: 'gasto', valor: 250, categoria: 'Contas' },
        { id: 3, dia: dia(6), tipo: 'gasto', valor: 180, categoria: 'Mercado' },
        { id: 4, dia: dia(10), tipo: 'entrada', valor: 1100, categoria: 'Entrou dinheiro' },
        { id: 5, dia: dia(14), tipo: 'gasto', valor: 210, categoria: 'Casa' },
        { id: 6, dia: dia(17), tipo: 'gasto', valor: 90, categoria: 'Transporte' },
        { id: 7, dia: Math.max(1, diaHoje - 1), tipo: 'gasto', valor: 45, categoria: 'Farmácia' },
        { id: 8, dia: diaHoje, tipo: 'gasto', valor: 120, categoria: 'Mercado' }
      ]
    };
  }

  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE));
      if (salvo && salvo.mes === mesAtual) return salvo;
    } catch (e) {}
    return exemplo();
  }

  let estado = carregar();

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) {}
  }

  function adicionar(tipo, valor, categoria) {
    const id = Date.now();
    estado.itens.push({ id, dia: diaHoje, tipo, valor, categoria });
    salvar();
    return id;
  }

  function remover(id) {
    estado.itens = estado.itens.filter((i) => i.id !== id);
    salvar();
  }

  function definirMeta(valor) {
    estado.meta = valor;
    salvar();
  }

  // Saldo ao fim de cada dia, do dia 1 até hoje
  function saldoPorDia() {
    const pontos = [];
    let saldo = 0;
    for (let d = 1; d <= diaHoje; d++) {
      estado.itens.filter((i) => i.dia === d).forEach((i) => {
        saldo += i.tipo === 'entrada' ? i.valor : -i.valor;
      });
      pontos.push({ dia: d, saldo });
    }
    return pontos;
  }

  function moeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  return {
    diaHoje,
    diasNoMes,
    get meta() { return estado.meta; },
    get itens() { return estado.itens.slice(); },
    adicionar,
    remover,
    definirMeta,
    saldoPorDia,
    moeda
  };
})();
