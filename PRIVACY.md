# Privacy policy

Caskit is a desktop application that runs entirely on your computer. It has **no servers of its own, no accounts, no analytics and no telemetry**. The developer receives no data from the app.

## What stays on your computer

- Saved sign-ins (Steam refresh tokens), maFile secrets, proxies, settings and transfer rules are stored only in the app's data folder:
  `%APPDATA%\Caskit` (Windows), `~/Library/Application Support/Caskit` (macOS), `~/.config/Caskit` (Linux).
- Secrets are encrypted with the operating system's facilities (Windows DPAPI, macOS Keychain, libsecret on Linux).
- Your Steam password is never stored.
- Exports (JSON/CSV) are written to `Documents/Caskit` only when you press **Export**.

## Network connections

Caskit connects only to the following services:

| When | Where | Why |
|---|---|---|
| When you sign in to a Steam account, and while it stays signed in | Steam (Steam network, `steamcommunity.com`, `api.steampowered.com`, the CS2 Game Coordinator) | everything the app does with your account: inventory, storage units, store, trades, market, confirmations |
| While the app shows items | Steam's image CDNs (`community.akamai.steamstatic.com`, `cdn.steamstatic.com`) | item, sticker and store icons |
| Every 3 minutes, for saved accounts that have a proxy | `api.steampowered.com`, **through that proxy** | checking that the proxy still works |
| At start-up | GitHub (`github.com`, `api.github.com`) | checking for a new version of Caskit |
| Once a day | `raw.githubusercontent.com` (this repository, [GameTracking-CS2](https://github.com/SteamDatabase/GameTracking-CS2), [counter-strike-image-tracker](https://github.com/ByMykel/counter-strike-image-tracker)) | item names and icons, the store catalog and the list of donation options |

- No account data, identifiers or usage statistics are sent to GitHub or anyone else; these requests download public files only.
- If an account has a proxy, all of that account's traffic (including the QR code, web requests and avatar) goes through the proxy.
- Links such as Ko-fi, GitHub or the Steam Community Market open in your browser only when you click them.

## Removing your data

Uninstall the app and delete the data folder listed above. See [Uninstall](README.md#uninstall).

## Contact

Questions: open an issue at <https://github.com/pythonMaster2002/cs2-storage-manager/issues>.
