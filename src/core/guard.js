// Мини-SDA (Steam Desktop Authenticator): коды Steam Guard и ручное подтверждение трейдов/лотов
// для всех сохранённых аккаунтов, плюс контроль прокси.
//   • код Guard считается локально из shared_secret (сеть не нужна);
//   • подтверждения требуют веб-сессию: берём её у подключённого аккаунта, а если он не подключён —
//     получаем веб-cookies по сохранённому refresh token (без входа в CS2 и без запуска игры),
//     весь трафик — через прокси этого аккаунта;
//   • прокси проверяются в фоне; если прокси перестал работать — уведомление.
'use strict';

const SteamTotp = require('steam-totp');
const SteamID = require('steamid');
const community = require('./community');

const COOKIE_TTL = 20 * 60000;
const PROXY_EVERY = 3 * 60000;

class GuardSession {
	constructor({ login, proxy, secret }) {
		this.login = login;
		this.proxy = proxy || null;
		this.identitySecret = secret.identity_secret || null;
		this.deviceId = secret.device_id || null;
		this.refreshToken = secret.refreshToken || null;
		this.webCookies = null;
		this.user = null;
		this.ts = 0;
	}

	ensureOnline() {}
	emit() {}

	async open() {
		if (this.webCookies && Date.now() - this.ts < COOKIE_TTL) return this;
		if (!this.refreshToken) throw new Error('нет сохранённого входа — войдите в этот аккаунт в приложении хотя бы раз');
		const { LoginSession, EAuthTokenPlatformType } = require('steam-session');
		const opts = !this.proxy ? {} : { [this.proxy.startsWith('http') ? 'httpProxy' : 'socksProxy']: this.proxy };
		// Токен клиента Steam (aud client/web) отдаёт веб-cookies через поток WebBrowser (finalizelogin).
		// Steam присылает cookies для каждого своего домена — берём только steamcommunity.com.
		const ls = new LoginSession(EAuthTokenPlatformType.WebBrowser, opts);
		ls.refreshToken = this.refreshToken;
		const all = await ls.getWebCookies();
		const byName = new Map();
		for (const c of all) {
			const domain = (c.match(/;\s*Domain=([^;]+)/i) || [])[1];
			if (domain && !/steamcommunity\.com/i.test(domain)) continue;
			byName.set(c.split('=')[0].trim(), c.split(';')[0]);
		}
		this.webCookies = [...byName.values()];
		this.user = { steamID: new SteamID(ls.steamID.getSteamID64()) };
		this.ts = Date.now();
		return this;
	}
}
// Те же HTTP-помощники, что у основной сессии (прокси, cookies, sessionid).
const { CasketSession } = require('./session');
for (const m of ['agent', 'webRequest', 'webRequestRaw', 'sessionId']) GuardSession.prototype[m] = CasketSession.prototype[m];

class Guard {
	constructor(mgr) {
		this.mgr = mgr;              // Manager из server.js: sessions, store (AccountStore), log
		this.cache = new Map();      // login -> GuardSession
		this.proxy = new Map();      // login -> { ok, error, checked }
		this.alerts = [];            // события для интерфейса: { id, login, kind, text }
		this.alertId = 0;
	}

	_saved(login) { return this.mgr.store.get(login); }

	accounts() {
		const out = new Map();
		for (const a of this.mgr.store.list()) {
			const full = this._saved(a.login) || { secret: {} };
			out.set(a.login, { login: a.login, personaName: a.personaName || null, avatar: a.avatar || null, proxy: a.proxy || '',
				hasMaFile: Boolean(full.secret && full.secret.shared_secret), canConfirm: Boolean(full.secret && full.secret.identity_secret),
				saved: true, hasToken: Boolean(full.secret && full.secret.refreshToken), online: false });
		}
		for (const s of this.mgr.sessions.values()) {
			if (!s.login) continue;
			const cur = out.get(s.login) || { login: s.login, saved: false, hasMaFile: false, canConfirm: false, proxy: s.proxy || '' };
			Object.assign(cur, { online: s.status === 'online', proxy: s.proxy || cur.proxy,
				personaName: (s.profile && s.profile.name) || cur.personaName || null, avatar: (s.profile && s.profile.avatar) || cur.avatar || null,
				canConfirm: cur.canConfirm || Boolean(s.identitySecret), hasMaFile: cur.hasMaFile || Boolean(s.identitySecret),
				wallet: s.user && s.user.wallet && s.user.wallet.hasWallet ? { balance: s.user.wallet.balance, currency: require('steam-user').ECurrencyCode[s.user.wallet.currency] } : null });
			out.set(s.login, cur);
		}
		return [...out.values()].map(a => ({ ...a, proxyStatus: a.proxy ? (this.proxy.get(a.login) || null) : null }))
			.sort((a, b) => (b.online - a.online) || (b.hasMaFile - a.hasMaFile) || a.login.localeCompare(b.login));
	}

