# Gui: Gestão de Dívidas (especificação do novo módulo)

Base: a ideia apresentada pela pessoa (conversa com outra IA, 26/11/2026), as respostas dadas ao Claude no mesmo dia e o Gui como ele está hoje
(repositório `epgon/gui`, fases 0 a 11 prontas, `plano-de-construcao.md` e `especificacao_do_sistema_gui.md`).
Data: 26/11/2026.

Como ler este documento (mesmo padrão do plano do Gui):

- **Decisão da pessoa**: já combinado, não muda.
- **Proposta técnica**: escolha do Claude para o módulo funcionar bem; pode ser trocada sem mudar o que o módulo faz.
- **Lacuna**: ponto que a pessoa ainda não respondeu. Todas estão na seção 12 e marcadas com ⚠️ ao longo do texto. **Cada uma já tem uma decisão provisória** (a opção mais segura), para a construção não parar; a pessoa pode trocar depois.

O passo a passo de construção (fases, critérios de aceite e riscos) está no arquivo irmão `plano-gestao-de-dividas.md`.

---

## 1. Objetivo

Hoje o Gui **registra** o dinheiro: receitas, despesas, faturas, recorrentes, orçamentos. A Gestão de Dívidas faz o Gui também **ajudar a resolver** um problema financeiro: juntar tudo o que a pessoa deve, mostrar a situação com clareza, comparar caminhos para quitar, montar um plano e acompanhar se o plano está sendo cumprido.

O módulo não é uma tela de cadastro solta. Ele conversa com o que já existe: as parcelas de uma dívida **são lançamentos do Gui**, aparecem em Lançamentos, Agenda, Visão Geral, Notificações e Relatórios como qualquer conta a pagar, e são pagas pelo mesmo caminho de sempre.

## 2. Decisões já tomadas

1. **Acesso pelo menu Gestão**, ao lado de Orçamentos. (Decisão da pessoa)
2. **Dívida = contrato ou relacionamento com um credor** (banco, loja ou pessoa física), com várias parcelas ou obrigações. Para pessoa física, juros e contrato são opcionais. (Decisão da pessoa)
3. **Dívidas antigas** são cadastradas à mão; **obrigações que já estão no Gui** (faturas de cartão em aberto, lançamentos vencidos e não pagos, recorrentes) aparecem na Gestão de Dívidas **apontando para o registro original**, sem cadastro em dobro. (Decisão da pessoa)
4. **Pagamento** total ou parcial de uma parcela vira um **lançamento normal saindo de uma conta financeira**. Ele aparece nos módulos de origem, com rastreabilidade e sem duplicidade. (Decisão da pessoa)
5. **Juros, multas e encargos**: o Gui **estima** o saldo devedor; a pessoa **corrige** com o saldo real informado pelo credor. (Decisão da pessoa)
6. **Renegociação**: a dívida original é encerrada como **Renegociada**, o acordo novo fica ligado a ela e todo o histórico é preservado. (Decisão da pessoa)
7. **Simulador** (Bola de Neve, Avalanche, pagamento extra, cenários conservador, intermediário e acelerado, impacto no orçamento e na reserva, propostas de negociação): **só cálculo, dentro do próprio Gui, sem IA, e nunca altera dados reais**. (Decisão da pessoa)
8. **Plano de quitação vivo**: planejado contra realizado, desvios, ajustes sugeridos por regra. **Nada muda sem aprovação da pessoa.** (Decisão da pessoa)
9. **Consultor Gui** começa **só com regras e cálculos próprios** (alertas, recomendações, explicações dos números), com tom de especialista técnico, didático, transparente e prudente. **Qualquer pagamento, movimentação ou compromisso exige autorização expressa.** Conversas organizadas por assunto, com histórico. (Decisão da pessoa)
10. **Chat livre com IA externa é a etapa final e opcional**: provedor configurável, plano gratuito sugerido (Gemini), envia só um resumo dos números, avisa sobre privacidade e o sistema funciona inteiro sem IA. (Decisão da pessoa)
11. **Baixo custo**: nada de serviço pago obrigatório. Tudo roda no que o Gui já usa (Vercel e Neon gratuitos). (Decisão da pessoa)
12. **Navegação**: Visão Geral, Minhas Dívidas, Negociações, Simulador, Plano de Quitação, Consultor Gui. (Decisão da pessoa)
13. **As telas novas mantêm o visual atual do Gui** (seção 4). (Decisão da pessoa)
14. **O Gui já está pronto e funcionando: o módulo não pode quebrar nada que existe** (seção 3). (Decisão da pessoa)

## 3. Regras que protegem o que já existe

O Gui está em uso com dados reais. Toda fase do módulo segue estas regras (Proposta técnica, obrigatória em todas as fases):

1. **Só acrescentar no banco.** Tabelas novas e colunas novas **opcionais** (que aceitam vazio). Nenhuma coluna existente é apagada, renomeada ou muda de tipo. Nenhuma migração apaga dados.
2. **As contas que já existem não mudam.** Saldo das contas, Visão Geral, Fluxo de Caixa, Saldo Detalhado, Orçamentos, faturas e limite do cartão continuam calculados do mesmo jeito. Como as parcelas de dívida são lançamentos comuns, elas entram nesses totais naturalmente, sem regra especial.
3. **Um único caminho de pagamento.** O módulo não inventa outro jeito de pagar: usa as mesmas funções de Pagar/Receber, Pagamento Parcial, Pagar Fatura e Voltar para Não Pago que as telas atuais usam. Assim não há duas versões da mesma regra.
4. **Recurso desligável.** "Gestão de Dívidas" entra em **Configurações > Recursos**. Desligado, some do menu e das telas (como Orçamentos hoje); **nada é apagado**, e os lançamentos das parcelas continuam em Lançamentos como contas normais.
5. **Todos os testes atuais continuam passando** (`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`) e cada fase acrescenta os testes das suas contas.
6. **Auditoria em tudo.** Cadastrar, alterar, pagar, renegociar, aprovar plano: tudo vai para a tabela `auditoria` na mesma transação, como o resto do sistema.
7. **Sem tarefa agendada.** Como as Notificações e o "Realizar automaticamente", os alertas e os desvios do plano são **calculados quando uma tela é aberta**. Nada de Cron novo.
8. **Segredos fora do banco e do GitHub.** A chave da IA (fase 6) fica só nas variáveis de ambiente da Vercel, como `DATABASE_URL` e `AUTH_SECRET`.

## 4. Visual e navegação

### 4.1. O visual é o do Gui (Decisão da pessoa)

