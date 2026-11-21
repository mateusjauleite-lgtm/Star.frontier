# Referências tecnológicas do Star.frontier

## Arquitetura adotada

A arquitetura de implementação do Star.frontier permanece:

- **Three.js:** camada visual 3D, geometria, naves, ambiente, hologramas e integração visual do HUD.
- **C++/WebAssembly:** física, cálculos e sistemas centrais de simulação.
- **JavaScript Runtime:** orquestração, integração dos sistemas e ciclo de gameplay.
- **HTML5, CSS e JavaScript:** interfaces, HUDs independentes, painéis de operação e interação.

## Godot Engine 4 — referência externa

Godot 4 fica registrado como referência técnica, não como motor adicional nem destino de migração.

Áreas para estudo e possível adaptação às tecnologias já adotadas:

- Shaders para hologramas, transparências e efeitos de energia.
- Materiais PBR, iluminação e reflexos metálicos.
- Renderizador Mobile e otimização para Android.
- Organização de cenas, nós e ferramentas de prototipagem.
- GDScript e C# como referências de linguagem e organização de lógica.

GDScript (sintaxe inspirada em Python) e C# podem ser estudados para comparar legibilidade, tipagem e organização de sistemas. Não serão introduzidos como dependências do Runtime sem uma decisão arquitetônica explícita.

## Regra de integração

Aproveitar técnicas e conceitos, não adicionar outro motor ao projeto. Qualquer solução inspirada no Godot deve ser reimplementada e validada na stack existente, priorizando compatibilidade com Three.js, C++/WASM, JavaScript e APK Android.

A referência não altera a decisão atual de arquitetura nem reabre a migração para Unreal Engine.
