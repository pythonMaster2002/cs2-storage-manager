## Caskit 1.1 — prices, portfolio and a better market

**Download:** `Caskit-Setup-1.1.0.exe` (Windows, recommended), `Caskit-1.1.0-portable.exe` (no install), `.dmg` for macOS (arm64 = Apple Silicon, x64 = Intel), `.AppImage` / `.deb` for Linux.

**What's new**
- **Inventory value**: what your inventory and storage units are worth (Steam 7-day average, Buff163 or Skinport, in your currency), a daily value chart, the most valuable items and the biggest movers. Shows up instantly from cache, then refreshes.
- **Portfolio (P&L)**: import your Steam Market history in the background, add purchases by hand or from CSV, fill missing prices with today's, edit any record — average buy price, unrealized and realized profit (FIFO).
- **Trade-ups**: expected value and chance to profit before crafting; after crafting — the real profit or loss, plus *View*, *Inspect in game* and *Market* buttons. Grid view with grouping by collection.
- **Item view like in game**: float to 10 digits, pattern seed, StatTrak™ counter, name tag, sticker wear.
- **Market**: works with the new Steam Community Market; buy orders and selling with the live order book and a 30-day price chart, your place in the queue; selling straight from storage units and from other games (Steam, Dota 2, TF2, Rust). Currencies without cents (UAH, KZT, JPY…) use whole amounts automatically.
- **Accounts and proxies**: pin and reorder accounts, a compact menu for many accounts, proxies managed in Settings (check, bulk-assign a list).
- **Streamer mode** (Ctrl+Shift+H): logins and nicknames become “Account 1, 2…”, balance hidden, Steam Guard codes, trade partners and proxies blurred; optionally hide all amounts too. The account bar now shows the login under the nickname.
- **Settings** redesigned; every “are you sure?” prompt can be turned off in one place.
- **Updates only with your consent**: Caskit asks before downloading, you can skip a version or turn checks off. You can also build Caskit yourself without the updater: `npm run build:win:noupdate`.
- Lots of fixes: sign-in crash after a network timeout, lost Steam ID during short disconnects, faster storage unit reading.

**First launch:** the builds are not code-signed yet. Windows may show “Windows protected your PC” → **More info → Run anyway**. macOS: right-click the app → **Open**.

---

### По-русски

- **Стоимость инвентаря**: сколько стоят инвентарь и ящики (средняя Steam за 7 дней, Buff163 или Skinport, в вашей валюте), график по дням, самое дорогое и главные изменения цен.
- **Портфель (P&L)**: фоновый импорт истории Торговой площадки, покупки вручную или из CSV, заполнение по текущим ценам, правка записей — средняя цена покупки, нереализованная и реализованная прибыль (FIFO).
- **Контракты**: ожидаемая стоимость и шанс окупиться до крафта; после крафта — настоящая прибыль или убыток и кнопки «Посмотреть», «Осмотреть в игре», «Торговая площадка».
- **Просмотр предмета как в игре**: float до 10 знаков, паттерн, StatTrak™, нейм-тег, износ наклеек.
- **Торговая площадка**: работает с новой ТП Steam; ордера со стаканом, графиком за 30 дней и местом в очереди; продажа прямо из ящиков и из других игр. Валюты без копеек (UAH, KZT, JPY…) — только целые суммы, автоматически.
- **Режим стримера** (Ctrl+Shift+H): вместо логинов и ников — «Аккаунт 1, 2…», баланс скрыт, коды Steam Guard, партнёры и прокси размыты; по желанию — и все суммы.
- **Аккаунты и прокси**: закрепление и порядок аккаунтов, прокси в настройках.
- **Обновления — только с вашего согласия**; можно собрать Caskit самому без обновлений: `npm run build:win:noupdate`.

**Первый запуск:** сборки пока без цифровой подписи. Windows может показать «Windows защитила ваш компьютер» → **Подробнее → Выполнить в любом случае**.
