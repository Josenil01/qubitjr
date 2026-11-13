# Biblioteca de personagens e objetos concluída

168 entradas visíveis padronizadas, sem pendências. Catálogos principal e público idênticos; identificadores, dimensões e escalas preservados. Entradas legadas e cenários de fundo ficam fora deste escopo.

- `index.html`: galeria completa por categoria, usando miniaturas oficiais.
- `cobertura.json`: cobertura dos 168 IDs e verificação dos hashes PNG/SVG contra cada manifesto de exportação.
- `verificacao-editor.json`: auditoria das 168 entradas com os módulos reais Library, Sprite, SVG2Canvas, SVGTools e PNGCache.
- `biblioteca-oficial.png`: captura das miniaturas produzidas pelo próprio editor.

Resultado: 168/168 aprovadas, nenhum erro, máscaras de colisão coincidentes com a transparência das miniaturas (IoU mínimo 1). A comparação das últimas 33 artes está em `../restantes/comparacao.html`.

Com Vite iniciado, executar `node scripts/verify-chibi-library.cjs` (a URL pode ser definida em ANIMAL_LIBRARY_URL), `node scripts/audit-chibi-coverage.cjs` e `node scripts/package-chibi-audit.cjs`. Cada lote mantém masters, prompts de image_gen, backups e manifesto em sua pasta.
