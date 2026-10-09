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
const SteamUser = require('steam-user');
const { CasketSession, AccountStore, humanError } = require('./core/session');

class Manager {
	constructor({ dataDir, crypto: cryptoBox }) {
		this.dataDir = dataDir;
		this.crypto = cryptoBox;
		this.store = new AccountStore(dataDir, cryptoBox);  // один общий список сохранённых аккаунтов
		this.sessions = new Map();   // логин -> подключённая CasketSession
		this.pending = null;         // сессия, которая сейчас входит (логин ещё мог быть неизвестен — QR)
		this.historyFile = path.join(dataDir, 'history.jsonl');
		this.settingsFile = path.join(dataDir, 'settings.json');
		this.logLines = [];
	}

	log(line) {
		this.logLines.push({ t: Date.now(), line });
		if (this.logLines.length > 300) this.logLines.shift();
	}

	// Настройки всего приложения (не аккаунта): быстрая покупка, избранное магазина.
	// Хранятся на диске, а не в localStorage — порт сервера (и origin страницы) меняется при каждом запуске.
	settings() {
		const def = { favorites: [], autoAcceptGifts: false, rules: [], autoApplyRules: false, supportNudgeAt: 0, supportHideNudges: false, stickerConfirm: true, welcomed: false, tourDone: false, navCollapsed: false, turbo: false, transferModal: true };
		try { return { ...def, ...JSON.parse(fs.readFileSync(this.settingsFile, 'utf8')) }; } catch (e) { return def; }
	}

