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
- A extensão `pgcrypto` **DEVE** estar habilitada (fornece
  `gen_random_uuid()` e `gen_random_bytes()`). No Supabase, essa extensão
  vive no schema `extensions`, não `public` — as migrations **DEVEM**
  referenciar essas funções com prefixo explícito
  (`extensions.gen_random_uuid()`, `extensions.gen_random_bytes(...)`) ou
  configurar `search_path` apropriado. Sem isso, `migrate up` falha.
- Um `middleware.ts` na raiz do projeto **DEVE** renovar a sessão a
  cada request. O `@supabase/ssr` (App Router) exige que o cookie de
  sessão seja revalidado server-side; o padrão é:
  - Criar `createServerClient(url, anonKey, { cookies: { getAll, setAll } })`
    bridgeando `request.cookies` ↔ `response.cookies`.
  - Chamar `await supabase.auth.getUser()` (não `getSession()`) para
    forçar a validação e o refresh do JWT.
  - `export const config = { matcher: [...] }` excluindo assets
    estáticos (`_next/static`, `_next/image`, imagens, `favicon.ico`).
  - Sem este middleware, o usuário fica "deslogado" em rotas SSR após
    o JWT expirar — pega no R3/R4.

---

## 3. Modelo de dados (Supabase / Postgres)

O agente **DEVE** criar estas tabelas com Row Level Security (RLS) ligada.
IDs são `uuid` com `default extensions.gen_random_uuid()` (Supabase — ver §2).
Timestamps `timestamptz default now()`.

### `profiles`
Espelha `auth.users` (id, email, nome, avatar). Populada via trigger no signup.

### `projects`
- `id`, `owner_id` (fk auth.users), `name` (text), `status`
  (text, enum lógico: `active` | `archived` | `published`, default `active`),
  `share_token` (text, **único**, default
  `encode(extensions.gen_random_bytes(16), 'hex')` — 32 chars hex
  aleatórios, usado no link público), `created_at`.

### `pages`
Uma página = um HTML renderizável dentro de um projeto.
- `id`, `project_id` (fk projects, cascade), `html` (text), `version`
  (int, default 1), `created_at`.
- Um projeto **DEVE** ter ≥1 página. Múltiplas páginas/versões são diferencial (§6).

### `pins`
Um pin = âncora de um ponto na página.
- `id`, `page_id` (fk pages, cascade), `author_id` (fk auth.users,
  **nullable, `on delete set null`** — preserva o pin no histórico se o
  usuário for deletado), `anchor` (jsonb — ver §5), `resolved` (bool,
  default false), `created_at`.

### `comments`
Comentário pertence a um pin; threads via `parent_id`.
- `id`, `pin_id` (fk pins, cascade), `author_id` (fk auth.users,
  **nullable, `on delete set null`** — mesma justificativa de `pins`),
  `parent_id` (fk comments, nullable — resposta em thread = diferencial),
  `body` (text), `created_at`, `edited_at` (nullable), `deleted_at`
  (nullable, soft delete).

> O agente **DEVE** entregar as migrações em `supabase/migrations/*.sql`
> com RLS, GRANTs e RPCs. Sem RLS válida o projeto está exposto; sem
> GRANTs (§3.2) o app quebra com `permission denied` antes mesmo da
> policy ser avaliada. Reprova em qualquer dos dois casos.

### 3.1 Políticas RLS (DEVE)

- `profiles`: **DEVE** ter policy `select` para qualquer `authenticated`
  (`using true`). Necessário para a sidebar exibir nome/avatar de quem
  comentou — sem isso o owner não lê perfis de outros autores e a UI cai
  para "Member". Escrita em `profiles` é controlada apenas pelo trigger
  `handle_new_user` (§3.3); não criar policies de insert/update.
- `projects`: CRUD restrito ao `owner_id = auth.uid()`. **Não há policy
  pública via `share_token`** — leitura anônima passa exclusivamente
  pela RPC (§3.3).
- `pages`: leitura/escrita restritas ao owner do projeto. Leitura via
  share token **DEVE** ser feita pela RPC `get_project_by_share_token`
  (SECURITY DEFINER), nunca via policy de RLS.
- `pins` / `comments`:
  - `select`: owner do projeto (join `pages → projects`).
  - `insert`: `author_id is not null and author_id = auth.uid()` E o
    registro pertence a página/projeto do `auth.uid()`.
  - `update`: autor (`author_id is not null and author_id = auth.uid()`);
    em `pins`, owner do projeto também PODE atualizar (para
    resolver/reabrir).
  - `delete`: autor.
- Como `author_id` é nullable (§3), **toda comparação com `auth.uid()`
  em policy DEVE ser guardada com `author_id is not null`**. Sem essa
  guarda, registros órfãos (autor deletado) ficariam mutáveis por
  qualquer um.

### 3.2 GRANTs (DEVE — não esquecer)

No Supabase, tabelas criadas via migration **NÃO recebem GRANTs
automáticos** para os roles `anon` / `authenticated`. RLS sem GRANT
resulta em `permission denied for table <x>` antes da policy ser
avaliada. O agente **DEVE** entregar uma migration de grants com:

- `grant usage on schema public to anon, authenticated`.
- `grant select, insert, update, delete on
  public.{projects, pages, pins, comments} to authenticated`.
- `grant select on public.profiles to authenticated`.
- `anon` **NÃO DEVE** receber grant direto em nenhuma tabela. Toda
  interação anônima passa pelas RPCs SECURITY DEFINER (§3.3), que rodam
  com o privilégio do owner da função e bypassam as RLS de tabela.

### 3.3 Funções server-side (DEVE)

- **`handle_new_user()`** — trigger `after insert on auth.users` que
  espelha o perfil em `public.profiles`. O nome **DEVE** ser resolvido
  via `coalesce(raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'name')` — o Google OAuth ora preenche
  `full_name`, ora `name`; sem o coalesce parte dos usuários fica
  anônima na UI.
- **Três RPCs `SECURITY DEFINER`** para o fluxo `/share/[token]`,
  todas com `set search_path = public`:
  - `get_project_by_share_token(p_token text) → jsonb` — devolve
    `{project, pages, pins, comments, profiles}`. **DEVE** incluir
    `profiles` no payload (assemblado dentro da função) para que o
    anon consiga renderizar nome/avatar dos autores sem GRANT em
    `profiles`. `grant execute to anon, authenticated`.
  - `add_pin_via_share_token(p_token, p_page_id, p_anchor, p_body) →
    uuid` — **DEVE** rejeitar `auth.uid() is null` com exceção;
    valida que o `page_id` pertence ao projeto do token; insere pin
    + primeiro comentário. `grant execute to authenticated`.
  - `add_comment_via_share_token(p_token, p_pin_id, p_body) → uuid`
    — idem; só logado escreve. `grant execute to authenticated`.

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
- Renderização **DEVE** ser isolada num `<iframe>` carregado via
  `srcdoc`, com atributos de sandbox **exatamente**:
  - `sandbox="allow-scripts"` — **DEVE** estar presente; sem ele, o
    script injetado em §5.1 não roda e R5 quebra silenciosamente.
  - `allow-same-origin` — **NÃO DEVE** estar presente; com ele, o
    HTML do usuário acessa storage/cookies do app pai.
- O overlay de pins fica **por cima** do iframe, no documento pai —
  nunca dentro dele.

### R3 — ACHAR DE NOVO
- **DEVE** existir uma lista dos projetos do usuário (dashboard) para ele
  voltar a qualquer projeto.

### R4 — COMPARTILHAR
- Cada projeto **DEVE** ter um link com `share_token`
  (ex.: `/share/[token]`) que abre a mesma página renderizada.
- O link **DEVE** funcionar para quem tem a URL.
- **Leitura via token**: pública (anon), mediada pela RPC
  `get_project_by_share_token` (§3.3). A RLS das tabelas continua
  restrita ao owner — não há policy pública por token.
- **Escrita via token**: **DEVE exigir login**. As RPCs
  `add_pin_via_share_token` e `add_comment_via_share_token` rejeitam
  `auth.uid() is null`. Autoria de pin/comentário é sempre um usuário
  registrado; **não há comentário anônimo**.
- O link **DEVE** ser canônico — impresso server-side a partir de
  `NEXT_PUBLIC_SITE_URL` (§8). NUNCA use `VERCEL_URL` nem
  `window.location.origin` para montar o share link.

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
  script injetado no `srcdoc` do iframe que faz `window.parent.postMessage`
  com `{xPct, yPct, selector, selectorOffset, scrollHeight}` no clique;
  o pai desenha o overlay de pins ancorado nesses valores e sincroniza
  scroll.
- O receptor `window.addEventListener("message", ...)` no documento pai
  **DEVE** validar `event.source === iframeRef.current.contentWindow`
  antes de aceitar a âncora. **NÃO** validar via `event.origin` —
  iframes carregados por `srcdoc` ficam com origin `null` (Chrome) ou
  da página pai (outros), tornando a checagem por origin frágil; a
  checagem correta é por `source` (referência ao Window do iframe).
- O script injetado **DEVERIA** ser mantido como string (não importado
  como módulo) para sobreviver intacto à transformação do bundler — ele
  roda no contexto do sandbox, não do app.

---

## 5.2 Internacionalização (DEVERIA)

A UI **DEVERIA** suportar múltiplos idiomas (pt, en, es), com `pt` como
default. Não é R-obrigatório (não faz parte da §4), mas o app real
expõe um seletor de idioma e o avaliador o verá em uso — sem esta
seção, SEED e app divergem na superfície.

- Idiomas suportados: `pt` | `en` | `es` (default `pt`).
- Resolução **DEVE** ser server-side (compatível com SSR do App Router):
  - 1º) cookie `almanac.lang` (válido por 1 ano).
  - 2º) header `Accept-Language` do request.
  - 3º) fallback para `pt`.
- O dicionário **DEVERIA** ser fortemente tipado (`type Dictionary`) e
  morar em `lib/i18n/dictionary.ts`, com uma chave por idioma. Não
  introduzir dependência runtime de biblioteca externa de i18n —
  cookie + dicionário tipado bastam.
- **DEVERIA** existir um `LanguageToggle` no header trocando o cookie e
  recarregando a rota (Server Action ou `router.refresh()`).
- Toda string da UI **DEVERIA** vir do dicionário; nenhuma string
  visível hard-coded em JSX. Comentários, identificadores, mensagens de
  log e commits continuam em inglês (independe de i18n).

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

## 8. Variáveis de ambiente

Obrigatórias na Vercel (**DEVEM**):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=             # domínio canônico — ver §8.1
```

Opcional (**PODE**):

```
SUPABASE_SERVICE_ROLE_KEY=        # server-only; não usado em runtime no MVP
```

> `SUPABASE_SERVICE_ROLE_KEY` **NÃO** é usada em runtime no MVP — leituras
> e escritas anônimas do `/share` vão pelas RPCs SECURITY DEFINER (§3.3).
> O agente PODE provisionar um helper server-only (p.ex.
> `lib/supabase/service-role.ts`) para administração futura. Se não
> houver call site, a env var PODE ficar ausente sem quebrar o app.

### 8.1 Regras de `NEXT_PUBLIC_SITE_URL` (DEVE)

- Valor **DEVE** ser o domínio canônico de produção (ex.:
  `https://almanac.app`), sem trailing slash.
- O share link impresso server-side (`/share/[token]`) **DEVE** ser
  montado a partir desta variável, via um helper único (p.ex.
  `getSiteUrl()` em `lib/env.ts`).
- O app **NÃO DEVE** usar `VERCEL_URL` para montar share link.
  `VERCEL_URL` aponta para o deployment específico (`*.vercel.app`),
  cuja URL fica atrás da tela de login da Vercel em deploys de preview
  — quebra R4.
- O app **NÃO DEVE** usar `window.location.origin` para montar share
  link impresso pelo server. Em dev sem a env var, o helper **DEVERIA**
  cair para `http://localhost:3000`. Em produção sem a env var, o
  helper **DEVE** lançar exceção (fail-fast) — preferível a vazar URL
  errada.
