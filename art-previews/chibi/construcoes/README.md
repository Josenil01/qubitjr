# Construções

Aplicação oficial concluída: 11/11 artes aprovadas nos módulos reais do editor, com miniaturas, imagens no palco, seleção e colisão coerentes (IoU 1). As 22 imagens de antes/depois carregam e o layout móvel não transborda.

11 artes sem rosto: banco (banqueta de madeira), três casas, castelo, celeiro, escola, iglu, loja, moinho e prédio. Geradas com image_gen integrado, usando cada original como referência de identidade e o feno aprovado como referência de acabamento. Prompts em `PROMPTS.json`.

Manter as três casas distintas, as quatro pás do moinho conectadas ao cubo, os três telhados das torres do castelo, o túnel do iglu e os detalhes identificadores de cada fachada. A pequena gata branca da segunda casa e o letreiro SCHOOL da escola original são preservados. Fundo transparente, contornos marrons, sombras suaves, sem rostos nas construções.

Masters PNG nesta pasta; galeria antes/depois em `comparacao.html`. Originais em `backup-biblioteca-original/`, exportação e relatórios em `exportacao-oficial/`. Scripts `scripts/promote-chibi-buildings.cjs`, `scripts/verify-chibi-buildings.cjs` e `scripts/gallery-chibi-buildings.cjs`. Identificadores, dimensões e escalas do catálogo preservados.