As telas novas **não têm visual próprio**. Usam os componentes e padrões que já existem no código, sem criar variações:

| Padrão do Gui | Onde fica no código | Uso no módulo |
|---|---|---|
| Barra verde com os menus e o dropdown com título e descrição em verde | `components/layout/barra-superior.tsx`, `lib/menu.ts` | Item novo no menu Gestão |
| Cabeçalho da tela (grupo em cinza pequeno, título grande, estrela de favorito) | `components/layout/cabecalho-pagina.tsx` | Todas as telas novas |
| Botão verde **+ Adicionar**, botão **Imprimir**, botão de Configurações da Listagem, campo de busca | `components/cadastros/barra-lista.tsx` | Minhas Dívidas, Negociações |
| Tabela com títulos em maiúsculas cinza, linhas zebradas, bolinha laranja de novo/atualizado, **menu de três pontos** na linha | `components/ui/tabela.tsx`, `components/cadastros/menu-linha.tsx` | Todas as listas |
| Painel lateral direito **Filtros** (abas Simples e Avançado, botão verde Filtrar) | `components/cadastros/painel-filtros.tsx` | Minhas Dívidas, Negociações |
| Painel lateral direito **Central de Ajuda** nas telas que não são lista | `components/layout/painel-ajuda.tsx` | Visão Geral, Simulador, Plano, Consultor |
| Janela (modal) com cabeçalho, campos com ícone de ajuda, rodapé **Salvar / Voltar / Salvar e Adicionar Novo** | `components/ui/modal.tsx`, `components/cadastros/modal-cadastro.tsx` | Cadastro de dívida, proposta, pagamento |
| Faixa amarela com o primeiro erro ("Preencha o campo **Credor**.") | `components/ui/faixa-erro.tsx` | Todos os formulários |
| Valores: azul para entrada, vermelho/laranja para saída, centavos menores, **olho** para ocultar | `components/ui/valor.tsx`, `components/ui/ocultar-valores.tsx` | Todos os valores |
| Faixas amarelo-creme de total ("Saldo Atual", "Total do Período") | padrão das listas | Totais das listas e do simulador |
| Cartões brancos com borda, "Opções" no menu de três pontos do cartão | `components/visao-geral/tela.tsx` | Visão Geral do módulo |
| Barra de progresso dos Orçamentos e anel do limite do cartão | `gestao/orcamentos/tela.tsx`, `cartoes/detalhando-cartao.tsx` | Progresso de quitação, % do plano |
| Pílulas de situação (verde-menta "Pago") e etiquetas ("Parcial", "Com juros", "Restante") | lista de Lançamentos | Situação da dívida e da parcela |
| Janela "Detalhando ..." com abas (Resumo e listas) | `contas/detalhando-conta.tsx`, `cartoes/detalhando-cartao.tsx` | **Detalhando Dívida** |
| Estado vazio com o mascote Gui e um botão que leva ao lugar certo | `components/ui/estado-vazio.tsx` | Primeiro acesso de cada tela |
| Confirmações antes de excluir/desfazer, avisos com o mesmo texto simples | padrão atual | Renegociar, aprovar plano, pagar |
| Gráficos (Recharts) com a paleta do Gui | `components/visao-geral/graficos.tsx` | Evolução do saldo devedor, simulador |
| Impressão em PDF e exportação Excel/CSV com "Filtros Utilizados" | `components/exportacao/*` | Listas e simulações |
| Textos em português do Brasil, frases curtas, sem jargão sem explicação | todo o sistema | Todo o módulo |

Regra para quem for construir: **antes de criar um componente novo, procure o equivalente na vitrine `/componentes` e nas telas existentes**. Componente novo só quando não existir nada parecido (ex.: a linha do tempo do histórico da dívida), e mesmo assim com as cores, bordas, cantos e fontes da paleta (verde `#135D3B`, amarelo-creme `#F6F7D7`, fundo `#F1F3F5`, borda `#E2E8F0`, azul `#1D6CE0`, laranja `#E04F16`).

Cores de gravidade dos alertas (reaproveitando a paleta, sem cor nova): **Alta** laranja-coral `#E04F16`, **Atenção** amarelo (o mesmo das faixas e do aviso de vencimento do dia), **Informação** azul `#1D6CE0`, **Boa notícia** verde `#15803D` sobre `#DCFCE7`.

### 4.2. Menu e abas (Proposta técnica)

O menu Gestão ganha **um item** (em vez de seis), para o dropdown continuar limpo como na imagem atual:

- Gestão > **Orçamentos** — Limites de gasto por categoria e mês. (já existe)
- Gestão > **Gestão de Dívidas** — Suas dívidas, acordos e plano para quitar.

Dentro da Gestão de Dívidas, as seis áreas são **abas no topo da tela**, no mesmo estilo das abas de Lançamentos (Todos, Receitas, Despesas, Transferências). Cada aba tem endereço próprio, para funcionar com favoritos e com o botão voltar do navegador:

| Aba | Endereço | Painel da direita |
|---|---|---|
| Visão Geral | `/gestao/dividas` | Central de Ajuda |
| Minhas Dívidas | `/gestao/dividas/minhas` | Filtros |
| Negociações | `/gestao/dividas/negociacoes` | Filtros |
| Simulador | `/gestao/dividas/simulador` | Central de Ajuda |
| Plano de Quitação | `/gestao/dividas/plano` | Central de Ajuda |
| Consultor Gui | `/gestao/dividas/consultor` | Lista de assuntos |

⚠️ Lacuna 1: se a pessoa preferir as seis áreas direto no dropdown do Gestão, é só trocar o item em `lib/menu.ts`; as telas não mudam.

## 5. Conceitos (em palavras simples)

- **Credor**: com quem se deve (banco, loja, pessoa). Usa o cadastro de **Clientes e Fornecedores** que já existe, para não ter dois cadastros de pessoas. Dá para criar o credor na hora, dentro do cadastro da dívida (modal sobre modal, como em Novo Lançamento).
- **Dívida**: o contrato ou relacionamento com o credor. Ex.: "Empréstimo pessoal Banco X", "Acordo Loja Y", "Dinheiro emprestado do João".
- **Parcela** (ou obrigação): cada valor a pagar numa data. **É um lançamento de despesa do Gui**, ligado à dívida.
- **Saldo devedor**: quanto falta pagar hoje. Pode ser:
  - **pelas parcelas**: soma das parcelas ainda não pagas;
  - **estimado**: o Gui aplica multa e juros de atraso nas parcelas vencidas;
  - **informado**: o valor que o credor disse (extrato, app do banco, boleto de quitação). **O último informado vale** até haver outro ou até entrarem pagamentos depois dele.
