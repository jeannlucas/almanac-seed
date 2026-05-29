# SEED.md — Almanac (Feedback Ancorado em Páginas)

> **Esta é uma SEED (spec-driven development).**
> Hidratada num agente de IA (ex.: Claude Code) num diretório vazio, esta
> receita DEVE construir o produto descrito abaixo, do zero, sem
> intervenção manual no código. O app é a evidência; esta spec é o
> entregável. Toda correção DEVE ser feita aqui e regenerada — nunca
> editando o app gerado à mão.

---

## 0. Como usar esta SEED

Agente: leia esta spec inteira antes de gerar qualquer código. Construa o
projeto de forma que **toda** a seção §4 (Critério de Aceitação) passe
ponta a ponta. As palavras-chave **DEVE / DEVERIA / PODE** seguem a
RFC 2119: **DEVE** = obrigatório (reprova se faltar), **DEVERIA** =
recomendado, **PODE** = opcional (diferencial).

Ao terminar, gere também:
- `README.md` com passos de setup (env vars, migração do banco, deploy).
- As migrações SQL do Supabase em `supabase/migrations/`.

---

## 1. Visão do produto

O Almanac é "comentários do Figma para qualquer página". O usuário sobe
uma página (HTML), compartilha um link, e um colega deixa feedback
**ancorado num ponto exato da tela** (um pin com comentário), em vez de
mandar print no chat. O autor vê o pin no lugar certo e responde/resolve.

---

## 2. Stack obrigatória (como o projeto será testado)

- O projeto **DEVE** rodar com **deploy na Vercel**.
- O banco de dados **DEVE** ser **Supabase** (Postgres + Auth +, se usado, Realtime/Storage).
- Se o deploy não funcionar na Vercel ou o banco não rodar no Supabase, o projeto reprova.
- Fora isso a stack é livre. Esta seed assume:
  - **Next.js (App Router)** + TypeScript.
  - **Supabase** para Auth (Google OAuth), Postgres e (opcional) Realtime.
  - **Tailwind CSS** para estilo (suficiente; pixel-perfect NÃO é avaliado).
  - `@supabase/ssr` para sessão server-side compatível com Vercel.

---

## 3. Modelo de dados (Supabase / Postgres)

O agente **DEVE** criar estas tabelas com Row Level Security (RLS) ligada.
IDs são `uuid` com `default gen_random_uuid()`. Timestamps `timestamptz default now()`.

### `profiles`
Espelha `auth.users` (id, email, nome, avatar). Populada via trigger no signup.

### `projects`
- `id`, `owner_id` (fk auth.users), `name` (text), `status`
  (text, enum lógico: `active` | `archived` | `published`, default `active`),
  `share_token` (text, único, gerado no insert — usado no link público),
  `created_at`.

### `pages`
Uma página = um HTML renderizável dentro de um projeto.
- `id`, `project_id` (fk projects, cascade), `html` (text), `version`
  (int, default 1), `created_at`.
- Um projeto **DEVE** ter ≥1 página. Múltiplas páginas/versões são diferencial (§6).

### `pins`
Um pin = âncora de um ponto na página.
- `id`, `page_id` (fk pages, cascade), `author_id` (fk auth.users),
  `anchor` (jsonb — ver §5), `resolved` (bool, default false), `created_at`.

### `comments`
Comentário pertence a um pin; threads via `parent_id`.
- `id`, `pin_id` (fk pins, cascade), `author_id` (fk auth.users),
  `parent_id` (fk comments, nullable — resposta em thread = diferencial),
  `body` (text), `created_at`, `edited_at` (nullable), `deleted_at` (nullable, soft delete).

> O agente **DEVE** entregar as migrações em `supabase/migrations/*.sql`
> e um arquivo de seed de RLS. Sem RLS válida, o projeto está exposto e
> reprova em segurança.

