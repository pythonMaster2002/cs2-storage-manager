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

<p align="center"><img src="docs/screenshots/demo.gif" alt="Caskit: storing 60 cases into a storage unit, then a trade-up with outcome chances" width="900"></p>

> **Coming from Casemove?** Its last release was in December 2024. Caskit covers the same storage-unit workflow and adds trade-up odds and floats, stickers, the CS2 store, trades and the Community Market, a built-in Steam Guard and several accounts with their own proxies — and it is actively maintained.

## Features

**Storage units**
- Move items into and out of storage units in bulk. The speed tunes itself to Steam's limits (usually 8–13 items/s), and stuck items are retried automatically.
- **Transfer rules**: “all cases → Cases 01, Cases 02…”, “stickers → Stickers”. Run them with one click or right after sign-in.
- Rename units, hide full ones, and export everything to JSON/CSV.

**Trade-up contracts**
- Build contracts from your inventory *and* from storage units (items are taken out automatically).
- See every possible outcome with its **chance**, the float of each input and the **predicted float** of the result on a wear bar.
- Items the game won't accept (top grade of their collection) are marked in advance. Souvenirs are supported.
- After crafting: **Inspect in game** and **View on Community Market**.

**Stickers**
- Apply, scrape and remove stickers — including CS2 free-placement stickers.
- Weapon float with a wear bar, sticker wear, inspect links and a link to the item in your Steam inventory.

**CS2 Store and Armory**
- Cart, favourites, wallet balance and the balance left after purchase. Every payment is confirmed by you.
- Armory: redeem stars for rewards.
- Item names and icons update by themselves from the game files.

**Trades, Market and Steam Guard**
- Incoming and outgoing trade offers, accept/decline, auto-accept gifts.
- Market listings, buy orders, searchable history, selling with the fee calculated for you.
- A small **SDA** built in: Steam Guard codes for every account with a maFile, trade and listing confirmations, proxy health monitoring.

**Accounts and privacy**
- Several accounts at once, each with its own SOCKS5/HTTP proxy.
- Sign in with a **QR code** (it shows up instantly), a login and password, or a **maFile**.
- 10 interface languages, automatic updates (installer version).

## Screenshots

| | |
|---|---|
| <img src="docs/screenshots/tradeup.png" alt="Trade-up odds"> | <img src="docs/screenshots/craft.png" alt="Trade-up result"> |
| **Trade-up**: outcomes, chances, floats | **Result**: inspect in game or open on the market |
| <img src="docs/screenshots/stickers.png" alt="Stickers"> | <img src="docs/screenshots/store.png" alt="Store"> |
| **Stickers**: apply, scrape, remove | **CS2 Store**: cart and wallet |
| <img src="docs/screenshots/overview.png" alt="Overview"> | <img src="docs/screenshots/guard.png" alt="Steam Guard"> |
| **Overview** of one or all accounts | **Steam Guard**: codes and confirmations |

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

**Where is my data?** Only on your computer: `%APPDATA%\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).

## Support the project

Caskit is free and always will be. If it saves you time:

- ☕ [Ko-fi](https://ko-fi.com/mikidjus) — card or PayPal
- 🎁 [Send a skin](https://steamcommunity.com/tradeoffer/new/?partner=146040317&token=Q_pa1oMK) — any spare case or skin
- 💎 Crypto (Binance Pay / USDT) — addresses in the app: ♥ button
- ⭐ Star this repository

## Build from source

Requires Node.js 22+.

```bash
npm ci
npm start              # run
npm run build:win      # installer + portable → dist/
npm run build:linux    # AppImage + deb
npm run build:mac      # dmg + zip (macOS only)
```

**Release**: bump `version` in `package.json`, then `git tag vX.Y.Z && git push --tags`. GitHub Actions builds all three systems and publishes them to Releases; installed copies update themselves.

## Code signing policy

Windows releases are built from this repository by [GitHub Actions](.github/workflows/release.yml) and are intended to be signed through SignPath. Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).
*Status: the application is in progress — until it is approved, releases are unsigned.*

- Committers and reviewers: [@pythonMaster2002](https://github.com/pythonMaster2002)
- Approvers: [@pythonMaster2002](https://github.com/pythonMaster2002)

Every signed release is built by CI from a tagged commit and manually approved before signing.
Privacy: see the [privacy policy](PRIVACY.md) — Caskit has no telemetry and sends data only to the services listed there.

## License

[MIT](LICENSE)

Caskit is an independent open-source project, not affiliated with or endorsed by Valve Corporation. Counter-Strike, CS2 and Steam are trademarks of Valve Corporation.
