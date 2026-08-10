/**
 * src/app/src/editor/LiveMirror.js
 *
 * Núcleo de sincronização ao vivo, compartilhado pelos DOIS sentidos de
 * espelhamento da observação professor↔aluno:
 *   - professor → aluno (o motor do ALUNO é pilotado pelos dados do
 *     professor) — usado por LiveWatch.js, lado do aluno.
 *   - aluno → professor (o motor do PROFESSOR, montado em modo observação,
 *     é pilotado pelos dados do aluno) — usado por teacher.js.
 *
 * Extraído de LiveWatch.js (onde essa lógica nasceu e foi testada/corrigida
 * ao longo de várias rodadas em produção só pro sentido professor→aluno) pra
 * ser reaproveitado sem duplicar — as funções aqui não sabem (nem precisam
 * saber) se estão rodando dentro de editor.html ou teacher.html: só mexem em
 * ScratchJr.stage e nos módulos de UI (Thumbs/Palette/Library/Page/Project),
 * que existem igual nos dois contextos (teacher.html carrega o motor
 * completo pra dentro de #frame/#libframe/#paintframe, ocultos até serem
 * usados — ver comentário de montagem em teacher.js).
 *
 * Cada arquivo que usa este módulo continua dono do que É específico de
 * lado (protocolo de handoff, aviso na tela, vigia de inatividade,
 * heartbeat, presença) — aqui só fica o que é genuinamente o mesmo dos dois
 * lados: aplicar o estado recebido no motor já vivo, e montar o payload a
 * enviar a partir do motor local.
 */

import ScratchJr from './ScratchJr.js';
import Page from './engine/Page.js';
import Project from './ui/Project.js';
import Thumbs from './ui/Thumbs.js';
import Palette from './ui/Palette.js';
import Library from './ui/Library.js';
import IO from '../iPad/IO.js';
import { gn } from '../utils/lib.js';

// zIndex do vidro de bloqueio e de tudo que precisa ficar clicável por cima
// dele (avisos, botões de handoff) — exportados pra quem monta a própria UI
// por cima não ter que adivinhar/duplicar esses números.
export const LOCK_OVERLAY_Z_INDEX = 10500; // acima de .libframe (10000, librarymodal.css) — ver showLockOverlay
export const ABOVE_LOCK_OVERLAY_Z_INDEX = 11000; // banners/botões de handoff ficam acima do vidro

// Project.dataRecieved não expõe callback de conclusão utilizável daqui.
// Confirmado em produção: criar 2 sprites novos numa página nova levou ~4
// ciclos (12s) pra estabilizar com 3000ms — a recarga em si é bem mais
// rápida que isso na prática, 1200ms dá folga suficiente sem esticar tanto
// o "flash" visual.
export const RELOAD_SETTLE_MS = 1200;

let lockOverlayEl = null;
let _hoverEl = null; // elemento atualmente destacado por applyHoverTarget

// Estado de aplicação incremental (ver applyStageState mais abaixo) — quem
// está observando manda o estado do palco inteiro a cada tick, mas só vale
// a pena tocar no motor (principalmente Scripts.recreateStrip, que
// reconstrói DOM) no que realmente mudou desde a última aplicação.
let _reloadInFlight = false; // true enquanto uma recarga completa está em curso
let _reloadResetTimer = null; // timeout que rearma _reloadInFlight
let _lastAppliedStage = null; // último stageData já aplicado (pra comparar o que mudou)
let _lastSpriteIds = new Set(); // ids de sprite do broadcast anterior (detectar sumidos)

// Rastreamento de hover (ver _updateHoverTarget/getHoverTarget mais abaixo)
// — um único listener de 'mouseover' registrado uma vez, funciona igual em
// editor.html ou teacher.html (é só um listener de document, não depende de
// qual página carregou o módulo).
let _hoverTarget = null; // { kind: 'library'|'sprite'|'page', id } | null

