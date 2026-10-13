## Caskit 1.1.1 — faster market history import, SIH import, sortable portfolio

**Download:** `Caskit-Setup-1.1.1.exe` (Windows, recommended), `Caskit-1.1.1-portable.exe` (no install), `.dmg` for macOS (arm64 = Apple Silicon, x64 = Intel), `.AppImage` / `.deb` for Linux.

**What's new**
- **Market history import no longer gets stuck** on large histories (~1000+ trades): pages of 500 instead of 100, the request pace adapts to Steam's rate limit by itself (speeds up while Steam answers, backs off on 429), failed pages are retried instead of stopping the import.
- **Import from SIH** (Steam Inventory Helper → export market history to CSV): just load the file in Portfolio → CSV. Large files are accepted (the old “file too large” error is gone); currency is taken from the price, any date format works; trades already in your portfolio are skipped, so the same file or a file overlapping the Steam import can be loaded again safely.
- **Sortable portfolio**: click any column — quantity, average buy price, price now, value, unrealized and realized profit — to sort; click again to reverse. The choice is remembered.

**First launch:** the builds are not code-signed yet. Windows may show “Windows protected your PC” → **More info → Run anyway**. macOS: right-click the app → **Open**.

---

### По-русски

- **Импорт истории Торговой площадки больше не застревает** на больших историях: страницы по 500, темп запросов сам подстраивается под лимит Steam (ускоряется, пока Steam отвечает, и притормаживает на 429), сбойные страницы перезапрашиваются, а не обрывают импорт.
- **Импорт из SIH** (экспорт истории ТП в CSV): просто загрузите файл в «Портфель» → CSV. Большие файлы принимаются, валюта берётся из цены, даты — в любом формате; сделки, которые уже есть в портфеле, пропускаются.
- **Сортировка портфеля** по любой колонке: клик — сортировка, второй клик — в обратную сторону.
