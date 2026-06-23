# CLAUDE.md — ScratchJr Desktop

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

Port **desktop (Electron + Vite)** do ScratchJr — ambiente de programação visual por
blocos para crianças. A base de código foi originalmente escrita para iPad/WebKit
(iOS) e Android; este repositório a adapta para rodar em desktop.

- **Runtime:** Electron (processo principal + renderer)
- **Build:** Vite (entradas `*Entry-vite.js`, `*.html` em `src/app/`)
- **Linguagem:** JavaScript (ES modules, classes), SVG, Canvas 2D

## Onde está o código (importante)

| Caminho | Conteúdo |
|---|---|
| `src/app/src/` | **Código-fonte real** (68 arquivos `.js`). É aqui que se trabalha. |
| `src/app/assets`, `sounds`, `svglibrary`, `pnglibrary`, `samples` | Assets (sprites, sons) — **não são código**, não editar para lógica. |
| `src/app/*.html`, `*Entry-vite.js` | Entradas do Vite / Electron renderer. |
| `dist/`, `_legacy/dist/` | **Builds gerados** — nunca editar à mão; saem do build. |
| `backend/`, `api/` | Serviços auxiliares. |
| `graphify-out/` | Grafo de conhecimento do código (ver abaixo). |

> ⚠️ Ao buscar/editar lógica, restrinja a `src/app/src/`. `dist/` e `_legacy/dist/`
> contêm bundles minificados que aparecem em buscas mas **não devem ser alterados**.

## Estrutura de `src/app/src/`

- `editor/engine/` — motor do palco: `Stage.js`, `Sprite.js`, `Page.js`, `Runtime.js`, `Prims.js` (primitivas de blocos), `Thread.js`.
- `editor/ui/` — UI do editor: `UI.js`, `Palette.js`, `ScriptsPane.js`, `Thumbs.js`, `Project.js`, `Grid.js`, `Menu.js`, `Library.js`, `Undo.js`.
- `editor/blocks/` — modelo de blocos: `Block.js`, `BlockSpecs.js`, `BlockArg.js`, `Scripts.js`.
- `painteditor/` — editor de pintura (SVG): `Paint.js`, `PaintAction.js`, `Path.js`, `Ghost.js`, `Layer.js`, `SVG2Canvas.js`, `Camera.js`.
- `entry/` — telas de entrada: `index.js`, `home.js`, `gettingstarted.js`, `inapp.js`.
- `iPad/` — pontes nativas legadas (`iOS.js`, `IO.js`, `MediaLib.js`) e `WebInterface.js` (bridge desktop/web).
- `utils/` — utilitários: `lib.js` (DOM helpers — `gn()`, `globalx/globaly`, `newHTML()`), `Events.js`, `Transform.js`, `Localization.js`.
- `playediteor/player` — `ScratchJr_player.js` e patches do player.

## Mapa do conhecimento (graphify)

Grafo gerado por `/graphify` sobre `src/app/src/` (1766 nós, 4461 arestas, 81 comunidades).
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