- **Encargos**: juros, multa, tarifas, seguros cobrados a mais.
- **Acordo**: dívida nova nascida de uma renegociação, ligada à(s) original(is).
- **Reserva**: o dinheiro guardado para emergências. Proposta: a soma das contas financeiras do tipo **Poupança** e **Investimento** (que já existem no cadastro), e a pessoa pode marcar/desmarcar contas.
- **Sobra mensal (disponível para dívidas)**: quanto sobra por mês depois das despesas normais, que pode ir para as dívidas além das parcelas.

## 6. As obrigações e como elas entram no módulo

### 6.1. Dívidas cadastradas no módulo

Na criação, a pessoa escolhe como a dívida é paga:

1. **Parcelas fixas** (empréstimo, financiamento, crediário, acordo): informa valor da parcela (ou valor total), quantidade, primeiro vencimento e periodicidade. O Gui grava **as parcelas como lançamentos de despesa não pagos**, usando a mesma rotina do parcelamento que já existe (`parcelamento`, com "1/12, 2/12...") e ligando cada uma à dívida. Elas aparecem na hora em Lançamentos, Agenda, Vencidos e Notificações.
2. **Parcelas já pagas em parte** (dívida antiga): "Já paguei X parcelas". O Gui grava só as que faltam (proposta) ou, se a pessoa quiser o histórico, grava as antigas como pagas **sem mexer no saldo da conta** (⚠️ Lacuna 2: lançamentos antigos pagos mexem no saldo da conta; proposta: **não gravar as antigas**, só registrar no histórico da dívida "12 parcelas pagas antes do cadastro, total R$ ...").
3. **Sem parcelas definidas** (pessoa física, "pago quando der", conta atrasada): só o **saldo**. Não cria lançamento. Cada pagamento é registrado pelo botão **Pagar** da dívida, que cria um lançamento já pago na conta escolhida. Opcional: "Lembrar todo mês no dia X" cria um **recorrente** ligado à dívida.

Campos do cadastro (modal no padrão do Gui):

| Campo | Obrigatório | Observação |
|---|---|---|
| Descrição | Sim | "Empréstimo pessoal Banco X" |
| Credor | Sim | Clientes e Fornecedores, com criação rápida |
| Tipo | Sim | Empréstimo pessoal, Consignado, Financiamento de veículo, Financiamento imobiliário, Cartão (rotativo ou parcelamento de fatura), Cheque especial, Crediário/loja, Pessoa física, Conta atrasada, Acordo, Outro |
| Valor original e data de contratação | Não | Para o histórico e o "quanto já paguei" |
| Forma de pagamento | Sim | Parcelas fixas / Sem parcelas definidas |
| Parcelas | Se parcelas fixas | Quantidade, valor, primeiro vencimento, periodicidade (as mesmas do parcelamento) |
| Saldo devedor hoje | Se sem parcelas, ou para corrigir | Vira a primeira "atualização de saldo" |
| Taxa de juros | Não (opcional para pessoa física) | Ao mês ou ao ano; o Gui converte (seção 8.1). Sem taxa, o simulador avisa que o cálculo é aproximado |
| Multa e juros de atraso | Não | Padrão proposto: multa 2% e juros de mora 1% ao mês (os valores mais comuns no Brasil); editável por dívida |
| Garantia ou risco | Não | Nenhuma, Bem financiado (carro, imóvel), Desconto em folha, Fiador/avalista. Usado na "análise de risco" |
| Conta de pagamento | Sim | Conta financeira de onde saem as parcelas (sugere a última usada) |
| Categoria | Sim | ⚠️ Lacuna 3: proposta de criar, ao ligar o módulo, a categoria **13. Dívidas** com **13.1 Parcelas de Dívidas** e **13.2 Juros e Encargos** (só se não existir). A pessoa pode escolher outra |
| Forma de pagamento (Pix, boleto...), Tags, Observação | Não | Os mesmos do lançamento |
| Registrar a entrada do dinheiro | Não | Para empréstimo novo: cria uma receita na conta com o valor recebido. ⚠️ Lacuna 4 (categoria dessa entrada; proposta: 1.8 Outro) |

### 6.2. Obrigações que já estão no Gui (sem cadastrar de novo)

A aba Minhas Dívidas tem, abaixo da lista, a seção **"Contas em aberto no Gui"** (ou um filtro "Origem: Gui"). Ela é **calculada na hora**, como as Notificações, e mostra:

- **Faturas de cartão** fechadas e não pagas (e a atual, se a pessoa ligar a opção);
- **Lançamentos de despesa vencidos e não pagos** (fora os que já são parcela de uma dívida);
- **Recorrentes de despesa** que a pessoa marcar como dívida (ex.: consignado, pensão).

Cada linha mostra a origem ("Fatura-Cartão Nubank dez/2026", "Lançamento: Conta de luz") com o link para o registro original. No menu de três pontos:

- **Pagar**: abre a **mesma janela** do módulo de origem (Pagar fatura, ou Pagar do lançamento com pagamento parcial e juros).
- **Acompanhar como dívida**: liga o registro a uma dívida (nova ou existente). Para lançamentos, grava a ligação no próprio lançamento (coluna nova `divida_id`); para faturas e recorrentes, numa tabela de vínculo. **O registro original não muda**: o valor, a data, a categoria e a conta continuam os mesmos. **Desligar** desfaz a ligação.
- **Abrir no módulo de origem**.

Assim cada obrigação existe **uma vez só**. Totais do módulo contam o lançamento ou a fatura uma única vez, mesmo que apareçam nas duas telas.

### 6.3. Pagamento e rastreabilidade

- Pagar uma parcela (pelo módulo ou por Lançamentos, tanto faz) usa a janela **Pagar** atual: Valor Pago, **Pagamento parcial** (o restante vira outro lançamento, **ligado à mesma dívida**), **Desconto**, ou valor maior que fica como **juros/multa** (etiqueta "Com juros"). Nenhum caminho novo de pagamento.
- O lançamento do restante herda a ligação com a dívida (pequeno ajuste na rotina de pagamento parcial, com teste).
- **Pagamento extra / amortização** (dívida com parcelas fixas): o botão **Amortizar** registra um pagamento fora das parcelas. A pessoa escolhe: **reduzir o valor das próximas parcelas** ou **reduzir a quantidade** (quitar as últimas). O Gui mostra antes como as parcelas ficam e só grava depois do "Confirmar". As parcelas alteradas ficam com a etiqueta "Ajustada" e o valor anterior no histórico.
- **Quitar**: paga o saldo de uma vez (com o desconto que o credor der). As parcelas restantes são **excluídas** (registradas na auditoria e no histórico da dívida) e a dívida fica **Quitada**.
- **Voltar para não pago** em Lançamentos continua funcionando e o módulo recalcula sozinho (a dívida volta a Ativa se estava Quitada).
- Duplicidade: a parcela é um lançamento só; a importação de extrato **concilia** com ela como com qualquer lançamento (regra atual: um lançamento só concilia com uma linha). Não há "pagamento da dívida" separado do lançamento.
- **Histórico da dívida** (linha do tempo): cadastro, cada pagamento (com link para o lançamento), atualização de saldo, encargo lançado, amortização, renegociação, quitação, ligação/desligamento de obrigações, anotações livres. Correções nunca apagam o passado: aparecem como um evento novo ("Saldo corrigido de R$ 5.200,00 para R$ 4.980,00 conforme extrato").

