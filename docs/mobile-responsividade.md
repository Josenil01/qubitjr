# CSS mobile e navegação — estado atual e cuidados

> Documento gerado a partir de uma auditoria de CSS responsivo e navegação
> (2026-11-05). Cobre o que foi corrigido, o que foi deliberadamente **não**
> tocado, e por quê — para evitar que uma futura tentativa de "deixar
> responsivo" quebre o desktop/tablet (que é o alvo real do produto hoje).

## Como o CSS funciona aqui (importante antes de tocar em qualquer regra)

O CSS deste projeto **não é CSS estático**. Os arquivos em `src/app/css/*.css`
contêm template literals (`${css_vh(10.42)}`, `${css_vw(78.13)}`,
`${scaleMultiplier}`) avaliados via `eval()` dentro de `preprocess()` em
[src/app/src/utils/lib.js](../src/app/src/utils/lib.js) (linhas ~62-93),
carregados por [appEntry-vite.js](../src/app/appEntry-vite.js)
(`processAllCss()`), que faz `fetch()` do `.css`, processa e injeta via
`<style>` no `<head>`. `css_vh`/`css_vw` convertem porcentagem do viewport em
px usando `window.visualViewport`, recalculado em cada `resize`.

Ou seja: já existe um mecanismo de **escala proporcional contínua** — não é
layout fixo "burro". O problema não é falta de responsividade nenhuma, é que
esse mecanismo é **neutralizado por pisos fixos (`min-width`/`min-height`)**
colocados por cima dele, e **não existe nenhuma `@media query`** em todo o
projeto (confirmado por grep) para reorganizar a UI em telas pequenas.

## Por que isso é delicado (não é "só remover o min-width")

A escala `css_vh`/`css_vw` e a matemática de coordenadas do palco (`Stage.js`,
`getStagePt()`, hit-testing de sprites/blocos) assumem implicitamente as
proporções de um layout que nunca encolhe de verdade — só escala
proporcionalmente dentro de um range já testado. Ver também, em
[CLAUDE.md](../CLAUDE.md), a armadilha documentada sobre `globalx/globaly` vs
`getBoundingClientRect()` para coordenadas de mouse/toque: pequenos ajustes de
layout já causaram bugs de ~75px de erro de posicionamento no passado.

**Remover ou reduzir agressivamente os `min-width`/`min-height` de
`body`/`div.frame`/`#topbar` sem testar extensivamente o motor do palco e da
paleta de blocos é a forma mais provável de quebrar o produto em
desktop/tablet** (que é onde ScratchJr é efetivamente usado — é um app para
crianças, historicamente tablet-first). Por isso essa auditoria **não**
propõe nem aplica uma reestruturação de breakpoints para telas pequenas.

## O que foi corrigido nesta rodada (baixo risco, zero efeito em desktop/tablet)

1. **Rede de segurança de rolagem horizontal** —
   [src/app/css/base.css](../src/app/css/base.css): `body` mantém
   `min-width: 1020px` exatamente como antes (nenhuma mudança de layout em
   telas ≥1020px). Foi adicionada uma media query `@media (max-width: 1019px)`
   que troca `overflow-x: hidden` por `overflow-x: auto` **apenas** abaixo
   desse limiar. Antes, em uma tela de celular, ~645px de conteúdo ficavam
   cortados e **inalcançáveis** (sem scroll possível); agora dá para rolar até
   lá. Isso não resolve "ser responsivo", só resolve "não perder conteúdo
   trancado atrás de `overflow: hidden`".
2. **Alvo de toque mínimo** —
   [src/app/css/assignment.css](../src/app/css/assignment.css):
   `.assignmentHintReorderBtn` (setas de reordenar dicas, usadas em
   `AssignmentAuthorBar.js`) tinha 28×28px, abaixo do mínimo recomendado
   (~44px) e inconsistente com outros botões de toolbar do editor que já usam
   42px. Ajustado para 36×36px — mais tocável, sem risco de quebrar o layout
   (é uma coluna flex com `gap: 4px`, isolada, sem dependência de medidas
   fixas em outros componentes).

