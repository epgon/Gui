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

- **Fase 6 (Importação OFX e CSV)**: Financeiro > **Importações** (ou o botão **Importar** em Lançamentos). Um assistente
  em etapas: **enviar o arquivo** (OFX, CSV ou TXT, até 2 MB; planilha do Excel é recusada com a explicação de como salvar em
  CSV), **destino e checagem** (conta ou cartão, tolerância de datas e se procura em qualquer conta), **vínculo das colunas**
  (só no CSV: o Gui sugere sozinho e **memoriza** para o próximo arquivo da mesma conta, com prévia das 10 primeiras linhas) e
  **revisão**. Na revisão cada linha aparece como **Novo**, **Encontrado** (já existe um lançamento igual, inclusive um
  recorrente previsto), **Pendente** (mais de um pode ser) ou **Ignorado** (por regra ou porque já foi importado antes).
  Ações por linha e em lote: Adicionar Agora, Conciliar Agora, Ignorar, Preencher campos em branco, Editar Registro,
  Encontrar Lançamento, Criar Regra e Desfazer. **Regras** (aba Regras) preenchem categoria, descrição, contato, forma e tags
  ou ignoram registros; já vem pronta a que ignora o "Pagamento de fatura". Quando não há regra, a categoria é sugerida pelo
  histórico (a usada da última vez para a mesma descrição). **Cancelar** guarda a importação como rascunho para continuar
  depois; **Concluir** adiciona as novas que têm categoria e concilia as encontradas.

- **Fase 7 (Pagamento parcial)**: o lançamento detalhado, a observação (até 1000 caracteres) e os anexos já tinham chegado na
  Fase 2; esta fase completa o bloco com o **pagamento parcial**. Ao **Pagar** ou **Receber** um lançamento sozinho, a janela
  mostra o **Valor Pago** (já preenchido com o valor do lançamento). Se você pagar **menos**, escolhe entre **Pagamento parcial**
  (o que faltou vira um novo lançamento, ainda não pago, com o **Vencimento do Restante** que você escolher) ou **Desconto**
  (não falta nada). Se pagar **mais**, a diferença fica como juros ou multa. Na lista aparecem as etiquetas **Parcial**,
  **Com juros** e **Restante**. **Voltar para não pago** desfaz tudo: o lançamento volta ao valor de antes e o restante é apagado.

- **Fase 8 (Relatórios, PDF e exportação)**: **Relatórios > Fluxo de Caixa** (Diário, Mensal, Trimestral ou Anual) com Receitas,
  Despesas e Saldo por período, **Média** e **Total**; Receitas e Despesas abrem por categoria (principal, filha e neta).
  **Relatórios > Saldo Detalhado** por Dia, Mês, Ano, Categorias, Contas Financeiras, Clientes e Fornecedores, Formas de Pagamento
  e Tags, com Receitas, Despesas, Resultado e a linha "Total do Período". Os dois têm o intervalo "de ... a ...", os filtros
  Conta ou Cartão, Situação e **Considerar: Data** (vencimento, pagamento, referência ou compra), o painel de filtros (categoria,
  forma, contato e tag) e a engrenagem **Incluir as categorias** (Acerto de Saldo e Transferência, desligadas no início).
  O botão **Imprimir** gera o PDF com a faixa "Filtros Utilizados" e pergunta se você quer **Visualizar** ou fazer o **Download**;
  no mesmo botão há **Exportar para Excel** e **Exportar para CSV**. Esse botão também está em Lançamentos, Recorrentes e em todas
  as listas de Cadastros (Impressão Padrão), sempre com os filtros que estão na tela. Em **Cadastros > Categorias**, a opção
  **Detalhar** (menu de três pontinhos) mostra o gráfico dos últimos 12 meses e os últimos 10 lançamentos da categoria.

- **Fase 10 (Agenda)**: a Agenda já tinha chegado na Fase 3 (calendário do mês, anel de "% Realizado", total do dia e a janela
  Lançamentos do Dia com Adicionar, busca, Situação e Total dos Lançamentos). Esta fase acrescenta a **Central de Ajuda** ao lado
  (Início > Financeiro > Agenda), testes automáticos das contas do dia (total, % realizado e montagem das semanas) e um ajuste:
  o "% Realizado" só mostra 100% quando tudo do dia foi pago ou recebido (antes 99,6% aparecia como 100%).

