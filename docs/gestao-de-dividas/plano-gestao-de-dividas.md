# Gui: Gestão de Dívidas (plano de construção por fases)

Base: `especificacao-gestao-de-dividas.md` (mesma pasta). Data: 26/11/2026.

O módulo é construído em **seis fases, D1 a D6** (o "D" separa estas fases das fases 0 a 12 do plano original do Gui). **Cada fase é feita numa thread própria, na ordem**, e termina com um PR mergeado, o site publicado funcionando e os testes passando. Uma fase só começa depois que a anterior foi mergeada.

---

## Regras para todas as fases

Quem constrói uma fase **lê antes**: este plano, a especificação (principalmente as seções 3, 4 e 8), o `README.md` e o `AGENTS.md` do repositório (o Next.js do projeto é a versão 16, com mudanças: ler a documentação em `node_modules/next/dist/docs/` antes de escrever código).

1. **Não quebrar nada** (especificação, seção 3): só tabelas novas e colunas opcionais; nenhuma migração apaga ou renomeia nada; as contas de saldo, Visão Geral, relatórios, faturas e orçamentos não mudam.
2. **Visual do Gui** (especificação, seção 4.1): usar os componentes existentes (`/componentes`, `components/ui`, `components/cadastros`, `components/layout`). Nada de cores, fontes ou componentes visuais novos sem necessidade. Antes de abrir o PR, tirar print das telas novas e comparar com uma tela existente (ex.: Contas Financeiras e Orçamentos).
3. **Pagamento por um caminho só**: reaproveitar as funções de pagar, pagamento parcial, pagar fatura e voltar para não pago que já existem.
4. **Contas em funções puras com testes** em `src/lib/dividas/*.ts` e `*.test.ts` (Vitest), como `lib/cartoes/regras.ts`.
5. **Auditoria** na mesma transação de toda gravação (`registrarAuditoria`).
6. **Migrações em sequência** a partir da `0010` (a última hoje é a `0009_refinamentos`), geradas com `npm run db:gerar` depois de mudar `src/db/schema.ts`.
7. **Antes do PR**: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passando, e os testes antigos todos verdes.
8. **README.md**: acrescentar a fase na lista "Fases prontas" e, quando houver regra nova, uma seção "Como ... funciona", no mesmo tom das existentes.
9. **Recurso desligado** (Configurações > Recursos > Gestão de Dívidas): o menu some, as telas mostram o aviso de recurso desativado (`recurso-desativado.tsx`) e nada é apagado.
10. Decisões provisórias da especificação (seção 12) valem; se surgir dúvida nova, escolher a opção mais segura, anotar no PR e na seção 12.

---

## D1. Cadastro de dívidas e integração com o Gui

**Entrega**
- Recurso **Gestão de Dívidas** em Configurações > Recursos (ligado por padrão quando a fase sai? **Decisão provisória: ligado**, já que a pessoa pediu o módulo).
- Item **Gestão > Gestão de Dívidas** no menu e as **abas** do módulo (seção 4.2). As abas das fases seguintes aparecem só quando a fase delas existir (nesta fase: Minhas Dívidas, e a Visão Geral do módulo como uma versão simples com Total devido, Em atraso e Vence em 30 dias).
- **Minhas Dívidas** (lista, filtros, busca, impressão e exportação no padrão), **cadastro de dívida** (modal, seção 6.1) com credor de Clientes e Fornecedores e criação rápida, **Detalhando Dívida** (abas Resumo, Parcelas, Histórico, Vínculos).
- Dívida com **parcelas fixas** (grava os lançamentos pela rotina de parcelamento, ligados por `lancamento.divida_id`) e **sem parcelas** (só saldo; botão Pagar cria o lançamento pago).
- **Contas em aberto no Gui** (faturas fechadas não pagas, despesas vencidas não pagas, recorrentes) com Pagar (janelas de origem), **Acompanhar como dívida** e Desligar.
- **Pagar parcela** (janela atual, com parcial, desconto e juros), **Amortizar** (reduzir valor ou quantidade, com prévia), **Quitar**, **Atualizar saldo**, **Lançar encargo**, **Cancelar dívida**.
- Restante do pagamento parcial herda o `divida_id` (ajuste pequeno na rotina atual, com teste).
- Saldo devedor pelas parcelas, estimado (multa e mora) e informado (seções 8.1 a 8.3). Situações da seção 6.5 (menos "Em negociação").
- Etiqueta **Dívida** nas parcelas em Lançamentos e "Origem: Dívida" no Filtro Avançado.
- Categoria **13. Dívidas** (13.1 Parcelas de Dívidas, 13.2 Juros e Encargos) criada pela migração **só se não existir** (decisão provisória).
- Seção **Gestão de Dívidas** em Parâmetros (multa e mora padrão).