- **Exceção (PODE)**: o `redirectTo` do `signInWithOAuth` no cliente
  PODE usar `window.location.origin`. Justificativa: o OAuth é uma
  viagem ida-e-volta no mesmo host que carregou a página; a regra
  canônica vale para URLs **persistidas/compartilhadas**, não para
  callbacks transientes.

### 8.2 README

O `README.md` gerado **DEVE** explicar: criar projeto Supabase, habilitar
Google provider (com Client ID/Secret do Google Cloud), apontar a
**Redirect URL** do Supabase para `NEXT_PUBLIC_SITE_URL/auth/callback`,
rodar migrações (inclusive a de GRANTs — §3.2), e setar as env vars na
Vercel.

---

## 9. Definition of Done (checklist verificável)

Antes de declarar concluído, confirme cada item abaixo no deploy. Faltou
um, não passou. Um checklist correspondente em `README.md` mapeando
R1–R6 → como testar **DEVE** existir.

### Banco / migrations

- [ ] Migrations aplicadas em ordem (extensions, profiles+trigger,
      projects, pages, pins, comments, rls_policies, share_rpcs,
      grants).
- [ ] `pgcrypto` habilitada via schema `extensions`; chamadas a
      `gen_random_uuid()` e `gen_random_bytes()` usam prefixo
      `extensions.` nas migrations.
- [ ] RLS habilitada em `profiles`, `projects`, `pages`, `pins`,
      `comments`.
- [ ] Policy `profiles_select_authenticated` (`using true`) ativa
      (sobrescreve `profiles_select_self`).
- [ ] Policies de `pins`/`comments` guardam comparações de `author_id`
      com `is not null` (porque `author_id` é nullable).
- [ ] GRANTs aplicados: `usage on schema public` para `anon` +
      `authenticated`; CRUD em `projects`/`pages`/`pins`/`comments`
      para `authenticated`; `select` em `profiles` para
      `authenticated`; **nenhum** grant direto em tabela para `anon`.
- [ ] Três RPCs SECURITY DEFINER (`get_project_by_share_token`,
      `add_pin_via_share_token`, `add_comment_via_share_token`) com
      `set search_path = public` e `grant execute` correto.

### Env / deploy

- [ ] `NEXT_PUBLIC_SITE_URL` setada na Vercel para o domínio canônico
      (sem trailing slash).
- [ ] Share link impresso server-side usa essa URL; `grep` no código
      confirma que `VERCEL_URL` e `window.location.origin` NÃO
      aparecem na composição de share link.
- [ ] Redirect URL do Supabase Google provider aponta para
      `NEXT_PUBLIC_SITE_URL/auth/callback`.
- [ ] `middleware.ts` na raiz com `createServerClient` +
      `auth.getUser()` e `config.matcher` excluindo assets — sessão
      sobrevive a navegação SSR depois do JWT expirar.

### Jornada (R1–R6)

- [ ] R1 — login com Google funciona; sessão server-side via
      `@supabase/ssr`.
- [ ] R2 — criar projeto + colar/upload HTML; renderizado em
      `<iframe srcdoc sandbox="allow-scripts">` (sem `allow-same-origin`).
- [ ] R3 — dashboard lista projetos do usuário.
- [ ] R4 — `/share/[token]` abre página renderizada para anon; escrever
      pin/comentário no share exige login (RPC rejeita anon).
- [ ] R5 — clique no overlay cria pin com `{xPct, yPct, selector,
      selectorOffset, scrollHeight}` + primeiro comentário; receptor
      de `postMessage` no pai valida `event.source` (não `event.origin`).
- [ ] R6 — pin persiste após reload; visível para outros via share;
      sidebar lista pins/comentários exibindo nome+avatar dos autores.

---

## 10. Regra de Ouro

O entregável é **esta receita**, não só o app. Um produto sem a seed que o
constrói está desqualificado. Mantenha esta SEED e o app em sincronia:
correção entra **aqui** e o app é **regenerado**.

---

## 11. Apêndice — Código de referência verbatim

> Esta seção embute o código-fonte do projeto **literalmente**. O agente
> **DEVE** reproduzir cada arquivo abaixo no caminho indicado, byte a
> byte (preservando indentação, aspas, comentários e quebras de linha).
> Onde §1–§10 cravam comportamento, esta seção crava a implementação.
> Em caso de conflito aparente, §1–§10 mandam — o código aqui é
> referência canônica do que está em produção hoje.

### 11.0 Estrutura de pastas (DEVE)

```
.
├── app/
│   ├── auth/
│   │   ├── callback/route.ts
│   │   └── signout/route.ts
│   ├── dashboard/
│   │   ├── actions.ts
│   │   └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── projects/[id]/
│   │   ├── actions.ts
│   │   └── page.tsx
│   ├── share/[token]/
│   │   ├── actions.ts
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── app/
│   │   ├── AppBackground.tsx
│   │   └── AppHeader.tsx
│   ├── auth/
│   │   └── GoogleSignInButton.tsx
│   ├── dashboard/
│   │   ├── NewProjectForm.tsx
│   │   └── ProjectList.tsx
│   ├── editor/
│   │   ├── injected/capture-script.ts
│   │   ├── CommentSidebar.tsx
│   │   ├── Editor.tsx
│   │   ├── PageFrame.tsx
│   │   ├── PinPopover.tsx
│   │   ├── PinsOverlay.tsx
│   │   └── ShareButton.tsx
│   ├── i18n/
│   │   └── LanguageToggle.tsx
│   └── landing/
│       ├── BackgroundFX.tsx
│       ├── Features.tsx
│       ├── Footer.tsx
│       ├── Hero.tsx
│       ├── Landing.tsx
│       └── TopBar.tsx
├── lib/
│   ├── auth/require-user.ts
│   ├── i18n/
│   │   ├── cookie.ts
│   │   ├── dictionary.ts
│   │   └── server.ts
│   ├── pins/
│   │   ├── anchor.ts
│   │   └── messages.ts
│   ├── supabase/
│   │   ├── browser.ts
│   │   ├── server.ts
│   │   └── service-role.ts
│   ├── types/db.ts
│   └── env.ts
├── supabase/migrations/
│   ├── 20260529000000_extensions.sql
│   ├── 20260529000100_profiles.sql
│   ├── 20260529000200_projects.sql
│   ├── 20260529000300_pages.sql
│   ├── 20260529000400_pins.sql
│   ├── 20260529000500_comments.sql
│   ├── 20260529000600_rls_policies.sql
│   ├── 20260529000700_share_rpcs.sql
│   └── 20260529000800_grants.sql
├── middleware.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

### 11.1 `package.json`

```json
{
  "name": "almanac",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.45.4",
    "framer-motion": "^12.40.0",
    "geist": "^1.7.1",
    "lucide-react": "^1.17.0",
    "next": "^15.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.14.0",
    "eslint-config-next": "^15.1.6",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3"
  }
}
```

### 11.2 Configs

#### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
```

