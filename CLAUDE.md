# CLAUDE.md — ScratchJr Web Edition

> Nota: a pasta do repositório se chama `ScratchJr-Desktop-master` por motivos históricos
> (era um port Electron). O projeto atual é uma **web app** — ver seção abaixo.

> **REGRA Nº 1 — LEIA ANTES DE QUALQUER RESPOSTA OU ALTERAÇÃO.**
> Antes de responder qualquer pergunta ou modificar qualquer arquivo, **consulte este
> arquivo primeiro** para entender o escopo do projeto, onde o código real vive e
> quais armadilhas existem. Em seguida, se a pergunta for sobre arquitetura, relações
> entre arquivos ou "onde está X", consulte o grafo de conhecimento em
> [graphify-out/](graphify-out/) (veja a seção **Mapa do conhecimento (graphify)**)
> **antes** de varrer o código manualmente. Só depois disso comece a trabalhar.

> **REGRA Nº 2 — APÓS CADA ATUALIZAÇÃO OU ALTERAÇÃO SIGNIFICATIVA, ATUALIZE O GRAPHIFY.**
> Sempre que concluir uma mudança relevante no código (nova função, refatoração,
> correção de bug que mexa na estrutura, novos arquivos), rode
> `/graphify src/app/src --update` para reconstruir o grafo de conhecimento em
> [graphify-out/](graphify-out/), mantendo `graph.json`, `GRAPH_REPORT.md` e
> `graph.html` em dia com o código. Faça isso antes de finalizar a tarefa.

---

## O que é este projeto

Port **web (Vite + Express + Supabase)** do ScratchJr — ambiente de programação visual
por blocos para crianças. A base de código foi originalmente escrita para iPad/WebKit
(iOS) e Android; este repositório a adapta para rodar no navegador, com backend próprio
e persistência em nuvem. Deploy em produção via **Vercel** (frontend estático + função
serverless em `api/`).

- **Runtime:** navegador (frontend) + Node.js/Express (backend) — **não há Electron ativo**;
  o antigo app Electron desktop foi arquivado em `_legacy/` (ver abaixo).
- **Build:** Vite (entrada única `src/app/appEntry-vite.js`; `player.html` usa
  `src/app/src/entry/player.js` como entrada separada, sem passar por `appEntry-vite.js`).
- **Backend:** Express (`backend/src/`) traduzindo chamadas legadas (SQL-like, iPad) para
  Supabase (PostgreSQL + Storage). Auth via JWT/tokens mock.
- **Linguagem:** JavaScript (ES modules, classes), SVG, Canvas 2D.
- Para a arquitetura completa (rotas, fluxo de dados, schema Supabase, convenções de
  código, variáveis de ambiente), ver **[agent.md](agent.md)** — é a referência mais
  detalhada e deve ser consultada junto com este arquivo.

## Onde está o código (importante)

| Caminho | Conteúdo |
|---|---|
| `src/app/src/` | **Código-fonte real do frontend** (68 arquivos `.js`). É aqui que se trabalha na maior parte do tempo. |
| `backend/src/` | Backend Express real (rotas `db.js`, `media.js`, `share.js`) — não é "auxiliar", é a API que fala com o Supabase. |
| `api/index.js` | Entry point serverless da Vercel (monta o app Express para produção). |
| `src/app/assets`, `sounds`, `svglibrary`, `pnglibrary`, `samples` | Assets (sprites, sons) — **não são código**, não editar para lógica. |
| `src/app/*.html`, `appEntry-vite.js` | Entradas do Vite (frontend). |
| `dist/`, `_legacy/dist/` | **Builds gerados** — nunca editar à mão; saem do build. |
| `_legacy/` | App Electron antigo (arquivado) — não importar nem referenciar. |
| `graphify-out/` | Grafo de conhecimento do código (ver abaixo). |

> ⚠️ Ao buscar/editar lógica, restrinja a `src/app/src/` (frontend) e `backend/src/`
> (backend). `dist/` e `_legacy/` contêm bundles minificados/código arquivado que
> aparecem em buscas mas **não devem ser alterados**.

## Estrutura de `src/app/src/`

