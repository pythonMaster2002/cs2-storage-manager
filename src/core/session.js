// Steam client session for CS2 storage units (caskets) via the Game Coordinator.
//
// Login: QR code (Steam mobile app), login + password (+ Steam Guard code), an imported maFile
// (Steam Guard codes are generated automatically) or a saved account (refresh token).
'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const GlobalOffensive = require('globaloffensive');

const catalog = require('./catalog');

const CASKET = 1201;
const CASKET_CAPACITY = 1000;
const INVENTORY_LIMIT = 1000;
const QR_TTL = 150000;
// Адаптивная скорость перекладки (см. _runPipeline). Старт — проверенный «безопасный» темп.
// Замер 09.10.2026 (200 шт туда-обратно, окно/пауза): 5/100 мс — 8,3 шт/с без потерь; 5/55 — 7,5–8,5 и 5–6 потерь;
// 3/55 — 7,3 без потерь; 8/55 — 5,4–6,2 и 6–7 потерь; 12/15 («турбо») — 3,3 шт/с и 15 потерь.
const SPEED = { window: 6, startPace: 100, minPace: 35, maxPace: 250, minTimeout: 3500, maxTimeout: 10000 };
const LEARNED_SPEED = new Map();  // login -> { window, pace } последней перекладки
const NAMES = catalog.loadMap('names.json');
Object.assign(NAMES, { 'def:1201': 'Storage Unit', 'def:1209': 'Sticker', 'def:1348': 'Sealed Graffiti', 'def:1349': 'Graffiti' });
const IMAGES = catalog.loadMap('images.json');
// Коллекционные предметы (монеты, медали, значки, пропуска) — их нельзя положить в контейнер,
// поэтому в списке «что положить» мы их не показываем.
const NONSTORABLE = new Set(catalog.loadMap('nonstorable_defs.json'));

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Pseudo items of the GC: id = 0xF000000000000000 | def_index (every account has such a
// "CS:GO Weapon Case"). They are not real items: they cannot be stored or traded.
const isRealItem = item => BigInt(item.id) < 0xF000000000000000n;
// Предмет можно положить в контейнер (не псевдо-предмет и не коллекционный).
const isStorable = item => isRealItem(item) && !NONSTORABLE.has(item.def_index);

// Трейд-ап (контракт обмена): входом может быть скин оружия (есть paint_index), редкости
// Consumer..Classified (1..5; Covert 6 и выше — нельзя), не сувенир (quality 12), не в ящике.
const TRADEUP_MAX_RARITY = 5;
// Обычные контракты (рецепты 0–4 в items_game) принимают качество unique и tournament (сувениры), в том числе вперемешку.
const isTradeUpInput = item => isRealItem(item) && !item.casket_id && item.paint_index > 0
	&& item.rarity >= 1 && item.rarity <= TRADEUP_MAX_RARITY;
// В коллекции скина нет предметов следующей редкости (null — нет данных о скине).
function tradeUpTopTier(item) {
	const tu = catalog.storeMeta().tradeup;
	const sk = tu && tu.skins[`${item.def_index}:${Math.round(item.paint_index || 0)}`];
	if (!sk) return null;
	return !Object.values(tu.skins).some(v => v[0] === sk[0] && v[1] === sk[1] + 1);
}
const isStatTrak = item => item.quality === 9 || item.kill_eater_value !== undefined;

function waitFor(emitter, event, ms, what) {
	return new Promise((resolve, reject) => {
		const handler = (...args) => { clearTimeout(timer); emitter.off(event, handler); resolve(args); };
		const timer = setTimeout(() => { emitter.off(event, handler); reject(new Error(`таймаут: ${what}`)); }, ms);
		emitter.on(event, handler);
	});
}

// ---------------------------------------------------------------- item names and icons

const EXTERIORS = [[0.07, 'Factory New'], [0.15, 'Minimal Wear'], [0.38, 'Field-Tested'], [0.45, 'Well-Worn'], [1.01, 'Battle-Scarred']];

function itemKey(item) {
	if (item.def_index === 1209 && item.stickers && item.stickers.length) return `sticker:${item.stickers[0].sticker_id}`;
	const paint = item.paint_index ? Math.round(item.paint_index) : 0;
	return paint ? `skin:${item.def_index}:${paint}` : `def:${item.def_index}`;
}

function itemImage(item) {
	const key = itemKey(item);
	if (key.startsWith('def:')) {  // базовые предметы — картинка из файлов игры (см. defName)
		const m = catalog.storeMeta().defs;
		const img = m && m[item.def_index] && m[item.def_index].image;
		if (img) return /economy\/image\//.test(img) ? `${img}/96fx96f` : img;
	}
	if (key.startsWith('sticker:')) return catalog.stickerIcon(key.slice(8));  // с запасным путём для старых наклеек
	const tail = IMAGES.images[key];
	return tail ? `${IMAGES.cdn}${tail}/96fx96f` : null;
}

function defName(def) {
	const m = catalog.storeMeta().defs;
	return (m && m[def] && m[def].name) || NAMES[`def:${def}`] || null;
}

function itemName(item) {
	if (item.def_index === 1209 && item.stickers && item.stickers.length) {
		return NAMES[`sticker:${item.stickers[0].sticker_id}`] || `Sticker #${item.stickers[0].sticker_id}`;
	}
	const paint = item.paint_index ? Math.round(item.paint_index) : 0;
	// Базовые названия — из файлов игры (store_meta, обновляется само): в names.json номера брелоков
	// пересекаются с номерами оружия (def 7 = AK-47, а не брелок).
	const base = defName(item.def_index);
	if (!paint) return base || `Item #${item.def_index}`;
	let name = NAMES[`skin:${item.def_index}:${paint}`] || `${base || `Item #${item.def_index}`} | #${paint}`;
	if (item.quality === 3 || /Knife|Bayonet|Karambit|Daggers|Gloves|Wraps/.test(name)) name = `★ ${name}`;
	if (item.kill_eater_value !== undefined) name = name.replace(/^(★ )?/, '$1StatTrak™ ');
	if (item.quality === 12) name = `Souvenir ${name}`;
	if (item.paint_wear !== undefined) name += ` (${EXTERIORS.find(([max]) => item.paint_wear < max)[1]})`;
	return name;
}

// Тип предмета для аналитики и правил перекладки.
function itemKind(it) {
	if (it.def_index === 1209) return 'sticker';
	if (it.def_index === 1348 || it.def_index === 1349) return 'graffiti';
	const n = itemName(it);
	if (/ Case$| Capsule$| Package$|Container$|Box$/.test(n)) return 'container';
	if (it.paint_index > 0) return (it.quality === 3 || /★|Knife|Bayonet|Karambit|Daggers|Gloves|Wraps/.test(n)) ? 'knifeglove' : 'skin';
	return 'other';
}

function group(items, extra = () => ({})) {
	const groups = new Map();
	for (const item of items) {
		const name = itemName(item);
		if (!groups.has(name)) groups.set(name, { name, image: itemImage(item), count: 0, ids: [], ...extra() });
		groups.get(name).count += 1;
		groups.get(name).ids.push(String(item.id));
	}
	return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- saved accounts

// Accounts are stored on the user's computer only. Secrets (refresh token, maFile) are
// encrypted with the OS keychain (Electron safeStorage) when it is available.
class AccountStore {
	constructor(dir, crypto) {
		this.file = path.join(dir, 'accounts.json');
		this.crypto = crypto;
		fs.mkdirSync(dir, { recursive: true });
	}

	_read() {
		try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { return {}; }
	}

	_write(data) {
		fs.writeFileSync(this.file, JSON.stringify(data, null, 1));
	}

	_seal(obj) {
		const text = JSON.stringify(obj);
		return this.crypto ? { enc: this.crypto.encrypt(text) } : { plain: text };
	}

	_open(box) {
		if (!box) return null;
		return JSON.parse(box.enc ? this.crypto.decrypt(box.enc) : box.plain);
	}

	list() {
		const data = this._read();
		return Object.keys(data).map(login => ({ login, hasMaFile: Boolean(data[login].hasMaFile), proxy: data[login].proxy || '', lastLogin: data[login].lastLogin,
			hasToken: Boolean((this._open(data[login].secret) || {}).refreshToken), personaName: data[login].personaName || null, avatar: data[login].avatar || null }))
			.sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0));
	}

	get(login) {
		const entry = this._read()[login];
		return entry ? { ...entry, secret: this._open(entry.secret) || {} } : null;
	}

	save(login, patch) {
		const data = this._read();
		const current = data[login] ? this._open(data[login].secret) || {} : {};
		const { secret, ...open } = patch;
		data[login] = { ...(data[login] || {}), ...open, secret: this._seal({ ...current, ...(secret || {}) }) };
		this._write(data);
	}

	remove(login) {
		const data = this._read();
		delete data[login];
		this._write(data);
	}
}

