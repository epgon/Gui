/**
 * Menus da barra superior. "fase" diz em qual etapa do plano a tela chega;
 * enquanto ela não existe, o link abre a página "Em construção".
 */
export type ItemMenu = { titulo: string; href: string; fase: number; descricao?: string };
export type GrupoMenu = { titulo: string; itens: ItemMenu[] };

export const MENU_PRINCIPAL: GrupoMenu[] = [
  {
    titulo: "Financeiro",
    itens: [
      { titulo: "Lançamentos", href: "/financeiro/lancamentos", fase: 2, descricao: "Receitas, despesas e transferências do mês." },
      { titulo: "Agenda", href: "/financeiro/agenda", fase: 3, descricao: "Calendário com o que vence em cada dia." },
      { titulo: "Recorrentes", href: "/financeiro/recorrentes", fase: 3, descricao: "Contas que se repetem: aluguel, salário, assinaturas." },
      { titulo: "Importações", href: "/financeiro/importacoes", fase: 6, descricao: "Importar extratos OFX e CSV do banco." },
    ],
  },
  {
    titulo: "Gestão",
    itens: [{ titulo: "Orçamentos", href: "/gestao/orcamentos", fase: 9, descricao: "Limites de gasto por categoria e mês." }],
  },
  {
    titulo: "Relatórios",
    itens: [
      { titulo: "Fluxo de Caixa", href: "/relatorios/fluxo-de-caixa", fase: 8, descricao: "Entradas, saídas e saldo por período." },
      { titulo: "Saldo Detalhado", href: "/relatorios/saldo-detalhado", fase: 8, descricao: "Totais por dia, mês, categoria, conta e mais." },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { titulo: "Contas Financeiras", href: "/cadastros/contas-financeiras", fase: 1, descricao: "Suas contas bancárias, carteira e investimentos." },
      { titulo: "Cartões de Crédito", href: "/cadastros/cartoes-de-credito", fase: 1, descricao: "Cartões, limites e dias de fechamento e vencimento." },
      { titulo: "Categorias", href: "/cadastros/categorias", fase: 1, descricao: "Organize receitas e despesas em categorias." },
      { titulo: "Clientes e Fornecedores", href: "/cadastros/clientes-e-fornecedores", fase: 1, descricao: "Pessoas e empresas com quem você paga ou recebe." },
      { titulo: "Formas de Pagamento", href: "/cadastros/formas-de-pagamento", fase: 1, descricao: "Pix, boleto, dinheiro, cartão..." },
      { titulo: "Tags", href: "/cadastros/tags", fase: 1, descricao: "Etiquetas livres para agrupar lançamentos." },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      { titulo: "Meus Dados", href: "/administracao/meus-dados", fase: 4, descricao: "Seu perfil, senha e tempo de sessão." },
      { titulo: "Auditoria", href: "/administracao/auditoria", fase: 11, descricao: "Histórico de tudo o que foi cadastrado, alterado ou excluído." },
    ],
  },
];

export const MENU_CONFIGURACOES: ItemMenu[] = [
  { titulo: "Parâmetros", href: "/configuracoes/parametros", fase: 11, descricao: "Ajustes gerais, lançamentos, feriados." },
  { titulo: "Recursos", href: "/configuracoes/recursos", fase: 11, descricao: "Ligar e desligar módulos do sistema." },
  { titulo: "Notificações", href: "/notificacoes", fase: 11, descricao: "Avisos do sistema." },
];

export function encontrarItem(caminho: string): (ItemMenu & { grupo: string }) | null {
  for (const grupo of MENU_PRINCIPAL) {
    const item = grupo.itens.find((i) => i.href === caminho);
    if (item) return { ...item, grupo: grupo.titulo };
  }
  const config = MENU_CONFIGURACOES.find((i) => i.href === caminho);
  return config ? { ...config, grupo: "Configurações" } : null;
}
