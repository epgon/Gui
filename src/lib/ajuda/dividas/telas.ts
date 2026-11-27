/**
 * Central de Ajuda da Gestão de Dívidas: artigos sobre cada tela (assunto "telas").
 * Os nomes de botões, campos e situações são os mesmos das telas.
 */
import type { ArtigoAjuda } from "@/lib/ajuda/tipos";

export const ARTIGOS_TELAS: ArtigoAjuda[] = [
  // ---------------------------------------------------------------------------
  // Visão Geral
  // ---------------------------------------------------------------------------
  {
    id: "visao-geral-numeros",
    titulo: "O que cada número da Visão Geral mostra",
    resumo: "Explica os quadros da primeira aba: total devido, atraso, próximos vencimentos, juros, previsão e gráficos.",
    assunto: "telas",
    telas: ["visao"],
    palavras: ["painel", "indicadores", "resumo", "quanto devo", "total devido", "gráfico", "rosca", "por credor", "por tipo", "evolução", "olho", "ocultar valores", "juros por mês"],
    blocos: [
      { tipo: "p", texto: "A aba **Visão Geral** junta os números de todas as suas dívidas ativas. Ela só lê os seus dados. Nada é alterado aqui." },
      { tipo: "titulo", texto: "Os quadros do topo" },
      {
        tipo: "lista",
        itens: [
          "**Total devido**: a soma do saldo de todas as dívidas ativas. Se algum valor é estimado, aparece \"inclui valores estimados\". O gráfico pequeno mostra os últimos meses, calculado pelas parcelas.",
          "**Em atraso**: parcelas vencidas e não pagas das dívidas ativas. Mostra quantas são e há quantos dias a mais antiga venceu.",
          "**Vence em 30 dias**: parcelas que vencem de hoje até daqui a 30 dias.",
          "**Parcelas do mês**: o que as dívidas tiram deste mês (parcelas com vencimento no mês, pagas ou não) e quanto isso é da sua renda média. O artigo sobre comprometimento da renda explica a conta.",
          "**Juros estimados por mês**: o saldo de cada dívida que tem taxa, multiplicado pela taxa ao mês. Dívida sem taxa informada não entra. É uma estimativa do que as dívidas custam por mês.",
          "**Previsão de quitação**: o mês em que tudo acaba pagando só as parcelas. Se existe um Plano de Quitação ativo, vale a previsão dele. Quando há dívida sem parcelas definidas, a data é aproximada.",
        ],
      },
      { tipo: "titulo", texto: "Mais abaixo" },
      {
        tipo: "lista",
        itens: [
          "**Progresso do pagamento**: a barra mostra quanto já foi pago (**Pago**) e quanto **Falta**. Embaixo aparecem as contas em aberto no Gui, com o link **Ver contas em aberto**.",
          "**Dívidas por credor**: a rosca mostra como o total se divide. No menu do cartão, use **Ver por credor** ou **Ver por tipo**. As maiores aparecem separadas e o resto vira \"Outras\".",
          "**Dívidas ativas**: a lista com cada dívida, a situação e o saldo. Clique numa linha para abrir os detalhes.",
          "**Análises e recomendações**: os alertas do Consultor Gui, do mais grave para o menos grave. Cada um tem o botão **Por quê?** com a conta.",
        ],
      },
      { tipo: "dica", texto: "Para esconder os valores na tela (por exemplo, se alguém está olhando), use o ícone de olho ao lado do título **Como estão suas dívidas**." },
      { tipo: "atencao", texto: "Os valores em atraso são estimativas (multa e juros de mora). O saldo certo é o que o credor informa. Para corrigir, abra a dívida em Minhas Dívidas e use **Atualizar saldo**." },
      { tipo: "p", texto: "Clicando no menu de cada quadro você vai direto para a tela relacionada (por exemplo, **Ver as dívidas** ou **Ver o Simulador**)." },
    ],
    relacionados: ["comprometimento-da-renda", "alertas-do-consultor", "atualizar-saldo", "situacoes-da-divida", "primeiros-passos"],
  },
  {
    id: "comprometimento-da-renda",
    titulo: "Quanto da minha renda vai para as dívidas",
    resumo: "Mostra como o quadro Parcelas do mês compara as parcelas com a sua renda média e como mudar os limites.",
    assunto: "telas",
    telas: ["visao"],
    palavras: ["comprometimento", "renda", "porcentagem", "percentual", "barra", "verde amarelo laranja", "limite", "30%", "50%", "parcelas do mês", "orçamento apertado", "endividamento"],
    blocos: [
      { tipo: "p", texto: "O quadro **Parcelas do mês**, na **Visão Geral**, mostra quanto das suas receitas vai embora só com as parcelas das dívidas." },
      { tipo: "titulo", texto: "Como é calculado" },
      {
        tipo: "passos",
        itens: [
          "O Gui soma as parcelas das dívidas com vencimento neste mês, pagas ou não.",
          "Calcula a sua renda média: a média mensal das receitas dos últimos meses fechados. Por padrão são 3 meses. Os lançamentos ligados a dívidas ficam de fora.",
          "Divide uma pela outra. O resultado aparece como \"% da renda média\".",
        ],
      },
      {
        tipo: "exemplo",
        titulo: "Exemplo",
        linhas: [
          ["Renda média", "R$ 5.000,00"],
          ["Parcelas do mês", "R$ 1.750,00"],
          ["Resultado", "35% da renda média: Atenção: acima do limite"],
        ],
      },
      { tipo: "titulo", texto: "As cores da barra" },
      {
        tipo: "lista",
        itens: [
          "**Verde** (Dentro do limite): até 30% da renda.",
          "**Amarelo** (Atenção: acima do limite): acima de 30% e até 50%.",
          "**Laranja** (Alta: acima do limite alto): acima de 50%.",
        ],
      },
      { tipo: "p", texto: "Os limites de 30% e 50% são os padrões. O limite fica no valor exato: 30% ainda é verde, 30,1% já é amarelo." },
      { tipo: "titulo", texto: "Para mudar os limites" },
      {
        tipo: "passos",
        itens: [
          "No menu do quadro **Parcelas do mês**, clique em **Alterar os limites**. Você vai para Configurações > Parâmetros, na seção **Gestão de Dívidas**.",
          "Em **Consultor Gui (alertas e recomendações)**, mude **Parcelas acima de (% da renda): atenção** e **Parcelas acima de (% da renda): alta**.",
          "Clique em salvar. Os mesmos limites valem para o alerta R2 do Consultor.",
        ],
      },
      { tipo: "dica", texto: "Se aparecer \"Ainda sem renda média para comparar\", faltam meses fechados com receitas lançadas. Depois do primeiro mês completo com receitas, a conta aparece." },
    ],
    relacionados: ["visao-geral-numeros", "alertas-do-consultor", "sobra-e-reserva"],
  },

  // ---------------------------------------------------------------------------
  // Negociações
  // ---------------------------------------------------------------------------
  {
    id: "negociacao-passo-a-passo",
    titulo: "Como registrar uma negociação do começo ao fim",
    resumo: "Do primeiro contato com o credor até o acordo aceito, passo a passo.",
    assunto: "telas",
    telas: ["negociacoes", "minhas"],
    palavras: ["negociar", "acordo", "proposta", "credor", "banco", "renegociar", "renegociação", "desconto", "à vista", "parcelado", "entrada", "aceitar proposta", "feirão", "protocolo", "ligação", "ligar para o banco"],
    blocos: [
      { tipo: "p", texto: "Use a aba **Negociações** para guardar a conversa com o credor e comparar propostas. Enquanto você não aceita nada, **nada muda em Lançamentos**." },
      { tipo: "titulo", texto: "1. Abrir a negociação" },
      {
        tipo: "passos",
        itens: [
          "Na aba **Negociações**, clique em **Adicionar**. Abre a janela **Nova negociação**.",
          "Escolha o **Credor**. Só aparecem credores que têm dívida ativa.",
          "Marque as **Dívidas da negociação**. Uma negociação junta só dívidas do mesmo credor.",
          "Preencha o **Canal** (Telefone, Aplicativo, Agência, Site, Feirão, Advogado ou Outro), o **Protocolo** (número do atendimento), a **Data de Início** e o **Prazo de Resposta**.",
          "Em **Sobra Mensal**, digite quanto sobra por mês para pagar o acordo. Se o Simulador já calculou, use o link **Usar a sobra calculada**.",
          "Clique em **Salvar**.",
        ],
      },
      { tipo: "p", texto: "Daí em diante as dívidas escolhidas aparecem como **Em negociação**." },
      { tipo: "titulo", texto: "2. Registrar cada proposta" },
      {
        tipo: "passos",
        itens: [
          "No menu da linha, clique em **Nova proposta** (ou abra **Detalhar** e use o botão **Nova proposta**).",
          "Em **Quem Propôs**, escolha **O credor** ou **Eu**. Preencha a **Data da Proposta** e a **Validade**.",
          "Em **Modalidade**, escolha **Parcelada (com ou sem entrada)** ou **À vista, com desconto**.",
          "À vista: digite o **Valor à Vista**. Parcelada: preencha **Entrada** (pode ficar vazia), **Quantidade de Parcelas**, **Valor da Parcela** e **Primeiro Vencimento**.",
          "Olhe a conferência na janela: **Total do acordo**, **Desconto sobre o saldo** (ou **Acréscimo sobre o saldo**), **Juros implícitos** e **Cabe na sobra mensal?**.",
          "Clique em **Salvar**.",
        ],
      },
      {
        tipo: "exemplo",
        titulo: "Exemplo: proposta do credor",
        linhas: [
          ["Saldo das dívidas hoje", "R$ 10.000,00"],
          ["Modalidade", "Parcelada (com ou sem entrada)"],
          ["Entrada", "R$ 1.000,00"],
          ["Quantidade de Parcelas", "10"],
          ["Valor da Parcela", "R$ 500,00"],
          ["Total do acordo", "R$ 6.000,00"],
          ["Desconto sobre o saldo", "R$ 4.000,00 (40%)"],
        ],
      },
      { tipo: "p", texto: "Cada proposta nova do credor muda a situação da negociação para **Proposta recebida**. Uma proposta sua muda para **Aguardando resposta**." },
      { tipo: "titulo", texto: "3. Comparar" },
      {
        tipo: "p",
        texto: "Em **Detalhar**, cada proposta mostra **Total a pagar**, o desconto ou acréscimo, os **Juros implícitos** e se **Cabe na sobra mensal?**. A de menor total ganha a marca **Menor total**. Para ir mais fundo, clique em **Simular** na proposta: abre o Simulador no modo **Proposta de negociação**.",
      },
      { tipo: "titulo", texto: "4. Aceitar" },
      {
        tipo: "passos",
        itens: [
          "Na proposta escolhida, clique em **Aceitar e renegociar** (ou, no menu da linha, **Aceitar proposta**). Abre a janela **Renegociação** em três etapas.",
          "**Dívidas originais**: confira as dívidas e clique em **Continuar**.",
          "**Condições do acordo**: confira a **Descrição do Acordo**, o **Valor da Parcela**, o **Primeiro Vencimento** e a **Periodicidade**. Escolha a **Conta de Pagamento**, a **Categoria** e, se quiser, a **Taxa de Juros (% ao mês)**. Clique em **Revisar**.",
          "**Revisão e confirmação**: leia o que vai acontecer. A lista **Sai de Lançamentos** mostra as parcelas antigas e **O acordo cria** mostra as parcelas novas. Se estiver certo, clique em **Confirmar renegociação**.",
        ],
      },
      { tipo: "titulo", texto: "O que acontece ao confirmar" },
      {
        tipo: "lista",
        itens: [
          "Nasce uma dívida nova do tipo Acordo, com Parcelas fixas. Se houver entrada, ela é a parcela 1.",
          "As dívidas originais ficam **Renegociada**.",
          "As parcelas **não pagas** das originais saem de Lançamentos, para o dinheiro não ser contado duas vezes. Uma cópia fica no histórico da dívida e na Auditoria.",
          "As parcelas **já pagas** continuam intactas.",
          "A negociação vira **Aceita** e as outras propostas em aberto ficam recusadas.",
        ],
      },
      { tipo: "atencao", texto: "Se o acordo sair mais caro que o saldo, ou a parcela não couber na sobra mensal informada, o Gui mostra a janela **Confira antes de renegociar**. Você pode voltar e ajustar ou seguir mesmo assim." },
      { tipo: "dica", texto: "Errou? Enquanto nenhuma parcela do acordo for paga, dá para desfazer. Veja o artigo sobre desfazer a renegociação." },
    ],
    relacionados: ["situacoes-da-negociacao", "desfazer-renegociacao", "comparar-proposta", "acordo-com-desconto", "ja-renegociei"],
  },
  {
    id: "desfazer-renegociacao",
    titulo: "Desfazer uma renegociação",
    resumo: "Como voltar atrás num acordo enquanto nenhuma parcela dele foi paga.",
    assunto: "telas",
    telas: ["negociacoes", "minhas"],
    palavras: ["desfazer", "cancelar acordo", "voltar atrás", "errei o acordo", "reverter", "renegociei errado", "desfazer acordo"],
    blocos: [
      { tipo: "p", texto: "Se você confirmou uma renegociação e percebeu um erro, dá para desfazer. O Gui devolve as parcelas antigas para Lançamentos e apaga o acordo." },
      { tipo: "titulo", texto: "Como desfazer" },
      {
        tipo: "passos",
        itens: [
          "Vá em Minhas Dívidas e abra o acordo (a dívida do tipo Acordo). Se a renegociação veio de uma negociação, o link **Ver o acordo**, dentro de **Detalhar** na aba **Negociações**, leva direto.",
          "No topo dos detalhes aparece o aviso \"Este acordo substituiu uma dívida\" com o botão **Desfazer renegociação**.",
          "Clique no botão e confirme a pergunta.",
        ],
      },
      { tipo: "titulo", texto: "O que volta ao normal" },
      {
        tipo: "lista",
        itens: [
          "As parcelas não pagas das dívidas originais voltam para Lançamentos, como estavam.",
          "As dívidas originais voltam a ficar ativas.",
          "As faturas acompanhadas e os recorrentes ligados a elas voltam.",
          "As parcelas do acordo e o próprio acordo são apagados.",
          "A negociação volta a ficar aberta e a proposta aceita volta a **Em aberto**.",
        ],
      },
      { tipo: "atencao", texto: "Só dá para desfazer enquanto o acordo está ativo e **nenhuma parcela dele foi paga**. Depois do primeiro pagamento (inclusive amortização ou quitação), o botão some e o aviso explica o motivo." },
      { tipo: "dica", texto: "Se já pagou uma parcela do acordo e algo está errado, o caminho é ajustar o que for preciso em Lançamentos ou registrar um novo acordo. Não existe desfazer nesse caso." },
    ],
    relacionados: ["negociacao-passo-a-passo", "situacoes-da-negociacao", "cadastrei-errado"],
  },
  {
    id: "situacoes-da-negociacao",
    titulo: "O que significa cada situação da negociação",
    resumo: "Explica Em andamento, Proposta recebida, Aguardando resposta, Aceita, Recusada e Desistida.",
    assunto: "telas",
    telas: ["negociacoes"],
    palavras: ["status", "situação", "em andamento", "proposta recebida", "aguardando resposta", "aceita", "recusada", "desistida", "recusar", "desistir", "excluir negociação", "prazo de resposta"],
    blocos: [
      { tipo: "p", texto: "A coluna **Situação** da aba **Negociações** diz em que pé está a conversa com o credor." },
      {
        tipo: "exemplo",
        titulo: "As situações",
        linhas: [
          ["Em andamento", "Você abriu a negociação, mas ainda não registrou proposta."],
          ["Proposta recebida", "O credor fez uma proposta e a bola está com você."],
          ["Aguardando resposta", "Você fez uma proposta e espera o credor responder."],
          ["Aceita", "Você aceitou uma proposta e ela virou acordo."],
          ["Recusada", "As condições não foram aceitas."],
          ["Desistida", "Você encerrou a negociação por desistência."],
        ],
      },
      { tipo: "p", texto: "Enquanto a situação é **Em andamento**, **Proposta recebida** ou **Aguardando resposta**, as dívidas da negociação aparecem como **Em negociação**." },
      { tipo: "titulo", texto: "O que cada ação do menu faz" },
      {
        tipo: "lista",
        itens: [
          "**Detalhar**: abre a negociação com as dívidas e as propostas.",
          "**Nova proposta**: registra uma proposta e muda a situação sozinho.",
          "**Aceitar proposta**: abre a janela de renegociação. Se há mais de uma proposta em aberto, abre o **Detalhar** para você escolher.",
          "**Recusar**: encerra a negociação como **Recusada** e deixa as propostas em aberto como recusadas.",
          "**Desistir**: encerra como **Desistida**.",
          "**Editar**: muda os dados da negociação, inclusive a **Situação**. Serve também para reabrir uma negociação encerrada e registrar novas propostas.",
          "**Excluir**: apaga a negociação e as propostas dela. As dívidas não mudam.",
        ],
      },
      { tipo: "atencao", texto: "Negociação **Aceita** não pode ser editada nem excluída. Para voltar atrás, desfaça a renegociação no acordo." },
      { tipo: "dica", texto: "O **Prazo de Resposta** fica em vermelho quando passa da data e a negociação ainda está aberta. Uma proposta com a marca **Validade vencida** pode já não valer: confirme com o credor." },
    ],
    relacionados: ["negociacao-passo-a-passo", "desfazer-renegociacao", "situacoes-da-divida"],
  },

  // ---------------------------------------------------------------------------
  // Simulador
  // ---------------------------------------------------------------------------
  {
    id: "simulador-o-que-faz",
    titulo: "O que o Simulador faz e os 4 modos",
    resumo: "O Simulador só calcula cenários. Veja o que cada modo responde.",
    assunto: "telas",
    telas: ["simulador"],
    palavras: ["simular", "simulação", "calcular", "quitar", "quanto tempo", "quando acaba", "juros", "e se", "hipotética", "empréstimo novo", "não altera nada"],
    blocos: [
      { tipo: "p", texto: "O Simulador responde a perguntas do tipo \"e se eu pagar mais?\". Ele usa o saldo, a taxa e as parcelas das suas dívidas. **Nenhum dado real é alterado**, como diz a faixa amarela no topo." },
      { tipo: "titulo", texto: "Os quatro modos" },
      {
        tipo: "lista",
        itens: [
          "**Quitar uma dívida**: escolha uma dívida e veja três coisas. Quanto custa **Quitar hoje**. Em quantos meses ela acaba se você pagar um valor fixo (**Acabar em X meses**). E quanto você economiza **Pagando R$ Y a mais por mês**.",
          "**Comparar estratégias**: compara Bola de Neve, Avalanche, Risco primeiro e Personalizada com o mesmo dinheiro. Mostra o mês em que tudo acaba, o total pago e o total de juros de cada uma.",
          "**Cenários**: mostra os resultados com o Conservador, o Intermediário e o Acelerado, que usam partes diferentes da sua sobra mensal.",
          "**Proposta de negociação**: compara uma proposta do credor com continuar como está e com quitar usando a reserva.",
        ],
      },
      { tipo: "titulo", texto: "O que você controla na coluna da esquerda" },
      {
        tipo: "lista",
        itens: [
          "**Dívidas que entram**: marque quais dívidas entram na conta. Nas dívidas sem parcelas aparece **Pagamento mínimo por mês** (o padrão são os juros do mês, para o saldo não crescer).",
          "**Incluir uma dívida hipotética**: teste um empréstimo novo, com **Valor do empréstimo**, **Juros ao mês (%)** e **Parcelas**. Pode entrar como pagamento extra no primeiro mês (por exemplo, para quitar o cartão).",
          "**Quanto pagar**: **Valor por mês, no total**, **Pagamento extra pontual** (por exemplo, o 13º) e **Usar da reserva agora**. Marque **Pagar só as parcelas (sem valor extra)** para ver o que acontece sem esforço extra.",
          "**Estratégia**: a ordem em que o dinheiro extra vai de uma dívida para a outra.",
        ],
      },
      { tipo: "dica", texto: "O resultado mostra \"Quita tudo em\", **Total pago**, **Total de juros** e um gráfico de saldo. Abra **Como calculei** no fim da tela para ver as contas. Se as dívidas não acabam em 30 anos, aparece \"Não quita\"." },
      { tipo: "atencao", texto: "São estimativas. O valor certo para quitar é o que o credor informar. Antes de fechar negócio, confirme com ele." },
    ],
    relacionados: ["estrategias-quitacao", "cenarios", "sobra-e-reserva", "comparar-proposta", "guardar-simulacao-e-criar-plano"],
  },
  {
    id: "estrategias-quitacao",
    titulo: "Bola de Neve, Avalanche, Risco primeiro ou Personalizada",
    resumo: "Qual dívida receber o dinheiro extra primeiro e o que muda em cada estratégia.",
    assunto: "telas",
    telas: ["simulador", "plano"],
    palavras: ["bola de neve", "avalanche", "risco", "personalizada", "ordem de pagamento", "qual dívida pagar primeiro", "prioridade", "menos juros", "estratégia", "snowball"],
    blocos: [
      { tipo: "p", texto: "Você paga **a parcela de todas as dívidas**. A estratégia só decide para qual delas vai o dinheiro **extra**. Quando uma dívida acaba, o valor dela passa para a próxima da fila." },
      {
        tipo: "exemplo",
        titulo: "As quatro estratégias",
        linhas: [
          ["Bola de Neve", "Começa pela dívida de menor saldo. Quita mais rápido e libera parcela cedo."],
          ["Avalanche", "Começa pela dívida de maior taxa de juros. Costuma pagar menos juros no total."],
          ["Risco primeiro", "Começa pelo que tem as piores consequências: atraso mais antigo, depois dívida com garantia (bem), maior taxa e menor saldo."],
          ["Personalizada", "A ordem que você escolher, arrastando as dívidas (ou usando as setas)."],
        ],
      },
      { tipo: "titulo", texto: "Exemplo com números redondos" },
      { tipo: "p", texto: "Você tem três dívidas: o cheque especial (R$ 2.000 a 8% ao mês), um cartão de loja (R$ 500 a 4% ao mês, atrasado há 40 dias) e um financiamento (R$ 20.000 a 1% ao mês, com garantia)." },
      {
        tipo: "lista",
        itens: [
          "**Bola de Neve**: cartão de loja (R$ 500), cheque especial (R$ 2.000), financiamento (R$ 20.000).",
          "**Avalanche**: cheque especial (8%), cartão de loja (4%), financiamento (1%).",
          "**Risco primeiro**: cartão de loja (é o que está atrasado), financiamento (tem garantia) e por último o cheque especial.",
        ],
      },
      { tipo: "titulo", texto: "Como escolher" },
      {
        tipo: "lista",
        itens: [
          "Quer gastar o menos possível em juros? Veja a marca **Menos juros** na tabela da comparação. Normalmente é a Avalanche.",
          "Precisa de motivação e de parcelas livres logo? A Bola de Neve costuma ganhar em **Libera a primeira antes**.",
          "Tem dívida atrasada ou com bem em risco (carro, imóvel)? Veja o **Risco primeiro**.",
          "Sabe exatamente o que quer? Use a **Personalizada**.",
        ],
      },
      { tipo: "dica", texto: "No modo **Comparar estratégias**, a tabela mostra as quatro lado a lado, com as marcas **Menos juros**, **Quita tudo antes** e **Libera a primeira antes**. Clique numa linha para ver o detalhe mês a mês." },
      { tipo: "atencao", texto: "A diferença entre estratégias só aparece se sobrar dinheiro além das parcelas. Se você paga só as parcelas, o resultado é o mesmo em todas." },
    ],
    relacionados: ["simulador-o-que-faz", "sobra-e-reserva", "criar-plano", "guardar-simulacao-e-criar-plano"],
  },
  {
    id: "sobra-e-reserva",
    titulo: "Sobra mensal e reserva: de onde vêm os números",
    resumo: "Como o Gui calcula a sua sobra por mês e a reserva mínima, e onde mudar isso.",
    assunto: "telas",
    telas: ["simulador", "plano", "consultor"],
    palavras: ["sobra", "sobra mensal", "reserva", "reserva mínima", "reserva de emergência", "poupança", "quanto sobra", "quanto posso pagar", "valor sugerido", "meses na média", "contas da reserva", "usar a reserva"],
    blocos: [
      { tipo: "p", texto: "O Simulador, o Plano e o Consultor usam dois números seus: a **sobra mensal** e a **reserva**. Os dois vêm dos seus lançamentos e das suas contas." },
      { tipo: "titulo", texto: "Sobra mensal" },
      { tipo: "p", texto: "É a média, nos últimos meses fechados, de receitas menos despesas pagas, **sem as parcelas de dívida**. O padrão são 3 meses. É o que você tem para pagar as dívidas além do que já paga hoje." },
      {
        tipo: "exemplo",
        titulo: "Exemplo",
        linhas: [
          ["Receitas por mês", "R$ 5.000,00"],
          ["Despesas por mês, sem dívidas", "R$ 3.800,00"],
          ["Sobra mensal", "R$ 1.200,00"],
          ["Parcelas das dívidas", "R$ 700,00"],
          ["Sobra livre (para pagar a mais)", "R$ 500,00"],
        ],
      },
      { tipo: "p", texto: "O valor sugerido em **Valor por mês, no total** é a sua sobra mensal. Se a sobra for menor que as parcelas, o Gui sugere só as parcelas." },
      { tipo: "titulo", texto: "Reserva e reserva mínima" },
      {
        tipo: "lista",
        itens: [
          "**Reserva**: o saldo das contas que formam a reserva. Se você não marcar nenhuma, o Gui usa as contas dos tipos Poupança e Investimento.",
          "**Reserva mínima**: o número de meses de despesas que você quer manter guardado, vezes a despesa média mensal (sem dívidas). O padrão são 3 meses.",
          "**O que passa do mínimo** é o que o Gui considera possível usar. No campo **Usar da reserva agora**, o link **Usar o que passa do mínimo** preenche esse valor.",
        ],
      },
      { tipo: "atencao", texto: "Se você usar mais que o excedente, aparece o aviso \"Uso da reserva acima do recomendado\". A decisão é sua, mas a reserva fica abaixo do mínimo e uma emergência pode virar dívida nova." },
      { tipo: "titulo", texto: "Para mudar" },
      {
        tipo: "passos",
        itens: [
          "Abra Configurações > Parâmetros e escolha a seção **Gestão de Dívidas** (no Simulador há o link **Ajustar reserva, meses da média e percentuais dos cenários em Parâmetros**).",
          "Em **Simulador**, mude **Reserva mínima (meses de despesas)**, **Meses na média da sobra** e marque as **Contas que formam a reserva**.",
          "Clique em salvar.",
        ],
      },
      { tipo: "dica", texto: "Se a sobra aparece zerada, faltam meses fechados com receitas e despesas pagas. O Consultor avisa quando não consegue calcular por esse motivo." },
    ],
    relacionados: ["cenarios", "simulador-o-que-faz", "criar-plano", "consultor-como-usar"],
  },
  {
    id: "cenarios",
    titulo: "Cenários: Conservador, Intermediário e Acelerado",
    resumo: "Três formas prontas de usar a sua sobra para pagar mais rápido.",
    assunto: "telas",
    telas: ["simulador"],
    palavras: ["cenário", "conservador", "intermediário", "acelerado", "quanto da sobra usar", "percentual da sobra", "pagar mais rápido", "o que fazer com a sobra"],
    blocos: [
      { tipo: "p", texto: "No modo **Cenários** o Simulador mostra três planos de pagamento lado a lado. Em cada um, o valor por mês e o uso da reserva já vêm prontos. A estratégia usada é a que está marcada na coluna **Estratégia**." },
      {
        tipo: "exemplo",
        titulo: "Os três cenários",
        linhas: [
          ["Conservador", "Só as parcelas e uma parte pequena da sobra. A reserva fica intocada."],
          ["Intermediário", "As parcelas e uma parte maior da sobra. A reserva fica intocada."],
          ["Acelerado", "As parcelas, toda a sobra e, uma vez, o que passar da reserva mínima."],
        ],
      },
      { tipo: "titulo", texto: "A conta" },
      { tipo: "p", texto: "Cada cenário usa um percentual da **sobra livre** (a sobra mensal menos as parcelas). Os percentuais padrão são 25% no Conservador, 50% no Intermediário e 100% no Acelerado." },
      {
        tipo: "exemplo",
        titulo: "Exemplo com sobra mensal de R$ 1.200 e parcelas de R$ 700",
        linhas: [
          ["Sobra livre", "R$ 500,00"],
          ["Conservador (25%)", "R$ 700 + R$ 125 = R$ 825,00 por mês"],
          ["Intermediário (50%)", "R$ 700 + R$ 250 = R$ 950,00 por mês"],
          ["Acelerado (100%)", "R$ 700 + R$ 500 = R$ 1.200,00 por mês, mais o que passa da reserva mínima, uma vez"],
        ],
      },
      { tipo: "p", texto: "Cada cartão mostra **Por mês**, **Termina em**, **Total de juros**, **Sobra no mês** e **Reserva depois**. Números em laranja pedem atenção, por exemplo quando a sobra no mês fica negativa ou a reserva fica abaixo do mínimo. Clique num cartão para ver o detalhe mês a mês." },
      { tipo: "dica", texto: "Para mudar os percentuais, vá em Configurações > Parâmetros > **Gestão de Dívidas** e ajuste **Cenário Conservador (%)**, **Cenário Intermediário (%)** e **Cenário Acelerado (%)**." },
      { tipo: "dica", texto: "Gostou de um cenário? Com ele aberto, clique em **Criar plano a partir desta simulação** para levar os números ao Plano de Quitação." },
    ],
    relacionados: ["sobra-e-reserva", "estrategias-quitacao", "guardar-simulacao-e-criar-plano", "criar-plano"],
  },
  {
    id: "comparar-proposta",
    titulo: "Comparar uma proposta do credor",
    resumo: "Como usar o modo Proposta de negociação para saber se vale aceitar.",
    assunto: "telas",
    telas: ["simulador", "negociacoes"],
    palavras: ["proposta", "vale a pena aceitar", "acordo bom", "comparar acordo", "desconto", "juros implícitos", "quitar com a reserva", "continuar como está", "oferta do banco", "feirão"],
    blocos: [
      { tipo: "p", texto: "Quando o credor faz uma proposta, o Simulador compara três caminhos: aceitar, continuar como está ou quitar hoje com a reserva." },
      { tipo: "titulo", texto: "Como fazer" },
      {
        tipo: "passos",
        itens: [
          "Registre a proposta numa negociação (aba **Negociações** > **Nova proposta**).",
          "Na proposta, clique em **Simular**. O Simulador abre no modo **Proposta de negociação** já com os números preenchidos.",
          "Se preferir, vá direto ao Simulador, clique em **Proposta de negociação**, escolha a **Negociação** e a **Proposta**, ou digite as condições (**Entrada (ou à vista)**, **Parcelas**, **Valor da parcela**, **1º vencimento**).",
          "Leia a frase do topo e a tabela de caminhos.",
        ],
      },
      { tipo: "titulo", texto: "O que a tabela mostra" },
      {
        tipo: "exemplo",
        titulo: "Caminhos comparados",
        linhas: [
          ["Aceitar a proposta", "Quanto você paga agora, as parcelas, o total e o mês em que acaba."],
          ["Continuar como está", "O total pago seguindo só as parcelas atuais."],
          ["Quitar hoje com a reserva", "Pagar o saldo de hoje de uma vez, usando a reserva."],
        ],
      },
      { tipo: "p", texto: "A coluna **Contra o saldo de hoje** diz quanto cada caminho custa a mais (laranja) ou a menos (verde) que o saldo de hoje." },
      { tipo: "titulo", texto: "Os avisos" },
      {
        tipo: "lista",
        itens: [
          "A parcela não cabe na sua sobra mensal: o aviso diz quanto falta por mês.",
          "Quitar com a reserva deixa o saldo dela abaixo da reserva mínima.",
          "A reserva não cobre o saldo.",
        ],
      },
      {
        tipo: "exemplo",
        titulo: "Exemplo",
        linhas: [
          ["Saldo das dívidas hoje", "R$ 10.000,00"],
          ["Proposta", "Entrada de R$ 1.000,00 e 10 parcelas de R$ 500,00"],
          ["Total da proposta", "R$ 6.000,00"],
          ["Resultado", "R$ 4.000,00 (40%) a menos que o saldo de hoje"],
        ],
      },
      { tipo: "dica", texto: "Os **Juros implícitos** são a taxa que faz as parcelas valerem o que você deve hoje. Se você paga menos do que deve, aparece \"Sem juros\", porque há desconto." },
      { tipo: "atencao", texto: "O desconto só vale se o credor confirmar por escrito (e-mail, protocolo ou boleto). Guarde o número do protocolo no campo **Protocolo** da negociação." },
    ],
    relacionados: ["negociacao-passo-a-passo", "acordo-com-desconto", "simulador-o-que-faz", "sobra-e-reserva"],
  },
  {
    id: "guardar-simulacao-e-criar-plano",
    titulo: "Guardar uma simulação e criar um plano a partir dela",
    resumo: "Como salvar uma simulação para depois e como levar os números para o Plano de Quitação.",
    assunto: "telas",
    telas: ["simulador", "plano"],
    palavras: ["guardar simulação", "salvar simulação", "abrir simulação", "imprimir", "pdf", "criar plano", "transformar em plano", "simulações guardadas", "excluir simulação"],
    blocos: [
      { tipo: "titulo", texto: "Guardar" },
      {
        tipo: "passos",
        itens: [
          "Monte a simulação no Simulador.",
          "Clique em **Guardar simulação**.",
          "Dê um **Nome**, por exemplo \"Avalanche com o 13º\", e clique em **Guardar**.",
        ],
      },
      { tipo: "p", texto: "O Gui guarda só as suas escolhas e um resumo. Nenhum dado real é alterado. As simulações aparecem em **Simulações guardadas**, no fim da tela, com os botões **Abrir** e **Excluir**." },
      { tipo: "dica", texto: "Se a sua instalação tem o recurso de impressão ligado, o botão **Imprimir/PDF** gera a simulação para guardar ou mostrar a alguém." },
      { tipo: "titulo", texto: "Criar um plano a partir da simulação" },
      {
        tipo: "passos",
        itens: [
          "Nos modos **Comparar estratégias** ou **Cenários**, escolha a estratégia (ou o cenário) que você quer.",
          "Clique em **Criar plano a partir desta simulação**.",
          "Você vai para a aba **Plano de Quitação**, com o plano já montado como **Rascunho**.",
          "Confira os dados e clique em **Aprovar plano**.",
        ],
      },
      { tipo: "atencao", texto: "Nada é criado até você aprovar na tela do Plano. Antes disso é só um rascunho." },
      { tipo: "p", texto: "Também dá para criar um plano a partir de uma simulação guardada: na aba **Plano de Quitação**, em **Criar a partir de uma simulação guardada**, clique em **Criar plano** ao lado dela." },
    ],
    relacionados: ["criar-plano", "cenarios", "estrategias-quitacao", "simulador-o-que-faz"],
  },

  // ---------------------------------------------------------------------------
  // Plano de Quitação
  // ---------------------------------------------------------------------------
  {
    id: "criar-plano",
    titulo: "Como criar o Plano de Quitação",
    resumo: "Passo a passo para montar e aprovar um plano de pagamento mês a mês.",
    assunto: "telas",
    telas: ["plano"],
    palavras: ["plano", "plano de quitação", "criar plano", "novo plano", "aprovar plano", "rascunho", "meta mensal", "valor mensal", "planejar dívidas", "organizar pagamento"],
    blocos: [
      { tipo: "p", texto: "O **Plano de Quitação** diz quanto pagar de cada dívida em cada mês e depois compara com o que você realmente pagou. **Nada muda sem a sua aprovação.** Aprovar também não cria lançamentos." },
      { tipo: "titulo", texto: "Como criar" },
      {
        tipo: "passos",
        itens: [
          "Na aba **Plano de Quitação**, clique em **Criar plano do zero**. Se você já fez uma simulação, prefira **Criar plano a partir desta simulação** no Simulador.",
          "Em **Nome do Plano**, escreva um nome (o padrão é \"Plano\" e o mês).",
          "Escolha a **Estratégia**. Se for **Personalizada**, arraste as dívidas para a ordem que quer.",
          "Em **Dívidas do plano**, marque quais dívidas entram.",
          "Em **Quanto pagar**, escolha: **Pagar só as parcelas**, ou digite o **Valor Mensal (total, parcelas incluídas)**. Em branco, o Gui usa o valor sugerido (a sua sobra mensal, ou as parcelas se a sobra for menor).",
          "Se quiser, preencha **Pagamento Extra** e **Mês do Extra** (por exemplo, o 13º) e **Reserva a Usar**.",
          "Veja o resultado ao lado: **Termina em**, **Valor mensal**, **Total de juros** e **Total pago**.",
          "Clique em **Aprovar plano**.",
        ],
      },
      {
        tipo: "exemplo",
        titulo: "Exemplo preenchido",
        linhas: [
          ["Nome do Plano", "Plano 2027"],
          ["Estratégia", "Avalanche"],
          ["Valor Mensal (total, parcelas incluídas)", "R$ 1.200,00"],
          ["Pagamento Extra", "R$ 1.000,00"],
          ["Mês do Extra", "dezembro"],
          ["Reserva a Usar", "vazio"],
        ],
      },
      { tipo: "atencao", texto: "O botão **Aprovar plano** só funciona se, com esse valor, as dívidas terminam em 30 anos. Se não terminam, aparece o aviso e você precisa aumentar o valor mensal." },
      { tipo: "dica", texto: "Se algum aviso aparecer (mês negativo, reserva abaixo do mínimo, já existe plano ativo), o Gui mostra a janela **Antes de aprovar este plano**. Você pode voltar ou clicar em **Aprovar mesmo assim**. Aprovar um novo plano deixa o anterior como **Substituído**." },
      { tipo: "p", texto: "Depois de aprovado, o plano ativo mostra o **Valor mensal**, **Termina (no plano)**, **Previsão recalculada**, **Falta pagar** e duas barras: **Progresso geral** e **Meta paga até agora**. Para acompanhar mês a mês, veja o artigo sobre planejado e realizado." },
    ],
    relacionados: ["planejado-x-realizado", "ajustar-plano", "estrategias-quitacao", "sobra-e-reserva", "guardar-simulacao-e-criar-plano"],
  },
  {
    id: "planejado-x-realizado",
    titulo: "Planejado x realizado: Cumprido, Parcial, Não cumprido e Futuro",
    resumo: "Como ler a tabela mês a mês do plano e de onde vem o valor realizado.",
    assunto: "telas",
    telas: ["plano"],
    palavras: ["planejado", "realizado", "cumprido", "parcial", "não cumprido", "futuro", "em andamento", "diferença", "tabela do plano", "paguei menos que o plano", "meta do mês"],
    blocos: [
      { tipo: "p", texto: "No plano ativo, a tabela **Planejado x realizado, mês a mês** compara o que o plano previa pagar com o que você pagou de verdade." },
      { tipo: "titulo", texto: "Como ler" },
      {
        tipo: "lista",
        itens: [
          "**Planejado**: o que o plano previa pagar naquele mês.",
          "**Realizado**: a soma dos lançamentos pagos ligados às dívidas do plano, no mês do pagamento. Conta parcela, pagamento parcial e o restante, amortização, quitação e encargo.",
          "**Diferença**: em azul (+) quando você pagou a mais, em laranja (−) quando pagou a menos.",
          "Marque **Detalhar por dívida** para ver a conta de cada dívida.",
        ],
      },
      { tipo: "titulo", texto: "As situações do mês" },
      {
        tipo: "exemplo",
        titulo: "Situação",
        linhas: [
          ["Cumprido", "Você pagou o planejado (com tolerância de R$ 1,00)."],
          ["Parcial", "Você pagou uma parte do planejado."],
          ["Não cumprido", "Mês fechado em que você não pagou nada."],
          ["Em andamento", "É o mês de hoje e ainda falta pagar."],
          ["Futuro", "O mês ainda não chegou. Realizado e diferença aparecem com \"-\"."],
        ],
      },
      {
        tipo: "exemplo",
        titulo: "Exemplo",
        linhas: [
          ["Planejado em março", "R$ 1.200,00"],
          ["Realizado em março", "R$ 1.000,00"],
          ["Diferença", "−R$ 200,00"],
          ["Situação", "Parcial (se março já fechou)"],
        ],
      },
      { tipo: "atencao", texto: "O realizado nunca é gravado. Ele é recalculado a cada vez que você abre a tela. Se você voltar um lançamento para não pago, o número muda." },
      { tipo: "dica", texto: "Dívida quitada, renegociada ou cancelada deixa de ser cobrada nos meses depois que acabou. Abaixo da tabela, o gráfico **Saldo devedor: planejado x realizado** mostra a diferença ao longo do tempo." },
    ],
    relacionados: ["ajustar-plano", "criar-plano", "pagamento-extra-agendado", "pagamento-parcial"],
  },
  {
    id: "ajustar-plano",
    titulo: "Seu plano precisa de ajuste: o que fazer",
    resumo: "Como o Gui detecta desvios e como aprovar uma nova versão do plano.",
    assunto: "telas",
    telas: ["plano"],
    palavras: ["ajuste", "ajustar plano", "plano atrasou", "plano furou", "desvio", "nova versão", "manter como está", "aprovar ajuste", "histórico do plano", "versões", "encerrar plano", "refazer plano"],
    blocos: [
      { tipo: "p", texto: "Quando a vida foge do plano, o Gui mostra o cartão **Seu plano precisa de ajuste** com uma proposta. **Nada muda sem o seu clique.**" },
      { tipo: "titulo", texto: "Quando o cartão aparece" },
      {
        tipo: "lista",
        itens: [
          "O que você pagou ficou abaixo do planejado em meses já fechados.",
          "A previsão recalculada de quitação passou do mês previsto no plano.",
          "A sua sobra mensal caiu mais de 20% desde que o plano foi aprovado.",
          "Você cadastrou uma dívida nova depois da aprovação, fora do plano.",
        ],
      },
      { tipo: "titulo", texto: "As duas opções" },
      {
        tipo: "lista",
        itens: [
          "**Aumentar** o valor mensal: o menor valor que ainda termina no mês previsto. O cartão diz se ele cabe na sua sobra mensal.",
          "**Adiar** a quitação: mantém o valor (ou o que cabe na sua sobra) e mostra em que mês as dívidas terminam.",
        ],
      },
      { tipo: "p", texto: "O Gui marca uma delas como **Recomendada**. Em cada opção, abra **Como calculei** para ver a conta." },
      { tipo: "titulo", texto: "O que fazer" },
      {
        tipo: "passos",
        itens: [
          "Leia os desvios no topo do cartão.",
          "Escolha uma opção (a recomendada já vem marcada).",
          "Clique em **Aprovar ajuste** para criar a nova versão, ou em **Manter como está** para ignorar.",
        ],
      },
      { tipo: "p", texto: "Aprovar cria a versão seguinte (por exemplo, a versão 2) e a anterior fica guardada no histórico. Em **Versões e histórico do plano**, clique em **Ver** para abrir uma versão antiga só para leitura. Em **Ajustes decididos** você vê o que foi aprovado ou mantido." },
      { tipo: "dica", texto: "**Manter como está** só esconde o aviso. Se o desvio mudar, o aviso volta. Enquanto isso, o plano mostra os desvios que continuam." },
      { tipo: "titulo", texto: "Encerrar o plano" },
      { tipo: "p", texto: "Quando acabar (ou se não fizer mais sentido), clique em **Encerrar plano**. Ele fica como **Encerrado**, deixa de ser acompanhado e continua no histórico. Os lançamentos e as dívidas não mudam. Para começar outro, use **Criar outro plano**." },
    ],
    relacionados: ["planejado-x-realizado", "criar-plano", "alertas-do-consultor", "consultor-como-usar"],
  },
  {
    id: "pagamento-extra-agendado",
    titulo: "Agendar o pagamento extra do plano",
    resumo: "Como transformar o que o plano prevê em lançamentos a pagar, com o botão Agendar.",
    assunto: "telas",
    telas: ["plano"],
    palavras: ["agendar", "pagamento extra", "extra do plano", "lançamento do plano", "pagamentos para agendar", "13º", "adiantar parcelas", "lançar o extra"],
    blocos: [
      { tipo: "p", texto: "O plano pode prever que você pague mais do que as parcelas em certo mês. Esse dinheiro extra **não vira lançamento sozinho**. Você decide quando agendar." },
      { tipo: "titulo", texto: "Como agendar" },
      {
        tipo: "passos",
        itens: [
          "No plano ativo, procure o cartão **Pagamentos para agendar (mês atual e seguinte)**.",
          "Cada linha mostra a dívida, o mês, o que o plano prevê pagar e o que já está em Lançamentos. O valor da direita é o que falta agendar.",
          "Clique em **Agendar**. Abre a janela **Agendar pagamento do plano**.",
          "Confira o **Valor** (no máximo o que falta agendar), o **Vencimento** (dentro do mês) e a **Conta de Pagamento**.",
          "Clique em **Agendar**.",
        ],
      },
      {
        tipo: "exemplo",
        titulo: "Exemplo",
        linhas: [
          ["Plano prevê para dezembro", "R$ 1.500,00"],
          ["Já em Lançamentos (parcela)", "R$ 500,00"],
          ["Falta agendar", "R$ 1.000,00"],
        ],
      },
      { tipo: "titulo", texto: "O que acontece" },
      {
        tipo: "lista",
        itens: [
          "Cria uma despesa **ainda não paga**, ligada à dívida. Ela aparece em Lançamentos, na Agenda e em Vencidos.",
          "Quando você pagar, o realizado do plano sobe.",
          "Nas dívidas com parcelas, o mesmo valor sai das últimas parcelas em aberto. Assim o saldo não conta o mesmo dinheiro duas vezes.",
        ],
      },
      { tipo: "atencao", texto: "Só aparecem o mês atual e o seguinte, para não encher Lançamentos de previsões que podem mudar. Se não for possível tirar o valor das últimas parcelas, o Gui avisa e sugere usar **Quitar** na dívida." },
    ],
    relacionados: ["planejado-x-realizado", "criar-plano", "parcelas-em-lancamentos", "qual-botao-usar"],
  },

  // ---------------------------------------------------------------------------
  // Consultor
  // ---------------------------------------------------------------------------
  {
    id: "consultor-como-usar",
    titulo: "Como usar o Consultor Gui",
    resumo: "Perguntas prontas, assuntos, texto livre e como conferir a conta de cada resposta.",
    assunto: "telas",
    telas: ["consultor"],
    palavras: ["consultor", "perguntar", "pergunta pronta", "chat", "conversa", "assunto", "novo assunto", "arquivar", "como calculei", "quanto devo", "qual pagar primeiro", "cabe uma parcela", "posso comprar", "vale a pena usar a reserva", "essa proposta é boa"],
    blocos: [
      { tipo: "p", texto: "O Consultor Gui lê as suas dívidas, contas e reserva e responde com **contas claras**. Ele nunca paga nem altera nada. Os botões das respostas só abrem a tela certa." },
      { tipo: "titulo", texto: "Como perguntar" },
      {
        tipo: "passos",
        itens: [
          "Na aba **Consultor**, escolha uma das **Perguntas prontas**.",
          "Se a pergunta pede um número (como \"Cabe uma parcela de R$ X?\"), aparece um campo para o valor. Preencha e clique em **Perguntar**.",
          "Leia a resposta: a conclusão, os números e o **Critério** usado.",
          "Clique em **Como calculei** para ver cada passo da conta.",
        ],
      },
      { tipo: "titulo", texto: "As perguntas prontas" },
      {
        tipo: "lista",
        itens: [
          "**Minha situação**: \"Quanto eu devo no total?\" e \"Quando fico livre das dívidas?\".",
          "**Meu plano**: \"Por que meu plano atrasou?\".",
          "**O que fazer**: \"Qual dívida pagar primeiro?\", \"Cabe uma parcela de R$ X?\", \"Quanto economizo pagando R$ X a mais?\", \"Vale a pena usar a reserva?\" e \"Essa proposta é boa?\".",
          "**Antes de comprar**: \"Posso fazer uma compra parcelada de R$ X em N vezes?\". Pede o **Valor da compra** e **Em quantas vezes**.",
        ],
      },
      { tipo: "titulo", texto: "Escrever com as suas palavras" },
      { tipo: "p", texto: "No campo **Ou escreva a sua pergunta** o Gui reconhece **palavras-chave e números**, como \"quanto devo\", \"pagar primeiro\", \"reserva\" ou \"cabe R$ 300\". Se ele não entender, diz isso e pede para escolher uma pergunta pronta. Ele não finge que entendeu." },
      {
        tipo: "exemplo",
        titulo: "Exemplos que funcionam",
        linhas: [
          ["quanto devo", "Total devido, atraso, parcelas do mês e juros por mês"],
          ["qual pagar primeiro", "A ordem do Risco primeiro"],
          ["cabe R$ 300", "Se uma parcela de R$ 300,00 cabe na sua sobra livre"],
          ["posso comprar R$ 1.200 em 10x", "Se a compra parcelada cabe no seu orçamento"],
        ],
      },
      { tipo: "titulo", texto: "Assuntos" },
      {
        tipo: "p",
        texto: "Cada conversa fica num **assunto**, com o histórico guardado. Use **Novo assunto** para começar outro, **Renomear** para trocar o título e **Arquivar** quando terminar (o botão vira **Desarquivar**). O assunto **Alertas** mostra os avisos do Consultor.",
      },
      { tipo: "dica", texto: "A resposta traz o selo \"calculado pelo Gui\". Se a pergunta não puder ser calculada (por exemplo, sem meses fechados de receitas), o Consultor diz o que está faltando." },
      { tipo: "atencao", texto: "O Consultor faz contas com os seus dados e não substitui um profissional. A decisão e os pagamentos são sempre seus." },
    ],
    relacionados: ["alertas-do-consultor", "consultor-com-ia", "sobra-e-reserva", "comparar-proposta"],
  },
  {
    id: "alertas-do-consultor",
    titulo: "O que cada alerta do Consultor significa",
    resumo: "Explica em linguagem simples os alertas de R1 a R13, e como dispensar ou adiar.",
    assunto: "telas",
    telas: ["consultor", "visao"],
    palavras: ["alerta", "alertas", "aviso", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12", "R13", "dispensar", "lembrar em 7 dias", "por quê", "análises e recomendações", "desligar alerta", "alerta alto", "taxa muito alta", "fatura vencida"],
    blocos: [
      { tipo: "p", texto: "Os alertas aparecem na **Visão Geral** (em **Análises e recomendações**) e no assunto **Alertas** do **Consultor**. Vêm do mais grave para o menos grave. Todos mostram **Por quê?**, com a conta. O botão de ação só abre a tela certa." },
      { tipo: "titulo", texto: "As gravidades" },
      {
        tipo: "lista",
        itens: ["**Alta**: pede ação logo.", "**Atenção**: vale olhar em breve.", "**Informação**: uma dica ou oportunidade.", "**Boa notícia**: algo deu certo."],
      },
      { tipo: "titulo", texto: "Cada alerta, em linguagem simples" },
      {
        tipo: "exemplo",
        titulo: "Alertas",
        linhas: [
          ["R1 (Alta)", "Há parcela de dívida vencida e não paga. Mostra há quantos dias e a estimativa de multa e juros."],
          ["R2 (Atenção ou Alta)", "As parcelas do mês passam do limite da sua renda (padrão 30% e 50%)."],
          ["R3 (Alta)", "O saldo das contas mais a sua sobra média não cobre as parcelas até o fim do próximo mês."],
          ["R4 (Alta)", "Uma dívida tem taxa muito alta (padrão: acima de 6% ao mês)."],
          ["R5 (Informação)", "A reserva passa do mínimo e uma dívida custa mais que o rendimento dela. Vale avaliar usar o excedente."],
          ["R6 (Atenção)", "A reserva está abaixo do mínimo e você pagou valores extras nas dívidas. Priorize recompor a reserva."],
          ["R7 (Informação)", "Dívida atrasada há mais de 90 dias (padrão). Vale abrir uma negociação."],
          ["R8 (Informação)", "O saldo informado tem mais de 60 dias, ou há dívida sem taxa informada."],
          ["R9 (Atenção)", "O plano ativo ficou abaixo do planejado no mês anterior."],
          ["R10 (Atenção)", "Dívida nova ou compra parcelada grande depois da aprovação do plano."],
          ["R11 (Informação)", "Você paga só o mínimo e tem sobra livre. Mostra quanto pagar a mais encurta o prazo e economiza juros."],
          ["R12 (Boa notícia)", "Uma dívida foi quitada nos últimos 45 dias e a parcela dela ficou livre."],
          ["R13 (Alta)", "Fatura de cartão vencida e alta, ou duas ou mais faturas vencidas do mesmo cartão. É sinal de rotativo."],
        ],
      },
      { tipo: "titulo", texto: "Dispensar ou lembrar depois" },
      {
        tipo: "passos",
        itens: [
          "No cartão do alerta, abra o menu.",
          "**Dispensar** esconde o alerta de vez (dá para trazê-lo de volta).",
          "**Lembrar em 7 dias** esconde e faz o alerta voltar no oitavo dia.",
          "Para ver o que está escondido, use o link **Mostrar N alertas dispensados ou adiados** e, no cartão, **Mostrar de novo**.",
        ],
      },
      { tipo: "titulo", texto: "Desligar um tipo de alerta" },
      { tipo: "p", texto: "Em Configurações > Parâmetros > **Gestão de Dívidas** você encontra **Alertas ligados**. Desmarque o que não quer ver. Isso só esconde: nada é apagado. Ali também ficam os limites (**Taxa muito alta (% ao mês)**, **Atraso que sugere negociar (dias)**, **Rendimento da reserva (% ao mês)** e os limites da renda)." },
      { tipo: "dica", texto: "Alertas R9 e R10 só aparecem se existir um Plano de Quitação ativo." },
    ],
    relacionados: ["consultor-como-usar", "comprometimento-da-renda", "atualizar-saldo", "cartao-atrasado", "ajustar-plano"],
  },
  {
    id: "consultor-com-ia",
    titulo: "Consultor com IA: como ligar, o que é enviado e a privacidade",
    resumo: "O chat com IA é opcional e desligado por padrão. Veja como ligar e o que sai do Gui.",
    assunto: "telas",
    telas: ["consultor"],
    palavras: ["IA", "inteligência artificial", "gemini", "chave", "GUI_IA_CHAVE", "privacidade", "dados enviados", "ver o que será enviado", "limite diário", "chat livre", "resposta com IA", "google", "ligar IA"],
    blocos: [
      { tipo: "p", texto: "O Gui funciona inteiro **sem** IA. O **Consultor com IA** é um extra, **desligado por padrão**: deixa você escrever perguntas livres e receber uma resposta de uma IA de fora. As perguntas prontas continuam sendo calculadas pelo Gui." },
      { tipo: "titulo", texto: "Como ligar" },
      {
        tipo: "passos",
        itens: [
          "Em Configurações > **Recursos**, ligue **Consultor com IA**.",
          "Em Configurações > Parâmetros, abra a seção **Consultor com IA**. Escolha o **Provedor**, confira o **Modelo** e defina o **Limite de perguntas por dia**.",
          "Cadastre a chave do provedor na variável de ambiente `GUI_IA_CHAVE` (o passo a passo está no README, em Consultor com IA). A chave nunca fica no banco nem aparece na tela.",
          "Volte ao **Consultor**. Aparece o aviso \"Consultor com IA ligado\", com o contador de perguntas do dia.",
        ],
      },
      { tipo: "atencao", texto: "Sem a chave, nada é enviado. Enquanto ela não for cadastrada, o aviso diz que falta a chave e as perguntas prontas seguem funcionando." },
      { tipo: "titulo", texto: "O que é enviado" },
      {
        tipo: "lista",
        itens: [
          "Um resumo com **números** (renda, sobra, reserva, saldos, taxas) e a sua pergunta.",
          "As dívidas viram \"Dívida A\", \"Dívida B\". Nome de credor, descrição de lançamento, nome de conta ou cartão, documento e o seu nome **não vão**.",
          "O que você **digitar** na pergunta também vai. Não escreva nomes, documentos ou números de conta.",
        ],
      },
      { tipo: "dica", texto: "Quer ver antes de perguntar? Clique em **Ver o que será enviado**. Aparece exatamente o texto que sai do Gui, mais a instrução fixa que acompanha a pergunta." },
      { tipo: "titulo", texto: "Cuidados" },
      {
        tipo: "lista",
        itens: [
          "Nos planos gratuitos, o provedor pode usar o conteúdo enviado para melhorar os produtos dele. Confira os termos antes de ligar.",
          "A IA só explica e conversa. Ela não paga, não cria e não altera nada. Os botões que ela sugere só abrem a tela certa.",
          "A resposta vem com o selo **Resposta com IA**. Se aparecer \"Confira antes de usar\", há números que não estavam no resumo enviado. Os números oficiais são os que o Gui calcula.",
          "Se o limite diário acabar, o Consultor avisa e volta às perguntas prontas. Mantenha o limite abaixo do que o plano gratuito do provedor permite.",
        ],
      },
    ],
    relacionados: ["consultor-como-usar", "alertas-do-consultor"],
  },
];