#### `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        brand: {
          from: "#a855f7",
          via: "#8b5cf6",
          to: "#22d3ee",
        },
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(120deg, #a855f7 0%, #8b5cf6 50%, #22d3ee 100%)",
      },
      keyframes: {
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "gradient-pan": "gradient-pan 8s ease infinite",
        "fade-in-up": "fade-in-up 0.6s ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;
```

#### `postcss.config.mjs`

```js
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

#### `middleware.ts`

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### 11.3 App shell

#### `app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Almanac — Pin-anchored feedback for any web page",
  description:
    "Upload an HTML page, share a link, and let your team drop pinned feedback exactly where it matters.",
  keywords: [
    "feedback",
    "design review",
    "comments",
    "html",
    "collaboration",
    "figma alternative",
  ],
  openGraph: {
    title: "Almanac — Pin-anchored feedback for any web page",
    description:
      "Upload an HTML page, share a link, and let your team drop pinned feedback exactly where it matters.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
```

#### `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
}

html,
body {
  height: 100%;
}

html {
  scroll-behavior: smooth;
}

@layer utilities {
  .bg-grid {
    background-image:
      linear-gradient(to right, rgba(63, 63, 70, 0.35) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(63, 63, 70, 0.35) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 80%);
  }

  .text-gradient-brand {
    background-image: linear-gradient(120deg, #a855f7 0%, #8b5cf6 50%, #22d3ee 100%);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}
```

### 11.4 Migrations (Supabase)

Cada arquivo está em `supabase/migrations/`. Aplicar em ordem.

#### `20260529000000_extensions.sql`

```sql
-- Required for gen_random_uuid() and gen_random_bytes()
create extension if not exists pgcrypto;
```

#### `20260529000100_profiles.sql`

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy profiles_select_self
  on public.profiles for select
  using (id = auth.uid());
```

> A policy `profiles_select_self` é substituída pela `profiles_select_authenticated`
> em `20260529000800_grants.sql`.

#### `20260529000200_projects.sql`

```sql
create table public.projects (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'archived', 'published')),
  share_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects (owner_id);

alter table public.projects enable row level security;
```

#### `20260529000300_pages.sql`

```sql
create table public.pages (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  html text not null,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create index pages_project_id_idx on public.pages (project_id);

alter table public.pages enable row level security;
```

#### `20260529000400_pins.sql`

```sql
create table public.pins (
  id uuid primary key default extensions.gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  anchor jsonb not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index pins_page_id_idx on public.pins (page_id);

alter table public.pins enable row level security;
```

#### `20260529000500_comments.sql`

```sql
create table public.comments (
  id uuid primary key default extensions.gen_random_uuid(),
  pin_id uuid not null references public.pins(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index comments_pin_id_idx on public.comments (pin_id);
create index comments_parent_id_idx on public.comments (parent_id);

alter table public.comments enable row level security;
```

#### `20260529000600_rls_policies.sql`

```sql
-- projects: owner-only access; public reads go through share RPC, not RLS.

create policy projects_select_owner
  on public.projects for select
  using (owner_id = auth.uid());

create policy projects_insert_owner
  on public.projects for insert
  with check (owner_id = auth.uid());

create policy projects_update_owner
  on public.projects for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy projects_delete_owner
  on public.projects for delete
  using (owner_id = auth.uid());

-- pages: tied to the project's owner. Public share reads go through RPC.

create policy pages_select_owner
  on public.pages for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = pages.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy pages_insert_owner
  on public.pages for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = pages.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy pages_update_owner
  on public.pages for update
  using (
    exists (
      select 1 from public.projects p
      where p.id = pages.project_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = pages.project_id
        and p.owner_id = auth.uid()
    )
  );

create policy pages_delete_owner
  on public.pages for delete
  using (
    exists (
      select 1 from public.projects p
      where p.id = pages.project_id
        and p.owner_id = auth.uid()
    )
  );

-- pins: author_id is nullable (set null on user delete). Predicates that
-- compare author_id to auth.uid() therefore must guard with `is not null`.

create policy pins_select_owner
  on public.pins for select
  using (
    exists (
      select 1
      from public.pages pg
      join public.projects p on p.id = pg.project_id
      where pg.id = pins.page_id
        and p.owner_id = auth.uid()
    )
  );

create policy pins_insert_owner
  on public.pins for insert
  with check (
    author_id is not null
    and author_id = auth.uid()
    and exists (
      select 1
      from public.pages pg
      join public.projects p on p.id = pg.project_id
      where pg.id = pins.page_id
        and p.owner_id = auth.uid()
    )
  );

create policy pins_update_author_or_owner
  on public.pins for update
  using (
    (author_id is not null and author_id = auth.uid())
    or exists (
      select 1
      from public.pages pg
      join public.projects p on p.id = pg.project_id
      where pg.id = pins.page_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    (author_id is not null and author_id = auth.uid())
    or exists (
      select 1
      from public.pages pg
      join public.projects p on p.id = pg.project_id
      where pg.id = pins.page_id
        and p.owner_id = auth.uid()
    )
  );

create policy pins_delete_author
  on public.pins for delete
  using (author_id is not null and author_id = auth.uid());

-- comments: same shape as pins.

create policy comments_select_owner
  on public.comments for select
  using (
    exists (
      select 1
      from public.pins pn
      join public.pages pg on pg.id = pn.page_id
      join public.projects p on p.id = pg.project_id
      where pn.id = comments.pin_id
        and p.owner_id = auth.uid()
    )
  );

create policy comments_insert_owner
  on public.comments for insert
  with check (
    author_id is not null
    and author_id = auth.uid()
    and exists (
      select 1
      from public.pins pn
      join public.pages pg on pg.id = pn.page_id
      join public.projects p on p.id = pg.project_id
      where pn.id = comments.pin_id
        and p.owner_id = auth.uid()
    )
  );

create policy comments_update_author
  on public.comments for update
  using (author_id is not null and author_id = auth.uid())
  with check (author_id is not null and author_id = auth.uid());

create policy comments_delete_author
  on public.comments for delete
  using (author_id is not null and author_id = auth.uid());
```

#### `20260529000700_share_rpcs.sql`

```sql
-- Server-side resolution of share_token without exposing tables to anon.
-- All three functions run as SECURITY DEFINER and validate the token.

create or replace function public.get_project_by_share_token(p_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'project', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'status', p.status,
      'share_token', p.share_token,
      'created_at', p.created_at
    ),
    'pages', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pg.id,
            'project_id', pg.project_id,
            'html', pg.html,
            'version', pg.version,
            'created_at', pg.created_at
          )
          order by pg.created_at
        )
        from public.pages pg
        where pg.project_id = p.id
      ),
      '[]'::jsonb
    ),
    'pins', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', pn.id,
            'page_id', pn.page_id,
            'author_id', pn.author_id,
            'anchor', pn.anchor,
            'resolved', pn.resolved,
            'created_at', pn.created_at
          )
          order by pn.created_at
        )
        from public.pins pn
        join public.pages pg on pg.id = pn.page_id
        where pg.project_id = p.id
      ),
      '[]'::jsonb
    ),
    'comments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'pin_id', c.pin_id,
            'author_id', c.author_id,
            'parent_id', c.parent_id,
            'body', c.body,
            'created_at', c.created_at,
            'edited_at', c.edited_at
          )
          order by c.created_at
        )
        from public.comments c
        join public.pins pn on pn.id = c.pin_id
        join public.pages pg on pg.id = pn.page_id
        where pg.project_id = p.id
          and c.deleted_at is null
      ),
      '[]'::jsonb
    ),
    'profiles', coalesce(
      (
        select jsonb_agg(distinct jsonb_build_object(
          'id', pr.id,
          'full_name', pr.full_name,
          'avatar_url', pr.avatar_url
        ))
        from public.profiles pr
        where pr.id in (
          select pn.author_id from public.pins pn
          join public.pages pg on pg.id = pn.page_id
          where pg.project_id = p.id and pn.author_id is not null
          union
          select c.author_id from public.comments c
          join public.pins pn on pn.id = c.pin_id
          join public.pages pg on pg.id = pn.page_id
          where pg.project_id = p.id and c.author_id is not null
        )
      ),
      '[]'::jsonb
    )
  )
  from public.projects p
  where p.share_token = p_token;
$$;

revoke all on function public.get_project_by_share_token(text) from public;
grant execute on function public.get_project_by_share_token(text) to anon, authenticated;

-- Insert a pin (+ first comment) by a logged-in user via share token.
create or replace function public.add_pin_via_share_token(
  p_token text,
  p_page_id uuid,
  p_anchor jsonb,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_pin_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'comment body required' using errcode = '22023';
  end if;

  select pg.project_id
    into v_project_id
    from public.pages pg
    join public.projects p on p.id = pg.project_id
   where pg.id = p_page_id
     and p.share_token = p_token;

  if v_project_id is null then
    raise exception 'invalid share token or page' using errcode = '42501';
  end if;

  insert into public.pins (page_id, author_id, anchor)
  values (p_page_id, v_uid, p_anchor)
  returning id into v_pin_id;

  insert into public.comments (pin_id, author_id, body)
  values (v_pin_id, v_uid, p_body);

  return v_pin_id;
end;
$$;

revoke all on function public.add_pin_via_share_token(text, uuid, jsonb, text) from public;
grant execute on function public.add_pin_via_share_token(text, uuid, jsonb, text) to authenticated;

-- Insert a comment on an existing pin via share token.
create or replace function public.add_comment_via_share_token(
  p_token text,
  p_pin_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_match int;
  v_comment_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'comment body required' using errcode = '22023';
  end if;

  select 1
    into v_match
    from public.pins pn
    join public.pages pg on pg.id = pn.page_id
    join public.projects p on p.id = pg.project_id
   where pn.id = p_pin_id
     and p.share_token = p_token;

  if v_match is null then
    raise exception 'invalid share token or pin' using errcode = '42501';
  end if;

  insert into public.comments (pin_id, author_id, body)
  values (p_pin_id, v_uid, p_body)
  returning id into v_comment_id;

  return v_comment_id;
end;
$$;

revoke all on function public.add_comment_via_share_token(text, uuid, text) from public;
grant execute on function public.add_comment_via_share_token(text, uuid, text) to authenticated;
```

#### `20260529000800_grants.sql`

```sql
-- Schema usage. Supabase grants this by default for new projects, but being
-- explicit avoids surprises on restored / cloned databases.
grant usage on schema public to anon, authenticated;

-- Owner-side CRUD. RLS policies (migration 000600) restrict rows; these grants
-- make the tables visible to the authenticated role in the first place.
grant select, insert, update, delete on table public.projects   to authenticated;
grant select, insert, update, delete on table public.pages      to authenticated;
grant select, insert, update, delete on table public.pins       to authenticated;
grant select, insert, update, delete on table public.comments   to authenticated;

-- profiles: authenticated reads display info of any user (full_name / avatar_url).
-- The existing profiles_select_self policy is replaced by a broader policy so
-- the owner can see who authored each pin/comment in the sidebar. Writes are
-- still controlled by the handle_new_user trigger only.
grant select on table public.profiles to authenticated;

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_authenticated
  on public.profiles for select
  to authenticated
  using (true);

-- anon: no direct table grants. The /share/[token] flow goes through three
-- SECURITY DEFINER RPCs (get_project_by_share_token, add_pin_via_share_token,
-- add_comment_via_share_token) that were already granted EXECUTE in 000700
-- and run with the function owner's privileges.
```

### 11.5 Helpers (`lib/`)

#### `lib/env.ts`

```ts
export function getSiteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error(
    "NEXT_PUBLIC_SITE_URL must be set in production. Configure it in your hosting environment.",
  );
}
```

#### `lib/supabase/browser.ts`

```ts
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

#### `lib/supabase/server.ts`

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll may be called from a Server Component; in that case the
            // refreshed cookies are propagated by the middleware instead.
          }
        },
      },
    },
  );
}

export async function createSupabaseAnonServerClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No-op: anon client never writes auth cookies.
        },
      },
    },
  );
}
```

#### `lib/supabase/service-role.ts`

> Não usado em runtime no MVP (ver §8). Mantido para administração futura.

```ts
import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createSupabaseServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing.",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

#### `lib/auth/require-user.ts`

```ts
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return { user, supabase };
}

export async function getOptionalUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}
```

#### `lib/pins/anchor.ts`

```ts
import { z } from "zod";

export type Anchor = {
  xPct: number;
  yPct: number;
  selector: string | null;
  selectorOffset: { dx: number; dy: number } | null;
  scrollHeight: number;
};

export const anchorSchema = z.object({
  xPct: z.number().min(0).max(1),
  yPct: z.number().min(0).max(1),
  selector: z.string().max(2000).nullable(),
  selectorOffset: z
    .object({ dx: z.number().min(0).max(1), dy: z.number().min(0).max(1) })
    .nullable(),
  scrollHeight: z.number().min(0).max(200000),
});
```

#### `lib/pins/messages.ts`

```ts
import type { Anchor } from "@/lib/pins/anchor";

export type Viewport = {
  scrollTop: number;
  scrollLeft: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
};

export type ParentToIframeMessage =
  | { type: "parent:setMode"; mode: "idle" | "placing" }
  | { type: "parent:requestViewport" };

export type IframeToParentMessage =
  | {
      type: "iframe:ready";
      viewport: Viewport;
    }
  | {
      type: "iframe:viewport";
      viewport: Viewport;
    }
  | {
      type: "iframe:pinPlaced";
      anchor: Anchor;
      viewport: Viewport;
    };
```

#### `lib/types/db.ts`

```ts
import type { Anchor } from "@/lib/pins/anchor";

export type ProjectStatus = "active" | "archived" | "published";

export type Project = {
  id: string;
  owner_id?: string;
  name: string;
  status: ProjectStatus;
  share_token: string;
  created_at: string;
};

export type Page = {
  id: string;
  project_id: string;
  html: string;
  version: number;
  created_at: string;
};

export type Pin = {
  id: string;
  page_id: string;
  author_id: string | null;
  anchor: Anchor;
  resolved: boolean;
  created_at: string;
};

export type Comment = {
  id: string;
  pin_id: string;
  author_id: string | null;
  parent_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
};

export type ProfileLite = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type ShareBundle = {
  project: Pick<Project, "id" | "name" | "status" | "share_token" | "created_at">;
  pages: Page[];
  pins: Pin[];
  comments: Comment[];
  profiles: ProfileLite[];
};
```

#### `lib/i18n/cookie.ts`

```ts
export const LANG_COOKIE = "almanac.lang";
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
```

#### `lib/i18n/server.ts`

```ts
import "server-only";

import { cookies, headers } from "next/headers";

import { LANG_COOKIE } from "./cookie";
import { isLang, SUPPORTED_LANGS, type Lang } from "./dictionary";

function pickFromAcceptLanguage(header: string | null): Lang {
  if (!header) return "pt";
  const tags = header.split(",").map((part) => part.split(";")[0]?.trim().toLowerCase() ?? "");
  for (const tag of tags) {
    const short = tag.slice(0, 2);
    if (SUPPORTED_LANGS.includes(short as Lang)) {
      return short as Lang;
    }
  }
  return "pt";
}

export async function getLang(): Promise<Lang> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LANG_COOKIE)?.value;
  if (isLang(fromCookie)) return fromCookie;
  const headerStore = await headers();
  return pickFromAcceptLanguage(headerStore.get("accept-language"));
}
```

### 11.6 Dicionário i18n (`lib/i18n/dictionary.ts`)

```ts
export type Lang = "pt" | "en" | "es";

export const SUPPORTED_LANGS: Lang[] = ["pt", "en", "es"];

export const LANG_META: Record<Lang, { flag: string; label: string }> = {
  pt: { flag: "🇧🇷", label: "PT" },
  en: { flag: "🇺🇸", label: "EN" },
  es: { flag: "🇪🇸", label: "ES" },
};

export type FeatureIcon = "Upload" | "Share2" | "MessageSquarePlus";