- **Fase 11 (Refinamentos)**: o que faltava para o sistema ficar completo. Os **Planos** dos recorrentes já tinham chegado na Fase 3.
  - **Configurações > Parâmetros**: Título do sistema, "Novo ou Atualizado", cores e numeração das categorias, Previsão
    Recorrente, Pagamento Parcial, campos do lançamento (Documento, Data de Referência, Observação, Anexos), ordem das contas
    e cartões (arrastando), Campo Auxiliar de cada cadastro (ligar e dar nome) e **Feriados** (com botão para trazer os
    feriados nacionais do ano, inclusive Carnaval, Sexta-feira Santa e Corpus Christi).
  - **Configurações > Recursos**: liga e desliga Cartões, Recorrentes, Agenda, Clientes e Fornecedores, Formas de Pagamento,
    Tags, Orçamentos, Importação, Exportação e Impressão. O que está desligado some dos menus.
  - **Notificações** (sino da barra de cima e tela própria): contas vencidas e que vencem hoje, faturas perto do vencimento,
    orçamentos estourados, importações em rascunho e Meus Dados incompleto. Os avisos são calculados na hora; só o "lida" é gravado.
  - **Favoritos**: a estrela ao lado do título de cada tela coloca a tela na barra da esquerda (até 12).
  - **Filtro Avançado** (aba "Avançado" no painel de filtros) nos cadastros e em Lançamentos (com Origem: Lançamento, Conta ou
    Cartão, Categoria, Cliente ou Fornecedor, Forma de Pagamento, Tag). Até 5 condições, todas precisam valer.
  - **Configurações da Listagem** (engrenagem acima das listas de cadastros e da Auditoria): colunas visíveis, ordenação,
    itens por página, linhas zebradas e lista compacta.
  - **Campo Auxiliar** nos cadastros e a bolinha laranja de "novo ou atualizado".
  - **Organizar Categorias**: arrastar (ou usar as setas) para mudar a ordem e o nível das categorias.
  - **Impressão Personalizada** nas listas de cadastros: escolher campos, ordem, largura (Configurar Layout), orientação e
    ordenação, e guardar a impressão com um nome.
  - **Administração > Auditoria**: tudo o que foi cadastrado, alterado ou excluído, com filtros e os dados de cada registro.
    Guarda os últimos 6 meses.

- **Fase D1 (Gestão de Dívidas: cadastro e integração)**: primeira fase do módulo **Gestão > Gestão de Dívidas** (recurso ligado por
  padrão; dá para desligar em Configurações > Recursos sem apagar nada). Abas **Visão Geral** (Total devido, Em atraso e Vence em
  30 dias) e **Minhas Dívidas** (lista com filtros, busca, Imprimir/Exportar e cadastro com credor de Clientes e Fornecedores).
  - **Detalhando Dívida** com Resumo, Parcelas, Histórico e Vínculos; ações **Pagar parcela, Amortizar** (reduzindo o valor ou a
    quantidade das parcelas, com prévia), **Quitar, Atualizar saldo, Lançar encargo e Cancelar dívida**.
  - **Contas em aberto no Gui**: faturas fechadas e despesas vencidas, com Pagar, **Acompanhar como dívida** e Desligar. Nada é
    cadastrado em dobro.
  - Em **Lançamentos**, as parcelas ganham a etiqueta "Dívida" e o Filtro Avançado ganha a origem **Dívida**. Em
    **Configurações > Parâmetros** há a seção **Gestão de Dívidas** (multa e juros de mora padrão).
  - A migração 0010 só **acrescenta** tabelas e uma coluna; a categoria **13. Dívidas** só é criada se ainda não existir.
  - Ficou para as próximas fases: simulação de quitação (D3), Filtro Avançado e Configurações da Listagem em
    Minhas Dívidas, e a opção "Lembrar todo mês".

- **Fase D2 (Gestão de Dívidas: negociações e renegociação)**: nova aba **Negociações** (lista com filtros por credor, situação e
  período, busca, e o menu Detalhar, Nova proposta, Aceitar proposta, Recusar, Desistir, Editar e Excluir).
  - Cada negociação junta uma ou mais dívidas do **mesmo credor**, com canal, protocolo, prazo de resposta e a **sobra mensal**
    (digitada por enquanto; a sobra calculada chega com o Simulador). As **propostas** (do credor ou suas, à vista ou parceladas)
    mostram o total, o desconto ou acréscimo sobre o saldo, os **juros implícitos ao mês** e se a parcela cabe na sobra.
  - **Assistente de Renegociação** em três etapas (dívidas originais, condições do acordo, revisão com Confirmar), aberto pela
    proposta aceita ou direto pelo menu **Renegociar** da dívida. Ao confirmar, as dívidas originais ficam **Renegociadas**, as
    parcelas não pagas saem de Lançamentos (com cópia no Histórico e na Auditoria), o acordo é uma dívida nova com as parcelas e a
    negociação fica Aceita.
  - **Desfazer renegociação** (no acordo, enquanto nenhuma parcela dele foi paga) devolve exatamente as parcelas originais.
  - Dívidas com negociação em andamento mostram a situação **Em negociação**. A Auditoria ganhou as ações Renegociou e Aprovou.
  - A migração 0011 só **acrescenta** tabelas e valores de lista.
