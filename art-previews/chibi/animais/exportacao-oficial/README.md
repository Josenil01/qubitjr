# Biblioteca oficial de animais chibi

58 animais das categorias 03 a 09, aplicados aos diretórios oficiais `src/app/pnglibrary` e `src/app/svglibrary`. Inclui todas as revisões de anatomia e antenas aprovadas na galeria.

Os PNGs foram exportados nas dimensões lógicas do catálogo. Os SVGs incorporam a mesma arte em resolução dupla e um contorno de transparência para seleção, colisão e desenho. Todos os arquivos mantêm proporção e enquadramento, incluindo os formatos não quadrados. Nenhuma alteração em `media.json` ou na sua cópia pública foi necessária.

- `manifesto.json`: hashes dos masters e arquivos oficiais, dimensões, escalas e correspondência dos contornos.
- `verificacao-editor.json`: teste dos 58 animais nos módulos reais do editor; nenhuma falha e correspondência mínima de máscaras de 100%.
- `biblioteca-oficial.png`: captura das miniaturas construídas pelo módulo Library do aplicativo.
- `../../backup-biblioteca-original/`: os 116 arquivos anteriores e seus hashes em `manifesto.json`.

Exportador: `node scripts/promote-chibi-animals.cjs`. Verificação, com Vite iniciado: `node scripts/verify-chibi-animals.cjs`. Executar os comandos a partir da raiz do repositório. O exportador valida todos os arquivos antes de promovê-los e não sobrescreve a cópia inicial dos originais.

Ao aplicar novas revisões à biblioteca, incrementar a versão em `src/app/src/utils/libraryAssets.js` para invalidar o cache. A compilação foi validada com `write: false`, sem modificar `dist`; os avisos existentes de CSS/assets do projeto permanecem fora desta atualização.
