# Planetas com rosto chibi

Sol criado do zero: `HY-Sol.png`. Prévia em `sol.html`, prompt e origem em `PROMPT-Sol.json`. Usa Júpiter apenas como referência de acabamento; disco amarelo e raios alaranjados arredondados, sem cílios, braços ou pernas. Cadastrado como `HY-Sol.svg` nos dois catálogos oficiais; o Sol legado permanece oculto e preservado.

Três amostras iniciais: Terra, Júpiter e Saturno. Geradas com image_gen integrado. Originais usados como referência de identidade; cavalo aprovado usado apenas como referência de contorno, cores e acabamento. Prompts em `PROMPTS.json`.

Rostos com dois olhos castanhos brilhantes sem cílios, bochechas rosadas e sorriso pequeno. Sem braços ou pernas. Preservar continentes da Terra, faixas e mancha de Júpiter e anéis de Saturno com oclusão coerente.

Categoria Espaço completa: 13 artes, incluindo os oito planetas (com duas versões de Urano), Sol, Lua, estrela e meteoro. Os nove personagens restantes usam Júpiter como referência comum de acabamento; prompts em `PROMPTS-restantes.json`.

Masters PNG nesta pasta, com fundo transparente. Galeria estática `comparacao.html`, captura `comparacao.png` e relatório `verificacao.json`. Biblioteca oficial em PNG/SVG, com máscaras de seleção e colisão derivadas da transparência. Originais em `backup-biblioteca-original/`, exportação e relatórios de integração em `exportacao-oficial/`.

Fluxo: `scripts/register-chibi-space.cjs` cadastra o novo Sol sem alterar os registros anteriores; `scripts/promote-chibi-space.cjs` exporta as 13 artes; `scripts/verify-chibi-space.cjs` verifica a integração com os módulos reais do editor; `scripts/gallery-chibi-space.cjs` atualiza a comparação. Dimensões, identificadores e escalas dos 12 personagens anteriores são preservados.

Validação concluída: 13/13 personagens aprovados no editor, com miniaturas, PNGCache, imagens no palco, marcas d’água de seleção e contornos de colisão coerentes (IoU 1). Galeria com 25 imagens carregadas, transparência e layout móvel verificados. Os dois catálogos são idênticos e contêm apenas a adição do novo Sol em relação aos catálogos anteriores.
