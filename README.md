<p align="center"><img src="build/icon.png" width="120" alt="Caskit"></p>

<h1 align="center">Caskit</h1>

<p align="center"><b>Free, open-source CS2 storage unit &amp; inventory manager.</b><br>
Fast transfers, trade-up odds, stickers, store, market and Steam Guard — for several accounts at once.<br>
No subscriptions, no third-party servers: everything runs on your computer and talks to Steam directly.</p>

<p align="center">
<a href="https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest"><img src="https://img.shields.io/github/v/release/pythonMaster2002/cs2-storage-manager?label=download&color=2d73ff" alt="Latest release"></a>
<a href="https://github.com/pythonMaster2002/cs2-storage-manager/releases"><img src="https://img.shields.io/github/downloads/pythonMaster2002/cs2-storage-manager/total?color=06bfff" alt="Downloads"></a>
<img src="https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-informational" alt="Platforms">
<img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
<a href="https://ko-fi.com/mikidjus"><img src="https://img.shields.io/badge/Ko--fi-support-ff5e5b?logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
</p>

<p align="center">
<b>English</b> ·
<a href="docs/README.ru.md">Русский</a> ·
<a href="docs/README.uk.md">Українська</a> ·
<a href="docs/README.de.md">Deutsch</a> ·
<a href="docs/README.es.md">Español</a> ·
<a href="docs/README.pt.md">Português</a> ·
<a href="docs/README.fr.md">Français</a> ·
<a href="docs/README.pl.md">Polski</a> ·
<a href="docs/README.tr.md">Türkçe</a> ·
<a href="docs/README.zh.md">简体中文</a>
</p>

<p align="center"><img src="docs/screenshots/demo.gif" alt="Caskit: inventory value, storing cases into a storage unit, a trade-up with outcome chances and its profit or loss" width="900"></p>

