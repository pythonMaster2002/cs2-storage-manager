<p align="center"><img src="../build/icon.png" width="120" alt="Caskit"></p>

<h1 align="center">Caskit</h1>

<p align="center"><b>Gestor gratuito y de código abierto de contenedores (Storage Unit) e inventario de CS2.</b><br>
Traslados rápidos, probabilidades de contratos, pegatinas, tienda, mercado y Steam Guard — para varias cuentas a la vez.<br>
Sin suscripciones ni servidores de terceros: todo funciona en tu ordenador y habla directamente con Steam.</p>

<p align="center">
<a href="https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest"><img src="https://img.shields.io/github/v/release/pythonMaster2002/cs2-storage-manager?label=descargar&color=2d73ff" alt="release"></a>
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
<b>Español</b> ·
<a href="README.pt.md">Português</a> ·
<a href="README.fr.md">Français</a> ·
<a href="README.pl.md">Polski</a> ·
<a href="README.tr.md">Türkçe</a> ·
<a href="README.zh.md">简体中文</a>
</p>

<p align="center"><img src="screenshots/demo.gif" alt="Caskit" width="900"></p>

> **¿Vienes de Casemove?** Su autor lo abandonó en favor de Skinledger — «Casemove 2.0», un servicio de pago: la versión gratuita solo mueve objetos; los traslados rápidos, las compras en la tienda, los contratos, el Armory, más cuentas, los intercambios y el mercado cuestan 9,99–24,99 $ al mes ([FAQ de Skinledger](https://skinledger.com/#frequently-asked-questions), [precios](https://skinledger.com/en/pricing-compare), octubre de 2026). Caskit hace todo eso **gratis**, sin cuentas en webs ajenas y con código abierto.

## Funciones

**Contenedores (Storage Unit)**
- Guarda y saca objetos de los contenedores en masa. La velocidad se ajusta sola a los límites de Steam (normalmente 8–13 objetos/s) y los objetos atascados se reintentan automáticamente.
- **Reglas de traslado**: «todas las cajas → Cases 01, Cases 02…», «pegatinas → Stickers». Con un clic o justo después de iniciar sesión.
- Renombra contenedores, oculta los llenos y exporta todo a JSON/CSV.

**Contratos de intercambio**
- Contratos con objetos del inventario *y* de los contenedores (se sacan automáticamente).
- Todos los resultados posibles con su **probabilidad**, el float de cada entrada y el **float previsto** del resultado en una barra de desgaste.
- Los objetos que el juego no acepta (el grado más alto de su colección) se marcan de antemano. Los recuerdos (souvenir) están soportados.
- Tras el contrato: **Inspeccionar en el juego** y **Ver en el Mercado de la Comunidad**.

**Pegatinas**
- Aplica, raspa y quita pegatinas, incluidas las de colocación libre de CS2.
- Float del arma con barra de desgaste, desgaste de las pegatinas, enlaces de inspección y enlace al objeto en tu inventario de Steam.

**Tienda de CS2 y Armory**
- Carrito, favoritos, saldo del monedero y saldo tras la compra. Cada pago lo confirmas tú.
- Armory: canjea estrellas por recompensas.
- Los nombres e iconos de los productos se actualizan solos desde los archivos del juego.

**Intercambios, Mercado y Steam Guard**
- Ofertas entrantes y salientes, aceptar/rechazar, aceptación automática de regalos.
- Anuncios, pedidos de compra, historial con búsqueda, venta con la comisión calculada.
- Un mini **SDA** integrado: códigos de Steam Guard para todas las cuentas con maFile, confirmaciones de intercambios y anuncios, control de proxies.

**Cuentas y privacidad**
- Varias cuentas a la vez, cada una con su proxy SOCKS5/HTTP.
- Inicia sesión con un **código QR** (aparece al instante), con usuario y contraseña o con un **maFile**.
- 10 idiomas, actualizaciones automáticas (versión con instalador).

## Capturas

| | |
|---|---|
| <img src="screenshots/tradeup.png" alt="trade-up"> | <img src="screenshots/craft.png" alt="result"> |
| **Contrato**: resultados, probabilidades, floats | **Resultado**: inspeccionar en el juego o abrir en el mercado |
| <img src="screenshots/stickers.png" alt="stickers"> | <img src="screenshots/store.png" alt="store"> |
| **Pegatinas**: aplicar, raspar, quitar | **Tienda de CS2**: carrito y monedero |
| <img src="screenshots/overview.png" alt="overview"> | <img src="screenshots/guard.png" alt="Steam Guard"> |
| **Resumen** de una o todas las cuentas | **Steam Guard**: códigos y confirmaciones |

## Descargar

La última versión está en **[Releases](https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest)**.

| Sistema | Archivo | |
|---|---|---|
| Windows | `Caskit-Setup-x.y.z.exe` | **recomendado** — se instala en segundos, sin permisos de administrador, se actualiza solo |
| Windows | `Caskit-x.y.z-portable.exe` | sin instalación (arranca más lento, actualización manual) |
| macOS | `Caskit-x.y.z-arm64.dmg` (Apple Silicon) / `Caskit-x.y.z-x64.dmg` (Intel) | |
| Linux | `Caskit-x.y.z-x86_64.AppImage` o `Caskit-x.y.z-amd64.deb` | |

**Primer inicio.** Las versiones aún no están firmadas, así que el sistema puede avisarte una vez:

- **Windows** («Windows protegió su PC»): **Más información → Ejecutar de todas formas**.
- **macOS** («la app está dañada» / «no se puede comprobar»): clic derecho en la app → **Abrir**, o en Terminal `xattr -cr "/Applications/Caskit.app"`.
- **Linux AppImage**: `chmod +x Caskit-*.AppImage` y ejecútalo.

### Desinstalar

- **Windows (instalador)**: Configuración → Aplicaciones → **Caskit** → Desinstalar. **Portable**: borra el `.exe`.
- **macOS**: arrastra **Caskit** de Aplicaciones a la Papelera.
- **Linux**: borra el AppImage o `sudo apt remove caskit` para el `.deb`.

Los inicios de sesión guardados y los ajustes quedan en la carpeta de datos (ver preguntas frecuentes); bórrala también para eliminarlo todo.

## Seguridad y privacidad

- Caskit solo habla con Steam (y con el Game Coordinator de CS2). Tu contraseña nunca se guarda; el refresh token y los secretos del maFile se guardan en tu disco **cifrados** por el sistema (Windows DPAPI / Llavero de macOS / libsecret en Linux).
- Si una cuenta tiene proxy, *todo* su tráfico pasa por él: peticiones web, código QR, avatar. Si el proxy falla, el inicio de sesión se detiene en lugar de ir directo.
- La API local solo escucha en `127.0.0.1` y exige un token aleatorio que solo conoce la ventana de la app.
- Los nombres e iconos se actualizan una vez al día desde copias públicas de los archivos del juego ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — sin enviar datos de cuentas.
- Sin analíticas ni telemetría. Lista completa de conexiones de red en la **[política de privacidad](../PRIVACY.md)** (en inglés).

## Preguntas frecuentes

**¿Puedo recibir un baneo VAC?** Caskit no toca el juego, sus archivos ni su memoria, y no inicia CS2. Inicia sesión como cliente de Steam y habla con el Game Coordinator de CS2 igual que el inventario del propio juego, así que VAC no interviene. Aun así es una herramienta no oficial: úsala bajo tu responsabilidad.

**¿Puedo jugar con Caskit abierto?** Si inicias CS2 en la misma cuenta, Steam mantiene solo una de las dos sesiones. Cierra antes la sesión de esa cuenta en Caskit.

**¿Dónde están mis datos?** Solo en tu ordenador: `%APPDATA%\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).

## Apoya el proyecto

Caskit es gratis y lo seguirá siendo. Si te ahorra tiempo:

- ☕ [Ko-fi](https://ko-fi.com/mikidjus) — tarjeta o PayPal
- 🎁 [Regala un skin](https://steamcommunity.com/tradeoffer/new/?partner=146040317&token=Q_pa1oMK) — cualquier caja o skin que te sobre
- 💎 Cripto (Binance Pay / USDT) — direcciones en la app: botón ♥
- ⭐ Una estrella al repositorio

## Compilar desde el código

Requiere Node.js 22+.

```bash
npm ci
npm start              # ejecutar
npm run build:win      # instalador + portable → dist/
npm run build:linux    # AppImage + deb
npm run build:mac      # dmg + zip (solo en macOS)
```

**Publicar**: sube `version` en `package.json` y luego `git tag vX.Y.Z && git push --tags`. GitHub Actions compila los tres sistemas y los publica en Releases; las copias instaladas se actualizan solas.

## Política de firma de código

Las versiones de Windows se compilan desde este repositorio con GitHub Actions y se firman mediante SignPath (gratis para código abierto, certificado de SignPath Foundation). Detalles: [Code signing policy](../README.md#code-signing-policy) (en inglés).

## Licencia

[MIT](../LICENSE)

Caskit es un proyecto independiente de código abierto, no afiliado ni respaldado por Valve Corporation. Counter-Strike, CS2 y Steam son marcas de Valve Corporation.
