/**
 * src/app/src/editor/ui/GalleryRestriction.js
 *
 * Canal de estado mínimo entre AssignmentBadge.js (quem PROVÊ o valor, ao
 * vivo, conforme a missão progride - ver AssignmentBadge.galleryRestriction)
 * e Library.js (quem LÊ, toda vez que abre a galeria de personagens/fundos,
 * pra restringi-la ao que o projeto de referência do professor usa - "siga
 * o exemplo do professor primeiro, libere tudo depois de concluir").
 *
 * Existe como arquivo À PARTE, sem importar nada além de si mesmo, só pra
 * EVITAR que Library.js precise importar AssignmentBadge.js diretamente.
 * Library.js é importado por UI.js, que por sua vez é importado por
 * entry/player.js - o viewer PÚBLICO e read-only de projetos compartilhados
 * (ver CLAUDE.md: "Nunca importar *_player.js de páginas do editor" - a
 * mesma fronteira, na direção oposta, também importa aqui). Se Library.js
 * importasse AssignmentBadge.js direto, todo o grafo de dependências dele
 * (Project.js, assignmentScoring.js, detailedManifest.js - nada disso
 * relevante pro viewer público) entraria também no bundle do player.js -
 * achado em teste real de build (o bundle do player cresceu ~18kB só de
 * código morto na primeira tentativa dessa feature).
 *
 * Este arquivo continua {provider: null} pra sempre em qualquer contexto
 * que nunca registre um provider (como entry/player.js, que nunca importa
 * AssignmentBadge.js) - getGalleryRestriction() simplesmente devolve null
 * (sem restrição) nesse caso, o mesmo "sem missão ativa" de sempre.
 */

let provider = null;

/**
 * Chamado por AssignmentBadge.js (uma única vez, ao carregar o módulo) pra
 * se registrar como a fonte de verdade da restrição atual. `fn` é chamada
 * DE NOVO a cada getGalleryRestriction() - nunca cacheado aqui - pra sempre
 * refletir o estado mais recente (missão trocou, progrediu, concluiu).
 */
export function registerGalleryRestrictionProvider (fn) {
    provider = fn;
}

export function getGalleryRestriction () {
    return provider ? provider() : null;
}

/**
 * O personagem `md5` já atingiu o limite de quantidade da missão (ver
 * AssignmentBadge.galleryRestriction: characterMaxCounts/characterCounts,
 * escopados à cena atual quando o professor tem contagem por cena -
 * characterLimitScope === 'scene' - ou ao projeto todo, missões antigas).
 * No escopo de cena, um personagem que NÃO aparece naquela cena do exemplo
 * do professor tem limite 0. Sem limites (missão antiga/leitura falhou) = false.
 */
export function isCharacterAtLimit (restriction, md5) {
    if (!restriction || !restriction.characterMaxCounts) {
        return false;
    }
    let cap = restriction.characterMaxCounts[md5];
    if (cap === undefined) {
        cap = restriction.characterLimitScope === 'scene' ? 0 : Infinity;
    }
    return ((restriction.characterCounts || {})[md5] || 0) >= cap;
}

/**
 * Todos os personagens que a missão oferece (os do catálogo cujo md5 o
 * professor usou) já estão no limite - não sobra nenhum pra adicionar.
 * false se não há restrição/limite ou nenhum md5 da missão existe no
 * catálogo (mesmo fallback "nunca travar sem opção" de Library.js).
 */
export function allCharactersAtLimit (restriction, catalogMd5s) {
    if (!restriction || !restriction.characterMd5s || !restriction.characterMaxCounts) {
        return false;
    }
    const matched = catalogMd5s.filter(function (md5) {
        return restriction.characterMd5s.has(md5);
    });
    return matched.length > 0 && matched.every(function (md5) {
        return isCharacterAtLimit(restriction, md5);
    });
}

/**
 * Aviso curto na base da tela (some sozinho) - usado quando um botão
 * bloqueado pelo limite da missão (novo personagem/nova cena) é tocado.
 * Só DOM puro, sem dependências, pelo mesmo motivo do resto deste arquivo.
 */
export function showAssignmentToast (text) {
    const old = document.getElementById('assignmentToast');
    if (old && old.parentNode) {
        old.parentNode.removeChild(old);
    }
    const el = document.createElement('div');
    el.id = 'assignmentToast';
    el.className = 'assignmentToast';
    el.textContent = text;
    document.body.appendChild(el);
    window.setTimeout(function () {
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }, 4000);
}
