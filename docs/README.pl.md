<p align="center"><img src="../build/icon.png" width="120" alt="Caskit"></p>

<h1 align="center">Caskit</h1>

<p align="center"><b>Darmowy menedżer pojemników (Storage Unit) i ekwipunku CS2 o otwartym kodzie.</b><br>
Szybkie przenoszenie, szanse kontraktów, naklejki, sklep, rynek i Steam Guard — dla kilku kont naraz.<br>
Bez subskrypcji i zewnętrznych serwerów: wszystko działa na twoim komputerze i łączy się bezpośrednio ze Steam.</p>

<p align="center">
<a href="https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest"><img src="https://img.shields.io/github/v/release/pythonMaster2002/cs2-storage-manager?label=pobierz&color=2d73ff" alt="release"></a>
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
<a href="README.pt.md">Português</a> ·
<a href="README.fr.md">Français</a> ·
<b>Polski</b> ·
<a href="README.tr.md">Türkçe</a> ·
<a href="README.zh.md">简体中文</a>
</p>

<p align="center"><img src="screenshots/demo.gif" alt="Caskit" width="900"></p>

> **Używałeś Casemove?** Jego ostatnie wydanie ukazało się w grudniu 2024. Caskit robi to samo z pojemnikami, a do tego szanse i floaty kontraktów, naklejki, sklep CS2, wymiany i Rynek, wbudowany Steam Guard oraz kilka kont z własnymi proxy — i jest aktywnie rozwijany.

## Funkcje

**Pojemniki (Storage Unit)**
- Masowe przenoszenie przedmiotów do pojemników i z powrotem. Tempo samo dopasowuje się do limitów Steam (zwykle 8–13 przedmiotów/s), a zablokowane przedmioty są automatycznie ponawiane.
- **Reguły przenoszenia**: „wszystkie skrzynie → Cases 01, Cases 02…”, „naklejki → Stickers”. Jednym kliknięciem albo zaraz po zalogowaniu.
- Zmiana nazw pojemników, ukrywanie pełnych, eksport wszystkiego do JSON/CSV.

**Kontrakty wymiany**
- Kontrakty z ekwipunku *i* z pojemników (przedmioty wyjmowane są automatycznie).
- Wszystkie możliwe wyniki z **szansą**, float każdego wejścia i **przewidywany float** wyniku na pasku zużycia.
- Przedmioty, których gra nie przyjmie (najwyższa jakość w kolekcji), są oznaczane z góry. Pamiątki (souvenir) są obsługiwane.
- Po kontrakcie: **Obejrzyj w grze** i **Na Rynku Społeczności**.

**Naklejki**
- Naklejanie, zdrapywanie i usuwanie naklejek — także z dowolnym umieszczeniem w CS2.
- Float broni z paskiem zużycia, zużycie naklejek, linki podglądu i link do przedmiotu w ekwipunku Steam.

**Sklep CS2 i Armory**
- Koszyk, ulubione, saldo portfela i saldo po zakupie. Każdą płatność potwierdzasz sam.
- Armory: wymiana gwiazdek na nagrody.
- Nazwy i obrazki produktów aktualizują się same z plików gry.

**Wymiany, Rynek i Steam Guard**
- Oferty przychodzące i wychodzące, akceptuj/odrzuć, automatyczne przyjmowanie prezentów.
- Oferty sprzedaży, zlecenia kupna, historia z wyszukiwaniem, sprzedaż z wyliczoną prowizją.
- Wbudowany mini-**SDA**: kody Steam Guard dla wszystkich kont z maFile, potwierdzenia wymian i ofert, kontrola proxy.

**Konta i prywatność**
- Kilka kont jednocześnie, każde z własnym proxy SOCKS5/HTTP.
- Logowanie **kodem QR** (pojawia się od razu), loginem i hasłem albo przez **maFile**.
- 10 języków, automatyczne aktualizacje (wersja z instalatorem).

## Zrzuty ekranu

| | |
|---|---|
| <img src="screenshots/tradeup.png" alt="trade-up"> | <img src="screenshots/craft.png" alt="result"> |
| **Kontrakt**: wyniki, szanse, floaty | **Wynik**: obejrzyj w grze lub otwórz na rynku |
| <img src="screenshots/stickers.png" alt="stickers"> | <img src="screenshots/store.png" alt="store"> |
| **Naklejki**: naklej, zdrap, usuń | **Sklep CS2**: koszyk i portfel |
| <img src="screenshots/overview.png" alt="overview"> | <img src="screenshots/guard.png" alt="Steam Guard"> |
| **Przegląd** jednego lub wszystkich kont | **Steam Guard**: kody i potwierdzenia |

## Pobierz

Najnowsza wersja jest na stronie **[Releases](https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest)**.

