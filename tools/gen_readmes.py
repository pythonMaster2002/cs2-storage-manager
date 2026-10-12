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
 vt='**Проверка VirusTotal** (v1.0.0): [установщик — 0/67](https://www.virustotal.com/gui/file/9c1ad7cc654280aafbcb21ae29a42f52e18aa85704d05feb731fcd82c8ed8f22), [portable — 0/66](https://www.virustotal.com/gui/file/26894b8fbed549bd5108a604686b22c1a3416b089f870b442b207eac8c2d57f9).',
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
 vt='**Перевірка VirusTotal** (v1.0.0): [інсталятор — 0/67](https://www.virustotal.com/gui/file/9c1ad7cc654280aafbcb21ae29a42f52e18aa85704d05feb731fcd82c8ed8f22), [portable — 0/66](https://www.virustotal.com/gui/file/26894b8fbed549bd5108a604686b22c1a3416b089f870b442b207eac8c2d57f9).',
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
 vt='**VirusTotal-Scan** (v1.0.0): [Installer – 0/67](https://www.virustotal.com/gui/file/9c1ad7cc654280aafbcb21ae29a42f52e18aa85704d05feb731fcd82c8ed8f22), [Portable – 0/66](https://www.virustotal.com/gui/file/26894b8fbed549bd5108a604686b22c1a3416b089f870b442b207eac8c2d57f9).',
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
 vt='**Análisis de VirusTotal** (v1.0.0): [instalador — 0/67](https://www.virustotal.com/gui/file/9c1ad7cc654280aafbcb21ae29a42f52e18aa85704d05feb731fcd82c8ed8f22), [portable — 0/66](https://www.virustotal.com/gui/file/26894b8fbed549bd5108a604686b22c1a3416b089f870b442b207eac8c2d57f9).',
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
 vt='**Verificação no VirusTotal** (v1.0.0): [instalador — 0/67](https://www.virustotal.com/gui/file/9c1ad7cc654280aafbcb21ae29a42f52e18aa85704d05feb731fcd82c8ed8f22), [portable — 0/66](https://www.virustotal.com/gui/file/26894b8fbed549bd5108a604686b22c1a3416b089f870b442b207eac8c2d57f9).',
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
 vt='**Analyse VirusTotal** (v1.0.0) : [installateur — 0/67](https://www.virustotal.com/gui/file/9c1ad7cc654280aafbcb21ae29a42f52e18aa85704d05feb731fcd82c8ed8f22), [portable — 0/66](https://www.virustotal.com/gui/file/26894b8fbed549bd5108a604686b22c1a3416b089f870b442b207eac8c2d57f9).',
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
 vt='**Skan VirusTotal** (v1.0.0): [instalator — 0/67](https://www.virustotal.com/gui/file/9c1ad7cc654280aafbcb21ae29a42f52e18aa85704d05feb731fcd82c8ed8f22), [portable — 0/66](https://www.virustotal.com/gui/file/26894b8fbed549bd5108a604686b22c1a3416b089f870b442b207eac8c2d57f9).',
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
 vt='**VirusTotal taraması** (v1.0.0): [yükleyici — 0/67](https://www.virustotal.com/gui/file/9c1ad7cc654280aafbcb21ae29a42f52e18aa85704d05feb731fcd82c8ed8f22), [portable — 0/66](https://www.virustotal.com/gui/file/26894b8fbed549bd5108a604686b22c1a3416b089f870b442b207eac8c2d57f9).',
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
 vt='**VirusTotal 扫描**（v1.0.0）：[安装版 — 0/67](https://www.virustotal.com/gui/file/9c1ad7cc654280aafbcb21ae29a42f52e18aa85704d05feb731fcd82c8ed8f22)，[便携版 — 0/66](https://www.virustotal.com/gui/file/26894b8fbed549bd5108a604686b22c1a3416b089f870b442b207eac8c2d57f9)。',
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