	// Коды Guard всех аккаунтов с maFile. secret-ы наружу не отдаём — только сами коды.
	codes() {
		const time = SteamTotp.time();
		const left = 30 - (time % 30);
		const out = {};
		for (const a of this.mgr.store.list()) {
			const full = this._saved(a.login);
			if (full && full.secret && full.secret.shared_secret) out[a.login] = SteamTotp.generateAuthCode(full.secret.shared_secret);
		}
		return { codes: out, left, period: 30 };
	}

	// Привязать maFile к аккаунту (сохраняется зашифрованно вместе с остальными данными входа).
	attachMaFile(login, ma) {
		if (!ma || !ma.shared_secret) throw new Error('в maFile нет shared_secret');
		if (ma.account_name && String(ma.account_name).toLowerCase() !== String(login).toLowerCase()) {
			throw new Error(`этот maFile от аккаунта ${ma.account_name}, а не ${login}`);
		}
		this.mgr.store.save(login, { hasMaFile: true, secret: { shared_secret: ma.shared_secret, identity_secret: ma.identity_secret, device_id: ma.device_id } });
		const s = this.mgr.sessions.get(login);
		if (s) { s.identitySecret = ma.identity_secret || null; s.deviceId = ma.device_id || null; }
		this.cache.delete(login);
		return { ok: true };
	}

	async _session(login) {
		const s = this.mgr.sessions.get(login);
		if (s && s.status === 'online' && s.webCookies && s.identitySecret) return s;
		const saved = this._saved(login);
		if (!saved) throw new Error('аккаунт не найден');
		if (!saved.secret.identity_secret) throw new Error('для подтверждений нужен maFile этого аккаунта');
		let g = this.cache.get(login);
		if (!g) { g = new GuardSession({ login, proxy: saved.proxy, secret: saved.secret }); this.cache.set(login, g); }
		return g.open();
	}

	async confirmations(login) {
		const s = await this._session(login);
		return community.confirmations(s);
	}

	async respond(login, ids, accept) {
		const s = await this._session(login);
		const all = await community.confirmations(s);
		const want = new Set((ids || []).map(String));
		return community.respondConfirmations(s, all.filter(c => want.has(String(c.id))), Boolean(accept));
	}

	// ---------------------------------------------------------------- контроль прокси
	async checkProxy(login, proxy) {
		const probe = Object.create(CasketSession.prototype);
		probe.proxy = proxy;
		let ok = true, error = null;
		try { await CasketSession.prototype._verifyProxy.call(probe); } catch (e) { ok = false; error = e.message; }
		const prev = this.proxy.get(login);
		this.proxy.set(login, { ok, error, checked: Date.now() });
		if (prev && prev.ok !== ok) {
			const text = ok ? `прокси аккаунта ${login} снова работает` : `прокси аккаунта ${login} перестал работать: ${error}`;
			this.mgr.log(text);
			this.alerts.push({ id: ++this.alertId, login, kind: ok ? 'proxy_ok' : 'proxy_bad', error });
			if (this.alerts.length > 50) this.alerts.shift();
		}
		return this.proxy.get(login);
	}

	startProxyMonitor() {
		const tick = async () => {
			const targets = this.accounts().filter(a => a.proxy && (a.online || a.hasMaFile));
			for (let i = 0; i < targets.length; i += 4) {
				await Promise.all(targets.slice(i, i + 4).map(a => this.checkProxy(a.login, a.proxy).catch(() => {})));
			}
		};
		setTimeout(() => tick().catch(() => {}), 15000).unref();
		setInterval(() => tick().catch(() => {}), PROXY_EVERY).unref();
	}
}

module.exports = { Guard };