/**
 * Reseta todo o estado incremental de diff (_lastAppliedStage/_lastSpriteIds
 * e o vigia de recarga completa) — chamar ao começar a espelhar uma sessão
 * nova (ex.: professor passa a observar OUTRO aluno), pra não comparar o
 * primeiro tick da sessão nova contra sobras da anterior. Na prática, como
 * cada troca de alvo em teacher.js já passa por um location.reload() (ver
 * comentário em _mountObservingEngine), isso já acontece de graça — esta
 * função existe como reforço explícito, não como a única linha de defesa.
 */
export function resetMirrorState() {
    if (_reloadResetTimer) clearTimeout(_reloadResetTimer);
    _reloadInFlight = false;
    _reloadResetTimer = null;
    _lastAppliedStage = null;
    _lastSpriteIds = new Set();
}

/**
 * "Vidro" transparente cobrindo a tela inteira enquanto o outro lado está no
 * controle — intercepta clique/toque antes de chegar no editor por baixo,
 * sem precisar instrumentar Stage/Sprite/ScriptsPane. Não é só UX: como
 * applyStageState pilota o motor de verdade, deixar alguém mexer ao mesmo
 * tempo puxaria os objetos Sprite/Page pra dois lados — risco real de
 * corromper o estado, não só uma sobreposição visual incômoda.
 *
 * zIndex ACIMA de .libframe (biblioteca de atores/cenários, z-index:10000
 * no CSS — librarymodal.css). Motivo: o espelhamento de UI (applyUiState,
 * mais abaixo) pode abrir a biblioteca de verdade — mas os cliques dentro
 * dela continuam com os handlers reais e vivos (Library.selectAsset → ...
 * → Page.addSprite de verdade). Sem o vidro por cima dela também, quem
 * está "bloqueado" ainda conseguiria clicar num personagem e alterar o
 * projeto de verdade — o mesmo risco que o vidro inteiro existe pra evitar.
 */
export function showLockOverlay() {
    if (lockOverlayEl) return;
    lockOverlayEl = document.createElement('div');
    lockOverlayEl.setAttribute('class', 'liveMirrorLockOverlay');
    document.body.appendChild(lockOverlayEl);
    Object.assign(lockOverlayEl.style, {
        position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
        zIndex: String(LOCK_OVERLAY_Z_INDEX), background: 'rgba(0, 0, 0, 0.02)', cursor: 'not-allowed',
    });
}

export function hideLockOverlay() {
    if (lockOverlayEl && lockOverlayEl.parentNode) lockOverlayEl.parentNode.removeChild(lockOverlayEl);
    lockOverlayEl = null;
    reserveFrameTopSpace(0); // desfaz qualquer espaço reservado pro aviso/barra — ver reserveFrameTopSpace
}

export function isLockOverlayShown() {
    return !!lockOverlayEl;
}

/**
 * Empurra #frame pra baixo (margin-top) pra abrir espaço pro aviso/barra
 * flutuante de cada lado (banner "Seu professor está..." do aluno,
 * "Assumir controle" do professor) — sem isso, esses elementos position:
 * fixed ficam por CIMA da própria barra de ferramentas do ScratchJr (logo,
 * tela cheia, grade, desfazer, bandeira — dentro de #frame, também começa
 * em top:0), cobrindo ela ao invés de empurrar (confirmado em produção nos
 * dois lados: professor via _showObserveBar, aluno via showBanner).
 *
 * ⚠️ SÓ é seguro chamar isso enquanto showLockOverlay() estiver ativo —
 * hideLockOverlay() já limpa automaticamente (reserveFrameTopSpace(0))
 * assim que destrava. O aluno mostra esse MESMO banner ("Seu professor
 * está vendo 👀") em estados onde ele AINDA tem controle interativo total
 * (não travado) — empurrar #frame nesses casos desalinharia
 * globalx()/globaly() (usados pra calcular onde um bloco foi solto,
 * Stage.js/ScriptsPane.js), o mesmo motivo de #teacher-topbar precisar
 * ficar oculto durante edição de verdade. Por isso quem chama isso
 * (showBanner em LiveWatch.js, _showObserveBar em teacher.js) precisa
 * checar isLockOverlayShown() antes.
 */
export function reserveFrameTopSpace(px) {
    const frame = document.getElementById('frame');
    if (frame) frame.style.marginTop = (px || 0) + 'px';
}