**Banco**: `divida`, `divida_vinculo`, `divida_evento`, coluna `lancamento.divida_id`.

**Testes**: conversão de taxa anual/mensal; estimativa de atraso (multa uma vez, mora por dia); saldo pelas parcelas, estimado e informado (com pagamentos depois da informação); amortização reduzindo valor e reduzindo quantidade (o total fecha no centavo); situação da dívida; uma fatura ou um recorrente não ficam ligados a duas dívidas; o restante do parcial continua na dívida.

**Pronto quando**
- Cadastrar um empréstimo de 12 parcelas cria 12 lançamentos que aparecem em Lançamentos, Agenda, Vencidos e Notificações, com a etiqueta Dívida.
- Pagar uma parcela por Lançamentos ou pelo módulo dá o mesmo resultado, e o saldo da conta cai uma vez só.
- Uma fatura fechada aparece em "Contas em aberto no Gui", é paga pela janela Pagar fatura e some da lista; nada é duplicado.
- Desligar o recurso esconde o módulo e as parcelas continuam em Lançamentos como contas normais.
- Saldo das contas, Visão Geral, relatórios e orçamentos dão os mesmos números de antes para os dados que já existiam.

## D2. Negociações e renegociação

**Entrega**
- Aba **Negociações**: lista com filtros, nova negociação (uma ou várias dívidas do mesmo credor), propostas com os cálculos (total, desconto, juros implícitos, cabe na sobra: nesta fase a sobra é um campo digitado; a sobra calculada chega na D3), situações.
- Assistente de **Renegociação** em etapas (seção 7.3.1) com a revisão antes do Confirmar; dívidas originais **Renegociadas**, parcelas não pagas retiradas de Lançamentos com cópia no histórico e na auditoria, acordo novo com as parcelas, vínculos encerrados.
- **Desfazer renegociação** enquanto o acordo não tem pagamento.
- Situação **Em negociação** nas dívidas. Renegociação também direto pelo menu da dívida (sem negociação antes).
- Valores novos `renegociou` e `aprovou` em `acao_auditoria`.

**Banco**: `negociacao`, `negociacao_divida`, `negociacao_proposta`, `divida_renegociacao`.

**Testes**: juros implícitos de proposta (casos conhecidos da tabela Price, ex.: R$ 1.000,00 em 12 × R$ 88,85 ≈ 1% a.m.); desconto à vista; renegociação de duas dívidas num acordo (parcelas pagas intactas, não pagas retiradas, totais do Saldo Previsto sem dobra); desfazer devolve exatamente as parcelas originais; desfazer recusado depois de um pagamento.

**Pronto quando**
- Renegociar uma dívida com 7 parcelas em aberto em um acordo de 10 parcelas deixa em Lançamentos só as 10 novas (mais as antigas já pagas), e o histórico das duas dívidas mostra o que aconteceu.
- Desfazer volta tudo como estava.

## D3. Simulador