### 6.4. Juros, multas e atualização do saldo

- **Estimativa automática**: para parcelas vencidas, o Gui mostra o valor estimado = parcela + multa + juros de mora proporcionais aos dias (seção 8.2). A estimativa aparece **ao lado** do valor; o lançamento não muda sozinho.
- **Atualizar saldo**: a pessoa informa o saldo real (data, valor, de onde veio: extrato, app, boleto, ligação). Fica no histórico. A diferença para o estimado aparece ("O credor informou R$ 220,00 a mais que o estimado").
- **Lançar encargo** (opcional): quando o credor cobra uma tarifa ou juro que precisa ser pago, a pessoa pode criar uma despesa ligada à dívida na categoria Juros e Encargos.

### 6.5. Situações da dívida

| Situação | Quando |
|---|---|
| **Em dia** | Ativa e sem parcela vencida |
| **Em atraso** | Ativa com alguma parcela vencida e não paga (mostra há quantos dias) |
| **Em negociação** | Tem uma negociação em andamento (seção 7.2) |
| **Quitada** | Nada a pagar |
| **Renegociada** | Encerrada por um acordo (link para o acordo) |
| **Cancelada** | Cadastrada por engano ou perdoada; não conta nos totais |

## 7. Telas

### 7.1. Visão Geral (`/gestao/dividas`)

Primeira parte, **indicadores** (cartões brancos no estilo da Visão Geral principal, com o olho para ocultar valores):

- **Total devido** (soma dos saldos devedores; mostra "estimado" quando há atraso) e mini gráfico da evolução nos últimos 12 meses.
- **Em atraso**: valor e quantidade de parcelas, com "há N dias" da mais antiga. Clique abre a lista.
- **Vence em 30 dias**: valor e quantidade.
- **Parcelas do mês**: quanto as dívidas tiram do mês e **% da renda** (parcelas do mês ÷ receitas médias), com a barra de progresso dos Orçamentos (verde até 30%, amarelo até 50%, laranja acima; limites editáveis em "Opções").
- **Juros estimados por mês**: quanto as dívidas com taxa custam por mês.
- **Previsão de quitação**: mês e ano em que tudo acaba (pelo plano ativo; sem plano, pagando só as parcelas).
- **Progresso**: quanto já foi pago do total (barra).
- **Dívidas por credor** ou **por tipo** (rosca, como Despesas por Categorias).

Segunda parte, **Análises e recomendações** do Consultor Gui (seção 7.6): cartões em ordem de gravidade, cada um com o título, a explicação em uma ou duas frases, o botão **"Por quê?"** (abre o cálculo) e a ação sugerida ("Simular", "Abrir negociação", "Atualizar saldo"). Menu de três pontos: Dispensar, Lembrar em 7 dias.

Estado vazio: mascote Gui com "Você ainda não cadastrou dívidas" e os botões **Cadastrar dívida** e **Ver contas em aberto no Gui**.

### 7.2. Minhas Dívidas (`/gestao/dividas/minhas`)

Lista padrão do Gui: barra com **+ Adicionar**, Imprimir, Configurações da Listagem e busca; painel Filtros (Credor, Tipo, Situação, Conta; aba Avançado).

Colunas: Dívida (descrição e credor embaixo, ícone do banco quando houver), Tipo, Situação (pílula), Próximo vencimento, Parcelas (pagas/total), Taxa (% a.m.), **Saldo devedor** (com "estimado" ou "informado em dd/mm"), Progresso (barra). Faixa amarela no fim: **Total devido**.

Menu de três pontos: Detalhar, Pagar próxima parcela, Amortizar, Quitar, Atualizar saldo, Renegociar, Simular quitação, Editar, Clonar, Cancelar dívida.

Abaixo: **Contas em aberto no Gui** (seção 6.2).

**Detalhando Dívida** (janela no padrão Detalhando Conta/Cartão), com abas:

- **Resumo**: saldo devedor (pelas parcelas, estimado e informado), valor original, total já pago, juros e encargos pagos, taxa, próximo vencimento, previsão de término, anel de progresso, gráfico do saldo ao longo do tempo.
- **Parcelas**: as parcelas (lançamentos) com situação, valor, valor estimado com atraso e os botões do lançamento (Pagar, Editar, Ver lançamento).
- **Histórico**: a linha do tempo (seção 6.3), com campo para anotação livre.
- **Vínculos**: faturas, recorrentes e lançamentos ligados; e, se for acordo, a(s) dívida(s) original(is); se renegociada, o acordo.

### 7.3. Negociações (`/gestao/dividas/negociacoes`)

Para acompanhar a conversa com o credor **antes** de virar acordo.

- **Nova negociação**: credor, dívida(s) envolvida(s) (uma ou várias do mesmo credor), canal (telefone, app, agência, site, feirão, advogado), protocolo, data, prazo de resposta, observação.
- **Propostas** dentro da negociação: quem propôs (credor ou eu), à vista com desconto ou parcelado (entrada, quantidade, valor da parcela, primeiro vencimento), validade. Para cada proposta o Gui calcula e mostra: total a pagar, **desconto sobre o saldo**, **juros implícitos ao mês** (a taxa que torna as parcelas iguais ao saldo), comparação com a dívida atual e com a reserva, e se a parcela **cabe na sobra mensal**. Botão **Simular** leva a proposta ao Simulador.
- **Situações**: Em andamento, Proposta recebida, Aguardando resposta, Aceita, Recusada, Desistida.
- **Aceitar proposta** abre o assistente de **Renegociação** (seção 7.3.1). Nada é gravado em Lançamentos antes do "Confirmar".
- Lista com filtros (Credor, Situação, Período) e o menu de três pontos (Detalhar, Nova proposta, Aceitar, Recusar, Editar, Excluir).

