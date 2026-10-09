// Caskit (CS2 Storage Manager) — Electron main process.
'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, shell, safeStorage, ipcMain, Menu } = require('electron');

// Переименование CS2 Storage Manager → Caskit: папка данных сменилась — один раз переносим старую
// (сохранённые аккаунты, настройки, история), чтобы ничего не потерять.
try {
	const now = app.getPath('userData');
	if (!fs.existsSync(path.join(now, 'accounts.json'))) {
		for (const old of ['CS2 Storage Manager', 'cs2-storage-manager']) {
			const dir = path.join(app.getPath('appData'), old);
			if (dir !== now && fs.existsSync(path.join(dir, 'accounts.json'))) { fs.cpSync(dir, now, { recursive: true, force: false, errorOnExist: false }); break; }
		}
	}
} catch (e) { /* без переноса — просто начнём с чистого листа */ }
// Путь к кэшу карт имён/иконок задаём ДО загрузки модулей, которые эти карты читают.
try { process.env.CASKET_DATA_CACHE = path.join(app.getPath('userData'), 'catalog'); } catch (e) { /* выставим в createWindow */ }
const { start } = require('./src/server');

if (!app.requestSingleInstanceLock()) app.quit();
// Windows: своё имя приложения в панели задач и уведомлениях (а не «Electron»)
if (process.platform === 'win32') app.setAppUserModelId('app.caskit');

let win;

async function createWindow() {
	const secretBox = safeStorage.isEncryptionAvailable() ? {
		encrypt: text => safeStorage.encryptString(text).toString('base64'),
		decrypt: b64 => safeStorage.decryptString(Buffer.from(b64, 'base64')),
	} : null;
	const started = await start({
		dataDir: app.getPath('userData'),
		exportDir: path.join(app.getPath('documents'), 'Caskit'),
		secretBox,
	});
	// Фоновое обновление карт имён/иконок (не чаще раза в сутки) — подхватится при следующем запуске.
	if (!process.env.CASKET_DATA_CACHE) process.env.CASKET_DATA_CACHE = path.join(app.getPath('userData'), 'catalog');
	require('./src/core/catalog').refresh().then(r => { if (r.updated && r.updated.length) console.log('catalog: обновлено', r.updated.join(', ')); }).catch(() => {});
	// Товары магазина: названия и картинки из свежих файлов игры (раз в сутки, сразу применяются).
	require('./src/core/catalog').refreshStoreMeta().catch(e => console.log('store meta:', e.message));

	Menu.setApplicationMenu(null);
	win = new BrowserWindow({
		width: 1320, height: 860, minWidth: 980, minHeight: 640,
		backgroundColor: '#0f1115', title: 'Caskit', show: false,
		icon: path.join(__dirname, 'build', 'icon.png'),
		webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
	});
	win.once('ready-to-show', () => win.show());
	// Links (donate, GitHub) open in the system browser, not inside the app.
	win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
	win.loadURL(`http://127.0.0.1:${started.port}/#${started.token}`);
	win.webContents.once('did-finish-load', () => setTimeout(setupUpdates, 3000));
}

// ---------------------------------------------------------------- обновления (GitHub Releases)
// Установленная версия (NSIS / AppImage / dmg) обновляется сама: скачивает дельту в фоне, затем предлагает
// перезапуск. Portable-exe и неподписанный macOS обновиться сами не могут — для них просто уведомление со ссылкой.
function repoSlug() {
	const r = require('./package.json').repository;
	const m = String((r && r.url) || r || '').match(/github\.com[/:]([^/]+)\/([^/.#]+)/);
	return m && m[1] !== 'OWNER' ? `${m[1]}/${m[2]}` : null;
}

function notifyRenderer(channel, data) { if (win && !win.isDestroyed()) win.webContents.send(channel, data); }

async function manualUpdateCheck(slug) {
	try {
		const r = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, { headers: { 'User-Agent': 'Caskit' } });
		if (!r.ok) return;
		const rel = await r.json();
		const latest = String(rel.tag_name || '').replace(/^v/, '');
		const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
		if (latest && cmp(latest, app.getVersion()) > 0) notifyRenderer('update-available', { version: latest, url: rel.html_url });
	} catch (e) { /* нет сети — проверим в следующий раз */ }
}

function setupUpdates() {
	const slug = repoSlug();
	if (!app.isPackaged || !slug) return;
	const portable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
	if (portable || process.platform === 'darwin') { manualUpdateCheck(slug); return; }
	try {
		const { autoUpdater } = require('electron-updater');
		autoUpdater.autoDownload = true;
		autoUpdater.on('update-downloaded', info => notifyRenderer('update-ready', { version: info.version }));
		autoUpdater.on('error', () => manualUpdateCheck(slug));
		ipcMain.handle('install-update', () => autoUpdater.quitAndInstall());
		autoUpdater.checkForUpdates().catch(() => manualUpdateCheck(slug));
	} catch (e) { manualUpdateCheck(slug); }
}

ipcMain.handle('open-path', (event, p) => shell.openPath(p));
ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('open-external', (event, url) => { if (typeof url === 'string' && /^(https?|steam):/i.test(url)) shell.openExternal(url); });

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
