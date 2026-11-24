# Gui: gestor financeiro pessoal

Sistema de finanças pessoais inspirado no Contas Online, para **um único usuário**, em português do Brasil.
Visual verde escuro e amarelo, com o mascote Gui.

Fases prontas:

- **Fase 0 (Fundação)**: login, barra verde com os menus, layout base, componentes visuais e o banco
  de dados com a carga padrão (79 categorias, 5 formas de pagamento, 6 feriados nacionais e a lista de bancos).
- **Fase 1 (Cadastros)**: telas de Contas Financeiras (com saldo inicial), Cartões de Crédito, Categorias
  (árvore numerada com abas por categoria principal), Clientes e Fornecedores, Formas de Pagamento e Tags.
  Todas com lista, busca, filtros, criar, editar e ativar/inativar (nada é apagado). Toda operação fica
  registrada na tabela `auditoria`. O checklist "primeiros passos" da Visão Geral marca o que já foi feito.

- **Fase 2 (Lançamentos)**: Financeiro > Lançamentos com abas (Todos, Receitas, Despesas, Transferências),
  filtro de conta ou cartão, situação, navegador de mês, busca (descrição, documento ou valor), chave Detalhar,
  filtros do painel (categoria, forma de pagamento, contato e tag), Saldo Anterior, Total dos Lançamentos,
  Saldo Previsto e Saldo Atual, e ações em lote (pagar/receber, voltar para não pago, excluir).
  Modal Novo Lançamento com as abas Simples, Detalhado (itens com categoria própria) e Transferência;
  parcelamento (todas as parcelas gravadas de uma vez, com "Ver Parcelas" editável), observação, anexos
  (imagem ou PDF até 4 MB, guardados no próprio banco), cadastro rápido de tag e de cliente/fornecedor.
  Compras no cartão caem na fatura certa pelo dia de fechamento e aparecem como "Fatura-Cartão" na lista.
  O saldo inicial de cada conta virou o lançamento "Saldo Inicial", e Contas Financeiras mostra o Saldo Atual.

- **Fase 3 (Recorrentes e Agenda)**: Financeiro > Recorrentes com abas (Todos, Receitas, Despesas, Transferências),
  filtros de conta ou cartão, intervalo, situação, categoria, forma de pagamento, contato, tag e plano, e chave Detalhar.
  Novo Recorrente nas abas Simples, Detalhado e Transferência, com Intervalo (Semanal, Mensal, Bimestral, Trimestral,
  Semestral, Anual ou Livre), Dia Fixo, Início, Repetições ou Fim, "Realizar automaticamente" e "Apenas dia útil"
  (pula sábado, domingo e feriados). Valor fixo ou **Média** (último lançamento ou média dos últimos 2 a 12 pagos).
  Variáveis `#mes#` e `#ano#` na descrição. **Planos** agrupam recorrentes com a mesma descrição e valor.
  "Gerar Recorrente" no Novo Lançamento. Financeiro > Agenda: calendário do mês com o anel de "% Realizado" e a janela
  Lançamentos do Dia.

- **Fase 4 (Visão Geral e Meus Dados)**: a Visão Geral virou o painel do dia a dia: saudação com o **olho** para
  esconder os valores, aviso do que vence hoje, botões Adicionar (Despesa, Receita, Transferência), **Saldo Atual**
  com o mini gráfico dos últimos 30 dias, **Receitas e Despesas do mês** (com o quanto já foi recebido e pago),
  **Vencidos**, **Vencendo** e **Futuro** (clique para ver a lista), **Saldo das Contas** e **Despesas por Categorias**
  (rosca com as 5 maiores). Cada cartão tem "Opções" no menu de três pontinhos (dias para trás e para frente, período
  das categorias, contas que aparecem). **Detalhando Conta Financeira** (abas Resumo e Lançamentos), aberto pela
  Visão Geral ou pela lista de Contas Financeiras. **Administração > Meus Dados**: informações e endereço, troca de
  senha e **Tempo da Sessão** (sai sozinho depois desse tempo sem uso; padrão 20 minutos).