#### 7.3.1. Renegociação (assistente em etapas, no estilo do assistente de Importação)

1. **Dívidas originais**: quais entram no acordo (uma ou várias).
2. **Condições do acordo**: entrada, parcelas, vencimentos, taxa, conta, categoria (pré-preenchidos com a proposta aceita).
3. **Revisão**: mostra o que vai acontecer: "As 7 parcelas não pagas da dívida X (R$ 2.310,00) saem de Lançamentos; o acordo cria 10 parcelas de R$ 198,00 a partir de 10/01/2027." Aviso do Consultor se o acordo sair mais caro ou não couber no mês.
4. **Confirmar**: na mesma transação:
   - as dívidas originais ficam **Renegociadas** com a data e o link para o acordo;
   - as parcelas **não pagas** delas são retiradas de Lançamentos (para o Saldo Previsto não contar em dobro), com uma cópia completa guardada no histórico da dívida e na auditoria; **as pagas ficam intactas**;
   - vínculos de faturas ou recorrentes da dívida original são encerrados (o recorrente, se for só dessa dívida, é inativado com aviso);
   - a dívida **Acordo** é criada com as parcelas novas e a negociação fica Aceita.
- **Desfazer renegociação**: possível enquanto nenhuma parcela do acordo foi paga. Volta as parcelas originais (a partir da cópia guardada) e apaga o acordo. Depois do primeiro pagamento do acordo, não dá mais (o histórico explica por quê).

### 7.4. Simulador (`/gestao/dividas/simulador`)

**Só cálculo. Nada do que acontece aqui grava lançamento, altera dívida ou mexe em saldo.** A tela mostra no topo a faixa: "Simulação: nenhum dado real é alterado."

Entradas (lado esquerdo, cartões brancos):

- **Dívidas que entram** (todas as ativas marcadas; dá para desmarcar ou incluir uma **dívida hipotética**, ex.: "e se eu fizer um empréstimo para quitar o cartão?").
- **Quanto posso pagar por mês no total**: sugerido pela **sobra mensal** (seção 8.4), editável. Ou "pagar só as parcelas".
- **Pagamento extra pontual**: valor e mês (ex.: 13º em dezembro).
- **Uso da reserva**: quanto da reserva usar agora, respeitando a **reserva mínima** (padrão proposto: 3 meses de despesas médias; editável).
- **Estratégia**: Bola de Neve, Avalanche, Risco primeiro, Personalizada (arrastar a ordem, como em Organizar Categorias).

Modos (abas internas do Simulador):

1. **Quitar uma dívida**: quanto falta, quanto economiza quitando hoje, em X meses ou pagando R$ Y a mais por mês.
2. **Comparar estratégias**: as quatro estratégias lado a lado, numa tabela: data de quitação de tudo, total pago, total de juros, primeira dívida quitada e quando. Destaque da que economiza mais e da que libera parcela mais cedo.
3. **Cenários**: **Conservador**, **Intermediário** e **Acelerado** (seção 8.5) lado a lado, com o impacto no mês (sobra que fica) e na reserva.
4. **Proposta de negociação**: compara a proposta (à vista ou parcelada) com continuar como está e com quitar usando a reserva.

Resultados: tabela mês a mês (faixa amarela de totais), gráfico do saldo devedor caindo por dívida, e a frase-resumo do Consultor ("Com a Avalanche você termina em ago/2028 e paga R$ 1.240,00 a menos de juros que na Bola de Neve; a Bola de Neve quita o primeiro credor 5 meses antes."). Avisos quando o cenário deixa algum mês negativo ou a reserva abaixo do mínimo.

Botões: **Guardar simulação** (com nome, para comparar depois), **Imprimir/PDF**, **Criar plano a partir desta simulação** (leva à aprovação na tela do Plano, seção 7.5).

### 7.5. Plano de Quitação (`/gestao/dividas/plano`)

- **Criar plano**: a partir de uma simulação (ou do zero, escolhendo estratégia e valor mensal). A tela mostra o plano mês a mês e pede **Aprovar plano**. Só depois disso ele fica **Ativo**. Um plano ativo por vez; os anteriores ficam como **Substituído** ou **Encerrado**, com histórico.
- **O que aprovar faz**: grava o plano (meta de quanto pagar em cada dívida em cada mês). Pagamentos **extras** planejados (além das parcelas) podem ser **agendados** como lançamentos não pagos, **um a um, só com o "Agendar" da pessoa** (proposta: agendar só o mês atual e o seguinte, para não encher Lançamentos de previsões que mudam).
- **Acompanhamento** (planejado contra realizado), calculado na hora a partir dos lançamentos pagos ligados às dívidas:
  - tabela por mês: Planejado, Realizado, Diferença (azul acima, laranja abaixo), e situação do mês (Cumprido, Parcial, Não cumprido, Futuro);
  - barra do progresso geral e "previsão de quitação" recalculada com o realizado;
  - gráfico planejado x realizado do saldo devedor.
- **Desvios e ajustes**: quando o realizado fica abaixo do planejado, a renda cai, entra despesa ou dívida nova, ou a sobra muda mais que X%, o Gui mostra o cartão **"Seu plano precisa de ajuste"** com a proposta (ex.: "aumentar R$ 80,00 por mês de janeiro a junho" ou "adiar a quitação em 2 meses"), o cálculo e os botões **Aprovar ajuste** e **Manter como está**. Aprovar cria uma **nova versão** do plano; a anterior fica no histórico. **Nada muda sem o "Aprovar".**

### 7.6. Consultor Gui (`/gestao/dividas/consultor`)

**O que é**: um consultor que lê a situação inteira (dívidas, contas, cartões, recorrentes, orçamentos, reserva), aponta problemas, recomenda e explica as contas. Começa **sem IA**: tudo vem de regras e cálculos do próprio Gui, então é grátis, rápido e sempre igual para os mesmos números.

**Tela**: à esquerda a lista de **assuntos** (conversas): "Dívida do cartão Nubank", "Plano 2027", "Vale a pena usar a reserva?". Cada assunto guarda as perguntas, as respostas, os cálculos usados e as ações sugeridas. Botões: Novo assunto, Arquivar, Renomear. À direita, a conversa.

