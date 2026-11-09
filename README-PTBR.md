# STAR FRONTIER — Protótipo 0.1

## O que já funciona
- Login/cadastro local de demonstração (sem servidor; não use senha real).
- Perfil com nome e bandeira de país.
- Menu: iniciar, história (placeholder), personagem, naves, loja, configurações e sair.
- Cenário 3D com nave, campo de asteroides, estação, estrelas e escudo visual.
- Câmeras: 1ª pessoa, cabine (posição interna simplificada) e 3ª pessoa.
- Controles móveis separados: joystick esquerdo para movimento e direito para rotação/mira.
- Acelerador, freio, botão de mineração e interação.
- Minério, capacidade de carga, combustível, créditos e venda para NPC.
- Compra de broca reforçada e combustível.
- Preferências básicas salvas localmente.

## Limitações importantes
Esta é uma primeira versão de teste, não um MMO online:
- Login, senha e e-mail são apenas locais; não há autenticação segura nem recuperação real por e-mail.
- O perfil e o progresso ficam no armazenamento local do navegador/aplicativo.
- Não há servidor, banco online, chat, boletins enviados por administradores, multiplayer ou mercado entre jogadores.
- Combate, campanha, modelos finais de personagens/naves, interior detalhado e criação de itens são etapas futuras.
- A arte de menu é uma imagem conceitual de fundo, não uma tela funcional completa.
- A loja usa somente créditos fictícios do jogo. Não há dinheiro real ou compras integradas.

## Testar no navegador
A pasta precisa ser servida por um servidor HTTP local ou hospedagem estática (não abrir o index.html diretamente, pois usamos módulos JavaScript).
Uma opção: abrir o projeto no StackBlitz (https://stackblitz.com), criar um projeto HTML/Vite e copiar os arquivos desta pasta. Ou usar VS Code + extensão Live Server.

## Gerar APK Android com Capacitor
Pré-requisitos no computador:
- Node.js LTS
- Android Studio e Android SDK
- JDK compatível com a versão do Android Gradle Plugin instalada pelo Android Studio

No terminal, dentro da pasta do projeto:
1. Extraia o ZIP no computador e abra a pasta no terminal.
2. `npm install`
3. `npm install @capacitor/android`
4. `npm run build`
5. `npx cap add android`
6. `npx cap sync android`
7. `npx cap open android`

No Android Studio:
- Aguarde o Gradle sincronizar.
- Para teste: menu Build > Build Bundle(s) / APK(s) > Build APK(s).
- O APK de debug normalmente fica em `android/app/build/outputs/apk/debug/app-debug.apk`.
- Transfira o APK para o Android e abra-o para instalar. Talvez seja necessário autorizar a instalação desta fonte nas configurações do Android.
- Para distribuir publicamente, será necessário configurar assinatura de release e seguir as regras da loja.

Observação: para uma conversão Capacitor mais limpa, instale as dependências acima e mantenha `index.html`, `style.css`, `src/` e `assets/` no diretório web indicado. Se o Android Studio reclamar do diretório web, confirme que `webDir` está como `dist` no `capacitor.config.json`, rode `npm run build` e depois `npx cap sync android`.

## Próximas etapas recomendadas
1. Teste no navegador e anote travamentos, botões ou controles que não respondem.
2. Ajustar escala e posição dos HUDs para o seu celular.
3. Melhorar física de voo, colisão, danos e combate.
4. Modelos 3D finais, personagens, interiores e ferramentas de mineração modulares.
5. Backend real para contas, recuperação de senha, banco, boletins, suporte e economia compartilhada.
