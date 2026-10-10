<p align="center"><img src="../build/icon.png" width="120" alt="Caskit"></p>

<h1 align="center">Caskit</h1>

<p align="center"><b>Kostenloser Open-Source-Manager für CS2-Lagereinheiten und Inventar.</b><br>
Schnelles Umlagern, Trade-up-Chancen, Sticker, Shop, Markt und Steam Guard — für mehrere Konten gleichzeitig.<br>
Keine Abos, keine Fremdserver: Alles läuft auf deinem Rechner und spricht direkt mit Steam.</p>

<p align="center">
<a href="https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest"><img src="https://img.shields.io/github/v/release/pythonMaster2002/cs2-storage-manager?label=Download&color=2d73ff" alt="release"></a>
<a href="https://github.com/pythonMaster2002/cs2-storage-manager/releases"><img src="https://img.shields.io/github/downloads/pythonMaster2002/cs2-storage-manager/total?color=06bfff" alt="downloads"></a>
<img src="https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-informational" alt="platforms">
<img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
<a href="https://ko-fi.com/mikidjus"><img src="https://img.shields.io/badge/Ko--fi-support-ff5e5b?logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
</p>

<p align="center">
<a href="../README.md">English</a> ·
<a href="README.ru.md">Русский</a> ·
<a href="README.uk.md">Українська</a> ·
<b>Deutsch</b> ·
<a href="README.es.md">Español</a> ·
<a href="README.pt.md">Português</a> ·
<a href="README.fr.md">Français</a> ·
<a href="README.pl.md">Polski</a> ·
<a href="README.tr.md">Türkçe</a> ·
<a href="README.zh.md">简体中文</a>
</p>

<p align="center"><img src="screenshots/demo.gif" alt="Caskit" width="900"></p>