- **Fase D3 (Gestão de Dívidas: simulador)**: nova aba **Simulador** (só cálculo: nenhum lançamento, dívida ou saldo é alterado).
  Entradas: dívidas ativas (dá para desmarcar ou incluir uma **dívida hipotética**), valor por mês, pagamento extra pontual, uso da
  reserva e estratégia (**Bola de Neve, Avalanche, Risco primeiro, Personalizada**). Quatro modos: **Quitar uma dívida**, **Comparar
  estratégias**, **Cenários** (Conservador, Intermediário, Acelerado) e **Proposta de negociação**. Mostra frase-resumo, avisos (mês
  negativo, reserva abaixo do mínimo, não quita em 30 anos), gráfico, tabela mês a mês, **Guardar simulação** e Imprimir/PDF. Botão
  **Simular** na proposta de negociação e no menu e no detalhe da dívida; a negociação ganhou "Usar a sobra calculada". Em Parâmetros
  há reserva mínima, contas da reserva, meses da média e percentuais dos cenários. Pequenos itens deixados pela D2: **Filtro Avançado e
  Configurações da Listagem** em Minhas Dívidas e **Lembrar todo mês** (cria um recorrente ligado à dívida sem parcelas).

Todas as telas dos menus estão prontas.

### Como os relatórios funcionam

- Os totais batem com a lista de Lançamentos do mesmo período: entram os lançamentos gravados e também as parcelas e os
  **recorrentes previstos** (meses futuros), como na lista.
- Compras no cartão contam pelas **compras** (cada uma na sua categoria), na data de vencimento da fatura (ou na data da compra,
  com "Considerar: Data de Compra"). O **pagamento da fatura** não entra, para a despesa não contar duas vezes.
- Lançamento detalhado entra **item por item**, cada um na sua categoria.
- O saldo do Fluxo de Caixa é só o do período (receitas mais despesas); não inclui o dinheiro que as contas já tinham.
  O **Saldo Inicial** das contas e os acertos só entram com "Acerto de Saldo" ligado; transferências entre contas, com "Transferência".
- "Considerar: Data de Pagamento" mostra só o que já foi pago ou recebido. Referência e compra usam o vencimento quando o
  lançamento não tem essa data.
- Filtrar por uma categoria inclui as filhas dela. No relatório de Tags, um lançamento com duas tags aparece nas duas, por isso
  não há "Total do Período".
- Limites para a tela não travar: Diário até 62 dias, Mensal e Trimestral até 60 meses, Anual até 20 anos.
- Excel e CSV: valores como número (dá para somar na planilha). O CSV usa ";" e vírgula nos centavos, o padrão do Excel em português.

### Como o pagamento parcial funciona

- O lançamento pago passa a valer **o que foi pago** e o restante é outro lançamento ligado a ele. Assim saldo, Visão Geral e
  categorias somam pago + restante = valor original, sem contar nada duas vezes.
- Vale para receitas e despesas simples na conta, pagas uma por vez. Transferências, lançamentos detalhados e compras no cartão
  são pagos pelo valor total. Pagando vários de uma vez, cada um é pago pelo seu valor.
- O restante pode ser pago em parte de novo (gera outro restante).
- **Voltar para não pago** num lançamento pago em parte apaga o restante e devolve o valor original. Se o restante já foi pago,
  volte ele para não pago antes (ou escolha os dois juntos).

### Como a importação funciona

- **Adicionar** cria o lançamento já pago (na conta) com a data e o valor do extrato. No cartão, vira compra na fatura certa.
- **Conciliar** liga a linha a um lançamento que você já tinha registrado e marca esse lançamento como pago com a data e o
  valor do extrato. Se era um recorrente previsto (ex.: salário), a ocorrência é gravada já paga.
- Nada duplica: uma linha que já foi importada antes (mesmo código FITID do OFX, ou mesma data, valor e descrição no CSV)
  aparece como "Já importada antes" e fica ignorada; e um lançamento só pode ser conciliado com uma linha.
- Tudo dá para **desfazer** enquanto a importação está em rascunho. Excluir um rascunho desfaz o que ele já tinha feito.
- A primeira regra (pela **Ordem**) que atende à linha vale. A comparação ignora maiúsculas e acentos.

