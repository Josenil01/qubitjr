# QubitJr — posicionamento e estratégia de mercado

Documento de trabalho • 2 de novembro de 2026

## 1. Recomendação central

Posicionar o QubitJr como um programa de criação e pensamento computacional para os anos iniciais, com atividades contextualizadas, acompanhamento do professor e evidências do processo de aprendizagem.

A vantagem mais promissora em relação ao ScratchJr é a combinação entre ambiente criativo e ferramentas para organizar o ensino. Para transformar essa vantagem técnica em uma oferta comercial convincente, é necessário entregar currículo, materiais, formação, implantação e avaliação.

**Mensagem proposta:** “Com o QubitJr, crianças criam histórias e projetos interativos enquanto o professor conduz atividades com objetivos claros, acompanha o processo e conversa sobre o que foi aprendido.”

**Para a escola:** “Um programa para transformar a educação digital em experiências de criação com progressão pedagógica, apoio docente e produções que tornam a aprendizagem visível.”

A programação por blocos, a autoria de histórias e o editor de desenho são capacidades herdadas da base ScratchJr. Devem ser reconhecidas como tal. A diferenciação própria está principalmente na camada escolar e na qualidade da implementação pedagógica.

## 1.1 QubitJr em uma linguagem comercial

Texto de referência para site, material de prospecção e apresentações. Usa linguagem de venda; as entregas descritas como disponíveis devem corresponder ao que de fato pode ser demonstrado no momento da conversa (ver seção 3.2 sobre o que ainda precisa ser provado).

**Frase de abertura (uma linha):**
"QubitJr é a plataforma que leva a criação digital e o pensamento computacional para a sala de aula dos anos iniciais — com o professor no centro."

**Parágrafo de apresentação:**
QubitJr é um ambiente de criação digital para crianças do 1º ao 3º ano, onde elas constroem histórias, jogos e animações interativas programando com blocos visuais. Diferente de uma ferramenta solta, o QubitJr é pensado para funcionar dentro da rotina da escola: o professor propõe missões com objetivo pedagógico claro, acompanha cada criança construindo seu projeto em tempo real, recebe dicas de mediação no momento certo e tem, ao final, uma produção concreta para conversar com a turma e com as famílias sobre o que foi aprendido.

**Em uma frase para cada público:**
- **Para a escola:** um programa de educação digital pronto para implantar, com currículo, formação de professores e acompanhamento — não apenas um software.
- **Para o professor:** uma aula preparada, com roteiro, dicas de intervenção e visão do progresso de cada criança em tempo real.
- **Para a coordenação:** evidências do processo de aprendizagem de cada criança, não só o produto final.
- **Para a família:** uma criança que cria, testa, erra, revisa e explica — e consegue mostrar isso.

**O que entregamos (resumo comercial):**
- Ambiente de criação por blocos no navegador, sem instalação, com projetos salvos na nuvem.
- Missões prontas com objetivo pedagógico, mais a possibilidade de gerar novas propostas por tema.
- Painel do professor com observação e intervenção em tempo real durante a aula.
- Dicas contextuais para apoiar a criança no momento da dificuldade.
- Indicadores do processo de construção de cada projeto, para apoiar — não substituir — a avaliação do professor.
- Compartilhamento das produções das crianças em um player próprio.

**O que não prometemos:** substituir o professor, garantir desempenho acadêmico futuro, cobrir isoladamente toda a BNCC Computação, ou operação 100% offline. Essas ressalvas devem acompanhar qualquer material comercial derivado deste texto.

## 2. Escopo e limites da análise

Foram consultados documentação, grafo de arquitetura e trechos dos módulos relevantes do repositório, além de fontes públicas. Não houve auditoria integral, teste de produção, pesquisa representativa de compradores ou estudo de eficácia.

Neste documento, “observado” significa que há implementação ou documentação técnica relacionada. “Proposta” significa que a entrega ainda precisa ser construída ou validada. Funcionalidade no código não comprova funcionamento em todas as condições, adoção ou aprendizagem.

A pesquisa de mercado é exploratória. Não permite afirmar exclusividade, dimensionar mercado ou comprovar demanda paga. As recomendações comerciais são hipóteses para teste.

## 3. Entendimento do projeto

### 3.1 Arquitetura e implicações

Apesar do nome histórico da pasta, o projeto atual é uma aplicação web. O README utiliza a marca QubitJr. O desktop antigo (Electron) foi removido do repositório — não é mais um produto distribuído.

