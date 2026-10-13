// Local API for the UI. Listens on 127.0.0.1 only; every request needs the random token
// that the Electron window receives at start-up.
//
// Поддерживается несколько аккаунтов одновременно (у каждого — свой прокси). Один аккаунт может
// находиться в процессе входа (pending), остальные уже подключены (sessions, ключ — логин).
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const QRCode = require('qrcode');

// Картинка QR рисуется локально (без сторонних сервисов); кэш — чтобы не перерисовывать на каждый опрос статуса.
let qrCache = { url: null, img: null };
async function qrImage(url) {
	if (qrCache.url !== url) qrCache = { url, img: await QRCode.toDataURL(url, { margin: 1, width: 280 }) };
	return qrCache.img;
}
const SteamUser = require('steam-user');
const { CasketSession, AccountStore, humanError } = require('./core/session');
const prices = require('./core/prices');
const { Portfolio } = require('./core/portfolio');
const { Ledger, importMarketHistory, parseCsv, parseSihCsv, isSihCsv } = require('./core/ledger');

class Manager {
	constructor({ dataDir, crypto: cryptoBox }) {
		this.dataDir = dataDir;
		this.crypto = cryptoBox;
		this.store = new AccountStore(dataDir, cryptoBox);  // один общий список сохранённых аккаунтов
		this.sessions = new Map();   // логин -> подключённая CasketSession
		this.pending = null;         // сессия, которая сейчас входит (логин ещё мог быть неизвестен — QR)
		this.historyFile = path.join(dataDir, 'history.jsonl');
		this.settingsFile = path.join(dataDir, 'settings.json');
		this.portfolio = new Portfolio(dataDir);
		this.valueFile = path.join(dataDir, 'value_cache.json');
		this.valueCache = new Map();
		try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(this.valueFile, 'utf8')))) this.valueCache.set(k, v); } catch (e) { /* нет кэша */ }
		this.ledger = new Ledger(dataDir);
		this.logLines = [];
	}

	log(line) {
		this.logLines.push({ t: Date.now(), line });
		if (this.logLines.length > 300) this.logLines.shift();
	}

	// Настройки всего приложения (не аккаунта): быстрая покупка, избранное магазина.
	// Хранятся на диске, а не в localStorage — порт сервера (и origin страницы) меняется при каждом запуске.
	settings() {
		const def = { favorites: [], autoAcceptGifts: false, rules: [], autoApplyRules: false, supportNudgeAt: 0, supportHideNudges: false, stickerConfirm: true, welcomed: false, tourDone: false, navCollapsed: false,
			priceEnabled: true, priceSource: 'steam', priceCurrency: 'auto', priceAfterFee: false };
		try { return { ...def, ...JSON.parse(fs.readFileSync(this.settingsFile, 'utf8')) }; } catch (e) { return def; }
	}

	saveSettings(patch) {
		const cur = this.settings();
		if ('autoAcceptGifts' in patch) cur.autoAcceptGifts = Boolean(patch.autoAcceptGifts);
		if ('autoApplyRules' in patch) cur.autoApplyRules = Boolean(patch.autoApplyRules);
		if (typeof patch.lang === 'string' && /^[a-z]{2}$/.test(patch.lang)) cur.lang = patch.lang;
		if ('supportNudgeAt' in patch) cur.supportNudgeAt = Number(patch.supportNudgeAt) || 0;
		if ('supportHideNudges' in patch) cur.supportHideNudges = Boolean(patch.supportHideNudges);
		for (const k of ['stickerConfirm', 'welcomed', 'tourDone', 'navCollapsed', 'priceEnabled', 'priceAfterFee', 'marketAutoConfirm', 'streamerMode', 'streamerMoney', 'starClicked']) if (k in patch) cur[k] = Boolean(patch[k]);
		if (typeof patch.priceSource === 'string' && prices.SOURCES[patch.priceSource]) cur.priceSource = patch.priceSource;
		if (patch.updateMode === 'ask' || patch.updateMode === 'off') cur.updateMode = patch.updateMode;
		if ('skipVersion' in patch) cur.skipVersion = /^\d+\.\d+\.\d+$/.test(String(patch.skipVersion)) ? String(patch.skipVersion) : '';
		if (patch.confirms && typeof patch.confirms === 'object') {
			cur.confirms = {};
			for (const [k, v] of Object.entries(patch.confirms)) if (/^[a-z]{2,12}$/.test(k)) cur.confirms[k] = Boolean(v);
		}
		if (typeof patch.priceCurrency === 'string' && /^(auto|[A-Z]{3})$/.test(patch.priceCurrency)) cur.priceCurrency = patch.priceCurrency;
		if (Array.isArray(patch.rules)) {
			const kinds = ['any', 'container', 'sticker', 'skin', 'knifeglove', 'graffiti', 'other'];
			cur.rules = patch.rules.slice(0, 50).map(r => ({
				kind: kinds.includes(r.kind) ? r.kind : 'any',
				text: String(r.text || '').slice(0, 100), casket: String(r.casket || '').slice(0, 40),
			})).filter(r => r.casket.trim());
		}
		for (const k of ['pinnedAccounts', 'accountOrder']) {
			if (Array.isArray(patch[k])) cur[k] = [...new Set(patch[k].map(String).filter(x => /^[\w.@-]{1,64}$/.test(x)))].slice(0, 500);
		}
		if (Array.isArray(patch.favorites)) cur.favorites = [...new Set(patch.favorites.map(Number).filter(Number.isInteger))].slice(0, 500);
		fs.writeFileSync(this.settingsFile, JSON.stringify(cur, null, 2));
		return cur;
	}

	// Автоприём подарков (трейдов, где мы ничего не отдаём) — для всех подключённых аккаунтов, раз в минуту.
	startGiftWatcher() {
		const community = require('./core/community');
		const tick = async () => {
			if (!this.settings().autoAcceptGifts) return;
			for (const s of this.sessions.values()) {
				if (s.status !== 'online' || !s.webCookies) continue;
				try {
					const got = await community.autoAcceptGifts(s);
					for (const o of got) {
						this.log(`${s.login}: принят подарок от ${o.partnerName || o.partner} (${o.receive.length} шт)`);
						this.history({ login: s.login, action: 'gift', offer: o.id, items: o.receive.length });
					}
				} catch (e) { /* следующая попытка через минуту */ }
			}
		};
		setInterval(() => tick().catch(() => {}), 60000).unref();
	}

	// Цены по настройкам (null — выключены). wait=false: не ждём скачивания, берём только уже загруженный прайс.
	async pricing(wait = true) {
		const st = this.settings();
		if (!st.priceEnabled) return null;
		let data;
		if (wait) data = await prices.ensure(st.priceSource);
		else {
			if (!prices.loaded(st.priceSource)) { prices.ensure(st.priceSource).catch(() => {}); return null; }
			data = await prices.ensure(st.priceSource);
		}
		let currency = st.priceCurrency;
		if (currency === 'auto') {
			const s = [...this.sessions.values()].find(x => x.user && x.user.wallet && x.user.wallet.hasWallet);
			currency = (s && SteamUser.ECurrencyCode[s.user.wallet.currency]) || 'USD';
		}
		return prices.pricer(data, { currency, afterFee: st.priceAfterFee });
	}

	// Стоимость аккаунта + снимок в историю (только если прочитаны все ящики — иначе сумма неполная).
	async valuate(session, pr) {
		const v = await session.valuation(pr);
		if (!v.unreadCaskets) this.portfolio.record(session.login, pr.source, v);
		return v;
	}

	// Ежедневный снимок стоимости для подключённых аккаунтов (раз в день, когда аккаунт не занят перекладкой).
	startPortfolioWatcher() {
		const tick = async () => {
			const st = this.settings();
			if (!st.priceEnabled) return;
			for (const s of this.sessions.values()) {
				if (s.status !== 'online' || (s.job && !s.job.finished) || this.portfolio.hasToday(s.login, st.priceSource)) continue;
				try { await this.valuate(s, await this.pricing()); } catch (e) { /* попробуем позже */ }
			}
		};
		if (this.settings().priceEnabled) {  // прайс заранее — для цен в списках; остальные источники — в фоне
			const src = this.settings().priceSource;
			prices.ensure(src).catch(() => {}).finally(() => prices.prefetchOthers(src));
		}
		setTimeout(() => tick().catch(() => {}), 60000).unref();
		setInterval(() => tick().catch(() => {}), 20 * 60000).unref();
	}

	storeValue(key, data) {
		this.valueCache.set(key, { ts: Date.now(), data });
		clearTimeout(this._valueSave);
		this._valueSave = setTimeout(() => {
			try { fs.writeFileSync(this.valueFile, JSON.stringify(Object.fromEntries([...this.valueCache].slice(-40)))); } catch (e) { /* не критично */ }
		}, 2000);
	}

	history(entry) {
		try { fs.appendFileSync(this.historyFile, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'); } catch (e) { /* ignore */ }
	}

	_wire(session) {
		session.on('log', line => this.log(`${session.login || '…'}: ${line}`));
		session.on('jobDone', job => {
			const verb = job.kind === 'store' ? 'положено в' : 'забрано из';
			this.log(`${session.login}: ${verb} «${job.casketName || job.casketId}»: ${job.done}/${job.total}${job.error ? ` — ${job.error}` : ''}`);
			this.history({ login: session.login, action: job.kind, casket: job.casketId, casketName: job.casketName, done: job.done, total: job.total, error: job.error });
		});
		return session;
	}

	newSession() {
		return this._wire(new CasketSession({ dataDir: this.dataDir, crypto: this.crypto, accounts: this.store }));
	}

	// Аккаунт для действий: по логину из запроса; если логин один — можно не указывать.
	require(login) {
		if (!login && this.sessions.size === 1) return [...this.sessions.values()][0];
		const s = login && this.sessions.get(login);
		if (!s) throw new Error('аккаунт не подключён');
		return s;
	}

	// Перенос вошедшего аккаунта из pending в список подключённых (под его логином).
	promote(session) {
		if (!session.login) return;
		const old = this.sessions.get(session.login);
		if (old && old !== session) old.logout();
		this.sessions.set(session.login, session);
		if (this.pending === session) this.pending = null;
		// заранее читаем ящики (для «Обзора», стоимости и контрактов) — к открытию вкладки всё уже готово
		setTimeout(async () => {
			if (session.status !== 'online' || !session._casketItems) return;
			try {
				await session._casketItems();
				const pr = this.settings().priceEnabled ? await this.pricing() : null;
				if (pr && this.computeValue) this.storeValue(this.valueKey(session.login), await this.computeValue([session], pr));
			} catch (e) { /* «Обзор» посчитает сам */ }
		}, 4000).unref();
	}

	// Короткая сводка по аккаунту для списка вкладок (без тяжёлого инвентаря).
	brief(session) {
		return {
			login: session.login, status: session.status, error: session.error,
			wallet: session.user && session.user.wallet && session.user.wallet.hasWallet ? { balance: session.user.wallet.balance, currency: SteamUser.ECurrencyCode[session.user.wallet.currency] } : null,
			proxyBad: Boolean(this.guard && session.proxy && this.guard.proxy.get(session.login) && !this.guard.proxy.get(session.login).ok),
			personaName: session.profile ? session.profile.name : null, avatar: session.profile ? session.profile.avatar : null,
			needsRelogin: session.needsRelogin, proxy: session.proxy || '', canConfirm: Boolean(session.identitySecret),
			job: session.job, pendingTxn: session.pendingTxn ? { txnId: session.pendingTxn.txnId, name: session.pendingTxn.name } : null,
		};
	}
}

function start({ dataDir, secretBox, exportDir }) {
	const mgr = new Manager({ dataDir, crypto: secretBox });
	const token = crypto.randomBytes(24).toString('hex');

	const app = express();
	// импорт CSV (выгрузка SIH за годы — несколько МБ) — свой лимит, остальное — как раньше
	const jsonSmall = express.json({ limit: '1mb' }), jsonBig = express.json({ limit: '64mb' });
	app.use((req, res, next) => (req.path === '/api/pnl/csv' ? jsonBig : jsonSmall)(req, res, next));
	app.use((req, res, next) => {
		if (!req.path.startsWith('/api/')) return next();
		if (req.get('x-token') === token) return next();
		res.status(401).json({ error: 'нет доступа' });
	});
	app.use(express.static(path.join(__dirname, 'ui')));
	app.use('/av', express.static(path.join(dataDir, 'avatars'), { maxAge: 0 }));
	// Картинки предметов из зеркала GitHub: скачиваем один раз, храним на диске и отдаём с правильным типом.
	const IMG_TYPES = { '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
	const imgLoading = new Map();
	app.get('/img', async (req, res) => {
		const { RAW_IMG } = require('./core/catalog');
		const u = String(req.query.u || '');
		const ext = (path.extname(u.split('?')[0]) || '').toLowerCase();
		if (!u.startsWith(RAW_IMG) || u.includes('..') || !IMG_TYPES[ext]) return res.status(404).end();
		const dir = path.join(process.env.CASKET_DATA_CACHE || path.join(dataDir, 'catalog'), 'img');
		const file = path.join(dir, crypto.createHash('sha1').update(u).digest('hex') + ext);
		const send = () => res.set({ 'Content-Type': IMG_TYPES[ext], 'Cache-Control': 'max-age=604800' }).sendFile(file);
		if (fs.existsSync(file)) return send();
		try {
			if (!imgLoading.has(u)) imgLoading.set(u, (async () => {
				const r = await fetch(u, { headers: { 'User-Agent': 'Caskit' } });
				if (!r.ok) throw new Error('HTTP ' + r.status);
				fs.mkdirSync(dir, { recursive: true });
				fs.writeFileSync(file + '.tmp', Buffer.from(await r.arrayBuffer()));
				fs.renameSync(file + '.tmp', file);
			})().finally(() => imgLoading.delete(u)));
			await imgLoading.get(u);
			send();
		} catch (e) { res.status(502).end(); }
	});

	const handle = fn => async (req, res) => {
		try { res.json(await fn(req)); } catch (e) { res.status(400).json({ error: humanError(e) }); }
	};
	// Выбор аккаунта по запросу (body.account для POST, query.account для GET).
	const pick = req => mgr.require((req.body && req.body.account) || req.query.account);

	app.get('/api/status', handle(async req => {
		const accounts = [...mgr.sessions.values()].map(s => mgr.brief(s));
		const p = mgr.pending;
		const pending = p ? {
			...mgr.brief(p),
			mode: p.mode, guardDomain: p.guardDomain, guardWrong: p.guardWrong,
			qr: p.status === 'qr' && p.qrUrl ? await qrImage(p.qrUrl) : null,
			qrLeft: p.status === 'qr' && p.qrExpires ? Math.max(0, Math.round((p.qrExpires - Date.now()) / 1000)) : null,
			qrScanned: p.status === 'qr' ? Boolean(p.qrScanned) : false,
		} : null;
		return { accounts, pending, log: mgr.logLines.slice(-25), alerts: mgr.guard ? mgr.guard.alerts.slice(-10) : [] };
	}));

	app.get('/api/accounts', handle(() => mgr.store.list()));
	app.post('/api/accounts/forget', handle(req => {
		const login = req.body.login;
		const s = mgr.sessions.get(login);
		if (s) { s.logout(); mgr.sessions.delete(login); }
		mgr.store.remove(login);
		return { ok: true };
	}));

	app.post('/api/login', handle(req => {
		const { mode, login, password, maFile, proxy, remember } = req.body;
		// QR на экране входа висит «в фоне» — любой другой вход (или новый QR) просто заменяет его.
		if (mgr.pending && mgr.pending.status === 'qr') { mgr.pending.logout(); mgr.pending = null; }
		if (mgr.pending && ['connecting', 'guard', 'qr'].includes(mgr.pending.status)) throw new Error('дождитесь завершения текущего входа');
		const session = mgr.pending = mgr.newSession();
		session.start({ mode, login: login && login.trim(), password, maFile, proxy: proxy ? proxy.trim() : proxy, remember })
			.then(() => {
				mgr.promote(session); mgr.history({ login: session.login, action: 'login' });
				// «Применять правила после входа»: даём инвентарю догрузиться и раскладываем.
				const st = mgr.settings();
				if (st.autoApplyRules && st.rules.length) setTimeout(() => session.applyRules(st.rules)
					.then(p => p.total && mgr.log(`${session.login}: правила после входа — ${p.total} шт`))
					.catch(e => mgr.log(`${session.login}: правила — ${humanError(e)}`)), 6000);
			})
			.catch(e => { if (!/QR отменён|вход прерван/.test(e.message)) mgr.log(`ошибка входа${session.login ? ' ' + session.login : ''}: ${humanError(e)}`); });
		return { ok: true };
	}));
	app.post('/api/login/qr/cancel', handle(() => {
		const p = mgr.pending;
		if (p && p.mode === 'qr' && !p.qrScanned && ['connecting', 'qr', 'error'].includes(p.status) && !(p.status === 'connecting' && p.login)) { p.logout(); mgr.pending = null; }
		return { ok: true };
	}));
	app.post('/api/login/remember', handle(req => { if (mgr.pending) mgr.pending.remember = Boolean(req.body.remember); return { ok: true }; }));
	app.post('/api/guard', handle(req => { if (!mgr.pending) throw new Error('код сейчас не запрашивается'); mgr.pending.submitGuardCode(req.body.code || ''); return { ok: true }; }));

	app.post('/api/logout', handle(req => {
		const login = req.body && req.body.account;
		if (login && mgr.sessions.has(login)) { mgr.sessions.get(login).logout(); mgr.sessions.delete(login); }
		else if (mgr.pending) { mgr.pending.logout(); mgr.pending = null; }
		return { ok: true };
	}));

	// Цена за штуку у групп предметов (если прайс уже загружен — не ждём скачивания)
	const withPrices = async groups => {
		const pr = await mgr.pricing(false).catch(() => null);
		if (pr) for (const g of groups) g.price = pr.value(g.name);
		return groups;
	};
	app.get('/api/state', handle(async req => {
		const snap = await pick(req).snapshot();
		await withPrices(snap.inventory);
		const pr = await mgr.pricing(false).catch(() => null);
		if (pr) snap.priceCurrency = pr.currency;
		return snap;
	}));
	app.get('/api/overview', handle(async req => pick(req).overview()));
	app.get('/api/overview/storage', handle(async req => {
		if (req.query.all === '1') {
			const merged = new Map(); let total = 0;
			for (const s of mgr.sessions.values()) {
				if (s.status !== 'online') continue;
				try { const r = await s.storageTop(50); total += r.total; for (const g of r.top) { const m = merged.get(g.name) || { ...g, count: 0 }; m.count += g.count; merged.set(g.name, m); } } catch (e) { /* пропуск */ }
			}
			return { total, top: [...merged.values()].sort((a, b) => b.count - a.count).slice(0, 15) };
		}
		return pick(req).storageTop();
	}));
	// Стоимость (одного или всех аккаунтов) + история. Деньги — в валюте пользователя.
	// Последний расчёт стоимости по охвату и настройкам цен — сразу отдаётся при открытии «Обзора» (и после перезапуска),
	// пока считается свежий.
	const valueKey = (scope) => { const st = mgr.settings(); return `${scope}|${st.priceSource}|${st.priceCurrency}|${st.priceAfterFee ? 1 : 0}`; };
	async function computeValue(list, pr) {
		const now = {}, errors = [];
		for (const s of list) {
			try { now[s.login] = await mgr.valuate(s, pr); } catch (e) { errors.push({ login: s.login, error: humanError(e) }); }
		}
		const vs = Object.values(now);
		const m = x => (x == null ? null : Math.round(x * pr.k * 100) / 100);
		const kinds = {}, top = new Map();
		for (const v of vs) {
			for (const [k, usd] of Object.entries(v.kinds)) kinds[k] = (kinds[k] || 0) + usd;
			for (const g of v.top) { const t = top.get(g.name) || { ...g, count: 0, inv: 0 }; t.count += g.count; t.inv += g.inv; top.set(g.name, t); }
		}
		const sum = mgr.portfolio.summary(now, pr.source);
		// прибыль по ценам покупки (вкладка «Портфель») и «вложено» по дням — для графика
		const logins = Object.keys(now);
		let pnl = null, invested = null;
		if (mgr.ledger.records(logins).length) {
			const r = mgr.ledger.compute(holdingsOf(vs), logins, pr.toUsd);
			const total = r.unrealized + r.realized;
			pnl = { total: Math.round(total * pr.rate * 100) / 100, roi: r.invested > 0 ? r.unrealized / r.invested : null };
			const recs = mgr.ledger.records(logins).slice().sort((a, b) => a.ts - b.ts);
			invested = sum.series.map(p => {
				const end = new Date(`${p.d}T23:59:59`).getTime();
				let net = 0;
				for (const x of recs) { if (x.ts > end) break; const u = pr.toUsd(x.unit, x.cur); if (u != null) net += (x.kind === 'buy' ? 1 : -1) * u * x.qty; }
				return { d: p.d, value: Math.round(net * pr.rate * 100) / 100 };
			});
		}
		const images = Object.assign({}, ...vs.map(v => v.images || {}));
		const mover = x => ({ ...x, image: images[x.name] || null, delta: m(x.delta), was: m(x.was), now: m(x.now) });
		const ch = c => c && { from: c.from, value: m(c.usd), pct: c.pct, price: m(c.priceUsd), up: c.up.map(mover), down: c.down.map(mover) };
		const sumOf = k => vs.reduce((n, v) => n + v[k], 0);
		const result = {
			currency: pr.currency, source: pr.source, ts: pr.ts, afterFee: pr.afterFee,
			total: m(sumOf('usd')), inventory: m(sumOf('invUsd')), storage: m(sumOf('storageUsd')),
			unpriced: sumOf('unpriced'), unreadCaskets: sumOf('unreadCaskets'), errors,
			accounts: vs.map(v => ({ login: v.login, personaName: v.personaName, total: m(v.usd) })),
			caskets: vs.length === 1 ? vs[0].caskets.map(c => ({ ...c, value: m(c.usd) })) : [],
			kinds: Object.fromEntries(Object.entries(kinds).map(([k, usd]) => [k, m(usd)])),
			top: [...top.values()].sort((a, b) => b.usd * b.count - a.usd * a.count).slice(0, 15)
				.map(g => ({ name: g.name, image: g.image, count: g.count, unit: m(g.usd), value: m(g.usd * g.count) })),
			series: sum.series.map(p => ({ d: p.d, value: m(p.usd), accounts: p.accounts })), since: sum.since, invested, pnl,
			counts: { items: vs.reduce((n, v) => n + Object.values(v.held || {}).reduce((a, b) => a + b, 0), 0) },
			change: { d1: ch(sum.change.d1), d7: ch(sum.change.d7), d30: ch(sum.change.d30), all: ch(sum.change.all) },
		};
		return result;
	}
	mgr.computeValue = computeValue; mgr.valueKey = valueKey;
	app.get('/api/overview/value', handle(async req => {
		const all = req.query.all === '1';
		const key = valueKey(all ? '*' : pick(req).login);
		if (req.query.fast === '1') { const c = mgr.valueCache.get(key); if (c) return { ...c.data, cached: true, cachedAt: c.ts }; }
		const pr = await mgr.pricing();
		if (!pr) return { disabled: true };
		const list = all ? [...mgr.sessions.values()].filter(s => s.status === 'online') : [pick(req)];
		const result = await computeValue(list, pr);
		mgr.storeValue(key, result);
		return result;
	}));
	// ---------------- прибыль и убыток (P&L) по ценам покупки
	const PHASE = / · (Phase \d|Ruby|Sapphire|Black Pearl|Emerald)$/;
	const pnlScope = req => (req.query.all === '1' || (req.body && req.body.all)
		? [...mgr.sessions.values()].filter(s => s.status === 'online') : [pick(req)]);
	// Что лежит сейчас (по рыночным названиям, фазы Doppler — вместе): { название: { count, usd, image } }
	async function pnlHoldings(list, pr) {
		const vs = [];
		for (const s of list) vs.push(await mgr.valuate(s, pr));
		return holdingsOf(vs);
	}
	function holdingsOf(vs) {
		const holdings = {};
		for (const v of vs) {
			for (const [key, count] of Object.entries(v.held || {})) {
				const name = key.replace(PHASE, '');
				const h = holdings[name] || (holdings[name] = { count: 0, usdSum: 0, priced: 0, image: null });
				h.count += count;
				const it = v.items[key];
				if (it) { h.usdSum += it[1] * count; h.priced += count; }
				h.image = h.image || (v.images || {})[key] || null;
			}
		}
		for (const h of Object.values(holdings)) h.usd = h.priced ? h.usdSum / h.priced : null;
		return holdings;
	}
	app.get('/api/pnl', handle(async req => {
		const pr = await mgr.pricing();
		if (!pr) return { disabled: true };
		const list = pnlScope(req);
		const holdings = await pnlHoldings(list, pr);
		const logins = list.map(s => s.login);
		const r = mgr.ledger.compute(holdings, logins, pr.toUsd);
		const val = x => (x == null ? null : Math.round(x * pr.k * 100) / 100);    // рыночная стоимость (с учётом «за вычетом комиссии»)
		const paid = x => (x == null ? null : Math.round(x * pr.rate * 100) / 100); // реально уплачено/получено
		const positions = r.positions.map(p => {
			const value = val(p.valueUsd), cost = paid(p.costUsd);
			return { name: p.name, image: p.image, held: p.held, covered: p.covered, avg: paid(p.avgUsd), unit: val(p.unitUsd),
				cost, value, pnl: value != null && p.covered ? Math.round((value - cost) * 100) / 100 : null,
				roi: value != null && cost > 0 ? (value - cost) / cost : null, realized: paid(p.realizedUsd), sold: p.sold, bought: p.bought };
		});
		const invested = positions.reduce((n, p) => n + (p.value != null && p.covered ? p.cost : 0), 0);
		const value = positions.reduce((n, p) => n + (p.value != null && p.covered ? p.value : 0), 0);
		return {
			currency: pr.currency, source: pr.source, afterFee: pr.afterFee, positions,
			invested: Math.round(invested * 100) / 100, value: Math.round(value * 100) / 100, unrealized: Math.round((value - invested) * 100) / 100,
			roi: invested > 0 ? (value - invested) / invested : null, realized: paid(r.realized),
			uncoveredQty: r.uncoveredQty, uncoveredValue: val(r.uncoveredUsd), soldNoCost: r.soldNoCost, records: r.records,
			imports: Object.fromEntries(logins.map(l => [l, mgr.ledger.importInfo(l)])),
			// для ручного ввода: только то, что продаётся на Торговой площадке (без медалей, монет и т.п.) — [в наличии, с ценой покупки]
			names: Object.fromEntries(Object.keys(holdings).filter(n => holdings[n].usd != null).sort()
				.map(n => { const p = r.positions.find(x => x.name === n); return [n, [holdings[n].count, p ? p.covered : 0, holdings[n].image]]; })),
		};
	}));
	// «Заполнить по текущим ценам»: всё, у чего нет цены покупки, записывается как купленное сегодня по текущей цене.
	app.post('/api/pnl/fill', handle(async req => {
		const pr = await mgr.pricing();
		if (!pr) throw new Error('цены выключены');
		let added = 0, items = 0;
		for (const s of pnlScope(req)) {
			const holdings = await pnlHoldings([s], pr);
			const r = mgr.ledger.compute(holdings, [s.login], pr.toUsd);
			const covered = new Map(r.positions.map(p => [p.name, p.covered]));
			const rows = [];
			for (const [name, h] of Object.entries(holdings)) {
				const need = h.count - (covered.get(name) || 0);
				if (need > 0 && h.usd != null) rows.push({ login: s.login, kind: 'buy', name, qty: need, unit: Math.round(h.usd * pr.rate * 10000) / 10000, cur: pr.currency, ts: Date.now(), src: 'fill' });
			}
			added += mgr.ledger.add(rows);
			items += rows.reduce((n, x) => n + x.qty, 0);
		}
		return { added, items };
	}));
	app.get('/api/pnl/records', handle(req => {
		const logins = pnlScope(req).map(s => s.login);
		const all = mgr.ledger.records(logins).sort((a, b) => b.ts - a.ts);
		return { total: all.length, rows: all.slice(0, 1000) };
	}));
	// Импорт истории ТП — фоновая задача с прогрессом (большие истории идут минутами; при лимите Steam ждём сами).
	mgr.importJobs = mgr.importJobs || new Map();
	app.post('/api/pnl/import', handle(req => {
		const s = pick(req);
		const cur = mgr.importJobs.get(s.login);
		if (cur && !cur.finished) return cur;
		const job = { login: s.login, done: 0, total: null, found: 0, added: 0, waiting: 0, finished: false, error: null, stop: false, started: Date.now() };
		mgr.importJobs.set(s.login, job);
		importMarketHistory(s, mgr.ledger, { onProgress: p => Object.assign(job, { waiting: 0 }, p), shouldStop: () => job.stop })
			.then(r => Object.assign(job, r, { waiting: 0 }))
			.catch(e => { job.error = humanError(e); })
			.finally(() => { job.finished = true; job.ended = Date.now(); });
		return job;
	}));
	app.get('/api/pnl/import', handle(req => mgr.importJobs.get(pick(req).login) || null));
	app.post('/api/pnl/import/stop', handle(req => { const j = mgr.importJobs.get(pick(req).login); if (j) j.stop = true; return j || null; }));
	app.post('/api/pnl/clearimport', handle(req => ({ removed: mgr.ledger.clearImport(pick(req).login) })));
	app.post('/api/pnl/add', handle(req => {
		const b = req.body || {};
		const ts = b.date ? Date.parse(b.date) : Date.now();
		const added = mgr.ledger.add([{ login: pick(req).login, kind: b.kind, name: String(b.name || '').trim(), qty: Number(b.qty),
			unit: Number(b.price), cur: String(b.currency || '').toUpperCase(), ts: Number.isFinite(ts) ? ts : Date.now(), src: 'manual' }]);
		if (!added) throw new Error('проверьте название, количество и цену');
		return { added };
	}));
	app.post('/api/pnl/update', handle(req => mgr.ledger.update(String(req.body.id), { unit: req.body.price, qty: req.body.qty, cur: req.body.currency ? String(req.body.currency).toUpperCase() : null })));
	app.post('/api/pnl/delete', handle(req => ({ removed: mgr.ledger.remove((req.body.ids || []).map(String)) })));
	app.post('/api/pnl/csv', handle(req => {
		const login = pick(req).login, text = String(req.body.text || '');
		if (!isSihCsv(text)) {
			const { rows, errors } = parseCsv(text, { login, cur: req.body.currency });
			return { added: mgr.ledger.add(rows), rows: rows.length, errors: errors.slice(0, 20) };
		}
		// SIH: у строк нет id сделки — дубли (повторная загрузка файла, те же сделки из импорта ТП) отсекаем
		// «по количеству»: такая же сделка (тип, предмет, цена, валюта, дата ±1 день) уже есть столько раз — пропускаем
		const { rows, errors } = parseSihCsv(text, { login, cur: req.body.walletCurrency || req.body.currency });
		const day = ts => Math.floor(ts / 86400e3);
		const key = (r, d) => `${r.kind}|${r.name}|${Math.round(r.unit * 100)}|${r.cur}|${d}`;
		const have = new Map();
		for (const r of mgr.ledger.records([login])) for (let q = 0; q < (Number(r.qty) || 1); q++) { const k = key(r, day(r.ts)); have.set(k, (have.get(k) || 0) + 1); }
		const fresh = [];
		for (const r of rows) {
			const d = day(r.ts), k = [key(r, d), key(r, d - 1), key(r, d + 1)].find(x => have.get(x) > 0);
			if (k) have.set(k, have.get(k) - 1); else fresh.push(r);
		}
		return { added: mgr.ledger.add(fresh), rows: rows.length, duplicates: rows.length - fresh.length, format: 'sih', errors: errors.slice(0, 20) };
	}));
	app.post('/api/pnl/export', handle(async req => {
		const pr = await mgr.pricing();
		const list = pnlScope(req);
		const recs = mgr.ledger.records(list.map(s => s.login)).sort((a, b) => a.ts - b.ts);
		fs.mkdirSync(exportDir, { recursive: true });
		const file = path.join(exportDir, `caskit_pnl_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`);
		// тот же порядок колонок, что принимает импорт CSV: файл можно отредактировать и загрузить обратно
		const rows = [['item', 'qty', 'price', 'currency', 'date', 'type', 'account', 'source']];
		for (const r of recs) rows.push([r.name, r.qty, r.unit, r.cur, new Date(r.ts).toISOString().slice(0, 10), r.kind, r.login, r.src]);
		fs.writeFileSync(file, '\ufeff' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n'));
		return { file, folder: exportDir, currency: pr && pr.currency };
	}));
	// Сводка по всем подключённым аккаунтам.
	app.get('/api/overview/all', handle(async () => {
		const out = [];
		for (const s of mgr.sessions.values()) {
			if (s.status !== 'online') { out.push({ login: s.login, offline: true }); continue; }
			try { out.push(await s.overview()); } catch (e) { out.push({ login: s.login, error: e.message }); }
		}
		return out;
	}));
	app.get('/api/casket/:id', handle(async req => withPrices(await pick(req).casketContents(req.params.id))));

	// items: [{name, count}] -> конкретные id предметов
	const pickIds = (groups, items, field) => {
		const ids = [];
		for (const { name, count } of items) {
			const g = groups.find(x => x.name === name);
			if (!g) throw new Error(`нет предмета «${name}»`);
			const pool = g[field] || g.ids;
			if (count > pool.length) throw new Error(`«${name}»: доступно ${pool.length}`);
			ids.push(...pool.slice(0, count));
		}
		return ids;
	};

	app.post('/api/store', handle(async req => {
		const s = pick(req);
		const ids = pickIds((await s.snapshot()).inventory, req.body.items, 'movable');
		return s.storeItems(req.body.casketId, ids, req.body.casketName);
	}));
	app.post('/api/take', handle(async req => {
		const s = pick(req);
		const ids = pickIds(await s.casketContents(req.body.casketId), req.body.items, 'ids');
		return s.takeItems(req.body.casketId, ids, req.body.casketName);
	}));
	app.post('/api/cancel', handle(req => { pick(req).cancelJob(); return { ok: true }; }));

	app.post('/api/name', handle(async req => {
		const name = String(req.body.name || '').trim();
		if (!name || name.length > 20) throw new Error('имя ящика — от 1 до 20 символов');
		await pick(req).nameCasket(req.body.casketId, name);
		mgr.history({ login: req.body.account, action: 'rename', casket: req.body.casketId, name });
		return { ok: true };
	}));

	app.get('/api/settings', handle(() => mgr.settings()));

	// ---------------------------------------------------------------- Steam Guard (мини-SDA) и контроль прокси
	const { Guard } = require('./core/guard');
	const guard = mgr.guard = new Guard(mgr);
	guard.startProxyMonitor();
	app.get('/api/guard/accounts', handle(() => guard.accounts()));
	app.get('/api/guard/codes', handle(() => guard.codes()));
	app.post('/api/guard/mafile', handle(req => {
		const r = guard.attachMaFile(String(req.body.login || ''), req.body.maFile);
		mgr.log(`${req.body.login}: добавлен maFile`);
		return r;
	}));
	app.get('/api/guard/confirmations', handle(req => guard.confirmations(String(req.query.login || ''))));
	app.post('/api/guard/confirmations', handle(async req => {
		const r = await guard.respond(String(req.body.login || ''), req.body.ids, req.body.accept);
		mgr.history({ login: req.body.login, action: req.body.accept ? 'confirm' : 'deny', count: r.count });
		return r;
	}));
	// ---------------- прокси аккаунтов (настройки): список, правка, проверка, массовое распределение
	const PROXY_URL = /^(socks[45]h?|https?):\/\/([^:@\s]+(:[^@\s]*)?@)?[^:@\s/]+:\d{1,5}\/?$/;
	// принимает socks5://… / http://…, а также host:port:user:pass, user:pass@host:port и host:port
	function normProxy(raw, protocol = 'http') {
		const v = String(raw || '').trim();
		if (!v) return '';
		if (PROXY_URL.test(v)) return v.replace(/\/$/, '');
		const proto = /^(socks5|socks4|http|https)$/.test(protocol) ? protocol : 'http';
		const enc = x => encodeURIComponent(decodeURIComponent(x));
		let m = v.match(/^([^:@\s]+):(\d{1,5}):([^:\s]+):(\S+)$/);
		if (m) return `${proto}://${enc(m[3])}:${enc(m[4])}@${m[1]}:${m[2]}`;
		m = v.match(/^([^:@\s]+):([^@\s]+)@([^:@\s]+):(\d{1,5})$/);
		if (m) return `${proto}://${enc(m[1])}:${enc(m[2])}@${m[3]}:${m[4]}`;
		m = v.match(/^([^:@\s]+):(\d{1,5})$/);
		if (m) return `${proto}://${v}`;
		throw new Error(`не понял формат прокси: ${v.slice(0, 60)}`);
	}
	const proxyRow = a => ({ login: a.login, personaName: a.personaName, avatar: a.avatar, proxy: a.proxy || '', online: a.online, saved: a.saved,
		status: a.proxyStatus, active: (mgr.sessions.get(a.login) || {}).proxy || '' });
	app.get('/api/proxies', handle(() => guard.accounts().map(proxyRow)));
	app.post('/api/proxies/set', handle(async req => {
		const login = String(req.body.login || '');
		if (!mgr.store.get(login)) throw new Error('прокси можно задать только сохранённому аккаунту');
		const proxy = normProxy(req.body.proxy, req.body.protocol);
		mgr.store.save(login, { proxy });
		guard.cache.delete(login);   // Steam Guard этого аккаунта — уже через новый прокси
		guard.proxy.delete(login);
		const status = proxy ? await guard.checkProxy(login, proxy).catch(e => ({ ok: false, error: e.message })) : null;
		const s = mgr.sessions.get(login);
		return { proxy, status, needsRelogin: Boolean(s && (s.proxy || '') !== proxy) };
	}));
	app.post('/api/proxies/check', handle(async req => {
		const list = req.body.login ? guard.accounts().filter(a => a.login === req.body.login) : guard.accounts().filter(a => a.proxy);
		for (let i = 0; i < list.length; i += 4) await Promise.all(list.slice(i, i + 4).map(a => guard.checkProxy(a.login, a.proxy).catch(() => {})));
		return guard.accounts().map(proxyRow);
	}));
	// Список прокси (по одному в строке) — по кругу на аккаунты: без прокси или на все сохранённые
	app.post('/api/proxies/bulk', handle(async req => {
		const lines = String(req.body.list || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
		const proxies = lines.map(x => normProxy(x, req.body.protocol));
		if (!proxies.length) throw new Error('список прокси пуст');
		const targets = guard.accounts().filter(a => a.saved && (req.body.target === 'all' || !a.proxy));
		targets.forEach((a, i) => { mgr.store.save(a.login, { proxy: proxies[i % proxies.length] }); guard.cache.delete(a.login); guard.proxy.delete(a.login); });
		return { assigned: targets.length, proxies: proxies.length };
	}));
	app.post('/api/guard/proxycheck', handle(async req => {
		const a = guard.accounts().find(x => x.login === req.body.login);
		if (!a || !a.proxy) throw new Error('у аккаунта нет прокси');
		return guard.checkProxy(a.login, a.proxy);
	}));
	// Способы поддержать разработчика (src/data/support.json, обновляется вместе с картами) + QR для адресов.
	app.get('/api/support', handle(() => require('./core/catalog').loadSupport()));
	app.get('/api/qr', handle(async req => ({ dataUrl: await QRCode.toDataURL(String(req.query.text || '').slice(0, 300), { margin: 1, width: 220 }) })));
	app.get('/api/rules/plan', handle(req => pick(req).planRules(mgr.settings().rules)));
	app.post('/api/rules/apply', handle(async req => {
		const s = pick(req);
		const plan = await s.applyRules(mgr.settings().rules);
		mgr.history({ login: s.login, action: 'rules', items: plan.total, caskets: plan.steps.length });
		return plan;
	}));
	mgr.startGiftWatcher();
	mgr.startPortfolioWatcher();

	// ---------------------------------------------------------------- наклейки на оружии
	const workshop = require('./core/workshop');
	app.get('/api/stickers', handle(async req => workshop.state(pick(req))));
	app.post('/api/stickers/apply', handle(async req => {
		const s = pick(req);
		const r = await workshop.apply(s, req.body.weaponId, req.body.stickerItemId, req.body.slot);
		mgr.history({ login: s.login, action: 'sticker_apply', weapon: req.body.weaponId, slot: r.slot });
		return r;
	}));
	app.post('/api/stickers/scrape', handle(async req => {
		const s = pick(req);
		const r = await workshop.scrape(s, req.body.weaponId, req.body.slot, Boolean(req.body.remove));
		mgr.history({ login: s.login, action: req.body.remove ? 'sticker_remove' : 'sticker_scrape', weapon: req.body.weaponId, slot: req.body.slot });
		return r;
	}));

	// ---------------------------------------------------------------- Armory (награды за звёзды)
	const armory = require('./core/armory');
	app.get('/api/armory', handle(req => armory.state(pick(req))));
	app.post('/api/armory/redeem', handle(async req => {
		const s = pick(req);
		const r = await armory.redeem(s, req.body.redeemId, req.body.count);
		mgr.history({ login: s.login, action: 'armory', name: r.name, items: r.redeemed });
		mgr.log(`${s.login}: Armory — ${r.name} ×${r.redeemed}`);
		return r;
	}));

	// ---------------------------------------------------------------- Steam Community: трейды, маркет, подтверждения
	const community = require('./core/community');
	app.get('/api/trades', handle(req => community.tradeOffers(pick(req), { activeOnly: req.query.all !== '1' })));
	app.post('/api/trades/action', handle(async req => {
		const s = pick(req);
		const r = await community.offerAction(s, req.body.id, req.body.action, req.body.partner);
		mgr.history({ login: s.login, action: `trade_${req.body.action}`, offer: req.body.id });
		return r;
	}));
	app.post('/api/trades/gifts', handle(async req => {
		const got = await community.autoAcceptGifts(pick(req));
		return { accepted: got.length };
	}));
	app.get('/api/market', handle(req => community.myListings(pick(req))));
	// Что можно продать: веб-инвентарь выбранной игры; для CS2 — плюс предметы в ящиках (вынимаются при продаже).
	app.get('/api/market/sellable', handle(async req => {
		const s = pick(req);
		const appid = Number(req.query.appid) || 730;
		const list = await community.sellableItems(s, appid);
		if (appid === 730 && s.status === 'online' && typeof s.storedByName === 'function') {
			const stored = await s.storedByName().catch(() => ({}));
			const byName = new Map(list.map(g => [g.hashName, g]));
			for (const [name, x] of Object.entries(stored)) {
				const g = byName.get(name);
				if (g) g.stored = x.count;
				else if (!/^(Storage Unit|Sealed Graffiti|Graffiti)$/.test(name)) list.push({ hashName: name, name, image: x.image, assetids: [], count: 0, stored: x.count, appid: 730, contextid: '2' });
			}
		}
		return list;
	}));
	// Котировка + средняя цена покупки из «Портфеля» (в валюте кошелька) — для подсказки цены при продаже
	app.get('/api/market/quote', handle(async req => {
		const s = pick(req);
		const name = String(req.query.name || '');
		const q = await community.marketQuote(s, name, Number(req.query.appid) || 730);
		const pr = await mgr.pricing().catch(() => null);
		const toUsd = pr ? pr.toUsd : null;
		const usd = toUsd ? mgr.ledger.avgCost([s.login], name, toUsd) : null;
		const walletRate = pr && q.currency ? (pr.toUsd(1, q.currency) ? 1 / pr.toUsd(1, q.currency) : null) : null;
		q.avgCost = usd != null && walletRate ? Math.round(usd * walletRate * 100) / 100 : null;
		return q;
	}));
	app.post('/api/market/sell', handle(async req => {
		const s = pick(req);
		const items = (req.body.items || []).slice(0, 200).filter(i => i.assetid && Number(i.buyerPays) > 0);
		// из ящиков: { название: { qty, price } } — вынимаем и выставляем вместе с остальными
		const fromCaskets = req.body.fromCaskets || {};
		const want = {};
		for (const [name, x] of Object.entries(fromCaskets)) if (Number(x.qty) > 0 && Number(x.price) > 0) want[name] = Math.min(200, Math.floor(Number(x.qty)));
		if (Object.keys(want).length) {
			const taken = await s.takeForSale({ ...want });
			for (const p of taken) items.push({ assetid: p.id, buyerPays: Number(fromCaskets[p.name].price), appid: 730, contextid: '2', fresh: true });
			if (taken.length) await new Promise(r => setTimeout(r, 2500));  // веб-инвентарь обновляется не сразу
		}
		if (!items.length) throw new Error('нечего выставлять');
		const r = await community.sellItems(s, items, { autoConfirm: mgr.settings().marketAutoConfirm !== false });
		mgr.history({ login: s.login, action: 'market_sell', listed: r.listed, failed: r.failed.length });
		mgr.log(`${s.login}: выставлено на маркет ${r.listed} шт${r.failed.length ? `, ошибок ${r.failed.length}` : ''}`);
		return r;
	}));
	// Поиск предмета по названию (для ордеров): по общему прайсу текущего источника — то, что продаётся на ТП.
	app.get('/api/market/search', handle(async req => {
		const q = String(req.query.q || '').trim().toLowerCase();
		if (q.length < 2) return [];
		const st = mgr.settings();
		const data = await prices.ensure(st.priceSource).catch(() => null);
		if (!data) return [];
		const words = q.split(/\s+/);
		const out = [];
		for (const name of Object.keys(data.prices)) {
			if (name.includes('|') && /\|(Phase|Ruby|Sapphire|Black Pearl|Emerald)/.test(name.split('|').pop())) continue;
			const low = name.toLowerCase();
			if (!words.every(w => low.includes(w))) continue;
			out.push(name);
		}
		const { imageByName } = require('./core/session');
		out.sort((a, b) => (b.toLowerCase().startsWith(q) - a.toLowerCase().startsWith(q)) || a.length - b.length);
		return out.slice(0, 40).map(name => ({ name, image: imageByName(name) }));
	}));
	app.post('/api/market/buyorder', handle(async req => {
		const s = pick(req);
		const r = await community.createBuyOrder(s, { appid: Number(req.body.appid) || 730, name: String(req.body.name || ''), price: req.body.price, quantity: req.body.quantity });
		mgr.history({ login: s.login, action: 'buy_order', name: req.body.name, price: req.body.price, quantity: req.body.quantity, ok: r.ok });
		return r;
	}));
	app.post('/api/market/remove', handle(req => community.removeListing(pick(req), req.body.id)));
	app.post('/api/market/cancelorder', handle(req => community.cancelBuyOrder(pick(req), req.body.id)));
	app.get('/api/market/history', handle(req => community.marketHistory(pick(req), Math.max(0, Number(req.query.start) || 0), Math.min(500, Number(req.query.count) || 100))));
	app.get('/api/confirmations', handle(req => community.confirmations(pick(req))));
	app.post('/api/confirmations', handle(async req => {
		const s = pick(req);
		const all = await community.confirmations(s);
		const ids = new Set((req.body.ids || []).map(String));
		return community.respondConfirmations(s, all.filter(c => ids.has(String(c.id))), Boolean(req.body.accept));
	}));
	app.post('/api/settings', handle(req => mgr.saveSettings(req.body || {})));

	// ---------------------------------------------------------------- магазин CS2
	app.get('/api/store/catalog', handle(req => { const s = pick(req); s.ensureOnline(); return require('./core/store').catalog(s); }));
	app.post('/api/store/init', handle(async req => {
		const s = pick(req);
		const info = await s.initPurchase(req.body.def, req.body.count);
		mgr.log(`${s.login}: заказ ${info.name} ×${info.count} на ${info.total} ${info.currency} — ждём подтверждения`);
		return info;
	}));
	app.post('/api/store/confirm', handle(async req => {
		const s = pick(req);
		const result = await s.confirmPurchase(req.body.txnId);
		mgr.history({ login: s.login, action: 'buy', txnId: result.txnId, items: result.itemIds.length });
		mgr.log(`${s.login}: куплено ${result.itemIds.length} шт`);
		return result;
	}));
	app.post('/api/store/finalize', handle(async req => {
		const s = pick(req);
		const result = await s.finalizePurchase(req.body.txnId);
		mgr.history({ login: s.login, action: 'buy', txnId: result.txnId, items: result.itemIds.length });
		mgr.log(`${s.login}: куплено ${result.itemIds.length} шт`);
		return result;
	}));
	app.post('/api/store/cancel', handle(req => { pick(req).cancelPurchase(); return { ok: true }; }));

	// ---------------------------------------------------------------- трейд-ап (контракт обмена)
	app.get('/api/tradeup/groups', handle(async req => pick(req).tradeUpGroups(req.query.caskets === '1', await mgr.pricing(false).catch(() => null))));
	app.post('/api/tradeup/preview', handle(async req => pick(req).tradeUpPreview(req.body.itemIds || [], await mgr.pricing().catch(() => null))));
	// Ссылка «Осмотреть» (wait=1 — подождать появления нового предмета в веб-инвентаре, например после контракта)
	app.get('/api/inspect', handle(async req => ({ link: await require('./core/workshop').inspectLink(pick(req), String(req.query.id || ''), req.query.wait === '1') })));
	app.post('/api/tradeup/craft', handle(async req => {
		const s = pick(req);
		const result = await s.craftTradeUp(req.body.itemIds || [], await mgr.pricing().catch(() => null));
		mgr.history({ login: s.login, action: 'tradeup', result: result.name || '(неизвестно)' });
		mgr.log(`${s.login}: контракт обмена → ${result.name || 'готово'}`);
		return result;
	}));

	// Full snapshot (inventory + every casket) -> JSON and CSV in the export folder.
	app.post('/api/export', handle(async req => {
		const session = pick(req);
		const snap = await session.snapshot();
		const pr = await mgr.pricing().catch(() => null);
		const price = name => { const v = pr && pr.value(name); return v == null ? null : Math.round(v * 100) / 100; };
		const withPrice = ({ name, count, ...rest }) => (pr ? { name, count, ...rest, price: price(name) } : { name, count, ...rest });
		const out = { login: snap.login, steamId: snap.steamId, savedAt: new Date().toISOString(),
			...(pr ? { prices: { currency: pr.currency, source: pr.source, updated: new Date(pr.ts).toISOString(), afterFee: pr.afterFee } } : {}),
			inventory: snap.inventory.map(({ name, count, protected: p }) => withPrice({ name, count, tradeProtected: p })), caskets: [] };
		for (const c of snap.caskets) {
			const items = c.count ? (await session.casketContents(c.id)).map(({ name, count }) => withPrice({ name, count })) : [];
			out.caskets.push({ id: c.id, name: c.name, count: c.count, items });
		}
		fs.mkdirSync(exportDir, { recursive: true });
		const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
		const base = path.join(exportDir, `${snap.login}_${stamp}`);
		fs.writeFileSync(`${base}.json`, JSON.stringify(out, null, 1));
		const rows = [['location', 'casket_id', 'item', 'count', ...(pr ? [`price_${pr.currency}`, `total_${pr.currency}`] : [])]];
		const money = (v, n = 1) => (v == null ? '' : (v * n).toFixed(2));
		const row = (loc, id, i) => rows.push([loc, id, i.name, i.count, ...(pr ? [money(i.price), money(i.price, i.count)] : [])]);
		for (const i of out.inventory) row('inventory', '', i);
		for (const c of out.caskets) for (const i of c.items) row(c.name || '(unnamed)', c.id, i);
		fs.writeFileSync(`${base}.csv`, '\ufeff' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n'));
		return { json: `${base}.json`, csv: `${base}.csv`, folder: exportDir };
	}));

	return new Promise(resolve => {
		const server = app.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, token, manager: mgr }));
	});
}

module.exports = { start };