/**
 * Reload do projeto a partir do backend — chamado só nos instantes pontuais
 * de troca de controle (nunca em loop). Reaproveita o mesmo caminho que o
 * resto do app usa pra abrir/recarregar um projeto — funciona igual dos
 * dois lados porque só depende de IO.getObject já estar resolvendo pro
 * lugar certo (normal do lado do aluno; via bypass de sessão, já reescrito
 * em teacher.js antes de montar o motor, do lado do professor).
 *
 * Project.recreate() (por baixo de dataRecieved) só zera o array
 * ScratchJr.stage.pages em JS — não remove os elementos DOM dos sprites/
 * páginas antigas. Sem Stage.clear() antes, os sprites antigos ficam
 * duplicados na tela (órfãos antigos + os recriados). Ver Stage.js:685
 * (clear) vs Project.js:364 (recreate).
 */
export function reloadProjectFromBackend() {
    if (!ScratchJr.currentProject) return;
    if (ScratchJr.stage) ScratchJr.stage.clear();
    IO.getObject(ScratchJr.currentProject, Project.dataRecieved);
}

/**
 * Cópia rasa de um stageData (topo + cada sub-objeto de sprite) antes de
 * passar pra `new Page(id, data)` — Page.loadPageData chama
 * Project.recreateObject por baixo pra cada sprite, e recreateObject muta
 * `data.page = page` (Project.js:393). Sem copiar, isso poluiria o
 * stageData ORIGINAL — o mesmo objeto guardado em _lastAppliedStage pro
 * diff do próximo tick — com uma referência viva à Page (não serializável,
 * ciclo de DOM).
 */
function _shallowCopyStageData(stageData) {
    const copy = Object.assign({}, stageData);
    (stageData.sprites || []).forEach((id) => {
        if (copy[id]) copy[id] = Object.assign({}, copy[id]);
    });
    return copy;
}

/**
 * Aplica o estado de palco recebido (payload.stage de preview_frame)
 * diretamente nos objetos Sprite/Page JÁ VIVOS no motor local — sem
 * fotografar nada, sem recriar o motor. Só usa os caminhos confirmados
 * seguros (ver declarative-wobbling-penguin.md pra justificativa/linhas de
 * origem de cada um):
 *   - Sprite.setPos(x, y) — recebe posição ABSOLUTA apesar do nome dos
 *     parâmetros no código-fonte (dx, dy) sugerir delta.
 *   - sprite.scale/angle/flip setados direto + sprite.render().
 *   - sprite.shown + sprite.div.style.opacity — linha própria, render()
 *     não mexe em opacidade.
 *   - Page.setBackground(md5, fcn) com fcn vazio — NUNCA
 *     Page.prototype.updateBkg (grava undo/marca o projeto como alterado).
 *   - Stage.setPage(page, false) — NUNCA true (dispararia de verdade os
 *     scripts de bandeira verde/toque da página nova).
 *   - Limpar blocos + Scripts.recreateStrip, no mesmo padrão de
 *     Undo.redoScripts.
 *   - Thumbs.selectThisSprite(sprite) — NÃO Page.setCurrentSprite nem
 *     ScriptsPane.setActiveScript sozinhos: selectThisSprite percorre TODA
 *     a tira de miniaturas e, além de ativar a <div> de scripts do sprite
 *     novo (via ScriptsPane.setActiveScript por baixo), desativa a de TODOS
 *     os outros (Thumbs.unhighlighSprite → Scripts.prototype.deactivate).
 *   - new Page(id, data, fcn) — mesmo caminho que Project.recreatePage()
 *     já usa pra CADA página durante um load normal. O 3º argumento (fcn)
 *     só é chamado quando o cenário E todos os atores da página terminam de
 *     carregar de verdade — sem passar nada ali, a miniatura da página
 *     nunca é redesenhada depois que os assets carregam (confirmado em
 *     produção).
 *   - ScratchJr.stage.removeFromPage(spr) (Stage.js:622-645) — NÃO
 *     Stage.prototype.removeCharacter (grava Undo por baixo). Remove a
 *     <div> do sprite, a de scripts E a miniatura da tira, tudo de uma vez.
 *   - ScratchJr.stage.deletePage(id, true) — o segundo argumento pula
 *     Undo.record e o som de corte (Stage.js:229-248).
 * NUNCA Page.modifySprite (grava undo e rouba a seleção) — troca de
 * costume é feita chamando sprite.getAsset/setCostume direto.
 */
