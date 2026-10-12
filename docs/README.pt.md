<p align="center"><img src="../build/icon.png" width="120" alt="Caskit"></p>

<h1 align="center">Caskit</h1>

<p align="center"><b>Gerenciador gratuito e de código aberto de contêineres (Storage Unit) e inventário do CS2.</b><br>
Transferências rápidas, chances de contratos, adesivos, loja, mercado e Steam Guard — para várias contas ao mesmo tempo.<br>
Sem assinaturas nem servidores de terceiros: tudo roda no seu computador e fala direto com a Steam.</p>

<p align="center">
<a href="https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest"><img src="https://img.shields.io/github/v/release/pythonMaster2002/cs2-storage-manager?label=baixar&color=2d73ff" alt="release"></a>
<a href="https://github.com/pythonMaster2002/cs2-storage-manager/releases"><img src="https://img.shields.io/github/downloads/pythonMaster2002/cs2-storage-manager/total?color=06bfff" alt="downloads"></a>
<img src="https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-informational" alt="platforms">
<img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
<a href="https://ko-fi.com/mikidjus"><img src="https://img.shields.io/badge/Ko--fi-support-ff5e5b?logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
</p>

<p align="center">
<a href="../README.md">English</a> ·
<a href="README.ru.md">Русский</a> ·
<a href="README.uk.md">Українська</a> ·
<a href="README.de.md">Deutsch</a> ·
<a href="README.es.md">Español</a> ·
<b>Português</b> ·
<a href="README.fr.md">Français</a> ·
<a href="README.pl.md">Polski</a> ·
<a href="README.tr.md">Türkçe</a> ·
<a href="README.zh.md">简体中文</a>
</p>

<p align="center"><img src="screenshots/demo.gif" alt="Caskit" width="900"></p>