export type Dictionary = {
  nav: {
    signIn: string;
    signOut: string;
  };
  hero: {
    kicker: string;
    titleLine1: string;
    titleLine2: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  features: {
    title: string;
    subtitle: string;
    items: Array<{
      icon: FeatureIcon;
      title: string;
      body: string;
    }>;
  };
  footer: {
    credit: string;
  };
  login: {
    back: string;
    title: string;
    subtitle: string;
    cta: string;
    legal: string;
  };
  dashboard: {
    kicker: string;
    greetingNamed: (name: string) => string;
    greetingAnon: string;
    countZero: string;
    countOne: string;
    countMany: (n: number) => string;
    recent: string;
    recentHint: string;
    newProject: string;
    statusLabels: {
      active: string;
      published: string;
      archived: string;
    };
    emptyTitle: string;
    emptyBody: string;
    form: {
      nameLabel: string;
      namePlaceholder: string;
      htmlLabel: string;
      htmlHelper: string;
      uploadIdle: string;
      submitIdle: string;
      submitPending: string;
    };
  };
  editor: {
    ownerBadge: string;
    sharedBadge: string;
    backToDashboard: string;
    addPin: string;
    placingHint: string;
    unauthHint: string;
    errorSavePin: string;
    errorAddComment: string;
    errorUpdatePin: string;
    popover: {
      placeholder: string;
      cancel: string;
      save: string;
      saving: string;
    };
    share: {
      copy: string;
      copied: string;
    };
    sidebar: {
      titleTemplate: string;
      pinLabelTemplate: string;
      empty: string;
      statusOpen: string;
      statusResolved: string;
      member: string;
      deletedUser: string;
      replyPlaceholder: string;
      reply: string;
      saving: string;
      resolve: string;
      reopen: string;
    };
  };
};

const PT: Dictionary = {
  nav: {
    signIn: "Entrar",
    signOut: "Sair",
  },
  hero: {
    kicker: "ALMANAC",
    titleLine1: "Feedback ancorado",
    titleLine2: "em qualquer página web.",
    subtitle:
      "Sobe o HTML, compartilha o link e deixa o time colar pins exatamente onde precisa. Sem mais print no chat.",
    ctaPrimary: "Entrar com Google",
    ctaSecondary: "Como funciona",
  },
  features: {
    title: "Três passos. Zero atrito.",
    subtitle:
      "Do upload ao comentário ancorado, sem ferramenta nova pra ninguém aprender.",
    items: [
      {
        icon: "Upload",
        title: "Sobe o HTML",
        body: "Cola o markup ou faz upload do arquivo. Renderiza igualzinho num iframe sandbox isolado.",
      },
      {
        icon: "Share2",
        title: "Compartilha o link",
        body: "Link único com share_token. Manda no Slack e o time já abre a página exata pra revisar.",
      },
      {
        icon: "MessageSquarePlus",
        title: "Cola um pin",
        body: "Clica onde dói, escreve o comentário. O pin fica ancorado por coordenada relativa, responsivo.",
      },
    ],
  },
  footer: {
    credit: "Desenvolvido por BigDev.Z - IT Consulting",
  },
  login: {
    back: "Voltar para o início",
    title: "Entre na sua conta",
    subtitle: "Use sua conta Google para acessar seus projetos.",
    cta: "Entrar com Google",
    legal: "Ao continuar, você concorda em ser fantástico.",
  },
  dashboard: {
    kicker: "Dashboard",
    greetingNamed: (name) => `Olá, ${name}`,
    greetingAnon: "Olá de novo",
    countZero: "Crie seu primeiro projeto e comece a coletar feedback ancorado.",
    countOne: "Você tem 1 projeto por aqui.",
    countMany: (n) => `Você tem ${n} projetos por aqui.`,
    recent: "Projetos recentes",
    recentHint: "mais novos primeiro",
    newProject: "Novo projeto",
    statusLabels: {
      active: "ativo",
      published: "publicado",
      archived: "arquivado",
    },
    emptyTitle: "Nenhum projeto por aqui ainda.",
    emptyBody:
      "Crie seu primeiro projeto no formulário ao lado para começar a receber feedback ancorado.",
    form: {
      nameLabel: "Nome do projeto",
      namePlaceholder: "Landing page v2",
      htmlLabel: "HTML da página",
      htmlHelper:
        "Cole um documento HTML completo ou faça upload de um arquivo .html.",
      uploadIdle: "Upload .html",
      submitIdle: "Criar projeto",
      submitPending: "Criando projeto…",
    },
  },
  editor: {
    ownerBadge: "Dono",
    sharedBadge: "Visualização compartilhada",
    backToDashboard: "Voltar",
    addPin: "Adicionar pin",
    placingHint: "Clique na página…",
    unauthHint: "Entre para comentar",
    errorSavePin: "Falha ao salvar o pin",
    errorAddComment: "Falha ao comentar",
    errorUpdatePin: "Falha ao atualizar o pin",
    popover: {
      placeholder: "Deixe um comentário…",
      cancel: "Cancelar",
      save: "Salvar pin",
      saving: "Salvando…",
    },
    share: {
      copy: "Copiar link",
      copied: "Link copiado!",
    },
    sidebar: {
      titleTemplate: "Pins ({n})",
      pinLabelTemplate: "Pin {n}",
      empty: "Nenhum pin ainda. Use \"Adicionar pin\" e clique na página.",
      statusOpen: "Aberto",
      statusResolved: "Resolvido",
      member: "Membro",
      deletedUser: "Usuário removido",
      replyPlaceholder: "Responder…",
      reply: "Responder",
      saving: "Salvando…",
      resolve: "Resolver",
      reopen: "Reabrir",
    },
  },
};

const EN: Dictionary = {
  nav: {
    signIn: "Sign in",
    signOut: "Sign out",
  },
  hero: {
    kicker: "ALMANAC",
    titleLine1: "Pin-anchored feedback",
    titleLine2: "for any web page.",
    subtitle:
      "Upload the HTML, share the link, let your team drop pins exactly where it hurts. No more screenshots in chat.",
    ctaPrimary: "Sign in with Google",
    ctaSecondary: "How it works",
  },
  features: {
    title: "Three steps. Zero friction.",
    subtitle:
      "From upload to anchored comment — no new tool for anyone on the team to learn.",
    items: [
      {
        icon: "Upload",
        title: "Upload the HTML",
        body: "Paste the markup or upload the file. Renders pixel-perfect in an isolated sandboxed iframe.",
      },
      {
        icon: "Share2",
        title: "Share the link",
        body: "Unique link with share_token. Drop it in Slack and your team opens the exact same page to review.",
      },
      {
        icon: "MessageSquarePlus",
        title: "Drop a pin",
        body: "Click where it hurts, write the comment. The pin sticks via relative coordinates — responsive by design.",
      },
    ],
  },
  footer: {
    credit: "Built by BigDev.Z - IT Consulting",
  },
  login: {
    back: "Back to home",
    title: "Sign in to your account",
    subtitle: "Use your Google account to access your projects.",
    cta: "Sign in with Google",
    legal: "By continuing, you agree to be awesome.",
  },
  dashboard: {
    kicker: "Dashboard",
    greetingNamed: (name) => `Hi, ${name}`,
    greetingAnon: "Welcome back",
    countZero:
      "Create your first project and start collecting anchored feedback.",
    countOne: "You have 1 project here.",
    countMany: (n) => `You have ${n} projects here.`,
    recent: "Recent projects",
    recentHint: "newest first",
    newProject: "New project",
    statusLabels: {
      active: "active",
      published: "published",
      archived: "archived",
    },
    emptyTitle: "No projects here yet.",
    emptyBody:
      "Create your first project in the form on the side to start collecting anchored feedback.",
    form: {
      nameLabel: "Project name",
      namePlaceholder: "Landing page v2",
      htmlLabel: "Page HTML",
      htmlHelper:
        "Paste a full HTML document or upload an .html file.",
      uploadIdle: "Upload .html",
      submitIdle: "Create project",
      submitPending: "Creating project…",
    },
  },
  editor: {
    ownerBadge: "Owner",
    sharedBadge: "Shared view",
    backToDashboard: "Back",
    addPin: "Add pin",
    placingHint: "Click on page…",
    unauthHint: "Sign in to comment",
    errorSavePin: "Failed to save pin",
    errorAddComment: "Failed to comment",
    errorUpdatePin: "Failed to update pin",
    popover: {
      placeholder: "Leave a comment…",
      cancel: "Cancel",
      save: "Save pin",
      saving: "Saving…",
    },
    share: {
      copy: "Copy link",
      copied: "Link copied!",
    },
    sidebar: {
      titleTemplate: "Pins ({n})",
      pinLabelTemplate: "Pin {n}",
      empty: "No pins yet. Use \"Add pin\" and click on the page.",
      statusOpen: "Open",
      statusResolved: "Resolved",
      member: "Member",
      deletedUser: "Deleted user",
      replyPlaceholder: "Reply…",
      reply: "Reply",
      saving: "Saving…",
      resolve: "Resolve",
      reopen: "Reopen",
    },
  },
};

const ES: Dictionary = {
  nav: {
    signIn: "Entrar",
    signOut: "Salir",
  },
  hero: {
    kicker: "ALMANAC",
    titleLine1: "Feedback anclado",
    titleLine2: "en cualquier página web.",
    subtitle:
      "Sube el HTML, comparte el enlace y deja que tu equipo coloque pins exactamente donde duele. Sin más capturas en el chat.",
    ctaPrimary: "Entrar con Google",
    ctaSecondary: "Cómo funciona",
  },
  features: {
    title: "Tres pasos. Cero fricción.",
    subtitle:
      "Del upload al comentario anclado, sin herramienta nueva para que nadie tenga que aprender.",
    items: [
      {
        icon: "Upload",
        title: "Sube el HTML",
        body: "Pega el markup o sube el archivo. Se renderiza idéntico en un iframe sandbox aislado.",
      },
      {
        icon: "Share2",
        title: "Comparte el enlace",
        body: "Enlace único con share_token. Mándalo por Slack y el equipo abre la página exacta para revisar.",
      },
      {
        icon: "MessageSquarePlus",
        title: "Coloca un pin",
        body: "Haz clic donde duele, escribe el comentario. El pin queda anclado por coordenada relativa, responsivo.",
      },
    ],
  },
  footer: {
    credit: "Desarrollado por BigDev.Z - IT Consulting",
  },
  login: {
    back: "Volver al inicio",
    title: "Entra en tu cuenta",
    subtitle: "Usa tu cuenta de Google para acceder a tus proyectos.",
    cta: "Entrar con Google",
    legal: "Al continuar, aceptas ser fantástico.",
  },
  dashboard: {
    kicker: "Dashboard",
    greetingNamed: (name) => `Hola, ${name}`,
    greetingAnon: "Bienvenido de nuevo",
    countZero:
      "Crea tu primer proyecto y empieza a recoger feedback anclado.",
    countOne: "Tienes 1 proyecto por aquí.",
    countMany: (n) => `Tienes ${n} proyectos por aquí.`,
    recent: "Proyectos recientes",
    recentHint: "los más nuevos primero",
    newProject: "Nuevo proyecto",
    statusLabels: {
      active: "activo",
      published: "publicado",
      archived: "archivado",
    },
    emptyTitle: "Todavía no hay proyectos por aquí.",
    emptyBody:
      "Crea tu primer proyecto en el formulario al lado para empezar a recibir feedback anclado.",
    form: {
      nameLabel: "Nombre del proyecto",
      namePlaceholder: "Landing page v2",
      htmlLabel: "HTML de la página",
      htmlHelper:
        "Pega un documento HTML completo o sube un archivo .html.",
      uploadIdle: "Subir .html",
      submitIdle: "Crear proyecto",
      submitPending: "Creando proyecto…",
    },
  },
  editor: {
    ownerBadge: "Dueño",
    sharedBadge: "Vista compartida",
    backToDashboard: "Volver",
    addPin: "Añadir pin",
    placingHint: "Haz clic en la página…",
    unauthHint: "Entra para comentar",
    errorSavePin: "Error al guardar el pin",
    errorAddComment: "Error al comentar",
    errorUpdatePin: "Error al actualizar el pin",
    popover: {
      placeholder: "Deja un comentario…",
      cancel: "Cancelar",
      save: "Guardar pin",
      saving: "Guardando…",
    },
    share: {
      copy: "Copiar enlace",
      copied: "¡Enlace copiado!",
    },
    sidebar: {
      titleTemplate: "Pins ({n})",
      pinLabelTemplate: "Pin {n}",
      empty: "Todavía no hay pins. Usa \"Añadir pin\" y haz clic en la página.",
      statusOpen: "Abierto",
      statusResolved: "Resuelto",
      member: "Miembro",
      deletedUser: "Usuario eliminado",
      replyPlaceholder: "Responder…",
      reply: "Responder",
      saving: "Guardando…",
      resolve: "Resolver",
      reopen: "Reabrir",
    },
  },
};

export const dictionary: Record<Lang, Dictionary> = {
  pt: PT,
  en: EN,
  es: ES,
};

export function isLang(value: unknown): value is Lang {
  return value === "pt" || value === "en" || value === "es";
}
```

### 11.7 Capture script (`components/editor/injected/capture-script.ts`)

```ts
// Runs inside the sandboxed iframe (no allow-same-origin). Only channel to the
// parent is window.parent.postMessage. Kept as a string so it isn't touched by
// the bundler and stays self-contained.
export const CAPTURE_SCRIPT = `(() => {
  const send = (msg) => {
    try { window.parent.postMessage(msg, '*'); } catch (e) {}
  };

  const measure = () => ({
    scrollTop: window.scrollY || document.documentElement.scrollTop || 0,
    scrollLeft: window.scrollX || document.documentElement.scrollLeft || 0,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
  });

  let mode = 'idle';
  let frame = null;

  const flushViewport = () => {
    frame = null;
    send({ type: 'iframe:viewport', viewport: measure() });
  };

  const scheduleViewport = () => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(flushViewport);
  };

  const computeSelector = (el) => {
    if (!(el instanceof Element)) return null;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (same.length > 1) {
          const idx = same.indexOf(node) + 1;
          part += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.length ? 'body > ' + parts.join(' > ') : 'body';
  };

  const onClick = (ev) => {
    if (mode !== 'placing') return;
    ev.preventDefault();
    ev.stopPropagation();

    const target = ev.target;
    const rect = target && target.getBoundingClientRect
      ? target.getBoundingClientRect()
      : { left: 0, top: 0, width: 1, height: 1 };

    const viewport = measure();
    const pageX = ev.clientX + viewport.scrollLeft;
    const pageY = ev.clientY + viewport.scrollTop;
    const docW = Math.max(viewport.scrollWidth, 1);
    const docH = Math.max(viewport.scrollHeight, 1);

    const anchor = {
      xPct: Math.min(1, Math.max(0, pageX / docW)),
      yPct: Math.min(1, Math.max(0, pageY / docH)),
      selector: computeSelector(target),
      selectorOffset: rect.width > 0 && rect.height > 0
        ? {
            dx: Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)),
            dy: Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height)),
          }
        : null,
      scrollHeight: docH,
    };

    mode = 'idle';
    document.documentElement.style.cursor = '';
    send({ type: 'iframe:pinPlaced', anchor, viewport });
  };

  window.addEventListener('message', (ev) => {
    const data = ev.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'parent:setMode') {
      mode = data.mode === 'placing' ? 'placing' : 'idle';
      document.documentElement.style.cursor = mode === 'placing' ? 'crosshair' : '';
    } else if (data.type === 'parent:requestViewport') {
      send({ type: 'iframe:viewport', viewport: measure() });
    }
  });

  document.addEventListener('click', onClick, true);
  window.addEventListener('scroll', scheduleViewport, { passive: true });
  window.addEventListener('resize', scheduleViewport, { passive: true });

  const ready = () => send({ type: 'iframe:ready', viewport: measure() });
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(ready, 0);
  } else {
    document.addEventListener('DOMContentLoaded', ready);
  }
})();`;
```

### 11.8 Routes (`app/`)

#### `app/page.tsx`

```tsx
import { redirect } from "next/navigation";

import { Landing } from "@/components/landing/Landing";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getLang } from "@/lib/i18n/server";