**Como perguntar sem IA** (fases 4 e 5):
- **Perguntas prontas** em botões, agrupadas: "Quanto eu devo no total?", "Qual dívida pagar primeiro?", "Cabe uma parcela de R$ X?", "Quanto economizo pagando R$ X a mais?", "Vale a pena usar a reserva?", "Essa proposta é boa?", "Quando fico livre das dívidas?", "Por que meu plano atrasou?", "Posso fazer uma compra parcelada de R$ X em N vezes?". Algumas pedem um número ou uma dívida antes de responder.
- **Campo de texto** que reconhece palavras-chave e números ("quanto devo", "primeiro", "reserva", "R$ 500") e leva à pergunta pronta certa; quando não entende, diz isso e mostra as opções. Sem IA, ele **não finge** entender texto livre.
- Cada resposta vem com: a **conclusão** em uma frase, os **números**, o **critério** usado ("ordenei pela maior taxa de juros"), **"Como calculei"** (expansível) e, quando couber, um **botão de ação** (Simular, Abrir negociação, Atualizar saldo).

**Personalidade** (texto das respostas e dos alertas):
- Técnico e didático: dá o número e explica em português simples o que ele quer dizer.
- Transparente: diz de onde veio cada número e quando é estimativa ("taxa não informada, usei 0%").
- Prudente: não promete resultado; avisa riscos; diz claramente **"não recomendo"** quando for o caso, explicando o motivo.
- Natural: frases curtas, sem jargão sem explicação, sem exagero e sem emoji.
- Rodapé fixo da tela: "O Consultor Gui faz contas com os seus dados e não substitui um profissional. Decisões e pagamentos são sempre seus."

**Alertas e recomendações** (regras da seção 8.6): aparecem na Visão Geral do módulo, no próprio Consultor (como mensagens do Gui no assunto "Alertas") e os mais graves no sino de **Notificações** do Gui.

**Questionar decisões**: em pontos críticos, o Gui mostra um aviso **antes do Confirmar**, com o motivo e os números, e os botões **Voltar** e **Continuar mesmo assim** (não bloqueia; a decisão é da pessoa):
- cadastrar dívida nova com taxa alta enquanto há plano ativo;
- aceitar acordo mais caro que a dívida atual ou que não cabe na sobra;
- usar a reserva abaixo do mínimo;
- aprovar plano que deixa algum mês negativo;
- compra parcelada nova no cartão que tira o plano do rumo (aviso no Novo Lançamento, ⚠️ Lacuna 5: se a pessoa quer esse aviso fora do módulo).

**Autorização expressa**: o Consultor **nunca** paga, cria, altera ou exclui nada sozinho. Toda ação sugerida abre a **janela normal** do Gui (Pagar, Nova Negociação, Atualizar Saldo, Aprovar Plano) já preenchida, e só grava quando a pessoa clica no botão de confirmar daquela janela. Isso vale também para a IA da fase 6.

### 7.7. Outras telas que mudam um pouco

- **Configurações > Recursos**: novo recurso **Gestão de Dívidas** (e, na fase 6, **Consultor com IA**, desligado por padrão).
- **Configurações > Parâmetros**, seção nova **Gestão de Dívidas**: multa e juros de atraso padrão, reserva mínima (meses de despesas), contas que formam a reserva, limites de % da renda, meses usados na média da sobra, alertas ligados/desligados.
- **Notificações** (sino): "Parcela da dívida X em atraso há N dias", "Acordo Y com parcela vencida", "Seu plano de quitação precisa de ajuste", "Saldo da dívida Z não é atualizado há 60 dias". Mesma regra atual: calculadas na hora, só o "lida" é gravado.
- **Lançamentos**: parcelas de dívida ganham a etiqueta **"Dívida"** (clicável, abre o Detalhando Dívida) e um filtro novo "Origem: Dívida" no Filtro Avançado. Nada mais muda na tela.
- **Visão Geral principal**: cartão opcional **Dívidas** (Total devido, Em atraso, Parcelas do mês) que pode ser escondido pelas Opções. ⚠️ Lacuna 6: se a pessoa quer esse cartão.
- **Auditoria**: as novas entidades aparecem com os mesmos filtros.

## 8. Regras de cálculo

Todas são funções puras (sem banco), em `src/lib/dividas/`, com testes do Vitest, como `lib/cartoes/regras.ts` e `lib/orcamentos/regras.ts`. Dinheiro sempre em **centavos inteiros**; arredondamento para o centavo mais próximo a cada mês (meio centavo sobe).

### 8.1. Taxas
- Guardadas **ao mês**, em porcentagem com até 4 casas (ex.: 2,9900% a.m.).
- Ao ano para ao mês: `(1 + anual)^(1/12) − 1`. Ex.: 12% a.a. = 0,9489% a.m. A tela mostra os dois.
- Sem taxa (pessoa física, sem juros): 0%.

### 8.2. Atraso (estimativa)
- **Multa**: % sobre o valor da parcela, uma vez.
- **Juros de mora**: % ao mês, **proporcional aos dias** (`parcela × mora/30 × dias`).
- **Juros contratuais** durante o atraso: aplicados ao mês sobre a parcela, pela taxa da dívida (⚠️ Lacuna 7: cada credor calcula de um jeito; proposta: estimar com multa + mora + taxa da dívida e deixar claro que é aproximado).

### 8.3. Saldo devedor
- **Pelas parcelas** = soma das parcelas não pagas (valor do lançamento).
- **Estimado** = pelas parcelas + estimativa de atraso das vencidas.
- **Informado** = último saldo informado, menos os pagamentos feitos depois dessa data.
- Mostrado na tela: o **informado** quando existe e é mais recente que 60 dias; senão o **estimado**, com a etiqueta.
- **Valor presente para quitação** (quando há taxa): soma das parcelas futuras trazidas a hoje pela taxa (`parcela / (1 + i)^n`). É o "quanto deve sair a quitação hoje"; serve para checar se o desconto do credor é real.

### 8.4. Sobra mensal e reserva
- **Sobra mensal** (proposta) = média dos últimos **3 meses fechados** de (receitas − despesas que **não** são parcelas de dívida), pela data de pagamento, mais o que muda de forma conhecida nos próximos meses (recorrentes previstos). Usa as mesmas contas do Fluxo de Caixa, para os números baterem com os relatórios. A pessoa pode trocar o valor no simulador.
- Se houver **Orçamentos**, opção "usar o orçamento" no lugar da média de despesas.
- **Reserva** = saldo atual das contas marcadas como reserva (padrão: tipo Poupança e Investimento).
- **Reserva mínima** = N meses × despesas médias (padrão N = 3).