### Como as faturas funcionam

- A **fatura atual** de um cartão é a fatura fechada mais antiga que ainda falta pagar; se não houver, é a que está
  recebendo as compras de hoje.
- Uma compra feita **no dia do fechamento** já cai na fatura do mês seguinte.
- Uma compra já paga junto com a fatura pode ter a descrição, a categoria e as tags alteradas, mas não o valor, o cartão
  ou a fatura, nem ser excluída: para isso, desfaça antes o pagamento da fatura.
- Se entrar uma compra nova numa fatura já paga (ex.: você pagou antes de fechar), a fatura volta a mostrar o que falta
  pagar e pode ser paga de novo só com a diferença.

### Como a Gestão de Dívidas funciona

- Uma dívida pode ter **parcelas fixas** (cada parcela é um lançamento de despesa ligado à dívida, criado pela mesma rotina do
  parcelamento) ou **sem parcelas** (só o saldo; ao pagar, o Gui cria um lançamento já pago). Pagar sempre passa pelo mesmo
  caminho dos Lançamentos, então saldo das contas, pagamento parcial e auditoria valem igual.
- O **saldo devedor** vem de três fontes, nesta ordem: o que o credor **informou** (menos pagamentos feitos depois), a
  **estimativa de atraso** (parcela + multa de 2% uma vez + juros de mora de 1% ao mês, ajustáveis em Parâmetros ou por dívida)
  ou a **soma das parcelas em aberto**. Valores estimados aparecem marcados como "estimado".
- A situação (Em dia, Em atraso, Quitada) é calculada na hora; só Ativa, Quitada, Renegociada e Cancelada ficam gravadas.
- Dívida antiga com parcelas já pagas: só as que faltam viram lançamentos; as pagas ficam no Histórico, sem mexer nos saldos.
- Quitar e cancelar apagam só as parcelas ainda não pagas (com cópia no Histórico e na Auditoria); o que já foi pago fica.

### Como a renegociação funciona

- Uma negociação **não mexe em nada** até você aceitar uma proposta: só registra a conversa. Enquanto estiver em andamento, as
  dívidas dela aparecem como **Em negociação** (continuam contando nos totais e mostrando os dias de atraso).
- Os **juros implícitos** de uma proposta são a taxa ao mês que faz as parcelas valerem o saldo de hoje (financiado = saldo menos
  entrada, tabela Price). Parcelas que somam menos que o saldo são desconto, não juros.
- Ao **confirmar** o acordo, tudo acontece numa transação só: o acordo nasce como dívida de tipo Acordo (a entrada, se houver, é a
  parcela 1); só saem de Lançamentos as parcelas **não pagas** das dívidas originais (as pagas ficam intactas), então o Saldo
  Previsto não conta em dobro. Faturas acompanhadas deixam de ser acompanhadas (a fatura continua no cartão) e recorrentes
  acompanhados são inativados.
- **Desfazer** só vale enquanto o acordo está ativo e sem nenhuma parcela paga. Ele recria as parcelas originais com os mesmos
  números, reativa vínculos e recorrentes, apaga o acordo e reabre a negociação.

### Como o simulador funciona

- É só cálculo: guardar uma simulação grava apenas o nome, as escolhas e o resumo (tabela `simulacao`).
- **Sobra mensal** = média dos últimos meses fechados (padrão 3) de receitas menos despesas pagas, **sem as parcelas de dívida**, com as
  mesmas contas do Fluxo de Caixa. É o quanto dá para pagar por mês em todas as dívidas, parcelas incluídas. **Reserva** = saldo das
  contas marcadas em Parâmetros (padrão: Poupança e Investimento); **reserva mínima** = N meses de despesas médias (padrão 3).
- Cada mês: pagam-se as parcelas e o extra (na dívida da vez) e, sobre o que sobra, incidem os juros. As parcelas futuras entram a valor
  presente pela taxa da dívida e o atraso estimado cai no mês atual. Quando uma dívida acaba, o valor dela passa para a próxima. Limite de
  360 meses.
- Cenários: parcelas mais o percentual da **sobra livre** (sobra mensal menos as parcelas); o Acelerado também usa, uma vez, o que passa
  da reserva mínima.

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
| `drizzle/` | Migrações: `0000` cria as tabelas, `0001` faz a carga inicial, `0002` cria a auditoria e o saldo inicial das contas, `0003` os lançamentos, `0004` os recorrentes e planos, `0005` liga o pagamento de fatura à fatura paga, `0006` a importação, `0007` o pagamento parcial. |
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
