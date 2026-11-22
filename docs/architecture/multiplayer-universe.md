# Star Frontier — Universo Multiplayer Compartilhado

**Status:** especificação arquitetural inicial (não é implementação multiplayer funcional).  
**Branch de trabalho:** `feature/multiplayer-universe-foundation`  
**Base técnica:** `feature/deflector-core-runtime`

## 1. Visão do produto

O Star Frontier terá um universo compartilhado no qual cada jogador pode explorar de forma independente, possuir ou comandar sua própria nave e, quando desejar, cooperar com outros jogadores.

O multiplayer não deve prender todos os participantes a uma única nave. A unidade principal é o **universo/servidor**; naves, personagens, equipes, tripulações, estações e frotas são entidades que coexistem nesse universo.

Um jogador pode:
- explorar sozinho em sua própria nave;
- encontrar outros jogadores e formar uma equipe;
- convidar jogadores para tripular sua nave;
- embarcar como tripulante na nave de outro jogador;
- reunir várias naves em uma frota ou comboio;
- sair da tripulação e continuar explorando com sua própria nave.

## 2. Fluxo de entrada do jogador

### 2.1 Identidade e personagem

1. O jogador entra ou cria uma identidade de conta.
2. Cria/seleciona um personagem persistente.
3. O personagem recebe um identificador estável e dados de progressão.
4. O jogador seleciona o servidor/universo de destino.
5. Opcionalmente, informa um código de equipe ou aceita um convite.

A identidade da conta, o personagem e a sessão de jogo são conceitos distintos. A perda de conexão não deve criar outro personagem nem apagar progresso persistido.

### 2.2 Seleção de servidor

A interface deve distinguir:

- **Server Principal:** universo oficial compartilhado, com autoridade e persistência centralizadas. Todos os jogadores que selecionarem esse servidor entram no mesmo universo lógico, respeitando região, versão e disponibilidade.
- **Servidor Local:** sessão hospedada por um jogador ou dispositivo na rede local, inicialmente por Wi-Fi/roteador ou ponto de acesso. É uma sessão separada do universo principal, salvo se uma futura função de transferência entre servidores for projetada.
- **Servidores adicionais:** espaços futuros para regiões, testes, comunidades ou universos alternativos.

A lista de servidores deve apresentar, quando disponível: nome, tipo, estado, versão compatível, latência, população e capacidade. Não exibir métricas que ainda não sejam fornecidas pelo serviço.

## 3. Universo e autoridade

### 3.1 Servidor autoritativo

Cada sessão/universo deve ter uma autoridade única para validar e publicar o estado compartilhado. Os clientes enviam intenções/comandos; não definem diretamente o estado oficial de outros jogadores ou entidades.

A autoridade é responsável por:
- validar movimento, ações, permissões e interações;
- manter a lista de jogadores e entidades da sessão;
- controlar propriedade/ocupação de naves e assentos;
- aplicar regras de equipe e tripulação;
- resolver conflitos de comandos;
- publicar atualizações de estado;
- persistir os dados pertencentes ao servidor.

O servidor principal deverá ser hospedado em infraestrutura dedicada. Um servidor local poderá ser hospedado por um dispositivo compatível, respeitando limites de bateria, memória, rede e execução em segundo plano do Android.

### 3.2 Separação de responsabilidades

- **C++/WASM:** regras determinísticas e cálculos centrais de simulação que possam ser compartilhados entre servidor e cliente. O WASM executado no cliente não é, por si só, uma autoridade confiável.
- **Runtime:** ciclo de sessão, conexão, autenticação/autorização, roteamento de comandos, sincronização, reconexão e integração com os sistemas de jogo.
- **Three.js:** representação visual local, câmeras, HUD e interação do jogador. A renderização de cada aparelho é independente.
- **Camada de transporte:** abstrai WebSocket/Wi-Fi e futuros transportes nativos, sem espalhar detalhes de rede pelos sistemas de gameplay.
- **Persistência:** separa dados de conta/personagem, estado durável de naves/equipes e estado transitório da sessão.

