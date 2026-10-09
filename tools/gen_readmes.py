#!/usr/bin/env python3
"""Переводы README: docs/README.<lang>.md из одного шаблона (структура как у README.md).
Запуск: python3 tools/gen_readmes.py"""
import os

REPO = 'https://github.com/pythonMaster2002/cs2-storage-manager'
LANGS = [('en', 'English', '../README.md'), ('ru', 'Русский', 'README.ru.md'), ('uk', 'Українська', 'README.uk.md'),
         ('de', 'Deutsch', 'README.de.md'), ('es', 'Español', 'README.es.md'), ('pt', 'Português', 'README.pt.md'),
         ('fr', 'Français', 'README.fr.md'), ('pl', 'Polski', 'README.pl.md'), ('tr', 'Türkçe', 'README.tr.md'),
         ('zh', '简体中文', 'README.zh.md')]

T = {
'ru': dict(
 tagline='Бесплатный менеджер ящиков (Storage Unit) и инвентаря CS2 с открытым кодом.',
 tagline2='Быстрая перекладка, шансы контрактов, наклейки, магазин, маркет и Steam Guard — сразу для нескольких аккаунтов.',
 tagline3='Без подписок и сторонних серверов: всё работает на вашем компьютере и общается напрямую со Steam.',
 download='скачать', features='Возможности',
 f_caskets='Ящики (Storage Unit)',
 f_caskets_1='Массовая перекладка в ящики и обратно. Скорость подбирается сама под ограничения Steam (обычно 8–13 предметов/с), застрявшие предметы переотправляются автоматически.',
 f_caskets_2='**Правила перекладки**: «все кейсы → Cases 01, Cases 02…», «наклейки → Stickers». По кнопке или сразу после входа.',
 f_caskets_3='Переименование ящиков, скрытие полных, экспорт всего в JSON/CSV.',
 f_tu='Контракты обмена',
 f_tu_1='Контракты из инвентаря *и* из ящиков (нужные предметы вынимаются сами).',
 f_tu_2='Все возможные исходы с **шансами**, float каждого входа и **прогноз float** результата на полосе износа.',
 f_tu_3='Предметы, которые игра не примет (самые редкие в своей коллекции), помечаются заранее. Сувениры поддерживаются.',
 f_tu_4='После крафта — **«Осмотреть в игре»** и **«На Торговой площадке»**.',
 f_st='Наклейки',
 f_st_1='Наклеить, соскоблить и удалить — в том числе наклейки со свободным размещением CS2.',
 f_st_2='Float оружия с полосой износа, износ наклеек, «осмотреть» и ссылка на предмет в инвентаре Steam.',
 f_store='Магазин CS2 и Armory',
 f_store_1='Корзина, избранное, баланс кошелька и остаток после покупки. Каждую оплату подтверждаете вы.',
 f_store_2='Armory: обмен звёзд на награды.',
 f_store_3='Названия и картинки товаров обновляются сами из файлов игры.',
 f_trade='Трейды, Торговая площадка и Steam Guard',
 f_trade_1='Входящие и исходящие обмены, принять/отклонить, автоприём подарков.',
 f_trade_2='Лоты, ордера на покупку, история с поиском, продажа с расчётом комиссии.',
 f_trade_3='Встроенный мини-**SDA**: коды Steam Guard для всех аккаунтов с maFile, подтверждения обменов и лотов, контроль прокси.',
 f_acc='Аккаунты и приватность',
 f_acc_1='Несколько аккаунтов одновременно, у каждого свой SOCKS5/HTTP-прокси.',
 f_acc_2='Вход по **QR-коду** (появляется сразу), по логину и паролю или через **maFile**.',
 f_acc_3='10 языков интерфейса, автообновления (версия с установщиком).',
 screens='Скриншоты',
 s_tu='**Контракт**: исходы, шансы, float', s_craft='**Итог**: осмотреть в игре или открыть на ТП',
 s_st='**Наклейки**: наклеить, соскоблить, удалить', s_store='**Магазин CS2**: корзина и кошелёк',
 s_ov='**Обзор** одного или всех аккаунтов', s_guard='**Steam Guard**: коды и подтверждения',
 dl='Скачать', dl_1='Последняя версия — на странице **[Releases]({repo}/releases/latest)**.',
 sys='Система', file='Файл',
 dl_setup='**рекомендуется** — ставится за пару секунд, без прав администратора, обновляется сам',
 dl_port='без установки (запускается медленнее, обновлять вручную)',
 dl_or='или',
 first='**Первый запуск.** Сборки пока без цифровой подписи, поэтому система может один раз предупредить:',
 first_win='**Windows** («Windows защитила ваш компьютер»): **Подробнее → Выполнить в любом случае**.',
 first_mac='**macOS** («приложение повреждено» / «не удаётся проверить»): правый клик по приложению → **Открыть** или в Терминале `xattr -cr "/Applications/Caskit.app"`.',
 first_lin='**Linux AppImage**: `chmod +x Caskit-*.AppImage`, затем запустить.',
 sec='Безопасность и приватность',
 sec_1='Caskit общается только со Steam (и Game Coordinator CS2). Пароль не сохраняется; refresh token и секреты maFile хранятся у вас на диске **зашифрованными** средствами системы (Windows DPAPI / связка ключей macOS / libsecret в Linux).',
 sec_2='Если у аккаунта задан прокси, через него идёт *весь* трафик аккаунта — веб-запросы, QR-код, аватар. Если прокси не работает, вход прерывается, а не идёт напрямую.',
 sec_3='Локальный API слушает только `127.0.0.1` и требует случайный токен, известный лишь окну приложения.',
 sec_4='Названия и иконки предметов раз в сутки обновляются из публичных копий файлов игры ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — данные аккаунтов не отправляются.',
 faq='Вопросы',
 faq_1='**Можно ли получить VAC-бан?** Caskit не трогает игру, её файлы и память и не запускает CS2. Он входит как клиент Steam и общается с Game Coordinator CS2 так же, как инвентарь самой игры, — VAC здесь не участвует. Но это неофициальный инструмент, используйте на свой риск.',
 faq_2='**Можно ли играть, пока открыт Caskit?** Если запустить CS2 на том же аккаунте, Steam оставит только одну из двух сессий. Сначала выйдите из этого аккаунта в Caskit.',
 faq_3='**Где хранятся данные?** Только на вашем компьютере: `%APPDATA%\\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).',
 sup='Поддержать проект', sup_1='Caskit бесплатный и останется таким. Если он экономит вам время:',
 sup_kofi='картой или PayPal', sup_skin='Подарить скин', sup_skin2='любой лишний кейс или скин',
 sup_crypto='Крипта (Binance Pay / USDT) — адреса в приложении: кнопка ♥', sup_star='Звезда репозиторию',
 build='Сборка из исходников', build_1='Нужен Node.js 22+.',
 c_run='запуск', c_win='установщик + portable → dist/', c_mac='dmg + zip (только на macOS)',
 rel='**Релиз**: поднимите `version` в `package.json`, затем `git tag vX.Y.Z && git push --tags`. GitHub Actions соберёт все три системы и выложит их в Releases; установленные копии обновятся сами.',
 lic='Лицензия',
 disc='Caskit — независимый проект с открытым кодом. Не связан с Valve Corporation и не одобрен ею. Counter-Strike, CS2 и Steam — товарные знаки Valve Corporation.',
 shots='_ru',
),
'uk': dict(
 tagline='Безкоштовний менеджер сховищ (Storage Unit) та інвентаря CS2 з відкритим кодом.',
 tagline2='Швидке перекладання, шанси контрактів, наліпки, магазин, маркет і Steam Guard — одразу для кількох акаунтів.',
 tagline3='Без підписок і сторонніх серверів: усе працює на вашому комп’ютері й спілкується безпосередньо зі Steam.',
 download='завантажити', features='Можливості',
 f_caskets='Сховища (Storage Unit)',
 f_caskets_1='Масове перекладання у сховища й назад. Швидкість підлаштовується під обмеження Steam (зазвичай 8–13 предметів/с), застряглі предмети надсилаються повторно автоматично.',
 f_caskets_2='**Правила перекладання**: «усі кейси → Cases 01, Cases 02…», «наліпки → Stickers». Кнопкою або одразу після входу.',
 f_caskets_3='Перейменування сховищ, приховування повних, експорт усього в JSON/CSV.',
 f_tu='Контракти обміну',
 f_tu_1='Контракти з інвентаря *і* зі сховищ (потрібні предмети виймаються самі).',
 f_tu_2='Усі можливі результати з **шансами**, float кожного входу та **прогноз float** результату на смузі зносу.',
 f_tu_3='Предмети, які гра не прийме (найрідкісніші у своїй колекції), позначаються заздалегідь. Сувеніри підтримуються.',
 f_tu_4='Після крафту — **«Оглянути в грі»** і **«На Торговому майданчику»**.',
 f_st='Наліпки',
 f_st_1='Наклеїти, зішкребти та видалити — зокрема наліпки з вільним розміщенням CS2.',
 f_st_2='Float зброї зі смугою зносу, знос наліпок, «оглянути» та посилання на предмет в інвентарі Steam.',
 f_store='Магазин CS2 та Armory',
 f_store_1='Кошик, обране, баланс гаманця та залишок після покупки. Кожну оплату підтверджуєте ви.',
 f_store_2='Armory: обмін зірок на нагороди.',
 f_store_3='Назви та зображення товарів оновлюються самі з файлів гри.',
 f_trade='Обміни, Торговий майданчик і Steam Guard',
 f_trade_1='Вхідні та вихідні обміни, прийняти/відхилити, автоприйом подарунків.',
 f_trade_2='Лоти, ордери на купівлю, історія з пошуком, продаж із розрахунком комісії.',
 f_trade_3='Вбудований міні-**SDA**: коди Steam Guard для всіх акаунтів з maFile, підтвердження обмінів і лотів, контроль проксі.',
 f_acc='Акаунти й приватність',
 f_acc_1='Кілька акаунтів одночасно, у кожного свій SOCKS5/HTTP-проксі.',
 f_acc_2='Вхід за **QR-кодом** (з’являється одразу), логіном і паролем або через **maFile**.',
 f_acc_3='10 мов інтерфейсу, автооновлення (версія з інсталятором).',
 screens='Знімки екрана',
 s_tu='**Контракт**: результати, шанси, float', s_craft='**Підсумок**: оглянути в грі або відкрити на ТМ',
 s_st='**Наліпки**: наклеїти, зішкребти, видалити', s_store='**Магазин CS2**: кошик і гаманець',
 s_ov='**Огляд** одного або всіх акаунтів', s_guard='**Steam Guard**: коди й підтвердження',
 dl='Завантажити', dl_1='Остання версія — на сторінці **[Releases]({repo}/releases/latest)**.',
 sys='Система', file='Файл',
 dl_setup='**рекомендовано** — встановлюється за кілька секунд, без прав адміністратора, оновлюється сам',
 dl_port='без встановлення (запускається повільніше, оновлювати вручну)',
 dl_or='або',
 first='**Перший запуск.** Збірки поки без цифрового підпису, тож система може один раз попередити:',
 first_win='**Windows** («Windows захистила ваш ПК»): **Докладніше → Усе одно запустити**.',
 first_mac='**macOS** («програму пошкоджено» / «неможливо перевірити»): правий клік по програмі → **Відкрити** або в Терміналі `xattr -cr "/Applications/Caskit.app"`.',
 first_lin='**Linux AppImage**: `chmod +x Caskit-*.AppImage`, потім запустити.',
 sec='Безпека й приватність',
 sec_1='Caskit спілкується лише зі Steam (і Game Coordinator CS2). Пароль не зберігається; refresh token і секрети maFile зберігаються на вашому диску **зашифрованими** засобами системи (Windows DPAPI / зв’язка ключів macOS / libsecret у Linux).',
 sec_2='Якщо в акаунта задано проксі, через нього йде *весь* трафік акаунта — веб-запити, QR-код, аватар. Якщо проксі не працює, вхід переривається, а не йде напряму.',
 sec_3='Локальний API слухає лише `127.0.0.1` і вимагає випадковий токен, відомий тільки вікну програми.',
 sec_4='Назви та іконки предметів раз на добу оновлюються з публічних копій файлів гри ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — дані акаунтів не надсилаються.',
 faq='Питання',
 faq_1='**Чи можна отримати VAC-бан?** Caskit не чіпає гру, її файли й пам’ять і не запускає CS2. Він входить як клієнт Steam і спілкується з Game Coordinator CS2 так само, як інвентар самої гри, — VAC тут не задіяний. Але це неофіційний інструмент, використовуйте на свій ризик.',
 faq_2='**Чи можна грати, поки відкритий Caskit?** Якщо запустити CS2 на тому ж акаунті, Steam залишить лише одну з двох сесій. Спершу вийдіть із цього акаунта в Caskit.',
 faq_3='**Де зберігаються дані?** Лише на вашому комп’ютері: `%APPDATA%\\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).',
 sup='Підтримати проєкт', sup_1='Caskit безкоштовний і таким залишиться. Якщо він заощаджує вам час:',
 sup_kofi='карткою або PayPal', sup_skin='Подарувати скін', sup_skin2='будь-який зайвий кейс чи скін',
 sup_crypto='Крипта (Binance Pay / USDT) — адреси в програмі: кнопка ♥', sup_star='Зірка репозиторію',
 build='Збирання з вихідного коду', build_1='Потрібен Node.js 22+.',
 c_run='запуск', c_win='інсталятор + portable → dist/', c_mac='dmg + zip (лише на macOS)',
 rel='**Реліз**: підніміть `version` у `package.json`, потім `git tag vX.Y.Z && git push --tags`. GitHub Actions збере всі три системи й викладе їх у Releases; встановлені копії оновляться самі.',
 lic='Ліцензія',
 disc='Caskit — незалежний проєкт із відкритим кодом. Не пов’язаний з Valve Corporation і не схвалений нею. Counter-Strike, CS2 і Steam — торговельні марки Valve Corporation.',
 shots='',
),
'de': dict(
 tagline='Kostenloser Open-Source-Manager für CS2-Lagereinheiten und Inventar.',
 tagline2='Schnelles Umlagern, Trade-up-Chancen, Sticker, Shop, Markt und Steam Guard — für mehrere Konten gleichzeitig.',
 tagline3='Keine Abos, keine Fremdserver: Alles läuft auf deinem Rechner und spricht direkt mit Steam.',
 download='Download', features='Funktionen',
 f_caskets='Lagereinheiten',
 f_caskets_1='Gegenstände massenhaft ein- und auslagern. Das Tempo passt sich den Steam-Limits an (meist 8–13 Gegenstände/s), hängende Gegenstände werden automatisch erneut gesendet.',
 f_caskets_2='**Umlagerungsregeln**: „alle Kisten → Cases 01, Cases 02…“, „Sticker → Stickers“. Per Klick oder direkt nach dem Anmelden.',
 f_caskets_3='Einheiten umbenennen, volle ausblenden, alles als JSON/CSV exportieren.',
 f_tu='Tauschverträge (Trade-ups)',
 f_tu_1='Verträge aus dem Inventar *und* aus Lagereinheiten (Gegenstände werden automatisch herausgenommen).',
 f_tu_2='Alle möglichen Ergebnisse mit **Chance**, Float jeder Eingabe und **erwartetem Float** des Ergebnisses auf einer Abnutzungsleiste.',
 f_tu_3='Gegenstände, die das Spiel nicht annimmt (höchste Stufe ihrer Kollektion), werden vorab markiert. Souvenirs werden unterstützt.',
 f_tu_4='Nach dem Vertrag: **Im Spiel ansehen** und **Auf dem Community-Markt**.',
 f_st='Sticker',
 f_st_1='Sticker anbringen, abkratzen und entfernen — auch frei platzierte CS2-Sticker.',
 f_st_2='Waffen-Float mit Abnutzungsleiste, Sticker-Abnutzung, Inspektionslinks und Link zum Gegenstand im Steam-Inventar.',
 f_store='CS2-Shop und Armory',
 f_store_1='Warenkorb, Favoriten, Guthaben und Restguthaben nach dem Kauf. Jede Zahlung bestätigst du selbst.',
 f_store_2='Armory: Sterne gegen Belohnungen einlösen.',
 f_store_3='Namen und Bilder der Artikel aktualisieren sich selbst aus den Spieldateien.',
 f_trade='Tausch, Community-Markt und Steam Guard',
 f_trade_1='Eingehende und ausgehende Angebote, annehmen/ablehnen, Geschenke automatisch annehmen.',
 f_trade_2='Angebote, Kaufaufträge, durchsuchbarer Verlauf, Verkauf mit berechneter Gebühr.',
 f_trade_3='Eingebauter Mini-**SDA**: Steam-Guard-Codes für alle Konten mit maFile, Bestätigungen für Tausch und Angebote, Proxy-Überwachung.',
 f_acc='Konten und Privatsphäre',
 f_acc_1='Mehrere Konten gleichzeitig, jedes mit eigenem SOCKS5/HTTP-Proxy.',
 f_acc_2='Anmeldung per **QR-Code** (erscheint sofort), Login und Passwort oder **maFile**.',
 f_acc_3='10 Sprachen, automatische Updates (Installer-Version).',
 screens='Screenshots',
 s_tu='**Trade-up**: Ergebnisse, Chancen, Floats', s_craft='**Ergebnis**: im Spiel ansehen oder auf dem Markt öffnen',
 s_st='**Sticker**: anbringen, abkratzen, entfernen', s_store='**CS2-Shop**: Warenkorb und Guthaben',
 s_ov='**Übersicht** eines oder aller Konten', s_guard='**Steam Guard**: Codes und Bestätigungen',
 dl='Download', dl_1='Die neueste Version gibt es unter **[Releases]({repo}/releases/latest)**.',
 sys='System', file='Datei',
 dl_setup='**empfohlen** — in Sekunden installiert, ohne Adminrechte, aktualisiert sich selbst',
 dl_port='ohne Installation (startet langsamer, manuell aktualisieren)',
 dl_or='oder',
 first='**Erster Start.** Die Builds sind noch nicht signiert, daher warnt das System eventuell einmal:',
 first_win='**Windows** („Der Computer wurde durch Windows geschützt“): **Weitere Informationen → Trotzdem ausführen**.',
 first_mac='**macOS** („App ist beschädigt“ / „kann nicht überprüft werden“): Rechtsklick auf die App → **Öffnen** oder im Terminal `xattr -cr "/Applications/Caskit.app"`.',
 first_lin='**Linux AppImage**: `chmod +x Caskit-*.AppImage`, dann starten.',
 sec='Sicherheit und Privatsphäre',
 sec_1='Caskit spricht nur mit Steam (und dem CS2 Game Coordinator). Dein Passwort wird nie gespeichert; Refresh-Token und maFile-Geheimnisse liegen **verschlüsselt** durch das System auf deiner Festplatte (Windows DPAPI / macOS-Schlüsselbund / libsecret unter Linux).',
 sec_2='Hat ein Konto einen Proxy, läuft *der gesamte* Verkehr darüber — Webanfragen, QR-Code, Avatar. Fällt der Proxy aus, bricht die Anmeldung ab, statt direkt zu verbinden.',
 sec_3='Die lokale API lauscht nur auf `127.0.0.1` und verlangt ein zufälliges Token, das nur das App-Fenster kennt.',
 sec_4='Namen und Icons werden einmal täglich aus öffentlichen Kopien der Spieldateien aktualisiert ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — ohne Kontodaten.',
 faq='FAQ',
 faq_1='**Kann ich dafür einen VAC-Bann bekommen?** Caskit greift weder auf das Spiel noch auf dessen Dateien oder Speicher zu und startet CS2 nicht. Es meldet sich als Steam-Client an und spricht mit dem CS2 Game Coordinator wie das Inventar des Spiels selbst — VAC ist nicht beteiligt. Es bleibt ein inoffizielles Tool, Nutzung auf eigenes Risiko.',
 faq_2='**Kann ich spielen, während Caskit offen ist?** Startest du CS2 auf demselben Konto, behält Steam nur eine der beiden Sitzungen. Melde das Konto vorher in Caskit ab.',
 faq_3='**Wo liegen meine Daten?** Nur auf deinem Rechner: `%APPDATA%\\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).',
 sup='Projekt unterstützen', sup_1='Caskit ist kostenlos und bleibt es. Wenn es dir Zeit spart:',
 sup_kofi='Karte oder PayPal', sup_skin='Skin schenken', sup_skin2='jede übrige Kiste oder jeder Skin',
 sup_crypto='Krypto (Binance Pay / USDT) — Adressen in der App: ♥-Button', sup_star='Stern für das Repository',
 build='Aus dem Quellcode bauen', build_1='Benötigt Node.js 22+.',
 c_run='starten', c_win='Installer + Portable → dist/', c_mac='dmg + zip (nur unter macOS)',
 rel='**Release**: `version` in `package.json` erhöhen, dann `git tag vX.Y.Z && git push --tags`. GitHub Actions baut alle drei Systeme und veröffentlicht sie unter Releases; installierte Kopien aktualisieren sich selbst.',
 lic='Lizenz',
 disc='Caskit ist ein unabhängiges Open-Source-Projekt, nicht mit Valve Corporation verbunden oder von ihr unterstützt. Counter-Strike, CS2 und Steam sind Marken der Valve Corporation.',
 shots='',
),
'es': dict(
 tagline='Gestor gratuito y de código abierto de contenedores (Storage Unit) e inventario de CS2.',
 tagline2='Traslados rápidos, probabilidades de contratos, pegatinas, tienda, mercado y Steam Guard — para varias cuentas a la vez.',
 tagline3='Sin suscripciones ni servidores de terceros: todo funciona en tu ordenador y habla directamente con Steam.',
 download='descargar', features='Funciones',
 f_caskets='Contenedores (Storage Unit)',
 f_caskets_1='Guarda y saca objetos de los contenedores en masa. La velocidad se ajusta sola a los límites de Steam (normalmente 8–13 objetos/s) y los objetos atascados se reintentan automáticamente.',
 f_caskets_2='**Reglas de traslado**: «todas las cajas → Cases 01, Cases 02…», «pegatinas → Stickers». Con un clic o justo después de iniciar sesión.',
 f_caskets_3='Renombra contenedores, oculta los llenos y exporta todo a JSON/CSV.',
 f_tu='Contratos de intercambio',
 f_tu_1='Contratos con objetos del inventario *y* de los contenedores (se sacan automáticamente).',
 f_tu_2='Todos los resultados posibles con su **probabilidad**, el float de cada entrada y el **float previsto** del resultado en una barra de desgaste.',
 f_tu_3='Los objetos que el juego no acepta (el grado más alto de su colección) se marcan de antemano. Los recuerdos (souvenir) están soportados.',
 f_tu_4='Tras el contrato: **Inspeccionar en el juego** y **Ver en el Mercado de la Comunidad**.',
 f_st='Pegatinas',
 f_st_1='Aplica, raspa y quita pegatinas, incluidas las de colocación libre de CS2.',
 f_st_2='Float del arma con barra de desgaste, desgaste de las pegatinas, enlaces de inspección y enlace al objeto en tu inventario de Steam.',
 f_store='Tienda de CS2 y Armory',
 f_store_1='Carrito, favoritos, saldo del monedero y saldo tras la compra. Cada pago lo confirmas tú.',
 f_store_2='Armory: canjea estrellas por recompensas.',
 f_store_3='Los nombres e iconos de los productos se actualizan solos desde los archivos del juego.',
 f_trade='Intercambios, Mercado y Steam Guard',
 f_trade_1='Ofertas entrantes y salientes, aceptar/rechazar, aceptación automática de regalos.',
 f_trade_2='Anuncios, pedidos de compra, historial con búsqueda, venta con la comisión calculada.',
 f_trade_3='Un mini **SDA** integrado: códigos de Steam Guard para todas las cuentas con maFile, confirmaciones de intercambios y anuncios, control de proxies.',
 f_acc='Cuentas y privacidad',
 f_acc_1='Varias cuentas a la vez, cada una con su proxy SOCKS5/HTTP.',
 f_acc_2='Inicia sesión con un **código QR** (aparece al instante), con usuario y contraseña o con un **maFile**.',
 f_acc_3='10 idiomas, actualizaciones automáticas (versión con instalador).',
 screens='Capturas',
 s_tu='**Contrato**: resultados, probabilidades, floats', s_craft='**Resultado**: inspeccionar en el juego o abrir en el mercado',
 s_st='**Pegatinas**: aplicar, raspar, quitar', s_store='**Tienda de CS2**: carrito y monedero',
 s_ov='**Resumen** de una o todas las cuentas', s_guard='**Steam Guard**: códigos y confirmaciones',
 dl='Descargar', dl_1='La última versión está en **[Releases]({repo}/releases/latest)**.',
 sys='Sistema', file='Archivo',
 dl_setup='**recomendado** — se instala en segundos, sin permisos de administrador, se actualiza solo',
 dl_port='sin instalación (arranca más lento, actualización manual)',
 dl_or='o',
 first='**Primer inicio.** Las versiones aún no están firmadas, así que el sistema puede avisarte una vez:',
 first_win='**Windows** («Windows protegió su PC»): **Más información → Ejecutar de todas formas**.',
 first_mac='**macOS** («la app está dañada» / «no se puede comprobar»): clic derecho en la app → **Abrir**, o en Terminal `xattr -cr "/Applications/Caskit.app"`.',
 first_lin='**Linux AppImage**: `chmod +x Caskit-*.AppImage` y ejecútalo.',
 sec='Seguridad y privacidad',
 sec_1='Caskit solo habla con Steam (y con el Game Coordinator de CS2). Tu contraseña nunca se guarda; el refresh token y los secretos del maFile se guardan en tu disco **cifrados** por el sistema (Windows DPAPI / Llavero de macOS / libsecret en Linux).',
 sec_2='Si una cuenta tiene proxy, *todo* su tráfico pasa por él: peticiones web, código QR, avatar. Si el proxy falla, el inicio de sesión se detiene en lugar de ir directo.',
 sec_3='La API local solo escucha en `127.0.0.1` y exige un token aleatorio que solo conoce la ventana de la app.',
 sec_4='Los nombres e iconos se actualizan una vez al día desde copias públicas de los archivos del juego ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — sin enviar datos de cuentas.',
 faq='Preguntas frecuentes',
 faq_1='**¿Puedo recibir un baneo VAC?** Caskit no toca el juego, sus archivos ni su memoria, y no inicia CS2. Inicia sesión como cliente de Steam y habla con el Game Coordinator de CS2 igual que el inventario del propio juego, así que VAC no interviene. Aun así es una herramienta no oficial: úsala bajo tu responsabilidad.',
 faq_2='**¿Puedo jugar con Caskit abierto?** Si inicias CS2 en la misma cuenta, Steam mantiene solo una de las dos sesiones. Cierra antes la sesión de esa cuenta en Caskit.',
 faq_3='**¿Dónde están mis datos?** Solo en tu ordenador: `%APPDATA%\\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).',
 sup='Apoya el proyecto', sup_1='Caskit es gratis y lo seguirá siendo. Si te ahorra tiempo:',
 sup_kofi='tarjeta o PayPal', sup_skin='Regala un skin', sup_skin2='cualquier caja o skin que te sobre',
 sup_crypto='Cripto (Binance Pay / USDT) — direcciones en la app: botón ♥', sup_star='Una estrella al repositorio',
 build='Compilar desde el código', build_1='Requiere Node.js 22+.',
 c_run='ejecutar', c_win='instalador + portable → dist/', c_mac='dmg + zip (solo en macOS)',
 rel='**Publicar**: sube `version` en `package.json` y luego `git tag vX.Y.Z && git push --tags`. GitHub Actions compila los tres sistemas y los publica en Releases; las copias instaladas se actualizan solas.',
 lic='Licencia',
 disc='Caskit es un proyecto independiente de código abierto, no afiliado ni respaldado por Valve Corporation. Counter-Strike, CS2 y Steam son marcas de Valve Corporation.',
 shots='',
),
'pt': dict(
 tagline='Gerenciador gratuito e de código aberto de contêineres (Storage Unit) e inventário do CS2.',
 tagline2='Transferências rápidas, chances de contratos, adesivos, loja, mercado e Steam Guard — para várias contas ao mesmo tempo.',
 tagline3='Sem assinaturas nem servidores de terceiros: tudo roda no seu computador e fala direto com a Steam.',
 download='baixar', features='Recursos',
 f_caskets='Contêineres (Storage Unit)',
 f_caskets_1='Guarde e retire itens dos contêineres em massa. A velocidade se ajusta sozinha aos limites da Steam (normalmente 8–13 itens/s) e itens travados são reenviados automaticamente.',
 f_caskets_2='**Regras de transferência**: «todas as caixas → Cases 01, Cases 02…», «adesivos → Stickers». Com um clique ou logo após o login.',
 f_caskets_3='Renomeie contêineres, oculte os cheios e exporte tudo para JSON/CSV.',
 f_tu='Contratos de troca',
 f_tu_1='Contratos com itens do inventário *e* dos contêineres (retirados automaticamente).',
 f_tu_2='Todos os resultados possíveis com a **chance**, o float de cada entrada e o **float previsto** do resultado numa barra de desgaste.',
 f_tu_3='Itens que o jogo não aceita (grau mais alto da coleção) são marcados antes. Lembranças (souvenir) são suportadas.',
 f_tu_4='Depois do contrato: **Inspecionar no jogo** e **Ver no Mercado da Comunidade**.',
 f_st='Adesivos',
 f_st_1='Aplique, raspe e remova adesivos — inclusive os de posicionamento livre do CS2.',
 f_st_2='Float da arma com barra de desgaste, desgaste dos adesivos, links de inspeção e link para o item no inventário Steam.',
 f_store='Loja do CS2 e Armory',
 f_store_1='Carrinho, favoritos, saldo da carteira e saldo após a compra. Cada pagamento é confirmado por você.',
 f_store_2='Armory: troque estrelas por recompensas.',
 f_store_3='Nomes e ícones dos produtos se atualizam sozinhos a partir dos arquivos do jogo.',
 f_trade='Trocas, Mercado e Steam Guard',
 f_trade_1='Ofertas recebidas e enviadas, aceitar/recusar, aceite automático de presentes.',
 f_trade_2='Anúncios, ordens de compra, histórico com busca, venda com a taxa calculada.',
 f_trade_3='Um mini **SDA** embutido: códigos do Steam Guard para todas as contas com maFile, confirmações de trocas e anúncios, monitoramento de proxies.',
 f_acc='Contas e privacidade',
 f_acc_1='Várias contas ao mesmo tempo, cada uma com seu proxy SOCKS5/HTTP.',
 f_acc_2='Entre com **QR code** (aparece na hora), usuário e senha ou **maFile**.',
 f_acc_3='10 idiomas, atualizações automáticas (versão com instalador).',
 screens='Capturas de tela',
 s_tu='**Contrato**: resultados, chances, floats', s_craft='**Resultado**: inspecionar no jogo ou abrir no mercado',
 s_st='**Adesivos**: aplicar, raspar, remover', s_store='**Loja do CS2**: carrinho e carteira',
 s_ov='**Visão geral** de uma ou de todas as contas', s_guard='**Steam Guard**: códigos e confirmações',
 dl='Baixar', dl_1='A versão mais recente está em **[Releases]({repo}/releases/latest)**.',
 sys='Sistema', file='Arquivo',
 dl_setup='**recomendado** — instala em segundos, sem permissão de administrador, atualiza sozinho',
 dl_port='sem instalação (abre mais devagar, atualização manual)',
 dl_or='ou',
 first='**Primeira execução.** As versões ainda não são assinadas, então o sistema pode avisar uma vez:',
 first_win='**Windows** («O Windows protegeu o computador»): **Mais informações → Executar assim mesmo**.',
 first_mac='**macOS** («o app está danificado» / «não é possível verificar»): clique com o botão direito no app → **Abrir**, ou no Terminal `xattr -cr "/Applications/Caskit.app"`.',
 first_lin='**Linux AppImage**: `chmod +x Caskit-*.AppImage` e execute.',
 sec='Segurança e privacidade',
 sec_1='O Caskit fala apenas com a Steam (e com o Game Coordinator do CS2). Sua senha nunca é salva; o refresh token e os segredos do maFile ficam no seu disco **criptografados** pelo sistema (Windows DPAPI / Chaves do macOS / libsecret no Linux).',
 sec_2='Se uma conta tem proxy, *todo* o tráfego dela passa por ele — requisições web, QR code, avatar. Se o proxy cair, o login é interrompido em vez de ir direto.',
 sec_3='A API local escuta apenas em `127.0.0.1` e exige um token aleatório que só a janela do app conhece.',
 sec_4='Nomes e ícones são atualizados uma vez por dia a partir de cópias públicas dos arquivos do jogo ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — sem enviar dados de contas.',
 faq='Perguntas frequentes',
 faq_1='**Posso levar ban VAC?** O Caskit não mexe no jogo, nos arquivos nem na memória dele e não abre o CS2. Ele entra como cliente Steam e fala com o Game Coordinator do CS2 como o próprio inventário do jogo, então o VAC não participa. Ainda assim é uma ferramenta não oficial: use por sua conta e risco.',
 faq_2='**Posso jogar com o Caskit aberto?** Se você abrir o CS2 na mesma conta, a Steam mantém só uma das duas sessões. Saia dessa conta no Caskit antes.',
 faq_3='**Onde ficam meus dados?** Só no seu computador: `%APPDATA%\\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).',
 sup='Apoie o projeto', sup_1='O Caskit é gratuito e sempre será. Se ele economiza seu tempo:',
 sup_kofi='cartão ou PayPal', sup_skin='Envie uma skin', sup_skin2='qualquer caixa ou skin sobrando',
 sup_crypto='Cripto (Binance Pay / USDT) — endereços no app: botão ♥', sup_star='Uma estrela no repositório',
 build='Compilar a partir do código', build_1='Requer Node.js 22+.',
 c_run='executar', c_win='instalador + portable → dist/', c_mac='dmg + zip (só no macOS)',
 rel='**Lançamento**: aumente `version` no `package.json` e depois `git tag vX.Y.Z && git push --tags`. O GitHub Actions compila os três sistemas e publica em Releases; as cópias instaladas se atualizam sozinhas.',
 lic='Licença',
 disc='O Caskit é um projeto independente de código aberto, sem afiliação ou endosso da Valve Corporation. Counter-Strike, CS2 e Steam são marcas da Valve Corporation.',
 shots='',
),
'fr': dict(
 tagline='Gestionnaire gratuit et open source des unités de stockage et de l’inventaire CS2.',
 tagline2='Transferts rapides, chances des contrats, autocollants, boutique, marché et Steam Guard — pour plusieurs comptes à la fois.',
 tagline3='Sans abonnement ni serveur tiers : tout tourne sur votre ordinateur et parle directement à Steam.',
 download='télécharger', features='Fonctionnalités',
 f_caskets='Unités de stockage',
 f_caskets_1='Rangez et retirez des objets en masse. La vitesse s’adapte seule aux limites de Steam (en général 8 à 13 objets/s) et les objets bloqués sont renvoyés automatiquement.',
 f_caskets_2='**Règles de transfert** : « toutes les caisses → Cases 01, Cases 02… », « autocollants → Stickers ». En un clic ou dès la connexion.',
 f_caskets_3='Renommez les unités, masquez les pleines, exportez tout en JSON/CSV.',
 f_tu='Contrats d’échange',
 f_tu_1='Contrats depuis l’inventaire *et* les unités de stockage (les objets sont sortis automatiquement).',
 f_tu_2='Tous les résultats possibles avec leur **chance**, le float de chaque objet et le **float prévu** du résultat sur une barre d’usure.',
 f_tu_3='Les objets refusés par le jeu (qualité maximale de leur collection) sont signalés à l’avance. Les souvenirs sont pris en charge.',
 f_tu_4='Après le contrat : **Inspecter en jeu** et **Voir sur le Marché de la communauté**.',
 f_st='Autocollants',
 f_st_1='Appliquez, grattez et retirez des autocollants — y compris le placement libre de CS2.',
 f_st_2='Float de l’arme avec barre d’usure, usure des autocollants, liens d’inspection et lien vers l’objet dans l’inventaire Steam.',
 f_store='Boutique CS2 et Armory',
 f_store_1='Panier, favoris, solde du porte-monnaie et solde après achat. Chaque paiement est confirmé par vous.',
 f_store_2='Armory : échangez des étoiles contre des récompenses.',
 f_store_3='Les noms et icônes des articles se mettent à jour seuls depuis les fichiers du jeu.',
 f_trade='Échanges, Marché et Steam Guard',
 f_trade_1='Offres reçues et envoyées, accepter/refuser, acceptation automatique des cadeaux.',
 f_trade_2='Annonces, ordres d’achat, historique avec recherche, vente avec les frais calculés.',
 f_trade_3='Un mini **SDA** intégré : codes Steam Guard pour tous les comptes avec maFile, confirmations d’échanges et d’annonces, surveillance des proxys.',
 f_acc='Comptes et confidentialité',
 f_acc_1='Plusieurs comptes à la fois, chacun avec son proxy SOCKS5/HTTP.',
 f_acc_2='Connexion par **QR code** (affiché immédiatement), identifiant et mot de passe ou **maFile**.',
 f_acc_3='10 langues, mises à jour automatiques (version avec installateur).',
 screens='Captures d’écran',
 s_tu='**Contrat** : résultats, chances, floats', s_craft='**Résultat** : inspecter en jeu ou ouvrir sur le marché',
 s_st='**Autocollants** : appliquer, gratter, retirer', s_store='**Boutique CS2** : panier et porte-monnaie',
 s_ov='**Aperçu** d’un ou de tous les comptes', s_guard='**Steam Guard** : codes et confirmations',
 dl='Télécharger', dl_1='La dernière version est sur la page **[Releases]({repo}/releases/latest)**.',
 sys='Système', file='Fichier',
 dl_setup='**recommandé** — s’installe en quelques secondes, sans droits administrateur, se met à jour seul',
 dl_port='sans installation (démarre plus lentement, mise à jour manuelle)',
 dl_or='ou',
 first='**Premier lancement.** Les versions ne sont pas encore signées, le système peut donc vous avertir une fois :',
 first_win='**Windows** (« Windows a protégé votre ordinateur ») : **Informations complémentaires → Exécuter quand même**.',
 first_mac='**macOS** (« l’app est endommagée » / « impossible de vérifier ») : clic droit sur l’app → **Ouvrir**, ou dans le Terminal `xattr -cr "/Applications/Caskit.app"`.',
 first_lin='**Linux AppImage** : `chmod +x Caskit-*.AppImage`, puis lancez-le.',
 sec='Sécurité et confidentialité',
 sec_1='Caskit ne parle qu’à Steam (et au Game Coordinator de CS2). Votre mot de passe n’est jamais enregistré ; le refresh token et les secrets maFile sont stockés sur votre disque, **chiffrés** par le système (Windows DPAPI / Trousseau macOS / libsecret sous Linux).',
 sec_2='Si un compte a un proxy, *tout* son trafic passe par lui — requêtes web, QR code, avatar. Si le proxy est en panne, la connexion s’arrête au lieu de passer en direct.',
 sec_3='L’API locale n’écoute que sur `127.0.0.1` et exige un jeton aléatoire connu de la seule fenêtre de l’app.',
 sec_4='Les noms et icônes sont mis à jour une fois par jour depuis des copies publiques des fichiers du jeu ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — aucune donnée de compte n’est envoyée.',
 faq='FAQ',
 faq_1='**Puis-je être banni par VAC ?** Caskit ne touche ni au jeu, ni à ses fichiers, ni à sa mémoire, et ne lance pas CS2. Il se connecte comme un client Steam et parle au Game Coordinator de CS2 comme l’inventaire du jeu lui-même : VAC n’intervient pas. Cela reste un outil non officiel, à utiliser à vos risques.',
 faq_2='**Puis-je jouer avec Caskit ouvert ?** Si vous lancez CS2 sur le même compte, Steam ne garde qu’une des deux sessions. Déconnectez d’abord ce compte dans Caskit.',
 faq_3='**Où sont mes données ?** Uniquement sur votre ordinateur : `%APPDATA%\\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).',
 sup='Soutenir le projet', sup_1='Caskit est gratuit et le restera. S’il vous fait gagner du temps :',
 sup_kofi='carte ou PayPal', sup_skin='Offrir un skin', sup_skin2='n’importe quelle caisse ou skin en trop',
 sup_crypto='Crypto (Binance Pay / USDT) — adresses dans l’app : bouton ♥', sup_star='Une étoile au dépôt',
 build='Compiler depuis les sources', build_1='Nécessite Node.js 22+.',
 c_run='lancer', c_win='installateur + portable → dist/', c_mac='dmg + zip (macOS uniquement)',
 rel='**Publication** : augmentez `version` dans `package.json`, puis `git tag vX.Y.Z && git push --tags`. GitHub Actions compile les trois systèmes et les publie dans Releases ; les copies installées se mettent à jour seules.',
 lic='Licence',
 disc='Caskit est un projet open source indépendant, ni affilié ni approuvé par Valve Corporation. Counter-Strike, CS2 et Steam sont des marques de Valve Corporation.',
 shots='',
),
'pl': dict(
 tagline='Darmowy menedżer pojemników (Storage Unit) i ekwipunku CS2 o otwartym kodzie.',
 tagline2='Szybkie przenoszenie, szanse kontraktów, naklejki, sklep, rynek i Steam Guard — dla kilku kont naraz.',
 tagline3='Bez subskrypcji i zewnętrznych serwerów: wszystko działa na twoim komputerze i łączy się bezpośrednio ze Steam.',
 download='pobierz', features='Funkcje',
 f_caskets='Pojemniki (Storage Unit)',
 f_caskets_1='Masowe przenoszenie przedmiotów do pojemników i z powrotem. Tempo samo dopasowuje się do limitów Steam (zwykle 8–13 przedmiotów/s), a zablokowane przedmioty są automatycznie ponawiane.',
 f_caskets_2='**Reguły przenoszenia**: „wszystkie skrzynie → Cases 01, Cases 02…”, „naklejki → Stickers”. Jednym kliknięciem albo zaraz po zalogowaniu.',
 f_caskets_3='Zmiana nazw pojemników, ukrywanie pełnych, eksport wszystkiego do JSON/CSV.',
 f_tu='Kontrakty wymiany',
 f_tu_1='Kontrakty z ekwipunku *i* z pojemników (przedmioty wyjmowane są automatycznie).',
 f_tu_2='Wszystkie możliwe wyniki z **szansą**, float każdego wejścia i **przewidywany float** wyniku na pasku zużycia.',
 f_tu_3='Przedmioty, których gra nie przyjmie (najwyższa jakość w kolekcji), są oznaczane z góry. Pamiątki (souvenir) są obsługiwane.',
 f_tu_4='Po kontrakcie: **Obejrzyj w grze** i **Na Rynku Społeczności**.',
 f_st='Naklejki',
 f_st_1='Naklejanie, zdrapywanie i usuwanie naklejek — także z dowolnym umieszczeniem w CS2.',
 f_st_2='Float broni z paskiem zużycia, zużycie naklejek, linki podglądu i link do przedmiotu w ekwipunku Steam.',
 f_store='Sklep CS2 i Armory',
 f_store_1='Koszyk, ulubione, saldo portfela i saldo po zakupie. Każdą płatność potwierdzasz sam.',
 f_store_2='Armory: wymiana gwiazdek na nagrody.',
 f_store_3='Nazwy i obrazki produktów aktualizują się same z plików gry.',
 f_trade='Wymiany, Rynek i Steam Guard',
 f_trade_1='Oferty przychodzące i wychodzące, akceptuj/odrzuć, automatyczne przyjmowanie prezentów.',
 f_trade_2='Oferty sprzedaży, zlecenia kupna, historia z wyszukiwaniem, sprzedaż z wyliczoną prowizją.',
 f_trade_3='Wbudowany mini-**SDA**: kody Steam Guard dla wszystkich kont z maFile, potwierdzenia wymian i ofert, kontrola proxy.',
 f_acc='Konta i prywatność',
 f_acc_1='Kilka kont jednocześnie, każde z własnym proxy SOCKS5/HTTP.',
 f_acc_2='Logowanie **kodem QR** (pojawia się od razu), loginem i hasłem albo przez **maFile**.',
 f_acc_3='10 języków, automatyczne aktualizacje (wersja z instalatorem).',
 screens='Zrzuty ekranu',
 s_tu='**Kontrakt**: wyniki, szanse, floaty', s_craft='**Wynik**: obejrzyj w grze lub otwórz na rynku',
 s_st='**Naklejki**: naklej, zdrap, usuń', s_store='**Sklep CS2**: koszyk i portfel',
 s_ov='**Przegląd** jednego lub wszystkich kont', s_guard='**Steam Guard**: kody i potwierdzenia',
 dl='Pobierz', dl_1='Najnowsza wersja jest na stronie **[Releases]({repo}/releases/latest)**.',
 sys='System', file='Plik',
 dl_setup='**zalecane** — instaluje się w kilka sekund, bez uprawnień administratora, aktualizuje się samo',
 dl_port='bez instalacji (uruchamia się wolniej, aktualizacja ręczna)',
 dl_or='lub',
 first='**Pierwsze uruchomienie.** Wersje nie są jeszcze podpisane cyfrowo, więc system może raz ostrzec:',
 first_win='**Windows** („System Windows ochronił ten komputer”): **Więcej informacji → Uruchom mimo to**.',
 first_mac='**macOS** („aplikacja jest uszkodzona” / „nie można zweryfikować”): prawy klik na aplikację → **Otwórz** albo w Terminalu `xattr -cr "/Applications/Caskit.app"`.',
 first_lin='**Linux AppImage**: `chmod +x Caskit-*.AppImage`, potem uruchom.',
 sec='Bezpieczeństwo i prywatność',
 sec_1='Caskit łączy się tylko ze Steam (i Game Coordinatorem CS2). Hasło nigdy nie jest zapisywane; refresh token i sekrety maFile są przechowywane na twoim dysku **zaszyfrowane** przez system (Windows DPAPI / pęk kluczy macOS / libsecret w Linuksie).',
 sec_2='Jeśli konto ma proxy, przez nie idzie *cały* ruch konta — zapytania WWW, kod QR, awatar. Gdy proxy nie działa, logowanie zostaje przerwane zamiast iść bezpośrednio.',
 sec_3='Lokalne API nasłuchuje tylko na `127.0.0.1` i wymaga losowego tokenu znanego tylko oknu aplikacji.',
 sec_4='Nazwy i ikony są raz dziennie aktualizowane z publicznych kopii plików gry ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — bez danych kont.',
 faq='FAQ',
 faq_1='**Czy można dostać bana VAC?** Caskit nie dotyka gry, jej plików ani pamięci i nie uruchamia CS2. Loguje się jako klient Steam i rozmawia z Game Coordinatorem CS2 tak samo jak ekwipunek samej gry, więc VAC nie bierze w tym udziału. To jednak nieoficjalne narzędzie — używasz na własne ryzyko.',
 faq_2='**Czy mogę grać, gdy Caskit jest otwarty?** Jeśli uruchomisz CS2 na tym samym koncie, Steam zostawi tylko jedną z dwóch sesji. Najpierw wyloguj to konto w Caskit.',
 faq_3='**Gdzie są moje dane?** Tylko na twoim komputerze: `%APPDATA%\\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).',
 sup='Wesprzyj projekt', sup_1='Caskit jest darmowy i taki zostanie. Jeśli oszczędza ci czas:',
 sup_kofi='kartą lub PayPal', sup_skin='Podaruj skina', sup_skin2='dowolną zbędną skrzynię lub skina',
 sup_crypto='Krypto (Binance Pay / USDT) — adresy w aplikacji: przycisk ♥', sup_star='Gwiazdka dla repozytorium',
 build='Budowanie ze źródeł', build_1='Wymaga Node.js 22+.',
 c_run='uruchom', c_win='instalator + portable → dist/', c_mac='dmg + zip (tylko na macOS)',
 rel='**Wydanie**: podnieś `version` w `package.json`, potem `git tag vX.Y.Z && git push --tags`. GitHub Actions zbuduje wszystkie trzy systemy i opublikuje je w Releases; zainstalowane kopie zaktualizują się same.',
 lic='Licencja',
 disc='Caskit to niezależny projekt open source, niezwiązany z Valve Corporation i przez nią niepopierany. Counter-Strike, CS2 i Steam są znakami towarowymi Valve Corporation.',
 shots='',
),
'tr': dict(
 tagline='Ücretsiz ve açık kaynaklı CS2 depo (Storage Unit) ve envanter yöneticisi.',
 tagline2='Hızlı aktarım, kontrat şansları, çıkartmalar, mağaza, pazar ve Steam Guard — aynı anda birden çok hesap için.',
 tagline3='Abonelik ve üçüncü taraf sunucu yok: her şey bilgisayarınızda çalışır ve doğrudan Steam ile konuşur.',
 download='indir', features='Özellikler',
 f_caskets='Depolar (Storage Unit)',
 f_caskets_1='Eşyaları depolara toplu koyup çıkarın. Hız Steam sınırlarına kendini ayarlar (genelde 8–13 eşya/sn), takılan eşyalar otomatik yeniden gönderilir.',
 f_caskets_2='**Aktarma kuralları**: «tüm kasalar → Cases 01, Cases 02…», «çıkartmalar → Stickers». Tek tıkla ya da girişten hemen sonra.',
 f_caskets_3='Depoları yeniden adlandırın, dolu olanları gizleyin, her şeyi JSON/CSV olarak dışa aktarın.',
 f_tu='Takas kontratları',
 f_tu_1='Envanterden *ve* depolardan kontrat (eşyalar otomatik çıkarılır).',
 f_tu_2='Tüm olası sonuçlar **şanslarıyla**, her girdinin float değeri ve sonucun **tahmini float** değeri aşınma çubuğunda.',
 f_tu_3='Oyunun kabul etmeyeceği eşyalar (koleksiyonunun en üst kalitesi) önceden işaretlenir. Hatıra (souvenir) eşyalar desteklenir.',
 f_tu_4='Kontrattan sonra: **Oyunda incele** ve **Topluluk Pazarı’nda gör**.',
 f_st='Çıkartmalar',
 f_st_1='Çıkartma yapıştırın, kazıyın ve kaldırın — CS2 serbest yerleşimli çıkartmalar dahil.',
 f_st_2='Aşınma çubuğuyla silah float değeri, çıkartma aşınması, inceleme bağlantıları ve Steam envanterindeki eşyaya bağlantı.',
 f_store='CS2 Mağazası ve Armory',
 f_store_1='Sepet, favoriler, cüzdan bakiyesi ve satın alma sonrası bakiye. Her ödemeyi siz onaylarsınız.',
 f_store_2='Armory: yıldızları ödüllerle takas edin.',
 f_store_3='Ürün adları ve görselleri oyun dosyalarından kendiliğinden güncellenir.',
 f_trade='Takaslar, Pazar ve Steam Guard',
 f_trade_1='Gelen ve giden teklifler, kabul/ret, hediyeleri otomatik kabul.',
 f_trade_2='İlanlar, alım emirleri, aranabilir geçmiş, komisyonu hesaplanmış satış.',
 f_trade_3='Dahili mini **SDA**: maFile’ı olan tüm hesaplar için Steam Guard kodları, takas ve ilan onayları, proxy takibi.',
 f_acc='Hesaplar ve gizlilik',
 f_acc_1='Aynı anda birden çok hesap, her birinin kendi SOCKS5/HTTP proxy’si.',
 f_acc_2='**QR kod** (hemen görünür), kullanıcı adı ve şifre ya da **maFile** ile giriş.',
 f_acc_3='10 dil, otomatik güncellemeler (kurulum sürümü).',
 screens='Ekran görüntüleri',
 s_tu='**Kontrat**: sonuçlar, şanslar, float', s_craft='**Sonuç**: oyunda incele veya pazarda aç',
 s_st='**Çıkartmalar**: yapıştır, kazı, kaldır', s_store='**CS2 Mağazası**: sepet ve cüzdan',
 s_ov='Bir veya tüm hesapların **genel bakışı**', s_guard='**Steam Guard**: kodlar ve onaylar',
 dl='İndir', dl_1='En son sürüm **[Releases]({repo}/releases/latest)** sayfasında.',
 sys='Sistem', file='Dosya',
 dl_setup='**önerilir** — saniyeler içinde kurulur, yönetici izni gerekmez, kendini günceller',
 dl_port='kurulumsuz (daha yavaş açılır, elle güncellenir)',
 dl_or='veya',
 first='**İlk açılış.** Sürümler henüz dijital olarak imzalı değil, bu yüzden sistem bir kez uyarabilir:',
 first_win='**Windows** («Windows bilgisayarınızı korudu»): **Ek bilgi → Yine de çalıştır**.',
 first_mac='**macOS** («uygulama hasarlı» / «doğrulanamıyor»): uygulamaya sağ tıklayın → **Aç** ya da Terminal’de `xattr -cr "/Applications/Caskit.app"`.',
 first_lin='**Linux AppImage**: `chmod +x Caskit-*.AppImage`, ardından çalıştırın.',
 sec='Güvenlik ve gizlilik',
 sec_1='Caskit yalnızca Steam (ve CS2 Game Coordinator) ile konuşur. Şifreniz asla kaydedilmez; refresh token ve maFile sırları diskinizde sistem tarafından **şifrelenmiş** olarak tutulur (Windows DPAPI / macOS Anahtar Zinciri / Linux’ta libsecret).',
 sec_2='Bir hesabın proxy’si varsa, hesabın *tüm* trafiği ondan geçer — web istekleri, QR kod, avatar. Proxy çalışmıyorsa giriş doğrudan bağlanmak yerine durur.',
 sec_3='Yerel API yalnızca `127.0.0.1` üzerinde dinler ve sadece uygulama penceresinin bildiği rastgele bir token ister.',
 sec_4='Eşya adları ve simgeleri günde bir kez oyun dosyalarının herkese açık kopyalarından güncellenir ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — hesap verisi gönderilmez.',
 faq='SSS',
 faq_1='**VAC yasağı alabilir miyim?** Caskit oyuna, dosyalarına veya belleğine dokunmaz ve CS2’yi başlatmaz. Steam istemcisi olarak giriş yapar ve CS2 Game Coordinator ile oyunun kendi envanteri gibi konuşur; VAC devreye girmez. Yine de resmi olmayan bir araçtır, kullanım riski size aittir.',
 faq_2='**Caskit açıkken oynayabilir miyim?** Aynı hesapta CS2’yi başlatırsanız Steam iki oturumdan yalnızca birini tutar. Önce o hesaptan Caskit’te çıkış yapın.',
 faq_3='**Verilerim nerede?** Yalnızca bilgisayarınızda: `%APPDATA%\\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).',
 sup='Projeyi destekleyin', sup_1='Caskit ücretsizdir ve öyle kalacak. Size zaman kazandırıyorsa:',
 sup_kofi='kart veya PayPal', sup_skin='Kaplama hediye edin', sup_skin2='fazla herhangi bir kasa veya kaplama',
 sup_crypto='Kripto (Binance Pay / USDT) — adresler uygulamada: ♥ düğmesi', sup_star='Depoya bir yıldız',
 build='Kaynaktan derleme', build_1='Node.js 22+ gerekir.',
 c_run='çalıştır', c_win='kurulum + portable → dist/', c_mac='dmg + zip (yalnızca macOS’ta)',
 rel='**Sürüm yayınlama**: `package.json` içindeki `version` değerini artırın, ardından `git tag vX.Y.Z && git push --tags`. GitHub Actions üç sistemi derleyip Releases’a yükler; kurulu kopyalar kendini günceller.',
 lic='Lisans',
 disc='Caskit, Valve Corporation ile bağlantısı olmayan ve onun tarafından onaylanmamış bağımsız bir açık kaynak projesidir. Counter-Strike, CS2 ve Steam, Valve Corporation’ın ticari markalarıdır.',
 shots='',
),
'zh': dict(
 tagline='免费开源的 CS2 储物柜（Storage Unit）与库存管理器。',
 tagline2='快速转移、汰换合同概率、印花、商店、市场和 Steam 令牌——同时管理多个账户。',
 tagline3='无订阅、无第三方服务器：一切都在你的电脑上运行，直接与 Steam 通信。',
 download='下载', features='功能',
 f_caskets='储物柜（Storage Unit）',
 f_caskets_1='批量存入和取出物品。速度会自动适应 Steam 的限制（通常每秒 8–13 件），卡住的物品会自动重试。',
 f_caskets_2='**转移规则**：「所有箱子 → Cases 01、Cases 02…」、「印花 → Stickers」。一键执行或登录后自动执行。',
 f_caskets_3='重命名储物柜、隐藏已满的储物柜，并将全部内容导出为 JSON/CSV。',
 f_tu='汰换合同',
 f_tu_1='可使用库存*和*储物柜中的物品（会自动取出）。',
 f_tu_2='显示所有可能结果及其**概率**、每件输入物品的磨损值，以及结果的**预计磨损值**（磨损条显示）。',
 f_tu_3='游戏不接受的物品（所属收藏品的最高品质）会提前标出。支持纪念品。',
 f_tu_4='合同完成后：**在游戏中检视**和**在社区市场查看**。',
 f_st='印花',
 f_st_1='贴上、刮擦和移除印花——包括 CS2 自由放置的印花。',
 f_st_2='武器磨损值与磨损条、印花磨损、检视链接，以及 Steam 库存中该物品的链接。',
 f_store='CS2 商店与军械库',
 f_store_1='购物车、收藏、钱包余额和购买后余额。每笔付款都由你确认。',
 f_store_2='军械库：用星星兑换奖励。',
 f_store_3='商品名称和图标会根据游戏文件自动更新。',
 f_trade='交易、社区市场与 Steam 令牌',
 f_trade_1='收到和发出的交易报价，接受/拒绝，自动接受礼物。',
 f_trade_2='在售物品、求购订单、可搜索的历史记录、自动计算手续费的出售。',
 f_trade_3='内置迷你 **SDA**：所有带 maFile 的账户的 Steam 令牌验证码、交易和上架确认、代理监控。',
 f_acc='账户与隐私',
 f_acc_1='同时登录多个账户，每个账户可使用自己的 SOCKS5/HTTP 代理。',
 f_acc_2='使用**二维码**（立即显示）、用户名和密码或 **maFile** 登录。',
 f_acc_3='10 种界面语言，自动更新（安装版）。',
 screens='截图',
 s_tu='**汰换合同**：结果、概率、磨损', s_craft='**结果**：在游戏中检视或在市场中打开',
 s_st='**印花**：贴上、刮擦、移除', s_store='**CS2 商店**：购物车与钱包',
 s_ov='单个或全部账户的**概览**', s_guard='**Steam 令牌**：验证码与确认',
 dl='下载', dl_1='最新版本请见 **[Releases]({repo}/releases/latest)** 页面。',
 sys='系统', file='文件',
 dl_setup='**推荐**——几秒完成安装，无需管理员权限，自动更新',
 dl_port='免安装（启动较慢，需手动更新）',
 dl_or='或',
 first='**首次启动。** 安装包尚未进行代码签名，系统可能会提示一次：',
 first_win='**Windows**（「Windows 已保护你的电脑」）：点击 **更多信息 → 仍要运行**。',
 first_mac='**macOS**（「应用已损坏」/「无法验证」）：右键点击应用 → **打开**，或在终端执行 `xattr -cr "/Applications/Caskit.app"`。',
 first_lin='**Linux AppImage**：`chmod +x Caskit-*.AppImage`，然后运行。',
 sec='安全与隐私',
 sec_1='Caskit 只与 Steam（以及 CS2 游戏协调器）通信。密码从不保存；refresh token 和 maFile 密钥由系统**加密**后保存在你的磁盘上（Windows DPAPI / macOS 钥匙串 / Linux libsecret）。',
 sec_2='如果账户设置了代理，该账户的*全部*流量都经过代理——网页请求、二维码、头像。代理不可用时，登录会中止，而不会直接连接。',
 sec_3='本地 API 只监听 `127.0.0.1`，并要求只有应用窗口知道的随机令牌。',
 sec_4='物品名称和图标每天从游戏文件的公开镜像更新一次（[GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2)、[counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)）——不会发送任何账户数据。',
 faq='常见问题',
 faq_1='**会被 VAC 封禁吗？** Caskit 不触碰游戏本身、游戏文件或内存，也不会启动 CS2。它以 Steam 客户端身份登录，像游戏自带的库存一样与 CS2 游戏协调器通信，VAC 不参与其中。但它仍是非官方工具，使用风险自负。',
 faq_2='**Caskit 打开时可以玩游戏吗？** 如果在同一账户上启动 CS2，Steam 只会保留两个会话中的一个。请先在 Caskit 中退出该账户。',
 faq_3='**数据保存在哪里？** 只在你的电脑上：`%APPDATA%\\Caskit`（Windows）、`~/Library/Application Support/Caskit`（macOS）、`~/.config/Caskit`（Linux）。',
 sup='支持项目', sup_1='Caskit 永久免费。如果它为你节省了时间：',
 sup_kofi='银行卡或 PayPal', sup_skin='赠送皮肤', sup_skin2='任何多余的箱子或皮肤',
 sup_crypto='加密货币（Binance Pay / USDT）——地址见应用内 ♥ 按钮', sup_star='为仓库点亮星标',
 build='从源码构建', build_1='需要 Node.js 22+。',
 c_run='运行', c_win='安装包 + 便携版 → dist/', c_mac='dmg + zip（仅限 macOS）',
 rel='**发布**：在 `package.json` 中提升 `version`，然后执行 `git tag vX.Y.Z && git push --tags`。GitHub Actions 会构建三个系统的版本并发布到 Releases；已安装的副本会自动更新。',
 lic='许可证',
 disc='Caskit 是独立的开源项目，与 Valve Corporation 无关，也未获其认可。Counter-Strike、CS2 和 Steam 是 Valve Corporation 的商标。',
 shots='',
),
}

