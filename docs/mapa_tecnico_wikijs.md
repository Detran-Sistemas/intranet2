# Mapa Técnico — Wiki.js 2.5.314 (Fork Detran-MG)
> Engenharia reversa do código-fonte. Produzido em 15/09/2026.  
> **Nenhuma modificação foi realizada.**

---

## 1. Árvore da Aplicação

```
intranet2/
├── client/                    ← Frontend (Vue 2 + Vuetify)
│   ├── client-app.js          ← Entry point da SPA principal
│   ├── client-setup.js        ← Entry point da tela de setup
│   ├── index-app.js           ← Bootstrap HTML da app
│   ├── index-setup.js         ← Bootstrap HTML do setup
│   ├── components/            ← Componentes de página (rotas SPA)
│   │   ├── admin.vue          ← Painel administrativo
│   │   ├── editor.vue         ← Shell principal do editor ⚠️
│   │   ├── editor/            ← Implementações de editor
│   │   │   ├── editor-markdown.vue
│   │   │   ├── editor-ckeditor.vue
│   │   │   ├── editor-code.vue
│   │   │   ├── editor-asciidoc.vue
│   │   │   ├── editor-api.vue
│   │   │   ├── editor-redirect.vue
│   │   │   └── editor-modal-*.vue   ← Modais (propriedades, mídia, conflito…)
│   │   ├── common/            ← Componentes globais compartilhados
│   │   │   ├── nav-header.vue ← Header global ⭐ customizável
│   │   │   ├── search-results.vue
│   │   │   ├── loader.vue
│   │   │   └── notify.vue
│   │   ├── login.vue
│   │   ├── history.vue
│   │   ├── tags.vue
│   │   └── profile/
│   ├── store/                 ← Vuex (state management)
│   │   ├── index.js           ← Store raiz
│   │   ├── editor.js          ← Estado do editor
│   │   ├── page.js            ← Estado da página
│   │   ├── site.js
│   │   └── user.js
│   ├── themes/
│   │   └── default/           ← Tema ativo ⭐ principal ponto de customização visual
│   │       ├── theme.yml      ← Metadados e props do tema
│   │       ├── components/    ← Componentes específicos do tema
│   │       │   ├── page.vue   ← Visualização da página ⭐
│   │       │   ├── nav-sidebar.vue ← Sidebar ⭐
│   │       │   ├── nav-footer.vue
│   │       │   └── tabset.vue
│   │       ├── scss/
│   │       │   └── app.scss   ← Estilos do tema ⭐
│   │       └── js/
│   │           └── app.js
│   ├── graph/                 ← Queries/mutations GraphQL do cliente
│   ├── helpers/               ← Utilitários JS do cliente
│   ├── libs/                  ← Bibliotecas internas
│   ├── modules/               ← Módulos client-side (boot, localization…)
│   ├── polyfills/
│   └── scss/                  ← SCSS global (não temático)
│
├── server/                    ← Backend (Node.js + Express)
│   ├── index.js               ← Entry point
│   ├── master.js              ← Bootstrap Express + middlewares
│   ├── setup.js               ← Wizard de configuração inicial
│   ├── core/                  ← Núcleo crítico 🔴
│   │   ├── auth.js            ← Passport + JWT + permissões 🔴
│   │   ├── db.js              ← Knex + Objection (ORM) 🔴
│   │   ├── servers.js         ← HTTP/HTTPS/GraphQL servers
│   │   ├── scheduler.js       ← Jobs agendados
│   │   ├── system.js          ← Configurações e sistema
│   │   └── …outros módulos de suporte
│   ├── controllers/           ← Rotas Express
│   │   ├── common.js          ← Rotas principais (páginas, editor, histórico…) 🟡
│   │   ├── auth.js            ← Rotas de autenticação 🔴
│   │   └── upload.js          ← Upload de assets
│   ├── graph/                 ← API GraphQL
│   │   ├── schemas/           ← Definições de tipos GraphQL (.graphql)
│   │   ├── resolvers/         ← Lógica dos resolvers
│   │   └── index.js
│   ├── models/                ← Modelos de banco (Objection.js) 🔴
│   │   ├── pages.js           ← Modelo principal de páginas 🔴
│   │   ├── users.js           ← Modelo de usuários 🔴
│   │   ├── authentication.js
│   │   ├── pageHistory.js
│   │   ├── assets.js
│   │   └── …outros
│   ├── modules/               ← Módulos plugáveis
│   │   ├── authentication/    ← Providers: azure, oidc, oauth2, microsoft… 🔴
│   │   ├── editor/            ← Definições server-side de editores
│   │   ├── rendering/         ← Pipeline de renderização (markdown, html…) 🟡
│   │   ├── storage/           ← Providers de storage
│   │   └── search/            ← Engines de busca
│   ├── db/
│   │   └── migrations/        ← Migrations Knex 🔴
│   ├── views/                 ← Templates Pug (server-side) 🟡
│   │   ├── page.pug           ← Shell da visualização de página
│   │   ├── editor.pug         ← Shell do editor
│   │   └── …outros
│   └── themes/
│       └── default/
│           └── theme.yml      ← Config server-side do tema
│
└── dev/                       ← Tooling de build (Webpack)
    └── webpack/
```