### 8.5. Estratégias e cenários
- Todas pagam **o mínimo (a parcela) de todas as dívidas** todo mês; o que sobra do valor mensal vai para a **dívida da vez**; quando uma acaba, o valor dela passa para a próxima ("efeito bola de neve" em todas).
- **Bola de Neve**: dívida da vez = menor saldo.
- **Avalanche**: dívida da vez = maior taxa de juros.
- **Risco primeiro**: ordem por gravidade das consequências: em atraso há mais tempo, garantia de bem (risco de perder carro/imóvel), maior taxa, depois menor saldo. Pesos explicados no "Como calculei".
- **Personalizada**: a ordem que a pessoa arrastar.
- **Cenários** (proposta, % editáveis em Parâmetros):
  - **Conservador**: só as parcelas + 25% da sobra; reserva intocada.
  - **Intermediário**: parcelas + 50% da sobra; reserva intocada.
  - **Acelerado**: parcelas + 100% da sobra + o que passar da reserva mínima, uma vez.
- Simulação mês a mês até tudo zerar, com limite de 360 meses (avisa "não quita em 30 anos com esse valor" quando o pagamento não cobre os juros).
- **Juros implícitos de uma proposta**: a taxa que faz o valor presente das parcelas igual ao valor à vista (cálculo por aproximação, bisseção, testado).

### 8.6. Regras do Consultor (alertas e recomendações iniciais)

Cada regra devolve: gravidade, título, texto, "Como calculei" (os números), ação sugerida e link. Limites entre parênteses são o padrão proposto e ficam em Parâmetros.

| # | Regra | Gravidade |
|---|---|---|
| R1 | Parcela de dívida em atraso (mostra estimativa de multa e juros já acumulados) | Alta |
| R2 | Parcelas do mês acima de % da renda (30% atenção, 50% alta) | Atenção/Alta |
| R3 | Saldo previsto do próximo mês não cobre as parcelas | Alta |
| R4 | Dívida com taxa muito alta (acima de 6% a.m.: cheque especial, rotativo) | Alta |
| R5 | Reserva acima do mínimo e dívida com taxa maior que o rendimento estimado da reserva: "avalie usar R$ X da reserva" | Informação |
| R6 | Reserva abaixo do mínimo enquanto paga extra nas dívidas: "priorize recompor a reserva" | Atenção |
| R7 | Dívida atrasada há mais de 90 dias: credores costumam oferecer desconto nessa fase, vale abrir negociação | Informação |
| R8 | Saldo informado há mais de 60 dias, ou dívida sem taxa | Informação |
| R9 | Plano ativo com mês anterior não cumprido | Atenção |
| R10 | Dívida nova ou compra parcelada grande depois do plano aprovado | Atenção |
| R11 | Só pagando o mínimo com sobra positiva: "pagar R$ X a mais termina N meses antes" | Informação |
| R12 | Dívida quitada, parcela liberada: "redirecionar R$ X para a próxima" | Boa notícia |
| R13 | Fatura de cartão alta e recorrente fechada e não paga (sinal de rotativo) | Alta |

⚠️ Lacuna 8: rendimento estimado da reserva (R5). Proposta: campo em Parâmetros, padrão 0,8% a.m., editável.

## 9. Modelo de dados (Proposta técnica)

Só **acrescenta** (seção 3). Nomes no padrão do `src/db/schema.ts` (português, `snake_case` no banco). Campos comuns (`id`, `ativo`, `criado_em`, `atualizado_em`) não repetidos.

**Colunas novas em tabelas existentes** (todas opcionais):
- `lancamento.divida_id` → `divida`: liga a parcela (ou o lançamento acompanhado) à dívida. Índice.
- `acao_auditoria`: valores novos `renegociou` e `aprovou`.

**Tabelas novas**:

- **divida**: descricao, contato_id (credor), tipo, situacao (em_dia, em_atraso, quitada, renegociada, cancelada; "em atraso" e "em negociação" podem ser calculadas na hora, proposta: guardar só ativa/quitada/renegociada/cancelada), forma (parcelas_fixas, sem_parcelas), valor_original_centavos, data_contratacao, taxa_mensal (numeric 8,4), multa_percentual, mora_mensal, garantia, conta_id, categoria_id, forma_pagamento_id, parcelamento_id, observacao, encerrada_em, quitada_em.
- **divida_vinculo**: divida_id + **um** de fatura_id ou recorrencia_id (checagem "só um preenchido"); índice único em cada, para a mesma fatura ou recorrente não ficar em duas dívidas.
- **divida_evento** (histórico): divida_id, data, tipo (cadastro, pagamento, atualizacao_saldo, amortizacao, encargo, renegociacao, quitacao, vinculo, anotacao, desfeito), valor_centavos, saldo_centavos (na atualização), origem_saldo (extrato, app, boleto, contato, estimado), lancamento_id, descricao, dados (JSON: cópia das parcelas retiradas na renegociação, valores antes/depois).
- **divida_renegociacao**: acordo_id → divida, original_id → divida, negociacao_id. Permite um acordo juntar várias dívidas.
- **negociacao**: contato_id, situacao, canal, protocolo, data_inicio, prazo_resposta, observacao, acordo_id (quando aceita).
- **negociacao_divida**: negociacao_id, divida_id.
- **negociacao_proposta**: negociacao_id, data, quem_propos (credor, eu), modalidade (a_vista, parcelada), entrada_centavos, parcelas, valor_parcela_centavos, primeiro_vencimento, total_centavos, validade, situacao.
- **simulacao** (guardadas): nome, modo, parametros (JSON), resumo (JSON). Nunca liga a lançamentos.
- **plano_quitacao**: nome, versao, plano_anterior_id, situacao (rascunho, ativo, substituido, encerrado), estrategia, valor_mensal_centavos, reserva_minima_centavos, inicio (mês), parametros (JSON), aprovado_em.
- **plano_quitacao_mes**: plano_id, competencia (1º dia do mês), divida_id, planejado_centavos. (Realizado **não é gravado**: é calculado dos lançamentos pagos.)
- **plano_ajuste**: plano_id, criado_em, motivo, proposta (JSON), situacao (pendente, aprovado, recusado), decidido_em.
- **consultor_assunto**: titulo, situacao (aberto, arquivado), divida_id (opcional), atualizado_em.
- **consultor_mensagem**: assunto_id, autor (pessoa, gui, gui_ia), texto, dados (JSON: números usados, regra, ação sugerida), criado_em.
- **consultor_uso_ia** (fase 6): dia, chamadas, caracteres enviados, caracteres recebidos.
- Estado dos alertas (dispensado, adiado até) na tabela `configuracao`, como o "lida" das Notificações.

Mapa:

```
contato (credor) ── divida ─┬─ lancamento (parcelas, via lancamento.divida_id)
                            ├─ divida_vinculo ─┬─ fatura
                            │                  └─ recorrencia
                            ├─ divida_evento (histórico)
                            ├─ divida_renegociacao (acordo ↔ originais)
                            └─ negociacao_divida ── negociacao ── negociacao_proposta
plano_quitacao ─┬─ plano_quitacao_mes ── divida
                └─ plano_ajuste
simulacao (solta)        consultor_assunto ── consultor_mensagem
```

Código (proposta, seguindo a organização atual):
- `src/app/(sistema)/gestao/dividas/...` (telas: `page.tsx`, `tela.tsx`, `acoes.ts` por aba)
- `src/lib/dividas/regras.ts` (saldo, atraso, situação), `simulador.ts`, `plano.ts`, `consultor/regras.ts`, `consultor/perguntas.ts`, `servidor.ts` (carga do banco), cada um com `*.test.ts`.
- `src/components/dividas/` (Detalhando Dívida, janela de proposta, linha do tempo).

## 10. IA externa no Consultor (fase final e opcional)

- **Ligada só por escolha**, em Configurações > Recursos > **Consultor com IA**. Desligada, o Consultor continua igual (perguntas prontas e regras).
- **Provedor configurável** (Parâmetros > Consultor com IA): provedor, modelo, limite de chamadas por dia. Sugestão: **Google Gemini no plano gratuito** (chave criada no Google AI Studio). A chave vai na variável de ambiente `GUI_IA_CHAVE` da Vercel, **nunca** no banco ou no GitHub.
- **O que é enviado**: só um **resumo dos números** montado pelo Gui (totais, taxas, parcelas, sobra, reserva, plano), com as dívidas como "Dívida A, Dívida B" e o tipo (sem nome do credor, sem nome da pessoa, sem número de conta, documento ou descrição de lançamento) e a pergunta. As contas continuam sendo feitas pelo Gui; a IA **explica e conversa** em cima delas e não inventa números (instrução fixa e conferência: números da resposta que não estejam no resumo são marcados).
- **Aviso de privacidade** antes de ligar e no topo do chat: o texto vai para um serviço de fora; nos planos gratuitos, o provedor pode usar o conteúdo para melhorar os produtos dele (conferir os termos atuais na hora de ligar). Botão "Ver o que será enviado" mostra o resumo exato.
- **Economia**: só chama a IA quando a pergunta não é uma das prontas; resumo curto; histórico do assunto resumido; limite diário (padrão 20 chamadas); contagem em `consultor_uso_ia`; quando passa do limite ou o serviço falha, avisa e volta às perguntas prontas.
- **Ações**: a IA pode **sugerir** uma ação da lista fechada do Gui (Simular, Abrir negociação, Atualizar saldo, Criar plano); a sugestão vira um botão que abre a janela normal, que só grava com a confirmação da pessoa. A IA não tem como gravar nada.
- Respostas da IA aparecem com a marca "Resposta com IA", separadas das respostas calculadas do Gui.

## 11. O que dá e o que não dá para fazer

Tudo o que foi pedido **dá para fazer** no Gui atual, com o custo de hoje (zero), com estes limites honestos:

1. **O saldo real do credor não chega sozinho.** O Gui não tem Open Finance (decisão do projeto). Juros, IOF, seguros e tarifas de cada contrato o Gui só **estima**; o número certo é o que a pessoa informa. Por isso o botão Atualizar saldo e o alerta de saldo antigo.
2. **Rotativo do cartão.** Hoje a fatura do Gui é paga pelo total (não existe "pagar parte da fatura"). Uma dívida de rotativo ou parcelamento de fatura deve ser **cadastrada como dívida** (tipo Cartão), e a fatura original paga como está. Fazer o Gui pagar fatura em parte seria mexer no módulo de cartões, fora deste escopo (⚠️ Lacuna 9).
3. **Sem IA, o Consultor não entende texto livre de verdade.** Ele responde muito bem às perguntas prontas e aos números, mas não "conversa". A conversa livre só vem com a fase 6, e depende do plano gratuito do provedor (limites e termos mudam com o tempo).
4. **Não é aconselhamento profissional.** As recomendações são contas com regras claras; decisões e pagamentos são da pessoa.
5. **Juros de atraso por credor variam.** A estimativa usa as regras mais comuns e mostra que é aproximada.
6. **Recorrentes previstos não são gravados antes da hora** (regra do Gui). Um recorrente ligado a uma dívida entra no saldo pelo cálculo de previsão, e vira lançamento quando for pago, como hoje.

## 12. Lacunas e decisões provisórias

A pessoa pediu que as fases fossem construídas sem esperar (26/11/2026). Para cada lacuna vale a **proposta** abaixo como decisão provisória, escolhida por ser a mais segura (não mexe em dados existentes e dá para mudar depois). Quem construir segue a proposta; se a pessoa decidir diferente, muda numa fase de ajuste.

1. Menu: um item "Gestão de Dívidas" com abas (proposta) ou as seis áreas no dropdown?
2. Dívida antiga com parcelas já pagas: só registrar no histórico (proposta) ou gravar os lançamentos antigos?
3. Criar a categoria **13. Dívidas** (13.1 Parcelas de Dívidas, 13.2 Juros e Encargos) ao ligar o módulo? (proposta: sim)
4. Empréstimo novo: registrar a entrada do dinheiro na conta? Em qual categoria? (proposta: opcional, 1.8 Outro)
5. Aviso do Consultor ao fazer compra parcelada no Novo Lançamento, fora do módulo? (decisão provisória: **não** por enquanto, para não mexer na tela de Novo Lançamento; a regra R10 avisa depois, na Visão Geral do módulo)
6. Cartão "Dívidas" na Visão Geral principal? (decisão provisória: sim, mas só aparece quando o recurso está ligado e há dívida ativa, e pode ser escondido pelas Opções)
7. Estimativa de atraso: multa 2% + mora 1% a.m. + taxa da dívida, como padrão? (proposta: sim, editável por dívida)
8. Rendimento estimado da reserva para comparar com a taxa das dívidas (proposta: 0,8% a.m., editável).
9. Pagar fatura em parte (rotativo) no módulo de cartões: fica fora por enquanto? (proposta: fora; rotativo vira dívida cadastrada)
10. Percentuais dos cenários (25%, 50%, 100%) e reserva mínima (3 meses): servem como ponto de partida?
11. Fase 6: além do Gemini, quer deixar pronto um segundo provedor (ex.: Groq, também com plano gratuito)? (proposta: começar só com Gemini, com o código preparado para trocar)
12. O módulo deve ir para o celular (PWA) junto, ou o celular continua como fase separada do plano do Gui?
