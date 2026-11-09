# Star Frontier — Android APK (protótipo 0.1)

Este pacote transforma o protótipo web 3D anterior em um aplicativo Android instalável usando Capacitor. O jogo é empacotado dentro do APK; não precisa abrir o navegador separadamente. A renderização 3D ainda usa Three.js dentro da WebView do Android, portanto esta não é uma reimplementação nativa em Godot.

## Gerar APK no computador
Pré-requisitos: Node.js 22, Android Studio/Android SDK e JDK 21.

Na pasta do projeto:
```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
No Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s).
O APK de depuração fica em `android/app/build/outputs/apk/debug/app-debug.apk`.

## Gerar APK sem instalar Android Studio localmente (GitHub Actions)
1. Crie um repositório no GitHub.
2. Envie o conteúdo desta pasta para a branch `main`.
3. Abra a aba Actions e selecione `Build Android APK`.
4. Clique em `Run workflow` (ou aguarde o build após enviar os arquivos).
5. Quando terminar, abra a execução e baixe o artefato `star-frontier-debug-apk`.
6. Extraia o artefato e transfira `app-debug.apk` para o Android para instalar.

O workflow compila um APK de depuração. Para distribuição pública, será necessária uma chave de assinatura de release e configuração adicional.

## Limitações desta versão
- Login/senha/e-mail são apenas demonstração local. Não use senha real. Não existe recuperação real por e-mail nem autenticação segura.
- Dados ficam localmente no aparelho; não há servidor, multiplayer, chat ou economia compartilhada.
- História, combate completo, modelos finais, personagens customizáveis e interiores completos ainda não estão implementados.
- Loja usa créditos fictícios. Não há pagamentos.
- O projeto ainda depende do desempenho da WebView/Three.js; testar em vários aparelhos é necessário.

## Teste
Para testar no navegador antes de empacotar, use `npm run dev`. O produto de entrega deste pacote é o APK Android gerado pelo processo acima.