> **Vem do Casemove?** O próprio Casemove agora mostra um aviso: *«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»* ([fonte](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). O Skinledger é pago: a versão gratuita só move itens; transferências rápidas, compras na loja, contratos, Armory, mais contas, trocas e mercado custam US$ 9,99–24,99 por mês ([FAQ](https://skinledger.com/#frequently-asked-questions), [preços](https://skinledger.com/en/pricing-compare), outubro de 2026). O Caskit faz tudo isso **de graça**, sem conta em sites de terceiros — e com código aberto.

## Recursos

**Contêineres (Storage Unit)**
- Guarde e retire itens dos contêineres em massa. A velocidade se ajusta sozinha aos limites da Steam (normalmente 8–13 itens/s) e itens travados são reenviados automaticamente.
- **Regras de transferência**: «todas as caixas → Cases 01, Cases 02…», «adesivos → Stickers». Com um clique ou logo após o login.
- Renomeie contêineres, oculte os cheios e exporte tudo para JSON/CSV.

**Preços e portfólio**
- Quanto valem seu inventário e suas unidades de armazenamento — média de 7 dias da Steam, Buff163 ou Skinport, na sua moeda; um gráfico diário do valor e o que mais subiu ou caiu.
- **Portfólio (P&L)**: importe seu histórico do Mercado da Steam, adicione compras à mão ou por CSV — preço médio de compra, lucro não realizado e realizado (FIFO).
- Os preços vêm de listas públicas baixadas a cada 12 horas; seu inventário não é enviado para lugar nenhum.

**Contratos de troca**
- Contratos com itens do inventário *e* dos contêineres (retirados automaticamente).
- Todos os resultados possíveis com a **chance**, o float de cada entrada, o **float previsto** do resultado e o **valor esperado** comparado ao custo das entradas.
- Itens que o jogo não aceita (grau mais alto da coleção) são marcados antes. Lembranças (souvenir) são suportadas.
- Depois do contrato: **lucro ou prejuízo**, uma visualização detalhada do item, **Inspecionar no jogo** e **Mercado da Comunidade**.

**Adesivos**
- Aplique, raspe e remova adesivos — inclusive os de posicionamento livre do CS2.
- Visualização do item como no jogo: float com 10 casas, semente do padrão, contador StatTrak™, etiqueta de nome e desgaste dos adesivos; links para inspecionar e para o item no seu inventário Steam.

**Loja do CS2 e Armory**
- Carrinho, favoritos, saldo da carteira e saldo após a compra. Cada pagamento é confirmado por você.
- Armory: troque estrelas por recompensas.
- Nomes e ícones dos produtos se atualizam sozinhos a partir dos arquivos do jogo.

**Trocas, Mercado e Steam Guard**
- Ofertas recebidas e enviadas, aceitar/recusar, aceite automático de presentes.
- Mercado: anúncios, **ordens de compra com o livro de ofertas ao vivo e gráfico de preço de 30 dias**, histórico com busca, venda com a taxa calculada (inclusive direto das unidades). Moedas sem centavos (UAH, KZT, JPY…) são tratadas automaticamente.
- Um mini **SDA** embutido: códigos do Steam Guard para todas as contas com maFile, confirmações de trocas e anúncios, monitoramento de proxies.

**Contas e privacidade**
- Várias contas ao mesmo tempo, cada uma com seu proxy SOCKS5/HTTP — configure e teste nas Configurações ou cole uma lista inteira. Fixe e reordene as contas.
- Entre com **QR code** (aparece na hora), usuário e senha ou **maFile**.
- **Modo streamer** (Ctrl+Shift+H): logins e apelidos viram “Conta 1, 2…”, o saldo fica oculto, e códigos do Steam Guard, parceiros de troca e proxies ficam borrados — seguro para vídeos e capturas.
- 10 idiomas. Atualizações só com o seu consentimento — ou totalmente desligadas.

## Capturas de tela

| | |
|---|---|
| <img src="screenshots/overview.png" alt="overview"> | <img src="screenshots/portfolio.png" alt="portfolio"> |
| **Visão geral**: valor, gráfico, itens mais valiosos | **Portfólio**: lucro e prejuízo (FIFO) |
| <img src="screenshots/tradeup.png" alt="trade-up"> | <img src="screenshots/craft.png" alt="result"> |
| **Contrato**: resultados, chances, valor esperado | **Resultado**: lucro ou prejuízo, ver, inspecionar, mercado |
| <img src="screenshots/item.png" alt="item"> | <img src="screenshots/market.png" alt="buy order"> |
| **Item**: float, padrão, adesivos | **Ordem de compra**: livro de ofertas e gráfico |
| <img src="screenshots/stickers.png" alt="stickers"> | <img src="screenshots/store.png" alt="store"> |
| **Adesivos**: aplicar, raspar, remover | **Loja do CS2**: carrinho e carteira |
| <img src="screenshots/caskets.png" alt="storage units"> | <img src="screenshots/guard.png" alt="Steam Guard"> |
| **Unidades**: transferências em massa | **Steam Guard**: códigos e confirmações |

## Baixar

A versão mais recente está em **[Releases](https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest)**.

| Sistema | Arquivo | |
|---|---|---|
| Windows | `Caskit-Setup-x.y.z.exe` | **recomendado** — instala em segundos, sem permissão de administrador, atualiza sozinho |
| Windows | `Caskit-x.y.z-portable.exe` | sem instalação (abre mais devagar, atualização manual) |
| macOS | `Caskit-x.y.z-arm64.dmg` (Apple Silicon) / `Caskit-x.y.z-x64.dmg` (Intel) | |
| Linux | `Caskit-x.y.z-x86_64.AppImage` ou `Caskit-x.y.z-amd64.deb` | |

**Primeira execução.** As versões ainda não são assinadas, então o sistema pode avisar uma vez:

- **Windows** («O Windows protegeu o computador»): **Mais informações → Executar assim mesmo**.
- **macOS** («o app está danificado» / «não é possível verificar»): clique com o botão direito no app → **Abrir**, ou no Terminal `xattr -cr "/Applications/Caskit.app"`.
- **Linux AppImage**: `chmod +x Caskit-*.AppImage` e execute.

**VirusTotal**: cada versão é analisada automaticamente — os resultados e links ficam no fim de cada [página de versão](https://github.com/pythonMaster2002/cs2-storage-manager/releases).

### Desinstalar

- **Windows (instalador)**: Configurações → Aplicativos → **Caskit** → Desinstalar. **Portable**: apague o `.exe`.
- **macOS**: arraste o **Caskit** de Aplicativos para o Lixo.
- **Linux**: apague o AppImage ou `sudo apt remove caskit` para o `.deb`.

Os logins salvos e as configurações ficam na pasta de dados (veja as perguntas frequentes); apague-a também para remover tudo.

## Segurança e privacidade

- O Caskit fala apenas com a Steam (e com o Game Coordinator do CS2). Sua senha nunca é salva; o refresh token e os segredos do maFile ficam no seu disco **criptografados** pelo sistema (Windows DPAPI / Chaves do macOS / libsecret no Linux).
- Se uma conta tem proxy, *todo* o tráfego dela passa por ele — requisições web, QR code, avatar. Se o proxy cair, o login é interrompido em vez de ir direto.
- A API local escuta apenas em `127.0.0.1` e exige um token aleatório que só a janela do app conhece.
- Nomes e ícones são atualizados uma vez por dia a partir de cópias públicas dos arquivos do jogo ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — sem enviar dados de contas.
- Sem análises nem telemetria. Lista completa de conexões de rede na **[política de privacidade](../PRIVACY.md)** (em inglês).

## Perguntas frequentes

**Posso levar ban VAC?** O Caskit não mexe no jogo, nos arquivos nem na memória dele e não abre o CS2. Ele entra como cliente Steam e fala com o Game Coordinator do CS2 como o próprio inventário do jogo, então o VAC não participa. Ainda assim é uma ferramenta não oficial: use por sua conta e risco.

**Posso jogar com o Caskit aberto?** Se você abrir o CS2 na mesma conta, a Steam mantém só uma das duas sessões. Saia dessa conta no Caskit antes.

**As atualizações automáticas são seguras? Uma atualização pode me enganar?** O Caskit nunca baixa nem instala nada sozinho. Quando sai uma versão nova, ele pergunta antes — *Atualizar*, *Pular esta versão* ou *Agora não* — e em Configurações → Geral → Atualizações você pode escolher *Não verificar* para nem checar. As atualizações vêm só das [Releases](https://github.com/pythonMaster2002/cs2-storage-manager/releases) deste repositório: são compiladas pelo GitHub Actions a partir do código aberto ([workflow](../.github/workflows/release.yml)), analisadas no VirusTotal, e o instalador confere o SHA-512 de cada arquivo antes de instalar. A versão portable nunca se atualiza sozinha. Se não quiser confiar em nenhum binário — compile o Caskit você mesmo (abaixo).

**Posso compilar eu mesmo?** Sim — está tudo neste repositório, veja «Compilar a partir do código» abaixo. Os scripts `:noupdate` geram uma versão sem atualizações: ela nem pergunta ao GitHub sobre versões novas.

**Onde ficam meus dados?** Só no seu computador: `%APPDATA%\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).

## Apoie o projeto

O Caskit é gratuito e sempre será. Se ele economiza seu tempo:

- ☕ [Ko-fi](https://ko-fi.com/mikidjus) — cartão ou PayPal
- 🎁 [Envie uma skin](https://steamcommunity.com/tradeoffer/new/?partner=146040317&token=Q_pa1oMK) — qualquer caixa ou skin sobrando
- 💎 Cripto (Binance Pay / USDT) — endereços no app: botão ♥
- ⭐ Uma estrela no repositório

## Compilar a partir do código

Requer Node.js 22+ e Git.

```bash
git clone https://github.com/pythonMaster2002/cs2-storage-manager
cd cs2-storage-manager
npm ci
npm start                      # executar
npm run build:win              # instalador + portable → dist/
npm run build:linux            # AppImage + deb
npm run build:mac              # dmg + zip (só no macOS)

# o mesmo sem atualizações: sem verificações, nada é baixado
npm run build:win:noupdate
npm run build:linux:noupdate
npm run build:mac:noupdate
```

**Versão**: aumente `version` no `package.json`, depois `git tag vX.Y.Z && git push --tags`. O GitHub Actions compila os três sistemas, publica em Releases e analisa os `.exe` no VirusTotal (segredo `VT_API_KEY`); as cópias instaladas oferecem a atualização.

## Política de assinatura de código

As versões para Windows são compiladas a partir deste repositório no GitHub Actions. A assinatura está prevista via SignPath Foundation (gratuito para código aberto); o primeiro pedido ainda não foi aprovado, então por enquanto as versões não são assinadas. Detalhes: [Code signing policy](../README.md#code-signing-policy) (em inglês).

## Licença

[MIT](../LICENSE)

O Caskit é um projeto independente de código aberto, sem afiliação ou endosso da Valve Corporation. Counter-Strike, CS2 e Steam são marcas da Valve Corporation.