A arquitetura multiplayer deve integrar-se ao Runtime existente, sem criar uma segunda simulação concorrente nem duplicar os sistemas de nave.

## 4. Personagens, naves e propriedade

- Um personagem pertence a uma identidade de jogador.
- Um jogador pode ter uma nave própria ou autorização para comandar uma nave compartilhada.
- Cada nave possui identificador persistente, estado, tripulação atual e permissões.
- O proprietário/comandante pode delegar funções sem transferir automaticamente a propriedade.
- Uma nave vazia pode permanecer persistida conforme as regras do servidor.
- A desconexão de um tripulante libera sua função/assento após o período de tolerância da reconexão.
- A desconexão do comandante deve seguir uma política definida pelo servidor: transferência de comando autorizada, piloto automático/estado seguro ou encerramento controlado da sessão da nave. Não presumir que o cliente desconectado continua sendo autoridade.

## 5. Equipes e códigos

O sistema de equipe é independente da tripulação de uma nave.

### 5.1 Código de equipe

- Criar equipe gera um código de convite único, não sequencial e difícil de adivinhar.
- Um jogador pode inserir o código na criação/seleção de personagem ou posteriormente no painel social.
- Códigos podem expirar, ser revogados ou regenerados por quem tiver permissão.
- Entrada pode exigir aprovação do líder ou de um membro autorizado.
- A equipe mantém membros, liderança, convites e configurações.
- O código não concede automaticamente controle sobre naves, inventários ou recursos.

### 5.2 Equipe não significa estar preso junto

Membros da mesma equipe podem estar em naves diferentes, em regiões diferentes ou explorando separadamente. A equipe facilita convites, comunicação e cooperação, mas não restringe a liberdade de exploração.

## 6. Tripulação multiusuário

Uma nave pode receber vários jogadores em funções distintas. A tripulação é uma ocupação temporária da nave e não substitui a equipe social.

Papéis iniciais previstos:
- **Comandante:** autoridade operacional da nave e gestão de permissões.
- **Piloto:** controles de voo e navegação conforme autorização.
- **Engenharia:** energia, propulsão, sistemas e reparos quando implementados.
- **Sensores/Navegação:** leitura de sensores, mapas e alvos disponíveis.
- **Armas/Defesa:** armamentos e sistemas defensivos autorizados.

As funções devem ser permissões configuráveis, não telas que concedem autoridade por si só. O servidor valida cada comando. Um jogador pode acumular funções quando a nave tiver poucos tripulantes. A interface de cada dispositivo mostra os painéis adequados ao papel ativo, sem duplicar o estado da nave.

## 7. Naves independentes, frotas e comboios

- Cada nave permanece uma entidade independente dentro do universo.
- Jogadores podem navegar, explorar e realizar atividades sem depender de uma equipe.
- Naves podem formar grupos temporários para expedições, escolta, mineração e combate.
- Um grupo de frota/convoy organiza formação, destino e comunicação, mas não funde as naves em uma única entidade.
- A perda de conexão de uma nave não deve derrubar as demais.
- As interações entre naves devem respeitar distância, visibilidade/relevância e regras do servidor.

## 8. Rede e transportes

### 8.1 Wi-Fi / rede local — primeiro transporte

Para a primeira versão local, usar conexão de rede local com descoberta de sessão e canal bidirecional de baixa latência, preferencialmente WebSocket sobre TCP.

Fluxo previsto:
1. Um dispositivo inicia uma sessão local e anuncia nome, versão e capacidade.
2. Outros dispositivos na mesma rede descobrem ou informam o endereço/código de conexão.
3. O anfitrião autentica/identifica os participantes da sessão e envia o estado inicial.
4. Os clientes enviam comandos e recebem atualizações do servidor local.

A descoberta automática pode ser limitada por isolamento de clientes do roteador ou permissões do Android; deve existir uma alternativa de conexão manual.