- **Fase 5 (Cartões de crédito e faturas)**: as compras no cartão ficam agrupadas na **fatura** de cada mês (pelo dia de
  fechamento). A fatura fica **Aberta** até o dia do fechamento, **Fechada** a partir dele (ou antes, se você fechar à mão)
  e **Paga** depois do pagamento. **Pagar fatura** (no menu da linha "Fatura-Cartão" em Lançamentos, ou em Cadastros >
  Cartões de Crédito > Faturas) escolhe a conta e a data e grava uma saída na conta com o valor que falta pagar; as compras
  ficam como pagas. A despesa continua contada **uma vez só**, pelas compras (cada uma na sua categoria): o pagamento só
  mexe no saldo da conta. **Desfazer pagamento** volta tudo como estava. Compras ainda não pagas podem ser **movidas** para
  a fatura anterior ou seguinte. **Detalhando Cartão** (abas Resumo e Faturas): fatura atual, próximas faturas, anel do
  limite com o **limite disponível** (limite menos tudo o que ainda não foi pago, inclusive parcelas futuras), e a lista de
  faturas por ano com filtro Todas, Abertas, Fechadas e Pagas. A lista de cartões ganhou a barra de uso do limite, o botão
  Faturas e as opções Clonar, Detalhar, Faturas e Lançamentos. Na Visão Geral, o cartão **Faturas Atuais** mostra a fatura
  atual de cada cartão (com "Opções" para escolher os cartões).

As outras telas dos menus ainda mostram "Em construção" com a fase em que chegam.

### Como as faturas funcionam

- A **fatura atual** de um cartão é a fatura fechada mais antiga que ainda falta pagar; se não houver, é a que está
  recebendo as compras de hoje.
- Uma compra feita **no dia do fechamento** já cai na fatura do mês seguinte.
- Uma compra já paga junto com a fatura pode ter a descrição, a categoria e as tags alteradas, mas não o valor, o cartão
  ou a fatura, nem ser excluída: para isso, desfaça antes o pagamento da fatura.
- Se entrar uma compra nova numa fatura já paga (ex.: você pagou antes de fechar), a fatura volta a mostrar o que falta
  pagar e pode ser paga de novo só com a diferença.

### Como os recorrentes funcionam

- Os meses futuros **não são gravados antes da hora**: a lista de Lançamentos, a Agenda e os saldos calculam as
  próximas ocorrências na hora (até 360 dias à frente) e mostram com a etiqueta "Previsto".
- Uma ocorrência vira lançamento gravado quando você **paga/recebe**, **edita** ou quando ela tem
  "Realizar automaticamente" e o dia chega. Nunca duplica (o banco não aceita a mesma ocorrência duas vezes).
- "Realizar automaticamente" roda sozinho sempre que alguma tela do sistema é aberta: tudo o que venceu até hoje
  recebe baixa com a data do vencimento. Não precisa de tarefa agendada nem de configuração.
- Excluir uma ocorrência (prevista ou já gravada) só tira aquela data; as próximas continuam. Para parar de vez,
  inative o recorrente.
- Editar o recorrente muda só o que ainda não foi gravado.

## Publicar na Vercel (passo a passo)

Você só precisa fazer isto uma vez.

1. **Importe o repositório.** Na Vercel, clique em *Add New… > Project*, encontre `Gui` na lista
   e clique em **Import**.
2. **Cadastre as variáveis de ambiente.** Na mesma tela, abra *Environment Variables* e adicione:

   | Nome | O que colocar |
   |---|---|
   | `DATABASE_URL` | O endereço do banco no Neon. No painel do Neon: *Connect*, deixe ligado *Connection pooling* e copie o texto que começa com `postgresql://`. |
   | `AUTH_SECRET` | Um texto aleatório longo. Abra https://generate-secret.vercel.app/32 e copie o que aparecer. |
   | `GUI_EMAIL` | O e-mail que você vai usar para entrar. |
   | `GUI_SENHA` | A senha do seu primeiro acesso (mínimo 8 caracteres). |
   | `GUI_NOME` | Seu nome, como quer ser chamado na tela (opcional). |

3. Clique em **Deploy**. Durante a publicação, o sistema cria sozinho as tabelas no banco.
4. Abra o endereço do site e entre com o `GUI_EMAIL` e a `GUI_SENHA`. No primeiro acesso,
   o usuário é criado no banco e a senha fica guardada de forma protegida (hash).
5. **Depois do primeiro acesso**, apague a variável `GUI_SENHA` na Vercel
   (*Settings > Environment Variables*). Ela não é mais usada.

> Se você mudar alguma variável depois, publique de novo: *Deployments > ⋯ > Redeploy*.

### Se algo der errado

- **A publicação falhou com "DATABASE_URL não foi cadastrada"**: cadastre a variável (passo 2) e faça *Redeploy*.
- **"Não foi possível verificar o acesso agora"** na tela de login: confira se o `DATABASE_URL` e o
  `AUTH_SECRET` estão cadastrados e faça *Redeploy*.
- **"E-mail ou senha incorretos"** no primeiro acesso: o e-mail e a senha precisam ser exatamente os de
  `GUI_EMAIL` e `GUI_SENHA`.
- **Esqueci a senha**: rode `npm run criar-usuario` no computador (veja abaixo) com o mesmo e-mail; ele troca a senha.

