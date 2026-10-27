// Categorias do registro manual (RF09). O ícone é o conteúdo de um <svg viewBox="0 0 24 24">.

export type Categoria = { nome: string; icone: string };

export const CATEGORIAS: Categoria[] = [
  {
    nome: "Mercado",
    icone:
      '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  },
  {
    nome: "Farmácia",
    icone: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8"/><path d="M8 12h8"/>',
  },
  {
    nome: "Contas",
    icone:
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  },
  {
    nome: "Transporte",
    icone:
      '<rect x="3" y="3" width="18" height="14" rx="3"/><path d="M3 10h18"/><circle cx="7.5" cy="17" r="1.5"/><circle cx="16.5" cy="17" r="1.5"/>',
  },
  { nome: "Casa", icone: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' },
  {
    nome: "Outros",
    icone:
      '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  },
];