export default async function HomePage() {
  const { user } = await getOptionalUser();
  if (user) {
    redirect("/dashboard");
  }

  const lang = await getLang();
  return <Landing lang={lang} />;
}
```

#### `app/login/page.tsx`

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AppBackground } from "@/components/app/AppBackground";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import { getOptionalUser } from "@/lib/auth/require-user";
import { dictionary } from "@/lib/i18n/dictionary";
import { getLang } from "@/lib/i18n/server";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { user } = await getOptionalUser();
  const { next } = await searchParams;
  if (user) {
    redirect(next ?? "/dashboard");
  }

  const lang = await getLang();
  const t = dictionary[lang];

  return (
    <>
      <AppBackground />
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
        <div className="mb-8 flex w-full items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.login.back}
          </Link>
          <LanguageToggle lang={lang} />
        </div>

        <div className="w-full rounded-3xl border border-zinc-800/80 bg-zinc-900/50 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-300">
              <Sparkles className="h-3 w-3 text-brand-via" />
              Almanac
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              {t.login.title}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">{t.login.subtitle}</p>
          </div>

          <div className="flex justify-center">
            <GoogleSignInButton
              variant="dark"
              label={t.login.cta}
              redirectTo={next}
            />
          </div>
        </div>

        <p className="mt-6 text-xs text-zinc-500">{t.login.legal}</p>
      </main>
    </>
  );
}
```

#### `app/auth/callback/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next");
  const next = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=oauth", origin));
}
```

#### `app/auth/signout/route.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
```

#### `app/dashboard/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(120),
  html: z.string().min(1, "HTML content is required").max(1_000_000),
});

export type CreateProjectState = {
  error?: string;
} | undefined;

export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    html: formData.get("html"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({ name: parsed.data.name, owner_id: user.id })
    .select("id, share_token")
    .single();

  if (projectError || !project) {
    return { error: projectError?.message ?? "Failed to create project" };
  }

  const { error: pageError } = await supabase.from("pages").insert({
    project_id: project.id,
    html: parsed.data.html,
  });

  if (pageError) {
    return { error: pageError.message };
  }

  revalidatePath("/dashboard");
  redirect(`/projects/${project.id}`);
}
```

#### `app/dashboard/page.tsx`

```tsx
import { Clock4, Folder } from "lucide-react";

import { AppBackground } from "@/components/app/AppBackground";
import { AppHeader } from "@/components/app/AppHeader";
import { NewProjectForm } from "@/components/dashboard/NewProjectForm";
import { ProjectList } from "@/components/dashboard/ProjectList";
import { requireUser } from "@/lib/auth/require-user";
import { dictionary } from "@/lib/i18n/dictionary";
import { getLang } from "@/lib/i18n/server";

export default async function DashboardPage() {
  const { user, supabase } = await requireUser();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const projectList = projects ?? [];
  const lang = await getLang();
  const t = dictionary[lang];
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;
  const firstName = fullName?.split(" ")[0] ?? null;
  const greeting = firstName
    ? t.dashboard.greetingNamed(firstName)
    : t.dashboard.greetingAnon;

  const countText =
    projectList.length === 0
      ? t.dashboard.countZero
      : projectList.length === 1
        ? t.dashboard.countOne
        : t.dashboard.countMany(projectList.length);

  return (
    <>
      <AppBackground />
      <div className="flex min-h-screen flex-col">
        <AppHeader
          t={t}
          lang={lang}
          email={user.email ?? ""}
          fullName={fullName}
          avatarUrl={avatarUrl}
        />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
          <section className="mb-10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-brand-via">
              {t.dashboard.kicker}
            </p>
            <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              {greeting}.
            </h1>
            <p className="mt-2 text-sm text-zinc-400">{countText}</p>
          </section>

          <div className="grid gap-8 lg:grid-cols-[1.1fr,1fr]">
            <section>
              <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                <Folder className="h-3.5 w-3.5" />
                {t.dashboard.recent}
                <span className="ml-auto inline-flex items-center gap-1 text-zinc-500 normal-case tracking-normal">
                  <Clock4 className="h-3 w-3" />
                  {t.dashboard.recentHint}
                </span>
              </div>
              <ProjectList projects={projectList} t={t} lang={lang} />
            </section>

            <section>
              <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                {t.dashboard.newProject}
              </div>
              <NewProjectForm t={t.dashboard.form} />
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
```

#### `app/projects/[id]/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { anchorSchema } from "@/lib/pins/anchor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.string().trim().min(1).max(4000);
const uuidSchema = z.string().uuid();

const createPinInput = z.object({
  projectId: uuidSchema,
  pageId: uuidSchema,
  anchor: anchorSchema,
  body: bodySchema,
});

const createCommentInput = z.object({
  projectId: uuidSchema,
  pinId: uuidSchema,
  body: bodySchema,
});

const resolvePinInput = z.object({
  projectId: uuidSchema,
  pinId: uuidSchema,
  resolved: z.boolean(),
});

async function getAuthedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return { supabase, user };
}

export async function createPinAsOwner(input: z.infer<typeof createPinInput>) {
  const parsed = createPinInput.parse(input);
  const { supabase, user } = await getAuthedClient();

  const { data: pin, error: pinError } = await supabase
    .from("pins")
    .insert({
      page_id: parsed.pageId,
      author_id: user.id,
      anchor: parsed.anchor,
    })
    .select("id")
    .single();

  if (pinError || !pin) {
    throw new Error(pinError?.message ?? "Failed to create pin");
  }

  const { error: commentError } = await supabase.from("comments").insert({
    pin_id: pin.id,
    author_id: user.id,
    body: parsed.body,
  });

  if (commentError) {
    throw new Error(commentError.message);
  }

  revalidatePath(`/projects/${parsed.projectId}`);
}

export async function createCommentAsOwner(
  input: z.infer<typeof createCommentInput>,
) {
  const parsed = createCommentInput.parse(input);
  const { supabase, user } = await getAuthedClient();

  const { error } = await supabase.from("comments").insert({
    pin_id: parsed.pinId,
    author_id: user.id,
    body: parsed.body,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${parsed.projectId}`);
}

export async function resolvePinAsOwner(
  input: z.infer<typeof resolvePinInput>,
) {
  const parsed = resolvePinInput.parse(input);
  const { supabase } = await getAuthedClient();

  const { error } = await supabase
    .from("pins")
    .update({ resolved: parsed.resolved })
    .eq("id", parsed.pinId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/projects/${parsed.projectId}`);
}
```

#### `app/projects/[id]/page.tsx`

```tsx
import { notFound } from "next/navigation";

import { Editor } from "@/components/editor/Editor";
import {
  createCommentAsOwner,
  createPinAsOwner,
  resolvePinAsOwner,
} from "@/app/projects/[id]/actions";
import { requireUser } from "@/lib/auth/require-user";
import { getSiteUrl } from "@/lib/env";
import { dictionary } from "@/lib/i18n/dictionary";
import { getLang } from "@/lib/i18n/server";
import type { Anchor } from "@/lib/pins/anchor";
import type {
  Comment,
  Page,
  Pin,
  ProfileLite,
  Project,
} from "@/lib/types/db";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: RouteProps) {
  const { id } = await params;
  const { user, supabase } = await requireUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, share_token, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const { data: pages } = await supabase
    .from("pages")
    .select("id, project_id, html, version, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true })
    .limit(1);

  const page = (pages ?? [])[0];
  if (!page) {
    notFound();
  }

  const { data: pins } = await supabase
    .from("pins")
    .select("id, page_id, author_id, anchor, resolved, created_at")
    .eq("page_id", page.id)
    .order("created_at", { ascending: true });

  const pinIds = (pins ?? []).map((p) => p.id);

  const commentsResult = pinIds.length
    ? await supabase
        .from("comments")
        .select("id, pin_id, author_id, parent_id, body, created_at, edited_at")
        .in("pin_id", pinIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
    : { data: [] as Comment[] };

  const comments = (commentsResult.data ?? []) as Comment[];

  const authorIds = Array.from(
    new Set(
      [
        ...(pins ?? []).map((p) => p.author_id),
        ...comments.map((c) => c.author_id),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  let profiles: ProfileLite[] = [];
  if (authorIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", authorIds);
    profiles = data ?? [];
  }

  const shareUrl = `${getSiteUrl()}/share/${project.share_token}`;

  async function createPin(input: {
    pageId: string;
    anchor: Anchor;
    body: string;
  }) {
    "use server";
    await createPinAsOwner({ projectId: id, ...input });
  }

  async function createComment(input: { pinId: string; body: string }) {
    "use server";
    await createCommentAsOwner({ projectId: id, ...input });
  }

  async function resolvePin(input: { pinId: string; resolved: boolean }) {
    "use server";
    await resolvePinAsOwner({ projectId: id, ...input });
  }

  const lang = await getLang();
  const t = dictionary[lang];
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    null;
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ??
    (user.user_metadata?.picture as string | undefined) ??
    null;

  return (
    <Editor
      mode={{ kind: "owner", project: project as Project }}
      page={page as Page}
      pins={(pins ?? []) as Pin[]}
      comments={comments}
      profiles={profiles}
      shareUrl={shareUrl}
      isAuthenticated
      createPin={createPin}
      createComment={createComment}
      resolvePin={resolvePin}
      lang={lang}
      t={t.editor}
      navT={t.nav}
      user={{ email: user.email ?? "", fullName, avatarUrl }}
    />
  );
}
```

#### `app/share/[token]/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { anchorSchema } from "@/lib/pins/anchor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const bodySchema = z.string().trim().min(1).max(4000);
const tokenSchema = z.string().min(1).max(128);
const uuidSchema = z.string().uuid();

const createPinInput = z.object({
  token: tokenSchema,
  pageId: uuidSchema,
  anchor: anchorSchema,
  body: bodySchema,
});

const createCommentInput = z.object({
  token: tokenSchema,
  pinId: uuidSchema,
  body: bodySchema,
});

export async function createPinViaShareToken(
  input: z.infer<typeof createPinInput>,
) {
  const parsed = createPinInput.parse(input);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/share/${parsed.token}`)}`);
  }

  const { error } = await supabase.rpc("add_pin_via_share_token", {
    p_token: parsed.token,
    p_page_id: parsed.pageId,
    p_anchor: parsed.anchor,
    p_body: parsed.body,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/share/${parsed.token}`);
}

export async function createCommentViaShareToken(
  input: z.infer<typeof createCommentInput>,
) {
  const parsed = createCommentInput.parse(input);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/share/${parsed.token}`)}`);
  }

  const { error } = await supabase.rpc("add_comment_via_share_token", {
    p_token: parsed.token,
    p_pin_id: parsed.pinId,
    p_body: parsed.body,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/share/${parsed.token}`);
}
```

#### `app/share/[token]/page.tsx`

```tsx
import { notFound } from "next/navigation";

import { Editor } from "@/components/editor/Editor";
import {
  createCommentViaShareToken,
  createPinViaShareToken,
} from "@/app/share/[token]/actions";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getSiteUrl } from "@/lib/env";
import { dictionary } from "@/lib/i18n/dictionary";
import { getLang } from "@/lib/i18n/server";
import type { Anchor } from "@/lib/pins/anchor";
import { createSupabaseAnonServerClient } from "@/lib/supabase/server";
import type {
  Comment,
  Page,
  Pin,
  ProfileLite,
  Project,
  ShareBundle,
} from "@/lib/types/db";

type RouteProps = {
  params: Promise<{ token: string }>;
};

export default async function SharePage({ params }: RouteProps) {
  const { token } = await params;

  const anon = await createSupabaseAnonServerClient();
  const { data, error } = await anon.rpc("get_project_by_share_token", {
    p_token: token,
  });

  if (error || !data) {
    notFound();
  }

  const bundle = data as ShareBundle | null;
  if (!bundle || !bundle.project) {
    notFound();
  }

  const page = bundle.pages[0];
  if (!page) {
    notFound();
  }

  const pinsForPage = bundle.pins.filter((pin) => pin.page_id === page.id);
  const pinIds = new Set(pinsForPage.map((pin) => pin.id));
  const commentsForPage = bundle.comments.filter((c) =>
    pinIds.has(c.pin_id),
  );

  const { user } = await getOptionalUser();
  const shareUrl = `${getSiteUrl()}/share/${token}`;

  async function createPin(input: {
    pageId: string;
    anchor: Anchor;
    body: string;
  }) {
    "use server";
    await createPinViaShareToken({
      token,
      pageId: input.pageId,
      anchor: input.anchor,
      body: input.body,
    });
  }

  async function createComment(input: { pinId: string; body: string }) {
    "use server";
    await createCommentViaShareToken({
      token,
      pinId: input.pinId,
      body: input.body,
    });
  }

  const lang = await getLang();
  const t = dictionary[lang];
  const fullName = user
    ? ((user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null)
    : null;
  const avatarUrl = user
    ? ((user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        null)
    : null;

  return (
    <Editor
      mode={{
        kind: "public",
        project: bundle.project as Project,
        shareToken: token,
      }}
      page={page as Page}
      pins={pinsForPage as Pin[]}
      comments={commentsForPage as Comment[]}
      profiles={(bundle.profiles ?? []) as ProfileLite[]}
      shareUrl={shareUrl}
      isAuthenticated={Boolean(user)}
      createPin={createPin}
      createComment={createComment}
      resolvePin={null}
      lang={lang}
      t={t.editor}
      navT={t.nav}
      user={
        user
          ? { email: user.email ?? "", fullName, avatarUrl }
          : null
      }
    />
  );
}
```

### 11.9 Auth e chrome (`components/`)

#### `components/auth/GoogleSignInButton.tsx`

```tsx
"use client";

import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Variant = "light" | "dark";

type Props = {
  redirectTo?: string;
  label?: string;
  variant?: Variant;
};

const VARIANT_CLASSES: Record<Variant, string> = {
  light:
    "bg-neutral-900 text-white hover:bg-neutral-700 shadow-sm",
  dark:
    "bg-white text-zinc-900 hover:bg-zinc-100 shadow-[0_10px_40px_-12px_rgba(168,85,247,0.5)] ring-1 ring-white/10",
};

export function GoogleSignInButton({
  redirectTo,
  label,
  variant = "light",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const callbackTarget = redirectTo
      ? `${origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`
      : `${origin}/auth/callback`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackTarget },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={[
          "inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-medium transition disabled:opacity-60",
          VARIANT_CLASSES[variant],
        ].join(" ")}
      >
        <GoogleGlyph />
        {loading
          ? variant === "dark"
            ? "Redirecionando..."
            : "Redirecting..."
          : (label ?? "Continue with Google")}
      </button>
      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
```

#### `components/app/AppBackground.tsx`

```tsx
export function AppBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-[40vh] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(168,85,247,0.18),transparent_70%)]" />
      <div className="absolute -top-32 right-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.12),transparent_70%)] blur-3xl" />
    </div>
  );
}
```

#### `components/app/AppHeader.tsx`

```tsx
import Link from "next/link";
import { LogOut } from "lucide-react";

import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import type { Dictionary, Lang } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary;
  lang: Lang;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
};