export function applyStageState(stageData) {
    if (!stageData || !ScratchJr.stage) return;
    if (_reloadInFlight) return; // recarga completa já em curso, ignora este tick

    // ⚠️ stageData.sprites é um array de STRINGS (ids), não de objetos —
    // exatamente como Page.encodePage() (Page.js:350-377) devolve: os dados
    // de cada sprite ficam em chaves separadas no próprio stageData
    // (stageData[spriteId]), não aninhados dentro de "sprites".
    const incomingSpriteIds = stageData.sprites || [];
    const createdThisTick = new Set();
    let page;
    // ⚠️ Capturar ANTES de new Page() — o construtor de Page seta
    // ScratchJr.stage.currentPage = this SEM PASSAR por Stage.setPage()
    // (Page.js:26), então depois de criar a página nova, comparar contra
    // ScratchJr.stage.currentPage já daria "sem mudança nenhuma" (o
    // construtor já trocou por baixo) — Stage.setPage nunca seria chamado.
    const pageWasCurrentBefore = ScratchJr.stage.currentPage;
    const pageKnown = ScratchJr.stage.pages.some((p) => p.id === stageData.id);
    const isNewPage = !pageKnown;
    if (!pageKnown) {
        try {
            page = new Page(stageData.id, _shallowCopyStageData(stageData), () => {
                Thumbs.updateSprites();
                Thumbs.updatePages();
                console.log('[LiveMirror] PÁGINA — cenário+atores carregados, miniaturas redesenhadas', stageData.id);
            });
            // Project.recreatePage() (Project.js:376-379) faz esse mesmo
            // passo manualmente logo após `new Page(...)` — o construtor
            // sozinho não esconde a própria <div> (nenhum `visibility` no
            // CSS .stagepage também).
            page.div.style.visibility = 'hidden';
            // Esconder a página ANTERIOR manualmente aqui: Stage.setPage
            // normalmente faz isso sozinho lendo `this.currentPage` — mas
            // como o construtor de Page já trocou esse ponteiro pra página
            // NOVA, Stage.setPage não tem mais como saber qual era a de
            // verdade e nunca a esconderia.
            if (pageWasCurrentBefore && pageWasCurrentBefore !== page) {
                pageWasCurrentBefore.div.style.visibility = 'hidden';
                pageWasCurrentBefore.setPageSprites('hidden');
            }
            incomingSpriteIds.forEach((id) => createdThisTick.add(id));
            console.log('[LiveMirror] PÁGINA CRIADA', stageData.id, 'sprites:', incomingSpriteIds);
        } catch (err) {
            console.error('[LiveMirror] falha ao criar página nova cirurgicamente, caindo pra recarga completa:', err);
            page = null;
        }
        if (!page) {
            console.log('[LiveMirror] RELOAD COMPLETO disparado (falha ao criar página cirurgicamente)', stageData.id);
            _reloadInFlight = true;
            if (_reloadResetTimer) clearTimeout(_reloadResetTimer);
            _reloadResetTimer = setTimeout(() => {
                _reloadInFlight = false;
                _reloadResetTimer = null;
            }, RELOAD_SETTLE_MS);
            _lastAppliedStage = null;
            _lastSpriteIds = new Set();
            reloadProjectFromBackend();
            return; // não aplicar updates parciais em cima de algo que ainda não existe
        }
    } else {
        page = ScratchJr.stage.getPage(stageData.id);
        if (!page) return; // defensivo
    }

    // --- 1. Página ativa (resolver ANTES de mexer em sprites) -------------
    const pageChanged = !pageWasCurrentBefore || pageWasCurrentBefore.id !== stageData.id;
    if (pageChanged) {
        ScratchJr.stage.setPage(page, false); // NUNCA true — dispararia de verdade os scripts de bandeira verde/toque
    }

    // --- 2. Cenário ---------------------------------------------------------
    // Page.encodePage() só grava stageData.md5 quando a página TEM cenário
    // (Page.js:356-358) — se o cenário for removido, stageData.md5
    // simplesmente não existe no payload (não vira null, some). Comparar
    // sempre, e mandar 'none' quando o cenário some — Page.setBackground já
    // trata 'none' como caso especial (Page.js:117-121).
    if (stageData.md5 !== page.md5) {
        page.setBackground(stageData.md5 || 'none', () => {}); // callback vazio de propósito — nunca updateBkg
    }

    // --- 3. Sprites novos: criar cirurgicamente, sem recarregar a página ---
    // Project.recreateObject() (Project.js:389-426) monta via `new
    // Sprite(data, fcn)` sem gravar Undo nem marcar ScratchJr.changed. Já
    // recria os scripts e aplica shown/opacidade sozinho — só falta a
    // visibilidade do <div> no palco, restaurada aqui no callback (só
    // quando a página é a atual, sempre verdade — já resolvida no passo 1).
    incomingSpriteIds.forEach((spriteId) => {
        if (createdThisTick.has(spriteId)) return; // já criado no passo 0 (página nova) ou nesta própria iteração
        if (gn(spriteId)) return; // já existe no DOM, passo 5 cuida de atualizar
        const sData = stageData[spriteId];
        if (!sData) return; // defensivo — sem dados, nada a criar (tenta de novo no próximo tick)
        createdThisTick.add(spriteId);
        console.log('[LiveMirror] ATOR CRIANDO (cirúrgico)', { spriteId, pagina: stageData.id, nome: sData.name, tipo: sData.type });
        Project.recreateObject(page, spriteId, Object.assign({}, sData), (spr) => {
            if (page.id === ScratchJr.stage.currentPage.id) {
                spr.div.style.visibility = 'visible'; // mesmo padrão de Undo.copySprite
            }
            Thumbs.updateSprites(); // sem isso o ícone do ator novo não aparece na tira de sprites
            // Page.prototype.drawSpriteImage usa spr.originalImg pra
            // desenhar o ator na miniatura da página, e pula silenciosamente
            // se essa imagem ainda não carregou (Page.js:306-308) — esse
            // callback só roda depois do asset carregar de verdade, então
            // chamar Thumbs.updatePages() de novo aqui garante que a
            // miniatura seja redesenhada COM o ator.
            Thumbs.updatePages();
            console.log('[LiveMirror] ATOR CRIADO (asset carregado)', spriteId);
        }, spriteId === stageData.lastSprite);
    });

    // --- 4. Sprites que existiam e sumiram desde a última aplicação --------
    // removeFromPage usa this.currentPage e retorna sem fazer nada se o id
    // não estiver na lista dela (Stage.js:627-630) — seguro mesmo se `id`
    // pertencer a outra página (ex.: troca de página no meio do caminho).
    const incomingIds = new Set(incomingSpriteIds);
    _lastSpriteIds.forEach((id) => {
        if (!incomingIds.has(id)) {
            const el = gn(id);
            if (el && el.owner) {
                console.log('[LiveMirror] ATOR REMOVENDO', { spriteId: id, pagina: stageData.id, nome: el.owner.name });
                ScratchJr.stage.removeFromPage(el.owner);
            }
        }
    });

    // --- 5. Sprites presentes: aplicar só o que mudou -----------------------
    incomingSpriteIds.forEach((spriteId) => {
        if (createdThisTick.has(spriteId)) return; // acabou de ser criado, já está em sincronia com sData
        const sData = stageData[spriteId]; // dados reais do sprite ficam aqui, não dentro de "sprites"
        if (!sData) return; // defensivo
        const el = gn(spriteId);
        if (!el || !el.owner) return; // defensivo; passo 3 acima já criou quem faltava
        const sprite = el.owner;

        const posChanged = sprite.xcoor !== sData.xcoor || sprite.ycoor !== sData.ycoor;
        const transformChanged = sprite.scale !== sData.scale
            || sprite.angle !== sData.angle || sprite.flip !== sData.flip;
        const shownChanged = sprite.shown !== sData.shown;
        const costumeChanged = !!sData.md5 && sprite.md5 !== sData.md5;
        const prevSData = _lastAppliedStage && _lastAppliedStage[spriteId];
        const scriptsChanged = !prevSData
            || JSON.stringify(prevSData.scripts) !== JSON.stringify(sData.scripts);

        if (posChanged) {
            sprite.setPos(sData.xcoor, sData.ycoor); // ABSOLUTO — nunca subtrair/calcular delta
        }

        if (transformChanged) {
            sprite.scale = sData.scale;
            sprite.angle = sData.angle;
            sprite.flip = sData.flip;
            sprite.render();
        }

        if (shownChanged) {
            sprite.shown = sData.shown;
            sprite.div.style.opacity = sprite.shown ? 1 : 0; // render() não mexe em opacidade
        }

        if (costumeChanged) {
            sprite.md5 = sData.md5;
            sprite.getAsset((dataurl) => {
                sprite.setCostume(dataurl, () => {}); // callback vazio — bypassa Page.modifySprite de propósito
            });
        }

        if (scriptsChanged) {
            const scriptsDiv = gn(spriteId + '_scripts');
            if (scriptsDiv) {
                const sc = scriptsDiv.owner;
                while (scriptsDiv.childElementCount > 0) scriptsDiv.removeChild(scriptsDiv.childNodes[0]);
                (sData.scripts || []).forEach((scr) => sc.recreateStrip(scr));
            }
        }
    });

    // --- 6. Sprite selecionado (mostrar os blocos certos na área de scripts)
    // Thumbs.selectThisSprite() (NÃO ScriptsPane.setActiveScript direto) —
    // setActiveScript só ATIVA a <div> de scripts do sprite novo, nunca
    // desativa a do sprite que estava ativo antes. isNewPage força a
    // chamada mesmo se page.currentSpriteName já bater com
    // stageData.lastSprite: pra página recém-criada, loadPageData já seta
    // currentSpriteName ANTES do Stage.setPage do passo 1 rodar, e
    // Stage.setPage desativa a <div> de scripts de currentSpriteName logo
    // no início dele (Stage.js:118-120) — sem forçar aqui, a checagem de
    // "mudou?" achava que não tinha nada a fazer e nunca reativava.
    if (stageData.lastSprite && (isNewPage || page.currentSpriteName !== stageData.lastSprite)) {
        const selEl = gn(stageData.lastSprite);
        if (selEl && selEl.owner) Thumbs.selectThisSprite(selEl.owner);
    }

    _lastAppliedStage = stageData;
    _lastSpriteIds = incomingIds;
}