**Entrega**
- Aba **Simulador** com a faixa "nenhum dado real é alterado", entradas (dívidas, dívida hipotética, valor mensal, extra pontual, uso da reserva) e os quatro modos (quitar uma dívida, comparar estratégias, cenários, proposta de negociação).
- Estratégias **Bola de Neve, Avalanche, Risco primeiro, Personalizada** e cenários **Conservador, Intermediário, Acelerado** (seção 8.5).
- **Sobra mensal** e **reserva** calculadas (seção 8.4), com as mesmas contas do Fluxo de Caixa; contas da reserva e reserva mínima em Parâmetros.
- Tabela mês a mês, gráfico, frase-resumo, avisos de mês negativo e reserva abaixo do mínimo; **Guardar simulação**, lista de simulações guardadas, Imprimir/PDF.
- Botão **Simular** na proposta de negociação (D2) e no menu da dívida.
- Botão "Criar plano a partir desta simulação" fica escondido até a D5.

**Banco**: `simulacao`.

**Testes**: cada estratégia com 3 dívidas de exemplo (ordem de quitação, total de juros, mês final); pagamento que não cobre juros (avisa, para em 360 meses); extra pontual; cenários; sobra mensal batendo com o Fluxo de Caixa do mesmo período; e um teste que confirma que simular **não grava nada** (contagem de lançamentos e dívidas antes e depois igual).

**Pronto quando**
- Com as dívidas reais, a comparação mostra qual estratégia economiza mais juros e quando cada dívida acaba, e as contas batem com uma planilha de conferência.

## D4. Visão Geral com alertas e Consultor Gui (sem IA)

**Entrega**
- **Visão Geral** completa do módulo (seção 7.1): todos os indicadores, "Opções" no menu de três pontos dos cartões, rosca por credor/tipo, e **Análises e recomendações** abaixo.
- **Motor de regras** do Consultor com R1 a R8 e R11 a R13 (seção 8.6); R9 e R10 chegam na D5. Cada alerta com "Por quê?" (cálculo), ação sugerida, Dispensar e Lembrar em 7 dias.
- Alertas graves no **sino de Notificações** (calculados na hora).
- Aba **Consultor Gui**: assuntos com histórico, **perguntas prontas**, campo de texto com palavras-chave (sem IA, sem fingir que entende), respostas com conclusão, números, critério e "Como calculei", botões de ação que abrem as janelas normais.
- **Avisos antes de confirmar** (seção 7.6, "Questionar decisões") no cadastro de dívida, no acordo e no uso da reserva no simulador.
- Cartão **Dívidas** na Visão Geral principal (decisão provisória: só com recurso ligado e dívida ativa; escondível nas Opções).
- Limites dos alertas em Parâmetros.

**Banco**: `consultor_assunto`, `consultor_mensagem`; estado dos alertas em `configuracao`.

**Testes**: cada regra com um caso que dispara e um que não dispara; % da renda; previsão de quitação; reconhecimento das palavras-chave (casos de exemplo); o Consultor nunca grava lançamento (as ações só montam o link/janela).

**Pronto quando**
- Com uma parcela em atraso e uma dívida de cheque especial, a Visão Geral mostra os dois alertas no topo com o cálculo, e o sino avisa.
- Perguntar "Qual dívida pagar primeiro?" no Consultor responde com a ordem e o critério, e o histórico fica guardado no assunto.

## D5. Plano de Quitação

**Entrega**
- Aba **Plano de Quitação**: criar a partir de simulação (liga o botão da D3) ou do zero; **Aprovar plano**; um ativo por vez; versões e histórico.
- **Agendar** pagamentos extras do plano como lançamentos não pagos, um a um, só com o clique da pessoa (mês atual e seguinte).
- **Planejado x realizado** por mês, progresso, previsão recalculada, gráfico.
- **Desvios e ajustes** (seção 7.5): cartão "Seu plano precisa de ajuste", **Aprovar ajuste** cria nova versão; **Manter como está** registra a recusa.
- Regras **R9 e R10** do Consultor e perguntas prontas do plano ("Por que meu plano atrasou?", "Quando fico livre das dívidas?").
- Aviso antes de aprovar plano que deixa mês negativo ou reserva abaixo do mínimo.