function initialOf(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

export function AppHeader({ t, lang, email, fullName, avatarUrl }: Props) {
  const displayName = fullName?.trim() || email;
  const initial = initialOf(displayName);

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/dashboard"
          className="group inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-brand-gradient shadow-[0_0_12px_rgba(168,85,247,0.8)] transition group-hover:scale-125"
          />
          <span className="text-zinc-100">Almanac</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageToggle lang={lang} />

          <div className="hidden items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 py-1 pl-1 pr-3 text-xs text-zinc-300 backdrop-blur sm:inline-flex">
            <UserAvatar avatarUrl={avatarUrl} initial={initial} />
            <span className="truncate max-w-[12rem]">{displayName}</span>
          </div>
          {/* Avatar-only badge for narrow screens */}
          <div className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/60 p-1 sm:hidden">
            <UserAvatar avatarUrl={avatarUrl} initial={initial} />
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.nav.signOut}</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function UserAvatar({
  avatarUrl,
  initial,
}: {
  avatarUrl?: string | null;
  initial: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="h-6 w-6 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-semibold text-zinc-950">
      {initial}
    </span>
  );
}
```

#### `components/i18n/LanguageToggle.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { LANG_COOKIE, LANG_COOKIE_MAX_AGE } from "@/lib/i18n/cookie";
import { LANG_META, SUPPORTED_LANGS, type Lang } from "@/lib/i18n/dictionary";

type Props = {
  lang: Lang;
  compact?: boolean;
};

export function LanguageToggle({ lang, compact = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(next: Lang) {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label="Language"
      data-pending={pending ? "" : undefined}
      className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/60 p-1 text-xs backdrop-blur"
    >
      {SUPPORTED_LANGS.map((value) => {
        const active = value === lang;
        const meta = LANG_META[value];
        return (
          <button
            key={value}
            type="button"
            onClick={() => handleChange(value)}
            disabled={pending}
            aria-pressed={active}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition disabled:opacity-60",
              active
                ? "bg-zinc-100 text-zinc-900 shadow-sm"
                : "text-zinc-400 hover:text-zinc-100",
            ].join(" ")}
          >
            <span aria-hidden className="text-sm leading-none">
              {meta.flag}
            </span>
            {!compact ? (
              <span className="font-medium tracking-wide">{meta.label}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
```

### 11.10 Landing (`components/landing/`)

#### `components/landing/Landing.tsx`

```tsx
import { dictionary, type Lang } from "@/lib/i18n/dictionary";

import { BackgroundFX } from "./BackgroundFX";
import { Features } from "./Features";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { TopBar } from "./TopBar";

type Props = {
  lang: Lang;
};

export function Landing({ lang }: Props) {
  const t = dictionary[lang];

  return (
    <>
      <BackgroundFX />
      <div className="flex min-h-screen flex-col">
        <TopBar t={t} lang={lang} />
        <main className="flex-1">
          <Hero t={t.hero} />
          <Features t={t.features} />
        </main>
        <Footer t={t} />
      </div>
    </>
  );
}
```

#### `components/landing/BackgroundFX.tsx`

```tsx
export function BackgroundFX() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-grid opacity-60" />
      <div className="absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(168,85,247,0.25),transparent_70%)]" />
      <div className="absolute -top-40 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-3xl" />
      <div className="absolute bottom-[-10rem] right-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.18),transparent_70%)] blur-3xl" />
    </div>
  );
}
```

#### `components/landing/TopBar.tsx`

```tsx
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import type { Dictionary, Lang } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary;
  lang: Lang;
};

export function TopBar({ t, lang }: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/60 bg-zinc-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-brand-gradient shadow-[0_0_12px_rgba(168,85,247,0.8)] transition group-hover:scale-125"
          />
          <span className="text-zinc-100">Almanac</span>
        </Link>

        <div className="flex items-center gap-3">
          <LanguageToggle lang={lang} />
          <Link
            href="/login"
            className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:text-white"
          >
            {t.nav.signIn}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
```

#### `components/landing/Hero.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import { ArrowDown, Sparkles } from "lucide-react";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

import type { Dictionary } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary["hero"];
};

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export function Hero({ t }: Props) {
  return (
    <section className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pb-24 pt-24 text-center sm:pt-32">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center gap-8"
      >
        <motion.div
          variants={item}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-300 backdrop-blur"
        >
          <Sparkles className="h-3.5 w-3.5 text-brand-via" />
          {t.kicker}
        </motion.div>

        <motion.h1
          variants={item}
          className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl md:text-7xl"
        >
          <span className="block text-zinc-50">{t.titleLine1}</span>
          <span className="block text-gradient-brand animate-gradient-pan">
            {t.titleLine2}
          </span>
        </motion.h1>

        <motion.p
          variants={item}
          className="max-w-2xl text-pretty text-base text-zinc-400 sm:text-lg"
        >
          {t.subtitle}
        </motion.p>

        <motion.div
          variants={item}
          className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4"
        >
          <GoogleSignInButton variant="dark" label={t.ctaPrimary} />
          <a
            href="#features"
            className="group inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/40 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-brand-via/60 hover:bg-zinc-900/80 hover:text-white"
          >
            {t.ctaSecondary}
            <ArrowDown className="h-4 w-4 transition group-hover:translate-y-0.5" />
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
```

#### `components/landing/Features.tsx`

```tsx
"use client";

import { motion } from "framer-motion";
import {
  MessageSquarePlus,
  Share2,
  Upload,
  type LucideIcon,
} from "lucide-react";

import type { Dictionary, FeatureIcon } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary["features"];
};

const ICONS: Record<FeatureIcon, LucideIcon> = {
  Upload,
  Share2,
  MessageSquarePlus,
};

export function Features({ t }: Props) {
  return (
    <section
      id="features"
      className="relative mx-auto max-w-6xl scroll-mt-20 px-6 pb-32"
    >
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          {t.title}
        </h2>
        <p className="mt-3 text-pretty text-base text-zinc-400">
          {t.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {t.items.map((feature, index) => {
          const Icon = ICONS[feature.icon];
          return (
            <motion.article
              key={feature.title}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + index * 0.1, ease: "easeOut" }}
              className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur transition hover:border-brand-via/50 hover:bg-zinc-900/70"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-via/60 to-transparent opacity-0 transition group-hover:opacity-100"
              />
              <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-via/20 bg-brand-via/10 text-brand-via">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-zinc-50">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {feature.body}
              </p>
              <span
                aria-hidden
                className="absolute right-4 top-4 text-[11px] font-mono tabular-nums text-zinc-700"
              >
                0{index + 1}
              </span>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
```

#### `components/landing/Footer.tsx`

```tsx
import type { Dictionary } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary;
};

const SOCIALS: Array<{ handle: string; href: string }> = [
  { handle: "@bigdev.z", href: "https://www.instagram.com/bigdev.z/" },
  { handle: "@jeannlucasdev", href: "https://www.instagram.com/jeannlucasdev/" },
];

function InstagramGlyph() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Footer({ t }: Props) {
  return (
    <footer className="border-t border-zinc-900/80 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-center sm:flex-row sm:justify-center sm:gap-3">
        <p className="text-xs text-zinc-400">{t.footer.credit}</p>
        <span aria-hidden className="hidden text-zinc-700 sm:inline">
          ·
        </span>
        <div className="flex items-center gap-2">
          {SOCIALS.map((social) => (
            <a
              key={social.href}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-brand-via/40 hover:text-brand-via"
            >
              <InstagramGlyph />
              {social.handle}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
```

### 11.11 Dashboard (`components/dashboard/`)

#### `components/dashboard/NewProjectForm.tsx`

```tsx
"use client";

import { useActionState, useRef, useState } from "react";
import { AlertCircle, FileUp, Loader2, Plus } from "lucide-react";

import { createProject, type CreateProjectState } from "@/app/dashboard/actions";
import type { Dictionary } from "@/lib/i18n/dictionary";

type Props = {
  t: Dictionary["dashboard"]["form"];
};

const FIELD_CLASS =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 shadow-inner shadow-black/20 transition focus:border-brand-via/60 focus:outline-none focus:ring-2 focus:ring-brand-via/20";

export function NewProjectForm({ t }: Props) {
  const [state, action, pending] = useActionState<CreateProjectState, FormData>(
    createProject,
    undefined,
  );
  const [htmlValue, setHtmlValue] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setHtmlValue(text);
    setFileName(file.name);
  }

  return (
    <form
      action={action}
      className="space-y-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 backdrop-blur"
    >
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium text-zinc-200">
          {t.nameLabel}
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={120}
          placeholder={t.namePlaceholder}
          className={FIELD_CLASS}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="html" className="text-sm font-medium text-zinc-200">
            {t.htmlLabel}
          </label>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:border-brand-via/40 hover:text-brand-via"
          >
            <FileUp className="h-3 w-3" />
            {fileName ? fileName : t.uploadIdle}
          </button>
        </div>
        <p className="text-xs text-zinc-500">{t.htmlHelper}</p>
        <textarea
          id="html"
          name="html"
          required
          rows={10}
          value={htmlValue}
          onChange={(event) => setHtmlValue(event.target.value)}
          placeholder="<!DOCTYPE html>..."
          className={`${FIELD_CLASS} font-mono text-xs leading-relaxed`}
        />
        <input
          ref={fileInput}
          type="file"
          accept=".html,text/html"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {state?.error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_10px_40px_-12px_rgba(168,85,247,0.5)] ring-1 ring-white/10 transition hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.submitPending}
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" />
            {t.submitIdle}
          </>
        )}
      </button>
    </form>
  );
}
```

#### `components/dashboard/ProjectList.tsx`

```tsx
import Link from "next/link";
import { ArrowUpRight, FileCode2, Sparkles } from "lucide-react";

import type { Dictionary, Lang } from "@/lib/i18n/dictionary";
import type { Project, ProjectStatus } from "@/lib/types/db";

type Props = {
  projects: Pick<Project, "id" | "name" | "status" | "created_at">[];
  t: Dictionary;
  lang: Lang;
};

const STATUS_STYLES: Record<ProjectStatus, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  published: "border-brand-via/40 bg-brand-via/10 text-brand-via",
  archived: "border-zinc-700/60 bg-zinc-800/60 text-zinc-400",
};

const LOCALE_MAP: Record<Lang, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

function formatDate(iso: string, lang: Lang) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(LOCALE_MAP[lang], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function ProjectList({ projects, t, lang }: Props) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-10 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-via/20 bg-brand-via/10 text-brand-via">
          <Sparkles className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-zinc-200">
          {t.dashboard.emptyTitle}
        </p>
        <p className="max-w-xs text-xs text-zinc-500">
          {t.dashboard.emptyBody}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/projects/${project.id}`}
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 px-4 py-4 backdrop-blur transition hover:border-brand-via/40 hover:bg-zinc-900/70"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-via/60 to-transparent opacity-0 transition group-hover:opacity-100"
            />
            <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 transition group-hover:border-brand-via/40 group-hover:text-brand-via">
              <FileCode2 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-100">
                {project.name}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {formatDate(project.created_at, lang)}
              </p>
            </div>
            <span
              className={[
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide",
                STATUS_STYLES[project.status],
              ].join(" ")}
            >
              {t.dashboard.statusLabels[project.status]}
            </span>
            <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-zinc-200" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

### 11.12 Editor (`components/editor/`)

#### `components/editor/PageFrame.tsx`

```tsx
"use client";

import { forwardRef, useMemo } from "react";

import { CAPTURE_SCRIPT } from "@/components/editor/injected/capture-script";

type Props = {
  html: string;
};

function composeSrcDoc(userHtml: string) {
  const script = `<script>${CAPTURE_SCRIPT}</script>`;
  const lower = userHtml.toLowerCase();
  const closingBody = lower.lastIndexOf("</body>");
  if (closingBody !== -1) {
    return userHtml.slice(0, closingBody) + script + userHtml.slice(closingBody);
  }
  return userHtml + script;
}

export const PageFrame = forwardRef<HTMLIFrameElement, Props>(
  function PageFrame({ html }, ref) {
    const srcDoc = useMemo(() => composeSrcDoc(html), [html]);

    return (
      <iframe
        ref={ref}
        title="page"
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        className="h-full w-full border-0 bg-white"
      />
    );
  },
);
```

#### `components/editor/PinsOverlay.tsx`

```tsx
"use client";

import type { Anchor } from "@/lib/pins/anchor";
import type { Viewport } from "@/lib/pins/messages";

export type OverlayPin = {
  id: string;
  index: number;
  anchor: Anchor;
  resolved: boolean;
  selected: boolean;
};

type Props = {
  pins: OverlayPin[];
  viewport: Viewport | null;
  placing: boolean;
  draftPosition: { xPct: number; yPct: number } | null;
  onSelectPin: (id: string) => void;
};

export function PinsOverlay({
  pins,
  viewport,
  placing,
  draftPosition,
  onSelectPin,
}: Props) {
  if (!viewport) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden={placing}
    >
      {pins.map((pin) => {
        const left = pin.anchor.xPct * viewport.scrollWidth - viewport.scrollLeft;
        const top = pin.anchor.yPct * viewport.scrollHeight - viewport.scrollTop;
        const baseClass =
          "pointer-events-auto absolute -translate-x-1/2 -translate-y-full inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ring-2 ring-white/70 transition";
        const stateClass = pin.resolved
          ? "bg-emerald-500 text-white shadow-[0_4px_14px_-2px_rgba(16,185,129,0.6)]"
          : pin.selected
            ? "bg-brand-gradient text-zinc-950 shadow-[0_6px_20px_-2px_rgba(168,85,247,0.7)] scale-110"
            : "bg-zinc-950 text-zinc-50 shadow-[0_4px_14px_-2px_rgba(0,0,0,0.6)] hover:bg-brand-via hover:text-zinc-950";
        return (
          <button
            key={pin.id}
            type="button"
            onClick={() => onSelectPin(pin.id)}
            className={`${baseClass} ${stateClass}`}
            style={{ left, top }}
            aria-label={`Pin ${pin.index}`}
          >
            {pin.index}
          </button>
        );
      })}

      {draftPosition ? (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: draftPosition.xPct * viewport.scrollWidth - viewport.scrollLeft,
            top: draftPosition.yPct * viewport.scrollHeight - viewport.scrollTop,
          }}
        >
          <span className="relative inline-flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-via opacity-60" />
            <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-brand-via shadow-[0_0_18px_rgba(168,85,247,0.8)]" />
          </span>
        </div>
      ) : null}
    </div>
  );
}
```

#### `components/editor/PinPopover.tsx`

```tsx
"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/dictionary";

type Props = {
  position: { left: number; top: number };
  submitting: boolean;
  onSubmit: (body: string) => Promise<void> | void;
  onCancel: () => void;
  t: Dictionary["editor"]["popover"];
};

export function PinPopover({
  position,
  submitting,
  onSubmit,
  onCancel,
  t,
}: Props) {
  const [body, setBody] = useState("");
  const disabled = submitting || body.trim().length === 0;

  return (
    <div
      className="absolute z-30 w-80 -translate-x-1/2 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl shadow-black/60 backdrop-blur"
      style={{ left: position.left, top: position.top + 16 }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-zinc-800 bg-zinc-950/95"
      />
      <textarea
        autoFocus
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={t.placeholder}
        className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-inner shadow-black/30 transition focus:border-brand-via/60 focus:outline-none focus:ring-2 focus:ring-brand-via/20"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-full px-3 py-1 text-xs text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-60"
        >
          {t.cancel}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSubmit(body.trim())}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-[0_8px_22px_-8px_rgba(168,85,247,0.6)] ring-1 ring-white/10 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {t.saving}
            </>
          ) : (
            <>
              <Send className="h-3 w-3" />
              {t.save}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
```

#### `components/editor/ShareButton.tsx`

```tsx
"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/dictionary";

type Props = {
  shareUrl: string;
  t: Dictionary["editor"]["share"];
};

export function ShareButton({ shareUrl, t }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t.copy, shareUrl);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        copied
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-brand-via/40 hover:text-brand-via",
      ].join(" ")}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          {t.copied}
        </>
      ) : (
        <>
          <Link2 className="h-3.5 w-3.5" />
          {t.copy}
        </>
      )}
    </button>
  );
}
```

#### `components/editor/Editor.tsx`

```tsx
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Lock,
  LogOut,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";

import { CommentSidebar } from "@/components/editor/CommentSidebar";
import { PageFrame } from "@/components/editor/PageFrame";
import { PinPopover } from "@/components/editor/PinPopover";
import { PinsOverlay, type OverlayPin } from "@/components/editor/PinsOverlay";
import { ShareButton } from "@/components/editor/ShareButton";
import { LanguageToggle } from "@/components/i18n/LanguageToggle";
import type { Dictionary, Lang } from "@/lib/i18n/dictionary";
import type { Anchor } from "@/lib/pins/anchor";
import type { IframeToParentMessage, Viewport } from "@/lib/pins/messages";
import type { Comment, Page, Pin, ProfileLite, Project } from "@/lib/types/db";

type EditorMode =
  | { kind: "owner"; project: Project }
  | { kind: "public"; project: Project; shareToken: string };

type EditorUser = {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

type Props = {
  mode: EditorMode;
  page: Page;
  pins: Pin[];
  comments: Comment[];
  profiles: ProfileLite[];
  shareUrl: string;
  isAuthenticated: boolean;
  createPin: (input: {
    pageId: string;
    anchor: Anchor;
    body: string;
  }) => Promise<void>;
  createComment: (input: { pinId: string; body: string }) => Promise<void>;
  resolvePin:
    | ((input: { pinId: string; resolved: boolean }) => Promise<void>)
    | null;
  lang: Lang;
  t: Dictionary["editor"];
  navT: Dictionary["nav"];
  user: EditorUser | null;
};

type DraftPin = {
  anchor: Anchor;
  position: { left: number; top: number };
  viewportSnapshot: Viewport;
};

function initialOf(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}

export function Editor({
  mode,
  page,
  pins,
  comments,
  profiles,
  shareUrl,
  isAuthenticated,
  createPin,
  createComment,
  resolvePin,
  lang,
  t,
  navT,
  user,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<DraftPin | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postToFrame = useCallback(
    (msg: { type: "parent:setMode"; mode: "idle" | "placing" } | { type: "parent:requestViewport" }) => {
      frameRef.current?.contentWindow?.postMessage(msg, "*");
    },
    [],
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent<IframeToParentMessage>) {
      if (!frameRef.current) return;
      if (event.source !== frameRef.current.contentWindow) return;

      const data = event.data;
      if (!data || typeof data !== "object") return;

      switch (data.type) {
        case "iframe:ready":
        case "iframe:viewport":
          setViewport(data.viewport);
          break;
        case "iframe:pinPlaced": {
          setViewport(data.viewport);
          setPlacing(false);
          const left =
            data.anchor.xPct * data.viewport.scrollWidth - data.viewport.scrollLeft;
          const top =
            data.anchor.yPct * data.viewport.scrollHeight - data.viewport.scrollTop;
          setDraft({
            anchor: data.anchor,
            position: { left, top },
            viewportSnapshot: data.viewport,
          });
          break;
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    function onResize() {
      postToFrame({ type: "parent:requestViewport" });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [postToFrame]);

  const overlayPins = useMemo<OverlayPin[]>(
    () =>
      pins.map((pin, idx) => ({
        id: pin.id,
        index: idx + 1,
        anchor: pin.anchor,
        resolved: pin.resolved,
        selected: pin.id === selectedPinId,
      })),
    [pins, selectedPinId],
  );

  const draftPosition = draft
    ? { xPct: draft.anchor.xPct, yPct: draft.anchor.yPct }
    : null;

  function toggleMode() {
    if (mode.kind === "public" && !isAuthenticated) {
      window.location.href = `/login?next=${encodeURIComponent(
        `/share/${mode.shareToken}`,
      )}`;
      return;
    }
    setError(null);
    setDraft(null);
    const next = !placing;
    setPlacing(next);
    postToFrame({ type: "parent:setMode", mode: next ? "placing" : "idle" });
  }

  async function handleSavePin(body: string) {
    if (!draft) return;
    setSubmitting(true);
    setError(null);
    try {
      await createPin({ pageId: page.id, anchor: draft.anchor, body });
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errorSavePin);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancelDraft() {
    setDraft(null);
  }

  async function handleAddComment(pinId: string, body: string) {
    await createComment({ pinId, body });
  }

  async function handleResolvePin(pinId: string, resolved: boolean) {
    if (!resolvePin) return;
    await resolvePin({ pinId, resolved });
  }

  const userDisplay = user?.fullName?.trim() || user?.email || "";
  const userInitial = user ? initialOf(userDisplay) : "?";
  const isOwner = mode.kind === "owner";
  const canComment = isAuthenticated || isOwner;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="z-40 flex items-center justify-between border-b border-zinc-800/70 bg-zinc-950/80 px-4 py-2.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          {isOwner ? (
            <Link
              href="/dashboard"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/60 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
              aria-label={t.backToDashboard}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href="/"
              className="group inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-brand-gradient shadow-[0_0_12px_rgba(168,85,247,0.8)] transition group-hover:scale-125"
              />
              <span className="text-zinc-100">Almanac</span>
            </Link>
          )}

          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-zinc-100">
              {mode.project.name}
            </h1>
          </div>

          <span
            className={[
              "hidden items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide sm:inline-flex",
              isOwner
                ? "border-brand-via/40 bg-brand-via/10 text-brand-via"
                : "border-zinc-700/70 bg-zinc-800/60 text-zinc-300",
            ].join(" ")}
          >
            <Sparkles className="h-3 w-3" />
            {isOwner ? t.ownerBadge : t.sharedBadge}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <LanguageToggle lang={lang} compact />

          <button
            type="button"
            onClick={toggleMode}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              placing
                ? "bg-brand-gradient text-zinc-950 shadow-[0_8px_30px_-8px_rgba(168,85,247,0.7)]"
                : canComment
                  ? "bg-white text-zinc-950 hover:bg-zinc-100 ring-1 ring-white/10"
                  : "border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700",
            ].join(" ")}
          >
            {placing ? (
              <>
                <span aria-hidden className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                {t.placingHint}
              </>
            ) : (
              <>
                {canComment ? (
                  <MapPin className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
                {canComment ? t.addPin : t.unauthHint}
              </>
            )}
          </button>

          {isOwner ? <ShareButton shareUrl={shareUrl} t={t.share} /> : null}

          {user ? (
            <div className="hidden items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 py-1 pl-1 pr-3 text-xs text-zinc-300 sm:inline-flex">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-gradient text-[11px] font-semibold text-zinc-950">
                  {userInitial}
                </span>
              )}
              <span className="truncate max-w-[10rem]">{userDisplay}</span>
            </div>
          ) : null}

          {isOwner ? (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{navT.signOut}</span>
              </button>
            </form>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-200 transition hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-hidden bg-zinc-950 p-3">
          <div className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800/80 bg-white shadow-2xl shadow-black/40">
            <PageFrame ref={frameRef} html={page.html} />
            <PinsOverlay
              pins={overlayPins}
              viewport={viewport}
              placing={placing}
              draftPosition={draftPosition}
              onSelectPin={(id) => setSelectedPinId(id)}
            />
            {draft ? (
              <PinPopover
                position={draft.position}
                submitting={submitting}
                onSubmit={handleSavePin}
                onCancel={handleCancelDraft}
                t={t.popover}
              />
            ) : null}
          </div>
        </div>
        <CommentSidebar
          pins={pins}
          comments={comments}
          profiles={profiles}
          selectedPinId={selectedPinId}
          canResolve={isOwner}
          canComment={canComment}
          onSelectPin={setSelectedPinId}
          onAddComment={handleAddComment}
          onResolvePin={isOwner && resolvePin ? handleResolvePin : null}
          lang={lang}
          t={t.sidebar}
        />
      </div>
    </div>
  );
}
```

#### `components/editor/CommentSidebar.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  Loader2,
  MessageSquareOff,
  RotateCcw,
  Send,
} from "lucide-react";

import type { Dictionary, Lang } from "@/lib/i18n/dictionary";
import type { Comment, Pin, ProfileLite } from "@/lib/types/db";

type Props = {
  pins: Pin[];
  comments: Comment[];
  profiles: ProfileLite[];
  selectedPinId: string | null;
  canResolve: boolean;
  canComment: boolean;
  onSelectPin: (id: string | null) => void;
  onAddComment: (pinId: string, body: string) => Promise<void>;
  onResolvePin: ((pinId: string, resolved: boolean) => Promise<void>) | null;
  lang: Lang;
  t: Dictionary["editor"]["sidebar"];
};

const LOCALE_MAP: Record<Lang, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

function formatDateTime(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(LOCALE_MAP[lang], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function pinInitial(profile: ProfileLite | undefined, fallback: string) {
  const name = profile?.full_name?.trim() ?? "";
  if (name.length > 0) return name.charAt(0).toUpperCase();
  return fallback.charAt(0).toUpperCase() || "?";
}

export function CommentSidebar({
  pins,
  comments,
  profiles,
  selectedPinId,
  canResolve,
  canComment,
  onSelectPin,
  onAddComment,
  onResolvePin,
  lang,
  t,
}: Props) {
  const profilesById = useMemo(() => {
    const map = new Map<string, ProfileLite>();
    for (const profile of profiles) map.set(profile.id, profile);
    return map;
  }, [profiles]);

  const commentsByPin = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const comment of comments) {
      const arr = map.get(comment.pin_id) ?? [];
      arr.push(comment);
      map.set(comment.pin_id, arr);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [comments]);

  const title = t.titleTemplate.replace("{n}", String(pins.length));

  return (
    <aside className="flex h-full w-80 flex-col border-l border-zinc-800/70 bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800/70 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
          {title}
        </h2>
      </header>
      <div className="flex-1 overflow-y-auto">
        {pins.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 text-zinc-500">
              <MessageSquareOff className="h-5 w-5" />
            </span>
            <p className="text-xs text-zinc-500">{t.empty}</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/70">
            {pins.map((pin, index) => {
              const pinComments = commentsByPin.get(pin.id) ?? [];
              return (
                <PinSection
                  key={pin.id}
                  pin={pin}
                  index={index + 1}
                  comments={pinComments}
                  profilesById={profilesById}
                  selected={pin.id === selectedPinId}
                  canResolve={canResolve}
                  canComment={canComment}
                  onSelect={() =>
                    onSelectPin(pin.id === selectedPinId ? null : pin.id)
                  }
                  onAddComment={(body) => onAddComment(pin.id, body)}
                  onResolvePin={onResolvePin}
                  lang={lang}
                  t={t}
                />
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

type PinSectionProps = {
  pin: Pin;
  index: number;
  comments: Comment[];
  profilesById: Map<string, ProfileLite>;
  selected: boolean;
  canResolve: boolean;
  canComment: boolean;
  onSelect: () => void;
  onAddComment: (body: string) => Promise<void>;
  onResolvePin: ((pinId: string, resolved: boolean) => Promise<void>) | null;
  lang: Lang;
  t: Dictionary["editor"]["sidebar"];
};

function PinSection({
  pin,
  index,
  comments,
  profilesById,
  selected,
  canResolve,
  canComment,
  onSelect,
  onAddComment,
  onResolvePin,
  lang,
  t,
}: PinSectionProps) {
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReply() {
    if (reply.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAddComment(reply.trim());
      setReply("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to comment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve() {
    if (!onResolvePin) return;
    setSubmitting(true);
    setError(null);
    try {
      await onResolvePin(pin.id, !pin.resolved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update pin");
    } finally {
      setSubmitting(false);
    }
  }

  const pinLabel = t.pinLabelTemplate.replace("{n}", String(index));

  return (
    <li
      className={[
        "px-4 py-4 transition",
        selected
          ? "bg-zinc-900/70"
          : "hover:bg-zinc-900/40",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100">
          <span
            className={[
              "inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ring-1",
              pin.resolved
                ? "bg-emerald-500 text-white ring-emerald-400/40"
                : selected
                  ? "bg-brand-gradient text-zinc-950 ring-brand-via/40"
                  : "bg-zinc-800 text-zinc-100 ring-zinc-700/60",
            ].join(" ")}
          >
            {index}
          </span>
          {pinLabel}
        </span>
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            pin.resolved
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-zinc-700/60 bg-zinc-800/60 text-zinc-300",
          ].join(" ")}
        >
          {pin.resolved ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <CircleDot className="h-3 w-3" />
          )}
          {pin.resolved ? t.statusResolved : t.statusOpen}
        </span>
      </button>

      <ul className="mt-3 space-y-2">
        {comments.map((comment) => {
          const profile = comment.author_id
            ? profilesById.get(comment.author_id)
            : undefined;
          const name =
            profile?.full_name ??
            (comment.author_id ? t.member : t.deletedUser);
          const avatar = profile?.avatar_url ?? null;
          const initial = pinInitial(profile, comment.author_id ?? "?");
          return (
            <li
              key={comment.id}
              className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3"
            >
              <div className="mb-1.5 flex items-center gap-2">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-gradient text-[9px] font-semibold text-zinc-950">
                    {initial}
                  </span>
                )}
                <p className="text-xs font-medium text-zinc-200">{name}</p>
                <span className="ml-auto text-[10px] tabular-nums text-zinc-500">
                  {formatDateTime(comment.created_at, lang)}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-100">
                {comment.body}
              </p>
            </li>
          );
        })}
      </ul>

      {canComment ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={2}
            maxLength={4000}
            placeholder={t.replyPlaceholder}
            className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 shadow-inner shadow-black/20 transition focus:border-brand-via/60 focus:outline-none focus:ring-2 focus:ring-brand-via/20"
          />
          <div className="flex items-center justify-between gap-2">
            {canResolve && onResolvePin ? (
              <button
                type="button"
                onClick={handleResolve}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-50"
              >
                {pin.resolved ? (
                  <>
                    <RotateCcw className="h-3 w-3" />
                    {t.reopen}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    {t.resolve}
                  </>
                )}
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleReply}
              disabled={submitting || reply.trim().length === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-zinc-950 shadow-[0_6px_18px_-6px_rgba(168,85,247,0.5)] ring-1 ring-white/10 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t.saving}
                </>
              ) : (
                <>
                  <Send className="h-3 w-3" />
                  {t.reply}
                </>
              )}
            </button>
          </div>
          {error ? (
            <p className="text-[11px] text-red-300">{error}</p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
```