// ---------------------------------------------------------------- session

class CasketSession extends EventEmitter {
	constructor({ dataDir, crypto, accounts }) {
		super();
		this.dataDir = dataDir;
		this.accounts = accounts || new AccountStore(dataDir, crypto);
		this.status = 'offline';   // offline | connecting | guard | qr | online | error
		this.login = null;
		this.error = null;
		this.needsRelogin = false; // сохранённый вход устарел — нужно войти заново
		this.pendingTxn = null;    // ожидающая подтверждения покупка в магазине
		this.job = null;
		this.user = null;
		this.csgo = null;
		this.webCookies = null;
		this.proxy = null;
	}

	// mode: 'saved' | 'creds' | 'qr' | 'mafile'. maFile: parsed JSON (for 'mafile').
	async start({ mode, login, password, maFile, proxy, remember = true }) {
		if (['connecting', 'guard', 'qr', 'online'].includes(this.status)) throw new Error('сначала выйдите из аккаунта или дождитесь входа');
		this.status = 'connecting';
		this.error = null;
		this.needsRelogin = false;
		this.mode = mode;
		this.qrUrl = null;
		this.qrScanned = false;
		this.remember = remember;  // для QR галочку можно поменять, пока код на экране (/api/login/remember)
		try {
			if (mode === 'mafile') {
				if (!maFile || !maFile.shared_secret) throw new Error('в maFile нет shared_secret');
				login = login || maFile.account_name;
				if (!login) throw new Error('в maFile нет логина — укажите его');
			}
			const saved = login ? this.accounts.get(login) : null;
			if (mode === 'saved' && !saved) throw new Error('аккаунт не найден среди сохранённых');
			const secrets = { ...(saved ? saved.secret : {}) };
			if (mode === 'mafile') Object.assign(secrets, { shared_secret: maFile.shared_secret, identity_secret: maFile.identity_secret, device_id: maFile.device_id });
			// identity_secret нужен для мобильных подтверждений (трейды, лоты маркета) — держим только в памяти сессии.
			this.identitySecret = secrets.identity_secret || null;
			this.deviceId = secrets.device_id || null;
			this.login = login || null;
			this.proxy = (proxy !== undefined ? proxy : saved && saved.proxy) || null;
			if (this.proxy && !/^(socks[45]h?|https?):\/\//.test(this.proxy)) throw new Error('прокси: формат socks5://user:pass@host:port или http://…');
			if (this.proxy) this.proxy = this.proxy.replace(/^socks5h:/, 'socks5:');
			const proxyOption = !this.proxy ? {} : { [this.proxy.startsWith('http') ? 'httpProxy' : 'socksProxy']: this.proxy };

			// Жёсткий контроль прокси: до любого обращения к Steam проверяем, что прокси живой.
			// Если он задан и не работает — вход прерывается, трафик напрямую НЕ идёт.
			if (this.proxy) {
				this.emit('log', 'проверяем прокси...');
				await this._verifyProxy();
				if (this.status === 'offline') throw new Error('вход прерван');
			}

			// QR: refresh token via the Steam mobile app, then a normal token login.
			let token = mode === 'saved' ? secrets.refreshToken : null;
			if (mode === 'qr') {
				const { LoginSession, EAuthTokenPlatformType } = require('steam-session');
				// Весь обмен с Steam (создание QR-сессии и опрос статуса) идёт через прокси аккаунта;
				// сама картинка QR рисуется локально. Пока код не отсканирован, сессия ни к какому аккаунту не привязана.
				const qr = this._qrSession = new LoginSession(EAuthTokenPlatformType.SteamClient, proxyOption);
				qr.loginTimeout = QR_TTL;
				this.qrUrl = (await qr.startWithQR()).qrChallengeUrl;
				if (this.status === 'offline') { qr.cancelLoginAttempt(); throw new Error('вход по QR отменён'); }  // отменили, пока Steam выдавал код
				this.qrExpires = Date.now() + QR_TTL;
				this.status = 'qr';
				// Steam периодически выдаёт новый код (new_challenge_url) — старый после этого не сработает.
				qr.on('debug', (what, res) => { if (what === 'poll response' && res && res.newChallengeUrl) this.qrUrl = res.newChallengeUrl; });
				qr.on('remoteInteraction', () => { this.qrScanned = true; this.emit('log', 'QR отсканирован — подтвердите вход в приложении Steam'); });
				await new Promise((resolve, reject) => {
					this._qrReject = () => reject(new Error('вход по QR отменён'));
					qr.on('authenticated', resolve);
					qr.on('timeout', () => reject(new Error('QR-код истёк — запросите новый')));
					qr.on('error', reject);
				});
				this.login = qr.accountName;
				token = qr.refreshToken;
				this.qrUrl = null;
				this.status = 'connecting';
			}
			login = this.login;

			const user = this.user = new SteamUser({ renewRefreshTokens: true, autoRelogin: false, ...proxyOption });
			this.csgo = new GlobalOffensive(user);
			this._trackSO(user);
			const remembered = this.remember || mode === 'saved';
			user.on('refreshToken', t => { if (remembered) this.accounts.save(login, { secret: { refreshToken: t } }); });
			user.on('webSession', (sid, cookies) => { this.webCookies = cookies; });
			user.on('disconnected', (eresult, msg) => {
				if (this.status === 'online') { this.status = 'offline'; this.error = `Steam отключил сессию: ${msg || eresult}`; }
			});
			// «Вошли в игру на другом устройстве»: Steam не даст запустить CS2 второй раз —
			// подключение к Game Coordinator не состоится. Ловим это отдельно и сообщаем понятно.
			let playBlocked = false;
			user.on('playingState', blocked => { playBlocked = Boolean(blocked); });

			let autoCodeUsed = false;
			user.on('steamGuard', (domain, callback, lastCodeWrong) => {
				// The maFile code is used only ONCE; if Steam rejects it we ask the user,
				// otherwise retries loop and end in RateLimitExceeded.
				if (secrets.shared_secret && !domain && !lastCodeWrong && !autoCodeUsed) {
					autoCodeUsed = true;
					return callback(SteamTotp.generateAuthCode(secrets.shared_secret));
				}
				this.status = 'guard';
				this.guardDomain = domain || null;
				this.guardWrong = Boolean(lastCodeWrong);
				this._guardCallback = callback;
			});

			// Вход: ждём loggedOn или error. _loginReject позволяет прервать вход кнопкой «Отменить».
			const usedToken = Boolean(token);
			await new Promise((resolve, reject) => {
				let timer;
				const finish = (fn, arg) => { clearTimeout(timer); user.off('loggedOn', onOk); user.off('error', onErr); this._loginReject = null; fn(arg); };
				const onOk = () => finish(resolve);
				const onErr = e => finish(reject, e);
				user.once('loggedOn', onOk);
				user.once('error', onErr);
				this._loginReject = e => finish(reject, e || new Error('вход прерван'));
				timer = setTimeout(() => onErr(new Error('время ожидания входа истекло')), 300000);
				if (token) {
					user.logOn({ refreshToken: token });
				} else {
					if (!login || !password) return onErr(new Error('введите логин и пароль'));
					const details = { accountName: login, password };
					if (secrets.shared_secret) { autoCodeUsed = true; details.twoFactorCode = SteamTotp.generateAuthCode(secrets.shared_secret); }
					user.logOn(details);
				}
			}).catch(e => {
				// Токен сохранённого входа устарел/отозван — не зацикливаемся, просим войти заново.
				if (usedToken && ['AccessDenied', 'InvalidPassword', 'Expired', 'InvalidSignature', 'Revoked', 'LoggedInElsewhere'].includes(e.message)) {
					this.needsRelogin = true;
					try { this.accounts.save(login, { secret: { refreshToken: null } }); } catch (_) { /* ignore */ }
					throw new Error('сохранённый вход устарел — войдите заново (логин и пароль или QR-код)');
				}
				throw e;
			});

			this.status = 'connecting';
			if (remembered) {
				this.accounts.save(login, {
					lastLogin: Date.now(), proxy: this.proxy || '', hasMaFile: Boolean(secrets.shared_secret),
					// токен входа сохраняем сразу: после QR-входа steam-user его не присылает событием,
					// и без этого «быстрый вход» в сохранённый аккаунт не работал (окно только мигало)
					secret: { ...(token ? { refreshToken: token } : {}),
						...(secrets.shared_secret ? { shared_secret: secrets.shared_secret, identity_secret: secrets.identity_secret, device_id: secrets.device_id } : {}) },
				});
			}
			user.setPersona(SteamUser.EPersonaState.Offline);
			user.gamesPlayed([730]);
			// Ждём Game Coordinator; если игра заблокирована (аккаунт уже в CS2) — сразу понятная ошибка.
			await new Promise((resolve, reject) => {
				let timer, iv;
				const finish = (fn, arg) => { clearTimeout(timer); clearInterval(iv); this.csgo.off('connectedToGC', onGC); this._loginReject = null; fn(arg); };
				const onGC = () => finish(resolve);
				const fail = () => finish(reject, new Error(playBlocked
					? 'этот аккаунт уже запущен в CS2 на другом устройстве — закройте там игру и попробуйте снова'
					: 'не удалось подключиться к серверам CS2 — попробуйте ещё раз'));
				this.csgo.once('connectedToGC', onGC);
				this._loginReject = () => finish(reject, new Error('вход отменён'));
				timer = setTimeout(fail, 45000);
				iv = setInterval(() => { if (playBlocked) fail(); }, 500);
			});
			this.status = 'online';
			this.needsRelogin = false;
			this.emit('log', `вход выполнен: ${login}`);
			this._loadProfile().catch(e => this.emit('log', `профиль: ${e.message}`));
		} catch (e) {
			this.status = 'error';
			this.error = humanError(e);
			this._teardown();
			throw e;
		}
	}

	// SO-кэш GC: globaloffensive разбирает только предметы (type 1). Остальные объекты (баланс звёзд Armory
	// и т.п.) сохраняем сырыми: type_id -> [Buffer]. Нужны для armory.js.
	_trackSO(user) {
		const Protos = require('globaloffensive/protobufs/generated/_load.js');
		this.so = new Map();
		const put = (type, data, replace) => {
			if (type === 1) return;
			if (replace || !this.so.has(type)) this.so.set(type, []);
			this.so.get(type).push(Buffer.from(data));
		};
		user.on('receivedFromGC', (appid, type, payload) => {
			if (appid !== 730) return;
			try {
				if (type === 4004) {
					const w = Protos.CMsgClientWelcome.decode(payload);
					for (const c of w.outofdate_subscribed_caches || []) for (const o of c.objects || []) {
						this.so.set(o.type_id, []);
						for (const d of o.object_data || []) put(o.type_id, d);
					}
				} else if (type === 21 || type === 22) {
					const o = Protos.CMsgSOSingleObject.decode(payload);
					put(o.type_id, o.object_data, true);
				} else if (type === 26) {
					const m = Protos.CMsgSOMultipleObjects.decode(payload);
					for (const o of [...(m.objects_modified || []), ...(m.objects_added || [])]) put(o.type_id, o.object_data, true);
				}
			} catch (e) { /* не наш формат — пропускаем */ }
		});
	}

	// Ник и аватарка Steam. Аватар качаем сами через прокси аккаунта (а не из окна приложения напрямую)
	// и кэшируем в папке данных: <dataDir>/avatars/<login>.jpg, раздаётся сервером как /av/<login>.jpg.
	async _loadProfile() {
		const sid = this.user.steamID;
		const { personas } = await this.user.getPersonas([sid]);
		const p = personas && personas[sid.getSteamID64()];
		if (!p) return;
		this.profile = { name: p.player_name || this.login, avatar: null };
		const url = p.avatar_url_full || p.avatar_url_medium;
		if (!url || !this.dataDir) return;
		const res = await this.webRequestRaw(url);
		if (res.status !== 200 || !res.body.length) { this.emit('log', `аватар не загружен (HTTP ${res.status}): ${url}`); return; }
		const dir = path.join(this.dataDir, 'avatars');
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(path.join(dir, `${this.login}.jpg`), res.body);
		this.profile.avatar = `/av/${encodeURIComponent(this.login)}.jpg?v=${Date.now()}`;
		if (this.accounts.get(this.login)) this.accounts.save(this.login, { personaName: this.profile.name, avatar: this.profile.avatar });
	}

	// GET без cookies с бинарным ответом (картинки) — через прокси аккаунта.
	webRequestRaw(url, hops = 3) {
		const https = require('https');
		return new Promise((resolve, reject) => {
			const req = https.get(url, { agent: this.agent() }, res => {
				if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops > 0) {
					res.resume();
					return resolve(this.webRequestRaw(new URL(res.headers.location, url).href, hops - 1));
				}
				const chunks = [];
				res.on('data', c => chunks.push(c));
				res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
			});
			req.on('error', reject);
			req.setTimeout(20000, () => req.destroy(new Error('таймаут')));
		});
	}

