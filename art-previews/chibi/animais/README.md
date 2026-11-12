# Animais chibi QubitJr

Escopo: os 58 animais visíveis nas categorias 03 a 09 de `src/app/media.json`. Versões legadas ocultas não fazem parte deste lote. Fantasia, dinossauros e folclore são outras categorias do catálogo.

Ferramenta: image_gen integrado. Estilo comum: vaca aprovada em `../HY-Vaca-chibi.png`. Regra adicional: olhos sem cílios. Cada geração usa também a arte original como referência de espécie e cores.

Dez artes sem cílios foram reaproveitadas do estudo inicial (incluindo a vaca). O cavalo foi editado para remover os cílios e atualizado também no lote inicial.

`catalogo.json` registra os personagens incluídos. `geracao.json` registra os prompts das novas artes; o prompt do cavalo está abaixo. A galeria `comparacao.html` usa imagens diretamente no HTML.

As 58 artes deste diretório foram aplicadas à biblioteca oficial em `src/app/pnglibrary` e `src/app/svglibrary`. Os 116 arquivos anteriores estão preservados em `../backup-biblioteca-original/`. As categorias, nomes, identificadores e escalas do catálogo foram mantidos.

## Biblioteca oficial

Exportação feita por `scripts/promote-chibi-animals.cjs`: miniaturas PNG nas dimensões do catálogo, SVGs com imagem embarcada em resolução dupla e contornos `pathborder_` recalculados da transparência das novas artes. Artes proporcionais e centralizadas também nos formatos de catálogo não quadrados. As dimensões SVG de lobo e variante de tartaruga foram alinhadas ao catálogo.

Verificação de integração com os módulos reais `Library`, `Sprite`, `SVG2Canvas`, `SVGTools` e `PNGCache`: 58 de 58 aprovados, máscaras de colisão com correspondência de 100% à transparência das miniaturas, dimensões corretas e watermarks carregados. Compilação Vite em memória aprovada; `dist` não foi alterado. Relatórios e captura da biblioteca oficial em `exportacao-oficial/`.

A versão de cache compartilhada por miniaturas, palco, dicas e PNGCache está em `src/app/src/utils/libraryAssets.js`.

## Revisão de patas e antenas dos insetos

Borboleta refeita com seis patas finas e articuladas, em três pares ligados somente ao tórax, e abdômen alongado sem patas. Removidos os enfeites em estrela das antenas da borboleta, abelha e formiga; joaninha e libélula já tinham antenas simples. Estrelas decorativas impressas nas asas da borboleta preservadas. Todas as versões mantêm olhos sem cílios e fundo transparente. Edição com image_gen integrado; prompts e imagens anteriores em `revisao-insetos/`.

Regra para futuras artes de insetos: antenas simples sem estrelas ou outros enfeites; seis patas articuladas ligadas ao tórax, sem patas no abdômen.

## Revisão da cobra

Corrigida com image_gen integrado: removida a língua que saía debaixo da cabeça e substituído o sorriso por uma única boca com a língua bifurcada saindo diretamente de dentro dela. Cores, corpo, olhos sem cílios e transparência preservados. Imagem anterior e prompt em `revisao-cobra/`; imagem atual em `HY-Cobra.png`.

## Revisão do pássaro e do tucano

As duas aves foram refeitas com image_gen integrado após a revisão visual do usuário: vista lateral, asas recolhidas, uma única cauda e bico como única boca. O pássaro perdeu as asas sobrepostas; o tucano perdeu o rosto frontal com boca humana separada do bico. Olhos sem cílios e fundo transparente mantidos. Arquivos atuais: `HY-Passaro.png` e `HY-Passaro-Tucano.png`.

Prompts e imagens anteriores estão em `revisao-aves/`. A galeria usa o hash de cada PNG na URL para atualizar as imagens revisadas sem reutilizar o cache antigo.

## Entrega e verificação

- 58 PNGs de 1254 × 1254, com fundo transparente, cobrindo os 58 animais visíveis das categorias 03 a 09.
- Cavalo corrigido sem cílios. Pequenas correções de anatomia no caranguejo, na aranha e na borboleta registradas em `correcoes.json` e neste documento.
- Os 58 arquivos abriram e passaram pela verificação de dimensões e transparência nos cantos (`verificacao-arquivos.json`).
- Galeria conferida no Chromium pelo servidor local, com JavaScript desabilitado: 58 de 58 imagens carregadas, sete categorias, nenhum link de imagem quebrado, fundos branco/escuro funcionando e sem rolagem horizontal em 390 px (`verificacao-galeria.json`).
- Captura da página completa: `../animais-visao-geral.png`.
- Prompts e origem dos arquivos: `geracao.json`, `proveniencia-lote-02.json`, `proveniencia-lote-03.json` e `correcoes.json`. Prompts das artes reaproveitadas: `../lote-01/PROMPTS.md` e `../README.md`.

## Prompt da correção do cavalo

Use case: precise-object-edit. Edit this approved chibi horse. Remove ALL eyelashes, especially the projecting little strokes at the outer upper edges of both eyes. Make both eye silhouettes clean smooth ovals like the approved cow. Preserve absolutely everything else: same cream palomino horse, pose, anatomy, mane, tail, colors, forehead blaze, cheeks, highlights, outlines, framing and transparent background. No eyeliner or new eye corner extensions.

## Prompt da correção do caranguejo

Precise correction of this crab sprite. It incorrectly has four eyes. Keep ONLY the TWO eyes on the two eyestalks above the shell. Completely REMOVE the two extra dark eyes and their two eyebrow strokes drawn on the FACE / front shell below the eyestalks, filling those areas smoothly with the surrounding pale cream coral shell color. Keep the pink cheeks and small smile. Result MUST have exactly TWO EYES TOTAL, both at the tips of the eyestalks. Preserve the original pose, crab claws, eight walking legs, colors, markings, dark brown outlines, chibi style, image framing and transparent background. No eyelashes. Do not add any other eyes or marks where removed eyes were.