### Políticas RLS (resumo — o agente DEVE implementar)
- `projects`: dono lê/escreve os seus. Leitura pública via `share_token`
  é mediada por uma função/endpoint server-side (não exponha a tabela
  inteira ao anônimo).
- `pages`: legível por quem tem acesso ao projeto (dono OU possui o share_token).
- `pins` / `comments`: legíveis por qualquer um com acesso ao projeto;
  escrita exige usuário autenticado; editar/apagar exige `author_id = auth.uid()`.

---

## 4. Critério de Aceitação (a jornada — TUDO DEVE passar)

Esta é a régua. Se roda do começo ao fim, está valendo.

1. **A pessoa se registra e entra** — login com Google funciona; o app sabe quem é.
2. **Cria um projeto subindo uma página** (cola/sobe HTML); a página é salva.
3. **Compartilha o link** — o app gera uma URL com o `share_token`.
4. **O colega abre o link e vê a MESMA página** renderizada idêntica.
5. **O colega deixa feedback ancorado** — clica num ponto e cria um pin com comentário ali.
6. **O autor vê o feedback no lugar certo e responde / resolve** — o pin
   aparece na mesma coordenada relativa; autor consegue comentar e marcar resolvido.

---

## 5. Os 6 Requisitos Obrigatórios (DEVE)

### R1 — ENTRAR (Login com Google)
- **DEVE** usar Supabase Auth com provider Google.
- Após login, o app **DEVE** identificar o usuário (sessão server-side via `@supabase/ssr`).
- Rotas de projeto **DEVEM** exigir sessão; o link público compartilhado é a exceção (ver R4).

### R2 — SUBIR + RENDERIZAR
- O usuário **DEVE** poder criar um projeto e fornecer uma página HTML
  (textarea colando HTML e/ou upload de arquivo `.html`).
- O HTML **DEVE** ser renderizado dentro do app **idêntico** ao original.
- Renderização **DEVE** ser isolada num `<iframe sandbox>` (sandbox sem
  `allow-same-origin` para o conteúdo do usuário; o overlay de pins fica
  **por cima** do iframe, no documento pai — não dentro dele).

### R3 — ACHAR DE NOVO
- **DEVE** existir uma lista dos projetos do usuário (dashboard) para ele
  voltar a qualquer projeto.

### R4 — COMPARTILHAR
- Cada projeto **DEVE** ter um link com `share_token`
  (ex.: `/share/[token]`) que abre a mesma página renderizada.
- O link **DEVE** funcionar para quem tem a URL. Definir política: leitura
  pública via token; **DEVERIA** exigir login para *escrever* comentário
  (mantém autoria). Se optar por comentário anônimo, registrar identidade mínima.

### R5 — FEEDBACK ANCORADO
- Clicar num ponto da página **DEVE** criar um pin de comentário **naquele
  ponto exato**.
- Fluxo: clique no overlay → captura âncora → abre caixa de comentário →
  salva pin + primeiro comentário no Supabase.

### R6 — PIN QUE FICA E TODO MUNDO VÊ
- O pin **DEVE** persistir (recarregou a página, continua no mesmo lugar).
- O pin **DEVE** ser compartilhado: quem abre o link vê os mesmos pins/comentários.
- **DEVE** existir uma lista dos pins/comentários (sidebar), além dos pins na tela.

---

## 5.1 Ancoragem dos pins (decisão de design crítica — DEVE)

Coordenada absoluta em pixel quebra quando a viewport muda. Para passar em
R6 e abrir caminho aos diferenciais, o `anchor` (jsonb) **DEVE** guardar:

```json
{
  "xPct": 0.42,           // posição X relativa à largura do conteúdo renderizado (0..1)
  "yPct": 0.18,           // posição Y relativa à altura do conteúdo renderizado (0..1)
  "selector": "main > section:nth-of-type(2) > h2",  // (DEVERIA) CSS path do elemento clicado
  "selectorOffset": { "dx": 0.5, "dy": 0.3 },         // offset relativo DENTRO do elemento (0..1)
  "scrollHeight": 2400    // altura total do doc no momento da captura (p/ normalizar)
}
```