	submitGuardCode(code) {
		if (this.status !== 'guard' || !this._guardCallback) throw new Error('код сейчас не запрашивается');
		this.status = 'connecting';
		const cb = this._guardCallback;
		this._guardCallback = null;
		cb(String(code).trim().toUpperCase());
	}

	logout() {
		if (this.job && !this.job.finished) throw new Error('дождитесь окончания или остановите операцию');
		this._teardown();
		this.status = 'offline';
		this.error = null;
	}

	_teardown() {
		if (this._loginReject) { const r = this._loginReject; this._loginReject = null; try { r(new Error('вход прерван')); } catch (e) { /* ignore */ } }
		if (this._qrSession) { try { this._qrSession.cancelLoginAttempt(); } catch (e) { /* done */ } this._qrSession = null; }
		if (this._qrReject) { this._qrReject(); this._qrReject = null; }
		this.qrUrl = null;
		if (this.user) {
			try { this.user.gamesPlayed([]); this.user.logOff(); } catch (e) { /* already offline */ }
		}
		this.user = null;
		this.csgo = null;
		this.webCookies = null;
		this.pendingTxn = null;
		this.identitySecret = null;
		this.profile = null;
		this._protected = null;
	}

	ensureOnline() {
		if (this.status !== 'online') throw new Error('нет входа в аккаунт');
	}