- `editor/engine/` — motor do palco: `Stage.js`, `Sprite.js`, `Page.js`, `Runtime.js`, `Prims.js` (primitivas de blocos), `Thread.js`.
- `editor/ui/` — UI do editor: `UI.js`, `Palette.js`, `ScriptsPane.js`, `Scripts.js`, `Thumbs.js`, `Project.js`, `Grid.js`, `Library.js`, `Scroll.js`, `Undo.js`, `Alert.js`, `Record.js`.
- `editor/blocks/` — modelo de blocos: `Block.js`, `BlockSpecs.js`, `BlockArg.js`, `Menu.js`.
- `painteditor/` — editor de pintura (SVG): `Paint.js`, `PaintAction.js`, `PaintUndo.js`, `Path.js`, `Ghost.js`, `Layer.js`, `Camera.js`, `Transform.js`, `SVGImage.js`, `SVGTools.js`, `PNGCache.js`.
- `entry/` — telas de entrada: `index.js`, `home.js`, `editor.js`, `gettingstarted.js`, `inapp.js`, `index-mock.js`, `player.js`.
- `lobby/` — lobby/lista de projetos: `Home.js`, `Lobby.js`, `Samples.js`.
- `geom/` — geometria 2D: `Matrix.js`, `Rectangle.js`, `Vector.js`.
- `iPad/` — pontes nativas legadas: `iOS.js` (dispatcher de plataforma), `IO.js`, `MediaLib.js`.
- `services/` — `WebInterface.js`, cliente HTTP central que substitui as chamadas nativas iOS/Android por REST (fala com `backend/src/`).
- `utils/` — utilitários: `lib.js` (DOM helpers — `gn()`, `globalx/globaly`, `newHTML()`), `Events.js`, `Localization.js`, `SVG2Canvas.js`, `DrawPath.js`, `ScratchAudio.js`, `Sound.js`, `Cookie.js`, `AppUsage.js`.
- `shims/` — polyfills de dependências para o Vite: `jszip.js`, `snapsvg.js`, `stream.js`.
- `snap/` — biblioteca Snap.svg minificada (`snap.svg-min.js`) — **não editar, é third-party**.
- **Arquivos `*_player.js`** (`editor/ScratchJr_player.js`, `editor/engine/{Page,Sprite,Stage}_player.js`) — patches de protótipo aplicados só em `player.js` (viewer público de projetos compartilhados). Nunca importar `*_player.js` de páginas do editor. Ver `agent.md` para a arquitetura completa do player e do sistema de compartilhamento (`backend/src/routes/share.js`).

## Mapa do conhecimento (graphify)

Grafo gerado por `/graphify` sobre `src/app/src/` (1766 nós, 4459 arestas, 84 comunidades).
**Consulte-o antes de buscar manualmente** quando a pergunta for sobre arquitetura ou relações:

- `graphify-out/graph.html` — visualização interativa (abrir no navegador).
- `graphify-out/GRAPH_REPORT.md` — relatório: god nodes, comunidades, ciclos de import, conexões surpreendentes.
- `graphify-out/graph.json` — dados crus para consultas programáticas.
- Para perguntas em linguagem natural: `/graphify query "..."` (usa o grafo já construído).
- Após mudanças relevantes no código: `/graphify src/app/src --update`.

**God nodes (abstrações centrais):** `gn()` (helper `getElementById`, 320 arestas),
`Paint`, `ScratchJr`, `newHTML()`, `SVG2Canvas`, `PaintAction`, `UI`, `iOS`, `Sprite`.

## Armadilhas conhecidas (legado iOS → desktop)

- **Coordenadas de mouse/toque:** `Events.getTargetPoint()` em [src/app/src/utils/Events.js](src/app/src/utils/Events.js)
  retorna `pageX/pageY` em tablet e `clientX/clientY` no desktop. Para converter para
  coordenadas do palco use **`getBoundingClientRect()`** do `div` do palco — **não** use
  `globalx()/globaly()` de [lib.js](src/app/src/utils/lib.js) para isso: elas caminham por
  `parentNode` somando `offsetTop`, o que conta em dobro a toolbar acima do palco
  (~75px de erro vertical). Ver `Stage.getStagePt()` em
  [src/app/src/editor/engine/Stage.js](src/app/src/editor/engine/Stage.js).
- **`globalx/globaly` só são confiáveis em diferenças relativas** entre dois elementos
  (o erro se cancela), como no cálculo de "deletar sprite" em Stage.js.
- **Ciclos de import** existem entre `ScratchJr.js`, `ScriptsPane.js`, `Thumbs.js`,
  `Palette.js` e no `painteditor/` — ver seção "Import Cycles" do GRAPH_REPORT.md antes
  de mover símbolos entre esses arquivos.

## Convenções de trabalho

- Escreva código no mesmo estilo do entorno (classes ES, `var` local como no legado, mesma densidade de comentários).
- Não toque em `dist/` nem `_legacy/` — são saídas de build.
- Remova `console.log` de debug antes de finalizar uma correção.
- Commits/PRs só quando o usuário pedir.