---

## 2. Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js ≥ 20 |
| Framework backend | Express 4.18 |
| ORM | Objection.js 2.2 (sobre Knex 0.21) |
| Banco | PostgreSQL 14 (via `pg`) |
| GraphQL servidor | apollo-server-express 2.25 |
| Autenticação | Passport.js + JWT (RS256) |
| Frontend framework | Vue 2.6 |
| UI framework | Vuetify 2.3 |
| State management | Vuex 3 + vuex-pathify |
| GraphQL cliente | Apollo Client 2.6 + vue-apollo 3 |
| Templates SSR | Pug |
| Build | Webpack 4 |
| CSS | SCSS |
| I18n | i18next |
| Editor rich-text | CKEditor 5 (fork customizado: `@requarks/ckeditor5`) |
| Editor markdown | CodeMirror 5 |

---

## 3. Arquitetura Frontend

### 3.1 Entradas (Entry Points)

| Arquivo | Propósito |
|---------|-----------|
| [`client-app.js`](file:///c:/Users/x137148/Documents/git/intranet2/client/client-app.js) | Bootstrap da SPA principal (Apollo, Vue Router, Vuetify, i18n) |
| [`client-setup.js`](file:///c:/Users/x137148/Documents/git/intranet2/client/client-setup.js) | Wizard de configuração inicial |

### 3.2 Roteamento

Não usa Vue Router de forma convencional. As "rotas" são:
- **Definidas no servidor** (`server/controllers/common.js`)
- Cada rota renderiza um template Pug (ex: `page.pug`, `editor.pug`)
- O Pug injeta o componente Vue raiz como Web Component (`<page>`, `<editor>`)
- Dados iniciais são passados como atributos base64 no HTML

> **Implicação crítica**: Não há SPA de página única gerida pelo Vue Router. Cada navegação entre views (page → editor → history) é uma requisição HTTP full.

### 3.3 Fluxo de Dados Frontend

```
Requisição HTTP
      ↓
Express (server/controllers/common.js)
      ↓
Template Pug (server/views/*.pug)
      ↓ injeta dados via atributos base64
Componente Vue raiz montado no #root
      ↓
Vuex Store (client/store/)
      ↓
Apollo Client → /graphql
```

### 3.4 Sistema de Temas

O tema é uma **pasta isolada** em `client/themes/{nome}/`:

- `theme.yml` → metadados e props configuráveis via Admin
- `components/page.vue` → componente de visualização de página
- `components/nav-sidebar.vue` → sidebar de navegação
- `scss/app.scss` → estilos do tema
- `js/app.js` → JS adicional do tema

**Só existe um tema atualmente:** `default`.

O servidor também tem `server/themes/default/theme.yml` com metadados mínimos.

---

## 4. Arquitetura Backend

### 4.1 Bootstrap (master.js)

```
server/master.js
  ├── WIKI.auth   = core/auth.js
  ├── WIKI.lang   = core/localization.js
  ├── WIKI.mail   = core/mail.js
  ├── WIKI.system = core/system.js
  ├── app.use(mw.security)
  ├── app.use(passport)
  ├── app.use(bodyParser)
  ├── WIKI.servers.startGraphQL()
  ├── app.use('/', ctrl.common)   ← rotas de páginas
  └── app.use('/auth', ctrl.auth) ← rotas de autenticação
```

### 4.2 Módulo Global WIKI

Existe um global `WIKI` acessível em todo o backend:
- `WIKI.config` → configuração carregada do DB
- `WIKI.auth` → módulo de autenticação/autorização
- `WIKI.models` → todos os modelos (pages, users, etc.)
- `WIKI.data` → dados de runtime (search engine, comment provider…)

### 4.3 Controllers (Rotas Express)

| Arquivo | Rotas | Risco |
|---------|-------|-------|
| [`common.js`](file:///c:/Users/x137148/Documents/git/intranet2/server/controllers/common.js) | `/`, `/e/*`, `/h/*`, `/s/*`, `/d/*`, `/a/*`, `/t/*`, `/p/*` | 🟡 |
| [`auth.js`](file:///c:/Users/x137148/Documents/git/intranet2/server/controllers/auth.js) | `/auth/*` (OAuth callbacks) | 🔴 |
| [`upload.js`](file:///c:/Users/x137148/Documents/git/intranet2/server/controllers/upload.js) | Upload de assets | 🟡 |

### 4.4 Verificação de Permissões

Todas as rotas verificam permissões via:
```javascript
WIKI.auth.checkAccess(req.user, ['read:pages'], pageArgs)
WIKI.auth.getEffectivePermissions(req, pageArgs)
```

Esse mecanismo é central e **não deve ser tocado**.

---

## 5. Arquitetura do Editor

### 5.1 Shell do Editor

[`client/components/editor.vue`](file:///c:/Users/x137148/Documents/git/intranet2/client/components/editor.vue) é o **contêiner** do editor. Ele:

1. Carrega o editor específico dinamicamente (`editorMarkdown`, `editorCkeditor`, etc.)
2. Exibe o `nav-header` com o título da página e botões Salvar/Propriedades/Fechar
3. Gerencia o estado via Vuex (store `editor` e `page`)
4. Dispara as mutations GraphQL de `create` ou `update`

### 5.2 Editores Disponíveis (carregamento lazy)

| Chave | Componente | Tecnologia |
|-------|-----------|-----------|
| `markdown` | [`editor-markdown.vue`](file:///c:/Users/x137148/Documents/git/intranet2/client/components/editor/editor-markdown.vue) | CodeMirror 5 |
| `ckeditor` | [`editor-ckeditor.vue`](file:///c:/Users/x137148/Documents/git/intranet2/client/components/editor/editor-ckeditor.vue) | @requarks/ckeditor5 |
| `code` | [`editor-code.vue`](file:///c:/Users/x137148/Documents/git/intranet2/client/components/editor/editor-code.vue) | CodeMirror 5 (raw HTML) |
| `asciidoc` | [`editor-asciidoc.vue`](file:///c:/Users/x137148/Documents/git/intranet2/client/components/editor/editor-asciidoc.vue) | CodeMirror 5 |
| `api` | [`editor-api.vue`](file:///c:/Users/x137148/Documents/git/intranet2/client/components/editor/editor-api.vue) | API externa |
| `redirect` | [`editor-redirect.vue`](file:///c:/Users/x137148/Documents/git/intranet2/client/components/editor/editor-redirect.vue) | Redirecionamento |

### 5.3 Seleção de Editor

1. Em modo **criação**: modal `editor-modal-editorselect.vue` é exibido
2. O usuário escolhe o editor
3. `currentEditor` (Vuex `editor/editor`) é atualizado
4. O componente dinâmico `<component :is='currentEditor'>` é montado

### 5.4 Fluxo de Salvamento

```
editor.vue → save()
  ├── SE mode === 'create':
  │     Apollo mutation pages.create(content, title, path, locale, editor, tags, …)
  │     → /graphql
  │     → server/graph/resolvers/page.js → PageMutation.create()
  │     → server/models/pages.js → createPage()
  │     → PostgreSQL (tabela pages)
  │     → Git storage sync
  │
  └── SE mode === 'update':
        Apollo mutation pages.update(id, content, title, …)
        → /graphql
        → server/graph/resolvers/page.js → PageMutation.update()
        → server/models/pages.js → updatePage()
        → PostgreSQL + Git
```

### 5.5 Estado do Editor (Vuex)

**store/editor.js:**
```
editor.editor         → componente ativo ('editorMarkdown', etc.)
editor.editorKey      → chave interna ('markdown', 'ckeditor', etc.)
editor.content        → conteúdo bruto em edição
editor.mode           → 'create' | 'update'
editor.activeModal    → modal ativo
editor.checkoutDateActive → controle de conflitos
```

**store/page.js:**
```
page.id, page.title, page.description, page.path, page.locale
page.tags, page.isPublished, page.publishStartDate, page.publishEndDate
page.scriptCss, page.scriptJs
page.effectivePermissions → { pages, history, source, comments, system }
```

---

## 6. Fluxo Completo: Criação/Edição/Salvamento de Página

### 6.1 Visualização (`GET /algum/caminho`)

```
1. Express router (controllers/common.js, rota '/*')
2. WIKI.models.pages.getPage({ path, locale, userId }) → cache Redis/memória ou DB
3. WIKI.auth.getEffectivePermissions(req, pageArgs) → calcula permissões
4. WIKI.models.navigation.getTree() → sidebar
5. res.render('page', { page, sidebar, effectivePermissions, injectCode })
6. server/views/page.pug renderiza o HTML com <page ...atributos base64...>
7. Browser carrega assets, monta Vue, o componente page.vue hidrata
8. page.vue renderiza page.render (HTML já processado pelo servidor) via slot
```

### 6.2 Edição (`GET /e/algum/caminho`)

```
1. Express router (controllers/common.js, rota '/e/*')
2. getPageFromDb() → dados raw da página
3. Verifica effectivePermissions.pages.write || manage
4. page.content = Base64(conteúdo)
5. res.render('editor', { page, effectivePermissions })
6. server/views/editor.pug renderiza <editor ...atributos...>
7. editor.vue hidrata, detecta mode='update', carrega editor correto
```

### 6.3 Salvamento

```
1. editor.vue → save()
2. Apollo mutation → POST /graphql
3. server/graph/resolvers/page.js → create() ou update()
4. server/models/pages.js → createPage() / updatePage()
   a. INSERT/UPDATE na tabela pages (PostgreSQL)
   b. Atualiza pageHistory
   c. Renderiza conteúdo (pipeline rendering)
   d. Sincroniza com Git storage
   e. Invalida cache
5. Retorna { responseResult, page: { id, updatedAt } }
6. editor.vue redireciona para visualização ou mantém editor
```

---

## 7. Persistência

### 7.1 Banco de Dados

Gerenciado pelo Knex (query builder) + Objection.js (ORM).

**Tabelas principais identificadas:**

| Tabela | Modelo | Função |
|--------|--------|--------|
| `pages` | `server/models/pages.js` | Conteúdo das páginas |
| `pageHistory` | `server/models/pageHistory.js` | Versionamento |
| `pageLinks` | `server/models/pageLinks.js` | Links entre páginas |
| `pageTree` | (query direta) | Árvore de navegação |
| `users` | `server/models/users.js` | Usuários |
| `groups` | `server/models/groups.js` | Grupos e permissões |
| `authentication` | `server/models/authentication.js` | Estratégias de auth |
| `assets` | `server/models/assets.js` | Arquivos/mídia |
| `assetFolders` | `server/models/assetFolders.js` | Pastas de assets |
| `navigation` | `server/models/navigation.js` | Navegação/sidebar |
| `tags` | `server/models/tags.js` | Tags |
| `settings` | `server/models/settings.js` | Configurações |

### 7.2 Migrations

Localizadas em `server/db/migrations/`. A última migration identificada é `2.5.128.js`.

> 🔴 **Crítico**: Migrations não devem ser modificadas. Se necessário criar novas, deve ser uma decisão arquitetural explícita.

### 7.3 Cache de Páginas

`server/models/pages.js` implementa `getPage()` (com cache) vs `getPageFromDb()` (sem cache). O cache é gerido pelo próprio Wiki.js.

---

## 8. API GraphQL

### 8.1 Endpoint

- Query/Mutation: `POST /graphql`
- Subscriptions: `wss://host/graphql-subscriptions`

### 8.2 Schemas Disponíveis

| Schema | Operações principais |
|--------|---------------------|
| `page.graphql` | create, update, delete, move, convert, list, search, history, restore |
| `authentication.graphql` | login, register, updateStrategies |
| `user.graphql` | create, update, delete, list |
| `group.graphql` | create, update, delete, list |
| `asset.graphql` | list, rename, delete |
| `navigation.graphql` | update, fetch |
| `theming.graphql` | update theme config |
| `storage.graphql` | syncAll |
| `site.graphql` | updateConfig |
| `system.graphql` | info, resetTelemetry |

### 8.3 Diretiva de Autorização

```graphql
@auth(requires: ["write:pages", "manage:system"])
```

Implementada em `server/graph/directives/` e verificada a cada resolver.

### 8.4 Rate Limiting

```graphql
@rateLimit(limit: 5, duration: 60)
```

Aplicada nas mutations de login e registro.

---

## 9. Autenticação

### 9.1 Mecanismo

- **Passport.js** como middleware de autenticação
- **JWT (RS256)** como token de sessão (cookie `jwt`)
- Sessão de servidor via `express-session` + `connect-session-knex`

### 9.2 Providers Disponíveis

`server/modules/authentication/`: azure, oidc, oauth2, microsoft, ldap, local, keycloak, saml, github, gitlab, google, discord, facebook, dropbox, cas, okta, rocket.chat, slack, twitch, firebase.

O provider **OIDC** (`/oidc`) e **Azure AD** (`/azure`) são os relevantes para o Detran (Microsoft Entra ID).

### 9.3 Fluxo OAuth2/OIDC

```
1. Usuário acessa /login
2. Clica em "Entrar com Microsoft"
3. GET /auth/oidc (ou /auth/azure)
4. Redirect → Microsoft Entra ID
5. Callback → /auth/oidc/callback
6. Passport processa token
7. Cria/atualiza usuário no DB
8. Define cookie jwt
9. Redireciona para loginRedirect ou /
```

### 9.4 Arquivos Críticos de Autenticação

- [`server/core/auth.js`](file:///c:/Users/x137148/Documents/git/intranet2/server/core/auth.js) — Motor principal 🔴
- [`server/controllers/auth.js`](file:///c:/Users/x137148/Documents/git/intranet2/server/controllers/auth.js) — Rotas de callback 🔴
- [`server/modules/authentication/oidc/`](file:///c:/Users/x137148/Documents/git/intranet2/server/modules/authentication/oidc) — Provider OIDC 🔴
- [`server/graph/resolvers/authentication.js`](file:///c:/Users/x137148/Documents/git/intranet2/server/graph/resolvers/authentication.js) — Resolvers 🔴

---

## 10. Autorização

### 10.1 Modelo de Permissões

Baseado em **grupos** com permissões granulares:

```
Permissões conhecidas:
  read:pages, write:pages, manage:pages, delete:pages
  read:history, read:source, read:assets, write:assets
  read:comments, write:comments, manage:comments
  manage:users, write:users
  manage:groups, write:groups
  manage:system, manage:theme, manage:navigation, manage:api
```

### 10.2 Verificação em Dois Níveis

1. **Middleware** Express: `WIKI.auth.authenticate` (toda requisição)
2. **Resolver** GraphQL: diretiva `@auth` + chamadas manuais a `WIKI.auth.checkAccess()`

### 10.3 Permissões Efetivas

`WIKI.auth.getEffectivePermissions(req, pageArgs)` retorna objeto de permissões calculadas para o contexto específico da página (locale, path, tags, etc.). Esse objeto é passado ao frontend e salvo no Vuex `page.effectivePermissions`.

---

## 11. Storage (Armazenamento)

### 11.1 Camadas

| Camada | Função |
|--------|--------|
| PostgreSQL | Conteúdo das páginas, metadados, usuários, configurações |
| Azure Files (`/wiki/data`) | Arquivos/assets, repo Git |
| Git (`/wiki/data/repo`) | Versionamento dos arquivos do wiki via `simple-git` |

### 11.2 Providers de Storage

`server/modules/storage/` contém providers plugáveis (Git, S3, Azure Blob, etc.). O Git é o provider padrão ativo.

### 11.3 Fluxo de Upload de Assets

```
POST /u (multipart via multer)
→ server/controllers/upload.js
→ WIKI.models.assets.upload()
→ salva no DB (tabela assets)
→ sincroniza via storage provider
```

---

## 12. Renderização

### 12.1 Pipeline de Renderização

O conteúdo é armazenado **bruto** (markdown, html, etc.) e renderizado para HTML no servidor:

```
page.content (raw)
→ server/modules/rendering/
   ├── markdown-core → markdown-it
   ├── markdown-abbr, emoji, katex, footnotes, tables…
   ├── html-core
   ├── html-codehighlighter
   ├── html-security (sanitização)
   ├── html-mermaid, html-diagram
   └── …27 módulos ao total
→ page.render (HTML sanitizado)
```

### 12.2 Injeção de Código

O administrador pode injetar CSS/JS/Head via `WIKI.config.theming.injectCSS/injectHead/injectBody`. Isso é passado ao template Pug como `injectCode`.

---

## 13. Rotas

| Rota | Função | Controller |
|------|--------|-----------|
| `GET /` | Homepage (page `home`) | common.js |
| `GET /e/*` | Criar/editar página | common.js |
| `GET /h/*` | Histórico de página | common.js |
| `GET /s/*` | Fonte da página | common.js |
| `GET /d/*` | Download da página | common.js |
| `GET /a/*` | Admin | common.js |
| `GET /t/*` | Tags | common.js |
| `GET /p/*` | Perfil de usuário | common.js |
| `GET /i/:id` | Redirect por ID | common.js |
| `POST /graphql` | API GraphQL | servers.js |
| `GET/POST /auth/*` | Autenticação | auth.js |
| `POST /u` | Upload de assets | upload.js |
| `GET /_assets/*` | Assets estáticos | Express static |
| `GET /_userav/:uid` | Avatar de usuário | common.js |
| `GET /healthz` | Health check | common.js |
| `GET /robots.txt` | SEO | common.js |
| `GET /*` (fallback) | Assets ou página | common.js |

---

## 14. Componentes Visuais

### 14.1 Componentes Globais (`client/components/common/`)

| Componente | Função |
|-----------|--------|
| `nav-header.vue` | Header global: logo, busca, menu usuário |
| `search-results.vue` | Dropdown de resultados de busca |
| `loader.vue` | Overlay de loading |
| `notify.vue` | Notificações (snackbar) |
| `page-delete.vue` | Dialog de exclusão |
| `page-selector.vue` | Seletor de páginas |
| `user-search.vue` | Busca de usuários |
| `social-sharing.vue` | Botões de compartilhamento |

### 14.2 Componentes do Tema Default (`client/themes/default/components/`)

| Componente | Função |
|-----------|--------|
| `page.vue` | Visualização completa da página (breadcrumb, TOC, conteúdo, tags, rating, FAB) |
| `nav-sidebar.vue` | Sidebar de navegação (custom nav ou browse por árvore) |
| `nav-footer.vue` | Rodapé |
| `tabset.vue` | Componente de abas para conteúdo |

---

## 15. Pontos de Extensão

### 15.1 Extensões Nativas do Wiki.js (sem código)

| Ponto | Como usar |
|-------|----------|
| `WIKI.config.theming.injectCSS` | CSS injetado em todas as páginas |
| `WIKI.config.theming.injectHead` | HTML no `<head>` |
| `WIKI.config.theming.injectBody` | HTML antes do `</body>` |
| `page.extra.css` | CSS por página |
| `page.extra.js` | JS por página |
| `theme.yml` props | Propriedades configuráveis do tema |

### 15.2 Extensões via Código (fork)

| Ponto | O que é possível |
|-------|-----------------|
| `client/themes/default/` | Substituir completamente o layout visual |
| `client/themes/default/scss/app.scss` | Alterar toda a aparência |
| `client/themes/default/components/*.vue` | Substituir page.vue, sidebar, footer |
| `client/components/common/nav-header.vue` | Alterar o header global |
| `client/components/editor/` | Criar novo editor ou estender existente |
| `server/views/*.pug` | Alterar templates SSR |
| Novo tema em `client/themes/detran/` | Tema paralelo sem tocar no default |

---

## 16. Arquivos Críticos

> 🔴 **NÃO ALTERAR** sem análise profunda e decisão explícita.

| Arquivo | Motivo |
|---------|--------|
| `server/core/auth.js` | Motor de autenticação + JWT + permissões |
| `server/core/db.js` | Conexão e migrations do banco |
| `server/controllers/auth.js` | Callbacks OAuth/OIDC |
| `server/modules/authentication/oidc/` | Provider OIDC (Entra ID) |
| `server/models/pages.js` | Modelo central de páginas |
| `server/models/users.js` | Modelo de usuários |
| `server/models/groups.js` | Modelo de grupos/permissões |
| `server/db/migrations/` | Migrations do banco |
| `server/graph/directives/` | Diretivas `@auth`, `@rateLimit` |
| `client/store/page.js` | Estrutura das permissões efetivas |

---

## 17. Arquivos Candidatos à Customização

### 🟢 BAIXO RISCO — Customizar com tranquilidade

| Arquivo | O que customizar |
|---------|-----------------|
| `client/themes/default/scss/app.scss` | Cores, tipografia, espaçamento, layout |
| `client/themes/default/theme.yml` | Props do tema |
| `client/themes/default/js/app.js` | JS adicional (vazio atualmente) |
| `server/themes/default/theme.yml` | Metadados do tema server-side |

### 🟢 BAIXO-MÉDIO RISCO — Substituição isolada

| Arquivo | O que customizar |
|---------|-----------------|
| `client/themes/default/components/page.vue` | Layout de visualização da página |
| `client/themes/default/components/nav-sidebar.vue` | Sidebar |
| `client/themes/default/components/nav-footer.vue` | Rodapé |
| `client/themes/default/components/tabset.vue` | Componente de abas |

### 🟡 MÉDIO RISCO — Alterar com testes

| Arquivo | O que customizar | Cuidado |
|---------|-----------------|---------|
| `client/components/common/nav-header.vue` | Header global | Compartilhado entre editor e visualização |
| `server/views/page.pug` | Template SSR da página | Atributos base64 passados ao Vue |
| `server/views/editor.pug` | Template SSR do editor | Idem |
| `server/controllers/common.js` | Rotas (apenas adicionar) | Não remover lógica de permissões |
| `client/components/editor.vue` | Shell do editor | State management complexo |

### 🟠 ALTO RISCO — Evitar sem necessidade

| Arquivo | Motivo |
|---------|--------|
| `client/components/editor/editor-markdown.vue` | Editor principal (37KB) |
| `client/components/editor/editor-ckeditor.vue` | CKEditor customizado |
| `server/modules/rendering/` | Pipeline de renderização |
| `server/graph/resolvers/page.js` | Resolvers com lógica de negócio |

### 🔴 CRÍTICO — NÃO ALTERAR

| Arquivo | Motivo |
|---------|--------|
| `server/core/auth.js` | Autenticação/autorização |
| `server/core/db.js` | ORM e conexão com banco |
| `server/controllers/auth.js` | Callbacks OAuth |
| `server/models/pages.js` | Lógica de persistência de páginas |
| `server/models/users.js` | Lógica de usuários |
| `server/db/migrations/` | Schema do banco |
| `server/graph/directives/` | Segurança das APIs |

---

## 18. Dependências entre UI e Core

```
page.vue (tema)
  └── depende de: page.render (HTML pré-renderizado pelo servidor)
       └── depende de: server/modules/rendering/ (pipeline)
            └── depende de: page.content (banco)

editor.vue
  └── depende de: Apollo mutation → /graphql
       └── depende de: server/graph/resolvers/page.js
            └── depende de: server/models/pages.js
                 └── depende de: PostgreSQL

nav-header.vue
  └── depende de: Vuex store (user, page, site)
       └── depende de: siteConfig injetado pelo servidor no HTML

nav-sidebar.vue (tema)
  └── depende de: prop `items` (sidebar serializado em base64)
       └── depende de: WIKI.models.navigation.getTree() (servidor)

Permissões efetivas
  └── calculadas no servidor → passadas como base64 → hidratadas no Vuex
       └── lidas em: page.vue, editor.vue, nav-header.vue
```

**Regra de ouro:** A UI consome dados que o servidor já computou. A UI **não recalcula** permissões nem regras de negócio — ela apenas exibe ou oculta elementos com base no que o servidor informou.

---

## 19. Possibilidades para o Novo Editor

### 19.1 Opção A: Novo Editor como Componente Vue (Recomendado)

Criar `client/components/editor/editor-detran.vue` seguindo o mesmo padrão dos editores existentes.

**Como funciona:**
1. O editor registra sua chave no servidor (`server/modules/editor/detran/`)
2. `editor.vue` (shell) carrega o novo editor via `component(:is='currentEditor')`
3. O editor Detran manipula `this.$store.set('editor/content', ...)`
4. O salvamento usa as **mesmas mutations GraphQL** existentes (`pages.create`, `pages.update`)

**Vantagens:**
- Reutiliza 100% da lógica de salvamento, conflito, permissões e versionamento
- Reutiliza o shell `editor.vue` (header, modais, progress)
- Isolado do core
- Reversível

**Desvantagens:**
- Acoplado ao Vuex e ao sistema de stores atual
- Limitado ao que o schema GraphQL suporta

### 19.2 Opção B: Substituir o Shell editor.vue

Substituir `client/components/editor.vue` por uma versão customizada Detran.

**Vantagens:**
- Controle total da UX do editor
- Pode ter um header diferente

**Desvantagens:**
- Maior área de risco (shell atual tem lógica de conflito, dirty check, modais)
- Mais difícil de manter alinhado com upstream

### 19.3 Opção C: Editor em Modo API (editor-api.vue)

Existe `editor-api.vue` que permite um editor externo se comunicar com o Wiki.js. Pode ser explorado para um editor React/web-component externo.

### 19.4 Recomendação

**Opção A** (novo componente `editor-detran.vue`) para a FASE 5.

Isso permite:
- Criar a experiência visual desejada (block editor, WYSIWYG moderno, etc.)
- Reutilizar toda a lógica de persistência
- Isolamento claro
- Rollback simples (desabilitar o editor, retornar ao markdown)

---

## 20. Impacto sobre Upgrades Futuros

| Área de customização | Impacto no upgrade |
|---------------------|-------------------|
| `client/themes/detran/` (novo tema) | 🟢 Mínimo — pasta isolada |
| `client/themes/default/scss/app.scss` | 🟡 Médio — merge de conflito |
| `client/themes/default/components/page.vue` | 🟡 Médio — merge de conflito |
| `client/components/common/nav-header.vue` | 🟠 Alto — arquivo muito alterado |
| `client/components/editor/editor-detran.vue` (novo) | 🟢 Mínimo — arquivo novo |
| `server/modules/editor/detran/` (novo) | 🟢 Mínimo — pasta nova |
| `server/views/page.pug` | 🟡 Médio — mudanças pequenas |
| Qualquer arquivo do `server/core/` | 🔴 Crítico — não tocar |

**Estratégia de upgrade:** Manter um `git diff` documentado entre o upstream `requarks/wiki:2.5.314` e o fork. Antes de qualquer upgrade, aplicar esse diff sobre a nova versão e resolver conflitos.

---

## 21. Recomendação Arquitetural

### 21.1 Para o Layout/Interface

**Criar um novo tema Detran** em `client/themes/detran/` ao invés de modificar `client/themes/default/`.

```
client/themes/detran/
├── theme.yml
├── components/
│   ├── page.vue         ← Layout completamente novo
│   ├── nav-sidebar.vue  ← Sidebar Detran
│   └── nav-footer.vue   ← Rodapé Detran
└── scss/
    └── app.scss          ← Design System Detran
```

E ativar via painel admin. Isso:
- Mantém o tema original intacto
- Permite rollback instantâneo (mudar o tema no admin)
- Não gera conflito com o upstream

### 21.2 Para o Header Global

Modificar **minimamente** `client/components/common/nav-header.vue` — apenas trocar cores, logo e tipografia via SCSS. Evitar alterar lógica.

Alternativamente, o header pode ser customizado por tema se o tema tiver seu próprio header (requer pequena modificação no entry point).

### 21.3 Para o Editor

Seguir a **Opção A** descrita na seção 19: criar `editor-detran.vue` como componente isolado.

### 21.4 Para o Design System

Criar o Design System no SCSS do tema Detran (`client/themes/detran/scss/`):
- Variáveis de cores (paleta Detran-MG)
- Tipografia (Google Fonts)
- Tokens de espaçamento
- Componentes base (buttons, cards, badges)
- Override do Vuetify via `$vuetify.theme`

---

## 22. Matriz de Risco × Customização

| ARQUIVO/DIRETÓRIO | FUNÇÃO | RISCO | PODE CUSTOMIZAR? | MOTIVO |
|---|---|---|---|---|
| `client/themes/default/scss/app.scss` | Estilos do tema | 🟢 | ✅ Sim | CSS isolado no tema |
| `client/themes/default/components/page.vue` | Visualização de página | 🟢 | ✅ Sim | Componente de tema isolado |
| `client/themes/default/components/nav-sidebar.vue` | Sidebar | 🟢 | ✅ Sim | Componente de tema isolado |
| `client/themes/default/components/nav-footer.vue` | Rodapé | 🟢 | ✅ Sim | Componente de tema isolado |
| `client/themes/default/theme.yml` | Config do tema | 🟢 | ✅ Sim | Metadados apenas |
| `client/components/common/nav-header.vue` | Header global | 🟡 | ✅ Sim (com cuidado) | Compartilhado editor+visualização; não alterar lógica de busca/auth |
| `client/components/editor/editor-*.vue` | Editores individuais | 🟠 | ⚠️ Evitar | Lógica complexa; criar novo editor separado |
| `client/components/editor.vue` | Shell do editor | 🟡 | ⚠️ Com cautela | Lógica de conflito e dirty state embutida |
| `server/views/page.pug` | Template SSR da página | 🟡 | ✅ Sim (pequenas mudanças) | Não alterar atributos base64 passados ao Vue |
| `server/views/editor.pug` | Template SSR do editor | 🟡 | ✅ Sim (pequenas mudanças) | Idem |
| `server/controllers/common.js` | Rotas Express | 🟡 | ⚠️ Apenas adicionar | Não remover lógica de permissões existente |
| `server/graph/resolvers/page.js` | Resolvers de página | 🟠 | ⚠️ Apenas adicionar queries | Não modificar lógica de create/update |
| `server/graph/schemas/page.graphql` | Schema GraphQL | 🟠 | ⚠️ Apenas adicionar campos | Não alterar campos existentes |
| `server/modules/rendering/` | Pipeline de renderização | 🟠 | ⚠️ Apenas adicionar módulos | Não alterar módulos existentes |
| `server/modules/editor/` | Definições de editores | 🟢 | ✅ Adicionar novo | Criar `detran/` sem modificar existentes |
| `server/core/auth.js` | Autenticação | 🔴 | ❌ Não | Motor central de auth + JWT |
| `server/core/db.js` | Banco de dados | 🔴 | ❌ Não | ORM e migrations |
| `server/controllers/auth.js` | Rotas OAuth | 🔴 | ❌ Não | Callbacks OIDC/OAuth |
| `server/models/pages.js` | Modelo de páginas | 🔴 | ❌ Não | Persistência central |
| `server/models/users.js` | Modelo de usuários | 🔴 | ❌ Não | Gestão de usuários |
| `server/models/groups.js` | Modelo de grupos | 🔴 | ❌ Não | Permissões |
| `server/db/migrations/` | Migrations do banco | 🔴 | ❌ Não | Schema de produção |
| `server/graph/directives/` | Diretivas GraphQL | 🔴 | ❌ Não | Segurança da API |
| `server/modules/authentication/oidc/` | Provider OIDC | 🔴 | ❌ Não | Integração Entra ID |

---

## 23. Lacunas de Informação Identificadas

1. **Configuração atual do Entra ID**: Não foi possível confirmar se o OIDC está configurado via variável de ambiente ou via DB. Verificar `server/modules/authentication/oidc/definition.yml` e o painel admin.

2. **Versão exata do CKEditor customizado**: `@requarks/ckeditor5@19.0.1-wiki.2` é um fork. Importante entender as customizações antes de decidir substituir.

3. **Módulos de storage ativos**: Verificar qual storage provider está ativo em produção (Git? Azure Blob? Ambos?).

4. **Cache de páginas**: O mecanismo de cache (`getPage` vs `getPageFromDb`) precisa ser melhor documentado — pode ser memória ou Redis.

5. **Configuração de tema atual em produção**: Qual tema está ativo e quais props foram configuradas via admin.

---

*Relatório produzido após análise direta do código-fonte. Nenhuma modificação foi realizada.*