/**
 * Remove páginas que o outro lado apagou mas que NÃO são a página atual —
 * applyStageState/encodePage só transmitem a página ATUAL a cada tick,
 * então uma página apagada fora dela nunca teria como o outro lado saber
 * sem essa lista separada (ver buildMirrorPayload, `pageIds` = todos os
 * ids do projeto, leve, só ids).
 */
export function applyPageList(pageIds) {
    if (!pageIds || !ScratchJr.stage) return;
    if (_reloadInFlight) return; // recarga completa já em curso, não mexer no meio dela
    const known = new Set(pageIds);
    // Cópia do array porque deletePage muta ScratchJr.stage.pages durante o loop.
    ScratchJr.stage.pages.slice().forEach((p) => {
        if (!known.has(p.id)) {
            console.log('[LiveMirror] PÁGINA REMOVENDO', p.id, 'pageIds recebidos:', pageIds);
            ScratchJr.stage.deletePage(p.id, true);
        }
    });
}

/**
 * Algumas funções do motor (ScratchJr.enterFullScreen/quitFullScreen,
 * Library.close) só chamam e.preventDefault()/e.stopPropagation() no evento
 * que as disparou (e, por baixo, ScratchJr.unfocus(e) só lê e.target, de
 * forma opcional) — como aqui não existe clique/toque real nenhum, um Event
 * genérico e cancelable cobre tudo isso.
 *
 * ⚠️ NÃO usar document.createEvent('TouchEvent') + e.initTouchEvent() (o
 * padrão legado usado pro botão físico "voltar" do Android) — essa API é
 * instável/ausente em navegador desktop moderno.
 */