### 8.2 Bluetooth — transporte alternativo futuro

Bluetooth deve ser implementado como adaptador nativo Android, atrás da mesma interface de transporte. Não presumir que Bluetooth tenha a mesma largura de banda, alcance ou topologia do Wi-Fi.

Uso previsto: sessões pequenas e próximas, comandos e atualizações compactas. A camada deve lidar com pareamento, descoberta, reconexão, fragmentação, limites de payload e compatibilidade Android. O transporte Bluetooth não deve alterar as regras da simulação nem criar um protocolo de gameplay separado.

### 8.3 Internet / Server Principal

O servidor principal utiliza conexão pela internet com autenticação e serviço de sessão. A camada de transporte deve permitir WebSocket seguro (WSS) e reconexão. O protocolo de jogo deve ser independente do endereço físico do servidor.

### 8.4 Limites técnicos do Android

O Runtime JavaScript/Three.js dentro do WebView não deve ser tratado como servidor TCP de escuta nativo. Hospedagem local e Bluetooth podem exigir serviço/plugin nativo Capacitor/Android. Execução contínua em segundo plano, permissões, economia de bateria e encerramento do processo precisam ser considerados antes de prometer hospedagem persistente.

## 9. Sincronização e protocolo

O protocolo deve ser versionado e independente da renderização.

Mensagens conceituais:
- handshake e negociação de versão;
- autenticação/entrada na sessão;
- snapshot inicial do universo relevante;
- comandos/intents do jogador;
- confirmações ou rejeições de comandos;
- deltas de estado e eventos;
- presença, equipe, convites e tripulação;
- heartbeat, latência e reconexão;
- saída/encerramento de sessão.

Requisitos:
- IDs estáveis para jogadores, personagens, naves e entidades;
- sequência/timestamp de mensagens e proteção contra duplicidade;
- validação de tamanho e formato de payload;
- limites de frequência para comandos;
- snapshots periódicos e deltas incrementais;
- interpolação visual no cliente sem alterar o estado autoritativo;
- interesse espacial: enviar a cada cliente apenas entidades e eventos relevantes à sua região/sessão;
- reconexão com recuperação do estado atual, sem confiar cegamente em estado local antigo.

Não definir ainda frequência final de tick, tamanho máximo de universo ou número de jogadores sem benchmark no dispositivo e servidor-alvo.

## 10. Persistência e continuidade

Persistir separadamente:
- conta/identidade e personagens;
- inventário e progressão persistente;
- propriedade e configuração durável das naves;
- equipes, membros e permissões;
- estado durável de estações/bases, quando existir.

Manter transitórios na sessão:
- posição e velocidade em tempo real;
- conexões e latência;
- ocupação momentânea de assentos;
- comandos pendentes;
- estado temporário de combate.

O servidor deve definir checkpoints e recuperação após falha. Servidores locais podem ter persistência local limitada e devem informar ao jogador que a disponibilidade do mundo depende do anfitrião, até existir uma política de migração/backup.

## 11. Segurança e integridade

- Nunca confiar no cliente para propriedade, inventário, energia, dano, movimento ou resultados econômicos.
- Validar permissões no servidor para cada ação de tripulação/equipe.
- Usar tokens de sessão de curta duração e conexões seguras no servidor principal.
- Proteger códigos de equipe contra tentativa massiva e enumeração.
- Validar payloads, limitar frequência e rejeitar versões incompatíveis.
- Não expor credenciais nem segredos no bundle JavaScript ou APK.
- Registrar eventos importantes para diagnóstico e resolução de abuso.

## 12. Interfaces previstas

1. **Tela de personagem:** criar/selecionar personagem e identidade.
2. **Seletor de servidor:** Server Principal, Servidor Local e futuros servidores.
3. **Entrada em equipe:** inserir código, aceitar convite ou criar equipe.
4. **Painel social/equipe:** membros, convites, liderança e presença.
5. **Painel de tripulação:** vagas, papéis, permissões e jogadores embarcados.
6. **Painel de frota:** naves participantes, formação e objetivo compartilhado.
7. **Estado de conexão:** servidor, latência, transporte, reconexão e mensagens de erro.