## Rodar no computador (opcional)

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run configurar      # pergunta o endereço do banco (sem mostrar na tela) e cria o arquivo .env
npm run db:migrar       # cria ou atualiza as tabelas
npm run criar-usuario   # cria o seu usuário (ou troca a senha)
npm run dev             # abre em http://localhost:3000
```

## Comandos

| Comando | Para que serve |
|---|---|
| `npm run dev` | Abre o sistema no computador, atualizando a cada mudança. |
| `npm run build` | Atualiza o banco e prepara a versão de publicação (a Vercel roda este). |
| `npm run configurar` | Cria o arquivo `.env` com o endereço do banco e o segredo da sessão. |
| `npm run db:migrar` | Aplica as migrações (mudanças nas tabelas) pendentes no banco. |
| `npm run db:gerar` | Gera uma nova migração depois de mudar `src/db/schema.ts`. |
| `npm run criar-usuario` | Cria o usuário ou troca a senha. |
| `npm run lint` / `npm run typecheck` | Conferências automáticas do código. |
| `npm test` | Testes das contas de dinheiro (parcelas, fatura do cartão, situação da fatura, limite disponível, saldos, datas dos recorrentes, dia útil, média e os totais da Visão Geral). |

## Como o projeto está organizado

| Pasta / arquivo | O que tem |
|---|---|
| `src/app/login` | Tela de login. |
| `src/app/(sistema)` | Telas internas (só com login): Visão Geral, "Em construção" e a vitrine `/componentes`. |
| `src/components/layout` | Barra verde, logotipo, barra de favoritos, Central de Ajuda, cabeçalho das telas. |
| `src/components/ui` | Componentes base: botão, janela (modal), tabela, chave liga/desliga, faixa amarela de erro, valor em reais. |
| `src/app/(sistema)/cadastros` | Telas de Cadastros. Cada pasta tem `page.tsx` (lista e filtros), `tela.tsx` (tabela e janela de cadastro) e `acoes.ts` (gravação no banco, com auditoria). |
| `src/components/cadastros` | Peças comuns das listas: barra com Adicionar e busca, painel de Filtros, paginação, menu de três pontos, check de situação, janela de cadastro. |
| `src/lib/categorias.ts` | Monta a árvore de categorias e calcula a numeração (1., 9.4.1.). |
| `src/lib/menu.ts` | Itens dos menus e em qual fase cada tela chega. |
| `src/lib/visao-geral` | Contas da Visão Geral (`regras.ts`, com testes) e a carga dos cartões do painel (`servidor.ts`). |
| `src/lib/contas/detalhe.ts` | Dados do Detalhando Conta Financeira. |
| `src/proxy.ts` | Renova a sessão a cada página aberta (o Tempo da Sessão conta a partir do último uso). |
| `src/lib/recorrentes` | Regras dos recorrentes (`regras.ts`, com testes), cálculo das ocorrências previstas, gravação e "Realizar automaticamente" (`servidor.ts`). |
| `src/app/(sistema)/financeiro/recorrentes` e `.../agenda` | Telas de Recorrentes (com Planos) e Agenda. |
| `src/lib/cartoes` | Regras das faturas e do limite (`regras.ts`, com testes) e a carga das faturas, do Detalhando Cartão e das Faturas Atuais (`servidor.ts`). |
| `src/components/cartoes` | Janelas Detalhando Cartão de Crédito e Fatura (pagar, desfazer, fechar, reabrir, mover compra). |
| `src/db/schema.ts` | As tabelas do banco. |
| `drizzle/` | Migrações: `0000` cria as tabelas, `0001` faz a carga inicial, `0002` cria a auditoria e o saldo inicial das contas, `0003` os lançamentos, `0004` os recorrentes e planos, `0005` liga o pagamento de fatura à fatura paga. |
| `src/auth.ts` | Login (Auth.js). A sessão acaba depois do Tempo da Sessão sem uso (Meus Dados > Preferências; padrão 20 minutos). |
| `scripts/` | Scripts de terminal: configurar, migrar, criar usuário. |

## Regras do projeto

- **Dinheiro em centavos inteiros**: R$ 83,37 é guardado como `8337`. Nada de casas decimais no banco.
- **Datas sem hora** para vencimento, pagamento etc.; fuso `America/Sao_Paulo`.
- **Cadastros não são apagados**, são inativados (campo `ativo`).
- **Um único usuário**: não há coluna de "dono" nas tabelas.
- **Segredos nunca vão para o GitHub**: só nas variáveis de ambiente da Vercel ou no `.env` local.

## Ferramentas

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Auth.js 5, Drizzle ORM com Postgres (Neon), bcryptjs, Zod, ícones Lucide.