function fakeTouchEvent() {
    return new Event('touchstart', { bubbles: true, cancelable: true });
}

/**
 * Aplica o "chrome" da UI do outro lado — biblioteca aberta, tela cheia,
 * categoria de bloco selecionada — no motor local, além do palco em si
 * (applyStageState). Não guarda snapshot: cada tick compara direto contra
 * o estado ATUAL do motor (Library.isOpen/currentType, ScratchJr.
 * inFullscreen, Palette.numcat) — autocorretivo por natureza.
 *
 * ⚠️ Biblioteca: abrir de verdade (Library.open) monta a MESMA UI clicável
 * — só é seguro espelhar isso porque showLockOverlay() tem zIndex ACIMA de
 * .libframe também, não só do palco.
 */
export function applyUiState(ui) {
    if (!ui || !ScratchJr.stage) return;

    if (!!ui.fullscreen !== ScratchJr.inFullscreen) {
        if (ui.fullscreen) {
            ScratchJr.enterFullScreen(fakeTouchEvent());
        } else {
            ScratchJr.quitFullScreen(fakeTouchEvent());
        }
    }

    if (typeof ui.category === 'number' && ui.category !== Palette.numcat) {
        Palette.selectCategory(ui.category);
    }

    const wantOpen = !!ui.library;
    if (wantOpen) {
        if (!Library.isOpen || Library.currentType !== ui.library) {
            if (Library.isOpen) Library.close(fakeTouchEvent()); // troca de tipo: fecha e reabre com o tipo certo
            Library.open(ui.library);
        }
        // Rolagem da biblioteca — fração (0..1), não pixel absoluto: telas
        // de tamanhos diferentes têm scrollHeight diferente pro mesmo
        // conteúdo. Reaplicado a cada tick — nos primeiros ticks depois de
        // abrir, os thumbnails ainda estão carregando (addThumbnails é
        // assíncrono) e scrollHeight ainda não é o final, mas os próximos
        // ticks se autocorrigem assim que o conteúdo estabiliza.
        if (typeof ui.libraryScroll === 'number') {
            const area = gn('scrollarea');
            if (area) {
                const max = area.scrollHeight - area.clientHeight;
                area.scrollTop = max > 0 ? ui.libraryScroll * max : 0;
            }
        }
    } else if (Library.isOpen) {
        Library.close(fakeTouchEvent());
    }

    applyHoverTarget(ui.hover);
}