# Удаление, приватность и политика подписи (добавлены к основным текстам)
EXTRA = {
'ru': dict(
 un="Удаление",
 un_win="**Windows (установщик)**: Параметры → Приложения → **Caskit** → Удалить. **Portable**: просто удалите `.exe`.",
 un_mac="**macOS**: перетащите **Caskit** из «Программ» в Корзину.",
 un_lin="**Linux**: удалите AppImage или `sudo apt remove caskit` для `.deb`.",
 un_data="Сохранённые входы и настройки остаются в папке данных (см. вопросы ниже) — удалите и её, чтобы стереть всё.",
 priv="Без аналитики и телеметрии. Полный список сетевых подключений — в **[политике конфиденциальности](../PRIVACY.md)** (англ.).",
 csp="Политика подписи кода",
 csp_1="Сборки для Windows собираются из этого репозитория в GitHub Actions. Подпись планируется через SignPath Foundation (бесплатно для открытых проектов); первая заявка пока не одобрена — до одобрения сборки не подписаны. Подробности — в разделе [Code signing policy](../README.md#code-signing-policy) (англ.).",
),
'uk': dict(
 un="Видалення",
 un_win="**Windows (інсталятор)**: Параметри → Програми → **Caskit** → Видалити. **Portable**: просто видаліть `.exe`.",
 un_mac="**macOS**: перетягніть **Caskit** із «Програм» у Кошик.",
 un_lin="**Linux**: видаліть AppImage або `sudo apt remove caskit` для `.deb`.",
 un_data="Збережені входи й налаштування залишаються в папці даних (див. питання нижче) — видаліть і її, щоб стерти все.",
 priv="Без аналітики й телеметрії. Повний список мережевих підключень — у **[політиці конфіденційності](../PRIVACY.md)** (англ.).",
 csp="Політика підпису коду",
 csp_1="Збірки для Windows збираються з цього репозиторію в GitHub Actions. Підпис планується через SignPath Foundation (безкоштовно для відкритих проєктів); першу заявку поки не схвалено — до схвалення збірки не підписані. Докладніше — у розділі [Code signing policy](../README.md#code-signing-policy) (англ.).",
),
'de': dict(
 un="Deinstallieren",
 un_win="**Windows (Installer)**: Einstellungen → Apps → **Caskit** → Deinstallieren. **Portable**: einfach die `.exe` löschen.",
 un_mac="**macOS**: **Caskit** aus „Programme“ in den Papierkorb ziehen.",
 un_lin="**Linux**: AppImage löschen oder `sudo apt remove caskit` für das `.deb`.",
 un_data="Gespeicherte Anmeldungen und Einstellungen bleiben im Datenordner (siehe FAQ) — lösche ihn ebenfalls, um alles zu entfernen.",
 priv="Keine Analyse, keine Telemetrie. Alle Netzwerkverbindungen stehen in der **[Datenschutzerklärung](../PRIVACY.md)** (Englisch).",
 csp="Code-Signing-Richtlinie",
 csp_1="Windows-Builds werden per GitHub Actions aus diesem Repository erstellt. Die Signierung ist über die SignPath Foundation geplant (kostenlos für Open Source); der erste Antrag wurde noch nicht genehmigt – bis dahin sind die Builds unsigniert. Details: [Code signing policy](../README.md#code-signing-policy) (Englisch).",
),
'es': dict(
 un="Desinstalar",
 un_win="**Windows (instalador)**: Configuración → Aplicaciones → **Caskit** → Desinstalar. **Portable**: borra el `.exe`.",
 un_mac="**macOS**: arrastra **Caskit** de Aplicaciones a la Papelera.",
 un_lin="**Linux**: borra el AppImage o `sudo apt remove caskit` para el `.deb`.",
 un_data="Los inicios de sesión guardados y los ajustes quedan en la carpeta de datos (ver preguntas frecuentes); bórrala también para eliminarlo todo.",
 priv="Sin analíticas ni telemetría. Lista completa de conexiones de red en la **[política de privacidad](../PRIVACY.md)** (en inglés).",
 csp="Política de firma de código",
 csp_1="Las versiones de Windows se compilan desde este repositorio con GitHub Actions. La firma está prevista mediante SignPath Foundation (gratis para código abierto); la primera solicitud aún no ha sido aprobada, así que por ahora las versiones no están firmadas. Detalles: [Code signing policy](../README.md#code-signing-policy) (en inglés).",
),
'pt': dict(
 un="Desinstalar",
 un_win="**Windows (instalador)**: Configurações → Aplicativos → **Caskit** → Desinstalar. **Portable**: apague o `.exe`.",
 un_mac="**macOS**: arraste o **Caskit** de Aplicativos para o Lixo.",
 un_lin="**Linux**: apague o AppImage ou `sudo apt remove caskit` para o `.deb`.",
 un_data="Os logins salvos e as configurações ficam na pasta de dados (veja as perguntas frequentes); apague-a também para remover tudo.",
 priv="Sem análises nem telemetria. Lista completa de conexões de rede na **[política de privacidade](../PRIVACY.md)** (em inglês).",
 csp="Política de assinatura de código",
 csp_1="As versões para Windows são compiladas a partir deste repositório no GitHub Actions. A assinatura está prevista via SignPath Foundation (gratuito para código aberto); o primeiro pedido ainda não foi aprovado, então por enquanto as versões não são assinadas. Detalhes: [Code signing policy](../README.md#code-signing-policy) (em inglês).",
),
'fr': dict(
 un="Désinstaller",
 un_win="**Windows (installateur)** : Paramètres → Applications → **Caskit** → Désinstaller. **Portable** : supprimez simplement le `.exe`.",
 un_mac="**macOS** : glissez **Caskit** des Applications vers la Corbeille.",
 un_lin="**Linux** : supprimez l’AppImage, ou `sudo apt remove caskit` pour le `.deb`.",
 un_data="Les connexions enregistrées et les réglages restent dans le dossier de données (voir FAQ) ; supprimez-le aussi pour tout effacer.",
 priv="Pas d’analytique ni de télémétrie. Liste complète des connexions réseau dans la **[politique de confidentialité](../PRIVACY.md)** (en anglais).",
 csp="Politique de signature du code",
 csp_1="Les versions Windows sont compilées depuis ce dépôt par GitHub Actions. La signature est prévue via SignPath Foundation (gratuit pour l’open source) ; la première demande n’a pas encore été acceptée, donc les versions ne sont pas signées pour l’instant. Détails : [Code signing policy](../README.md#code-signing-policy) (en anglais).",
),
'pl': dict(
 un="Odinstalowanie",
 un_win="**Windows (instalator)**: Ustawienia → Aplikacje → **Caskit** → Odinstaluj. **Portable**: po prostu usuń `.exe`.",
 un_mac="**macOS**: przeciągnij **Caskit** z Aplikacji do Kosza.",
 un_lin="**Linux**: usuń AppImage albo `sudo apt remove caskit` dla `.deb`.",
 un_data="Zapisane logowania i ustawienia zostają w folderze danych (zobacz FAQ) — usuń go też, aby skasować wszystko.",
 priv="Bez analityki i telemetrii. Pełna lista połączeń sieciowych w **[polityce prywatności](../PRIVACY.md)** (po angielsku).",
 csp="Zasady podpisywania kodu",
 csp_1="Wersje dla Windows są budowane z tego repozytorium w GitHub Actions. Podpis jest planowany przez SignPath Foundation (bezpłatnie dla open source); pierwszy wniosek nie został jeszcze zatwierdzony, więc na razie wersje nie są podpisane. Szczegóły: [Code signing policy](../README.md#code-signing-policy) (po angielsku).",
),
'tr': dict(
 un="Kaldırma",
 un_win="**Windows (kurulum)**: Ayarlar → Uygulamalar → **Caskit** → Kaldır. **Portable**: `.exe` dosyasını silmeniz yeterli.",
 un_mac="**macOS**: **Caskit**’i Uygulamalar’dan Çöp Sepeti’ne sürükleyin.",
 un_lin="**Linux**: AppImage’i silin ya da `.deb` için `sudo apt remove caskit`.",
 un_data="Kayıtlı girişler ve ayarlar veri klasöründe kalır (SSS’ye bakın) — her şeyi silmek için onu da silin.",
 priv="Analitik ve telemetri yok. Tüm ağ bağlantılarının listesi **[gizlilik politikasında](../PRIVACY.md)** (İngilizce).",
 csp="Kod imzalama politikası",
 csp_1="Windows sürümleri bu depodan GitHub Actions ile derlenir. İmzalama SignPath Foundation üzerinden planlanıyor (açık kaynak için ücretsiz); ilk başvuru henüz onaylanmadı, bu yüzden şimdilik sürümler imzasız. Ayrıntılar: [Code signing policy](../README.md#code-signing-policy) (İngilizce).",
),
'zh': dict(
 un="卸载",
 un_win="**Windows（安装版）**：设置 → 应用 → **Caskit** → 卸载。**便携版**：直接删除 `.exe` 即可。",
 un_mac="**macOS**：将 **Caskit** 从“应用程序”拖到废纸篓。",
 un_lin="**Linux**：删除 AppImage，或对 `.deb` 执行 `sudo apt remove caskit`。",
 un_data="已保存的登录信息和设置保留在数据文件夹中（见常见问题）——如需全部清除，请一并删除。",
 priv="无分析、无遥测。完整的网络连接列表见 **[隐私政策](../PRIVACY.md)**（英文）。",
 csp="代码签名政策",
 csp_1="Windows 版本由 GitHub Actions 从本仓库构建。计划通过 SignPath Foundation 签名（开源项目免费）；首次申请尚未获批，在此之前发布版本未签名。详情见 [Code signing policy](../README.md#code-signing-policy)（英文）。",
),
}
# Блок для пользователей Casemove (под демо-роликом)
CM = {
 'ru': "**Пользовались Casemove?** Сам Casemove теперь показывает уведомление: *«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»* — «Casemove заменён на Skinledger… цены, картинки и предметы в Casemove со временем сломаются» ([исходник](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). Skinledger — платный сервис: бесплатная версия только перекладывает предметы, а быстрая перекладка, покупки в магазине, контракты, Armory, больше аккаунтов, трейды и маркет — по подписке $9.99–24.99 в месяц ([FAQ](https://skinledger.com/#frequently-asked-questions), [тарифы](https://skinledger.com/en/pricing-compare), октябрь 2026). Caskit делает всё это **бесплатно**, без регистрации на чужих сайтах — и с открытым кодом.",
 'uk': "**Користувалися Casemove?** Сам Casemove тепер показує повідомлення: *«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»* — «Casemove замінено на Skinledger… ціни, зображення й предмети в Casemove згодом зламаються» ([джерело](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). Skinledger — платний сервіс: безкоштовна версія лише перекладає предмети, а швидке перекладання, покупки в магазині, контракти, Armory, більше акаунтів, обміни й маркет — за підпискою $9.99–24.99 на місяць ([FAQ](https://skinledger.com/#frequently-asked-questions), [тарифи](https://skinledger.com/en/pricing-compare), жовтень 2026). Caskit робить усе це **безкоштовно**, без реєстрації на чужих сайтах — і з відкритим кодом.",
 'de': "**Du kommst von Casemove?** Casemove zeigt jetzt selbst einen Hinweis: *«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»* ([Quelle](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). Skinledger ist kostenpflichtig: Die Gratisversion verschiebt nur Gegenstände; schnelles Umlagern, Shop-Käufe, Trade-ups, Armory, mehr Konten, Tausch und Markt kosten 9,99–24,99 $ im Monat ([FAQ](https://skinledger.com/#frequently-asked-questions), [Preise](https://skinledger.com/en/pricing-compare), Oktober 2026). Caskit kann das alles **kostenlos**, ohne Konto auf fremden Websites — und als Open Source.",
 'es': "**¿Vienes de Casemove?** Casemove ahora muestra un aviso: *«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»* ([fuente](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). Skinledger es de pago: la versión gratuita solo mueve objetos; los traslados rápidos, las compras en la tienda, los contratos, el Armory, más cuentas, los intercambios y el mercado cuestan 9,99–24,99 $ al mes ([FAQ](https://skinledger.com/#frequently-asked-questions), [precios](https://skinledger.com/en/pricing-compare), octubre de 2026). Caskit hace todo eso **gratis**, sin cuentas en webs ajenas y con código abierto.",
 'pt': "**Vem do Casemove?** O próprio Casemove agora mostra um aviso: *«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»* ([fonte](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). O Skinledger é pago: a versão gratuita só move itens; transferências rápidas, compras na loja, contratos, Armory, mais contas, trocas e mercado custam US$ 9,99–24,99 por mês ([FAQ](https://skinledger.com/#frequently-asked-questions), [preços](https://skinledger.com/en/pricing-compare), outubro de 2026). O Caskit faz tudo isso **de graça**, sem conta em sites de terceiros — e com código aberto.",
 'fr': "**Vous venez de Casemove ?** Casemove affiche désormais un avis : *«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»* ([source](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). Skinledger est payant : la version gratuite ne fait que déplacer les objets ; transferts rapides, achats en boutique, contrats, Armory, comptes supplémentaires, échanges et marché coûtent 9,99–24,99 $ par mois ([FAQ](https://skinledger.com/#frequently-asked-questions), [tarifs](https://skinledger.com/en/pricing-compare), octobre 2026). Caskit fait tout cela **gratuitement**, sans compte sur un site tiers — et en open source.",
 'pl': "**Używałeś Casemove?** Casemove wyświetla teraz komunikat: *«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»* ([źródło](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). Skinledger jest płatny: darmowa wersja tylko przenosi przedmioty, a szybkie przenoszenie, zakupy w sklepie, kontrakty, Armory, więcej kont, wymiany i rynek kosztują 9,99–24,99 $ miesięcznie ([FAQ](https://skinledger.com/#frequently-asked-questions), [cennik](https://skinledger.com/en/pricing-compare), październik 2026). Caskit robi to wszystko **za darmo**, bez konta na cudzych stronach — i z otwartym kodem.",
 'tr': "**Casemove’dan mı geliyorsunuz?** Casemove artık şu uyarıyı gösteriyor: *«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»* ([kaynak](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). Skinledger ücretlidir: ücretsiz sürüm yalnızca eşya taşır; hızlı aktarım, mağaza alımları, kontratlar, Armory, daha fazla hesap, takaslar ve pazar ayda 9,99–24,99 $ ister ([SSS](https://skinledger.com/#frequently-asked-questions), [fiyatlar](https://skinledger.com/en/pricing-compare), Ekim 2026). Caskit bunların hepsini **ücretsiz**, başka sitelerde hesap açmadan ve açık kaynak olarak yapar.",
 'zh': "**之前用过 Casemove？** Casemove 现在会显示停用通知：*«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»*（[源码](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)）。Skinledger 是付费服务：免费版只能移动物品，快速转移、商店购买、汰换合同、军械库、更多账户、交易和市场功能需每月 9.99–24.99 美元订阅（[常见问题](https://skinledger.com/#frequently-asked-questions)、[价格](https://skinledger.com/en/pricing-compare)，2026 年 10 月）。Caskit **免费**提供以上全部功能，无需在任何网站注册账户——并且开源。",
}
# Версия 1.1: цены и портфель, новые скриншоты, VirusTotal, вопросы про обновления и сборку без них
R = 'https://github.com/pythonMaster2002/cs2-storage-manager'
WF = '../.github/workflows/release.yml'
V11 = {
'ru': dict(
 f_acc_4='**Режим стримера** (Ctrl+Shift+H): вместо логинов и ников — «Аккаунт 1, 2…», баланс скрыт, коды Steam Guard, партнёры по трейдам и прокси размыты — можно спокойно снимать видео и скриншоты.',
 f_pr='Цены и портфель',
 f_pr_1='Сколько стоят инвентарь и ящики — по средней цене Steam за 7 дней, Buff163 или Skinport, в вашей валюте; график стоимости по дням и что подорожало или подешевело сильнее всего.',
 f_pr_2='**Портфель (P&L)**: импорт истории Торговой площадки, покупки вручную или из CSV — средняя цена покупки, нереализованная и реализованная прибыль (FIFO).',
 f_pr_3='Цены берутся из публичных прайсов, которые скачиваются раз в 12 часов; ваш инвентарь никуда не отправляется.',
 f_tu_2='Все возможные исходы с **шансами**, float каждого входа, **прогноз float** результата и **ожидаемая стоимость** против цены входов.',
 f_tu_4='После крафта — **прибыль или убыток** контракта, подробный просмотр предмета, **«Осмотреть в игре»** и **Торговая площадка**.',
 f_st_2='Просмотр предмета как в игре: float до 10 знаков, паттерн, счётчик StatTrak™, нейм-тег и износ наклеек; «осмотреть» и ссылка на предмет в инвентаре Steam.',
 f_trade_2='Торговая площадка: лоты, **ордера на покупку со стаканом и графиком цены за 30 дней**, история с поиском, продажа с расчётом комиссии (в том числе прямо из ящиков). Валюты без копеек (UAH, KZT, JPY…) учитываются автоматически.',
 f_acc_1='Несколько аккаунтов одновременно, у каждого свой SOCKS5/HTTP-прокси — настройка и проверка в настройках или вставкой списка. Аккаунты можно закрепить и упорядочить.',
 f_acc_3='10 языков интерфейса. Обновления — только с вашего согласия, или их можно выключить совсем.',
 s_ov='**Обзор**: стоимость, график, самое дорогое', s_pf='**Портфель**: прибыль и убыток (FIFO)',
 s_tu='**Контракт**: исходы, шансы, ожидаемая стоимость', s_craft='**Итог**: прибыль или убыток, просмотр, осмотр, ТП',
 s_item='**Предмет**: float, паттерн, наклейки', s_bo='**Ордер**: стакан и график цены',
 s_cask='**Ящики**: массовая перекладка',
 vt=f'**VirusTotal**: каждый релиз проверяется автоматически — результаты и ссылки внизу [страницы релиза]({R}/releases).',
 faq_4=f'**Безопасны ли автообновления? Не подсунет ли обновление что-то плохое?** Caskit ничего не скачивает и не устанавливает сам. Когда выходит новая версия, он сначала спрашивает — *Обновить*, *Пропустить эту версию* или *Не сейчас*, — а в Настройки → Общие → Обновления можно выбрать *Не проверять*, и проверки не будет вовсе. Обновления берутся только из [Releases]({R}/releases) этого репозитория: их собирает GitHub Actions из открытого кода ([workflow]({WF})), они проверяются на VirusTotal, а установщик сверяет SHA-512 каждого файла перед установкой. Portable-версия не обновляется сама никогда. Если не хотите доверять никаким готовым файлам — соберите Caskit сами (ниже).',
 faq_5='**Можно ли собрать самому?** Да — всё есть в этом репозитории, см. раздел «Сборка из исходников» ниже. Скрипты `:noupdate` собирают версию без обновлений: она даже не спрашивает GitHub о новых версиях.',
 build_1='Нужны Node.js 22+ и Git.', c_noupd='то же без обновлений: никаких проверок, ничего не скачивается',
 rel='**Релиз**: поднимите `version` в `package.json`, затем `git tag vX.Y.Z && git push --tags`. GitHub Actions соберёт все три системы, выложит их в Releases и проверит `.exe` на VirusTotal (секрет `VT_API_KEY`); установленные копии предложат обновиться.',
),
'uk': dict(
 f_acc_4='**Режим стрімера** (Ctrl+Shift+H): замість логінів і ніків — «Акаунт 1, 2…», баланс приховано, коди Steam Guard, партнери з обмінів і проксі розмиті — можна спокійно знімати відео й скриншоти.',
 f_pr='Ціни та портфель',
 f_pr_1='Скільки коштують інвентар і ящики — за середньою ціною Steam за 7 днів, Buff163 або Skinport, у вашій валюті; графік вартості по днях і що найбільше подорожчало чи подешевшало.',
 f_pr_2='**Портфель (P&L)**: імпорт історії Торгового майданчика, покупки вручну або з CSV — середня ціна купівлі, нереалізований і реалізований прибуток (FIFO).',
 f_pr_3='Ціни беруться з публічних прайсів, які завантажуються раз на 12 годин; ваш інвентар нікуди не надсилається.',
 f_tu_2='Усі можливі результати з **шансами**, float кожного входу, **прогноз float** результату та **очікувана вартість** проти ціни входів.',
 f_tu_4='Після крафту — **прибуток або збиток** контракту, детальний перегляд предмета, **«Оглянути в грі»** і **Торговий майданчик**.',
 f_st_2='Перегляд предмета як у грі: float до 10 знаків, патерн, лічильник StatTrak™, нейм-тег і знос наліпок; «оглянути» та посилання на предмет в інвентарі Steam.',
 f_trade_2='Торговий майданчик: лоти, **ордери на купівлю зі стаканом і графіком ціни за 30 днів**, історія з пошуком, продаж із розрахунком комісії (зокрема просто з ящиків). Валюти без копійок (UAH, KZT, JPY…) враховуються автоматично.',
 f_acc_1='Кілька акаунтів одночасно, у кожного свій SOCKS5/HTTP-проксі — налаштування й перевірка в налаштуваннях або вставкою списку. Акаунти можна закріпити й упорядкувати.',
 f_acc_3='10 мов інтерфейсу. Оновлення — лише з вашої згоди, або їх можна вимкнути зовсім.',
 s_ov='**Огляд**: вартість, графік, найдорожче', s_pf='**Портфель**: прибуток і збиток (FIFO)',
 s_tu='**Контракт**: результати, шанси, очікувана вартість', s_craft='**Підсумок**: прибуток або збиток, перегляд, огляд, ТМ',
 s_item='**Предмет**: float, патерн, наліпки', s_bo='**Ордер**: стакан і графік ціни',
 s_cask='**Ящики**: масове перекладання',
 vt=f'**VirusTotal**: кожен реліз перевіряється автоматично — результати й посилання внизу [сторінки релізу]({R}/releases).',
 faq_4=f'**Чи безпечні автооновлення? Чи не підсуне оновлення щось погане?** Caskit нічого не завантажує й не встановлює сам. Коли виходить нова версія, він спершу питає — *Оновити*, *Пропустити цю версію* або *Не зараз*, — а в Налаштування → Загальні → Оновлення можна вибрати *Не перевіряти*, і перевірки не буде взагалі. Оновлення беруться лише з [Releases]({R}/releases) цього репозиторію: їх збирає GitHub Actions з відкритого коду ([workflow]({WF})), вони перевіряються на VirusTotal, а інсталятор звіряє SHA-512 кожного файлу перед встановленням. Portable-версія ніколи не оновлюється сама. Якщо не хочете довіряти жодним готовим файлам — зберіть Caskit самі (нижче).',
 faq_5='**Чи можна зібрати самому?** Так — усе є в цьому репозиторії, див. розділ «Збірка з вихідного коду» нижче. Скрипти `:noupdate` збирають версію без оновлень: вона навіть не питає GitHub про нові версії.',
 build_1='Потрібні Node.js 22+ і Git.', c_noupd='те саме без оновлень: жодних перевірок, нічого не завантажується',
 rel='**Реліз**: підніміть `version` у `package.json`, потім `git tag vX.Y.Z && git push --tags`. GitHub Actions збере всі три системи, викладе їх у Releases і перевірить `.exe` на VirusTotal (секрет `VT_API_KEY`); встановлені копії запропонують оновитися.',
),
}
V11.update({
'de': dict(
 f_acc_4='**Streamer-Modus** (Strg+Umschalt+H): Logins und Nicknames werden zu „Konto 1, 2…“, das Guthaben ist ausgeblendet, Steam-Guard-Codes, Tauschpartner und Proxys sind unscharf – sicher für Videos und Screenshots.',
 f_pr='Preise und Portfolio',
 f_pr_1='Was Inventar und Storage Units wert sind – nach Steam-7-Tage-Durchschnitt, Buff163 oder Skinport, in deiner Währung; ein täglicher Wertverlauf und die größten Gewinner und Verlierer.',
 f_pr_2='**Portfolio (G&V)**: Steam-Markt-Verlauf importieren, Käufe von Hand oder per CSV hinzufügen – durchschnittlicher Kaufpreis, unrealisierter und realisierter Gewinn (FIFO).',
 f_pr_3='Die Preise stammen aus öffentlichen Preislisten, die alle 12 Stunden geladen werden; dein Inventar wird nirgendwohin gesendet.',
 f_tu_2='Alle möglichen Ergebnisse mit **Chance**, der Float jedes Inputs, der **vorhergesagte Float** des Ergebnisses und der **Erwartungswert** gegenüber den Kosten der Inputs.',
 f_tu_4='Nach dem Crafting: **Gewinn oder Verlust** des Vertrags, eine Detailansicht des Gegenstands, **Im Spiel ansehen** und **Community-Markt**.',
 f_st_2='Gegenstandsansicht wie im Spiel: Float auf 10 Stellen, Muster-Seed, StatTrak™-Zähler, Namensschild und Sticker-Abnutzung; Inspect-Links und ein Link zum Gegenstand im Steam-Inventar.',
 f_trade_2='Markt: Angebote, **Kaufaufträge mit Live-Orderbuch und 30-Tage-Preischart**, durchsuchbarer Verlauf, Verkauf mit berechneter Gebühr (auch direkt aus Storage Units). Währungen ohne Cent (UAH, KZT, JPY…) werden automatisch berücksichtigt.',
 f_acc_1='Mehrere Konten gleichzeitig, jedes mit eigenem SOCKS5/HTTP-Proxy – in den Einstellungen festlegen und prüfen oder eine ganze Liste einfügen. Konten anheften und sortieren.',
 f_acc_3='10 Sprachen. Updates nur mit deiner Zustimmung – oder ganz abgeschaltet.',
 s_ov='**Übersicht**: Wert, Verlauf, wertvollste Gegenstände', s_pf='**Portfolio**: Gewinn und Verlust (FIFO)',
 s_tu='**Trade-up**: Ergebnisse, Chancen, Erwartungswert', s_craft='**Ergebnis**: Gewinn oder Verlust, Ansicht, Inspect, Markt',
 s_item='**Gegenstand**: Float, Muster, Sticker', s_bo='**Kaufauftrag**: Orderbuch und Preischart',
 s_cask='**Storage Units**: Massen-Umlagerung',
 vt=f'**VirusTotal**: Jede Version wird automatisch geprüft – Ergebnisse und Links stehen unten auf jeder [Release-Seite]({R}/releases).',
 faq_4=f'**Sind automatische Updates sicher? Kann mir ein Update etwas unterschieben?** Caskit lädt und installiert nichts von selbst. Bei einer neuen Version fragt es zuerst – *Aktualisieren*, *Diese Version überspringen* oder *Nicht jetzt* –, und unter Einstellungen → Allgemein → Updates kannst du *Nicht prüfen* wählen, dann wird nicht einmal geprüft. Updates kommen nur aus den [Releases]({R}/releases) dieses Repositorys: GitHub Actions baut sie aus dem offenen Code ([Workflow]({WF})), sie werden auf VirusTotal geprüft, und der Installer prüft vor der Installation den SHA-512 jeder Datei. Die portable Version aktualisiert sich nie selbst. Wenn du keiner fertigen Datei vertrauen willst – baue Caskit selbst (unten).',
 faq_5='**Kann ich es selbst bauen?** Ja – alles liegt in diesem Repository, siehe «Aus dem Quellcode bauen» unten. Die `:noupdate`-Skripte erzeugen eine Version ohne Updates: Sie fragt GitHub nicht einmal nach neuen Versionen.',
 build_1='Benötigt Node.js 22+ und Git.', c_noupd='dasselbe ohne Updates: keine Prüfung, kein Download',
 rel='**Release**: `version` in `package.json` erhöhen, dann `git tag vX.Y.Z && git push --tags`. GitHub Actions baut alle drei Systeme, veröffentlicht sie unter Releases und prüft die `.exe`-Dateien auf VirusTotal (Secret `VT_API_KEY`); installierte Kopien bieten das Update an.',
),
'es': dict(
 f_acc_4='**Modo streamer** (Ctrl+Mayús+H): los inicios de sesión y apodos pasan a «Cuenta 1, 2…», el saldo se oculta y los códigos de Steam Guard, socios de intercambio y proxies se difuminan: seguro para vídeos y capturas.',
 f_pr='Precios y cartera',
 f_pr_1='Cuánto valen tu inventario y tus unidades de almacenamiento — media de 7 días de Steam, Buff163 o Skinport, en tu moneda; un gráfico diario del valor y lo que más ha subido o bajado.',
 f_pr_2='**Cartera (P&L)**: importa tu historial del Mercado de Steam, añade compras a mano o desde CSV — precio medio de compra, beneficio no realizado y realizado (FIFO).',
 f_pr_3='Los precios vienen de listas públicas que se descargan cada 12 horas; tu inventario no se envía a ningún sitio.',
 f_tu_2='Todos los resultados posibles con su **probabilidad**, el float de cada entrada, el **float previsto** del resultado y el **valor esperado** frente al coste de las entradas.',
 f_tu_4='Tras el contrato: **ganancia o pérdida**, una vista detallada del objeto, **Inspeccionar en el juego** y **Mercado de la Comunidad**.',
 f_st_2='Vista del objeto como en el juego: float con 10 decimales, semilla del patrón, contador StatTrak™, etiqueta de nombre y desgaste de las pegatinas; enlaces para inspeccionar y al objeto en tu inventario de Steam.',
 f_trade_2='Mercado: anuncios, **órdenes de compra con el libro de órdenes en vivo y un gráfico de precio de 30 días**, historial con búsqueda, venta con la comisión calculada (también directamente desde las unidades). Las monedas sin céntimos (UAH, KZT, JPY…) se tienen en cuenta automáticamente.',
 f_acc_1='Varias cuentas a la vez, cada una con su proxy SOCKS5/HTTP — configúralos y compruébalos en Ajustes o pega una lista entera. Fija y ordena las cuentas.',
 f_acc_3='10 idiomas. Actualizaciones solo con tu consentimiento — o desactivadas por completo.',
 s_ov='**Resumen**: valor, gráfico, lo más valioso', s_pf='**Cartera**: ganancias y pérdidas (FIFO)',
 s_tu='**Contrato**: resultados, probabilidades, valor esperado', s_craft='**Resultado**: ganancia o pérdida, ver, inspeccionar, mercado',
 s_item='**Objeto**: float, patrón, pegatinas', s_bo='**Orden de compra**: libro de órdenes y gráfico',
 s_cask='**Unidades**: traslados masivos',
 vt=f'**VirusTotal**: cada versión se analiza automáticamente — los resultados y enlaces están al final de cada [página de versión]({R}/releases).',
 faq_4=f'**¿Son seguras las actualizaciones automáticas? ¿Puede una actualización colarme algo?** Caskit nunca descarga ni instala nada por su cuenta. Cuando sale una versión nueva, primero pregunta — *Actualizar*, *Omitir esta versión* o *Ahora no* — y en Ajustes → General → Actualizaciones puedes elegir *No comprobar* para que ni siquiera compruebe. Las actualizaciones solo vienen de las [Releases]({R}/releases) de este repositorio: las compila GitHub Actions desde el código abierto ([workflow]({WF})), se analizan en VirusTotal y el instalador verifica el SHA-512 de cada archivo antes de instalar. La versión portable nunca se actualiza sola. Si no quieres confiar en ningún binario — compila Caskit tú mismo (abajo).',
 faq_5='**¿Puedo compilarlo yo mismo?** Sí — todo está en este repositorio, mira «Compilar desde el código» abajo. Los scripts `:noupdate` generan una versión sin actualizaciones: ni siquiera consulta a GitHub si hay versiones nuevas.',
 build_1='Necesitas Node.js 22+ y Git.', c_noupd='lo mismo sin actualizaciones: sin comprobaciones ni descargas',
 rel='**Versión**: sube `version` en `package.json` y luego `git tag vX.Y.Z && git push --tags`. GitHub Actions compila los tres sistemas, los publica en Releases y analiza los `.exe` en VirusTotal (secreto `VT_API_KEY`); las copias instaladas ofrecen la actualización.',
),
'pt': dict(
 f_acc_4='**Modo streamer** (Ctrl+Shift+H): logins e apelidos viram “Conta 1, 2…”, o saldo fica oculto, e códigos do Steam Guard, parceiros de troca e proxies ficam borrados — seguro para vídeos e capturas.',
 f_pr='Preços e portfólio',
 f_pr_1='Quanto valem seu inventário e suas unidades de armazenamento — média de 7 dias da Steam, Buff163 ou Skinport, na sua moeda; um gráfico diário do valor e o que mais subiu ou caiu.',
 f_pr_2='**Portfólio (P&L)**: importe seu histórico do Mercado da Steam, adicione compras à mão ou por CSV — preço médio de compra, lucro não realizado e realizado (FIFO).',
 f_pr_3='Os preços vêm de listas públicas baixadas a cada 12 horas; seu inventário não é enviado para lugar nenhum.',
 f_tu_2='Todos os resultados possíveis com a **chance**, o float de cada entrada, o **float previsto** do resultado e o **valor esperado** comparado ao custo das entradas.',
 f_tu_4='Depois do contrato: **lucro ou prejuízo**, uma visualização detalhada do item, **Inspecionar no jogo** e **Mercado da Comunidade**.',
 f_st_2='Visualização do item como no jogo: float com 10 casas, semente do padrão, contador StatTrak™, etiqueta de nome e desgaste dos adesivos; links para inspecionar e para o item no seu inventário Steam.',
 f_trade_2='Mercado: anúncios, **ordens de compra com o livro de ofertas ao vivo e gráfico de preço de 30 dias**, histórico com busca, venda com a taxa calculada (inclusive direto das unidades). Moedas sem centavos (UAH, KZT, JPY…) são tratadas automaticamente.',
 f_acc_1='Várias contas ao mesmo tempo, cada uma com seu proxy SOCKS5/HTTP — configure e teste nas Configurações ou cole uma lista inteira. Fixe e reordene as contas.',
 f_acc_3='10 idiomas. Atualizações só com o seu consentimento — ou totalmente desligadas.',
 s_ov='**Visão geral**: valor, gráfico, itens mais valiosos', s_pf='**Portfólio**: lucro e prejuízo (FIFO)',
 s_tu='**Contrato**: resultados, chances, valor esperado', s_craft='**Resultado**: lucro ou prejuízo, ver, inspecionar, mercado',
 s_item='**Item**: float, padrão, adesivos', s_bo='**Ordem de compra**: livro de ofertas e gráfico',
 s_cask='**Unidades**: transferências em massa',
 vt=f'**VirusTotal**: cada versão é analisada automaticamente — os resultados e links ficam no fim de cada [página de versão]({R}/releases).',
 faq_4=f'**As atualizações automáticas são seguras? Uma atualização pode me enganar?** O Caskit nunca baixa nem instala nada sozinho. Quando sai uma versão nova, ele pergunta antes — *Atualizar*, *Pular esta versão* ou *Agora não* — e em Configurações → Geral → Atualizações você pode escolher *Não verificar* para nem checar. As atualizações vêm só das [Releases]({R}/releases) deste repositório: são compiladas pelo GitHub Actions a partir do código aberto ([workflow]({WF})), analisadas no VirusTotal, e o instalador confere o SHA-512 de cada arquivo antes de instalar. A versão portable nunca se atualiza sozinha. Se não quiser confiar em nenhum binário — compile o Caskit você mesmo (abaixo).',
 faq_5='**Posso compilar eu mesmo?** Sim — está tudo neste repositório, veja «Compilar a partir do código» abaixo. Os scripts `:noupdate` geram uma versão sem atualizações: ela nem pergunta ao GitHub sobre versões novas.',
 build_1='Requer Node.js 22+ e Git.', c_noupd='o mesmo sem atualizações: sem verificações, nada é baixado',
 rel='**Versão**: aumente `version` no `package.json`, depois `git tag vX.Y.Z && git push --tags`. O GitHub Actions compila os três sistemas, publica em Releases e analisa os `.exe` no VirusTotal (segredo `VT_API_KEY`); as cópias instaladas oferecem a atualização.',
),
})
V11.update({
'fr': dict(
 f_acc_4='**Mode streamer** (Ctrl+Maj+H) : identifiants et pseudos deviennent « Compte 1, 2… », le solde est masqué, codes Steam Guard, partenaires d’échange et proxys sont floutés — sans risque pour les vidéos et captures.',
 f_pr='Prix et portefeuille',
 f_pr_1='Ce que valent votre inventaire et vos unités de stockage — moyenne Steam sur 7 jours, Buff163 ou Skinport, dans votre devise ; un graphique quotidien de la valeur et les plus fortes hausses et baisses.',
 f_pr_2='**Portefeuille (P&L)** : importez votre historique du Marché Steam, ajoutez des achats à la main ou par CSV — prix d’achat moyen, plus-value latente et réalisée (FIFO).',
 f_pr_3='Les prix viennent de listes publiques téléchargées toutes les 12 heures ; votre inventaire n’est envoyé nulle part.',
 f_tu_2='Chaque résultat possible avec sa **probabilité**, le float de chaque entrée, le **float prévu** du résultat et la **valeur attendue** face au coût des entrées.',
 f_tu_4='Après le contrat : **gain ou perte**, une vue détaillée de l’objet, **Inspecter en jeu** et **Marché de la communauté**.',
 f_st_2='Vue de l’objet comme en jeu : float à 10 décimales, graine du motif, compteur StatTrak™, étiquette de nom et usure des autocollants ; liens d’inspection et vers l’objet dans votre inventaire Steam.',
 f_trade_2='Marché : annonces, **ordres d’achat avec le carnet d’ordres en direct et un graphique des prix sur 30 jours**, historique avec recherche, vente avec les frais calculés (y compris directement depuis les unités). Les devises sans centimes (UAH, KZT, JPY…) sont gérées automatiquement.',
 f_acc_1='Plusieurs comptes à la fois, chacun avec son proxy SOCKS5/HTTP — à régler et vérifier dans les Paramètres ou en collant une liste. Épinglez et réordonnez les comptes.',
 f_acc_3='10 langues. Mises à jour uniquement avec votre accord — ou complètement désactivées.',
 s_ov='**Vue d’ensemble** : valeur, graphique, objets les plus chers', s_pf='**Portefeuille** : gains et pertes (FIFO)',
 s_tu='**Contrat** : résultats, probabilités, valeur attendue', s_craft='**Résultat** : gain ou perte, voir, inspecter, marché',
 s_item='**Objet** : float, motif, autocollants', s_bo='**Ordre d’achat** : carnet d’ordres et graphique',
 s_cask='**Unités de stockage** : transferts en masse',
 vt=f'**VirusTotal** : chaque version est analysée automatiquement — résultats et liens en bas de chaque [page de version]({R}/releases).',
 faq_4=f'**Les mises à jour automatiques sont-elles sûres ? Une mise à jour peut-elle m’arnaquer ?** Caskit ne télécharge ni n’installe rien de lui-même. Quand une nouvelle version sort, il demande d’abord — *Mettre à jour*, *Ignorer cette version* ou *Plus tard* — et dans Paramètres → Général → Mises à jour vous pouvez choisir *Ne pas vérifier* pour qu’il ne vérifie même plus. Les mises à jour viennent uniquement des [Releases]({R}/releases) de ce dépôt : elles sont compilées par GitHub Actions à partir du code ouvert ([workflow]({WF})), analysées sur VirusTotal, et l’installateur vérifie le SHA-512 de chaque fichier avant l’installation. La version portable ne se met jamais à jour seule. Si vous ne voulez faire confiance à aucun binaire — compilez Caskit vous-même (ci-dessous).',
 faq_5='**Puis-je le compiler moi-même ?** Oui — tout est dans ce dépôt, voir « Compiler depuis les sources » ci-dessous. Les scripts `:noupdate` produisent une version sans mises à jour : elle ne demande même pas à GitHub s’il existe une nouvelle version.',
 build_1='Nécessite Node.js 22+ et Git.', c_noupd='la même chose sans mises à jour : aucune vérification, aucun téléchargement',
 rel='**Publication** : augmentez `version` dans `package.json`, puis `git tag vX.Y.Z && git push --tags`. GitHub Actions compile les trois systèmes, les publie dans Releases et analyse les `.exe` sur VirusTotal (secret `VT_API_KEY`) ; les copies installées proposent la mise à jour.',
),
'pl': dict(
 f_acc_4='**Tryb streamera** (Ctrl+Shift+H): loginy i nicki zmieniają się na „Konto 1, 2…”, saldo jest ukryte, a kody Steam Guard, partnerzy wymian i proxy są rozmyte — bezpiecznie do nagrań i zrzutów ekranu.',
 f_pr='Ceny i portfel',
 f_pr_1='Ile są warte ekwipunek i skrzynie — według 7-dniowej średniej Steam, Buff163 lub Skinport, w Twojej walucie; dzienny wykres wartości oraz największe wzrosty i spadki.',
 f_pr_2='**Portfel (P&L)**: import historii Rynku Steam, zakupy ręcznie lub z CSV — średnia cena zakupu, niezrealizowany i zrealizowany zysk (FIFO).',
 f_pr_3='Ceny pochodzą z publicznych cenników pobieranych co 12 godzin; Twój ekwipunek nigdzie nie jest wysyłany.',
 f_tu_2='Każdy możliwy wynik z **szansą**, float każdego wejścia, **przewidywany float** wyniku i **wartość oczekiwana** w porównaniu z kosztem wejść.',
 f_tu_4='Po kontrakcie: **zysk lub strata**, szczegółowy podgląd przedmiotu, **Obejrzyj w grze** i **Rynek Społeczności**.',
 f_st_2='Podgląd przedmiotu jak w grze: float do 10 miejsc, seed wzoru, licznik StatTrak™, plakietka z nazwą i zużycie naklejek; linki do obejrzenia i do przedmiotu w ekwipunku Steam.',
 f_trade_2='Rynek: oferty, **zlecenia kupna z arkuszem zleceń na żywo i 30-dniowym wykresem ceny**, historia z wyszukiwaniem, sprzedaż z wyliczoną prowizją (także prosto ze skrzyń). Waluty bez groszy (UAH, KZT, JPY…) są uwzględniane automatycznie.',
 f_acc_1='Kilka kont naraz, każde z własnym proxy SOCKS5/HTTP — ustawianie i sprawdzanie w Ustawieniach lub wklejenie całej listy. Przypinanie i zmiana kolejności kont.',
 f_acc_3='10 języków. Aktualizacje tylko za Twoją zgodą — albo całkowicie wyłączone.',
 s_ov='**Przegląd**: wartość, wykres, najcenniejsze przedmioty', s_pf='**Portfel**: zyski i straty (FIFO)',
 s_tu='**Kontrakt**: wyniki, szanse, wartość oczekiwana', s_craft='**Wynik**: zysk lub strata, podgląd, obejrzyj, rynek',
 s_item='**Przedmiot**: float, wzór, naklejki', s_bo='**Zlecenie kupna**: arkusz zleceń i wykres ceny',
 s_cask='**Skrzynie**: masowe przenoszenie',
 vt=f'**VirusTotal**: każde wydanie jest skanowane automatycznie — wyniki i linki są na dole każdej [strony wydania]({R}/releases).',
 faq_4=f'**Czy automatyczne aktualizacje są bezpieczne? Czy aktualizacja może mnie oszukać?** Caskit nic nie pobiera ani nie instaluje sam. Gdy wychodzi nowa wersja, najpierw pyta — *Aktualizuj*, *Pomiń tę wersję* lub *Nie teraz* — a w Ustawienia → Ogólne → Aktualizacje możesz wybrać *Nie sprawdzaj*, żeby nawet nie sprawdzał. Aktualizacje pochodzą tylko z [Releases]({R}/releases) tego repozytorium: buduje je GitHub Actions z otwartego kodu ([workflow]({WF})), są skanowane na VirusTotal, a instalator sprawdza SHA-512 każdego pliku przed instalacją. Wersja portable nigdy nie aktualizuje się sama. Jeśli nie chcesz ufać żadnym gotowym plikom — zbuduj Caskit sam (niżej).',
 faq_5='**Czy mogę zbudować go sam?** Tak — wszystko jest w tym repozytorium, zobacz «Budowanie ze źródeł» niżej. Skrypty `:noupdate` tworzą wersję bez aktualizacji: nawet nie pyta GitHuba o nowe wersje.',
 build_1='Wymaga Node.js 22+ i Git.', c_noupd='to samo bez aktualizacji: bez sprawdzania, nic się nie pobiera',
 rel='**Wydanie**: podnieś `version` w `package.json`, potem `git tag vX.Y.Z && git push --tags`. GitHub Actions zbuduje wszystkie trzy systemy, opublikuje je w Releases i przeskanuje pliki `.exe` na VirusTotal (sekret `VT_API_KEY`); zainstalowane kopie zaproponują aktualizację.',
),
'tr': dict(
 f_acc_4='**Yayıncı modu** (Ctrl+Shift+H): giriş adları ve takma adlar “Hesap 1, 2…” olur, bakiye gizlenir; Steam Guard kodları, takas ortakları ve proxy’ler bulanıklaşır — video ve ekran görüntüsü için güvenli.',
 f_pr='Fiyatlar ve portföy',
 f_pr_1='Envanterinizin ve depolama birimlerinizin değeri — Steam 7 günlük ortalaması, Buff163 veya Skinport fiyatlarıyla, kendi para biriminizde; günlük değer grafiği ve en çok yükselen ve düşenler.',
 f_pr_2='**Portföy (K/Z)**: Steam Pazarı geçmişinizi içe aktarın, alımları elle veya CSV ile ekleyin — ortalama alış fiyatı, gerçekleşmemiş ve gerçekleşmiş kâr (FIFO).',
 f_pr_3='Fiyatlar 12 saatte bir indirilen herkese açık fiyat listelerinden gelir; envanteriniz hiçbir yere gönderilmez.',
 f_tu_2='Olası her sonuç **şansıyla**, her girdinin float’ı, sonucun **tahmini float’ı** ve girdilerin maliyetine karşı **beklenen değer**.',
 f_tu_4='Kontrattan sonra: **kâr veya zarar**, eşyanın ayrıntılı görünümü, **Oyunda incele** ve **Topluluk Pazarı**.',
 f_st_2='Oyundaki gibi eşya görünümü: 10 basamaklı float, desen tohumu, StatTrak™ sayacı, isim etiketi ve çıkartma aşınması; inceleme bağlantıları ve Steam envanterindeki eşyaya bağlantı.',
 f_trade_2='Pazar: ilanlar, **canlı emir defteri ve 30 günlük fiyat grafiğiyle alış emirleri**, aranabilir geçmiş, komisyonu hesaplanmış satış (doğrudan depolama birimlerinden de). Kuruşsuz para birimleri (UAH, KZT, JPY…) otomatik olarak dikkate alınır.',
 f_acc_1='Aynı anda birden çok hesap, her biri kendi SOCKS5/HTTP proxy’siyle — Ayarlar’da belirleyip kontrol edin veya bir liste yapıştırın. Hesapları sabitleyin ve sıralayın.',
 f_acc_3='10 dil. Güncellemeler yalnızca onayınızla — ya da tamamen kapalı.',
 s_ov='**Genel bakış**: değer, grafik, en değerli eşyalar', s_pf='**Portföy**: kâr ve zarar (FIFO)',
 s_tu='**Kontrat**: sonuçlar, şanslar, beklenen değer', s_craft='**Sonuç**: kâr veya zarar, görüntüle, incele, pazar',
 s_item='**Eşya**: float, desen, çıkartmalar', s_bo='**Alış emri**: emir defteri ve fiyat grafiği',
 s_cask='**Depolama birimleri**: toplu aktarım',
 vt=f'**VirusTotal**: her sürüm otomatik olarak taranır — sonuçlar ve bağlantılar her [sürüm sayfasının]({R}/releases) altında.',
 faq_4=f'**Otomatik güncellemeler güvenli mi? Bir güncelleme beni dolandırabilir mi?** Caskit kendi kendine hiçbir şey indirmez veya kurmaz. Yeni sürüm çıktığında önce sorar — *Güncelle*, *Bu sürümü atla* veya *Şimdi değil* — ve Ayarlar → Genel → Güncellemeler’de *Kontrol etme*’yi seçerseniz kontrol bile yapılmaz. Güncellemeler yalnızca bu deponun [Releases]({R}/releases) sayfasından gelir: GitHub Actions bunları açık koddan derler ([workflow]({WF})), VirusTotal’da taranırlar ve kurulum programı kurmadan önce her dosyanın SHA-512’sini doğrular. Portable sürüm asla kendini güncellemez. Hiçbir hazır dosyaya güvenmek istemiyorsanız — Caskit’i kendiniz derleyin (aşağıda).',
 faq_5='**Kendim derleyebilir miyim?** Evet — her şey bu depoda, aşağıdaki «Kaynaktan derleme» bölümüne bakın. `:noupdate` betikleri güncellemesiz bir sürüm üretir: GitHub’a yeni sürüm olup olmadığını bile sormaz.',
 build_1='Node.js 22+ ve Git gerekir.', c_noupd='aynısı güncellemesiz: kontrol yok, hiçbir şey indirilmez',
 rel='**Sürüm**: `package.json` içindeki `version` değerini artırın, ardından `git tag vX.Y.Z && git push --tags`. GitHub Actions üç sistemi derler, Releases’e yükler ve `.exe` dosyalarını VirusTotal’da tarar (`VT_API_KEY` sırrı); kurulu kopyalar güncellemeyi önerir.',
),
'zh': dict(
 f_acc_4='**主播模式**（Ctrl+Shift+H）：登录名和昵称显示为“账户 1、2……”，隐藏余额，Steam 令牌验证码、交易对象和代理会被模糊——录视频、截图都安全。',
 f_pr='价格与投资组合',
 f_pr_1='库存和储物柜值多少钱——按 Steam 7 日均价、Buff163 或 Skinport 价格，以你的货币显示；每日价值曲线以及涨跌最多的物品。',
 f_pr_2='**投资组合（盈亏）**：导入 Steam 市场记录，手动或通过 CSV 添加购买记录——平均买入价、未实现和已实现盈利（先进先出）。',
 f_pr_3='价格来自每 12 小时下载一次的公开价格表；你的库存不会发送到任何地方。',
 f_tu_2='每种可能结果的**概率**、每件输入的磨损值、结果的**预测磨损值**，以及与输入成本对比的**期望价值**。',
 f_tu_4='汰换后：合同的**盈利或亏损**、物品详情、**在游戏中检视**和**社区市场**。',
 f_st_2='像游戏中一样的物品详情：10 位磨损值、图案种子、StatTrak™ 计数、名称标签和印花磨损；检视链接以及 Steam 库存中该物品的链接。',
 f_trade_2='市场：在售、**带实时挂单簿和 30 日价格图的求购订单**、可搜索的历史记录、自动计算手续费的出售（也可直接从储物柜出售）。没有小数单位的货币（UAH、KZT、JPY……）会自动处理。',
 f_acc_1='同时登录多个账户，每个账户使用独立的 SOCKS5/HTTP 代理——在设置中配置和检测，或直接粘贴整个列表。账户可置顶并排序。',
 f_acc_3='10 种界面语言。更新仅在你同意后进行——也可以完全关闭。',
 s_ov='**概览**：价值、曲线、最值钱的物品', s_pf='**投资组合**：盈亏（先进先出）',
 s_tu='**汰换合同**：结果、概率、期望价值', s_craft='**结果**：盈亏、查看、检视、市场',
 s_item='**物品**：磨损、图案、印花', s_bo='**求购订单**：挂单簿和价格图',
 s_cask='**储物柜**：批量转移',
 vt=f'**VirusTotal**：每个版本都会自动扫描——结果和链接位于每个[发布页面]({R}/releases)底部。',
 faq_4=f'**自动更新安全吗？更新会不会坑我？** Caskit 从不自行下载或安装任何东西。有新版本时会先询问你——“更新”、“跳过此版本”或“以后再说”——在 设置 → 常规 → 更新 中选择“不检查”，就连检查也不会进行。更新只来自本仓库的 [Releases]({R}/releases)：由 GitHub Actions 从公开代码构建（[workflow]({WF})），经过 VirusTotal 扫描，安装程序在安装前会校验每个文件的 SHA-512。便携版永远不会自行更新。如果你不想信任任何现成的文件——可以自己构建 Caskit（见下文）。',
 faq_5='**可以自己构建吗？** 可以——所需的一切都在本仓库中，见下方“从源码构建”。`:noupdate` 脚本会构建不含更新功能的版本：它甚至不会向 GitHub 查询新版本。',
 build_1='需要 Node.js 22+ 和 Git。', c_noupd='同上但不含更新：不检查、不下载',
 rel='**发布**：提高 `package.json` 中的 `version`，然后执行 `git tag vX.Y.Z && git push --tags`。GitHub Actions 会构建三个系统、发布到 Releases 并在 VirusTotal 上扫描 `.exe` 文件（密钥 `VT_API_KEY`）；已安装的副本会提示更新。',
),
})

