# Capturas ao salvar dicas

Antes de publicar o frontend/backend, execute `20261103_project_captures.sql` no SQL Editor do Supabase do projeto. A migração cria `project_captures`, `project_capture_images`, seus índices e o bucket privado `project-captures`. Pode ser reaplicada sem apagar dados.

O botão Concluir da revisão de dicas salva as dicas e inicia uma captura no navegador. A página precisa ficar aberta até terminar. Falhas preservam as dicas e oferecem uma nova tentativa; o conjunto anterior completo continua disponível.

Cada conjunto guarda `project_id`, `assignment_id`, hash e snapshot do projeto e das dicas. Cada imagem guarda `scene_id`, `actor_id`, tipo, dimensões e caminho no Storage. Atores repetidos são identificados pela ocorrência na cena. Textos aparecem na captura da cena; atores ocultos também têm imagem individual e programação. Uma programação vazia gera uma imagem com “Sem programação”.

Rotas autenticadas (dono da missão ou admin):

- `POST /api/assignments/:id/captures`: inicia uma versão com `{projectId, snapshot, hints}`; rejeita divergências do projeto/dicas no banco.
- `PUT /api/assignments/:id/captures/:captureId/images/:key`: envia uma imagem `{data: "data:image/png;base64,..."}`.
- `POST /api/assignments/:id/captures/:captureId/complete`: conclui somente quando todas as imagens previstas estão registradas.
- `GET /api/assignments/:id/captures`: histórico do projeto, mais recentes primeiro. Para exibir uma versão pronta, use a primeira com `status: completed`.
- `GET /api/assignments/:id/captures/:captureId`: snapshot e imagens com URLs privadas assinadas, válidas por dez minutos.

O Storage usa `projetos/{projectId}/capturas/{captureId}/cenas/{numero}/`, com `cena.png` e `atores/{numero}/personagem.png` e `programacao.png`. Os números de pasta vêm do servidor; os IDs originais permanecem nas colunas do banco.

As imagens são enviadas individualmente e limitadas a 3 MB. Cenas: 960 × 720. Programações extensas são reduzidas proporcionalmente, incluindo todos os blocos. Não executar animações durante a captura: o fluxo interrompe a execução antes de salvar, sem resetar as posições.

Verificação: executar os testes `projectCaptures.test.js` do backend e `CaptureRenderer.test.js` / `AssignmentCapture.test.js` do frontend. Validar no navegador um projeto com várias cenas, atores ocultos e blocos fora da área visível.

## Consulta pública por projeto

`GET /api/public/projects/:projectId/captures` não requer Authorization, token ou share_token. Retorna as imagens da captura completa mais recente do projeto, com URLs assinadas válidas por 600 segundos. O bucket permanece privado. Para renovar URLs expiradas, consulte a API novamente.

Exemplo: `GET https://qubitjr.helloyotta.com/api/public/projects/1686/captures`.

A resposta contém `projectId`, `captureId`, `projectVersion`, `capturedAt`, `completedAt`, `expiresIn` e `images`. Cada imagem possui `type` (`scene`, `actor` ou `scripts`), `sceneId`, `sceneIndex` (começa em zero), `actorId`, `actorName`, dimensões e `url`. Imagens de cena têm `actorId: null`.

Não retorna snapshots, dicas, identidade do autor ou caminhos internos de armazenamento. Projetos excluídos e projetos sem capturas completas retornam 404; IDs inválidos retornam 400. A resposta usa `Cache-Control: no-store` para não guardar URLs vencidas.

## Geração automática na abertura

Ao abrir no editor um projeto de referência já vinculado a uma missão, o professor-autor ou administrador gera automaticamente as capturas que estiverem faltando. A verificação espera todas as cenas carregarem e consulta `GET /api/assignments/:id/captures/status` (autenticado). Se houver qualquer conjunto completo, não gera outro. Projetos novos ainda sem missão e projetos de alunos não iniciam essa captura.

Quando faltam imagens, o editor mostra o progresso, gera as cenas/atores/programações e envia o conjunto. Esse fluxo reaproveita as dicas salvas, inclusive um array vazio, sem chamar o salvamento de dicas nem salvar o projeto novamente. A página deve permanecer aberta até terminar. Uma falha preserva os dados e permite tentar de novo ao reabrir o projeto. Se o projeto tiver sido alterado antes da captura, a comparação com o snapshot salvo evita publicar imagens divergentes.

Chamadas repetidas na mesma sessão compartilham a verificação. O POST de criação aceita `onlyIfMissing: true` e também verifica se outro conjunto já foi concluído nesse intervalo. O fluxo normal de salvar dicas continua gerando uma versão nova.

A consulta pública retorna `404` com `code: "CAPTURES_NOT_FOUND"` quando o projeto existe, mas ainda não tem capturas completas. Nenhuma migração adicional é necessária.

## Visual atual dos blocos

O renderizador 2 preserva as camadas ocultas dos blocos, excluindo os destaques transitórios que usam a arte antiga. A versão fica registrada em cada item do manifesto `expected`, sem nova migração SQL. Ao abrir um projeto, capturas antigas são reconhecidas como desatualizadas e geradas novamente. O conjunto anterior continua disponível até o novo terminar. O cliente envia `rendererVersion: 2`; clientes antigos continuam identificados como renderizador 1.
