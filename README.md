# Gui: gestor financeiro pessoal

Sistema de finanças pessoais inspirado no Contas Online, para **um único usuário**, em português do Brasil.
Visual verde escuro e amarelo, com o mascote Gui.

Este é o resultado da **Fase 0 (Fundação)** do plano: login, barra verde com os menus, layout base,
componentes visuais e o banco de dados com as tabelas iniciais e a carga padrão
(79 categorias, 5 formas de pagamento, 6 feriados nacionais e a lista de bancos).
As telas dos menus ainda mostram "Em construção" com a fase em que chegam.

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

## Como o projeto está organizado

| Pasta / arquivo | O que tem |
|---|---|
| `src/app/login` | Tela de login. |
| `src/app/(sistema)` | Telas internas (só com login): Visão Geral, "Em construção" e a vitrine `/componentes`. |
| `src/components/layout` | Barra verde, logotipo, barra de favoritos, Central de Ajuda, cabeçalho das telas. |
| `src/components/ui` | Componentes base: botão, janela (modal), tabela, chave liga/desliga, faixa amarela de erro, valor em reais. |
| `src/lib/menu.ts` | Itens dos menus e em qual fase cada tela chega. |
| `src/db/schema.ts` | As tabelas do banco. |
| `drizzle/` | Migrações: `0000` cria as tabelas, `0001` faz a carga inicial. |
| `src/auth.ts` | Login (Auth.js), sessão de 20 minutos sem atividade. |
| `scripts/` | Scripts de terminal: configurar, migrar, criar usuário. |

## Regras do projeto

- **Dinheiro em centavos inteiros**: R$ 83,37 é guardado como `8337`. Nada de casas decimais no banco.
- **Datas sem hora** para vencimento, pagamento etc.; fuso `America/Sao_Paulo`.
- **Cadastros não são apagados**, são inativados (campo `ativo`).
- **Um único usuário**: não há coluna de "dono" nas tabelas.
- **Segredos nunca vão para o GitHub**: só nas variáveis de ambiente da Vercel ou no `.env` local.

## Ferramentas

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Auth.js 5, Drizzle ORM com Postgres (Neon), bcryptjs, Zod, ícones Lucide.