/**
 * Acha a miniatura (DOM) correspondente a um {kind, id} de hover.
 * Biblioteca: id = md5, e o próprio DOM id do .assetbox já É o md5
 * (Library.addAssetThumbChoose/addLocalThumbChoose) — gn() direto serve.
 * Sprite/página: o DOM id da miniatura é gerado descartável
 * (getIdFor('spritethumb'/'pagethumb')) — o id de verdade fica na
 * propriedade JS `.owner` (Sprite.js:189-191/Page.js:228-229).
 */
function _findHoverElement(hover) {
    if (!hover) return null;
    if (hover.kind === 'library') {
        return gn(hover.id) || null;
    }
    const containerId = hover.kind === 'sprite' ? 'spritecc' : hover.kind === 'page' ? 'pagecc' : null;
    const container = containerId && gn(containerId);
    if (!container) return null;
    for (let i = 0; i < container.childElementCount; i++) {
        if (container.childNodes[i].owner === hover.id) return container.childNodes[i];
    }
    return null;
}

/**
 * Reflete onde o mouse do outro lado está passando (biblioteca, tira de
 * atores, tira de páginas) — NÃO como um cursor/ponteiro flutuante seguindo
 * pixel a pixel (reintroduziria o problema de coordenadas dependentes de
 * viewport), e sim reaproveitando as próprias miniaturas identificáveis que
 * já existem dos dois lados: destaca a correspondente com um box-shadow
 * simples e limpa a anterior. Autocorretivo — se o elemento de antes já não
 * existir mais, o pior caso é escrever num nó órfão, inofensivo.
 */
