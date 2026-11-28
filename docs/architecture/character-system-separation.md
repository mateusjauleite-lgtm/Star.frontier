# Character System — separação de responsabilidades

## Decisão arquitetural

O personagem é uma entidade persistente e independente do ambiente. Nave, superfície planetária, estação e espaço livre são contextos conectáveis por adaptadores; nenhum deles possui ou recria a identidade do personagem.

## Limites de responsabilidade

- **Character Core:** identidade, saúde, energia, postura, equipamento e estado lógico.
- **Character Model / Animator / Audio:** representação, animação e apresentação; não decidem em qual mundo o personagem existe.
- **Character Controls:** captura de intenção (andar, olhar, correr, pular); não aplica física nem verifica colisão.
- **Character Physics:** integra velocidade e gravidade recebidas do ambiente; não conhece nave, Terra ou Lua.
- **Environment Router:** seleciona o adaptador ativo e encaminha movimento, atualização e consulta de contato.
- **Environment Adapter:** converte intenção e contato para o referencial do ambiente. Primeiros adaptadores: convés da nave e superfície planetária.
- **Character Session:** controla início, suspensão, retomada e encerramento da sessão sem resetar a identidade por efeito colateral.
- **Camera Controller:** acompanha o ator e recebe o referencial/orientação ativo; não é responsável por movimentá-lo.

## Contrato do adaptador

Cada adaptador declara `type` (`ship`, `planet-surface`, `station` ou `free-space`) e implementa:

- `attach(character, environment)`
- `detach(character, environment)`
- `move(character, input, deltaSeconds, environment)`
- `resolveGroundContact(position, character, environment)`
- `update(character, deltaSeconds, environment)` (opcional)

O `Environment Router` mantém apenas a ligação ativa. Ele não cria, destrói, teletransporta nem redefine o personagem.

## Regras de transição

1. Trocar de ambiente não troca a identidade do personagem.
2. O adaptador anterior é desligado antes da nova ligação; se a ativação falhar, a ligação anterior é restaurada.
3. Menu principal e pausa podem suspender a sessão, mas não podem chamar `characterCore.reset()` implicitamente.
4. Destruição/reset do personagem exige ação explícita e fica separada do encerramento de sessão.
5. Controles do personagem não compartilham estado de entrada com os controles de pilotagem.
6. A câmera segue o personagem através do referencial ativo; não define seu movimento.

## Migração incremental

### Etapa 1 — fundação (esta alteração)
Introduzir o contrato de ambiente, roteador e ciclo de sessão com testes unitários. Sem substituir ainda o fluxo de movimento legado.

### Etapa 2 — adaptador da nave
Mover para o adaptador de nave o movimento no convés, limites por deck, colisões internas, gravidade artificial e transições de elevador.

### Etapa 3 — adaptador planetário
Mover caminhada tangencial, contato ETOPO/DEM, plataforma BT-01, gravidade e alinhamento à superfície para o adaptador planetário. A posição da BT-01 e os referenciais existentes devem ser preservados.

### Etapa 4 — integração de controles e câmera
Manter controles de caminhada independentes dos controles de pilotagem e fazer a câmera consumir o referencial ativo, sem alterar a posição do ator.

### Etapa 5 — sessão e Runtime
Remover reinicializações implícitas do personagem em menu, pausa e troca de cena. Integrar os módulos ao Runtime e retirar do `main.js` as responsabilidades já migradas.

### Etapa 6 — validação
Testar caminhada nos quatro decks, elevadores, saída/retorno à nave, BT-01, terreno irregular, menu principal, pausa e retomada. Só então remover o fluxo antigo.

## Proteções

- Não alterar aceleração/velocidade de dobra, física orbital ou geometria da Aurora-7 como parte desta migração.
- Não alterar coordenadas da BT-01.
- Não substituir Blue Marble/ETOPO nem misturar a correção de textura da PR #84 com esta reforma.
- Não integrar a instrumentação da PR #86 como correção de movimento.
- Cada etapa deve permanecer isolada em PR revisável e com testes antes de avançar.


## Etapa 4 — integração de controles e HUD (continuação)
- O joystick de caminhada pertence exclusivamente a `characterControls`; seu vetor local nunca é gravado em `state.move`.
- O joystick de pilotagem pertence a `shipMovementControls`; somente ele escreve em `state.move`.
- `createGameplayControlModeController` define três modos explícitos: `on-foot-ship`, `on-foot-planet` e `piloting`, além de `inactive` para suspensão.
- A pé na nave ou no planeta, o HUD e os controles do personagem ficam ativos; em pilotagem, somente HUD e controles da nave ficam ativos.
- Toda transição limpa entradas e libera capturas de ponteiro antes de ativar o outro conjunto.
- A física/movimentação de ambiente ainda permanece no fluxo legado de `main.js`; esta etapa separa a captura de entrada e a ativação dos HUDs, sem afirmar que a migração dos adaptadores de física foi concluída.