| Camada | Evidência local | Valor potencial |
|---|---|---|
| Aplicação web | `src/app/`, entradas HTML, Vite | Acesso no navegador e menor esforço de instalação; compatibilidade precisa ser testada |
| Editor visual | `src/app/src/editor/` | Autoria infantil com blocos, personagens, cenas, sons e interações |
| Desenho e biblioteca | `painteditor/`, bibliotecas PNG/SVG | Expressão autoral e contextualização de propostas |
| Persistência | `backend/src/`, Supabase, `WebInterface.js` | Continuidade dos projetos entre dispositivos autenticados |
| Integração HelloYotta | README e serviços de identidade | Operação no ecossistema existente; acesso independente precisa ser confirmado |
| Acompanhamento docente | `entry/teacher.js`, `LiveWatch.js`, `LiveMirror.js`, `routes/teacher.js` | Observação e intervenção durante a construção |
| Missões e catálogo | `routes/assignments.js`, `OfficialCatalog.js` | Organização de propostas e projetos de referência |
| Geração por tema | `activityGeneration.js`, `activityProjectBuilder.js` | Rascunhos de atividades com recursos e blocos existentes |
| Dicas contextualizadas | `hintsGeneration.js`, `HintEngine.js` | Orientação vinculada à referência e ao contexto docente |
| Análise dos projetos | `shared/assignmentScoring.mjs` | Identificação de características estruturais e comparação de requisitos |
| Compartilhamento | `routes/share.js`, `entry/player.js` | Exibição de produções em player dedicado |

A documentação histórica não descreve todas as funcionalidades recentes. O código atual inclui missões, geração de atividades, dicas e acompanhamento docente, ampliando o escopo do port original.

### 3.2 O que ainda precisa ser demonstrado

No recorte analisado, não foi comprovada a existência de currículo completo com progressão validada, alinhamento habilidade por habilidade à BNCC, rubricas pedagógicas validadas ou estudos de impacto do QubitJr. Também não foram validados painel específico para famílias, relatório executivo para diretores, operação offline integral, acessibilidade auditada ou oferta de suporte definida.

Um catálogo implementado não demonstra quantidade ou qualidade do acervo. Arquivos de tradução não comprovam localização pedagógica. Testes de software não substituem estudos de aprendizagem.

O gerador possui perfis de complexidade para 1º, 2º e 3º anos. Isso não valida, por si só, adequação curricular ou de desenvolvimento. Recomendo começar com 1º e 2º anos e avaliar a extensão ao 3º com professores.

### 3.3 Indicador técnico não equivale a aprendizagem

O sistema analisa cenas, personagens, blocos, argumentos e dimensões computacionais aproximadas. A comparação com a referência inclui valores numéricos de determinados blocos.

Uma criança pode reproduzir os requisitos sem compreender; outra pode resolver o desafio por uma estratégia diferente e ter correspondência menor com o modelo. Portanto, apresentar esses dados como **indicadores de construção**, interpretados pelo professor.

A avaliação deve incluir explicação oral, previsão, teste, revisão e aplicação em uma situação nova. Evolução recomendada: distinguir reprodução guiada, aplicação de conceitos e criação aberta, aceitando múltiplas soluções quando o objetivo permitir.

## 4. A percepção de escassez de materiais

Sua percepção aponta para uma dor plausível, mas a tese precisa ser refinada.