A interface deve seguir a linguagem visual existente do Star Frontier, mas não deve ser conectada à gameplay antes de existirem contratos reais de sessão e dados.

## 13. Plano incremental de implementação

### Fase 0 — Fundação e contratos
- definir modelos de dados e IDs;
- definir interfaces de sessão, transporte e autoridade;
- definir ciclo de vida de conexão e erros;
- criar testes unitários dos contratos sem rede real.

### Fase 1 — Multiplayer local mínimo por Wi-Fi
- servidor local de sessão;
- descoberta/manual join;
- dois clientes conectados;
- sincronização de presença e estado mínimo;
- validação de reconexão e desconexão;
- teste em aparelhos Android reais.

### Fase 2 — Naves independentes
- cada jogador controla sua própria nave;
- estado autoritativo de movimento;
- sincronização de entidades próximas;
- persistência e recuperação de sessão.

### Fase 3 — Equipes e códigos
- criação/entrada por código;
- convites e permissões;
- membros independentes no mesmo universo.

### Fase 4 — Tripulação
- assentos e papéis;
- permissões por função;
- múltiplos clientes controlando subsistemas da mesma nave;
- desconexão e transferência segura de comando.

### Fase 5 — Frotas e atividades cooperativas
- grupos de naves;
- objetivos e operações compartilhadas;
- sensores, mineração, combate e logística em cooperação.

### Fase 6 — Server Principal e internet
- serviço dedicado;
- autenticação e persistência central;
- WSS, monitoramento, escalabilidade e regiões.

### Fase 7 — Bluetooth
- adaptador nativo Android;
- sessões pequenas e payloads compactos;
- testes de alcance, reconexão e consumo.

## 14. Critérios de aceitação do primeiro MVP

O primeiro MVP multiplayer só será considerado funcional quando:
1. dois dispositivos Android entrarem na mesma sessão Wi-Fi;
2. cada dispositivo mantiver um jogador distinto;
3. cada jogador puder controlar uma nave independente;
4. ambos receberem atualizações autoritativas do outro jogador/nave;
5. desconectar um cliente não encerrar a sessão do outro;
6. reconectar recuperar a sessão sem duplicar jogador ou nave;
7. a interface indicar claramente servidor e estado de conexão;
8. testes automatizados e testes manuais forem registrados.

Equipes por código, tripulação multiusuário, Server Principal e Bluetooth são etapas posteriores e não devem ser simuladas como se já estivessem operacionais.

## 15. Decisões preservadas

- O universo compartilhado é a unidade principal do multiplayer, não uma nave única.
- Naves independentes são o padrão de exploração.
- Uma equipe pode reunir jogadores sem obrigá-los a viajar juntos.
- Uma nave pode receber uma tripulação de vários usuários.
- Frotas agrupam naves independentes.
- Server Principal é o universo oficial compartilhado; servidores locais são sessões separadas.
- Wi-Fi é o primeiro transporte local; Bluetooth é alternativa posterior.
- Runtime coordena sessões e integração; C++/WASM mantém cálculos/simulação; Three.js renderiza cada cliente.
- Não duplicar a simulação nem permitir que o cliente seja autoridade sobre o universo.
- Nenhuma implementação deve remover ou alterar os sistemas de HUD, Refinaria, Defletor ou gameplay já existentes.

## 16. Fora do escopo desta especificação

Este documento não cria ainda:
- serviço online hospedado;
- autenticação real ou banco de contas;
- servidor WebSocket operacional;
- descoberta automática de dispositivos;
- plugin Bluetooth;
- sincronização de física em rede;
- sistema de convites/códigos funcional;
- persistência multiplayer de produção;
- APK multiplayer pronto.

Esses itens exigem implementação por fases, contratos testáveis, infraestrutura e validação em aparelhos reais.