for _c, _e in EXTRA.items():
    T[_c].update(_e)
    T[_c].update(V11[_c])
    T[_c]['cm'] = CM[_c]

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

<p align="center"><img src="screenshots/demo{shots}.gif" alt="Caskit" width="900"></p>

> {cm}

## {features}

**{f_caskets}**
- {f_caskets_1}
- {f_caskets_2}
- {f_caskets_3}

**{f_pr}**
- {f_pr_1}
- {f_pr_2}
- {f_pr_3}

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
- {f_acc_4}
- {f_acc_3}

## {screens}

| | |
|---|---|
| <img src="screenshots/overview{shots}.png" alt="overview"> | <img src="screenshots/portfolio{shots}.png" alt="portfolio"> |
| {s_ov} | {s_pf} |
| <img src="screenshots/tradeup{shots}.png" alt="trade-up"> | <img src="screenshots/craft{shots}.png" alt="result"> |
| {s_tu} | {s_craft} |
| <img src="screenshots/item{shots}.png" alt="item"> | <img src="screenshots/market{shots}.png" alt="buy order"> |
| {s_item} | {s_bo} |
| <img src="screenshots/stickers{shots}.png" alt="stickers"> | <img src="screenshots/store{shots}.png" alt="store"> |
| {s_st} | {s_store} |
| <img src="screenshots/caskets{shots}.png" alt="storage units"> | <img src="screenshots/guard{shots}.png" alt="Steam Guard"> |
| {s_cask} | {s_guard} |

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

{vt}

### {un}

- {un_win}
- {un_mac}
- {un_lin}

{un_data}

## {sec}

- {sec_1}
- {sec_2}
- {sec_3}
- {sec_4}
- {priv}

## {faq}

{faq_1}

{faq_2}

{faq_4}

{faq_5}

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
git clone {repo}
cd cs2-storage-manager
npm ci
npm start                      # {c_run}
npm run build:win              # {c_win}
npm run build:linux            # AppImage + deb
npm run build:mac              # {c_mac}

# {c_noupd}
npm run build:win:noupdate
npm run build:linux:noupdate
npm run build:mac:noupdate
```

{rel}

## {csp}

{csp_1}

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