Existe material estruturado: o ScratchJr mantém atividades e currículos; o Coding as Another Language, ligado ao Boston College, disponibiliza materiais em português; o Code.org oferece sequências para os anos iniciais e apoio aos professores. Portanto, não há base para afirmar que quase não existem materiais com intencionalidade pedagógica no mundo. Fontes: [ScratchJr — atividades](https://www.scratchjr.org/teach/activities), [currículos](https://www.scratchjr.org/teach/curricula), [CAL em português](https://sites.bc.edu/codingasanotherlanguage/scratchjr-curricula-portuguese/), [Code.org — guia curricular](https://code.org/files/CSF_CoursesA-F_Curriculum_Guide.pdf).

A oportunidade a investigar é o trabalho que permanece entre encontrar conteúdo e realizar uma boa aula: selecionar, adaptar, sequenciar, preparar, aplicar, observar e avaliar.

A TIC Educação 2024 informa que, entre coordenadores de escolas que ofereciam atividades de educação digital, 30% relataram que elas ocorriam apenas quando surgia necessidade. O levantamento abrange Ensino Fundamental e Médio; não representa especificamente 1º e 2º anos e não mede escassez de materiais. Sugere investigar continuidade e planejamento. Fonte: [Cetic.br — TIC Educação 2024](https://cetic.br/media/docs/publicacoes/2/pt-br/20251217165522/tic_educacao_2024_livro_completo.pdf).

A UNESCO recomenda avaliar adequação, equidade, evidências e sustentabilidade, preservando a centralidade do professor. Isso dá fundamento a uma proposta que inclua implantação e mediação. Fonte: [UNESCO — usos apropriados da tecnologia](https://www.unesco.org/gem-report/en/articles/what-are-appropriate-uses-technology-education).

**Hipótese comercial:** a escola pode pagar pela redução do trabalho de implementação e pela consistência pedagógica, mesmo tendo acesso a ferramentas e materiais gratuitos. Essa disposição precisa ser testada.

## 5. Brasil e mundo

### Brasil

A BNCC Computação e as diretrizes de educação digital tornam pertinente a conversa sobre integração curricular. A Resolução CNE/CEB nº 2/2025 trata do uso de dispositivos e da integração da educação digital e midiática. Verificar a aplicação no sistema de ensino do cliente. Fonte: [MEC — Resolução nº 2/2025](https://www.gov.br/mec/pt-br/cne/2025/marco/rceb002_25.pdf).

O QubitJr pode contribuir especialmente com pensamento computacional e autoria digital. Não é possível afirmar que cobre integralmente os eixos pensamento computacional, mundo digital e cultura digital, ou que sua contratação assegura conformidade curricular. A descrição dos eixos consta em [Governo Federal — BNCC Computação](https://www.gov.br/secom/pt-br/assuntos/educacao-midiatica/mapa/todas-as-fichas/aplicativo-bncc-computacao/).

A comunicação deve mostrar uma aula e seu lugar no planejamento. Evitar vender por pressão regulatória ou apresentar códigos de habilidades sem revisão pedagógica.

### Mundo

A existência de currículos gratuitos e pesquisados dificulta competir apenas com “ensinar programação”. A hipótese de diferenciação internacional é a combinação de autoria infantil, ferramentas para professores e implantação localizada.

Sequência recomendada: validar no Brasil; testar com parceiro em um mercado de língua portuguesa; avaliar depois um mercado de língua espanhola. Essa ordem busca reduzir complexidade de execução, não classificar atratividade econômica. Faltam pesquisa local de concorrência, compradores, custos e requisitos operacionais.

Traduzir a interface é insuficiente. Será preciso adaptar exemplos culturais, progressão, referências curriculares, formação e suporte.

## 6. Comparação com o ScratchJr

O ScratchJr é uma referência de qualidade e uma alternativa gratuita relevante. Seu ecossistema tem materiais pedagógicos. A comparação considera o aplicativo oficial e os materiais citados, sem pretender cobrir serviços de terceiros.

| Critério | ScratchJr e ecossistema | QubitJr observado | Prova comercial necessária |
|---|---|---|---|
| Autoria com blocos | Capacidade central | Editor derivado dessa base | Reconhecer a origem e mostrar a experiência |
| Materiais pedagógicos | Atividades e currículos disponíveis | Infraestrutura de missões e catálogo | Demonstrar o acervo real e sua qualidade |
| Acesso no navegador | Conferir distribuição e dispositivos suportados na versão comparada | Aplicação web implementada | Executar no equipamento da escola |
| Continuidade de projetos | Comparar o fluxo da versão utilizada pela escola | Persistência em nuvem | Salvar e reabrir em outro dispositivo |
| Organização do ensino | Materiais apoiam o educador | Missões integradas e projetos de referência | Publicar, realizar e acompanhar uma atividade |
| Intervenção docente | Mediação presencial é possível | Observação e controle temporário | Demonstrar intervenção e devolução da autoria |
| Apoio contextual | Conforme materiais e mediação adotados | Dicas relacionadas ao modelo | Mostrar uma dica que favoreça reflexão |
| Preparação por tema | Currículos e criação manual disponíveis | Geração com restrições técnicas | Medir tempo até uma proposta revisada |
| Acompanhamento | Observação e instrumentos externos possíveis | Análise estrutural integrada | Mostrar informação útil e seus limites |
| Custo | Alternativa gratuita forte | Oferta comercial a definir | Justificar serviços e tempo poupado |

**Resposta proposta a “por que pagar?”:** “O ScratchJr é uma excelente ferramenta gratuita. Nossa proposta é entregar sequência de ensino, formação e acompanhamento para uma prática consistente, usando os recursos do QubitJr. O piloto permitirá avaliar se essa entrega faz diferença para a escola.” Só mencionar serviços efetivamente disponíveis.

Outras alternativas incluem Code.org, materiais gratuitos selecionados pelo professor, sistemas de ensino, oficinas, robótica e computação sem dispositivos. São categorias de substitutos, não uma comparação completa de suas ofertas. A escola também pode manter a prática atual; a proposta precisa explicar qual problema relevante resolve.

## 7. Público inicial e processo de decisão

Perfil inicial sugerido: escola privada de pequeno ou médio porte, com 1º e 2º anos, coordenação atuante, equipamentos compartilhados e disposição para um piloto acompanhado. É uma hipótese para facilitar aprendizado e acesso aos decisores, não uma conclusão sobre maior rentabilidade.

| Público | Papel provável | Critério principal |
|---|---|---|
| Diretor/mantenedor | Aprova investimento e implantação | Valor, viabilidade e continuidade |
| Coordenador | Avalia proposta e organiza adoção | Coerência, progressão e avaliação |
| Professor | Aplica e influencia permanência | Preparação, condução e apoio |
| Família | Confia e influencia percepção | Propósito, criação e experiência da criança |

Em redes públicas ou grandes grupos, mapear também compras, TI, secretaria e mantenedora. A venda exige capacidade operacional e conhecimento do processo de contratação. Não recomendo expansão ampla antes de validar a entrega.

## 8. Abordagem para diretores

**Necessidade:** implantar uma proposta viável, com valor pedagógico perceptível e custo sustentável.

**Mensagem:** “Vamos testar uma sequência de criação digital, apoiar os professores e apresentar o que funcionou, o que as crianças conseguiram explicar e o esforço para continuar.”

**Como alcançar:** indicação de coordenadores, contatos escolares existentes, encontros de gestores, associações regionais e prospecção personalizada. LinkedIn e e-mail podem apoiar o acesso ao responsável; começar com um resumo objetivo e uma produção comentada. Os canais são hipóteses a testar.

**Primeira reunião:** perguntar como educação digital entra no currículo, quem prepara as aulas, quais equipamentos existem, como a escola avalia as experiências e quem aprova orçamento. Demonstrar em até 20 minutos um projeto, a atividade que o originou, a atuação docente e o desenho do piloto.

**Entregáveis:** resumo executivo, orçamento completo, cronograma, responsabilidades, diagnóstico de infraestrutura e exemplo de devolutiva. Relatório executivo é proposta de entrega, não uma tela comprovada.

**Objeções e resposta:**

- “Já temos tecnologia”: identificar que trabalho continua difícil; sem problema relevante, não forçar substituição.
- “As famílias rejeitam telas”: mostrar duração delimitada, mediação e atividades de planejamento e conversa fora da tela.
- “Não há orçamento”: dimensionar um piloto menor e explicar o custo total, sem prometer retorno financeiro.
- “Isso diferencia a escola?”: apresentar produções e práticas verificáveis; evitar promessas de matrículas ou superioridade acadêmica.

**Próximo passo:** reunião com coordenação e diagnóstico do piloto. **Indicadores comerciais:** reuniões qualificadas, pilotos contratados, continuidade e custo de implantação.

## 9. Abordagem para coordenadores

**Necessidade:** saber o que será ensinado, como progride e como observar aprendizagem.

**Mensagem:** “Cada atividade parte de um objetivo, prevê intervenções e termina com uma produção e uma explicação da criança. A coordenação acompanha o percurso e ajusta com os professores.”

**Como alcançar:** oficinas de planejamento, comunidades de coordenação, eventos pedagógicos e indicação docente. Material de entrada: sequência completa com plano, intervenções e critérios de observação.

**Demonstração:** três propostas conectadas — sequência, investigação de erro e repetição — relacionadas ao planejamento existente. Mostrar missões e análise estrutural como apoio à observação.

**Entregáveis:** progressão, planos, referências curriculares revisadas, adaptações, rubrica e exemplos de respostas diferentes. Um vídeo bonito do projeto final não basta como evidência.

**Objeções e resposta:**

- “É desconectado do currículo”: construir uma unidade com tema e calendário já adotados.
- “Como sei que aprenderam?”: combinar produção, explicação, observação e desafio novo.
- “Padroniza demais”: preservar escolhas de narrativa e estratégia; separar aparência de requisitos conceituais.
- “A IA decide a aula?”: mostrar rascunho e revisão humana; restrições técnicas não validam qualidade pedagógica.

**Próximo passo:** escolher uma unidade com dois professores e pactuar observações. **Indicadores:** aulas incorporadas ao planejamento, qualidade dos registros e continuidade pedagógica.

## 10. Abordagem para professores

**Necessidade:** conduzir uma boa aula sem preparação excessiva, com suporte quando surgirem dificuldades.

**Mensagem:** “Você recebe uma proposta, testa o projeto, adapta à turma e acompanha as crianças criando. O apoio inclui o que perguntar quando elas travam.”

**Como alcançar:** oficinas práticas, indicação entre colegas, grupos profissionais e conteúdos pesquisáveis sobre problemas de aula. Exemplos: “Como trabalhar sequência antes de abrir o computador”; “O que perguntar quando o personagem vai para o lado errado”; “Como avaliar projetos diferentes”.

**Jornada:** material útil → oficina em que o professor cria → primeira aplicação assistida → conversa de continuidade com a coordenação.

**Entregáveis:** plano de uma página, preparação, roteiro de perguntas, alternativa sem dispositivos, referência, critérios de observação, extensões e solução de falhas comuns. Definir horário e escopo do suporte.

**Objeções e resposta:**

- “Não sei programar”: prática curta de previsão, execução e revisão de comandos.
- “Não cabe na aula”: testar duração e organizar etapas interrompíveis.
- “Vou perder o controle”: trabalho em duplas, papéis e sinais de ajuda; observação remota com propósito claro.
- “Vou ter mais trabalho”: medir preparação e dificuldades e revisar o material.

Controle remoto deve apoiar intervenções pontuais. A criança precisa ter oportunidade de explicar e executar sua própria revisão.

**Próximo passo:** primeira aplicação acompanhada e devolutiva breve. **Indicadores:** preparação real, aulas realizadas, pedidos de suporte e intenção de repetir.

## 11. Abordagem para famílias

**Necessidade:** entender o propósito da experiência e perceber o que a criança aprendeu.

**Mensagem:** “Seu filho vai criar uma história interativa, testar ideias e explicar escolhas. Queremos que você perceba esse processo na produção que ele apresenta.”

**Como alcançar:** começar pelos canais da escola — reunião, mostra de projetos e comunicação da coordenação. Testar aquisição direta para famílias depois de definir uma jornada própria de acesso, suporte e acompanhamento.

**Demonstração:** a criança apresenta e responde: “O que queria que acontecesse?”, “O que mudou?”, “Como descobriu o problema?”.

**Entregáveis:** comunicado curto, vídeo demonstrativo, perguntas para conversar, orientação de uso em casa e explicação do compartilhamento. Exposição de nomes, imagens e vozes exige fluxo adequado de autorização e controle de visibilidade.

**Objeções e resposta:**

- “É só um jogo?”: mostrar autoria dos comandos e revisão.
- “Vai ter mais tela?”: explicar duração, mediação e etapas fora dela.
- “Não entendo tecnologia”: perguntar sobre intenção e tentativas, sem assumir a execução.
- “Garante vantagem futura?”: falar de experiências observáveis; evitar promessas de inteligência, carreira ou desempenho futuro.

**Próximo passo:** mostra ou atividade breve de explicação. **Indicadores:** compreensão do propósito e qualidade da conversa; painel familiar não foi validado no produto.

## 12. A oferta pedagógica a construir

### Estrutura mínima de cada unidade

1. Público, conhecimentos prévios e duração testada.
2. Objetivo observável e conexão curricular revisada, com referência e versão.
3. Situação que dê sentido à criação.
4. Exploração inicial sem dispositivos.
5. Exploração guiada e escolhas autorais.
6. Intervenções e perguntas do professor.
7. Dificuldades previstas e adaptações.
8. Critérios de observação e evidências.
9. Desafio de aplicação em outra situação.
10. Orientação familiar e histórico de revisão.

“Organizar uma sequência, prever seu resultado e explicar uma alteração depois do teste” é um objetivo observável. “Desenvolver raciocínio lógico” é uma finalidade ampla, insuficiente como único objetivo de aula.

### Exemplo: o caminho até a biblioteca

**Público proposto:** 1º ou 2º ano, após familiarização básica. **Duração inicial a testar:** 45 minutos. **Objetivo:** construir e revisar uma sequência de deslocamentos e explicar como a ordem dos comandos altera o percurso.

- 8 minutos: orientar um colega em um percurso no chão.
- 5 minutos: desenhar uma previsão do caminho em duplas.
- 17 minutos: programar, executar e revisar.
- 10 minutos: mudar o destino e discutir o que precisa mudar.
- 5 minutos: apresentar e justificar uma alteração.

Perguntas: “Onde ele vai parar?”, “Qual comando mudou o caminho?”, “O que você manteria para outro destino?”.

Adaptações: percurso menor, cartões de comandos e apoio de colega. Extensão: dois caminhos possíveis. Se a conexão falhar, concluir com cartões e registro em papel; isso é uma alternativa didática, não uma alegação de funcionamento offline.

Evidências: previsão, revisão e explicação. O projeto final é uma das evidências.

### Rubrica proposta para validação

| Critério | Com apoio | Em desenvolvimento | Com autonomia nesta tarefa |
|---|---|---|---|
| Previsão | Precisa de modelagem | Antecipa parte da sequência | Explica uma previsão coerente |
| Sequência | Organiza com intervenção frequente | Organiza e corrige parte das ações | Organiza comandos adequados ao objetivo |
| Revisão | Modifica por orientação direta | Testa um problema com perguntas | Propõe, testa e explica uma revisão |
| Explicação | Mostra o resultado com ajuda | Relata uma escolha | Relaciona escolha e comportamento |

É uma proposta de instrumento, não uma rubrica validada. Registrar o apoio recebido e evitar rotular permanentemente a criança a partir de uma tarefa.

### Progressão inicial sugerida

| Unidade | Foco | Produção | Evidência |
|---|---|---|---|
| 1 | Comando e sequência | Percurso | Prever e ordenar |
| 2 | Teste e revisão | Percurso corrigido | Explicar alteração |
| 3 | Evento e interação | Personagem que responde ao toque | Relacionar ação e resposta |
| 4 | Repetição | Movimento recorrente | Explicar por que repetir |
| 5 | Coordenação | Interação entre personagens | Descrever relações entre ações |
| 6 | Autoria | História sobre tema da turma | Planejar, criar, revisar e apresentar |

Ajustar ordem e duração ao desenvolvimento e à experiência prévia. Os limites do gerador não devem determinar mecanicamente o currículo de cada série.

## 13. Modelo de oferta e receita

Oferta inicial proposta: ciclo acompanhado de 8 a 12 semanas, com acesso, unidade revisada, formação prática, suporte e devolutiva. A duração é hipótese de execução e venda.

Estrutura possível:

- **Experimentação:** sequência demonstrativa e oficina.
- **Programa escolar:** currículo contratado, plataforma, formação e acompanhamento.
- **Rede:** adaptação e formação de multiplicadores, quando houver capacidade operacional.
- **Famílias:** trilhas mediadas, após validar jornada específica.

Não há dados para recomendar preço. Levantar infraestrutura, geração por IA, suporte, implantação, revisão editorial, formação e aquisição. Calcular margem de contribuição e capacidade de atendimento antes de prometer uso ilimitado.

Testar cobrança por escola com faixa de turmas ou por turma com mínimo contratual. Separar implantação de recorrência quando fizer sentido e explicar os itens incluídos.

Perguntas para validar: “Que gasto ou trabalho essa oferta substituiria?”, “Quem aprova?”, “O que precisaria acontecer para continuar?”. Disposição declarada a pagar deve ser confrontada com decisão concreta, como piloto contratado.

## 14. Piloto e evidências

Proposta: 3 a 5 escolas, duas turmas por escola quando viável e professores com experiências distintas. Amostra para aprendizado operacional, sem representatividade estatística presumida.

Etapas: diagnóstico de infraestrutura e planejamento; formação prática; aplicação de sequência curta; avaliação; devolutiva e decisão de continuidade.

| Dimensão | Medida | Interpretação |
|---|---|---|
| Preparação | Minutos até estar pronto para aplicar | Comparar com a prática anterior, quando houver registro |
| Adoção | Aulas realizadas / combinadas | Investigar barreiras e cancelamentos |
| Confiabilidade | Acesso, salvamento e reabertura | Separar falhas técnicas de dificuldades de aprendizagem |
| Mediação | Ajuda recebida e intervenções | Interpretar autonomia na tarefa |
| Aprendizagem | Previsão, revisão, explicação e desafio novo | Complementar análise estrutural |
| Valor | Intenção de repetir e decisão de continuidade | Investigar razões e orçamento |
| Sustentabilidade | Custo de implantação e suporte | Comparar com a oferta e capacidade da equipe |

Critérios iniciais a pactuar: pelo menos 80% das aulas combinadas realizadas; evidências interpretáveis da maioria das crianças participantes; ausência de falhas críticas recorrentes; professor disposto a repetir; espaço no planejamento; custo de atendimento compatível.

Esses limites são metas propostas, não resultados existentes ou padrões científicos. Ganho entre início e fim não comprova causalidade. Alegações de eficácia exigem desenho de pesquisa mais robusto, instrumentos revisados e consideração de explicações alternativas.

## 15. Plano de 90 dias

### Dias 1 a 15 — descobrir e escolher

Entrevistar, por viabilidade, aproximadamente 6 diretores, 6 coordenadores, 10 professores e 8 responsáveis. Pedir exemplos recentes de preparação, atividades e dificuldades. Confirmar quem decide, qual orçamento existe e como funciona o acesso via HelloYotta.

Entregas: segmento prioritário, mapa de problemas, inventário de funcionalidades demonstráveis e proposta de piloto. A amostra é exploratória.

### Dias 16 a 30 — preparar

Revisar uma sequência curta. Produzir planos, rubrica, formação e comunicado familiar. Montar demonstração com projeto, missão, dica e observação docente. Testar em equipamentos reais e medir preparação com dois professores.

Entregas: pacote demonstrável e condições comerciais preliminares. Corrigir impedimentos antes de divulgação ampla.

### Dias 31 a 60 — aplicar

Iniciar pilotos e acompanhar primeiras aulas. Registrar problemas e versões dos materiais. Conversar semanalmente com professores. Investigar soluções diferentes que a comparação automática interpreta de forma inadequada.

Entregas: registros, custos de atendimento, produções autorizadas e revisão do programa.

### Dias 61 a 90 — avaliar e decidir

Concluir uma rodada de evidências conforme a duração do piloto. Apresentar proposta de continuidade onde houver adequação. Produzir estudo de caso com contexto, método, resultados e limites. Se o ciclo escolhido exceder o período, registrar o acompanhamento pendente.

Entregas: oferta ajustada, materiais revisados e decisão de manter ou alterar o segmento. Evitar ampliar divulgação antes de compreender adoção e atendimento.

## 16. Conteúdo e aquisição

Quatro linhas editoriais:

1. Aula aplicável: objetivo, material e intervenção.
2. Aprendizagem visível: criança explica previsão, dificuldade e revisão.
3. Trabalho docente: preparação, adaptação e decisões em aula.
4. Gestão pedagógica: progressão, integração e avaliação.

Exemplos: “Uma aula de sequência com cartões e personagens”; “Como diferenciar copiar comandos de compreender”; “O que a criança consegue explicar sobre seu projeto”; “Como planejar uma unidade de criação digital”.

Cada conteúdo leva a uma ação proporcional: experimentar sequência, participar de oficina ou conversar sobre piloto. Medir aplicação e contatos qualificados, além de visualizações.

Priorizar escolas e educadores próximos, oficinas e indicações. Anúncios pagos devem começar com testes pequenos após a jornada funcionar. As mensagens são modelos; nenhuma comunicação externa foi enviada.

## 17. Prioridades de produto

Antes de ampliar vendas, confirmar acesso e recuperação, turmas, continuidade, equipamentos reais, materiais revisados e suporte. Explicar indicadores automáticos. Verificar controles de compartilhamento e procedimentos relativos às produções infantis.

Evoluções com maior relação com o posicionamento:

- Metadados pedagógicos por missão: objetivo, pré-requisito, mediação e evidências.
- Avaliação com observação humana e soluções diversas.
- Catálogo por objetivo, complexidade e duração testada.
- Versionamento e revisão editorial dos conteúdos gerados por IA.
- Devolutiva para coordenação e famílias, validada com esses públicos.

Esses itens são propostas, não recursos comprovados. Priorizar conforme obstáculos reais do piloto. A geração automática pode ampliar rascunhos; diferenciação exige qualidade editorial, aplicação e revisão contínua.

## 18. Identidade e atribuições

O README utiliza QubitJr, mas o `package.json` ainda apresenta ScratchJr e licença MIT. O arquivo `LICENSE` traz condições de redistribuição em três cláusulas, incluindo restrição ao uso do nome do titular para endosso. Esclarecer essa inconsistência antes de padronizar a comunicação comercial.

Licença de código não comprova direitos sobre todos os elementos visuais ou marcas. Organizar procedência, atribuições e identidade própria. Não apresentar MIT, Scratch Foundation ou pesquisadores como apoiadores do QubitJr. O README já declara independência. Os [termos do ScratchJr](https://www.scratchjr.org/eula) são referência do aplicativo oficial; este documento não conclui a análise jurídica da comercialização.

## 19. Perguntas decisivas

- Quem já aplicou o produto em turma real e em que condições?
- Que conteúdos estão revisados e disponíveis?
- Quanto tempo leva preparar e aplicar?
- Que problema mobiliza orçamento?
- Quais integrações são obrigatórias?
- Quais equipamentos e redes são atendidos?
- Como a criança demonstra compreensão além de cumprir o modelo?
- Quanto custa atender uma escola por ciclo?
- Quem responde pela qualidade e atualização pedagógica?
- Por que a escola continuaria após a novidade?

A próxima entrega de maior valor é uma unidade de ensino que funcione repetidamente com professores reais. Ela permitirá sustentar o posicionamento com evidências próprias.

## 20. Fontes e rastreabilidade

Fontes públicas consultadas em 2 de novembro de 2026. Apoiam contexto e existência de alternativas, não resultados do QubitJr.

- [ScratchJr — atividades](https://www.scratchjr.org/teach/activities) e [currículos](https://www.scratchjr.org/teach/curricula).
- [Boston College — CAL em português](https://sites.bc.edu/codingasanotherlanguage/scratchjr-curricula-portuguese/) e [CAL, 1º ano](https://sites.bc.edu/codingasanotherlanguage/curricula/scratchjr-curricula/1st-grade-scratchjr/): exemplos de currículo e avaliação; adequação ao Brasil requer revisão.
- [Code.org — CS Fundamentals](https://code.org/files/CSF_CoursesA-F_Curriculum_Guide.pdf): documento curricular de referência, não inventário exaustivo da oferta atual.
- [Cetic.br — TIC Educação 2024](https://cetic.br/media/docs/publicacoes/2/pt-br/20251217165522/tic_educacao_2024_livro_completo.pdf) e [indicadores](https://www.cetic.br/pt/pesquisa/educacao/indicadores/). O portal possui indicadores de 2025; o recorte de atores citado aqui é de 2024.
- [UNESCO — usos apropriados da tecnologia](https://www.unesco.org/gem-report/en/articles/what-are-appropriate-uses-technology-education).
- [MEC — Resolução CNE/CEB nº 2/2025](https://www.gov.br/mec/pt-br/cne/2025/marco/rceb002_25.pdf).
- [Governo Federal — BNCC Computação](https://www.gov.br/secom/pt-br/assuntos/educacao-midiatica/mapa/todas-as-fichas/aplicativo-bncc-computacao/).
- [ScratchJr — termos](https://www.scratchjr.org/eula).

Evidências locais: `README.md`, `CLAUDE.md`, `agent.md`, `graphify-out/GRAPH_REPORT.md`, `LICENSE`, `package.json`, `backend/src/routes/{teacher,assignments,share}.js`, `backend/src/services/{activityGeneration,activityProjectBuilder,hintsGeneration}.js`, `shared/assignmentScoring.mjs`, `src/app/src/lobby/OfficialCatalog.js`, `src/app/src/editor/{LiveWatch,LiveMirror}.js` e entradas do editor/player.

## 21. Sequência de execução resumida

Use esta ordem para transformar o posicionamento em uma oferta testada. Os prazos seguem o plano de 90 dias e podem ser ajustados à duração dos pilotos.

| Ordem | Quando | Ação principal | Entrega para avançar |
|---|---|---|---|
| 1 | Dias 1 a 15 | Escolher o público inicial e entrevistar diretores, coordenadores, professores e responsáveis | Problema prioritário, perfil de escola e processo de decisão identificados |
| 2 | Dias 1 a 15 | Conferir o que já pode ser demonstrado: acesso, missões, salvamento, acompanhamento e compartilhamento | Lista de recursos disponíveis e impedimentos técnicos a corrigir |
| 3 | Dias 16 a 30 | Preparar uma sequência pedagógica curta, com objetivos, planos, adaptações e avaliação | Unidade revisada, aplicável por um professor real |
| 4 | Dias 16 a 30 | Montar a demonstração e a proposta comercial do piloto | Apresentação, escopo, custos, responsabilidades e critérios de sucesso |
| 5 | Dias 16 a 30 | Selecionar escolas, testar equipamentos e formar os professores participantes | Escolas preparadas e calendário de aplicação acordado |
| 6 | Dias 31 a 60 | Aplicar as atividades com acompanhamento próximo | Registros de aulas, dificuldades, tempo de preparação e evidências das crianças |
| 7 | Dias 31 a 60 | Corrigir os obstáculos observados e revisar materiais e produto | Experiência mais consistente e custo de atendimento conhecido |
| 8 | Dias 61 a 90 | Avaliar o piloto com professores e coordenação e compartilhar uma devolutiva com as famílias | Resultados contextualizados e decisão sobre continuidade |
| 9 | Dias 61 a 90 | Ajustar preço, pacote e mensagem; propor continuidade às escolas com boa adequação | Oferta comercial sustentada pela experiência do piloto |
| 10 | Após validar a entrega | Publicar casos autorizados e ampliar prospecção, parcerias e divulgação | Crescimento compatível com a capacidade de implantação e suporte |

**Ordem de envolvimento na escola:** coordenador para avaliar a proposta → diretor para aprovar investimento e condições → professor para preparar e aplicar → famílias para compreender e acompanhar → coordenação e direção para decidir a continuidade. Adaptar essa ordem ao processo real de cada instituição.

**Primeiro passo prático:** agendar conversas com três escolas acessíveis e selecionar uma atividade existente para transformá-la na primeira unidade demonstrável.