| System | Plik | |
|---|---|---|
| Windows | `Caskit-Setup-x.y.z.exe` | **zalecane** — instaluje się w kilka sekund, bez uprawnień administratora, aktualizuje się samo |
| Windows | `Caskit-x.y.z-portable.exe` | bez instalacji (uruchamia się wolniej, aktualizacja ręczna) |
| macOS | `Caskit-x.y.z-arm64.dmg` (Apple Silicon) / `Caskit-x.y.z-x64.dmg` (Intel) | |
| Linux | `Caskit-x.y.z-x86_64.AppImage` lub `Caskit-x.y.z-amd64.deb` | |

**Pierwsze uruchomienie.** Wersje nie są jeszcze podpisane cyfrowo, więc system może raz ostrzec:

- **Windows** („System Windows ochronił ten komputer”): **Więcej informacji → Uruchom mimo to**.
- **macOS** („aplikacja jest uszkodzona” / „nie można zweryfikować”): prawy klik na aplikację → **Otwórz** albo w Terminalu `xattr -cr "/Applications/Caskit.app"`.
- **Linux AppImage**: `chmod +x Caskit-*.AppImage`, potem uruchom.

### Odinstalowanie

- **Windows (instalator)**: Ustawienia → Aplikacje → **Caskit** → Odinstaluj. **Portable**: po prostu usuń `.exe`.
- **macOS**: przeciągnij **Caskit** z Aplikacji do Kosza.
- **Linux**: usuń AppImage albo `sudo apt remove caskit` dla `.deb`.

Zapisane logowania i ustawienia zostają w folderze danych (zobacz FAQ) — usuń go też, aby skasować wszystko.

## Bezpieczeństwo i prywatność

- Caskit łączy się tylko ze Steam (i Game Coordinatorem CS2). Hasło nigdy nie jest zapisywane; refresh token i sekrety maFile są przechowywane na twoim dysku **zaszyfrowane** przez system (Windows DPAPI / pęk kluczy macOS / libsecret w Linuksie).
- Jeśli konto ma proxy, przez nie idzie *cały* ruch konta — zapytania WWW, kod QR, awatar. Gdy proxy nie działa, logowanie zostaje przerwane zamiast iść bezpośrednio.
- Lokalne API nasłuchuje tylko na `127.0.0.1` i wymaga losowego tokenu znanego tylko oknu aplikacji.
- Nazwy i ikony są raz dziennie aktualizowane z publicznych kopii plików gry ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — bez danych kont.
- Bez analityki i telemetrii. Pełna lista połączeń sieciowych w **[polityce prywatności](../PRIVACY.md)** (po angielsku).

## FAQ

**Czy można dostać bana VAC?** Caskit nie dotyka gry, jej plików ani pamięci i nie uruchamia CS2. Loguje się jako klient Steam i rozmawia z Game Coordinatorem CS2 tak samo jak ekwipunek samej gry, więc VAC nie bierze w tym udziału. To jednak nieoficjalne narzędzie — używasz na własne ryzyko.

**Czy mogę grać, gdy Caskit jest otwarty?** Jeśli uruchomisz CS2 na tym samym koncie, Steam zostawi tylko jedną z dwóch sesji. Najpierw wyloguj to konto w Caskit.

**Gdzie są moje dane?** Tylko na twoim komputerze: `%APPDATA%\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).

## Wesprzyj projekt

Caskit jest darmowy i taki zostanie. Jeśli oszczędza ci czas:

- ☕ [Ko-fi](https://ko-fi.com/mikidjus) — kartą lub PayPal
- 🎁 [Podaruj skina](https://steamcommunity.com/tradeoffer/new/?partner=146040317&token=Q_pa1oMK) — dowolną zbędną skrzynię lub skina
- 💎 Krypto (Binance Pay / USDT) — adresy w aplikacji: przycisk ♥
- ⭐ Gwiazdka dla repozytorium

## Budowanie ze źródeł

Wymaga Node.js 22+.

```bash
npm ci
npm start              # uruchom
npm run build:win      # instalator + portable → dist/
npm run build:linux    # AppImage + deb
npm run build:mac      # dmg + zip (tylko na macOS)
```

**Wydanie**: podnieś `version` w `package.json`, potem `git tag vX.Y.Z && git push --tags`. GitHub Actions zbuduje wszystkie trzy systemy i opublikuje je w Releases; zainstalowane kopie zaktualizują się same.

## Zasady podpisywania kodu

Wersje dla Windows są budowane z tego repozytorium w GitHub Actions i podpisywane przez SignPath (bezpłatnie dla open source, certyfikat SignPath Foundation). Szczegóły: [Code signing policy](../README.md#code-signing-policy) (po angielsku).

## Licencja

[MIT](../LICENSE)

Caskit to niezależny projekt open source, niezwiązany z Valve Corporation i przez nią niepopierany. Counter-Strike, CS2 i Steam są znakami towarowymi Valve Corporation.