- Render **DEVE** reposicionar o pin a partir de `xPct/yPct` sobre as
  dimensões atuais do conteúdo (robusto a resize de viewport).
- Quando `selector` existir, o app **DEVERIA** preferir ancorar ao
  elemento + `selectorOffset` (sobrevive a mudança de layout — diferencial
  "âncora que aguenta mudança de layout").
- Como o conteúdo do usuário vive num iframe sandbox, a captura do clique
  e a leitura de coordenadas/seletor **DEVEM** ser feitas via um pequeno
  script injetado no `srcdoc` do iframe que faz `postMessage` ao pai com
  `{xPct, yPct, selector, selectorOffset, scrollHeight}` no clique; o pai
  desenha o overlay de pins ancorado nesses valores e sincroniza scroll.

---

## 6. Diferenciais (PODE — sobe a régua; a régua decide quem ganha)

Implementar **após** os 6 obrigatórios estarem 100% e deployados.
Prioridade sugerida (alto impacto, baixo custo com esta base):

### D1 — CONVERSA (prioridade alta)
- Responder em **thread** (usa `comments.parent_id`).
- **Resolver / reabrir** pin (`pins.resolved`).
- **Editar** e **apagar** o próprio comentário (`edited_at`, soft delete `deleted_at`).
- Reagir com emoji (tabela `reactions` opcional).

### D2 — AO VIVO (prioridade alta — brilha no vídeo)
- Presença: ver quem está olhando a página agora (**Supabase Realtime
  presence**).
- Feed de atividade do feedback recente (subscribe em `comments`/`pins`).

### D3 — PINS MELHORES
- Arrastar o pin para reposicionar (atualiza `anchor`).
- Agrupar pins próximos (cluster por distância no overlay).
- Âncora resistente a mudança de layout (já previsto via `selector` em §5.1).

### D4 — VERSÕES
- Projeto com várias páginas/opções de design e versões (`pages.version`),
  com histórico para comparar.

### D5 — ORGANIZAÇÃO
- Status do projeto (`active` / `archived` / `published`) com filtro no dashboard.
- Contadores no painel (nº de pins, não resolvidos, etc.).

---

## 7. Rotas (Next.js App Router) — referência

- `/` — landing + botão "Entrar com Google".
- `/login` — inicia OAuth Google (Supabase).
- `/auth/callback` — troca de código por sessão (`@supabase/ssr`).
- `/dashboard` — lista de projetos do usuário (R3) + criar projeto.
- `/projects/[id]` — editor/visualizador do dono: página renderizada +
  overlay de pins + sidebar de comentários + botão compartilhar.
- `/share/[token]` — visão compartilhada: mesma página + pins; comentar (R4).
- `/api/*` ou Server Actions — CRUD de projetos, páginas, pins, comentários,
  resolução de `share_token` server-side (não vaza RLS).

---

## 8. Variáveis de ambiente (DEVEM existir na Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # apenas server-side, p/ resolver share_token
NEXT_PUBLIC_SITE_URL=             # usado no redirect do OAuth
```

O `README.md` gerado **DEVE** explicar: criar projeto Supabase, habilitar
Google provider (com Client ID/Secret do Google Cloud), apontar a
**Redirect URL** do Supabase para `NEXT_PUBLIC_SITE_URL/auth/callback`,
rodar migrações, e setar as env vars na Vercel.

---

## 9. Critério de "pronto" (o agente DEVE autovalidar)

Antes de declarar concluído, confirme cada item da §4 e §5 manualmente no
deploy. Um checklist em `README.md` mapeando R1–R6 → como testar **DEVE**
existir. Faltou um obrigatório, não passou.

---

## 10. Regra de Ouro

O entregável é **esta receita**, não só o app. Um produto sem a seed que o
constrói está desqualificado. Mantenha esta SEED e o app em sincronia:
correção entra **aqui** e o app é **regenerado**.
