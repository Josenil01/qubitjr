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