> **Du kommst von Casemove?** Casemove zeigt jetzt selbst einen Hinweis: *«Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually»* ([Quelle](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). Skinledger ist kostenpflichtig: Die Gratisversion verschiebt nur Gegenstände; schnelles Umlagern, Shop-Käufe, Trade-ups, Armory, mehr Konten, Tausch und Markt kosten 9,99–24,99 $ im Monat ([FAQ](https://skinledger.com/#frequently-asked-questions), [Preise](https://skinledger.com/en/pricing-compare), Oktober 2026). Caskit kann das alles **kostenlos**, ohne Konto auf fremden Websites — und als Open Source.

## Funktionen

**Lagereinheiten**
- Gegenstände massenhaft ein- und auslagern. Das Tempo passt sich den Steam-Limits an (meist 8–13 Gegenstände/s), hängende Gegenstände werden automatisch erneut gesendet.
- **Umlagerungsregeln**: „alle Kisten → Cases 01, Cases 02…“, „Sticker → Stickers“. Per Klick oder direkt nach dem Anmelden.
- Einheiten umbenennen, volle ausblenden, alles als JSON/CSV exportieren.

**Tauschverträge (Trade-ups)**
- Verträge aus dem Inventar *und* aus Lagereinheiten (Gegenstände werden automatisch herausgenommen).
- Alle möglichen Ergebnisse mit **Chance**, Float jeder Eingabe und **erwartetem Float** des Ergebnisses auf einer Abnutzungsleiste.
- Gegenstände, die das Spiel nicht annimmt (höchste Stufe ihrer Kollektion), werden vorab markiert. Souvenirs werden unterstützt.
- Nach dem Vertrag: **Im Spiel ansehen** und **Auf dem Community-Markt**.

**Sticker**
- Sticker anbringen, abkratzen und entfernen — auch frei platzierte CS2-Sticker.
- Waffen-Float mit Abnutzungsleiste, Sticker-Abnutzung, Inspektionslinks und Link zum Gegenstand im Steam-Inventar.

**CS2-Shop und Armory**
- Warenkorb, Favoriten, Guthaben und Restguthaben nach dem Kauf. Jede Zahlung bestätigst du selbst.
- Armory: Sterne gegen Belohnungen einlösen.
- Namen und Bilder der Artikel aktualisieren sich selbst aus den Spieldateien.

**Tausch, Community-Markt und Steam Guard**
- Eingehende und ausgehende Angebote, annehmen/ablehnen, Geschenke automatisch annehmen.
- Angebote, Kaufaufträge, durchsuchbarer Verlauf, Verkauf mit berechneter Gebühr.
- Eingebauter Mini-**SDA**: Steam-Guard-Codes für alle Konten mit maFile, Bestätigungen für Tausch und Angebote, Proxy-Überwachung.

**Konten und Privatsphäre**
- Mehrere Konten gleichzeitig, jedes mit eigenem SOCKS5/HTTP-Proxy.
- Anmeldung per **QR-Code** (erscheint sofort), Login und Passwort oder **maFile**.
- 10 Sprachen, automatische Updates (Installer-Version).

## Screenshots

| | |
|---|---|
| <img src="screenshots/tradeup.png" alt="trade-up"> | <img src="screenshots/craft.png" alt="result"> |
| **Trade-up**: Ergebnisse, Chancen, Floats | **Ergebnis**: im Spiel ansehen oder auf dem Markt öffnen |
| <img src="screenshots/stickers.png" alt="stickers"> | <img src="screenshots/store.png" alt="store"> |
| **Sticker**: anbringen, abkratzen, entfernen | **CS2-Shop**: Warenkorb und Guthaben |
| <img src="screenshots/overview.png" alt="overview"> | <img src="screenshots/guard.png" alt="Steam Guard"> |
| **Übersicht** eines oder aller Konten | **Steam Guard**: Codes und Bestätigungen |

## Download

Die neueste Version gibt es unter **[Releases](https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest)**.

| System | Datei | |
|---|---|---|
| Windows | `Caskit-Setup-x.y.z.exe` | **empfohlen** — in Sekunden installiert, ohne Adminrechte, aktualisiert sich selbst |
| Windows | `Caskit-x.y.z-portable.exe` | ohne Installation (startet langsamer, manuell aktualisieren) |
| macOS | `Caskit-x.y.z-arm64.dmg` (Apple Silicon) / `Caskit-x.y.z-x64.dmg` (Intel) | |
| Linux | `Caskit-x.y.z-x86_64.AppImage` oder `Caskit-x.y.z-amd64.deb` | |

**Erster Start.** Die Builds sind noch nicht signiert, daher warnt das System eventuell einmal:

- **Windows** („Der Computer wurde durch Windows geschützt“): **Weitere Informationen → Trotzdem ausführen**.
- **macOS** („App ist beschädigt“ / „kann nicht überprüft werden“): Rechtsklick auf die App → **Öffnen** oder im Terminal `xattr -cr "/Applications/Caskit.app"`.
- **Linux AppImage**: `chmod +x Caskit-*.AppImage`, dann starten.

**VirusTotal-Scan** (v1.0.0): [Installer – 0/67](https://www.virustotal.com/gui/file/9c1ad7cc654280aafbcb21ae29a42f52e18aa85704d05feb731fcd82c8ed8f22), [Portable – 0/66](https://www.virustotal.com/gui/file/26894b8fbed549bd5108a604686b22c1a3416b089f870b442b207eac8c2d57f9).

### Deinstallieren

- **Windows (Installer)**: Einstellungen → Apps → **Caskit** → Deinstallieren. **Portable**: einfach die `.exe` löschen.
- **macOS**: **Caskit** aus „Programme“ in den Papierkorb ziehen.
- **Linux**: AppImage löschen oder `sudo apt remove caskit` für das `.deb`.

Gespeicherte Anmeldungen und Einstellungen bleiben im Datenordner (siehe FAQ) — lösche ihn ebenfalls, um alles zu entfernen.

## Sicherheit und Privatsphäre

- Caskit spricht nur mit Steam (und dem CS2 Game Coordinator). Dein Passwort wird nie gespeichert; Refresh-Token und maFile-Geheimnisse liegen **verschlüsselt** durch das System auf deiner Festplatte (Windows DPAPI / macOS-Schlüsselbund / libsecret unter Linux).
- Hat ein Konto einen Proxy, läuft *der gesamte* Verkehr darüber — Webanfragen, QR-Code, Avatar. Fällt der Proxy aus, bricht die Anmeldung ab, statt direkt zu verbinden.
- Die lokale API lauscht nur auf `127.0.0.1` und verlangt ein zufälliges Token, das nur das App-Fenster kennt.
- Namen und Icons werden einmal täglich aus öffentlichen Kopien der Spieldateien aktualisiert ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — ohne Kontodaten.
- Keine Analyse, keine Telemetrie. Alle Netzwerkverbindungen stehen in der **[Datenschutzerklärung](../PRIVACY.md)** (Englisch).

## FAQ

**Kann ich dafür einen VAC-Bann bekommen?** Caskit greift weder auf das Spiel noch auf dessen Dateien oder Speicher zu und startet CS2 nicht. Es meldet sich als Steam-Client an und spricht mit dem CS2 Game Coordinator wie das Inventar des Spiels selbst — VAC ist nicht beteiligt. Es bleibt ein inoffizielles Tool, Nutzung auf eigenes Risiko.

**Kann ich spielen, während Caskit offen ist?** Startest du CS2 auf demselben Konto, behält Steam nur eine der beiden Sitzungen. Melde das Konto vorher in Caskit ab.

**Wo liegen meine Daten?** Nur auf deinem Rechner: `%APPDATA%\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).

## Projekt unterstützen

Caskit ist kostenlos und bleibt es. Wenn es dir Zeit spart:

- ☕ [Ko-fi](https://ko-fi.com/mikidjus) — Karte oder PayPal
- 🎁 [Skin schenken](https://steamcommunity.com/tradeoffer/new/?partner=146040317&token=Q_pa1oMK) — jede übrige Kiste oder jeder Skin
- 💎 Krypto (Binance Pay / USDT) — Adressen in der App: ♥-Button
- ⭐ Stern für das Repository

## Aus dem Quellcode bauen

Benötigt Node.js 22+.

```bash
npm ci
npm start              # starten
npm run build:win      # Installer + Portable → dist/
npm run build:linux    # AppImage + deb
npm run build:mac      # dmg + zip (nur unter macOS)
```

**Release**: `version` in `package.json` erhöhen, dann `git tag vX.Y.Z && git push --tags`. GitHub Actions baut alle drei Systeme und veröffentlicht sie unter Releases; installierte Kopien aktualisieren sich selbst.

## Code-Signing-Richtlinie

Windows-Builds werden per GitHub Actions aus diesem Repository erstellt. Die Signierung ist über die SignPath Foundation geplant (kostenlos für Open Source); der erste Antrag wurde noch nicht genehmigt – bis dahin sind die Builds unsigniert. Details: [Code signing policy](../README.md#code-signing-policy) (Englisch).

## Lizenz

[MIT](../LICENSE)

Caskit ist ein unabhängiges Open-Source-Projekt, nicht mit Valve Corporation verbunden oder von ihr unterstützt. Counter-Strike, CS2 und Steam sind Marken der Valve Corporation.
