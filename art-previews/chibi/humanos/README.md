# Personagens humanos chibi

Lote de oito personagens ativos de Família e Profissões: as duas amostras aprovadas (menina e vovó) e os seis restantes (bebê, meninas 2 e 3, menino, vovô e astronauta). Os 30 personagens humanos e humanoides foram aplicados na biblioteca oficial.

- `HY-Menina1.png`: criança ruiva, vestido floral e sandálias; referência inicial do padrão humano.
- `HY-VovoF.png`: vovó com cabelos brancos, óculos, cardigan e vestido azul; usa a menina como referência comum de acabamento.
- `comparacao.html`: galeria unificada dos 30 personagens humanos e humanoides em fundo quadriculado ou escuro.
- `PROMPTS.json`: prompts e arquivos de origem gerados com image_gen integrado.
- `PROMPTS-lote-02.json`: prompts e origens dos seis personagens restantes; as crianças usam a menina aprovada como referência, e os adultos usam a vovó aprovada.
- `catalogo.json`: os oito registros originais do catálogo, com nomes, escalas e dimensões.

Padrão: cabeça grande, olhos castanhos sem cílios, contornos marrons, sombras suaves, pose neutra, mãos simples, corpo inteiro e fundo transparente. Preservar as características de idade, pele, cabelo e roupa dos personagens originais.

Economia de iterações: duas amostras validadas antes de ampliar o lote; seis novas artes com um prompt-base curto e referências humanas comuns. Não foram necessárias novas tentativas neste lote de seis.

Os outros 22 personagens estão em ../humanoides/, incluindo Turma Qubit, fantasia, folclore, piratas, Halloween e menino na bicicleta. Galeria verificada: 30 imagens carregadas, transparência e layout móvel sem transbordamento.

Exportação oficial: scripts/promote-chibi-humans.cjs. Integração: scripts/verify-chibi-humans.cjs. Relatórios em humanos/exportacao-oficial e originais preservados em humanos/backup-biblioteca-original (relativos a art-previews/chibi).
