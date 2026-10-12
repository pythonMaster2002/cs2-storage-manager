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

// Сбой в сторонней библиотеке (например, обрыв соединения со Steam во время входа) не должен ронять приложение
// и показывать системное окно «JavaScript error in the main process»: пишем в журнал и продолжаем работу.
function logCrash(kind, err) {
	try {
		const f = path.join(app.getPath('userData'), 'error.log');
		require('fs').appendFileSync(f, `${new Date().toISOString()} ${kind}: ${err && err.stack || err}\n`);
	} catch (e) { /* ignore */ }
	console.error(kind, err);
}
process.on('uncaughtException', e => logCrash('uncaughtException', e));
process.on('unhandledRejection', e => logCrash('unhandledRejection', e));

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
// Ничего не скачивается и не ставится без согласия: при старте (если не выключено в настройках) проверяем
// новую версию и спрашиваем. Установленная версия (NSIS / AppImage) после «Обновить» скачивает дельту и
// перезапускается; portable и macOS — открывают страницу релиза. «Пропустить эту версию» больше о ней не спрашивает.
function repoSlug() {
	const r = require('./package.json').repository;
	const m = String((r && r.url) || r || '').match(/github\.com[/:]([^/]+)\/([^/.#]+)/);
	return m && m[1] !== 'OWNER' ? `${m[1]}/${m[2]}` : null;
}

function appSettings() {
	try { return JSON.parse(require('fs').readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf8')); } catch (e) { return {}; }
}

function notifyRenderer(channel, data) { if (win && !win.isDestroyed()) win.webContents.send(channel, data); }

const cmpVer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };

async function latestRelease(slug) {
	const r = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, { headers: { 'User-Agent': 'Caskit' } });
	if (!r.ok) throw new Error(`GitHub: HTTP ${r.status}`);
	const rel = await r.json();
	return { version: String(rel.tag_name || '').replace(/^v/, ''), url: rel.html_url };
}

// Сборка без обновлений (npm run build:*:noupdate кладёт в package.json "caskitNoUpdates": true):
// приложение вообще не обращается к GitHub за версиями и ничего не скачивает.
const NO_UPDATES = (() => { try { return Boolean(require('./package.json').caskitNoUpdates); } catch (e) { return false; } })() || process.env.CASKIT_NO_UPDATES === '1';

let updater = null;          // electron-updater (только установленная версия на Windows/Linux)
let offered = null;          // { version, url, canInstall }

function initUpdater() {
	if (updater !== null) return updater;
	updater = false;
	const portable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
	if (!app.isPackaged || portable || process.platform === 'darwin') return updater;
	try {
		const { autoUpdater } = require('electron-updater');
		autoUpdater.autoDownload = false;          // качаем только после «Обновить»
		autoUpdater.autoInstallOnAppQuit = false;  // и не ставим молча при выходе
		autoUpdater.on('download-progress', p => notifyRenderer('update-progress', { percent: Math.round(p.percent || 0) }));
		autoUpdater.on('update-downloaded', info => notifyRenderer('update-ready', { version: info.version }));
		autoUpdater.on('error', e => notifyRenderer('update-error', { message: String(e && e.message || e) }));
		updater = autoUpdater;
	} catch (e) { updater = false; }
	return updater;
}

// Проверить и, если есть новая версия, предложить её. manual — нажата «Проверить сейчас» (игнорирует «пропустить»).
async function checkUpdates(manual = false) {
	const slug = repoSlug();
	if (NO_UPDATES) return { latest: null, current: app.getVersion(), disabled: true };
	if (!slug || !app.isPackaged) return { latest: null, current: app.getVersion() };
	const rel = await latestRelease(slug);
	const newer = rel.version && cmpVer(rel.version, app.getVersion()) > 0;
	if (newer && (manual || appSettings().skipVersion !== rel.version)) {
		const u = initUpdater();
		if (u) { try { await u.checkForUpdates(); } catch (e) { /* дельта недоступна — покажем ссылку */ } }
		offered = { version: rel.version, url: rel.url, canInstall: Boolean(u) };
		notifyRenderer('update-available', offered);
	}
	return { latest: rel.version, current: app.getVersion(), newer };
}

function setupUpdates() {
	if (NO_UPDATES || (appSettings().updateMode || 'ask') === 'off') return;   // сборка без обновлений или выключено пользователем
	checkUpdates(false).catch(() => {});
}

ipcMain.handle('check-updates', () => checkUpdates(true).catch(e => ({ error: e.message })));
ipcMain.handle('updates-disabled', () => NO_UPDATES);
ipcMain.handle('download-update', async () => {
	if (NO_UPDATES) return { ok: false };
	const u = initUpdater();
	if (!u) return { ok: false };
	await u.downloadUpdate();
	return { ok: true };
});
ipcMain.handle('install-update', () => { if (NO_UPDATES) return; const u = initUpdater(); if (u) u.quitAndInstall(); });

ipcMain.handle('open-path', (event, p) => shell.openPath(p));
ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('open-external', (event, url) => { if (typeof url === 'string' && /^(https?|steam):/i.test(url)) shell.openExternal(url); });

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