> **Coming from Casemove?** Casemove now shows a deprecation notice: *“Casemove has been replaced by Skinledger… Prices, images and items will break in Casemove eventually”* ([source](https://github.com/nombersDev/casemove/blob/main/src/renderer/components/content/shared/infoModal.tsx)). Skinledger is a paid service: its free version only moves items, while fast transfers, store purchases, trade-ups, Armory, more accounts, trades and market tools need a subscription of $9.99–24.99 per month ([FAQ](https://skinledger.com/#frequently-asked-questions), [pricing](https://skinledger.com/en/pricing-compare), October 2026). Caskit does all of that **for free**, with no account on anyone's website — and the code is open.

## Features

**Storage units**
- Move items into and out of storage units in bulk. The speed tunes itself to Steam's limits (usually 8–13 items/s), and stuck items are retried automatically.
- **Transfer rules**: “all cases → Cases 01, Cases 02…”, “stickers → Stickers”. Run them with one click or right after sign-in.
- Rename units, hide full ones, and export everything to JSON/CSV.

**Prices and portfolio**
- What your inventory and storage units are worth — Steam 7-day average, Buff163 or Skinport prices, in your currency — with a daily value chart and the biggest gainers and losers.
- **Portfolio (P&L)**: import your Steam Market history, add purchases by hand or from CSV, and see the average buy price, unrealized and realized profit (FIFO).
- Prices come from public price lists downloaded every 12 hours; your inventory is never sent anywhere.

**Trade-up contracts**
- Build contracts from your inventory *and* from storage units (items are taken out automatically).
- See every possible outcome with its **chance**, the float of each input, the **predicted float** of the result and the **expected value** against what the inputs cost.
- Items the game won't accept (top grade of their collection) are marked in advance. Souvenirs are supported.
- After crafting: the **profit or loss** of the contract, a detailed item view, **Inspect in game** and **Community Market**.

**Stickers**
- Apply, scrape and remove stickers — including CS2 free-placement stickers.
- An item view like in the game: float to 10 digits, pattern seed, StatTrak™ counter, name tag and sticker wear; inspect links and a link to the item in your Steam inventory.

**CS2 Store and Armory**
- Cart, favourites, wallet balance and the balance left after purchase. Every payment is confirmed by you.
- Armory: redeem stars for rewards.
- Item names and icons update by themselves from the game files.

**Trades, Market and Steam Guard**
- Incoming and outgoing trade offers, accept/decline, auto-accept gifts.
- Market: listings, **buy orders with the live order book and a 30-day price chart**, searchable history, selling with the fee calculated for you (straight from storage units too). Currencies without cents (UAH, KZT, JPY…) are handled automatically.
- A small **SDA** built in: Steam Guard codes for every account with a maFile, trade and listing confirmations, proxy health monitoring.

**Accounts and privacy**
- Several accounts at once, each with its own SOCKS5/HTTP proxy — set and check them in Settings or paste a whole list. Pin and reorder accounts.
- Sign in with a **QR code** (it shows up instantly), a login and password, or a **maFile**.
- **Streamer mode** (Ctrl+Shift+H): logins and nicknames become “Account 1, 2…”, the balance is hidden, Steam Guard codes, trade partners and proxies are blurred — safe for videos and screenshots.
- 10 interface languages. Updates only with your consent — or turned off completely.

## Screenshots

| | |
|---|---|
| <img src="docs/screenshots/overview.png" alt="Overview"> | <img src="docs/screenshots/portfolio.png" alt="Portfolio"> |
| **Overview**: value, chart, most valuable items | **Portfolio**: profit and loss (FIFO) |
| <img src="docs/screenshots/tradeup.png" alt="Trade-up odds"> | <img src="docs/screenshots/craft.png" alt="Trade-up result"> |
| **Trade-up**: outcomes, chances, expected value | **Result**: profit or loss, view, inspect, market |
| <img src="docs/screenshots/item.png" alt="Item view"> | <img src="docs/screenshots/market.png" alt="Buy order"> |
| **Item view**: float, pattern, stickers | **Buy order**: order book and price chart |
| <img src="docs/screenshots/stickers.png" alt="Stickers"> | <img src="docs/screenshots/store.png" alt="Store"> |
| **Stickers**: apply, scrape, remove | **CS2 Store**: cart and wallet |
| <img src="docs/screenshots/caskets.png" alt="Storage units"> | <img src="docs/screenshots/guard.png" alt="Steam Guard"> |
| **Storage units**: bulk transfers | **Steam Guard**: codes and confirmations |

## Download

Get the latest version on the **[Releases](https://github.com/pythonMaster2002/cs2-storage-manager/releases/latest)** page.

| System | File | |
|---|---|---|
| Windows | `Caskit-Setup-x.y.z.exe` | **recommended** — installs in a few seconds, no admin rights, updates itself |
| Windows | `Caskit-x.y.z-portable.exe` | no installation (starts slower, update manually) |
| macOS | `Caskit-x.y.z-arm64.dmg` (Apple Silicon) / `Caskit-x.y.z-x64.dmg` (Intel) | |
| Linux | `Caskit-x.y.z-x86_64.AppImage` or `Caskit-x.y.z-amd64.deb` | |

**First launch.** The builds are not code-signed yet, so the system may warn you once:

- **Windows** (“Windows protected your PC”): click **More info → Run anyway**.
- **macOS** (“app is damaged” / “can't be checked”): right-click the app → **Open**, or run `xattr -cr "/Applications/Caskit.app"` in Terminal.
- **Linux AppImage**: `chmod +x Caskit-*.AppImage`, then run it.

**VirusTotal**: every release is scanned automatically — the results and links are at the bottom of each [release page](https://github.com/pythonMaster2002/cs2-storage-manager/releases).

### Uninstall

- **Windows (installer)**: Settings → Apps → **Caskit** → Uninstall. **Portable**: just delete the `.exe`.
- **macOS**: drag **Caskit** from Applications to the Trash.
- **Linux**: delete the AppImage, or `sudo apt remove caskit` for the `.deb`.

Your saved sign-ins and settings stay in the data folder (see [FAQ](#faq)); delete it as well to remove everything.

## Security and privacy

- Caskit talks only to Steam (and the CS2 Game Coordinator). Your password is never stored; the refresh token and maFile secrets are kept on your disk **encrypted** by the OS (Windows DPAPI / macOS Keychain / libsecret on Linux).
- If an account has a proxy, *all* its traffic goes through it, including web requests, the QR code and the avatar. If the proxy is down, sign-in stops instead of going direct.
- The local API listens on `127.0.0.1` only and requires a random token known only to the app window.
- Item names and icons are refreshed once a day from public mirrors of the game files ([GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) — no account data is sent.
- No analytics, no telemetry. Full list of network connections: **[Privacy policy](PRIVACY.md)**.

## FAQ

**Can I get a VAC ban for this?** Caskit doesn't touch the game, its files or its memory, and doesn't launch CS2. It signs in as a Steam client and talks to the CS2 Game Coordinator the same way the game's own inventory does, so VAC isn't involved. It is still an unofficial tool, so use it at your own risk.

**Can I play while Caskit is open?** If you start CS2 on the same account, Steam keeps only one of the two sessions. Sign out of that account in Caskit first.

**Are automatic updates safe? Can an update scam me?** Caskit never downloads or installs anything on its own. When a new version is out it asks you first — *Update*, *Skip this version* or *Not now* — and in Settings → General → Updates you can choose *Don't check* to stop even the check. Updates come only from this repository's [Releases](https://github.com/pythonMaster2002/cs2-storage-manager/releases): they are built by GitHub Actions from the public code ([workflow](.github/workflows/release.yml)), scanned on VirusTotal, and the installer verifies each file's SHA-512 before installing. The portable version never updates itself. If you don't want to trust any binary at all — build Caskit yourself (below).

**Can I build it myself?** Yes — everything is in this repository, see [Build from source](#build-from-source). The `:noupdate` scripts make a build with updates removed: it never even asks GitHub for a new version.

**Where is my data?** Only on your computer: `%APPDATA%\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).

## Support the project

Caskit is free and always will be. If it saves you time:

- ☕ [Ko-fi](https://ko-fi.com/mikidjus) — card or PayPal
- 🎁 [Send a skin](https://steamcommunity.com/tradeoffer/new/?partner=146040317&token=Q_pa1oMK) — any spare case or skin
- 💎 Crypto (Binance Pay / USDT) — addresses in the app: ♥ button
- ⭐ Star this repository

## Build from source

Requires Node.js 22+ and Git.

```bash
git clone https://github.com/pythonMaster2002/cs2-storage-manager
cd cs2-storage-manager
npm ci
npm start                      # run
npm run build:win              # installer + portable → dist/
npm run build:linux            # AppImage + deb
npm run build:mac              # dmg + zip (macOS only)

# the same without updates: no update checks, nothing is downloaded
npm run build:win:noupdate
npm run build:linux:noupdate
npm run build:mac:noupdate
```

**Release**: bump `version` in `package.json`, then `git tag vX.Y.Z && git push --tags`. GitHub Actions builds all three systems, publishes them to Releases and scans the `.exe` files on VirusTotal (secret `VT_API_KEY`); installed copies offer the update.

## Code signing policy

Windows releases are built from this repository by [GitHub Actions](.github/workflows/release.yml) and are intended to be signed through SignPath. Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).
*Status: our first application was not approved yet (the project is new), so releases are currently unsigned. We will reapply.*

- Committers and reviewers: [@pythonMaster2002](https://github.com/pythonMaster2002)
- Approvers: [@pythonMaster2002](https://github.com/pythonMaster2002)

Every signed release is built by CI from a tagged commit and manually approved before signing.
Privacy: see the [privacy policy](PRIVACY.md) — Caskit has no telemetry and sends data only to the services listed there.

## License

[MIT](LICENSE)

Caskit is an independent open-source project, not affiliated with or endorsed by Valve Corporation. Counter-Strike, CS2 and Steam are trademarks of Valve Corporation.