	saveSettings(patch) {
		const cur = this.settings();
		if ('autoAcceptGifts' in patch) cur.autoAcceptGifts = Boolean(patch.autoAcceptGifts);
		if ('autoApplyRules' in patch) cur.autoApplyRules = Boolean(patch.autoApplyRules);
		if (typeof patch.lang === 'string' && /^[a-z]{2}$/.test(patch.lang)) cur.lang = patch.lang;
		if ('supportNudgeAt' in patch) cur.supportNudgeAt = Number(patch.supportNudgeAt) || 0;
		if ('supportHideNudges' in patch) cur.supportHideNudges = Boolean(patch.supportHideNudges);
		for (const k of ['stickerConfirm', 'welcomed', 'tourDone', 'navCollapsed', 'turbo', 'transferModal']) if (k in patch) cur[k] = Boolean(patch[k]);
		if (Array.isArray(patch.rules)) {
			const kinds = ['any', 'container', 'sticker', 'skin', 'knifeglove', 'graffiti', 'other'];
			cur.rules = patch.rules.slice(0, 50).map(r => ({
				kind: kinds.includes(r.kind) ? r.kind : 'any',
				text: String(r.text || '').slice(0, 100), casket: String(r.casket || '').slice(0, 40),
			})).filter(r => r.casket.trim());
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
	app.use(express.json({ limit: '1mb' }));
	app.use((req, res, next) => {
		if (!req.path.startsWith('/api/')) return next();
		if (req.get('x-token') === token) return next();
		res.status(401).json({ error: 'нет доступа' });
	});
	app.use(express.static(path.join(__dirname, 'ui')));
	app.use('/av', express.static(path.join(dataDir, 'avatars'), { maxAge: 0 }));

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
			guardDomain: p.guardDomain, guardWrong: p.guardWrong,
			qr: p.status === 'qr' && p.qrUrl ? await QRCode.toDataURL(p.qrUrl, { margin: 1, width: 280 }) : null,
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
			.catch(e => mgr.log(`ошибка входа${session.login ? ' ' + session.login : ''}: ${humanError(e)}`));
		return { ok: true };
	}));
	app.post('/api/guard', handle(req => { if (!mgr.pending) throw new Error('код сейчас не запрашивается'); mgr.pending.submitGuardCode(req.body.code || ''); return { ok: true }; }));

	app.post('/api/logout', handle(req => {
		const login = req.body && req.body.account;
		if (login && mgr.sessions.has(login)) { mgr.sessions.get(login).logout(); mgr.sessions.delete(login); }
		else if (mgr.pending) { mgr.pending.logout(); mgr.pending = null; }
		return { ok: true };
	}));

	app.get('/api/state', handle(req => pick(req).snapshot()));
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
	// Сводка по всем подключённым аккаунтам.
	app.get('/api/overview/all', handle(async () => {
		const out = [];
		for (const s of mgr.sessions.values()) {
			if (s.status !== 'online') { out.push({ login: s.login, offline: true }); continue; }
			try { out.push(await s.overview()); } catch (e) { out.push({ login: s.login, error: e.message }); }
		}
		return out;
	}));
	app.get('/api/casket/:id', handle(req => pick(req).casketContents(req.params.id)));

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
		pick(req).turbo = Boolean(mgr.settings().turbo);
		const s = pick(req);
		const ids = pickIds((await s.snapshot()).inventory, req.body.items, 'movable');
		return s.storeItems(req.body.casketId, ids, req.body.casketName);
	}));
	app.post('/api/take', handle(async req => {
		pick(req).turbo = Boolean(mgr.settings().turbo);
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
		s.turbo = Boolean(mgr.settings().turbo);
		const plan = await s.applyRules(mgr.settings().rules);
		mgr.history({ login: s.login, action: 'rules', items: plan.total, caskets: plan.steps.length });
		return plan;
	}));
	mgr.startGiftWatcher();

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
	app.get('/api/market/sellable', handle(req => community.sellableItems(pick(req))));
	app.get('/api/market/price', handle(req => community.priceOverview(pick(req), String(req.query.name || ''))));
	app.post('/api/market/sell', handle(async req => {
		const s = pick(req);
		const items = (req.body.items || []).slice(0, 200).filter(i => i.assetid && Number(i.buyerPays) > 0);
		if (!items.length) throw new Error('нечего выставлять');
		const r = await community.sellItems(s, items);
		mgr.history({ login: s.login, action: 'market_sell', listed: r.listed, failed: r.failed.length });
		mgr.log(`${s.login}: выставлено на маркет ${r.listed} шт${r.failed.length ? `, ошибок ${r.failed.length}` : ''}`);
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
	app.get('/api/tradeup/groups', handle(req => pick(req).tradeUpGroups(req.query.caskets === '1')));
	app.post('/api/tradeup/craft', handle(async req => {
		const s = pick(req);
		const result = await s.craftTradeUp(req.body.itemIds || []);
		mgr.history({ login: s.login, action: 'tradeup', result: result.name || '(неизвестно)' });
		mgr.log(`${s.login}: контракт обмена → ${result.name || 'готово'}`);
		return result;
	}));

	// Full snapshot (inventory + every casket) -> JSON and CSV in the export folder.
	app.post('/api/export', handle(async req => {
		const session = pick(req);
		const snap = await session.snapshot();
		const out = { login: snap.login, steamId: snap.steamId, savedAt: new Date().toISOString(),
			inventory: snap.inventory.map(({ name, count, protected: p }) => ({ name, count, tradeProtected: p })), caskets: [] };
		for (const c of snap.caskets) {
			const items = c.count ? (await session.casketContents(c.id)).map(({ name, count }) => ({ name, count })) : [];
			out.caskets.push({ id: c.id, name: c.name, count: c.count, items });
		}
		fs.mkdirSync(exportDir, { recursive: true });
		const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
		const base = path.join(exportDir, `${snap.login}_${stamp}`);
		fs.writeFileSync(`${base}.json`, JSON.stringify(out, null, 1));
		const rows = [['location', 'casket_id', 'item', 'count']];
		for (const i of out.inventory) rows.push(['inventory', '', i.name, i.count]);
		for (const c of out.caskets) for (const i of c.items) rows.push([c.name || '(unnamed)', c.id, i.name, i.count]);
		fs.writeFileSync(`${base}.csv`, '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n'));
		return { json: `${base}.json`, csv: `${base}.csv`, folder: exportDir };
	}));

	return new Promise(resolve => {
		const server = app.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, token, manager: mgr }));
	});
}

module.exports = { start };