	// ---------------------------------------------------------------- data

	agent() {
		if (!this.proxy) return undefined;
		const a = this.proxy.startsWith('http')
			? new (require('https-proxy-agent').HttpsProxyAgent)(this.proxy)
			: new (require('socks-proxy-agent').SocksProxyAgent)(this.proxy);
		// Жёсткий контроль: прокси задан, но агент не создался — лучше оборвать запрос, чем пустить напрямую.
		if (!a) throw new Error('прокси задан, но соединение через него не создано');
		return a;
	}

	// Быстрая проверка, что прокси пропускает трафик к Steam. Бросает ошибку, если нет.
	_verifyProxy() {
		const https = require('https');
		return new Promise((resolve, reject) => {
			const req = https.request('https://api.steampowered.com/ISteamWebAPIUtil/GetServerInfo/v1/',
				{ method: 'GET', agent: this.agent() }, res => {
					res.resume();
					res.statusCode < 500 ? resolve() : reject(new Error(`прокси вернул HTTP ${res.statusCode}`));
				});
			req.on('error', e => reject(new Error(`прокси недоступен: ${e.message}`)));
			req.setTimeout(15000, () => req.destroy(new Error('прокси не ответил за 15 с')));
			req.end();
		});
	}

	webRequest(method, url, form, extraHeaders) {
		const https = require('https');
		const body = form ? new URLSearchParams(form).toString() : null;
		const headers = { Cookie: (this.webCookies || []).join('; '), 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', ...(extraHeaders || {}) };
		if (body) Object.assign(headers, { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Content-Length': Buffer.byteLength(body) });
		return new Promise((resolve, reject) => {
			const req = https.request(url, { method, agent: this.agent(), headers }, res => {
				let data = '';
				res.on('data', c => data += c);
				res.on('end', () => resolve({ status: res.statusCode, body: data }));
			});
			req.on('error', reject);
			req.setTimeout(30000, () => req.destroy(new Error('таймаут запроса к Steam')));
			if (body) req.write(body);
			req.end();
		});
	}

	sessionId() {
		const c = (this.webCookies || []).find(x => x.startsWith('sessionid='));
		return c ? c.split('=')[1].split(';')[0] : null;
	}

	// Trade-protected items (7 days after a trade) live in inventory context 16; the GC
	// silently ignores storing them. Map: item id -> "protected until" text.
	async protectedItems() {
		if (this._protected && Date.now() - this._protected.ts < 5 * 60000) return this._protected.map;
		const map = new Map();
		if (!this.webCookies) return map;
		try {
			const res = await this.webRequest('GET', `https://steamcommunity.com/inventory/${this.user.steamID.getSteamID64()}/730/16?l=english&count=2000`);
			if (res.status === 200) {
				const inv = JSON.parse(res.body);
				const until = new Map((inv.descriptions || []).map(d => {
					const m = (d.owner_descriptions || []).map(o => o.value).join(' ').match(/until (.+)$/);
					return [`${d.classid}_${d.instanceid}`, m ? m[1].trim() : ''];
				}));
				for (const a of inv.assets || []) map.set(String(a.assetid), until.get(`${a.classid}_${a.instanceid}`) || '');
			}
			this._protected = { ts: Date.now(), map };
		} catch (e) {
			this.emit('log', `не удалось проверить защиту трейда: ${e.message}`);
		}
		return map;
	}

	async snapshot() {
		this.ensureOnline();
		const inv = this.csgo.inventory;
		const protectedMap = await this.protectedItems();
		const caskets = inv.filter(i => i.def_index === CASKET).map(c => ({
			id: String(c.id), name: c.custom_name || null, count: c.casket_contained_item_count || 0, capacity: CASKET_CAPACITY,
		})).sort((a, b) => (a.name || '~').localeCompare(b.name || '~', undefined, { numeric: true }));
		// В список «что положить» берём только предметы, которые реально можно хранить в контейнере
		// (без монет/медалей/значков/пропусков — их Steam в контейнер не кладёт).
		const loose = inv.filter(i => !i.casket_id && i.def_index !== CASKET && isStorable(i));
		const hiddenNonStorable = inv.filter(i => !i.casket_id && i.def_index !== CASKET && isRealItem(i) && !isStorable(i)).length;
		const inventory = group(loose, () => ({ protected: 0, protectedUntil: null, movable: [] }));
		for (const g of inventory) {
			for (const id of g.ids) {
				if (protectedMap.has(id)) { g.protected += 1; g.protectedUntil = protectedMap.get(id) || g.protectedUntil; }
				else g.movable.push(id);
			}
		}
		const wallet = this.user.wallet || {};
		return {
			login: this.login, steamId: this.user.steamID ? this.user.steamID.getSteamID64() : null,
			wallet: wallet.hasWallet ? { balance: wallet.balance, currency: SteamUser.ECurrencyCode[wallet.currency] || String(wallet.currency) } : null,
			inventoryCount: inv.filter(i => !i.casket_id && isRealItem(i)).length,
			inventoryLimit: INVENTORY_LIMIT,
			hiddenNonStorable, inventory, caskets,
		};
	}

	async casketContents(casketId) {
		this.ensureOnline();
		const items = await new Promise((resolve, reject) =>
			this.csgo.getCasketContents(casketId, (err, list) => err ? reject(err) : resolve(list)));
		return group(items);
	}

	// Аналитика по аккаунту (как «Overview» в SkinLedger, но бесплатно): состав инвентаря и складов.
	// Быстро — считаем по свободным предметам и сводке ящиков, содержимое ящиков НЕ читаем.
	async overview() {
		this.ensureOnline();
		const inv = this.csgo.inventory;
		const caskets = inv.filter(i => i.def_index === CASKET);
		const loose = inv.filter(i => !i.casket_id && i.def_index !== CASKET && isRealItem(i));
		const stored = caskets.reduce((n, c) => n + (c.casket_contained_item_count || 0), 0);
		const kindOf = itemKind;
		const byRarity = {}, byKind = {};
		for (const it of loose) {
			const k = kindOf(it);
			byKind[k] = (byKind[k] || 0) + 1;
			if (it.rarity) byRarity[it.rarity] = (byRarity[it.rarity] || 0) + 1;
		}
		const protectedMap = await this.protectedItems().catch(() => new Map());
		const wallet = this.user.wallet || {};
		return {
			totalItems: loose.length + stored,
			inventoryCount: loose.length, inventoryLimit: INVENTORY_LIMIT,
			casketCount: caskets.length, stored, casketCapacity: caskets.length * CASKET_CAPACITY,
			byRarity, byKind,
			login: this.login, personaName: this.profile ? this.profile.name : null, avatar: this.profile ? this.profile.avatar : null,
			wallet: wallet.hasWallet ? { balance: wallet.balance, currency: SteamUser.ECurrencyCode[wallet.currency] || String(wallet.currency) } : null,
			protectedCount: loose.filter(i => protectedMap.has(String(i.id))).length,
			tradeUpReady: loose.filter(isTradeUpInput).length,
			caskets: caskets.map(c => ({ name: c.custom_name || null, count: c.casket_contained_item_count || 0, capacity: CASKET_CAPACITY }))
				.sort((a, b) => b.count - a.count),
			top: group(loose).slice(0, 10).map(g => ({ name: g.name, image: g.image, count: g.count })),
		};
	}

	// ---------------------------------------------------------------- трейд-ап (контракт обмена)

	// Пригодные для контракта предметы инвентаря, сгруппированные по (редкость, StatTrak).
	// withCaskets: подгрузить содержимое всех ящиков («Load Storage Units») — такие предметы перед
	// контрактом сами вынимаются в инвентарь.
	async tradeUpGroups(withCaskets = false) {
		this.ensureOnline();
		const pool = this.csgo.inventory.filter(i => !i.casket_id);
		this._storedTradeUp = new Map();
		if (withCaskets) {
			for (const c of this.csgo.inventory.filter(i => i.def_index === CASKET && i.casket_contained_item_count > 0)) {
				let list;
				try {
					list = await new Promise((resolve, reject) =>
						this.csgo.getCasketContents(c.id, (err, items) => err ? reject(err) : resolve(items)));
				} catch (e) { this.emit('log', `контракт: ящик «${c.custom_name || c.id}» не загрузился (${e.message})`); continue; }
				for (const it of list) { pool.push(it); this._storedTradeUp.set(String(it.id), String(c.id)); }
			}
		}
		this._tuPool = new Map(pool.map(i => [String(i.id), i]));
		const web = await require('./workshop').webAssetIds(this).catch(() => null);
		const wear = id => { const it = this._tuPool.get(id); return it && it.paint_wear != null ? it.paint_wear : 1; };
		const groups = new Map();
		for (const item of pool) {
			if (!isTradeUpInput(item)) continue;
			const st = isStatTrak(item);
			const key = `${item.rarity}:${st ? 1 : 0}`;
			if (!groups.has(key)) groups.set(key, { rarity: item.rarity, stattrak: st, raw: [] });
			groups.get(key).raw.push(item);
		}
		const stored = this._storedTradeUp;
		return [...groups.values()]
			.map(g => {
				// Заранее отсекаем то, что игра в контракт не пустит: результат берётся из коллекций входов
				// следующей редкостью (crafting.js / CSGO_Recipe_TradeUp_Desc), поэтому скин, выше которого в его
				// коллекции ничего нет (top), использовать нельзя. Защита обмена контракту не мешает.
				const items = group(g.raw).map(x => {
					const byWear = (a, b) => wear(a) - wear(b);
					const one = this._tuPool.get(x.ids[0]);
					const top = Boolean(one && tradeUpTopTier(one));
					const usable = top ? [] : x.ids;
					// сначала предметы из инвентаря (из ящиков — только если не хватает), внутри — от меньшего float
					const ids = [...usable.filter(id => !stored.has(id)).sort(byWear), ...usable.filter(id => stored.has(id)).sort(byWear)];
					const floats = ids.map(id => { const it = this._tuPool.get(id); return it && it.paint_wear != null ? Number(it.paint_wear.toFixed(6)) : null; });
					const insp = web && [...ids, ...x.ids].map(id => web.inspect.get(id)).find(Boolean);
					const allFloats = x.ids.map(id => { const it = this._tuPool.get(id); return it && it.paint_wear != null ? Number(it.paint_wear.toFixed(6)) : null; });
					return { name: x.name, image: x.image, count: ids.length, all: x.count, ids, floats: top || !ids.length ? allFloats : floats,
						stored: ids.filter(id => stored.has(id)).length, inspect: insp || null,
						blocked: top ? 'top' : null };
				}).sort((a, b) => Boolean(a.blocked) - Boolean(b.blocked) || b.count - a.count || a.name.localeCompare(b.name));
				return { rarity: g.rarity, stattrak: g.stattrak, total: items.reduce((n, i) => n + i.count, 0), items };
			})
			.sort((a, b) => a.rarity - b.rarity || a.stattrak - b.stattrak);
	}

	// Прогноз контракта: возможные исходы с шансами и ожидаемым float результата.
	// (topTier — предметы без следующей редкости в коллекции; игра их не примет)
	// Шанс: каждый вход даёт 1/N своей коллекции, внутри коллекции исходы следующей редкости равновероятны.
	// Float (≈, формула CS2): средний нормализованный float входов (f − min) / (max − min),
	// перенесённый в диапазон float результата.
	async tradeUpPreview(itemIds) {
		this.ensureOnline();
		const tu = catalog.storeMeta().tradeup;
		const pool = this._tuPool || new Map();
		const items = (itemIds || []).map(id => pool.get(String(id)) || this.csgo.inventory.find(i => String(i.id) === String(id))).filter(Boolean);
		const web = items.length ? await require('./workshop').webAssetIds(this).catch(() => null) : null;
		const skin = it => (tu && tu.skins[`${it.def_index}:${Math.round(it.paint_index || 0)}`]) || null;
		const inputs = items.map(it => ({ id: String(it.id), name: itemName(it), float: it.paint_wear != null ? it.paint_wear : null,
			collection: skin(it) ? tu.sets[skin(it)[0]] : null, inspect: (web && web.inspect.get(String(it.id))) || null, stored: Boolean(it.casket_id) }));
		const floats = inputs.map(i => i.float).filter(f => f != null);
		const out = { count: items.length, inputs, outcomes: [], avgFloat: floats.length ? floats.reduce((a, b) => a + b, 0) / floats.length : null, float: null, unknown: [] };
		if (!items.length || !tu) return out;
		const rarity = items[0].rarity, st = isStatTrak(items[0]);
		const tier = new Map();  // коллекция -> скины следующей редкости
		for (const [k, v] of Object.entries(tu.skins)) if (v[1] === rarity + 1) { if (!tier.has(v[0])) tier.set(v[0], []); tier.get(v[0]).push(k); }
		let normSum = 0, normN = 0;
		const chance = new Map();
		out.topTier = [];
		for (const it of items) {
			const sk = skin(it);
			const outs = sk && tier.get(sk[0]);
			if (!outs) { (sk ? out.topTier : out.unknown).push(itemName(it)); continue; }
			if (it.paint_wear != null) { normSum += Math.min(1, Math.max(0, (it.paint_wear - sk[2]) / ((sk[3] - sk[2]) || 1))); normN++; }
			for (const k of outs) chance.set(k, (chance.get(k) || 0) + 1 / (items.length * outs.length));
		}
		const norm = normN ? normSum / normN : null;
		out.float = norm;
		out.outcomes = [...chance].map(([key, p]) => {
			const [def, paint] = key.split(':').map(Number);
			const sk = tu.skins[key];
			const fl = norm == null ? null : sk[2] + norm * (sk[3] - sk[2]);
			const fake = { def_index: def, paint_index: paint, rarity: rarity + 1, quality: st ? 9 : 4, ...(st ? { kill_eater_value: 0 } : {}) };
			const exterior = fl == null ? null : EXTERIORS.find(([max]) => fl < max)[1];
			const name = itemName(fake);
			return { key, name, image: itemImage(fake), chance: p, float: fl, min: sk[2], max: sk[3], exterior, collection: tu.sets[sk[0]],
				marketName: exterior ? `${name} (${exterior})` : name };
		}).sort((a, b) => b.chance - a.chance || a.name.localeCompare(b.name));
		return out;
	}

	// Топ предметов внутри ящиков (читаем содержимое всех ящиков; кэш 10 минут).
	async storageTop(limit = 15) {
		this.ensureOnline();
		if (this._storageTop && Date.now() - this._storageTop.ts < 10 * 60000) return this._storageTop.data;
		const all = [];
		for (const c of this.csgo.inventory.filter(i => i.def_index === CASKET && i.casket_contained_item_count > 0)) {
			try {
				all.push(...await new Promise((resolve, reject) => this.csgo.getCasketContents(c.id, (err, items) => err ? reject(err) : resolve(items))));
			} catch (e) { /* ящик не прочитался — пропускаем */ }
		}
		const data = { total: all.length, top: group(all).slice(0, limit).map(g => ({ name: g.name, image: g.image, count: g.count })) };
		this._storageTop = { ts: Date.now(), data };
		return data;
	}

	// Вынуть предметы для контракта из ящиков (если выбраны из «Load Storage Units»).
	async _takeForTradeUp(itemIds) {
		const stored = this._storedTradeUp || new Map();
		const need = itemIds.filter(id => !this.csgo.inventory.find(i => String(i.id) === String(id) && !i.casket_id) && stored.has(String(id)));
		if (!need.length) return;
		const used = this.csgo.inventory.filter(i => !i.casket_id && isRealItem(i)).length;
		if (used + need.length > INVENTORY_LIMIT) throw new Error(`в инвентаре нет места для ${need.length} предметов из ящиков`);
		this.emit('log', `контракт: вынимаем ${need.length} шт из ящиков`);
		for (const id of need) { this.csgo.removeFromCasket(stored.get(String(id)), id); await sleep(120); }
		const deadline = Date.now() + 30000;
		while (Date.now() < deadline) {
			if (need.every(id => this.csgo.inventory.find(i => String(i.id) === String(id) && !i.casket_id))) return;
			await sleep(400);
		}
		throw new Error('не удалось вынуть предметы из ящиков — попробуйте ещё раз');
	}

	// Собрать контракт из ровно 10 предметов одной редкости и одинакового статуса StatTrak.
	// Это чистая операция Game Coordinator (оплаты нет). ВНИМАНИЕ: 10 предметов расходуются безвозвратно.
	async craftTradeUp(itemIds) {
		this.ensureOnline();
		if (!Array.isArray(itemIds) || itemIds.length !== 10) throw new Error('для контракта нужно ровно 10 предметов');
		// «выше нет» проверяем до того, как вынимать предметы из ящиков
		const pool = this._tuPool || new Map();
		const early = itemIds.map(id => pool.get(String(id)) || this.csgo.inventory.find(i => String(i.id) === String(id))).find(i => i && tradeUpTopTier(i));
		if (early) throw new Error(`«${itemName(early)}» нельзя использовать: в его коллекции нет предметов выше`);
		await this._takeForTradeUp(itemIds.map(String));
		const items = itemIds.map(id => this.csgo.inventory.find(i => String(i.id) === String(id)));
		if (items.some(i => !i)) throw new Error('какой-то из выбранных предметов не найден в инвентаре');
		if (items.some(i => !isTradeUpInput(i))) throw new Error('среди выбранных есть предмет, не пригодный для контракта');
		const rarity = items[0].rarity;
		const st = isStatTrak(items[0]);
		if (items.some(i => i.rarity !== rarity)) throw new Error('все 10 предметов должны быть одной редкости');
		if (items.some(i => isStatTrak(i) !== st)) throw new Error('нельзя смешивать StatTrak и обычные предметы');
		const top = items.find(i => tradeUpTopTier(i));
		if (top) throw new Error(`«${itemName(top)}» нельзя использовать: в его коллекции нет предметов выше`);
		const recipe = (st ? 10 : 0) + (rarity - 1);  // 0..4 обычные, 10..14 StatTrak
		const before = new Set(this.csgo.inventory.map(i => String(i.id)));
		this.csgo.craft(items.map(i => i.id), recipe);
		// GC расходует 10 предметов и выдаёт 1 новый — ждём его появления в инвентаре.
		const fresh = await new Promise(resolve => {
			const deadline = Date.now() + 20000;
			const timer = setInterval(() => {
				const nw = this.csgo.inventory.find(i => !before.has(String(i.id)) && isRealItem(i) && i.paint_index > 0);
				if (nw) { clearInterval(timer); resolve(nw); }
				else if (Date.now() > deadline) { clearInterval(timer); resolve(null); }
			}, 500);
		});
		// itemName (с StatTrak и качеством) совпадает с market_hash_name — по нему ссылка на Торговую площадку
		if (fresh) return { id: String(fresh.id), name: itemName(fresh), image: itemImage(fresh), rarity: fresh.rarity, stattrak: isStatTrak(fresh), float: fresh.paint_wear != null ? fresh.paint_wear : null };
		// Новый предмет не распознали — проверим, что входы исчезли (контракт всё же прошёл).
		const consumed = itemIds.every(id => !this.csgo.inventory.find(i => String(i.id) === String(id)));
		if (consumed) return { name: null, image: null, consumed: true };
		throw new Error('контракт не выполнился (предметы на месте) — попробуйте ещё раз');
	}

	// ---------------------------------------------------------------- operations

	// Перемещение окном запросов (speed.window штук «в полёте»), но успех определяется НЕ по ответам GC
	// (они на больших пачках теряются/задерживаются — отсюда прежние зависания и ложные ошибки),
	// а по реальному состоянию инвентаря (isDone). Застрявшие предметы переотправляются (до MAX_ATTEMPTS).
	// Скорость подбирается сама, как в TCP: пока GC успевает — окно растёт, паузы между отправками
	// сокращаются; предмет не переместился вовремя — резко сбавляем и снова плавно разгоняемся.
	// Найденный темп запоминается для аккаунта и служит стартом следующей перекладки.
	_runPipeline(info, ids, send, isDone, fullNotif) {
		if (this.job && !this.job.finished) throw new Error('уже идёт операция');
		const MAX_ATTEMPTS = 3;
		const learned = LEARNED_SPEED.get(this.login);
		const speed = { window: SPEED.window, pace: learned ? Math.min(SPEED.maxPace, learned.pace + 10) : SPEED.startPace, ok: 0, lat: null, calmUntil: 0, slowdowns: 0 };
		// время ожидания предмета — от фактической задержки GC (быстрый GC — быстрее замечаем потерю)
		const itemTimeout = () => Math.min(SPEED.maxTimeout, Math.max(SPEED.minTimeout, (speed.lat || 1200) * 6));
		// GC ограничивает частоту запросов: чаще ~10 в секунду — начинает их терять, и ожидание потерь съедает
		// больше, чем даёт спешка. Поэтому регулируем паузу между отправками (AIMD): без потерь — понемногу
		// ускоряемся, потеря — заметно замедляемся. Окно (запросов «в полёте») — небольшое и постоянное.
		const onSuccess = latency => {
			speed.lat = speed.lat == null ? latency : speed.lat * 0.8 + latency * 0.2;
			if (++speed.ok < 10) return;
			speed.ok = 0;
			speed.pace = Math.max(SPEED.minPace, speed.pace - 4);
		};
		const onLoss = () => {
			if (Date.now() < speed.calmUntil) return;  // пачка потерь из одного окна — один откат
			speed.calmUntil = Date.now() + itemTimeout();
			speed.ok = 0; speed.slowdowns++;
			speed.pace = Math.min(SPEED.maxPace, Math.round(speed.pace * 1.2 + 15));
		};
		const N = GlobalOffensive.ItemCustomizationNotification;
		const job = this.job = { ...info, done: 0, failed: 0, total: ids.length, error: null, finished: false, cancelled: false, started: Date.now() };
		let stop = null;
		const onNotif = (itemIds, type) => {
			if (type === fullNotif) stop = (fullNotif === N.CasketTooFull) ? 'ящик заполнен' : 'инвентарь заполнен';
		};
		this.csgo.on('itemCustomizationNotification', onNotif);
		const attempts = new Map(ids.map(id => [id, 0]));
		const inflight = new Map(); // id -> время отправки
		(async () => {
			while (true) {
				if (job.cancelRequested) job.cancelled = true;
				job.done = ids.reduce((n, id) => n + (isDone(id) ? 1 : 0), 0);
				for (const [id, t] of inflight) {
					if (isDone(id)) { inflight.delete(id); onSuccess(Date.now() - t); }
					else if (Date.now() - t > itemTimeout()) { inflight.delete(id); onLoss(); }
				}
				job.rate = { window: speed.window, pace: speed.pace, slowdowns: speed.slowdowns };
				if (ids.every(isDone)) break;
				if ((job.cancelled || stop) && inflight.size === 0) break;
				const pending = ids.filter(id => !isDone(id) && attempts.get(id) < MAX_ATTEMPTS && !inflight.has(id));
				if (!pending.length && inflight.size === 0) break; // больше пробовать нечего
				if (!stop && !job.cancelled) {
					while (inflight.size < speed.window && pending.length) {
						const id = pending.shift();
						try { send(id); } catch (e) { /* GC занят — попробуем снова на след. круге */ }
						inflight.set(id, Date.now());
						attempts.set(id, attempts.get(id) + 1);
						await sleep(speed.pace);
					}
				}
				await sleep(40);
			}
			LEARNED_SPEED.set(this.login, { pace: speed.pace });
			job.done = ids.reduce((n, id) => n + (isDone(id) ? 1 : 0), 0);
			job.failed = ids.length - job.done;
			if (stop && job.failed) job.error = stop;
		})().catch(e => { job.error = humanError(e); }).finally(() => {
			this.csgo && this.csgo.off('itemCustomizationNotification', onNotif);
			job.finished = true;
			job.ended = Date.now();
			if (!job.error && job.failed) job.error = `${job.failed} шт не перемещено`;
			this.emit('jobDone', job);
		});
		return job;
	}

	// ---------------------------------------------------------------- правила автоперекладки
	// Правило: { kind: 'any'|'container'|'sticker'|'skin'|'knifeglove'|'graffiti'|'other', text: 'часть названия',
	//            casket: 'префикс имени ящика' } — подходящие предметы из инвентаря раскладываются по ящикам,
	// чьё имя начинается с префикса (по алфавиту: «Cases 01», затем «Cases 02»...). Правила идут по порядку,
	// предмет достаётся первому подошедшему правилу.
	async planRules(rules) {
		this.ensureOnline();
		const protectedMap = await this.protectedItems();
		const caskets = this.csgo.inventory.filter(i => i.def_index === CASKET && i.custom_name)
			.map(c => ({ id: String(c.id), name: c.custom_name, free: CASKET_CAPACITY - (c.casket_contained_item_count || 0) }))
			.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
		let pool = this.csgo.inventory.filter(i => !i.casket_id && i.def_index !== CASKET && isStorable(i) && !protectedMap.has(String(i.id)));
		const steps = [], unplaced = [];
		(rules || []).forEach((r, idx) => {
			const text = String(r.text || '').trim().toLowerCase();
			const prefix = String(r.casket || '').trim().toLowerCase();
			if (!prefix) return;
			const match = pool.filter(i => (!r.kind || r.kind === 'any' || itemKind(i) === r.kind) && (!text || itemName(i).toLowerCase().includes(text)));
			pool = pool.filter(i => !match.includes(i));
			let rest = match;
			for (const c of caskets.filter(c => c.name.toLowerCase().startsWith(prefix))) {
				if (!rest.length) break;
				const take = rest.slice(0, Math.max(0, c.free));
				if (!take.length) continue;
				rest = rest.slice(take.length);
				c.free -= take.length;
				const names = {};
				for (const i of take) { const n = itemName(i); names[n] = (names[n] || 0) + 1; }
				steps.push({ rule: idx, casketId: c.id, casketName: c.name, ids: take.map(i => String(i.id)), count: take.length,
					top: Object.entries(names).sort((a, b) => b[1] - a[1]).slice(0, 4) });
			}
			if (rest.length) unplaced.push({ rule: idx, count: rest.length });
		});
		return { steps, unplaced, total: steps.reduce((n, x) => n + x.count, 0) };
	}

	// Выполнить план: по очереди перекладка в каждый ящик (обычными задачами — прогресс виден в UI).
	async applyRules(rules) {
		if (this.job && !this.job.finished) throw new Error('уже идёт операция');
		const plan = await this.planRules(rules);
		if (!plan.total) return plan;
		this.rulesRun = { step: 0, steps: plan.steps.length, finished: false };
		(async () => {
			for (const [i, st] of plan.steps.entries()) {
				if (this.status !== 'online') break;
				this.rulesRun.step = i + 1;
				const job = this.storeItems(st.casketId, st.ids, st.casketName);
				job.rules = { step: i + 1, steps: plan.steps.length };
				while (!job.finished) await sleep(300);
				if (job.cancelled) break;
			}
		})().catch(e => this.emit('log', `правила: ${humanError(e)}`)).finally(() => { this.rulesRun.finished = true; });
		this.emit('log', `правила: ${plan.total} шт в ${plan.steps.length} ящ.`);
		return plan;
	}

	cancelJob() {
		if (this.job && !this.job.finished) this.job.cancelRequested = true;
	}

	storeItems(casketId, ids, casketName) {
		this.ensureOnline();
		const casket = this.csgo.inventory.find(i => String(i.id) === String(casketId));
		if (!casket) throw new Error('ящик не найден');
		if (!casket.custom_name) throw new Error('у ящика нет имени — сначала назовите его');
		const free = CASKET_CAPACITY - (casket.casket_contained_item_count || 0);
		if (ids.length > free) throw new Error(`в ящике свободно только ${free} мест`);
		const N = GlobalOffensive.ItemCustomizationNotification;
		// Положено = предмет больше не лежит свободно в инвентаре (ушёл в контейнер).
		const stored = id => { const it = this.csgo.inventory.find(i => String(i.id) === id); return !it || Boolean(it.casket_id); };
		return this._runPipeline({ kind: 'store', casketId, casketName }, ids,
			id => this.csgo.addToCasket(casketId, id), stored, N.CasketTooFull);
	}

	takeItems(casketId, ids, casketName) {
		this.ensureOnline();
		const free = INVENTORY_LIMIT - this.csgo.inventory.filter(i => !i.casket_id && isRealItem(i)).length;
		if (ids.length > free) throw new Error(`в инвентаре свободно только ${free} мест`);
		const N = GlobalOffensive.ItemCustomizationNotification;
		// Забрано = предмет появился в инвентаре свободным (без casket_id).
		const taken = id => { const it = this.csgo.inventory.find(i => String(i.id) === id); return Boolean(it) && !it.casket_id; };
		return this._runPipeline({ kind: 'take', casketId, casketName }, ids,
			id => this.csgo.removeFromCasket(casketId, id), taken, N.CasketInvFull);
	}

	async nameCasket(casketId, name) {
		this.ensureOnline();
		const ack = waitFor(this.csgo, 'itemCustomizationNotification', 15000, 'ответ на переименование');
		this.csgo.nameItem(0, casketId, name);
		await ack;
		await sleep(1500);  // the renamed casket arrives as a new item with a new id
	}

	// ---------------------------------------------------------------- магазин CS2 (микротранзакция Steam)

	// Шаг 1: заказ в GC + счёт от Steam (деньги ещё НЕ списаны). Пользователь видит итог и подтверждает.
	async initPurchase(defId, count) {
		this.ensureOnline();
		const info = await require('./store').initPurchase(this, Number(defId), Math.max(1, Math.min(100, Number(count) || 1)));
		this.pendingTxn = { ...info, ts: Date.now(), paid: false };
		const { transId, ...pub } = info;
		return pub;
	}

	// Шаг 2: оплата (как кнопка «Купить» в оверлее Steam) и выдача предметов.
	async confirmPurchase(txnId) {
		this.ensureOnline();
		const p = this.pendingTxn;
		if (!p || String(p.txnId) !== String(txnId)) throw new Error('нет ожидающей покупки');
		const store = require('./store');
		if (!p.paid) {
			if (Date.now() - p.ts > 10 * 60000) { this.pendingTxn = null; throw new Error('заказ устарел — начните покупку заново'); }
			await store.authorizePurchase(this, p.transId);
			p.paid = true;
		}
		const result = await store.finalizePurchase(this, p.txnId);
		this.pendingTxn = null;
		return result;
	}

	// Повторная выдача уже оплаченного заказа (если GC не ответил с первого раза).
	async finalizePurchase(txnId) {
		this.ensureOnline();
		const result = await require('./store').finalizePurchase(this, String(txnId));
		if (this.pendingTxn && String(this.pendingTxn.txnId) === String(txnId)) this.pendingTxn = null;
		return result;
	}

	// Неподтверждённый заказ просто бросаем — без 5505 Steam ничего не списывает.
	cancelPurchase() { if (this.pendingTxn && !this.pendingTxn.paid) this.pendingTxn = null; }
}

function humanError(e) {
	const map = {
		InvalidPassword: 'неверный логин или пароль',
		RateLimitExceeded: 'Steam временно ограничил вход с этого IP — подождите 30–60 минут или используйте прокси',
		AccountLoginDeniedThrottle: 'слишком много попыток входа — подождите',
		InvalidLoginAuthCode: 'неверный код Steam Guard',
		TwoFactorCodeMismatch: 'неверный код Steam Guard',
		LoggedInElsewhere: 'в этот аккаунт вошли в игре на другом устройстве — закройте там игру',
		LogonSessionReplaced: 'сессию заменил вход с другого устройства',
		AccessDenied: 'доступ запрещён — войдите заново (логин и пароль или QR-код)',
		Expired: 'сохранённый вход устарел — войдите заново',
		ServiceUnavailable: 'Steam временно недоступен — попробуйте позже',
		TryAnotherCM: 'не удалось подключиться к Steam — попробуйте ещё раз',
	};
	return map[e.message] || e.message;
}

module.exports = { CasketSession, AccountStore, itemName, itemImage, CASKET_CAPACITY, humanError, _SPEED: SPEED };