TEMPLATE = '''<p align="center"><img src="../build/icon.png" width="120" alt="Caskit"></p>

<h1 align="center">Caskit</h1>

<p align="center"><b>{tagline}</b><br>
{tagline2}<br>
{tagline3}</p>

<p align="center">
<a href="{repo}/releases/latest"><img src="https://img.shields.io/github/v/release/pythonMaster2002/cs2-storage-manager?label={download_q}&color=2d73ff" alt="release"></a>
<a href="{repo}/releases"><img src="https://img.shields.io/github/downloads/pythonMaster2002/cs2-storage-manager/total?color=06bfff" alt="downloads"></a>
<img src="https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-informational" alt="platforms">
<img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
<a href="https://ko-fi.com/mikidjus"><img src="https://img.shields.io/badge/Ko--fi-support-ff5e5b?logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
</p>

<p align="center">
{langbar}
</p>

<p align="center"><img src="screenshots/caskets{shots}.png" alt="Caskit" width="900"></p>

## {features}

**{f_caskets}**
- {f_caskets_1}
- {f_caskets_2}
- {f_caskets_3}

**{f_tu}**
- {f_tu_1}
- {f_tu_2}
- {f_tu_3}
- {f_tu_4}

**{f_st}**
- {f_st_1}
- {f_st_2}

**{f_store}**
- {f_store_1}
- {f_store_2}
- {f_store_3}

**{f_trade}**
- {f_trade_1}
- {f_trade_2}
- {f_trade_3}

**{f_acc}**
- {f_acc_1}
- {f_acc_2}
- {f_acc_3}

## {screens}

| | |
|---|---|
| <img src="screenshots/tradeup{shots}.png" alt="trade-up"> | <img src="screenshots/craft{shots}.png" alt="result"> |
| {s_tu} | {s_craft} |
| <img src="screenshots/stickers{shots}.png" alt="stickers"> | <img src="screenshots/store{shots}.png" alt="store"> |
| {s_st} | {s_store} |
| <img src="screenshots/overview{shots}.png" alt="overview"> | <img src="screenshots/guard{shots}.png" alt="Steam Guard"> |
| {s_ov} | {s_guard} |

## {dl}

{dl_1_f}

| {sys} | {file} | |
|---|---|---|
| Windows | `Caskit-Setup-x.y.z.exe` | {dl_setup} |
| Windows | `Caskit-x.y.z-portable.exe` | {dl_port} |
| macOS | `Caskit-x.y.z-arm64.dmg` (Apple Silicon) / `Caskit-x.y.z-x64.dmg` (Intel) | |
| Linux | `Caskit-x.y.z-x86_64.AppImage` {dl_or} `Caskit-x.y.z-amd64.deb` | |

{first}

- {first_win}
- {first_mac}
- {first_lin}

## {sec}

- {sec_1}
- {sec_2}
- {sec_3}
- {sec_4}

## {faq}

{faq_1}

{faq_2}

{faq_3}

## {sup}

{sup_1}

- ☕ [Ko-fi](https://ko-fi.com/mikidjus) — {sup_kofi}
- 🎁 [{sup_skin}](https://steamcommunity.com/tradeoffer/new/?partner=146040317&token=Q_pa1oMK) — {sup_skin2}
- 💎 {sup_crypto}
- ⭐ {sup_star}

## {build}

{build_1}

```bash
npm ci
npm start              # {c_run}
npm run build:win      # {c_win}
npm run build:linux    # AppImage + deb
npm run build:mac      # {c_mac}
```

{rel}

## {lic}

[MIT](../LICENSE)

{disc}
'''

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for code, t in T.items():
        bar = ' ·\n'.join(f'<b>{name}</b>' if c == code else f'<a href="{href}">{name}</a>' for c, name, href in LANGS)
        from urllib.parse import quote
        text = TEMPLATE.format(repo=REPO, langbar=bar, download_q=quote(t['download']), dl_1_f=t['dl_1'].format(repo=REPO), **t)
        with open(os.path.join(root, 'docs', f'README.{code}.md'), 'w', encoding='utf-8') as f:
            f.write(text)
        print('docs/README.%s.md' % code)

if __name__ == '__main__':
    main()