export function applyHoverTarget(hover) {
    if (_hoverEl) {
        _hoverEl.style.boxShadow = '';
        _hoverEl.style.borderRadius = '';
        _hoverEl = null;
    }
    const el = _findHoverElement(hover);
    if (el) {
        el.style.boxShadow = '0 0 0 4px #ffcc00, 0 0 12px 4px rgba(255, 204, 0, 0.85)';
        el.style.borderRadius = '8px';
        _hoverEl = el;
    }
}

/**
 * Rede de segurança: se a sessão terminar (ou o controle mudar de mãos)
 * enquanto a biblioteca espelhada ou a tela cheia do outro lado estavam
 * ativas localmente, elas ficariam presas assim pra sempre — nada mais
 * chama applyUiState depois disso pra fechar.
 */
export function resetMirroredUi() {
    if (Library.isOpen) Library.close(fakeTouchEvent());
    if (ScratchJr.inFullscreen) ScratchJr.quitFullScreen(fakeTouchEvent());
    applyHoverTarget(null); // limpa o destaque de hover, se algum ainda estiver aceso
}

// ── Rastreamento de hover (pra broadcast, ver buildMirrorPayload) ────────
// Delegação num único listener de 'mouseover' (dispara só ao ENTRAR num
// elemento novo, bem mais barato que 'mousemove') — registrado uma vez,
// no carregamento do módulo, funciona igual em qualquer página que o
// importe. Seguro chamar sempre, mesmo sem sessão nenhuma ativa: só
// escreve uma variável local, ninguém lê isso a não ser buildMirrorPayload.
function _updateHoverTarget(e) {
    const el = e.target;
    if (!el || !el.closest) return;
    const assetbox = el.closest('.assetbox');
    if (assetbox && assetbox.id) {
        _hoverTarget = { kind: 'library', id: assetbox.id };
        return;
    }
    const spriteThumb = el.closest('.spritethumb');
    if (spriteThumb && spriteThumb.owner) {
        _hoverTarget = { kind: 'sprite', id: spriteThumb.owner };
        return;
    }
    const pageThumb = el.closest('.pagethumb');
    if (pageThumb && pageThumb.owner) {
        _hoverTarget = { kind: 'page', id: pageThumb.owner };
        return;
    }
    _hoverTarget = null;
}
document.addEventListener('mouseover', _updateHoverTarget);

/**
 * Monta o payload de broadcast ({stage, ui, pageIds}) a partir do estado
 * ATUAL do motor local — usado pelos dois lados (professor no controle
 * manda pro aluno; aluno sempre manda pro professor observar). Sem isso
 * cada lado tinha sua própria cópia dessa lógica (era o caso antes desta
 * extração: teacher.js tinha _broadcastTeacherPreview, LiveWatch.js
 * mandava só uma imagem via Project.getThumbnailPNG).
 *
 * Retorna null se o motor ainda não carregou de verdade (evita quebrar
 * encodePage() antes da página existir).
 */
export function buildMirrorPayload() {
    if (!ScratchJr.stage || !ScratchJr.stage.currentPage) return null;
    const page = ScratchJr.stage.currentPage;
    const stage = page.encodePage();
    stage.id = page.id; // encodePage() não inclui isso — o outro lado precisa pra achar a página certa
    const pageIds = ScratchJr.stage.pages.map((p) => p.id);
    const libraryOpen = Library.isOpen;
    const ui = {
        library: libraryOpen ? Library.currentType : null,
        libraryScroll: libraryOpen ? _libraryScrollFraction() : null,
        fullscreen: ScratchJr.inFullscreen,
        category: Palette.numcat,
        hover: _hoverTarget,
    };
    return { stage, ui, pageIds };
}

function _libraryScrollFraction() {
    const area = gn('scrollarea');
    if (!area) return null;
    const max = area.scrollHeight - area.clientHeight;
    return max > 0 ? area.scrollTop / max : 0;
}