**Banco**: `plano_quitacao`, `plano_quitacao_mes`, `plano_ajuste`.

**Testes**: realizado calculado dos lançamentos pagos (inclusive parcial e restante); situação do mês (cumprido, parcial, não cumprido); detecção de desvio; ajuste proposto fecha o saldo no prazo; aprovar ajuste preserva a versão anterior; nada muda sem aprovar.

**Pronto quando**
- Aprovar um plano, pagar menos que o planejado num mês e abrir a tela mostra o desvio, a proposta de ajuste e o cálculo; aprovar cria a versão 2 e a 1 continua no histórico.

## D6. Consultor com IA (opcional)

**Entrega**
- Recurso **Consultor com IA** (desligado por padrão) e seção em Parâmetros: provedor (Gemini), modelo, limite diário.
- Chave em `GUI_IA_CHAVE` (Vercel); passo a passo no README para criar a chave gratuita no Google AI Studio e cadastrar na Vercel. **A pessoa cadastra a chave** (nenhum segredo passa pelo chat).
- **Resumo anonimizado** dos números (seção 10), botão "Ver o que será enviado", aviso de privacidade antes de ligar e no chat.
- Perguntas fora das prontas vão para a IA; as prontas continuam no cálculo do Gui. Marca "Resposta com IA". Ações sugeridas só de uma lista fechada, viram botões que abrem as janelas normais.
- Limite diário e contagem em `consultor_uso_ia`; falha ou limite estourado volta às perguntas prontas com aviso.
- Código do provedor isolado (`src/lib/dividas/consultor/ia/`), para trocar de provedor sem mexer no resto.

**Banco**: `consultor_uso_ia`.

**Testes**: o resumo não contém nome de credor, descrição de lançamento, conta nem documento; limite diário; resposta da IA com número que não está no resumo é marcada; sem chave ou com recurso desligado, nenhuma chamada sai; a IA nunca dispara gravação.

**Pronto quando**
- Com o recurso desligado, nada muda. Ligado e com a chave cadastrada, uma pergunta livre ("se eu receber R$ 3.000 de bônus, o que faço?") recebe resposta usando os números do Gui, e a pessoa consegue ver exatamente o que foi enviado.

---

## Riscos

| Risco | Como o plano trata |
|---|---|
| Quebrar o que já funciona (saldos, relatórios, faturas) | Só acréscimos no banco; parcelas como lançamentos comuns; mesmo caminho de pagamento; testes antigos obrigatórios; conferência dos números antes e depois na D1 |
| Contar dívida em dobro (parcela + saldo, ou fatura + dívida) | Obrigação existe uma vez só; vínculos com índice único; renegociação retira as parcelas antigas não pagas |
| Renegociação apagar algo que não devia | Revisão antes do Confirmar, cópia completa no histórico e na auditoria, Desfazer enquanto não há pagamento |
| Estimativas de juros diferentes do credor | Rotuladas como estimativa; Atualizar saldo; alerta de saldo antigo |
| Recomendações parecerem conselho profissional | Tom prudente, "Como calculei" em tudo, rodapé fixo, decisões sempre da pessoa |
| Limites do plano gratuito do Neon/Vercel | Tudo calculado na hora com consultas simples; sem Cron; simulações rodam na tela; nenhuma tabela grande nova |
| Privacidade e custo da IA (D6) | Opcional e desligada por padrão; resumo anonimizado; aviso; limite diário; sistema completo sem IA |
| Mudanças de termos e limites do plano gratuito do Gemini | Provedor isolado e configurável; o Consultor sem IA continua funcionando |
| Visual destoar do Gui | Componentes existentes obrigatórios; comparação de prints antes de cada PR |

## Perguntas em aberto

Estão na seção 12 da especificação, cada uma com a decisão provisória que vale até a pessoa responder.