Nenhuma outra regra de CSS foi alterada. `min-width`/`min-height` de
`div.frame` (editor.css, lobby.css, start.css, librarymodal.css) e de
`#topbar` (`lobby.css`) **permanecem intactos** — qualquer mudança aí afeta
diretamente o layout que desktop/tablet usa hoje.

## O que foi identificado mas NÃO foi tocado (e por quê)

| Item | Onde | Por que não foi alterado agora |
|---|---|---|
| `div.frame { min-width: 766px; min-height: 745px }` | `editor.css`, `lobby.css`, `start.css`, `librarymodal.css` | Base da matemática de layout do palco/paleta; remover exige retestar hit-testing e `css_vh/css_vw` em todas as telas. |
| `#topbar { min-width: 800px }` | `lobby.css:37` | Mesma razão — nav bar do lobby assume essa largura mínima. |
| Larguras fixas em px (preview de página 480×360, canvas de pintura 432×384, modais 420×113) | `editorstage.css`, `paintlook.css`, `editormodal.css` | Specíficos de cada tela; mudar requer validar cada tela isoladamente. |
| `user-scalable=no` / `maximum-scale=1.0` nos `<meta viewport>` | `editor.html`, `gettingstarted.html`, `player.html`, `teacher.html`, `home.html`, `index.html` | Bloqueia pinch-zoom, mas é defensável no stage de edição/player (evita zoom acidental durante o uso de blocos/pintura); remover seletivamente nas telas de texto (home, gettingstarted, teacher) é uma mudança válida para uma próxima rodada, feita tela por tela. |
| Ausência de breakpoints estruturais (colapsar paleta/scripts pane em telas pequenas) | geral | Exigiria reflow real da UI do editor, não só escala — é trabalho de design + engenharia de UI, não um fix de CSS pontual. |

## Navegação entre telas

O app é **multi-página (MPA), não SPA**: cada tela é um HTML Vite separado
(`index.html`, `home.html`, `editor.html`, `gettingstarted.html`,
`player.html`, `teacher.html`), e a transição entre elas é feita por
`window.location.href` em vários pontos (`UI.js`, `ScratchJr.js`, `Home.js`,
`Lobby.js`, `AssignmentNotice.js`, `OfficialCatalog.js`, `MissionsMenu.js`,
`GenerateActivityModal.js`) — cada troca de tela é um reload completo de
página, reprocessando todo o CSS do zero.

O botão de "voltar ao lobby" (`UI.js`, método `flip`) usa apenas
`onmousedown`, não eventos touch nativos (`touchstart`/`pointerdown`).
Funciona em mobile por emulação de clique sintético do navegador, mas não é
o padrão usado no resto do motor — o motor de blocos/palco/paleta já trata
touch de forma nativa em ~18 arquivos (`Palette.js`, `Stage.js`,
`ScriptsPane.js`, `Events.js`, etc.). Alinhar esse botão ao padrão
(`pointerdown` ou `touchstart` explícito) é uma mudança isolada e de baixo
risco para uma próxima rodada.

## Recomendação para quem for atacar isso de verdade no futuro

1. Não alterar `min-width`/`min-height` de `div.frame`/`#topbar`/`body` sem
   antes isolar e testar manualmente (em viewport real de celular) o
   hit-testing de sprites e blocos no palco — ver pitfalls de coordenadas em
   [CLAUDE.md](../CLAUDE.md).
2. Se for perseguir suporte real a celular, tratar como projeto de UI
   separado (reflow com `@media`, não só mais escala), não como ajuste pontual
   de CSS.
3. Mudanças seguras e isoladas que podem ser feitas a qualquer momento sem
   esse risco: tamanho de alvos de toque, remoção seletiva de
   `user-scalable=no` em telas sem canvas (home/gettingstarted/teacher), e
   troca do listener do botão "voltar" para `pointerdown`.
