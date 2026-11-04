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

As imagens são enviadas individualmente e limitadas a 3 MB. Cenas: 960 ? 720. Programações extensas são reduzidas proporcionalmente, incluindo todos os blocos. Não executar animações durante a captura: o fluxo interrompe a execução antes de salvar, sem resetar as posições.

Verificação: executar os testes `projectCaptures.test.js` do backend e `CaptureRenderer.test.js` / `AssignmentCapture.test.js` do frontend. Validar no navegador um projeto com várias cenas, atores ocultos e blocos fora da área visível.
