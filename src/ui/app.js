'use strict';

const TOKEN = location.hash.slice(1);
const CFG = window.APP_CONFIG || {};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = n => Number(n).toLocaleString(LANG === 'zh' ? 'zh-CN' : LANG);

// ============================================================ локализация
let LANG = (() => {
	try { const s = localStorage.getItem('lang'); if (s && window.I18N.dict[s]) return s; } catch (e) { /* ignore */ }
	const n = (navigator.language || 'en').slice(0, 2).toLowerCase();
	return window.I18N.dict[n] ? n : 'en';
})();

function t(key, vars) {
	const d = window.I18N.dict;
	let s = (d[LANG] && d[LANG][key]) != null ? d[LANG][key] : (d.en[key] != null ? d.en[key] : key);
	if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
	return s;
}

function applyStaticI18n() {
	document.documentElement.lang = LANG;
	document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
	document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
	document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
	document.querySelectorAll('[data-i18n-tip]').forEach(el => { el.dataset.tip = t(el.dataset.i18nTip); el.setAttribute('aria-label', el.dataset.tip); });
}

// Смена языка: сохраняем в настройках приложения (localStorage привязан к случайному порту и теряется
// между запусками) и перезагружаем интерфейс — так переводится всё, включая уже открытые списки.
function setLang(l, reload = true) {
	LANG = l;
	try { localStorage.setItem('lang', l); } catch (e) { /* ignore */ }
	[$('langSelect'), $('langSelect2'), $('langSelect3')].forEach(sel => { if (sel) sel.value = l; });
	applyStaticI18n();
	if (!reload) { rerenderAll(); return; }
	try { sessionStorage.setItem('ui_restore', JSON.stringify({ tab: ui.tab, active: ui.active, welcome: !$('welcomeModal').classList.contains('hidden') })); } catch (e) { /* ignore */ }
	api('/api/settings', { lang: l }).catch(() => {}).then(() => location.reload());
}

function fillLangSelects() {
	const opts = window.I18N.langs.map(l => `<option value="${l.code}">${esc(l.name)}</option>`).join('');
	[$('langSelect'), $('langSelect2'), $('langSelect3')].forEach(sel => { if (sel) { sel.innerHTML = opts; sel.value = LANG; sel.addEventListener('change', e => setLang(e.target.value)); } });
}

function rerenderAll() {
	if (ui.state) { renderTop(); renderCaskets(); if (ui.casketId) renderPanel(); }
	if (ui.status) renderAccountBar(ui.status.accounts || [], ui.status.pending);
	if (ui.store) renderStore();
	if (ui.overview) renderOverview();
	if (ui.tu && ui.tu.groups) { renderTuGroups(); if (currentTuGroup()) renderTuItems(); }
	const active = activeAccount();
	if (active) renderJob(active.job);
	updateAction();
}

// ============================================================ состояние
const ui = {
	mode: 'qr', maFile: null,
	qr: { state: 'idle', img: null, since: 0 },  // QR на экране входа: idle | loading | shown | expired
	status: null, active: null, state: null,
	casketId: null, op: 'store', contents: {}, picks: {},
	search: '', onlyCases: false, showFull: false, loadingItems: false,
	tab: 'caskets', store: null, overview: null,
	tu: { groups: null, rarity: null, stattrak: null, picks: {} },
	lastJobKey: {}, jobDismissed: null,
	addingAccount: false, cart: {}, co: null,
	settings: { favorites: [], autoAcceptGifts: false, stickerConfirm: true },
	trades: null, tradeSel: null, tradeDir: 'in', armory: null, armQty: {}, stk: null, stkSel: null, stkBusy: false,
	market: null, mtab: 'listings', history: null,
	_wasPending: false, _loadedActive: null, _freshActive: false,
};

async function api(url, body) {
	const r = await fetch(url, {
		method: body ? 'POST' : 'GET',
		headers: { 'Content-Type': 'application/json', 'x-token': TOKEN },
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(data.error || r.statusText);
	return data;
}
const withAcc = p => p + (p.includes('?') ? '&' : '?') + 'account=' + encodeURIComponent(ui.active || '');
const apiGet = p => api(withAcc(p));
const apiPost = (p, b) => api(p, { account: ui.active, ...(b || {}) });

function toast(text, kind = '', action) {
	const el = document.createElement('div');
	el.className = `toast ${kind}`;
	el.innerHTML = esc(text);
	if (action) {
		const b = document.createElement('button');
		b.className = 'btn ghost small'; b.style.marginLeft = '10px';
		b.textContent = action.label; b.onclick = () => { action.run(); el.remove(); };
		el.appendChild(b);
	}
	$('toasts').appendChild(el);
	setTimeout(() => el.remove(), action ? 12000 : 5000);
}

function showView(id) {
	for (const v of ['loginView', 'connectingView', 'mainView']) $(v).classList.toggle('hidden', v !== id);
}

function activeAccount() {
	return ui.status && (ui.status.accounts || []).find(a => a.login === ui.active) || null;
}

// ============================================================ вход
function setMode(mode) {
	const was = ui.mode;
	ui.mode = mode;
	document.querySelectorAll('.login-card .segmented button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
	document.querySelectorAll('.login-card [data-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== mode));
	$('loginBtn').classList.toggle('hidden', mode === 'qr');
	$('loginError').classList.add('hidden');
	if (was === 'qr' && mode !== 'qr') cancelQr();
	if (mode === 'qr' && was !== 'qr') { ui.qr.state = 'idle'; ensureQr(); }
}

// ---- QR — основной способ входа: код появляется сразу, сам обновляется от Steam;
// истёк — новый по кнопке. Если вписали прокси — код перевыпускается уже через прокси.
const qrPending = p => p && p.mode === 'qr' && !p.login && ['connecting', 'qr'].includes(p.status);
function ensureQr() {
	if (ui.mode !== 'qr' || ui.qr.state !== 'idle' || $('loginView').classList.contains('hidden')) return;
	startQr();
}
function startQr() {
	ui.qr = { state: 'loading', img: null, since: Date.now(), proxy: $('proxy').value.trim() };
	renderQrBox(null);
	api('/api/login', { mode: 'qr', proxy: $('proxy').value.trim() || null, remember: $('remember').checked })
		.then(() => { ui._wasPending = true; poll(true); })
		.catch(e => { ui.qr.state = 'expired'; ui.qr.error = e.message; renderQrBox(null); });
}
function cancelQr() {
	const p = ui.status && ui.status.pending;
	if (ui.qr.state === 'loading' || ui.qr.state === 'shown' || qrPending(p)) { ui.qrCancelledAt = Date.now(); api('/api/login/qr/cancel', {}).catch(() => {}); }
	ui.qr = { state: 'idle', img: null, since: 0 };
}
function renderQrBox(pending) {
	const q = ui.qr;
	if (q.state === 'shown' && pending && pending.qr && q.img !== pending.qr) { q.img = pending.qr; $('qrImg').src = pending.qr; }
	$('qrImg').classList.toggle('hidden', q.state !== 'shown' || !q.img);
	$('qrPlaceholder').classList.toggle('hidden', q.state === 'shown' && Boolean(q.img));
	$('qrPlaceholder').classList.toggle('loading', q.state === 'loading' || q.state === 'idle');
	$('qrExpired').classList.toggle('hidden', q.state !== 'expired');
	const st = $('qrStatus');
	st.classList.remove('ok');
	if (q.state === 'expired') {
		$('qrExpiredText').textContent = q.error && !/QR/.test(q.error) ? t('qr_failed') : t('qr_expired');
		st.textContent = q.error && !/QR/.test(q.error) ? q.error : '';
	} else if (q.state === 'shown' && pending && pending.qrScanned) { st.textContent = t('qr_scanned'); st.classList.add('ok'); }
	else if (q.state === 'shown' && pending && pending.qrLeft != null) {
		const left = pending.qrLeft;
		st.textContent = t('qr_left', { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` });
	} else st.textContent = t('qr_loading');
}

async function renderSaved() {
	const list = ui.saved = await api('/api/accounts').catch(() => []);
	const connected = new Set((ui.status && ui.status.accounts || []).map(a => a.login));
	const rest = list.filter(a => !connected.has(a.login));
	$('savedBlock').classList.toggle('hidden', !rest.length);
	$('savedList').innerHTML = rest.map(a => `
		<div class="saved-item">
			${avatarHtml(a)}
			<div class="grow"><div class="strong">${esc(accName(a))}</div>${accSub(a) ? `<div class="muted small">${esc(accSub(a))}</div>` : ''}
				<div class="muted small">${a.hasMaFile ? 'maFile · ' : ''}${a.proxy ? t('proxy_label').toLowerCase() : ''}</div></div>
			<button class="btn primary small" data-login="${esc(a.login)}">${esc(t('btn_login'))}</button>
			<button class="forget" data-forget="${esc(a.login)}">×</button>
		</div>`).join('');
}

async function login(body) {
	$('loginError').classList.add('hidden');
	if (body.mode !== 'qr') ui.qr.state = 'idle';  // сервер заменит висящий QR этим входом
	if (body.mode !== 'qr') { showView('connectingView'); $('connectingTitle').textContent = body.login ? t('connecting_to', { login: loginName(body.login) }) : t('connecting'); }
	try { await api('/api/login', body); ui._wasPending = true; poll(true); }
	catch (e) { showView('loginView'); showLoginError(e.message); toast(e.message, 'bad'); }
}

function showLoginError(text) { $('loginError').textContent = text; $('loginError').classList.remove('hidden'); }

function loginFromForm() {
	const proxy = $('proxy').value.trim() || null;
	const remember = $('remember').checked;
	if (ui.mode === 'qr') return login({ mode: 'qr', proxy, remember });
	if (ui.mode === 'creds') {
		const l = $('crLogin').value.trim(), p = $('crPassword').value;
		if (!l || !p) return showLoginError(t('err_enter_login'));
		return login({ mode: 'creds', login: l, password: p, proxy, remember });
	}
	if (!ui.maFile) return showLoginError(t('err_choose_mafile'));
	const p = $('maPassword').value;
	if (!p) return showLoginError(t('err_enter_password'));
	login({ mode: 'mafile', maFile: ui.maFile, login: $('maLogin').value.trim() || undefined, password: p, proxy, remember });
}

function readMaFile(file) {
	const reader = new FileReader();
	reader.onload = () => {
		try {
			const ma = JSON.parse(reader.result);
			if (!ma.shared_secret) throw new Error();
			ui.maFile = ma;
			$('maLogin').value = ma.account_name || '';
			$('dropzone').classList.add('loaded');
			$('dropText').textContent = `maFile: ${streamer() ? '•••' : (ma.account_name || file.name)}`;
		} catch (e) {
			ui.maFile = null;
			$('dropzone').classList.remove('loaded');
			$('dropText').textContent = t('err_not_mafile');
		}
	};
	reader.readAsText(file);
}

// ============================================================ управление аккаунтами / видами
function renderAccounts(s) {
	const accounts = s.accounts || [];
	const pending = s.pending;
	if (!accounts.some(a => a.login === ui.active)) ui.active = accounts.length ? accounts[accounts.length - 1].login : null;
	// pending завершился входом -> показываем новый аккаунт. Но если это мы сами отменили QR (переключились
	// на «Логин» или maFile при добавлении аккаунта), вход не закончился — остаёмся в форме входа.
	if (ui._wasPending && !pending) {
		const fresh = accounts.find(a => !ui._knownLogins.has(a.login));
		const cancelledQr = ui._lastPending === 'qr' && Date.now() - (ui.qrCancelledAt || 0) < 8000;
		if (fresh || !cancelledQr) {
			ui.addingAccount = false;
			if (accounts.length) { ui.active = (fresh || accounts[accounts.length - 1]).login; ui._freshActive = true; }
		}
	}
	ui._wasPending = Boolean(pending && ['connecting', 'guard', 'qr'].includes(pending.status));
	if (pending) ui._lastPending = pending.status;
	ui._knownLogins = new Set(accounts.map(a => a.login));

	if (ui.addingAccount || accounts.length === 0) { renderLoginFlow(pending, accounts.length > 0); return; }

	showView('mainView');
	if (ui.restoreTab) { const tab = ui.restoreTab; ui.restoreTab = null; setTimeout(() => switchTab(tab), 0); }
	maybeTour();
	$('guardModal').classList.add('hidden');
	renderAccountBar(accounts, pending);
	const active = activeAccount();
	if (!active) return;
	if (ui._freshActive || ui._loadedActive !== ui.active) {
		ui._loadedActive = ui.active; ui._freshActive = false;
		ui.contents = {}; ui.picks = {}; ui.store = null; ui.cart = {}; ui.state = null;
		selectCasket(null);  // ящик прошлого аккаунта больше не наш — закрываем панель
		ui.tu = { groups: null, rarity: null, stattrak: null, picks: {} };
		ui.overview = null; ui.trades = null; ui.market = null; ui.sell = null; ui.history = null; ui.armory = null;
		if (ui.tab === 'trades') loadTrades();
		if (ui.tab === 'armory') loadArmory();
		if (ui.tab === 'stickers') loadStickers();
		if (ui.tab === 'market') loadMarket();
		if (ui.tab === 'store') loadStore();
		if (ui.tab === 'tradeup') loadTradeup();
		if (ui.tab === 'overview') loadOverview();
		ui.pnl = null;
		if (ui.tab === 'pnl') loadPnl();
		loadState().catch(e => toast(e.message, 'bad'));
	}
	handleActiveJob(active);
}

function renderLoginFlow(pending, hasAccounts) {
	$('loginBack').classList.toggle('hidden', !hasAccounts);
	const st = pending && pending.status;
	if (st === 'connecting' && !qrPending(pending)) {
		showView('connectingView');
		$('connectingTitle').textContent = pending.login ? t('connecting_to', { login: loginName(pending.login) }) : t('connecting');
		$('guardModal').classList.add('hidden');
	} else if (st === 'guard') {
		showView('connectingView');
		$('connectingTitle').textContent = pending.login ? t('connecting_to', { login: loginName(pending.login) }) : t('connecting');
		showGuard(pending);
	} else {
		const wasLogin = !$('loginView').classList.contains('hidden');
		showView('loginView'); $('guardModal').classList.add('hidden');
		if (!wasLogin) renderSaved();
		if (pending && pending.mode === 'qr' && !pending.login) {
			// это наш QR: показываем код, а его ошибку (истёк, прокси не работает) — прямо на месте кода
			if (pending.status === 'qr') ui.qr.state = 'shown';
			// (ответ опроса, ушедшего до запроса нового кода, может принести ошибку прошлого — её пропускаем)
			else if (pending.status === 'error' && (ui.qr.state === 'shown' || (ui.qr.state === 'loading' && Date.now() - ui.qr.since > 2000))) { ui.qr.state = 'expired'; ui.qr.error = pending.error; }
		} else {
			if (pending && pending.error) showLoginError(pending.error);
			if (pending && pending.needsRelogin && pending.login) prefillRelogin(pending.login);
			// QR пропал без ошибки (например, вход другим способом отменил его) — выпускаем новый
			if (['shown', 'loading'].includes(ui.qr.state) && !pending && Date.now() - ui.qr.since > 4000) ui.qr.state = 'idle';
		}
		if (ui.mode === 'qr') { renderQrBox(pending); ensureQr(); }
	}
}
function showGuard(pending) {
	$('guardModal').classList.remove('hidden');
	$('guardText').textContent = pending.guardDomain ? t('guard_email', { domain: pending.guardDomain }) : t('guard_app');
	$('guardWrong').classList.toggle('hidden', !pending.guardWrong);
	if (document.activeElement !== $('guardCode')) $('guardCode').focus();
}
function prefillRelogin(login) {
	setMode('creds'); $('crLogin').value = login;
}

// ---------------- режим стримера: вместо логинов и ников — «Аккаунт N», баланс скрыт, коды Steam Guard,
// партнёры по трейдам и прокси размыты (наведение показывает); по галочке — размыты и суммы стоимости/портфеля.
const streamer = () => Boolean(ui.settings && ui.settings.streamerMode);
function acctNo(login) {
	const seen = new Map();
	for (const a of [...(ui.acctList || []), ...((ui.status && ui.status.accounts) || []), ...(ui.saved || [])]) if (a && a.login && !seen.has(a.login)) seen.set(a.login, a);
	const i = orderedAccounts([...seen.values()]).findIndex(a => a.login === login);
	return i >= 0 ? i + 1 : seen.size + 1;
}
const loginName = login => (streamer() ? t('streamer_acct', { n: acctNo(login) }) : login);
const accName = a => (streamer() ? loginName(a.login) : (a.personaName || a.login));
const accSub = a => (!streamer() && a.personaName && a.personaName !== a.login ? a.login : '');   // логин под ником
const walletText = w => (!w ? '' : streamer() ? '•••' : `${money(w.balance)} ${w.currency}`);
function applyStreamer() {
	document.body.classList.toggle('streamer', streamer());
	document.body.classList.toggle('sm-money', streamer() && Boolean(ui.settings.streamerMoney));
	$('streamerBadge').classList.toggle('hidden', !streamer());
}
async function toggleStreamer(on = !streamer()) {
	await saveSetting({ streamerMode: on });
	toast(t(on ? 'streamer_on' : 'streamer_off'), 'good');
	rerenderPrivate();
}
// перерисовать всё, где видны имена, балансы и коды (вкладка перезагружается — трейды, Steam Guard и т. п.)
function rerenderPrivate() {
	applyStreamer();
	rerenderAll();
	if (ui.saved) renderSaved();
	if (!$('settingsModal').classList.contains('hidden')) openSettings();
	if (ui.tab) switchTab(ui.tab);
}

// Аватарка Steam (кэш на диске, см. session._loadProfile) или буква логина, пока её нет.
function avatarHtml(a, cls = '') {
	if (a && streamer()) return `<div class="avatar ${cls}">${acctNo(a.login)}</div>`;
	return a && a.avatar
		? `<img class="avatar ${cls}" src="${esc(a.avatar)}" alt="">`
		: `<div class="avatar ${cls}">${esc(((a && a.login) || '?')[0].toUpperCase())}</div>`;
}

// Порядок аккаунтов: закреплённые — первыми (в своём порядке), затем остальные (порядок можно менять перетаскиванием).
function orderedAccounts(accounts) {
	const pins = ui.settings.pinnedAccounts || [], order = ui.settings.accountOrder || [];
	const rank = a => { const p = pins.indexOf(a.login); if (p >= 0) return p; const o = order.indexOf(a.login); return 1000 + (o >= 0 ? o : 500 + accounts.indexOf(a)); };
	return accounts.slice().sort((a, b) => rank(a) - rank(b));
}

function renderAccountBar(accounts, pending) {
	accounts = orderedAccounts(accounts);
	const pins = ui.settings.pinnedAccounts || [];
	const chips = accounts.map(a => {
		const busy = a.job && !a.job.finished;
		const cls = a.proxyBad ? 'bad' : a.needsRelogin ? 'warn' : a.status === 'online' ? 'ok' : a.status === 'connecting' ? 'warn' : 'bad';
		return `<div class="acct ${a.login === ui.active ? 'sel' : ''} ${pins.includes(a.login) ? 'pinned' : ''}" data-acct="${esc(a.login)}">
			${avatarHtml(a, 'acct-av')}
			<span class="acct-dot ${cls}"></span>
			<span class="acct-text"><span class="acct-name">${esc(accName(a))}</span>${accSub(a) ? `<span class="acct-login">${esc(accSub(a))}</span>` : ''}</span>
			${busy ? '<span class="acct-spin"><span class="spinner tiny"></span></span>' : ''}
			<button class="acct-x" data-logout="${esc(a.login)}" title="${esc(t('logout'))}">×</button>
		</div>`;
	}).join('');
	const adding = pending && ['connecting', 'guard', 'qr'].includes(pending.status);
	$('accountBar').innerHTML = chips + `<button class="acct more hidden" id="acctMore"></button><button class="acct add" id="addAcct">${adding ? esc(t('connecting')) : esc(t('add_account'))}</button>`;
	ui.acctList = accounts;
	fitAccountBar();
	if (!$('acctMenu').classList.contains('hidden')) renderAcctMenu();
}

// Много аккаунтов: показываем те, что помещаются (выбранный — всегда), остальные — в «▾ ещё N».
function fitAccountBar() {
	const bar = $('accountBar');
	const chips = [...bar.querySelectorAll('.acct[data-acct]')];
	const more = $('acctMore'), add = $('addAcct');
	chips.forEach(c => c.classList.remove('hidden'));
	more.classList.toggle('hidden', chips.length < 2);
	more.textContent = '▾'; more.title = t('acct_manage');
	if (bar.scrollWidth <= bar.clientWidth + 1) return;
	const gap = 8;
	more.classList.remove('hidden'); more.textContent = `▾ ${t('acct_more', { n: 99 })}`;
	let room = bar.clientWidth - add.offsetWidth - more.offsetWidth - gap * 2;
	const sel = chips.find(c => c.classList.contains('sel'));
	if (sel) room -= sel.offsetWidth + gap;
	let hidden = 0;
	for (const c of chips) {
		if (c === sel) continue;
		if (room >= c.offsetWidth + gap) room -= c.offsetWidth + gap;
		else { c.classList.add('hidden'); hidden++; }
	}
	more.textContent = hidden ? `▾ ${t('acct_more', { n: hidden })}` : '▾';
}
window.addEventListener('resize', () => { if (ui.acctList) fitAccountBar(); });

function renderAcctMenu() {
	const q = ($('acctSearch').value || '').toLowerCase();
	const pins = ui.settings.pinnedAccounts || [];
	const list = orderedAccounts(ui.acctList || []).filter(a => !q || `${accName(a)} ${accSub(a)}`.toLowerCase().includes(q));
	$('acctSearchWrap').classList.toggle('hidden', (ui.acctList || []).length < 7);
	$('acctMenuList').innerHTML = list.map(a => {
		const cls = a.proxyBad ? 'bad' : a.needsRelogin ? 'warn' : a.status === 'online' ? 'ok' : a.status === 'connecting' ? 'warn' : 'bad';
		const pinned = pins.includes(a.login);
		return `<div class="am-item ${a.login === ui.active ? 'sel' : ''} ${pinned ? 'pinned' : ''}" data-acct="${esc(a.login)}" draggable="${q ? 'false' : 'true'}">
			<span class="am-drag" title="${esc(t('acct_drag'))}">⋮⋮</span>${avatarHtml(a, 'acct-av')}<span class="acct-dot ${cls}"></span>
			<div class="am-text"><div class="acct-name">${esc(accName(a))}</div>${accSub(a) ? `<div class="acct-login">${esc(accSub(a))}</div>` : ''}</div>
			<button class="am-pin ${pinned ? 'on' : ''}" data-pin="${esc(a.login)}" title="${esc(t(pinned ? 'acct_unpin' : 'acct_pin'))}"><svg viewBox="0 0 24 24"><path d="M9 4h6l-1 6 3 3v2h-4v5l-1 1-1-1v-5H7v-2l3-3-1-6Z" fill="${pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></button>
			<button class="acct-x" data-logout="${esc(a.login)}" title="${esc(t('logout'))}">×</button></div>`;
	}).join('') || `<div class="combo-empty">${esc(t('nothing_found'))}</div>`;
	$('acctMenuHint').classList.toggle('hidden', Boolean(q));
}
// Сохранить порядок (после перетаскивания) и закрепления
function saveAccountOrder(logins) {
	const pins = (ui.settings.pinnedAccounts || []).filter(l => logins.includes(l));
	// закреплённые сохраняют взаимный порядок из перетаскивания
	const pinned = logins.filter(l => pins.includes(l));
	saveSetting({ accountOrder: logins.filter(l => !pins.includes(l)), pinnedAccounts: pinned });
	renderAccountBar(ui.acctList || [], ui.status && ui.status.pending);
}
function toggleAcctMenu(open) {
	const m = $('acctMenu');
	const show = open == null ? m.classList.contains('hidden') : open;
	m.classList.toggle('hidden', !show);
	if (!show) return;
	const r = $('acctMore').getBoundingClientRect();
	m.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 380))}px`;
	m.style.top = `${r.bottom + 6}px`;
	$('acctSearch').value = '';
	renderAcctMenu();
	if (!$('acctSearchWrap').classList.contains('hidden')) $('acctSearch').focus();
}

function handleActiveJob(active) {
	const job = active.job;
	const key = job ? `${job.started}:${job.finished}` : null;
	const prev = ui.lastJobKey[active.login];
	if (job && job.finished && key !== prev && prev !== undefined && prev !== null) {
		ui.contents = {};
		loadState().catch(() => {});
		if (ui.op === 'take' && ui.casketId) loadContents(ui.casketId, true).then(renderItems);
		const secs = Math.max(1, Math.round(((job.ended || Date.now()) - job.started) / 1000));
		if (job.done > 0 && confirmOn('transfer')) showTransferDone(job, secs);
		else if (job.done > 0) toast(t('td_toast', { n: fmt(job.done), name: job.casketName || '—', s: secs }) + (job.error ? ' · ' + job.error : ''), job.error ? 'bad' : 'good');
		else toast(t('done_err', { e: job.error || '—' }), 'bad');
	}
	ui.lastJobKey[active.login] = key;
	renderJob(job);
	updateAction();
}

// ============================================================ основной экран (активный аккаунт)
async function loadState() {
	const acc = ui.active;
	const st = await apiGet('/api/state');
	if (acc !== ui.active) return;  // пока грузили, переключились на другой аккаунт
	ui.state = st;
	renderTop(); renderCaskets();
	if (!ui.casketId || !ui.state.caskets.some(c => c.id === ui.casketId)) selectCasket(null);
	else renderPanel();
}

// Без выбранного ящика: подсказка + инвентарь (только просмотр). Нет ящиков — предложение купить.
function renderEmptyState() {
	const s = ui.state;
	const none = s && !s.caskets.length;
	$('emptyTitle').textContent = !s ? t('loading') : none ? t('no_caskets_title') : t('select_casket');
	$('emptyStats').textContent = !s ? '' : none ? t('no_caskets_text') : t('empty_stats', { c: s.caskets.length, a: fmt(s.caskets.reduce((n, c) => n + c.count, 0)), b: fmt(s.inventoryCount) });
	$('emptyBuy').classList.toggle('hidden', !none);
	const inv = s ? s.inventory : [];
	$('invPreview').innerHTML = inv.length ? `<div class="section-title" style="margin:6px 0 10px">${esc(t('inventory'))} · ${fmt(s.inventoryCount)}</div>` + inv.map(i => `
		<div class="item"><div class="thumb">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : ''}</div>
			<div style="min-width:0"><div class="item-name" title="${esc(i.name)}">${esc(i.name)}</div></div>
			<span class="muted">×${fmt(i.count)}</span></div>`).join('') : '';
}

function renderTop() {
	const s = ui.state;
	if (!s) return;
	$('invMeterText').textContent = `${s.inventoryCount} / ${s.inventoryLimit}`;
	const pct = s.inventoryCount / s.inventoryLimit * 100;
	$('invMeter').style.width = `${pct}%`;
	$('invMeter').className = pct >= 98 ? 'full' : pct >= 85 ? 'warn' : '';
	if (!ui.casketId) renderEmptyState();
}

function renderCaskets() {
	if (!ui.state) return;
	const all = ui.state.caskets;
	const shown = all.filter(c => ui.showFull || c.count < c.capacity || c.id === ui.casketId);
	$('casketCount').textContent = all.length;
	const hiddenFull = all.length - shown.length;
	$('casketList').innerHTML = shown.map(c => {
		const pct = c.count / c.capacity * 100;
		return `<div class="casket ${c.id === ui.casketId ? 'sel' : ''} ${c.name ? '' : 'unnamed'}" data-casket="${c.id}">
			<div class="casket-row"><span class="casket-name">${esc(c.name || '—')}</span><span class="casket-count">${fmt(c.count)} / ${fmt(c.capacity)}</span></div>
			<div class="meter"><i class="${pct >= 100 ? 'full' : pct >= 90 ? 'warn' : ''}" style="width:${pct}%"></i></div>
		</div>`;
	}).join('') + (hiddenFull ? `<p class="muted small" style="text-align:center;margin:8px 0">${esc(t('hidden_full', { n: hiddenFull }))}</p>` : '')
		+ (!all.length ? `<p class="muted small" style="padding:12px">${esc(t('no_caskets'))}</p>` : '');
}

function currentCasket() { return ui.state && ui.state.caskets.find(c => c.id === ui.casketId); }

async function selectCasket(id) {
	ui.casketId = id; ui.picks = {};
	$('renameRow').classList.add('hidden');
	renderCaskets();
	$('emptyState').classList.toggle('hidden', Boolean(id));
	$('casketPanel').classList.toggle('hidden', !id);
	if (!id) { renderEmptyState(); return; }
	const c = currentCasket();
	if (!c) { ui.casketId = null; return selectCasket(null); }
	if (c.count >= c.capacity) ui.op = 'take';
	else if (c.count === 0) ui.op = 'store';
	if (!c.name) { $('renameRow').classList.remove('hidden'); $('renameInput').focus(); }
	if (ui.op === 'take') await loadContents(id);
	renderPanel();
}

async function loadContents(id, force) {
	if (ui.contents[id] && !force) return;
	ui.loadingItems = true; renderItems();
	try { ui.contents[id] = await apiGet(`/api/casket/${id}`); }
	catch (e) { toast(t('cant_open_casket', { e: e.message }), 'bad'); ui.contents[id] = []; }
	ui.loadingItems = false;
}

function renderPanel() {
	const c = currentCasket(); if (!c) return;
	$('casketTitle').textContent = c.name || '—';
	const pct = c.count / c.capacity * 100;
	$('casketMeter').style.width = `${pct}%`;
	$('casketMeter').className = pct >= 100 ? 'full' : pct >= 90 ? 'warn' : '';
	$('casketFillText').textContent = `${fmt(c.count)} / ${fmt(c.capacity)}`;
	document.querySelectorAll('#modeSwitch button').forEach(b => b.classList.toggle('active', b.dataset.op === ui.op));
	renderItems();
}

function sourceItems() {
	if (ui.op === 'store') {
		return ui.state.inventory.map(i => ({ ...i, available: i.movable.length }))
			.sort((a, b) => (b.available > 0) - (a.available > 0) || b.available - a.available || b.count - a.count);
	}
	return (ui.contents[ui.casketId] || []).map(i => ({ ...i, available: i.count }));
}

function visibleItems() {
	const q = ui.search.toLowerCase();
	return sourceItems().filter(i => (!q || i.name.toLowerCase().includes(q)) && (!ui.onlyCases || / Case$|Capsule$|Package$|Container$/.test(i.name)));
}

function renderItems() {
	if (ui.loadingItems) { $('itemList').innerHTML = Array.from({ length: 7 }, () => '<div class="skeleton skeleton-row"></div>').join(''); updateAction(); return; }
	const items = visibleItems();
	if (!items.length) {
		$('itemList').innerHTML = `<div class="empty-state" style="margin-top:60px"><p class="muted">${esc(ui.op === 'store' ? t('no_items_store') : t('casket_empty'))}</p></div>`;
		updateAction(); return;
	}
	$('itemList').innerHTML = items.map(i => {
		const n = ui.picks[i.name] || 0;
		const locked = ui.op === 'store' && !i.available;
		const lock = ui.op === 'store' && i.protected
			? ` · <span class="lock">🔒 ${esc(t('protected', { n: i.protected, until: i.protectedUntil ? t('protected_until', { date: i.protectedUntil }) : '' }))}</span>` : '';
		return `<div class="item ${n ? 'picked' : ''} ${locked ? 'locked' : ''}">
			<div class="thumb">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : ''}</div>
			<div style="min-width:0"><div class="item-name" title="${esc(i.name)}">${esc(i.name)}</div>
				<div class="item-sub">${ui.op === 'store' ? t('in_inventory') : t('in_casket')}: ${fmt(i.count)}${priceTag(i)}${lock}</div></div>
			${locked ? `<span class="muted small">${esc(t('cant_move'))}</span>` : `
			<div class="stepper" data-name="${esc(i.name)}" data-max="${i.available}">
				<button data-step="-1" aria-label="-">−</button>
				<input type="number" min="0" max="${i.available}" value="${n || ''}" placeholder="0">
				<button data-step="1" aria-label="+">+</button>
				<button class="all" data-step="all">${esc(t('select_all'))} ${fmt(i.available)}</button>
			</div>`}
		</div>`;
	}).join('');
	updateAction();
}

// Цена у строки предмета: «· 0,25 $ / шт · 24,00 $»
function priceTag(i) {
	const c = ui.state && ui.state.priceCurrency;
	if (!c || i.price == null) return '';
	return ` · <span class="price-tag">${esc(cur(i.price, c))}${i.count > 1 ? ` ${esc(t('per_item'))} · ${esc(cur(i.price * i.count, c))}` : ''}</span>`;
}

function setPick(name, value, max) { const n = Math.max(0, Math.min(max, Math.floor(Number(value) || 0))); if (n) ui.picks[name] = n; else delete ui.picks[name]; }
function selectedTotal() { return Object.values(ui.picks).reduce((a, b) => a + b, 0); }

function updateAction() {
	const c = currentCasket(); if (!c) return;
	const total = selectedTotal();
	const active = activeAccount();
	const busy = active && active.job && !active.job.finished;
	const limit = ui.op === 'store' ? c.capacity - c.count : ui.state.inventoryLimit - ui.state.inventoryCount;
	$('selCount').textContent = fmt(total);
	$('selHint').textContent = ui.op === 'store' ? t('selected_store') : t('selected_take');
	let warn = '';
	if (!c.name && ui.op === 'store') warn = t('warn_name_first');
	else if (total > limit) warn = ui.op === 'store' ? t('warn_free_casket', { n: fmt(limit) }) : t('warn_free_inv', { n: fmt(limit) });
	else if (busy) warn = t('warn_busy');
	$('selWarn').textContent = warn;
	$('actionBtn').disabled = !total || Boolean(warn);
	$('actionBtn').textContent = ui.op === 'store'
		? (total ? t('action_store', { n: fmt(total), name: c.name || '…' }) : t('action_store_idle'))
		: (total ? t('action_take', { n: fmt(total) }) : t('action_take_idle'));
	document.querySelectorAll('.stepper').forEach(st => {
		const n = ui.picks[st.dataset.name] || 0;
		const input = st.querySelector('input');
		if (document.activeElement !== input) input.value = n || '';
		st.closest('.item').classList.toggle('picked', Boolean(n));
	});
}

async function runAction() {
	const c = currentCasket();
	const items = Object.entries(ui.picks).map(([name, count]) => ({ name, count }));
	try {
		await apiPost(ui.op === 'store' ? '/api/store' : '/api/take', { casketId: c.id, casketName: c.name, items });
		ui.picks = {}; renderItems(); poll(true);
	} catch (e) { toast(e.message, 'bad'); }
}

// Итог перекладки — по центру, с OK. «Больше не показывать» -> дальше итог будет обычным уведомлением сбоку.
// Итог перекладки — отдельное окно (показывается всегда после успешной перекладки).
function showTransferDone(job, secs) {
	const store = job.kind === 'store';
	$('tdCard').classList.toggle('take', !store);
	$('tdTitle').textContent = t(store ? 'td_title_store' : 'td_title_take');
	$('tdSub').textContent = `«${job.casketName || '—'}»`;
	$('tdTime').textContent = secs >= 60 ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` : t('td_secs', { s: secs });
	$('tdSpeed').textContent = (job.done / Math.max(1, secs)).toFixed(1);
	$('tdWarn').classList.toggle('hidden', !job.error);
	$('tdWarn').textContent = job.failed ? t('td_failed', { n: fmt(job.failed) }) : (job.error || '');
	// под итогом — просьба: сначала ★ на GitHub (бесплатно, помогает другим найти проект), после неё — поддержка
	const askStar = !ui.settings.starClicked && job.done >= 20;
	$('tdSupportWrap').innerHTML = ui.settings.supportHideNudges ? ''
		: askStar ? `<div class="td-support td-star"><span>${esc(t('td_star'))}</span> <button class="btn star-btn small" id="tdStar">★ ${esc(t('star_btn'))}</button></div>`
		: `<div class="td-support">♥ ${esc(t('td_support'))} <button class="btn support-btn small" id="tdSupport">${esc(t('support_short'))}</button></div>`;
	const sup = document.getElementById('tdSupport');
	if (sup) sup.onclick = () => { closeTransferDone(); openSupport(); };
	const star = document.getElementById('tdStar');
	if (star) star.onclick = () => { openExt(GITHUB_URL); saveSetting({ starClicked: true }); closeTransferDone(); toast(t('star_thanks'), 'good'); };
	// заполненность ящика после перекладки (состояние обновляется в фоне — подхватываем, когда придёт)
	const fill = () => {
		const c = ui.state && ui.state.caskets.find(x => x.id === job.casketId);
		$('tdFill').classList.toggle('hidden', !c);
		if (!c) return;
		$('tdFillName').textContent = c.name || '—';
		$('tdFillN').textContent = `${fmt(c.count)} / ${fmt(c.capacity)}`;
		$('tdFillBar').style.width = `${Math.min(100, c.count / c.capacity * 100)}%`;
		$('tdFillBar').className = c.count >= c.capacity * 0.98 ? 'full' : c.count >= c.capacity * 0.85 ? 'warn' : '';
	};
	fill(); setTimeout(fill, 900); setTimeout(fill, 2500);
	// число предметов «набегает»
	const n = job.done, t0 = performance.now();
	const step = now => {
		const k = Math.min(1, (now - t0) / 700);
		$('tdN').textContent = fmt(Math.round(n * (1 - Math.pow(1 - k, 3))));
		if (k < 1 && !$('tdModal').classList.contains('hidden')) requestAnimationFrame(step);
	};
	$('tdModal').classList.remove('hidden');
	$('tdCard').classList.remove('anim'); void $('tdCard').offsetWidth; $('tdCard').classList.add('anim');
	requestAnimationFrame(step);
	$('tdOk').focus();
}
function closeTransferDone() {
	$('tdModal').classList.add('hidden');
	if ($('tdDont').checked) { $('tdDont').checked = false; setConfirm('transfer', false); toast(t('td_dont_note'), 'good'); }
}
$('tdOk').addEventListener('click', closeTransferDone);

// ============================================================ прогресс операции
function renderJob(job) {
	if (!job || ui.jobDismissed === job.started) { $('jobBanner').classList.add('hidden'); return; }
	const banner = $('jobBanner');
	banner.classList.remove('hidden');
	const name = `«${job.casketName || '—'}»`;
	const pct = job.total ? (job.done + job.failed) / job.total * 100 : 0;
	const seconds = ((job.ended || Date.now()) - job.started) / 1000;
	const speed = seconds > 0 ? job.done / seconds : 0;
	banner.classList.toggle('done', job.finished && !job.error);
	banner.classList.toggle('failed', job.finished && Boolean(job.error));
	$('jobTitle').textContent = job.kind === 'store'
		? (job.finished ? t('job_stored', { name }) : t('job_storing', { name }))
		: (job.finished ? t('job_taken', { name }) : t('job_taking', { name }));
	if (job.rules) $('jobTitle').textContent += ` · ${t('rules_step', { i: job.rules.step, n: job.rules.steps })}`;
	$('jobNumbers').textContent = `${fmt(job.done)} / ${fmt(job.total)}`;
	$('jobBar').style.width = `${pct}%`;
	$('jobIcon').innerHTML = job.finished
		? (job.error ? '<svg viewBox="0 0 24 24"><path d="M12 8v5M12 16.5v.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
			: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>')
		: '<div class="spinner"></div>';
	if (job.finished) {
		$('jobSub').textContent = `${job.error ? job.error + ' · ' : ''}${Math.round(seconds)} s · ${t('per_sec', { n: speed.toFixed(1) })}`;
	} else {
		const left = speed > 0 ? Math.round((job.total - job.done - job.failed) / speed) : null;
		const leftText = left === null ? '' : ' · ' + (left < 60 ? t('left_sec', { n: left }) : t('left_min', { n: Math.ceil(left / 60) }));
		$('jobSub').textContent = `${t('per_sec', { n: speed.toFixed(1) })}${leftText}${job.failed ? ' · ' + t('not_accepted', { n: job.failed }) : ''}`;
	}
	$('jobStop').classList.toggle('hidden', job.finished);
	$('jobStop').disabled = Boolean(job.cancelRequested);
	$('jobClose').classList.toggle('hidden', !job.finished);
}

// ============================================================ опрос статуса
let pollTimer = null;
async function poll(now) {
	clearTimeout(pollTimer);
	try {
		ui.status = await api('/api/status'); renderAccounts(ui.status); handleAlerts(ui.status.alerts);
		if (!ui.guard) { const bad = (ui.status.accounts || []).filter(a => a.proxyBad).length; $('guardTopBadge').classList.toggle('hidden', !bad); $('guardTopBadge').textContent = bad; }
	}
	catch (e) { /* сервер ещё стартует */ }
	const s = ui.status;
	const busy = s && ((s.pending && ['connecting', 'guard', 'qr'].includes(s.pending.status)) || (s.accounts || []).some(a => a.job && !a.job.finished));
	pollTimer = setTimeout(poll, busy ? 700 : 2000);
}

// ============================================================ вкладки и магазин
function switchTab(tab) {
	ui.tab = tab;
	document.querySelectorAll('#sideNav [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
	$('guardView').classList.toggle('hidden', tab !== 'guard');
	if (tab === 'guard') loadGuard();
	$('overviewView').classList.toggle('hidden', tab !== 'overview');
	$('pnlView').classList.toggle('hidden', tab !== 'pnl');
	if (tab === 'pnl') loadPnl();
	$('casketsView').classList.toggle('hidden', tab !== 'caskets');
	$('storeView').classList.toggle('hidden', tab !== 'store');
	$('tradeupView').classList.toggle('hidden', tab !== 'tradeup');
	$('tradesView').classList.toggle('hidden', tab !== 'trades');
	$('armoryView').classList.toggle('hidden', tab !== 'armory');
	$('stickersView').classList.toggle('hidden', tab !== 'stickers');
	if (tab === 'stickers') loadStickers();
	if (tab === 'armory') loadArmory();
	$('marketView').classList.toggle('hidden', tab !== 'market');
	if (tab === 'trades') loadTrades();
	if (tab === 'market') loadMarket();
	if (tab === 'store' && !ui.store) loadStore();
	if (tab === 'tradeup') loadTradeup();
	if (tab === 'overview') loadOverview();
}

async function loadStore() {
	$('storeGrid').innerHTML = Array.from({ length: 12 }, () => '<div class="skeleton store-skeleton"></div>').join('');
	try {
		ui.store = await apiGet('/api/store/catalog');
		renderStoreBalance();
		renderStore();
	} catch (e) { $('storeGrid').innerHTML = `<p class="muted" style="padding:20px">${esc(e.message)}</p>`; }
}

const STAR = '<svg viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8L12 3.5Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const money = n => Number(n).toLocaleString(LANG === 'zh' ? 'zh-CN' : LANG, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function storeCard(i) {
	const fav = ui.settings.favorites.includes(i.def);
	const q = ui.cart[i.def] || 0;
	return `
		<div class="store-card ${i.buyable ? '' : 'disabled'} ${q ? 'in-cart' : ''}" data-card="${i.def ?? ''}">
			${i.buyable ? `<button class="star ${fav ? 'on' : ''}" data-fav="${i.def}" title="${esc(t('favorites'))}">${STAR}</button>` : ''}
			<div class="store-thumb">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : ''}</div>
			<div class="store-name" title="${esc(i.name)}">${esc(i.name)}</div>
			<div class="store-foot">
				<span class="store-price">${money(i.price)} ${esc(ui.store.currency)}</span>
				${i.buyable
					? `<span class="qty ${q ? 'on' : ''}" data-q="${i.def}"><button data-step="-1">−</button><input type="number" min="0" max="100" value="${q}" data-qin="${i.def}"><button data-step="1">+</button></span>`
					: `<span class="muted small">${esc(t('unavailable'))}</span>`}
			</div>
		</div>`;
}

function renderStore() {
	if (!ui.store) return;
	const q = ($('storeSearch').value || '').toLowerCase();
	const items = ui.store.items.filter(i => !q || i.name.toLowerCase().includes(q));
	const favs = items.filter(i => i.buyable && ui.settings.favorites.includes(i.def));
	const rest = items.filter(i => !favs.includes(i));
	const section = key => `<div class="store-section"><span class="section-title">${esc(t(key))}</span><span class="line"></span></div>`;
	$('storeGrid').innerHTML = items.length
		? (favs.length ? section('favorites') + favs.map(storeCard).join('') + section('all_items') : '') + rest.map(storeCard).join('')
		: `<p class="muted" style="padding:20px">${esc(t('nothing_found'))}</p>`;
	updateCartBtn();
}

function storeItem(def) { return ui.store && ui.store.items.find(i => i.def === def); }

function setCartQty(def, qty) {
	qty = Math.max(0, Math.min(100, Math.floor(Number(qty) || 0)));
	if (qty) ui.cart[def] = qty; else delete ui.cart[def];
	// Обновляем карточку на месте (без перерисовки — чтобы не терять фокус в поле количества).
	document.querySelectorAll(`[data-card="${def}"]`).forEach(card => {
		card.classList.toggle('in-cart', qty > 0);
		const box = card.querySelector('.qty'); box.classList.toggle('on', qty > 0);
		const inp = card.querySelector('input'); if (document.activeElement !== inp || Number(inp.value) !== qty) inp.value = qty;
	});
	updateCartBtn();
}

function cartLines() {
	return Object.entries(ui.cart).map(([def, qty]) => {
		const it = storeItem(Number(def));
		return it ? { def: it.def, name: it.name, image: it.image, unit: it.price, qty } : null;
	}).filter(Boolean);
}

function updateCartBtn() {
	const lines = cartLines();
	const count = lines.reduce((n, l) => n + l.qty, 0);
	const total = lines.reduce((n, l) => n + l.qty * l.unit, 0);
	$('cartCount').textContent = fmt(count);
	$('cartTotal').textContent = `${money(total)} ${ui.store ? ui.store.currency : ''}`;
	$('cartBtn').disabled = !count;
	$('cartReset').disabled = !count;
	renderStoreBalance(total);
}

// Баланс кошелька в магазине — крупно; с корзиной — сколько останется (красным, если не хватает).
function renderStoreBalance(cartTotal) {
	const st = ui.store;
	const has = Boolean(st && st.balance != null);
	$('storeBalance').classList.toggle('hidden', !has);
	if (!has) return;
	if (cartTotal == null) cartTotal = cartLines().reduce((n, l) => n + l.qty * l.unit, 0);
	$('storeWallet').textContent = walletText({ balance: st.balance, currency: st.currency });
	const left = st.balance - cartTotal;
	$('storeAfter').classList.toggle('hidden', !cartTotal);
	$('storeAfter').textContent = left >= 0 ? t('after_cart', { amount: `${money(left)} ${st.currency}` }) : t('not_enough', { amount: `${money(-left)} ${st.currency}` });
	$('storeBalance').classList.toggle('short', left < 0);
}

async function toggleFavorite(def) {
	const favs = ui.settings.favorites.includes(def) ? ui.settings.favorites.filter(d => d !== def) : [...ui.settings.favorites, def];
	ui.settings.favorites = favs;
	renderStore();
	try { ui.settings = await api('/api/settings', { favorites: favs }); } catch (e) { toast(e.message, 'bad'); }
}

// ============================================================ настройки приложения
async function loadSettings() {
	try { ui.settings = await api('/api/settings'); } catch (e) { /* по умолчанию */ }
	$('giftToggle').checked = ui.settings.autoAcceptGifts;
	$('sideNav').classList.toggle('collapsed', Boolean(ui.settings.navCollapsed));
	applyStreamer();
	if (ui.settings.lang && ui.settings.lang !== LANG && window.I18N.dict[ui.settings.lang]) setLang(ui.settings.lang, false);
	updateCartBtn();
	maybeWelcome();
}

function openSettings() {
	renderConfirms();
	api('/api/proxies').then(l => { ui.proxies = l; $('proxyCount').textContent = `${l.filter(a => a.proxy).length}/${l.length}`; }).catch(() => {});
	setPane(ui.setPane || 'general');
	if (window.desktop && window.desktop.version) window.desktop.version().then(v => { $('setVersion').textContent = `Caskit ${v}`; }).catch(() => {});
	$('updateMode').value = ui.settings.updateMode || 'ask';
	$('streamerToggle').checked = streamer(); $('streamerMoney').checked = Boolean(ui.settings.streamerMoney);
	$('streamerMoneyRow').classList.toggle('off', !streamer());
	$('updateRow').classList.toggle('hidden', !window.desktop);
	// сборка без обновлений (собрана с флагом noupdate) — переключатель не нужен
	if (window.desktop && window.desktop.updatesDisabled) window.desktop.updatesDisabled().then(off => { $('updateCtl').classList.toggle('hidden', Boolean(off)); $('updateOff').classList.toggle('hidden', !off); }).catch(() => {});
	$('priceToggle').checked = ui.settings.priceEnabled !== false;
	$('priceOpts').classList.toggle('hidden', ui.settings.priceEnabled === false);
	$('priceSource').value = ui.settings.priceSource || 'steam';
	const pc = ui.settings.priceCurrency || 'auto';
	$('priceCurrency').innerHTML = `<option value="auto">${esc(t('price_cur_auto'))}</option>` + PRICE_CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join('');
	$('priceCurrency').value = pc;
	$('priceFeeToggle').checked = Boolean(ui.settings.priceAfterFee);
	$('settingsModal').classList.remove('hidden');
}

async function saveSetting(patch) {
	Object.assign(ui.settings, patch);
	try { ui.settings = await api('/api/settings', patch); } catch (e) { toast(e.message, 'bad'); }
}

// Небольшое окно подтверждения (вместо системного confirm). Возвращает { ok, dont } — dont = «больше не показывать».
const ICON_Q = '<svg viewBox="0 0 24 24"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.3-2.5 3.8M12 17v.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
const ICON_WALLET = '<svg viewBox="0 0 24 24"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h14V8H6.5A2.5 2.5 0 0 1 4 7.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="16" cy="13.5" r="1.3" fill="currentColor"/></svg>';
function miniConfirm({ icon = ICON_Q, warn = false, title, text, extra = '', ok = 'OK', dontShow = false, cancel = true, dontText = null }) {
	return new Promise(resolve => {
		$('miniIcon').innerHTML = icon; $('miniIcon').classList.toggle('warn', warn); $('miniIcon').classList.toggle('ok', icon === ICON_OK);
		$('miniTitle').textContent = title || '';
		$('miniText').textContent = text || '';
		$('miniExtra').innerHTML = extra;
		$('miniDontWrap').classList.toggle('hidden', !dontShow); $('miniDont').checked = false;
		$('miniDontWrap').querySelector('span').textContent = dontText || t('dont_show_again');
		$('miniCancel').classList.toggle('hidden', !cancel);
		$('miniOk').textContent = ok;
		$('miniModal').classList.remove('hidden');
		$('miniOk').focus();
		const done = v => { $('miniModal').classList.add('hidden'); $('miniOk').onclick = $('miniCancel').onclick = null; ui.miniAnswer = null; resolve({ ok: v, dont: $('miniDont').checked }); };
		ui.miniAnswer = done;
		$('miniOk').onclick = () => done(true);
		$('miniCancel').onclick = () => done(false);
	});
}

// ============================================================ обновления: только с согласия пользователя
function onUpdateEvent(u) {
	if (u.type === 'available') {
		ui.update = u;
		$('updTitle').textContent = t('upd_title', { v: u.version });
		$('updText').textContent = t(u.canInstall ? 'upd_text' : 'upd_text_manual', { cur: ui.appVersion || '' });
		$('updGo').textContent = t(u.canInstall ? 'upd_go' : 'upd_download');
		$('updGo').disabled = false;
		$('updBar').classList.add('hidden');
		$('updModal').classList.remove('hidden');
	} else if (u.type === 'progress') {
		$('updBar').classList.remove('hidden');
		$('updBar').querySelector('i').style.width = `${u.percent}%`;
		$('updGo').textContent = `${t('upd_downloading')} ${u.percent}%`;
	} else if (u.type === 'ready') {
		ui.updateReady = true;
		$('updBar').querySelector('i').style.width = '100%';
		$('updGo').disabled = false;
		$('updGo').textContent = t('update_restart');
		$('updModal').classList.remove('hidden');
	} else if (u.type === 'error') {
		$('updGo').disabled = false;
		$('updGo').textContent = t('upd_download');
		if (ui.update) ui.update.canInstall = false;  // не получилось само — предложим скачать со страницы релиза
		toast(t('upd_error'), 'bad');
	}
}
$('updGo').addEventListener('click', async () => {
	const u = ui.update;
	if (!u) return;
	if (ui.updateReady) return window.desktop.installUpdate();
	if (!u.canInstall) { openExt(u.url); $('updModal').classList.add('hidden'); return; }
	$('updGo').disabled = true;
	$('updGo').textContent = t('upd_downloading');
	try { await window.desktop.downloadUpdate(); } catch (e) { onUpdateEvent({ type: 'error' }); }
});
$('updLater').addEventListener('click', () => $('updModal').classList.add('hidden'));
$('updSkip').addEventListener('click', () => { if (ui.update) saveSetting({ skipVersion: ui.update.version }); $('updModal').classList.add('hidden'); });
$('updNotes').addEventListener('click', e => { e.preventDefault(); if (ui.update) openExt(ui.update.url); });
$('updateMode').addEventListener('change', e => saveSetting({ updateMode: e.target.value }));
$('updateCheck').addEventListener('click', async () => {
	if (!window.desktop || !window.desktop.checkUpdates) return;
	const b = $('updateCheck'); b.disabled = true;
	try {
		const r = await window.desktop.checkUpdates();
		if (r.error) toast(r.error, 'bad');
		else if (!r.newer) toast(t('upd_latest', { v: r.current }), 'good');
	} finally { b.disabled = false; }
});

// ============================================================ прокси аккаунтов (настройки)
// Разделы настроек: меню слева, содержимое справа
function setPane(name) {
	ui.setPane = name;
	document.querySelectorAll('#settingsModal .set-nav-i').forEach(b => b.classList.toggle('active', b.dataset.pane === name));
	document.querySelectorAll('#settingsModal .set-pane').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== name));
	const btn = document.querySelector(`#settingsModal .set-nav-i[data-pane="${name}"] span`);
	$('setPaneTitle').textContent = btn ? btn.textContent : '';
	if (name === 'confirms') renderConfirms();
	if (name === 'proxies') openProxies();
	if (name === 'about') renderSupport($('setSupportList'));
}
document.querySelector('#settingsModal .set-nav').addEventListener('click', e => { const b = e.target.closest('[data-pane]'); if (b) setPane(b.dataset.pane); });

async function openProxies() {
	$('pxList').innerHTML = Array.from({ length: 3 }, () => '<div class="skeleton" style="height:58px"></div>').join('');
	try { ui.proxies = await api('/api/proxies'); renderProxies(); } catch (e) { $('pxList').innerHTML = `<p class="muted small">${esc(e.message)}</p>`; }
}
function pxStatus(a) {
	if (!a.proxy) return `<span class="px-pill">${esc(t('px_direct'))}</span>`;
	const st = a.status;
	if (!st) return `<span class="px-pill">${esc(t('px_unchecked'))}</span>`;
	return st.ok ? `<span class="px-pill ok" title="${esc(new Date(st.checked).toLocaleString())}">${esc(t('px_ok'))}</span>`
		: `<span class="px-pill bad" title="${esc(st.error || '')}">${esc(t('px_bad'))}</span>`;
}
function renderProxies() {
	const list = ui.proxies || [];
	$('pxList').innerHTML = list.length ? list.map(a => `<div class="px-row" data-px="${esc(a.login)}">
		<div class="px-acc">${avatarHtml(a, 'acct-av')}<div><div class="strong">${esc(accName(a))}</div><div class="muted small">${esc(accSub(a) || (streamer() ? '' : a.login))}${a.online ? ' · ' + esc(t('px_online')) : ''}</div></div></div>
		<input class="px-in" value="${esc(a.proxy)}" placeholder="${esc(t('px_none_ph'))}" spellcheck="false" ${a.saved ? '' : 'disabled title="' + esc(t('px_not_saved')) + '"'}>
		${pxStatus(a)}
		<div class="px-actions">
			<button class="btn primary small hidden" data-pxsave>${esc(t('pnl_save'))}</button>
			${a.proxy ? `<button class="btn ghost small" data-pxcheck>${esc(t('upd_check'))}</button>` : ''}
			${a.online && a.saved && (a.active || '') !== (a.proxy || '') ? `<button class="btn ghost small" data-pxrelog title="${esc(t('px_relog_hint'))}">${esc(t('px_relog'))}</button>` : ''}
		</div>
	</div>`).join('') : `<p class="muted small">${esc(t('px_no_accounts'))}</p>`;
	const n = list.filter(a => a.proxy).length;
	$('proxyCount').textContent = `${n}/${list.length}`;
}
$('pxList').addEventListener('input', e => {
	const row = e.target.closest('[data-px]'); if (!row) return;
	const a = (ui.proxies || []).find(x => x.login === row.dataset.px);
	row.querySelector('[data-pxsave]').classList.toggle('hidden', e.target.value.trim() === (a && a.proxy || ''));
});
$('pxList').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('px-in')) { const b = e.target.closest('[data-px]').querySelector('[data-pxsave]'); if (b) b.click(); } });
$('pxList').addEventListener('click', async e => {
	const row = e.target.closest('[data-px]'); if (!row) return;
	const login = row.dataset.px;
	const btn = e.target.closest('button'); if (!btn) return;
	btn.disabled = true;
	try {
		if (btn.hasAttribute('data-pxsave')) {
			const r = await api('/api/proxies/set', { login, proxy: row.querySelector('.px-in').value, protocol: $('pxProto').value });
			toast(r.status && !r.status.ok ? t('px_saved_bad', { e: r.status.error || '' }) : t(r.needsRelogin ? 'px_saved_relog' : 'px_saved'), r.status && !r.status.ok ? 'bad' : 'good');
		} else if (btn.hasAttribute('data-pxcheck')) {
			await api('/api/proxies/check', { login });
		} else if (btn.hasAttribute('data-pxrelog')) {
			// переподключение с новым прокси: выходим и входим снова сохранённым токеном
			await api('/api/logout', { account: login });
			await api('/api/login', { mode: 'saved', login });
			toast(t('px_relogging', { a: login }), 'good');
			poll(true);
		}
		ui.proxies = await api('/api/proxies'); renderProxies();
	} catch (err) { toast(err.message, 'bad'); btn.disabled = false; }
});
$('pxCheckAll').addEventListener('click', async () => {
	$('pxCheckAll').disabled = true;
	try { ui.proxies = await api('/api/proxies/check', {}); renderProxies(); } catch (e) { toast(e.message, 'bad'); }
	$('pxCheckAll').disabled = false;
});
$('pxBulkGo').addEventListener('click', async () => {
	try {
		const r = await api('/api/proxies/bulk', { list: $('pxBulkList').value, protocol: $('pxProto').value, target: $('pxTarget').value });
		toast(t('px_bulk_done', { n: r.assigned, p: r.proxies }), 'good');
		$('pxBulkList').value = '';
		ui.proxies = await api('/api/proxies'); renderProxies();
		ui.proxies = await api('/api/proxies/check', {}); renderProxies();  // проверка — следом, может занять до минуты
	} catch (e) { toast(e.message, 'bad'); }
});

// ============================================================ подтверждения (общий список в настройках)
// Отключаемые подтверждения: «больше не показывать» в окне выключает их, вернуть можно в «Настройки → Подтверждения».
// Оплата, удаление наклейки и отдача предметов в обмене подтверждаются всегда — их здесь нет.
const CONFIRMS = ['transfer', 'nudge', 'inspect', 'sticker', 'scrape', 'tradeup', 'sell', 'mremove', 'armory', 'pnledit'];
function confirmOn(k) {
	if (k === 'nudge') return !ui.settings.supportHideNudges;  // напоминания о поддержке — своя настройка
	if (k === 'sticker' && ui.settings.stickerConfirm === false) return false;  // старая настройка
	return ((ui.settings.confirms || {})[k]) !== false;
}
function setConfirm(k, on) {
	if (k === 'nudge') return saveSetting({ supportHideNudges: !on });
	const confirms = { ...(ui.settings.confirms || {}), [k]: Boolean(on) };
	return saveSetting(k === 'sticker' ? { confirms, stickerConfirm: Boolean(on) } : { confirms });
}
async function askConfirm(key, opts) {
	if (!confirmOn(key)) return { ok: true };
	const r = await miniConfirm({ ...opts, dontShow: true });
	if (r.ok && r.dont) setConfirm(key, false);
	return r;
}
function renderConfirms() {
	$('confirmList').innerHTML = CONFIRMS.map(k => `<label class="switch-row">
		<span><span class="strong">${esc(t('cf_' + k))}</span><span class="muted small block-text">${esc(t('cf_' + k + '_desc'))}</span></span>
		<input type="checkbox" class="switch" data-cf="${k}" ${confirmOn(k) ? 'checked' : ''}></label>`).join('');
	$('confirmCount').textContent = `${CONFIRMS.filter(confirmOn).length}/${CONFIRMS.length}`;
}
// «Осмотреть в игре» запускает CS2 через Steam — сначала спрашиваем
async function launchInspect(link) {
	if (!link) return;
	const r = await askConfirm('inspect', { icon: ICON_Q, title: t('inspect_launch_title'), text: t('inspect_launch_text'), ok: t('inspect_launch_ok') });
	if (r.ok) openExt(link);
}

// ============================================================ оформление покупки
// Каждая позиция корзины — отдельная транзакция Steam: заказ в GC → Steam присылает счёт →
// пользователь подтверждает (или сразу, если включена «Быстрая покупка») → оплата и выдача предметов.
// До подтверждения деньги не списываются.
const ICON_OK = '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_ERR = '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 16.5v.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

function openCheckout(lines) {
	if (ui.co && ui.co.busy) return;
	ui.co = { account: ui.active, lines: lines.map(l => ({ ...l, bought: 0, status: 'wait' })), idx: 0, busy: false };
	const acc = activeAccount() || { login: ui.active };
	$('coAvatar').outerHTML = avatarHtml(acc).replace('class="avatar', 'id="coAvatar" class="avatar');
	$('coLogin').textContent = accName(acc);
	$('coBalance').textContent = ui.store && ui.store.balance != null ? `(${walletText({ balance: ui.store.balance, currency: ui.store.currency })})` : '';
	$('checkoutModal').classList.remove('hidden');
	runCheckout();
}

function renderCoLines() {
	const co = ui.co;
	const n = co.lines.length;
	$('coStep').textContent = t('checkout_step', { i: Math.min(co.idx + 1, n), n });
	const cur = co.currency || (ui.store && ui.store.currency) || '';
	$('coLines').innerHTML = co.lines.map((l, i) => `
		<div class="co-line ${l.status === 'done' ? 'done' : ''} ${i === co.idx && l.status !== 'done' ? 'current' : ''}">
			${l.image ? `<img src="${esc(l.image)}" alt="">` : '<span class="ph"></span>'}
			<div>
				<div class="nm">${esc(l.name)}</div>
				<div class="meta">
					<span>${money(l.unit * l.qty)} ${esc(cur)}</span>
					<span class="rem">${esc(t('remaining'))}: ${l.qty - l.bought}</span>
					<span class="got">${esc(t('bought'))}: ${l.bought}</span>
					${l.status === 'error' ? `<span class="err">${esc(t('error'))}</span>` : ''}
				</div>
			</div>
		</div>`).join('');
}

function coShow(html) { $('coBody').innerHTML = html; }
function coLoading(text) { coShow(`<div class="co-state"><div class="spinner big"></div><div class="muted">${esc(text)}</div></div>`); }

// Окно подтверждения со счётом, который прислал сам Steam (сумма и количество — из ClientMicroTxnAuthRequest).
function coAskAuthorize(order, line) {
	coShow(`
		<div class="co-title">COUNTER-STRIKE 2</div>
		<div class="muted">${esc(t('authorize_text'))}</div>
		<table class="co-table">
			<thead><tr><th style="width:70px">${esc(t('col_qty'))}</th><th>${esc(t('col_name'))}</th><th class="num">${esc(t('col_price'))}</th></tr></thead>
			<tbody><tr><td>${order.count}</td><td><span class="co-item">${line.image ? `<img src="${esc(line.image)}" alt="">` : ''}${esc(order.name)}</span></td><td class="num">${money(order.total)} ${esc(order.currency)}</td></tr></tbody>
		</table>
		<div class="co-total"><span class="muted">${esc(t('total'))}</span><b>${money(order.total)} ${esc(order.currency)}</b></div>
		${order.refundable ? `<div class="co-note">${esc(t('refund_note'))}</div>` : ''}
		<div class="co-actions">
			<button class="btn ghost" id="coCancel">${esc(t('cancel'))}</button>
			<button class="btn primary big" id="coAuthorize">${esc(t('authorize'))}</button>
		</div>`);
	$('coAuthorize').focus();
	// Двухшаговое подтверждение: «Оплатить» → мини-окно «спишется N — OK». Только после OK — списание.
	return new Promise(resolve => {
		ui.co.answer = ok => { ui.co.answer = null; resolve(ok); };
		$('coCancel').onclick = () => ui.co.answer && ui.co.answer(false);
		$('coAuthorize').onclick = async () => {
			const r = await miniConfirm({ icon: ICON_WALLET, title: t('pay_confirm_title'), text: t('pay_confirm_text', { total: `${money(order.total)} ${order.currency}` }), ok: t('pay_confirm_btn') });
			if (r.ok && ui.co && ui.co.answer) ui.co.answer(true);
		};
	});
}

function coFinish(kind, text, actions) {
	const btns = actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : 'ghost'}" data-co-act="${i}">${esc(a.label)}</button>`).join('');
	coShow(`<div class="co-state"><div class="big-icon ${kind}">${kind === 'good' ? ICON_OK : ICON_ERR}</div><div class="strong">${esc(text)}</div><div class="modal-actions">${btns}</div></div>`);
	$('coBody').querySelectorAll('[data-co-act]').forEach(b => { b.onclick = () => actions[Number(b.dataset.coAct)].run(); });
}

function closeCheckout() {
	if (!ui.co || ui.co.busy) return;
	const account = ui.co.account;
	ui.co = null;
	$('checkoutModal').classList.add('hidden');
	renderStore();
	if (account === ui.active) { loadState().catch(() => {}); loadStore(); }
}

async function runCheckout() {
	const co = ui.co;
	co.busy = true;
	try {
		for (; co.idx < co.lines.length; co.idx++) {
			const line = co.lines[co.idx];
			if (line.status === 'done') continue;
			line.status = 'current';
			renderCoLines();
			coLoading(t('buy_preparing'));
			let order;
			try { order = await api('/api/store/init', { account: co.account, def: line.def, count: line.qty - line.bought }); }
			catch (e) { return coFail(line, e.message, false); }
			co.currency = order.currency;
			if (order.balance != null) $('coBalance').textContent = `(${walletText({ balance: order.balance, currency: order.currency })})`;
			co.busy = false;
			const ok = await coAskAuthorize(order, line);
			co.busy = true;
			if (!ok) {
				api('/api/store/cancel', { account: co.account }).catch(() => {});
				line.status = 'wait';
				co.busy = false;
				renderCoLines();
				return coFinish('bad', t('checkout_cancelled'), [{ label: t('close'), primary: true, run: closeCheckout }]);
			}
			coLoading(t('paying'));
			try {
				const r = await api('/api/store/confirm', { account: co.account, txnId: order.txnId });
				coLineDone(line);
			} catch (e) { return coFail(line, e.message, order.txnId); }
		}
		co.busy = false;
		renderCoLines();
		const n = co.lines.reduce((s, l) => s + l.bought, 0);
		coFinish('good', t('checkout_done', { n }), [{ label: t('close'), primary: true, run: closeCheckout }]);
	} finally { co.busy = false; }
}

function coLineDone(line) {
	line.bought = line.qty;
	line.status = 'done';
	delete ui.cart[line.def];  // позиция оплачена целиком (Steam списал за всё количество)
	renderCoLines();
}

// Ошибка на позиции. Если заказ уже мог быть оплачен (txnId) — даём «Проверить оплату» (повторная выдача без списания).
function coFail(line, message, txnId) {
	const co = ui.co;
	line.status = 'error';
	co.busy = false;
	renderCoLines();
	const actions = [{ label: t('close'), run: closeCheckout }];
	if (txnId) {
		actions.push({ label: t('checkout_check'), primary: true, run: async () => {
			coLoading(t('paying'));
			try {
				const r = await api('/api/store/finalize', { account: co.account, txnId });
				coLineDone(line); co.idx++; runCheckout();
			} catch (e) { coFail(line, e.message, txnId); }
		} });
	} else {
		if (co.idx + 1 < co.lines.length) actions.push({ label: t('skip'), run: () => { co.idx++; runCheckout(); } });
		actions.push({ label: t('retry'), primary: true, run: () => runCheckout() });
	}
	coFinish('bad', message, actions);
}

async function buyContainer() {
	try {
		if (!ui.store) ui.store = await apiGet('/api/store/catalog');
		const it = storeItem(1201);
		if (!it) throw new Error(t('unavailable'));
		const qty = await askQuantity(it.name, it.price, it.image);
		if (qty) openCheckout([{ def: it.def, name: it.name, image: it.image, unit: it.price, qty }]);
	} catch (e) { toast(e.message, 'bad'); }
}

function askQuantity(name, unit, image) {
	return new Promise(resolve => {
		const c = ui.store ? ui.store.currency : '';
		$('qtyTitle').textContent = name;
		$('qtyUnit').textContent = t('qty_unit', { price: fmt(unit), currency: c });
		$('qtyImg').innerHTML = image ? `<img src="${esc(image.replace(/\/\d+fx\d+f$/, '/256fx256f'))}" alt="">` : '';
		$('qtyImg').classList.toggle('hidden', !image);
		$('qtyInput').value = '1';
		const total = () => { const n = Math.max(1, Math.min(100, parseInt($('qtyInput').value, 10) || 1)); $('qtyTotal').textContent = `${money(n * unit)} ${c}`; };
		total();
		$('qtyInput').oninput = total;
		$('qtyMinus').onclick = () => { $('qtyInput').value = Math.max(1, (parseInt($('qtyInput').value, 10) || 1) - 1); total(); };
		$('qtyPlus').onclick = () => { $('qtyInput').value = Math.min(100, (parseInt($('qtyInput').value, 10) || 1) + 1); total(); };
		$('qtyModal').classList.remove('hidden'); $('qtyInput').focus(); $('qtyInput').select();
		const close = val => { $('qtyModal').classList.add('hidden'); $('qtyOk').onclick = null; $('qtyCancel').onclick = null; resolve(val); };
		$('qtyOk').onclick = () => { const n = parseInt($('qtyInput').value, 10); close(n >= 1 ? Math.min(n, 100) : 0); };
		$('qtyCancel').onclick = () => close(0);
		$('qtyInput').onkeydown = e => { if (e.key === 'Enter') $('qtyOk').click(); if (e.key === 'Escape') $('qtyCancel').click(); };
	});
}

// ============================================================ события
document.querySelectorAll('.login-card .segmented button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
$('loginBtn').addEventListener('click', () => loginFromForm());
$('qrRefresh').addEventListener('click', () => { ui.qr.state = 'idle'; ensureQr(); });
// прокси вписали/поменяли — QR перевыпускается уже через новый прокси (старый, без прокси, отменяется)
let proxyTimer = null;
const proxyChanged = () => {
	clearTimeout(proxyTimer);
	proxyTimer = setTimeout(() => {
		const v = $('proxy').value.trim();
		if (ui.mode !== 'qr' || v === (ui.qr.proxy || '')) return;
		ui.qr.proxy = v; startQr();
	}, 900);
};
$('proxy').addEventListener('input', proxyChanged);
$('proxy').addEventListener('change', proxyChanged);
$('remember').addEventListener('change', () => api('/api/login/remember', { remember: $('remember').checked }).catch(() => {}));
['crPassword', 'maPassword'].forEach(id => $(id).addEventListener('keydown', e => e.key === 'Enter' && loginFromForm()));
$('loginBack').addEventListener('click', () => { ui.addingAccount = false; cancelQr(); renderAccounts(ui.status || { accounts: [], pending: null }); });
$('savedList').addEventListener('click', e => {
	const l = e.target.dataset.login, f = e.target.dataset.forget;
	if (l) {
		const acc = (ui.saved || []).find(a => a.login === l);
		if (acc && !acc.hasToken) { setMode('creds'); $('crLogin').value = l; $('crPassword').focus(); showLoginError(t('relogin_needed')); }
		else login({ mode: 'saved', login: l });
	}
	if (f) miniConfirm({ warn: true, text: t('forget_confirm', { login: f }) }).then(r => { if (r.ok) api('/api/accounts/forget', { login: f }).then(renderSaved); });
});
$('maFileInput').addEventListener('change', e => e.target.files[0] && readMaFile(e.target.files[0]));
const dz = $('dropzone');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); e.dataTransfer.files[0] && readMaFile(e.dataTransfer.files[0]); });
$('cancelLoginBtn').addEventListener('click', () => api('/api/logout', {}).catch(() => {}).then(() => poll(true)));

$('guardSend').addEventListener('click', () => api('/api/guard', { code: $('guardCode').value }).then(() => { $('guardCode').value = ''; poll(true); }).catch(e => toast(e.message, 'bad')));
$('guardCode').addEventListener('keydown', e => e.key === 'Enter' && $('guardSend').click());
$('guardCancel').addEventListener('click', () => api('/api/logout', {}).then(() => poll(true)));

$('accountBar').addEventListener('click', e => {
	const add = e.target.closest('#addAcct');
	const x = e.target.closest('[data-logout]');
	const chip = e.target.closest('[data-acct]');
	if (add) { ui.addingAccount = true; ui.maFile = null; setMode('qr'); ui.qr.state = 'idle'; renderLoginFlow(ui.status && ui.status.pending, true); return; }
	if (x) { const login = x.dataset.logout; api('/api/logout', { account: login }).then(() => { if (ui.active === login) ui.active = null; poll(true); }); return; }
	if (e.target.closest('#acctMore')) { toggleAcctMenu(); return; }
	if (chip && chip.dataset.acct !== ui.active) { ui.active = chip.dataset.acct; ui._freshActive = true; renderAccounts(ui.status); }
});
$('acctMenu').addEventListener('click', e => {
	const pin = e.target.closest('[data-pin]');
	if (pin) {
		const l = pin.dataset.pin, pins = (ui.settings.pinnedAccounts || []).slice();
		const i = pins.indexOf(l);
		if (i >= 0) pins.splice(i, 1); else pins.push(l);
		saveSetting({ pinnedAccounts: pins });
		ui.settings.pinnedAccounts = pins;
		renderAccountBar(ui.acctList || [], ui.status && ui.status.pending);
		return;
	}
	const x = e.target.closest('[data-logout]');
	if (x) { const login = x.dataset.logout; api('/api/logout', { account: login }).then(() => { if (ui.active === login) ui.active = null; poll(true); }); return; }
	const it = e.target.closest('[data-acct]');
	if (it) { toggleAcctMenu(false); if (it.dataset.acct !== ui.active) { ui.active = it.dataset.acct; ui._freshActive = true; renderAccounts(ui.status); } }
});
$('acctSearch').addEventListener('input', renderAcctMenu);
// перетаскивание в списке: новый порядок аккаунтов (закреплённые всё равно остаются первыми)
let acctDrag = null;
$('acctMenuList').addEventListener('dragstart', e => { const it = e.target.closest('.am-item'); if (!it) return; acctDrag = it; it.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
$('acctMenuList').addEventListener('dragover', e => {
	if (!acctDrag) return;
	e.preventDefault();
	const over = e.target.closest('.am-item');
	if (!over || over === acctDrag) return;
	const r = over.getBoundingClientRect();
	over.parentNode.insertBefore(acctDrag, e.clientY < r.top + r.height / 2 ? over : over.nextSibling);
});
$('acctMenuList').addEventListener('dragend', () => {
	if (!acctDrag) return;
	acctDrag.classList.remove('dragging'); acctDrag = null;
	saveAccountOrder([...$('acctMenuList').querySelectorAll('.am-item')].map(x => x.dataset.acct));
});
document.addEventListener('mousedown', e => { if (!$('acctMenu').classList.contains('hidden') && !e.target.closest('#acctMenu, #acctMore')) toggleAcctMenu(false); });

$('sideNav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) switchTab(b.dataset.tab); });
$('guardTopBtn').addEventListener('click', () => switchTab('guard'));
$('navToggle').addEventListener('click', () => { const c = !$('sideNav').classList.contains('collapsed'); $('sideNav').classList.toggle('collapsed', c); saveSetting({ navCollapsed: c }); });
$('headerSupport').addEventListener('click', () => openSupport());
$('casketList').addEventListener('click', e => { const el = e.target.closest('[data-casket]'); if (el) selectCasket(el.dataset.casket); });
$('showFull').addEventListener('change', e => { ui.showFull = e.target.checked; renderCaskets(); });
$('modeSwitch').addEventListener('click', async e => {
	const op = e.target.dataset.op;
	if (!op || op === ui.op) return;
	ui.op = op; ui.picks = {}; renderPanel();
	if (op === 'take') { await loadContents(ui.casketId); renderItems(); }
});
$('search').addEventListener('input', e => { ui.search = e.target.value; renderItems(); });
$('onlyCases').addEventListener('click', () => { ui.onlyCases = !ui.onlyCases; $('onlyCases').classList.toggle('on', ui.onlyCases); renderItems(); });
$('selectAll').addEventListener('click', () => { for (const i of visibleItems()) if (i.available) ui.picks[i.name] = i.available; renderItems(); });
$('clearSel').addEventListener('click', () => { ui.picks = {}; renderItems(); });
$('itemList').addEventListener('click', e => {
	const st = e.target.closest('.stepper'); const step = e.target.dataset.step;
	if (!st || !step) return;
	const max = Number(st.dataset.max), name = st.dataset.name, cur = ui.picks[name] || 0;
	setPick(name, step === 'all' ? (cur === max ? 0 : max) : cur + Number(step), max);
	updateAction();
});
$('itemList').addEventListener('input', e => { const st = e.target.closest('.stepper'); if (!st) return; setPick(st.dataset.name, e.target.value, Number(st.dataset.max)); updateAction(); });
$('actionBtn').addEventListener('click', runAction);
$('jobStop').addEventListener('click', () => apiPost('/api/cancel', {}).then(() => poll(true)));
$('jobClose').addEventListener('click', () => { const a = activeAccount(); if (a && a.job) { ui.jobDismissed = a.job.started; renderJob(a.job); } });

$('renameBtn').addEventListener('click', () => { $('renameRow').classList.toggle('hidden'); $('renameInput').value = (currentCasket() || {}).name || ''; $('renameInput').focus(); });
$('renameCancel').addEventListener('click', () => $('renameRow').classList.add('hidden'));
$('renameInput').addEventListener('keydown', e => e.key === 'Enter' && $('renameSave').click());
$('renameSave').addEventListener('click', async () => {
	const name = $('renameInput').value.trim();
	if (!name) return;
	$('renameSave').disabled = true;
	try {
		await apiPost('/api/name', { casketId: ui.casketId, name });
		toast(t('named', { name }), 'good');
		$('renameRow').classList.add('hidden');
		ui.casketId = null;
		await loadState();
		const renamed = ui.state.caskets.find(c => c.name === name);
		if (renamed) selectCasket(renamed.id);
	} catch (e) { toast(e.message, 'bad'); }
	$('renameSave').disabled = false;
});

$('refreshBtn').addEventListener('click', async () => {
	$('refreshBtn').disabled = true;
	ui.contents = {}; ui.store = null;
	await loadState().catch(e => toast(e.message, 'bad'));
	if (ui.tab === 'store') await loadStore();
	if (ui.op === 'take' && ui.casketId) { await loadContents(ui.casketId, true); renderItems(); }
	$('refreshBtn').disabled = false;
});
// Экспорт (Обзор, Ящики, Настройки): JSON + CSV инвентаря и всех ящиков текущего аккаунта.
document.addEventListener('click', async e => {
	const b = e.target.closest('[data-export]');
	if (!b || b.disabled) return;
	document.querySelectorAll('[data-export]').forEach(x => { x.disabled = true; });
	try {
		const r = await apiPost('/api/export', {});
		toast(t('saved_json_csv'), 'good', window.desktop ? { label: t('open_folder'), run: () => window.desktop.openPath(r.folder) } : null);
	} catch (err) { toast(err.message, 'bad'); }
	document.querySelectorAll('[data-export]').forEach(x => { x.disabled = false; });
});
$('storeSearch').addEventListener('input', renderStore);
$('storeGrid').addEventListener('click', e => {
	const fav = e.target.closest('[data-fav]');
	if (fav) return toggleFavorite(Number(fav.dataset.fav));
	const step = e.target.closest('[data-step]');
	if (step) { const def = Number(step.closest('[data-q]').dataset.q); setCartQty(def, (ui.cart[def] || 0) + Number(step.dataset.step)); }
});
$('storeGrid').addEventListener('input', e => { if (e.target.dataset.qin) setCartQty(Number(e.target.dataset.qin), e.target.value); });
$('storeGrid').addEventListener('focusin', e => { if (e.target.dataset.qin) e.target.select(); });
$('cartReset').addEventListener('click', () => { ui.cart = {}; renderStore(); });
$('cartBtn').addEventListener('click', () => { const lines = cartLines(); if (lines.length) openCheckout(lines); });
$('buyBtn').addEventListener('click', buyContainer);
$('emptyBuy').addEventListener('click', buyContainer);
$('settingsBtn').addEventListener('click', openSettings);
$('settingsClose').addEventListener('click', () => $('settingsModal').classList.add('hidden'));
$('confirmList').addEventListener('change', async e => { const k = e.target.dataset.cf; if (k) { await setConfirm(k, e.target.checked); renderConfirms(); } });
// Цены: после изменения настроек пересчитываем стоимость (на открытом «Обзоре» — сразу)
async function savePriceSetting(patch) {
	await saveSetting(patch);
	$('priceOpts').classList.toggle('hidden', ui.settings.priceEnabled === false);
	ui.value = null; ui.contents = {}; ui.pnl = null;
	if (ui.tab === 'pnl') loadPnl();
	if (ui.tab === 'overview') loadValue();
	if (ui.state) loadState().catch(() => {});
}
$('priceToggle').addEventListener('change', e => savePriceSetting({ priceEnabled: e.target.checked }));
$('streamerToggle').addEventListener('change', e => toggleStreamer(e.target.checked));
$('streamerMoney').addEventListener('change', async e => { await saveSetting({ streamerMoney: e.target.checked }); applyStreamer(); });
$('streamerBadge').addEventListener('click', () => toggleStreamer(false));
// Ctrl+Shift+H — режим стримера (работает в любом окне приложения)
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyH') { e.preventDefault(); toggleStreamer(); } });
$('priceSource').addEventListener('change', e => savePriceSetting({ priceSource: e.target.value }));
$('priceCurrency').addEventListener('change', e => savePriceSetting({ priceCurrency: e.target.value }));
$('priceFeeToggle').addEventListener('change', e => savePriceSetting({ priceAfterFee: e.target.checked }));
document.addEventListener('keydown', e => {
	if (e.key !== 'Escape') return;
	if (ui.tourStep != null) return endTour();
	if (ui.miniAnswer) return ui.miniAnswer(false);
	if (!$('supportModal').classList.contains('hidden')) return $('supportModal').classList.add('hidden');
	if (!$('acctMenu').classList.contains('hidden')) return toggleAcctMenu(false);
	if (!$('ivModal').classList.contains('hidden')) return $('ivModal').classList.add('hidden');
	if (!$('settingsModal').classList.contains('hidden')) return $('settingsModal').classList.add('hidden');
	if (!$('tdModal').classList.contains('hidden')) return closeTransferDone();
	if (!$('pnlModal').classList.contains('hidden')) return $('pnlModal').classList.add('hidden');
	if (ui.co && ui.co.answer) return ui.co.answer(false);
	if (ui.co && !ui.co.busy) closeCheckout();
});

// ============================================================ обзор (аналитика)
const RARITY_COLORS = { 1: '#b0c3d9', 2: '#5e98d9', 3: '#4b69ff', 4: '#8847ff', 5: '#d32ce6', 6: '#eb4b4b', 7: '#e4ae39' };
const RARITY_NAMES = { 1: 'Consumer', 2: 'Industrial', 3: 'Mil-Spec', 4: 'Restricted', 5: 'Classified', 6: 'Covert', 7: 'Contraband' };

async function loadOverview() {
	try {
		if ((ui.ovScope || 'one') === 'all') ui.overviewAll = await api('/api/overview/all');
		else ui.overview = await apiGet('/api/overview');
		renderOverview();
		loadStorageTop();
		loadValue();
	} catch (e) { toast(e.message, 'bad'); }
}

function ovBars(elId, rows) {
	const max = Math.max(1, ...rows.map(r => r.count));
	$(elId).innerHTML = rows.length ? rows.map(r => `
		<div class="ov-bar">
			<span class="ov-bar-label">${r.color ? `<span class="ov-chip" style="background:${r.color}"></span>` : ''}${esc(r.label)}</span>
			<span class="ov-bar-track"><i style="width:${(r.count / max * 100).toFixed(1)}%${r.color ? `;background:${r.color}` : ''}"></i></span>
			<span class="ov-bar-n">${fmt(r.count)}</span>
		</div>`).join('') : '<p class="muted small" style="padding:8px">—</p>';
}

const ovTile = (label, value, sub = '', meter = null, cls = '') => `<div class="ov-tile ${cls}">
	<div class="ov-tile-h"><span>${esc(label)}</span>${meter ? `<span class="muted small">${esc(meter.text)}</span>` : ''}</div>
	<div class="ov-tile-v">${value}</div>
	${sub ? `<div class="ov-tile-s muted small">${sub}</div>` : ''}
	${meter ? `<div class="meter"><i class="${meter.pct >= 98 ? 'full' : meter.pct >= 85 ? 'warn' : ''}" style="width:${meter.pct}%"></i></div>` : ''}
</div>`;

function walletSum(list) {
	const by = {};
	for (const o of list) if (o.wallet) by[o.wallet.currency] = (by[o.wallet.currency] || 0) + o.wallet.balance;
	if (streamer() && Object.keys(by).length) return '•••';
	return Object.entries(by).map(([c, v]) => `${money(v)} ${esc(c)}`).join('<br>') || '—';
}

function renderOverview() {
	const scope = ui.ovScope || 'one';
	document.querySelectorAll('#ovScope button').forEach(b => b.classList.toggle('active', b.dataset.scope === scope));
	$('ovAllCnt').textContent = ((ui.status && ui.status.accounts) || []).length;
	$('ovAccounts').classList.toggle('hidden', scope !== 'all');
	$('ovOneExtra').classList.toggle('hidden', scope !== 'one');
	const list = scope === 'all' ? (ui.overviewAll || []).filter(o => o.inventoryLimit) : (ui.overview ? [ui.overview] : []);
	if (!list.length) { $('ovTiles').innerHTML = ''; return; }
	const sum = k => list.reduce((n, o) => n + (o[k] || 0), 0);
	const inv = sum('inventoryCount'), lim = sum('inventoryLimit'), st = sum('stored'), cap = sum('casketCapacity');
	$('ovTiles').innerHTML = [
		ovTile(t('ov_total'), fmt(inv + st), `${fmt(inv)} ${t('in_inventory')} · ${fmt(st)} ${t('in_casket')}`),
		ovTile(t('inventory'), fmt(inv), '', { pct: lim ? inv / lim * 100 : 0, text: `${fmt(inv)} / ${fmt(lim)}` }),
		ovTile(t('ov_storage'), fmt(st), t('ov_caskets', { n: sum('casketCount') }), { pct: cap ? st / cap * 100 : 0, text: `${fmt(st)} / ${fmt(cap)}` }),
		ovTile(t('wallet_label'), walletSum(list), scope === 'all' ? t('ov_accounts_n', { n: list.length }) : '', null, 'good'),
	].join('');
	const merge = key => { const out = {}; for (const o of list) for (const [k, v] of Object.entries(o[key] || {})) out[k] = (out[k] || 0) + v; return out; };
	const byRarity = merge('byRarity'), byKind = merge('byKind');
	ovBars('ovRarity', Object.keys(byRarity).map(Number).sort((a, b) => b - a).map(r => ({ label: RARITY_NAMES[r] || ('#' + r), count: byRarity[r], color: RARITY_COLORS[r] })));
	ovBars('ovKind', Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, c]) => ({ label: t('kind_' + k), count: c })));
	if (scope === 'one') {
		const o = list[0];
		$('ovTop').innerHTML = (o.top || []).map(i => `<div class="ov-top-row"><div class="thumb">${i.image ? `<img src="${esc(i.image)}" alt="">` : ''}</div><span class="grow">${esc(i.name)}</span><b>×${fmt(i.count)}</b></div>`).join('') || '<p class="muted small">—</p>';
		const cs = o.caskets || [];
		$('ovCaskets').innerHTML = cs.length ? cs.map(c => `<div class="ov-bar"><span class="ov-bar-label">${esc(c.name || '—')}</span>
			<span class="ov-bar-track"><i style="width:${(c.count / c.capacity * 100).toFixed(1)}%"></i></span><span class="ov-bar-n">${fmt(c.count)}</span></div>`).join('')
			: `<p class="muted small">${esc(t('no_caskets_title'))}</p>`;
	} else {
		const rows = (ui.overviewAll || []);
		$('ovAccounts').innerHTML = `<div class="section-title" style="margin-bottom:10px">${esc(t('ov_accounts'))}</div>
			<table class="mt"><thead><tr><th>${esc(t('ov_account'))}</th><th>${esc(t('inventory'))}</th><th class="num">${esc(t('ov_storage'))}</th><th class="num">${esc(t('ov_total'))}</th><th class="num">${esc(t('wallet_label'))}</th></tr></thead><tbody>
			${rows.map(o => o.inventoryLimit ? `<tr><td><div class="it">${avatarHtml(o, 'acct-av')}<div><div>${esc(accName(o))}</div>${accSub(o) ? `<div class="sub">${esc(accSub(o))}</div>` : ''}</div></div></td>
				<td><div class="ov-mini">${fmt(o.inventoryCount)} / ${fmt(o.inventoryLimit)}<div class="meter"><i style="width:${o.inventoryCount / o.inventoryLimit * 100}%"></i></div></div></td>
				<td class="num">${fmt(o.stored)} <span class="sub">· ${fmt(o.casketCount)} ${esc(t('caskets').toLowerCase())}</span></td><td class="num">${fmt(o.inventoryCount + o.stored)}</td>
				<td class="num good-text">${o.wallet ? esc(walletText(o.wallet)) : '—'}</td></tr>`
				: `<tr><td>${esc(loginName(o.login))}</td><td colspan="4" class="muted">${esc(o.error || t('offline'))}</td></tr>`).join('')}
			</tbody></table>`;
	}
}

// Топ предметов в ящиках — грузится отдельно (GC читает содержимое всех ящиков, это несколько секунд).
async function loadStorageTop() {
	const all = (ui.ovScope || 'one') === 'all';
	$('ovStorageTop').innerHTML = `<div class="muted small"><span class="spinner tiny"></span> ${esc(t('ov_storage_loading'))}</div>`;
	$('ovStorageTotal').textContent = '';
	try {
		const r = all ? await api('/api/overview/storage?all=1') : await apiGet('/api/overview/storage');
		$('ovStorageTotal').textContent = fmt(r.total);
		$('ovStorageTop').innerHTML = r.top.map(i => `<div class="ov-top-row"><div class="thumb">${i.image ? `<img src="${esc(i.image)}" alt="">` : ''}</div><span class="grow">${esc(i.name)}</span><b>×${fmt(i.count)}</b></div>`).join('')
			|| `<p class="muted small">${esc(t('no_caskets_title'))}</p>`;
	} catch (e) { $('ovStorageTop').innerHTML = `<p class="muted small">${esc(e.message)}</p>`; }
}

$('ovScope').addEventListener('click', e => { const b = e.target.closest('[data-scope]'); if (b) { ui.ovScope = b.dataset.scope; ui.value = null; renderOverview(); loadOverview(); } });
$('ovRefresh').addEventListener('click', loadOverview);

// ============================================================ стоимость (цены) и история портфеля
const PRICE_CURRENCIES = ['USD', 'EUR', 'GBP', 'RUB', 'UAH', 'KZT', 'PLN', 'BRL', 'TRY', 'CNY', 'JPY', 'KRW', 'INR', 'CAD', 'AUD', 'NZD', 'CHF',
	'SEK', 'NOK', 'DKK', 'CZK', 'HUF', 'RON', 'BGN', 'MXN', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'CRC', 'ZAR', 'ILS', 'AED', 'SAR', 'QAR', 'KWD',
	'SGD', 'HKD', 'TWD', 'THB', 'VND', 'IDR', 'MYR', 'PHP'];
function cur(v, c, signed = false) {
	if (v == null) return '—';
	try {
		return new Intl.NumberFormat(LANG === 'zh' ? 'zh-CN' : LANG, { style: 'currency', currency: c, signDisplay: signed ? 'exceptZero' : 'auto',
			minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
	} catch (e) { return `${signed && v > 0 ? '+' : ''}${money(v)} ${c}`; }
}
const pctFmt = x => (x == null ? '' : `${x > 0 ? '+' : ''}${(x * 100).toFixed(Math.abs(x) < 0.1 ? 1 : 0)}%`);
const signCls = x => (x > 0 ? 'up' : x < 0 ? 'down' : '');
const shortDate = d => new Date(`${d}T12:00:00`).toLocaleDateString(LANG === 'zh' ? 'zh-CN' : LANG, { day: 'numeric', month: 'short' });

async function loadValue() {
	const all = (ui.ovScope || 'one') === 'all';
	const off = ui.settings.priceEnabled === false;
	$('pvOff').classList.toggle('hidden', !off);
	$('pvBox').classList.toggle('hidden', off);
	$('pvPeriod').classList.toggle('hidden', off);
	if (off) return;
	const key = all ? '*' : ui.active;
	if (!ui.value || ui.valueKey !== key) {
		// пока считаем (первый раз читаются все ящики — несколько секунд) — заметная анимация вместо пустоты
		const skel = n => Array.from({ length: n }, () => '<div class="skeleton pv-row-skel"></div>').join('');
		$('pvKpi').innerHTML = Array.from({ length: 4 }, () => '<div class="skeleton pv-kpi-skel"></div>').join('');
		$('pvFoot').innerHTML = ''; $('pvLegend').innerHTML = '';
		$('pvChart').innerHTML = '<div class="skeleton pv-chart-skel"></div>';
		for (const id of ['pvUp', 'pvDown', 'pvTop']) $(id).innerHTML = skel(5);
		for (const id of ['pvBars', 'pvKinds']) $(id).innerHTML = '<div class="skeleton pv-donut-skel"></div>';
	} else $('pvBox').classList.add('pv-refreshing');
	const url = all ? '/api/overview/value?all=1' : '/api/overview/value';
	const same = () => key === ((ui.ovScope || 'one') === 'all' ? '*' : ui.active);
	const get = q => (all ? api(url + q.replace('?', '&')) : apiGet(url + q));
	try {
		// 1) последний расчёт — сразу (из памяти/диска), 2) свежий — в фоне
		if (!ui.value || ui.valueKey !== key) {
			const c = await get('?fast=1');
			if (!same()) return;
			if (c.disabled) { $('pvOff').classList.remove('hidden'); $('pvBox').classList.add('hidden'); return; }
			if (c.cached) { ui.value = c; ui.valueKey = key; renderValue(); $('pvBox').classList.add('pv-refreshing'); }
			else { ui.value = c; ui.valueKey = key; renderValue(); $('pvBox').classList.remove('pv-refreshing'); return; }
		}
		const r = await get('');
		if (!same()) return;
		if (r.disabled) { $('pvOff').classList.remove('hidden'); $('pvBox').classList.add('hidden'); return; }
		ui.value = r; ui.valueKey = key;
		renderValue();
	} catch (e) {
		// одна повторная попытка (например, Steam на секунду отвалился), потом — ошибка вместо пустых заготовок
		if (same() && !loadValue.retried) { loadValue.retried = true; setTimeout(() => { loadValue().finally(() => { loadValue.retried = false; }); }, 1500); return; }
		if (!ui.value || ui.valueKey !== key) $('pvKpi').innerHTML = `<p class="muted small">${esc(e.message)}</p>`; else toast(e.message, 'bad');
	}
	$('pvBox').classList.remove('pv-refreshing');
}

function pvRows(list, c, mode) {
	return list.length ? list.map(i => `<div class="ov-top-row">
		<div class="thumb">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : ''}</div>
		<div class="grow" title="${esc(i.name)}">${esc(i.name)}</div>
		${mode === 'mover' ? `<span class="muted small">${cur(i.was, c)} → ${cur(i.now, c)}${i.count > 1 ? ` · ×${fmt(i.count)}` : ''}</span>
			<b class="${signCls(i.delta)}">${cur(i.delta, c, true)}</b>`
		: `<span class="muted small">×${fmt(i.count)}</span>${mode === 'topbar' ? `<span class="pv-minibar"><i style="width:${Math.max(2, i.share * 100).toFixed(1)}%"></i></span>` : ''}<b>${cur(i.value, c)}</b>`}
	</div>`).join('') : `<p class="muted small">—</p>`;
}

// Линейный график стоимости (SVG без библиотек); invested — пунктир «вложено» (по записям «Портфеля»).
function pvChart(points, c, invested) {
	if (points.length < 2) return `<div class="pv-chart-empty muted small">${esc(t('pv_history_empty'))}</div>`;
	const W = 1000, H = 210, pad = 8;
	const vals = points.map(p => p.value);
	// «вложено» рисуем, только если оно в одном масштабе со стоимостью — иначе линия стоимости станет плоской
	let inv = invested && invested.length === points.length ? invested.map(p => p.value) : null;
	const vSpan = Math.max(...vals) - Math.min(...vals);
	if (inv && (Math.min(...inv) < Math.min(...vals) - Math.max(vSpan, Math.max(...vals) * 0.05) * 1.5 || Math.max(...inv) > Math.max(...vals) + Math.max(vSpan, Math.max(...vals) * 0.05) * 1.5)) inv = null;
	const all = inv ? vals.concat(inv) : vals;
	let lo = Math.min(...all), hi = Math.max(...all);
	if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
	const x = i => pad + i / (points.length - 1) * (W - 2 * pad);
	const y = v => pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad);
	const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
	const line = path(vals);
	const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
	const rising = vals[vals.length - 1] >= vals[0];
	const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${points.length > 40 ? 0 : 3}"><title>${esc(shortDate(p.d))}: ${esc(cur(p.value, c))}${inv ? ` · ${esc(t('pv_invested'))}: ${esc(cur(inv[i], c))}` : ''}</title></circle>`).join('');
	const ticks = [0, 0.25, 0.5, 0.75, 1].map(k => Math.round(k * (points.length - 1))).filter((v, i, a) => a.indexOf(v) === i);
	return `<div class="pv-plot"><svg class="pv-svg ${rising ? 'up' : 'down'}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
		<defs><linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
		<path d="${area}" fill="url(#pvGrad)" stroke="none"/>
		${inv ? `<path d="${path(inv)}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="6 6" vector-effect="non-scaling-stroke"/>` : ''}
		<path d="${line}" fill="none" stroke="currentColor" stroke-width="2.2" vector-effect="non-scaling-stroke"/>${dots}</svg>
		<span class="pv-y hi">${esc(cur(hi, c))}</span><span class="pv-y lo">${esc(cur(lo, c))}</span></div>
		<div class="pv-axis muted small">${ticks.map(i => `<span>${esc(shortDate(points[i].d))}</span>`).join('')}</div>`;
}

// Кольцевая диаграмма + легенда
const PV_COLORS = ['#4fb3ff', '#9b6bff', '#f2994a', '#2ec16b', '#e05d7c', '#e6c229', '#8a93a6'];
const KIND_COLORS = { container: '#4fb3ff', skin: '#9b6bff', sticker: '#f2994a', knifeglove: '#e05d7c', graffiti: '#2ec16b', other: '#8a93a6' };
function pvDonut(parts, c, center) {
	parts = parts.filter(p => p.value > 0);
	const tot = parts.reduce((n, p) => n + p.value, 0);
	if (!tot) return '<p class="muted small">—</p>';
	// мелкие доли — в «прочее», чтобы легенда помещалась
	if (parts.length > 6) { const rest = parts.slice(5).reduce((n, p) => n + p.value, 0); parts = parts.slice(0, 5).concat([{ label: t('kind_other'), value: rest, color: '#8a93a6' }]); }
	const S = 132, r = 52, cx = S / 2;
	let a = -Math.PI / 2;
	const arcs = parts.map((p, i) => {
		const frac = p.value / tot;
		if (frac >= 0.9999) return `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${p.color || PV_COLORS[i % 7]}" stroke-width="18"/>`;
		const b = a + frac * Math.PI * 2;
		const d = `M${(cx + r * Math.cos(a)).toFixed(2)},${(cx + r * Math.sin(a)).toFixed(2)} A${r},${r} 0 ${b - a > Math.PI ? 1 : 0} 1 ${(cx + r * Math.cos(b)).toFixed(2)},${(cx + r * Math.sin(b)).toFixed(2)}`;
		a = b;
		return `<path d="${d}" fill="none" stroke="${p.color || PV_COLORS[i % 7]}" stroke-width="18"><title>${esc(p.label)}: ${esc(cur(p.value, c))}</title></path>`;
	}).join('');
	return `<div class="pv-donut"><svg viewBox="0 0 ${S} ${S}">${arcs}<text x="${cx}" y="${cx + 5}" text-anchor="middle" style="font-size:${Math.min(17, Math.floor(132 / Math.max(1, String(center).length)))}px">${esc(center)}</text></svg>
		<div class="pv-legend-list">${parts.map((p, i) => `<div><i style="background:${p.color || PV_COLORS[i % 7]}"></i><span class="grow" title="${esc(p.label)}">${esc(p.label)}</span><b>${esc(cur(p.value, c))}</b><span class="muted small">${Math.round(p.value / tot * 100)}%</span></div>`).join('')}</div></div>`;
}
const compactMoney = (v, c) => { try { return new Intl.NumberFormat(LANG === 'zh' ? 'zh-CN' : LANG, { style: 'currency', currency: c, notation: 'compact', maximumFractionDigits: 1 }).format(v); } catch (e) { return money(v); } };

function renderValue() {
	const r = ui.value;
	if (!r) return;
	const c = r.currency;
	const period = ui.pvPeriod || 'd30';
	document.querySelectorAll('#pvPeriod button').forEach(b => b.classList.toggle('active', b.dataset.p === period));
	const ch = r.change && r.change[period];
	const d1 = r.change && r.change.d1;
	const delta = (x, sub) => x ? `<span class="${signCls(x.value)}">${esc(cur(x.value, c, true))}</span>` : '<span class="muted">—</span>';
	const periodName = t('pv_' + period);
	$('pvKpi').innerHTML = [
		ovTile(t('pv_title'), esc(cur(r.total, c)), esc(`${t('in_inventory')} ${cur(r.inventory, c)} · ${t('in_casket')} ${cur(r.storage, c)}`), null, 'pv-kpi-main'),
		ovTile(t('pv_kpi_d1'), delta(d1), d1 ? esc(pctFmt(d1.pct)) : esc(t('pv_kpi_wait'))),
		ovTile(t('pv_kpi_period', { p: periodName.toLowerCase() }), delta(ch), ch ? esc(`${pctFmt(ch.pct)} · ${t('pv_price_effect')} ${cur(ch.price, c, true)}`) : esc(r.since ? t('pv_since', { d: shortDate(r.since) }) : t('pv_kpi_wait'))),
		ovTile(t('pv_kpi_pnl'), r.pnl ? `<span class="${signCls(r.pnl.total)}">${esc(cur(r.pnl.total, c, true))}</span>` : '<span class="muted">—</span>',
			r.pnl ? esc(r.pnl.roi != null ? `ROI ${pctFmt(r.pnl.roi)}` : '') : `<a href="#" class="pv-link" data-goto="pnl">${esc(t('pv_kpi_pnl_setup'))}</a>`),
	].join('');
	const days = { d1: 2, d7: 8, d30: 31 }[period];
	const cut = days ? new Date(Date.now() - days * 86400e3).toLocaleDateString('sv') : '';
	const idx = (r.series || []).map((p, i) => [p, i]).filter(([p]) => p.d >= cut).map(([, i]) => i);
	const pts = idx.map(i => r.series[i]);
	const inv = r.invested ? idx.map(i => r.invested[i]) : null;
	$('pvChart').innerHTML = pvChart(pts, c, inv);
	const lastInv = inv && inv.length ? inv[inv.length - 1].value : null;
	const invOnChart = Boolean($('pvChart').querySelector('path[stroke-dasharray]'));
	$('pvLegend').innerHTML = `<i class="lg-line"></i>${esc(t('pv_title').toLowerCase())}${lastInv != null ? ` · <i class="lg-dash ${invOnChart ? '' : 'hidden'}"></i>${esc(t('pv_invested'))}: ${esc(cur(lastInv, c))}` : ''}`;
	const src = t('price_src_' + r.source) + (r.afterFee ? ` · ${t('price_fee').toLowerCase()}` : '');
	const foot = [`${src} · ${t('pv_updated', { t: new Date(r.ts).toLocaleString(LANG === 'zh' ? 'zh-CN' : LANG, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}`];
	if (r.unpriced) foot.push(t('pv_unpriced', { n: fmt(r.unpriced) }));
	if (r.unreadCaskets) foot.push(t('pv_unread', { n: r.unreadCaskets }));
	if (r.cached) foot.push(t('pv_cached', { t: new Date(r.cachedAt).toLocaleString(LANG === 'zh' ? 'zh-CN' : LANG, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }));
	$('pvFoot').textContent = foot.join(' · ');
	$('pvSource').value = r.source;
	$('pvUp').innerHTML = ch ? pvRows(ch.up, c, 'mover') : `<p class="muted small">${esc(t('pv_movers_wait'))}</p>`;
	$('pvDown').innerHTML = ch ? pvRows(ch.down, c, 'mover') : `<p class="muted small">${esc(t('pv_movers_wait'))}</p>`;
	const top = (r.top || []).slice(0, 7);
	const topMax = Math.max(1e-9, ...top.map(x => x.value));
	$('pvTop').innerHTML = pvRows(top.map(x => ({ ...x, share: x.value / topMax })), c, 'topbar');
	$('pvKinds').innerHTML = pvDonut(Object.entries(r.kinds || {}).map(([k, v]) => ({ label: t('kind_' + k), value: v, color: KIND_COLORS[k] })).sort((a, b) => b.value - a.value), c, compactMoney(r.total, c));
	if (r.caskets && r.caskets.length) {
		$('pvBarsTitle').textContent = t('pv_by_casket');
		const parts = [{ label: t('inventory'), value: r.inventory }, ...r.caskets.map(x => ({ label: x.name || '—', value: x.value || 0 }))].sort((a, b) => b.value - a.value);
		$('pvBars').innerHTML = pvDonut(parts, c, String(r.caskets.length));
	} else {
		$('pvBarsTitle').textContent = t('pv_by_account');
		$('pvBars').innerHTML = pvDonut((r.accounts || []).map(a => ({ label: accName(a), value: a.total })).sort((a, b) => b.value - a.value), c, String((r.accounts || []).length));
	}
}

$('pvSource').addEventListener('change', e => savePriceSetting({ priceSource: e.target.value }));
$('pvPeriod').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) { ui.pvPeriod = b.dataset.p; renderValue(); } });
$('pvKpi').addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) { e.preventDefault(); switchTab(g.dataset.goto); } });
$('pvEnable').addEventListener('click', () => savePriceSetting({ priceEnabled: true }));

// ============================================================ выпадающий поиск предмета (вместо системного datalist)
// source(q) -> [{ name, image, sub }] (или Promise). Стрелки, Enter, Esc, клик мышью.
function combo(input, { source, onPick }) {
	const list = document.createElement('div');
	list.className = 'combo-list hidden';
	input.parentElement.appendChild(list);
	let items = [], idx = -1, seq = 0, timer = null;
	const hide = () => list.classList.add('hidden');
	const render = () => {
		list.innerHTML = items.length ? items.map((x, i) => `<div class="combo-item ${i === idx ? 'sel' : ''}" data-i="${i}">
			<div class="combo-img">${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy">` : ''}</div>
			<div class="combo-text"><div class="combo-name">${esc(x.name)}</div>${x.sub ? `<div class="combo-sub">${esc(x.sub)}</div>` : ''}</div></div>`).join('')
			: `<div class="combo-empty">${esc(t(input.value.trim().length < 2 ? 'combo_type' : 'nothing_found'))}</div>`;
		list.classList.remove('hidden');
		const sel = list.querySelector('.sel'); if (sel) sel.scrollIntoView({ block: 'nearest' });
	};
	const update = async () => {
		const my = ++seq;
		const r = await Promise.resolve(source(input.value.trim())).catch(() => []);
		if (my !== seq || document.activeElement !== input) return;
		items = r || []; idx = items.length ? 0 : -1; render();
	};
	const pick = x => { input.value = x.name; hide(); if (onPick) onPick(x); };
	input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(update, 140); });
	input.addEventListener('focus', update);
	input.addEventListener('blur', () => setTimeout(hide, 150));
	input.addEventListener('keydown', e => {
		if (list.classList.contains('hidden')) return;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; render(); } }
		else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); pick(items[idx]); }
		else if (e.key === 'Escape') { e.stopPropagation(); hide(); }
	});
	list.addEventListener('mousedown', e => { const el = e.target.closest('[data-i]'); if (el) { e.preventDefault(); pick(items[Number(el.dataset.i)]); } });
	return { hide };
}

// ============================================================ портфель: прибыль и убыток по ценам покупки
async function loadPnl() {
	const off = ui.settings.priceEnabled === false;
	$('pnlOff').classList.toggle('hidden', !off);
	if (off) { $('pnlTiles').innerHTML = ''; $('pnlEmpty').classList.add('hidden'); return; }
	const all = ui.pnlScope === 'all';
	document.querySelectorAll('#pnlScope button').forEach(b => b.classList.toggle('active', b.dataset.scope === (all ? 'all' : 'one')));
	$('pnlImport').classList.toggle('hidden', all);
	if (!ui.pnl) {
		$('pnlTiles').innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton pv-kpi-skel"></div>').join('');
		$('pnlTable').innerHTML = ''; $('pnlRecords').innerHTML = '';
	}
	try {
		const q = all ? '?all=1' : '';
		const [r, rec] = await Promise.all([all ? api('/api/pnl?all=1') : apiGet('/api/pnl'), all ? api('/api/pnl/records' + q) : apiGet('/api/pnl/records')]);
		if (r.disabled) { $('pnlOff').classList.remove('hidden'); return; }
		ui.pnl = r; ui.pnlRecs = rec;
		renderPnl();
		if (!all && !ui.importTimer) pollImport();
	} catch (e) { $('pnlTiles').innerHTML = `<p class="muted small">${esc(e.message)}</p>`; }
}

// Сортировка позиций по клику на заголовок: второй клик — обратный порядок. Пустые значения («—») всегда внизу.
ui.pnlSort = (() => { try { return JSON.parse(localStorage.getItem('pnlSort')) || { key: 'value', dir: -1 }; } catch (e) { return { key: 'value', dir: -1 }; } })();
const PSORT = {
	name: p => p.name, covered: p => p.covered, avg: p => p.avg, unit: p => p.unit,
	value: p => (p.covered ? p.value : null), pnl: p => p.pnl, realized: p => (p.sold ? p.realized : null),
};
function sortPositions(list) {
	const { key, dir } = ui.pnlSort, get = PSORT[key] || PSORT.value;
	return list.slice().sort((a, b) => {
		const x = get(a), y = get(b);
		if (x == null || y == null) return (x == null) - (y == null);
		return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir;
	});
}
$('pnlTable').addEventListener('click', e => {
	const h = e.target.closest('[data-psort]'); if (!h) return;
	const key = h.dataset.psort;
	ui.pnlSort = ui.pnlSort.key === key ? { key, dir: -ui.pnlSort.dir } : { key, dir: key === 'name' ? 1 : -1 };
	try { localStorage.setItem('pnlSort', JSON.stringify(ui.pnlSort)); } catch (err) { /* нет хранилища */ }
	renderPnl();
});

function renderPnl() {
	const r = ui.pnl;
	if (!r) return;
	const c = r.currency;
	const hasData = r.records > 0;
	$('pnlEmpty').classList.toggle('hidden', hasData);
	$('pnlFill').classList.toggle('hidden', !r.uncoveredQty);
	$('pnlPosCard').classList.toggle('hidden', !hasData);
	const total = (r.unrealized || 0) + (r.realized || 0);
	$('pnlTiles').innerHTML = !hasData ? '' : [
		ovTile(t('pnl_invested'), esc(cur(r.invested, c)), esc(t('pnl_invested_sub'))),
		ovTile(t('pnl_value'), esc(cur(r.value, c)), esc(t(r.afterFee ? 'pnl_value_sub_fee' : 'pnl_value_sub'))),
		ovTile(t('pnl_unrealized'), `<span class="${signCls(r.unrealized)}">${esc(cur(r.unrealized, c, true))}</span>`, esc(r.roi != null ? `ROI ${pctFmt(r.roi)}` : '—')),
		ovTile(t('pnl_realized'), `<span class="${signCls(r.realized)}">${esc(cur(r.realized, c, true))}</span>`, esc(t('pnl_realized_sub'))),
		ovTile(t('pnl_total'), `<span class="${signCls(total)}">${esc(cur(total, c, true))}</span>`, esc(t('pnl_total_sub'))),
		ovTile(t('pnl_uncovered'), fmt(r.uncoveredQty), esc(r.uncoveredValue ? t('pnl_uncovered_sub', { v: cur(r.uncoveredValue, c) }) : t('pnl_uncovered_sub0'))),
	].join('');
	const q = ($('pnlSearch').value || '').toLowerCase();
	const rows = sortPositions(r.positions.filter(p => !q || p.name.toLowerCase().includes(q)));
	const th = (key, label, num = true) => {
		const on = ui.pnlSort.key === key;
		return `<th class="${num ? 'num ' : ''}sortable ${on ? 'on' : ''}" data-psort="${key}" title="${esc(t('sort_by'))}">${esc(label)}<i class="sort-ar">${on ? (ui.pnlSort.dir > 0 ? '▲' : '▼') : '↕'}</i></th>`;
	};
	$('pnlTable').innerHTML = `<thead><tr>${th('name', t('pnl_item_col'), false)}${th('covered', t('pnl_qty'))}${th('avg', t('pnl_avg'))}
		${th('unit', t('pnl_now'))}${th('value', t('pnl_value'))}${th('pnl', t('pnl_unrealized'))}${th('realized', t('pnl_realized'))}</tr></thead>
		<tbody>${rows.map(p => `<tr>
			<td><div class="it">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : '<span class="pnl-noimg"></span>'}<div><div>${esc(p.name)}</div>
				<div class="sub">${esc(t('pnl_bought_sold', { b: fmt(p.bought), s: fmt(p.sold) }))}</div></div></div></td>
			<td class="num">${fmt(p.covered)}${p.held > p.covered ? `<div class="sub">${esc(t('pnl_of_held', { n: fmt(p.held) }))}</div>` : ''}</td>
			<td class="num">${esc(cur(p.avg, c))}</td>
			<td class="num">${esc(cur(p.unit, c))}</td>
			<td class="num">${p.covered ? esc(cur(p.value, c)) : '—'}</td>
			<td class="num"><b class="${signCls(p.pnl)}">${p.pnl != null ? esc(cur(p.pnl, c, true)) : '—'}</b>${p.roi != null ? `<div class="sub ${signCls(p.roi)}">${esc(pctFmt(p.roi))}</div>` : ''}</td>
			<td class="num ${signCls(p.realized)}">${p.sold ? esc(cur(p.realized, c, true)) : '—'}</td>
		</tr>`).join('') || `<tr><td colspan="7" class="muted">—</td></tr>`}</tbody>`;
	const foot = [t('pnl_foot_fifo')];
	if (r.soldNoCost) foot.push(t('pnl_sold_nocost', { n: fmt(r.soldNoCost) }));
	const imp = Object.entries(r.imports || {}).filter(([, v]) => v);
	if (imp.length) foot.push(imp.map(([l, v]) => t('pnl_imported_at', { a: l, d: new Date(v.at).toLocaleString(LANG === 'zh' ? 'zh-CN' : LANG, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })).join(', '));
	$('pnlFoot').textContent = foot.join(' · ');
	// записи
	const rec = ui.pnlRecs || { total: 0, rows: [] };
	$('pnlRecCount').textContent = fmt(rec.total);
	$('pnlClearImport').classList.toggle('hidden', ui.pnlScope === 'all' || !rec.rows.some(x => x.src === 'market'));
	const src = x => t('pnl_src_' + x);
	$('pnlRecords').innerHTML = rec.rows.length ? `<thead><tr><th>${esc(t('pnl_date'))}</th><th>${esc(t('pnl_type'))}</th><th>${esc(t('pnl_item_col'))}</th><th class="num">${esc(t('pnl_qty'))}</th>
		<th class="num">${esc(t('pnl_price'))}</th><th>${esc(t('pnl_source'))}</th><th></th></tr></thead><tbody>${rec.rows.slice(0, 300).map(x => `<tr>
			<td class="nowrap">${esc(new Date(x.ts).toLocaleDateString(LANG === 'zh' ? 'zh-CN' : LANG))}</td>
			<td><span class="pnl-kind-tag ${x.kind}">${esc(t(x.kind === 'buy' ? 'pnl_buy' : 'pnl_sell'))}</span></td>
			<td>${esc(x.name)}${ui.pnlScope === 'all' ? `<div class="sub">${esc(loginName(x.login))}</div>` : ''}</td>
			<td class="num">${ui.pnlEdit === x.id && x.qty > 1 ? `<span class="pnl-edit" title="${esc(t('pnl_split_hint'))}"><input type="number" min="1" max="${x.qty}" id="pnlEditQty" value="${x.qty}" class="qty"><span class="muted small">/ ${fmt(x.qty)}</span></span>` : fmt(x.qty)}</td>
			<td class="num">${ui.pnlEdit === x.id ? `<span class="pnl-edit"><input type="number" min="0" step="0.01" id="pnlEditPrice" value="${x.unit}"><select id="pnlEditCur" class="sel-input">${PRICE_CURRENCIES.map(c => `<option ${c === x.cur ? 'selected' : ''}>${c}</option>`).join('')}</select>
				<button class="btn primary small" data-edit-save="${esc(x.id)}">✓</button><button class="btn ghost small" data-edit-cancel>✕</button></span>`
				: `${esc(cur(x.unit, x.cur))}${x.edited ? ` <span class="muted small" title="${esc(t('pnl_edited'))}">✎</span>` : ''}`}</td>
			<td class="muted small">${esc(src(x.src))}</td>
			<td class="num nowrap"><button class="btn ghost small icon-only" data-edit-rec="${esc(x.id)}" title="${esc(t('pnl_edit_price'))}">✎</button>${x.src !== 'market' ? `<button class="btn ghost small icon-only" data-del-rec="${esc(x.id)}" title="${esc(t('delete'))}">✕</button>` : ''}</td>
		</tr>`).join('')}</tbody>` : `<tbody><tr><td class="muted">${esc(t('pnl_no_records'))}</td></tr></tbody>`;
}

$('pnlScope').addEventListener('click', e => { const b = e.target.closest('[data-scope]'); if (b) { ui.pnlScope = b.dataset.scope; ui.pnl = null; loadPnl(); } });
$('pnlRefresh').addEventListener('click', loadPnl);
$('pnlSearch').addEventListener('input', renderPnl);
$('pnlRecords').addEventListener('keydown', e => {
	if (e.target.id !== 'pnlEditPrice' && e.target.id !== 'pnlEditQty') return;
	if (e.key === 'Enter') { const b = document.querySelector('[data-edit-save]'); if (b) b.click(); }
	if (e.key === 'Escape') { e.stopPropagation(); ui.pnlEdit = null; renderPnl(); }
});
$('pnlEnable').addEventListener('click', () => savePriceSetting({ priceEnabled: true }).then(loadPnl));
// Импорт истории ТП идёт в фоне: показываем прогресс, можно уйти с вкладки и вернуться.
function renderImportJob(j) {
	const box = $('pnlImportBox');
	const running = j && !j.finished;
	box.classList.toggle('hidden', !running);
	$('pnlImport').disabled = Boolean(running);
	if (!running) return;
	$('piTitle').textContent = t('pi_title');
	const pct = j.total ? Math.min(100, j.done / j.total * 100) : 3;
	$('piBar').style.width = `${pct}%`;
	$('piText').textContent = j.waiting ? t('pi_waiting', { s: j.waiting })
		: j.total ? t('pi_progress', { d: fmt(j.done), t: fmt(j.total), n: fmt(j.found || 0) }) : t('pi_start');
}
async function pollImport(first) {
	clearTimeout(ui.importTimer);
	if (ui.tab !== 'pnl' || ui.pnlScope === 'all') return;
	try {
		const j = first || await apiGet('/api/pnl/import');
		renderImportJob(j);
		if (!j) return;
		ui.importTimer = null;
		if (!j.finished) { ui.importTimer = setTimeout(() => pollImport(), 1200); return; }
		if (ui.importShown === j.started) return;  // итог этого импорта уже показан
		ui.importShown = j.started;
		if (j.error) toast(j.error, 'bad');
		else toast(t(j.stopped ? 'pi_stopped' : 'pnl_import_done', { n: fmt(j.added || 0), f: fmt(j.found || 0) }), 'good');
		ui.pnl = null; loadPnl();
	} catch (e) { /* следующий раз */ }
}
$('pnlImport').addEventListener('click', async () => {
	try { pollImport(await apiPost('/api/pnl/import')); } catch (e) { toast(e.message, 'bad'); }
});
$('piStop').addEventListener('click', async () => { try { await apiPost('/api/pnl/import/stop'); $('piText').textContent = t('pi_stopping'); } catch (e) { toast(e.message, 'bad'); } });
$('pnlClearImport').addEventListener('click', async () => {
	const r = await miniConfirm({ icon: ICON_Q, warn: true, title: t('pnl_clear_import'), text: t('pnl_clear_import_q'), ok: t('delete') });
	if (!r.ok) return;
	try { await apiPost('/api/pnl/clearimport'); ui.pnl = null; loadPnl(); } catch (e) { toast(e.message, 'bad'); }
});
$('pnlRecords').addEventListener('click', async e => {
	const ed = e.target.closest('[data-edit-rec]');
	if (ed) {
		// цена покупки влияет на всю прибыль — предупреждаем (можно отключить в «Подтверждениях»)
		const r = await askConfirm('pnledit', { warn: true, icon: ICON_Q, title: t('pnl_edit_price'), text: t('pnl_edit_warn'), ok: t('pnl_edit_ok') });
		if (!r.ok) return;
		ui.pnlEdit = ed.dataset.editRec; renderPnl();
		const inp = document.getElementById('pnlEditPrice'); if (inp) { inp.focus(); inp.select(); }
		return;
	}
	if (e.target.closest('[data-edit-cancel]')) { ui.pnlEdit = null; renderPnl(); return; }
	const sv = e.target.closest('[data-edit-save]');
	if (sv) {
		try {
			const q = document.getElementById('pnlEditQty');
			const r = await api('/api/pnl/update', { id: sv.dataset.editSave, price: $('pnlEditPrice').value, currency: $('pnlEditCur').value, qty: q ? q.value : null });
			ui.pnlEdit = null; toast(t(r.split ? 'pnl_split_done' : 'pnl_saved_price', { n: fmt(r.record.qty) }), 'good'); loadPnl();
		} catch (err) { toast(err.message, 'bad'); }
		return;
	}
	const b = e.target.closest('[data-del-rec]');
	if (!b) return;
	try { await api('/api/pnl/delete', { ids: [b.dataset.delRec] }); loadPnl(); } catch (err) { toast(err.message, 'bad'); }
});
$('pnlExport').addEventListener('click', async () => {
	try {
		const r = await api('/api/pnl/export' + (ui.pnlScope === 'all' ? '?all=1' : ''), { account: ui.active, all: ui.pnlScope === 'all' });
		toast(t('pnl_exported'), 'good', window.desktop ? { label: t('open_folder'), run: () => window.desktop.openPath(r.folder) } : null);
	} catch (e) { toast(e.message, 'bad'); }
});
// ручное добавление
function openPnlModal() {
	const c = (ui.pnl && ui.pnl.currency) || 'USD';
	$('pnlCur').innerHTML = PRICE_CURRENCIES.map(x => `<option value="${x}">${x}</option>`).join('');
	$('pnlCur').value = PRICE_CURRENCIES.includes(c) ? c : 'USD';
	pnlHint();
	$('pnlName').value = ''; $('pnlQty').value = 1; $('pnlPrice').value = '';
	$('pnlDate').value = new Date().toLocaleDateString('sv');
	ui.pnlKind = 'buy';
	document.querySelectorAll('#pnlKind button').forEach(b => b.classList.toggle('active', b.dataset.k === 'buy'));
	$('pnlModal').classList.remove('hidden');
	$('pnlName').focus();
}
$('pnlAdd').addEventListener('click', openPnlModal);
// Подсказка «в наличии / без цены покупки» и кнопка «Макс.»: для покупки — сколько ещё без цены покупки,
// для продажи — сколько есть с ценой покупки (больше продать по учёту нельзя).
function pnlMax() {
	const v = ((ui.pnl && ui.pnl.names) || {})[$('pnlName').value.trim()];
	if (!v) return 0;
	const [held, covered] = v;
	return ui.pnlKind === 'sell' ? covered : (held - covered > 0 ? held - covered : held);
}
function pnlHint() {
	const v = ((ui.pnl && ui.pnl.names) || {})[$('pnlName').value.trim()];
	$('pnlHint').textContent = v ? t('pnl_hint', { h: fmt(v[0]), n: fmt(Math.max(0, v[0] - v[1])) }) : '';
	$('pnlMax').disabled = !pnlMax();
}
$('pnlName').addEventListener('input', pnlHint);
combo($('pnlName'), {
	source: q => {
		const names = Object.entries((ui.pnl && ui.pnl.names) || {});
		const ql = q.toLowerCase();
		return names.filter(([n]) => !ql || n.toLowerCase().includes(ql)).slice(0, 60)
			.map(([name, [held, covered, image]]) => ({ name, image, sub: t('pnl_hint', { h: fmt(held), n: fmt(Math.max(0, held - covered)) }) }));
	},
	onPick: () => pnlHint(),
});
$('pnlMax').addEventListener('click', () => { const n = pnlMax(); if (n) $('pnlQty').value = n; });
$('pnlFill').addEventListener('click', async () => {
	const c = ui.pnl && ui.pnl.currency;
	const r = await miniConfirm({ warn: true, icon: ICON_Q, title: t('pnl_fill'), ok: t('pnl_fill_ok'),
		text: t('pnl_fill_q', { n: fmt((ui.pnl && ui.pnl.uncoveredQty) || 0), v: c ? cur(ui.pnl.uncoveredValue || 0, c) : '' }) });
	if (!r.ok) return;
	try {
		const x = await api('/api/pnl/fill', { account: ui.active, all: ui.pnlScope === 'all' });
		toast(t('pnl_fill_done', { n: fmt(x.items) }), 'good');
		ui.pnl = null; loadPnl();
	} catch (e) { toast(e.message, 'bad'); }
});
$('pnlKind').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; ui.pnlKind = b.dataset.k; document.querySelectorAll('#pnlKind button').forEach(x => x.classList.toggle('active', x === b)); pnlHint(); });
$('pnlCancel').addEventListener('click', () => $('pnlModal').classList.add('hidden'));
$('pnlSave').addEventListener('click', async () => {
	try {
		await apiPost('/api/pnl/add', { kind: ui.pnlKind || 'buy', name: $('pnlName').value, qty: $('pnlQty').value, price: $('pnlPrice').value, currency: $('pnlCur').value, date: $('pnlDate').value });
		$('pnlModal').classList.add('hidden');
		toast(t('pnl_saved'), 'good');
		loadPnl();
	} catch (e) { toast(e.message, 'bad'); }
});
// CSV
$('pnlCsv').addEventListener('click', () => $('pnlCsvFile').click());
$('pnlCsvFile').addEventListener('change', async e => {
	const f = e.target.files && e.target.files[0];
	e.target.value = '';
	if (!f) return;
	try {
		const text = await f.text();
		// валюта кошелька — для выгрузки SIH, где у части цен символ неоднозначен (¥, kr)
		const walletCurrency = ui.state && ui.state.wallet && ui.state.wallet.currency;
		const r = await apiPost('/api/pnl/csv', { text, currency: (ui.pnl && ui.pnl.currency) || 'USD', walletCurrency });
		toast(t(r.format === 'sih' ? 'pnl_sih_done' : 'pnl_csv_done', { n: fmt(r.added) }) + (r.duplicates ? ' · ' + t('pnl_csv_dupes', { n: fmt(r.duplicates) }) : '')
			+ (r.errors.length ? ' · ' + t('pnl_csv_errors', { rows: r.errors.join(', ') }) : ''), r.added || r.duplicates ? 'good' : 'bad');
		loadPnl();
	} catch (err) { toast(err.message, 'bad'); }
});

// ============================================================ контракт обмена (трейд-ап)
// Названия грейдов — игровые термины CS2, одинаковы на всех языках.
const GRADES = { 1: 'Consumer', 2: 'Industrial', 3: 'Mil-Spec', 4: 'Restricted', 5: 'Classified', 6: 'Covert' };
const gradeName = (r, st) => (st ? 'StatTrak™ ' : '') + (GRADES[r] || ('#' + r));

async function loadTradeup() {
	$('tuGroups').innerHTML = Array.from({ length: 4 }, () => '<div class="skeleton" style="height:34px;width:130px;border-radius:999px"></div>').join('');
	$('tuEmpty').classList.remove('hidden'); $('tuPanel').classList.add('hidden');
	try {
		ui.tu.groups = await apiGet('/api/tradeup/groups' + ($('tuCaskets').checked ? '?caskets=1' : ''));
		const prev = ui.tu.rarity != null ? [ui.tu.rarity, ui.tu.stattrak] : null;
		ui.tu.rarity = null; ui.tu.stattrak = null; ui.tu.picks = {}; ui.tu.preview = null;
		renderTuGroups(); tuUpdateAction(); renderTuOdds();
		// сразу открываем группу: прежнюю или первую, где хватает 10 предметов
		const gs = ui.tu.groups || [];
		const g = (prev && gs.find(x => x.rarity === prev[0] && x.stattrak === prev[1])) || gs.find(x => x.total >= 10) || gs[0];
		if (g) selectTuGroup(g.rarity, g.stattrak);
	} catch (e) { $('tuGroups').innerHTML = `<p class="muted" style="padding:16px">${esc(e.message)}</p>`; }
}

function currentTuGroup() { return (ui.tu.groups || []).find(g => g.rarity === ui.tu.rarity && g.stattrak === ui.tu.stattrak); }

function renderTuGroups() {
	const gs = ui.tu.groups || [];
	if (!gs.length) { $('tuGroups').innerHTML = `<p class="muted" style="padding:16px">${esc(t('tradeup_no_items'))}</p>`; return; }
	$('tuGroups').innerHTML = gs.map(g => {
		const sel = g.rarity === ui.tu.rarity && g.stattrak === ui.tu.stattrak;
		return `<button class="tu-chip ${sel ? 'sel' : ''} ${g.total >= 10 ? '' : 'short'}" data-rarity="${g.rarity}" data-st="${g.stattrak ? 1 : 0}" title="${esc(g.total >= 10 ? '' : t('tu_short'))}">
			<span class="tu-dot r${g.rarity}"></span>${esc(gradeName(g.rarity, g.stattrak))}<span class="muted">${g.total}</span></button>`;
	}).join('');
}

function selectTuGroup(rarity, stattrak) {
	ui.tu.rarity = rarity; ui.tu.stattrak = stattrak; ui.tu.picks = {}; ui.tu.preview = null;
	renderTuGroups();
	const g = currentTuGroup();
	$('tuEmpty').classList.toggle('hidden', Boolean(g));
	$('tuPanel').classList.toggle('hidden', !g);
	if (g) {
		// фильтр коллекций — только коллекции этой группы
		const colls = [...new Set(g.items.map(i => i.collection).filter(Boolean))].sort();
		const cur = $('tuColl').value;
		$('tuColl').innerHTML = `<option value="">${esc(t('tu_all_colls'))}</option>` + colls.map(c => `<option value="${esc(c)}">${esc(shortColl(c))}</option>`).join('');
		$('tuColl').value = colls.includes(cur) ? cur : '';
		renderTuItems();
	}
}

const EYE = '<svg viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const fl4 = f => f == null ? '—' : Number(f).toFixed(4);
// Полоса износа (как на Торговой площадке со SIH): сегменты качеств FN/MW/FT/WW/BS и метка ^ под float.
// min/max — возможный диапазон скина (вне его полоса затемнена); marks — одна или несколько отметок.
const WEAR_SEGS = [[0, 0.07, 'fn'], [0.07, 0.15, 'mw'], [0.15, 0.38, 'ft'], [0.38, 0.45, 'ww'], [0.45, 1, 'bs']];
function floatBar(marks, { min = 0, max = 1, cls = '' } = {}) {
	const pct = v => `${(Math.min(1, Math.max(0, v)) * 100).toFixed(2)}%`;
	const list = (Array.isArray(marks) ? marks : [marks]).filter(f => f != null);
	return `<div class="fbar ${cls}"><div class="fbar-track">${WEAR_SEGS.map(([a, b, c]) => `<i class="${c}" style="left:${pct(a)};width:${pct(b - a)}"></i>`).join('')}
		${min > 0 ? `<b class="fbar-off" style="left:0;width:${pct(min)}"></b>` : ''}${max < 1 ? `<b class="fbar-off" style="left:${pct(max)};right:0"></b>` : ''}</div>
		${list.map(f => `<span class="fbar-mark" style="left:${pct(f)}"></span>`).join('')}</div>`;
}
const marketUrl = name => `https://steamcommunity.com/market/listings/730/${encodeURIComponent(name)}`;
const tuTotal = () => Object.values(ui.tu.picks).reduce((a, b) => a + b, 0);
// Выбранные id: у каждого скина берутся первые N (сервер сортирует их по float — от меньшего).
function tuPickedIds() {
	const g = currentTuGroup(); if (!g) return [];
	const ids = [];
	for (const [name, count] of Object.entries(ui.tu.picks)) {
		const it = g.items.find(x => x.name === name);
		if (it) ids.push(...it.ids.slice(0, count));
	}
	return ids;
}
function tuSetPick(name, value, max) { const n = Math.max(0, Math.min(max, Math.floor(Number(value) || 0))); if (n) ui.tu.picks[name] = n; else delete ui.tu.picks[name]; }

// Выбор предметов для контракта: сверху 10 слотов (заполняются выбранными), ниже — карточки скинов.
// Клик по карточке — +1, «−» на карточке или клик по слоту — убрать.
const shortColl = c => String(c || '').replace(/^The /, '').replace(/ Collection$/, '');
// цвет коллекции — стабильный по названию
const collColor = c => { let h = 0; for (const ch of String(c || '')) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h} 65% 62%)`; };

function tuVisibleItems(g) {
	const q = ($('tuSearch').value || '').toLowerCase();
	const coll = $('tuColl').value;
	const minF = i => { const f = (i.floats || []).filter(x => x != null); return f.length ? Math.min(...f) : 9; };
	const sorts = {
		count: (a, b) => b.count - a.count,
		float: (a, b) => minF(a) - minF(b),
		price: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9),
		name: (a, b) => a.name.localeCompare(b.name),
	};
	const sort = sorts[$('tuSort').value] || sorts.count;
	return g.items
		.filter(i => (!q || i.name.toLowerCase().includes(q) || (i.collection || '').toLowerCase().includes(q)) && (!coll || i.collection === coll))
		.sort((a, b) => Boolean(a.blocked) - Boolean(b.blocked) || Boolean(ui.tu.picks[b.name]) - Boolean(ui.tu.picks[a.name]) || sort(a, b) || a.name.localeCompare(b.name));
}

function tuCard(i, g) {
	const n = ui.tu.picks[i.name] || 0;
	const full = tuTotal() >= 10 && !n;
	const blocked = i.blocked === 'top';
	const f = (i.floats || []).filter(x => x != null);
	const lo = f.length ? Math.min(...f) : null, hi = f.length ? Math.max(...f) : null;
	const have = (blocked ? i.all || i.count : i.count);
	return `<div class="tu-card r${g.rarity} ${n ? 'picked' : ''} ${full || blocked ? 'dim' : ''} ${blocked ? 'blocked' : ''}" data-tu="${esc(i.name)}" title="${esc(blocked ? t('tu_no_upgrade') : i.name)}">
		${blocked ? `<span class="tu-block">${esc(t('tu_no_upgrade_short'))}</span>` : ''}
		${n ? `<span class="tu-n">×${n}</span><button class="tu-minus" data-tuminus="${esc(i.name)}">−</button>` : `<span class="tu-have" title="${esc(i.stored ? `${t('in_casket')}: ${i.stored}` : '')}">${fmt(have)} ${esc(t('pcs'))}${i.stored ? ' 📦' : ''}</span>`}
		<div class="tu-img">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : ''}</div>
		${i.inspect ? `<button class="tu-eye" data-insp-game="${esc(i.inspect)}" title="${esc(t('craft_inspect'))}">${EYE}</button>` : ''}
		<div class="tu-name">${esc(i.name)}</div>
		${i.collection ? `<div class="tu-coll" style="--cc:${collColor(i.collection)}" title="${esc(i.collection)}">${esc(shortColl(i.collection))}</div>` : ''}
		<div class="tu-meta"><span>${lo != null ? `${lo.toFixed(3)}${hi !== lo ? `–${hi.toFixed(3)}` : ''}` : ''}</span><span>${i.price != null ? esc(cur(i.price, i.currency)) : ''}</span></div>
		${f.length ? floatBar(f.length > 3 ? [lo, hi] : f, { cls: 'sm' }) : ''}
	</div>`;
}

// Быстрое обновление после клика: перерисовываем только эту карточку (и затемнение остальных), а не всю сетку.
function tuUpdatePicked(name) {
	const g = currentTuGroup(); if (!g) return;
	const it = g.items.find(x => x.name === name);
	const el = document.querySelector(`#tuItems [data-tu="${CSS.escape(name)}"]`);
	if (el && it) el.outerHTML = tuCard(it, g);
	const full = tuTotal() >= 10;
	document.querySelectorAll('#tuItems .tu-card:not(.blocked)').forEach(c => c.classList.toggle('dim', full && !ui.tu.picks[c.dataset.tu]));
	renderTuTray();
	tuUpdateAction();
}

function renderTuItems() {
	const g = currentTuGroup(); if (!g) return;
	const items = tuVisibleItems(g);
	const next = GRADES[g.rarity + 1] || '';
	if (!items.length) $('tuItems').innerHTML = `<div class="empty-box">${esc(t('nothing_found'))}</div>`;
	else if ($('tuGroupColl').checked) {
		// группы по коллекциям (как в игре): заголовок — сколько скинов и сколько вариантов результата
		const by = new Map();
		for (const i of items) { const k = i.collection || '—'; if (!by.has(k)) by.set(k, []); by.get(k).push(i); }
		$('tuItems').innerHTML = [...by].map(([c, list]) => `<div class="tu-coll-group">
			<div class="tu-coll-head"><span class="tu-coll" style="--cc:${collColor(c)}">${esc(c)}</span>
				<span class="muted small">${esc(t('tu_coll_info', { s: list.length, n: fmt(list.reduce((x, i) => x + i.count, 0)) }))}${list[0].nextCount ? ` · ${esc(t('tu_coll_next', { n: list[0].nextCount, g: next }))}` : ''}</span></div>
			<div class="tu-grid-in">${list.map(i => tuCard(i, g)).join('')}</div></div>`).join('');
	} else $('tuItems').innerHTML = `<div class="tu-grid-in">${items.map(i => tuCard(i, g)).join('')}</div>`;
	renderTuTray();
	tuUpdateAction();
}

function renderTuTray() {
	const g = currentTuGroup(); if (!g) return;
	const slots = [];
	for (const [name, n] of Object.entries(ui.tu.picks)) {
		const it = g.items.find(x => x.name === name);
		for (let k = 0; k < n; k++) slots.push({ it, float: it.floats ? it.floats[k] : null, id: it.ids[k] });
	}
	const insp = new Map(((ui.tu.preview && ui.tu.preview.inputs) || []).map(x => [x.id, x.inspect]));
	$('tuTray').innerHTML = Array.from({ length: 10 }, (_, i) => {
		const sl = slots[i];
		if (!sl) return `<div class="tu-slot"><span>${i + 1}</span></div>`;
		const it = sl.it, link = insp.get(sl.id);
		return `<div class="tu-slot full r${g.rarity}" data-tuminus="${esc(it.name)}" title="${esc(it.name)}${sl.float != null ? ` · float ${fl4(sl.float)}` : ''}">${it.image ? `<img src="${esc(it.image)}" alt="">` : `<span>${esc(it.name.slice(0, 10))}</span>`}
			${sl.float != null ? `<span class="tu-slot-fl">${fl4(sl.float)}</span>${floatBar(sl.float, { cls: 'xs' })}` : ''}
			${link ? `<button class="tu-eye small" data-insp-game="${esc(link)}" title="${esc(t('craft_inspect'))}">${EYE}</button>` : ''}</div>`;
	}).join('');
}

// Прогноз: исходы с шансами и ожидаемым float (запрашиваем у сервера после каждого изменения выбора).
let tuPreviewTimer = null, tuPreviewSeq = 0;
function scheduleTuPreview() {
	clearTimeout(tuPreviewTimer);
	const ids = tuPickedIds();
	if (!ids.length) { ui.tu.preview = null; renderTuOdds(); return; }
	tuPreviewTimer = setTimeout(async () => {
		const seq = ++tuPreviewSeq;
		try {
			const r = await apiPost('/api/tradeup/preview', { itemIds: ids });
			if (seq !== tuPreviewSeq) return;
			ui.tu.preview = r; renderTuOdds(); renderTuTray();
		} catch (e) { /* прогноз необязателен */ }
	}, 200);
}

function renderTuOdds() {
	const p = ui.tu.preview;
	const g = currentTuGroup();
	$('tuOdds').classList.toggle('hidden', !g);
	if (!g) return;
	if (!p || !p.count) {
		$('tuOddsSub').textContent = '';
		$('tuOddsList').innerHTML = `<div class="tu-odds-empty muted small">${esc(t('tu_pick_more'))}</div>`;
		return;
	}
	const sub = [];
	if (p.count < 10) sub.push(t('tu_partial', { n: p.count }));
	if (p.avgFloat != null) sub.push(`${t('tu_avg_float')}: ${fl4(p.avgFloat)}`);
	$('tuOddsSub').textContent = sub.join(' · ');
	const nextColor = RARITY_COLORS[g.rarity + 1] || '#8847ff';
	const pc = p.prices && p.prices.currency;
	const pr = p.prices;
	// Окупаемость: стоимость входов, ожидаемая стоимость результата и шанс получить больше, чем вложено
	const ev = pr && (pr.cost != null || pr.ev != null) ? `<div class="tu-ev">
		<div><span class="muted small">${esc(t('tu_cost'))}</span><b>${esc(cur(pr.cost, pc))}</b></div>
		<div><span class="muted small">${esc(t('tu_ev'))}</span><b>${esc(cur(pr.ev, pc))}</b></div>
		${pr.profit != null ? `<div><span class="muted small">${esc(t('tu_profit'))}</span><b class="${signCls(pr.profit)}">${esc(cur(pr.profit, pc, true))}${pr.cost ? ` <small>${esc(pctFmt(pr.profit / pr.cost))}</small>` : ''}</b></div>
		<div><span class="muted small">${esc(t('tu_win'))}</span><b>${(pr.winChance * 100).toFixed(0)}%</b></div>`
		: `<div class="muted small tu-ev-note">${esc(t(pr.coverage < 0.999 ? 'tu_ev_partial' : 'tu_ev_inputs'))}</div>`}
	</div>` : '';
	$('tuOddsList').innerHTML = ev + (p.topTier && p.topTier.length ? `<div class="tu-odds-warn">${esc(t('tu_top_tier', { names: [...new Set(p.topTier)].join(', ') }))}</div>` : '')
		+ (p.unknown && p.unknown.length ? `<div class="tu-odds-warn">${esc(t('tu_unknown', { names: [...new Set(p.unknown)].join(', ') }))}</div>` : '')
		+ p.outcomes.map(o => `<div class="tu-out" style="--rc:${nextColor}">
			<div class="tu-out-img">${o.image ? `<img src="${esc(o.image)}" alt="" loading="lazy">` : ''}</div>
			<div class="tu-out-body">
				<div class="tu-out-name" title="${esc(o.name)}">${esc(o.name)}</div>
				<div class="muted small">${o.float != null ? `float ≈ ${fl4(o.float)} · ${esc(o.exterior)}` : esc(o.collection || '')}</div>
				${o.float != null ? floatBar(o.float, { min: o.min, max: o.max, cls: 'sm' }) : ''}
				<div class="tu-out-bar"><i style="width:${Math.max(2, o.chance * 100).toFixed(1)}%"></i></div>
			</div>
			<div class="tu-out-side"><b>${(o.chance * 100).toFixed(o.chance < 0.1 ? 1 : 0)}%</b>${pc && o.price != null ? `<span class="tu-out-price ${pr.cost != null ? signCls(o.price - pr.cost) : ''}">${esc(cur(o.price, pc))}</span>` : ''}
				<button class="tu-mkt" data-open="${esc(marketUrl(o.marketName))}" title="${esc(t('craft_market'))}">${esc(t('tu_market_short'))}</button></div>
		</div>`).join('');
}

function tuUpdateAction() {
	const total = tuTotal();
	$('tuCount').textContent = total;
	$('tuWarn').textContent = total === 10 ? '' : (total > 10 ? t('tradeup_need10', { n: total }) : '');
	$('tuDo').disabled = total !== 10;
	scheduleTuPreview();

}

// Красивое окно с полученным предметом (цвет — по редкости).
function showCraftResult(r) {
	const color = RARITY_COLORS[r.rarity] || '#8847ff';
	$('craftCard').style.setProperty('--rc', color);
	$('craftImg').innerHTML = r.image ? `<img src="${esc(r.image.replace(/\/\d+fx\d+f$/, '/360fx360f'))}" alt="">` : '';
	$('craftName').textContent = r.name || t('tradeup_done_unknown');
	$('craftGrade').textContent = r.rarity ? ((r.stattrak ? 'StatTrak™ ' : '') + (RARITY_NAMES[r.rarity] || '')) : '';
	$('craftGrade').classList.toggle('hidden', !r.rarity);
	$('craftFloat').innerHTML = r.float != null ? `<div>float ${Number(r.float).toFixed(6)}</div>${floatBar(r.float)}` : '';
	// итог контракта: сколько стоили 10 входов и сколько стоит полученный предмет (по текущему прайсу)
	const P = r.prices, pc = P && P.currency;
	$('craftPnl').classList.toggle('hidden', !P || (P.cost == null && P.value == null));
	if (P) $('craftPnl').innerHTML = `<div><span>${esc(t('tu_cost'))}</span><b>${esc(cur(P.cost, pc))}</b></div>
		<div><span>${esc(t('craft_value'))}</span><b>${P.value != null ? esc(cur(P.value, pc)) : esc(t('craft_no_price'))}</b></div>
		<div class="craft-pnl-r ${signCls(P.profit)}"><span>${esc(t(P.profit == null ? 'tu_profit' : P.profit >= 0 ? 'craft_profit' : 'craft_loss'))}</span><b>${P.profit != null ? esc(cur(P.profit, pc, true)) + (P.cost ? ` <small>${esc(pctFmt(P.profit / P.cost))}</small>` : '') : '—'}</b></div>`;
	const view = { name: r.name, image: r.image, rarity: r.rarity, float: r.float, seed: r.seed, kills: r.stattrak ? 0 : null, souvenir: false, nameTag: null, stickers: [], inspect: null };
	$('craftView').classList.toggle('hidden', !r.name);
	$('craftView').onclick = () => openItemView(view);
	// «На Торговой площадке» — сразу (по названию); «Осмотреть» — когда предмет появится в веб-инвентаре
	$('craftMarket').classList.toggle('hidden', !r.name);
	$('craftMarket').onclick = () => openExt(marketUrl(r.name));
	const insp = $('craftInspect');
	insp.classList.toggle('hidden', !r.id);
	insp.disabled = true; insp.dataset.tip = t('craft_inspect_wait'); insp.onclick = null;
	if (r.id) apiGet('/api/inspect?wait=1&id=' + encodeURIComponent(r.id)).then(x => {
		if (!x.link) { insp.classList.add('hidden'); return; }
		insp.disabled = false; insp.dataset.tip = t('craft_tip_inspect'); insp.onclick = () => launchInspect(x.link); view.inspect = x.link;
	}).catch(() => insp.classList.add('hidden'));
	$('craftModal').classList.remove('hidden');
	$('craftOk').focus();
}

async function runTradeUp() {
	const g = currentTuGroup(); if (!g) return;
	const ids = tuPickedIds();
	if (ids.length !== 10) return toast(t('tradeup_need10', { n: ids.length }), 'bad');
	if (!(await askConfirm('tradeup', { warn: true, title: t('tradeup_do'), text: t('tradeup_confirm') })).ok) return;
	$('tuDo').disabled = true;
	try {
		const r = await apiPost('/api/tradeup/craft', { itemIds: ids });
		showCraftResult(r);
		await loadTradeup();
		if (ui.state) loadState().catch(() => {});
	} catch (e) { toast(e.message, 'bad'); tuUpdateAction(); }
}

$('tuGroups').addEventListener('click', e => { const el = e.target.closest('[data-rarity]'); if (el) selectTuGroup(Number(el.dataset.rarity), el.dataset.st === '1'); });
// «Осмотреть» на карточке/слоте и «ТП» у исхода — не выбирают предмет
const tuLink = e => { const b = e.target.closest('[data-insp-game],[data-open]'); if (!b) return false; if (b.dataset.inspGame) launchInspect(b.dataset.inspGame); else openExt(b.dataset.open); return true; };
$('tuOddsList').addEventListener('click', tuLink);
$('tuItems').addEventListener('click', e => {
	if (tuLink(e)) return;
	const minus = e.target.closest('[data-tuminus]');
	const card = e.target.closest('[data-tu]');
	const g = currentTuGroup(); if (!g) return;
	if (minus) { const name = minus.dataset.tuminus; tuSetPick(name, (ui.tu.picks[name] || 0) - 1, 999); tuUpdatePicked(name); return; }
	if (card) {
		const it = g.items.find(x => x.name === card.dataset.tu);
		if (it && it.blocked) { toast(t('tu_no_upgrade'), 'bad'); return; }
		if (it && tuTotal() < 10) {
			const add = e.shiftKey ? 10 - tuTotal() : 1;  // Shift+клик — сколько поместится
			tuSetPick(it.name, (ui.tu.picks[it.name] || 0) + add, it.count); tuUpdatePicked(it.name);
		}
	}
});
$('tuItems').addEventListener('contextmenu', e => {
	const card = e.target.closest('[data-tu]');
	if (!card) return;
	e.preventDefault();
	const name = card.dataset.tu;
	if (ui.tu.picks[name]) { tuSetPick(name, ui.tu.picks[name] - 1, 999); tuUpdatePicked(name); }
});
$('tuColl').addEventListener('change', renderTuItems);
$('tuSort').addEventListener('change', renderTuItems);
$('tuGroupColl').addEventListener('change', () => { try { localStorage.setItem('tuGroupColl', $('tuGroupColl').checked ? '1' : ''); } catch (e) { /* нет хранилища */ } renderTuItems(); });
try { $('tuGroupColl').checked = localStorage.getItem('tuGroupColl') === '1'; } catch (e) { /* нет хранилища */ }
$('tuTray').addEventListener('click', e => { if (tuLink(e)) return; const s2 = e.target.closest('[data-tuminus]'); if (s2) { tuSetPick(s2.dataset.tuminus, (ui.tu.picks[s2.dataset.tuminus] || 0) - 1, 999); tuUpdatePicked(s2.dataset.tuminus); } });
let tuSearchTimer = null;
$('tuSearch').addEventListener('input', () => { clearTimeout(tuSearchTimer); tuSearchTimer = setTimeout(renderTuItems, 150); });
$('tuClear').addEventListener('click', () => { ui.tu.picks = {}; renderTuItems(); });
$('tuDo').addEventListener('click', runTradeUp);
$('tuCaskets').addEventListener('change', loadTradeup);
$('tuRefresh').addEventListener('click', loadTradeup);
$('craftOk').addEventListener('click', () => $('craftModal').classList.add('hidden'));


// ============================================================ трейды
const tsDate = ts => ts ? new Date(ts * 1000).toLocaleString(LANG === 'zh' ? 'zh-CN' : LANG, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const isGift = o => o.incoming && !o.give.length && o.receive.length;

async function loadTrades() {
	$('tradeItems').innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton" style="height:56px;margin:8px"></div>').join('');
	try {
		ui.trades = await apiGet('/api/trades' + ($('tradeActive').checked ? '' : '?all=1'));
		renderTrades();
	} catch (e) { $('tradeItems').innerHTML = `<p class="muted" style="padding:16px">${esc(e.message)}</p>`; $('tradeDetail').innerHTML = ''; }
}

function renderTrades() {
	const list = (ui.trades || []).filter(o => o.incoming === (ui.tradeDir === 'in'));
	document.querySelectorAll('#tradeDir button').forEach(b => b.classList.toggle('active', b.dataset.dir === ui.tradeDir));
	$('tradeItems').innerHTML = list.length ? list.map(o => `
		<div class="trade-row ${o.id === ui.tradeSel ? 'sel' : ''}" data-offer="${esc(o.id)}">
			${o.partnerAvatar ? `<img class="avatar pii" src="${esc(o.partnerAvatar)}" alt="">` : `<div class="avatar pii">${esc((o.partnerName || '?')[0].toUpperCase())}</div>`}
			<div style="min-width:0;flex:1">
				<div class="strong pii" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(o.partnerName || o.partner)}</div>
				<div class="meta"><span class="tstate ${esc(o.state)}">${esc(t('ts_' + o.state))}</span><span class="muted">${esc(tsDate(o.updated))}</span>${isGift(o) ? `<span class="gift-tag">${esc(t('gift'))}</span>` : ''}</div>
			</div>
			<div class="muted small">−${o.give.length} / +${o.receive.length}</div>
		</div>`).join('') : `<div class="empty-box">${esc(t('trades_empty'))}</div>`;
	renderTradeDetail();
}

function itemTiles(items) {
	return items.length ? `<div class="td-grid">${items.map(i => `<div class="td-item" title="${esc(i.name)}">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : ''}<div class="nm" ${i.color ? `style="color:${esc(i.color)}"` : ''}>${esc(i.name)}</div>${i.amount > 1 ? `<div class="muted">×${i.amount}</div>` : ''}</div>`).join('')}</div>`
		: `<div class="muted small">${esc(t('nothing'))}</div>`;
}

function renderTradeDetail() {
	const o = (ui.trades || []).find(x => x.id === ui.tradeSel);
	if (!o) { $('tradeDetail').innerHTML = `<div class="empty-box">${esc(t('trades_pick'))}</div>`; return; }
	const active = o.state === 'active';
	const actions = active ? (o.incoming
		? `<button class="btn danger-ghost" data-tact="decline">${esc(t('decline'))}</button><button class="btn good" data-tact="accept">${esc(t('accept'))}</button>`
		: `<button class="btn danger-ghost" data-tact="cancel">${esc(t('cancel_offer'))}</button>`) : '';
	$('tradeDetail').innerHTML = `
		<div class="td-head">
			${o.partnerAvatar ? `<img class="avatar pii" src="${esc(o.partnerAvatar)}" alt="">` : `<div class="avatar pii">${esc((o.partnerName || '?')[0].toUpperCase())}</div>`}
			<div><div class="strong pii">${esc(o.partnerName || o.partner)}</div><div class="muted small">#${esc(o.id)} · ${esc(tsDate(o.created))} · <span class="tstate ${esc(o.state)}">${esc(t('ts_' + o.state))}</span></div></div>
		</div>
		${o.message ? `<div class="td-msg">${esc(o.message)}</div>` : ''}
		${o.escrowEnd ? `<div class="warn-text">${esc(t('trade_escrow', { date: tsDate(o.escrowEnd) }))}</div>` : ''}
		<div class="td-cols">
			<div class="td-col"><h4>${esc(t('you_give'))} · ${o.give.length}</h4>${itemTiles(o.give)}</div>
			<div class="td-col"><h4>${esc(t('you_get'))} · ${o.receive.length}</h4>${itemTiles(o.receive)}</div>
		</div>
		<div class="td-actions">${actions}</div>`;
}

async function tradeAction(action) {
	const o = (ui.trades || []).find(x => x.id === ui.tradeSel); if (!o) return;
	if (action === 'accept' && o.give.length && !(await miniConfirm({ warn: true, text: t('trade_accept_confirm', { n: o.give.length }) })).ok) return;
	$('tradeDetail').querySelectorAll('[data-tact]').forEach(b => { b.disabled = true; });
	try {
		const r = await apiPost('/api/trades/action', { id: o.id, action, partner: o.partner });
		toast(r.needsConfirmation ? t('trade_need_confirm') : t('trade_done_' + action), r.needsConfirmation ? '' : 'good');
		await loadTrades();
	} catch (e) { toast(e.message, 'bad'); renderTradeDetail(); }
}

// ============================================================ маркет
async function loadMarket() {
	$('marketTable').innerHTML = '<div class="skeleton" style="height:260px"></div>';
	const acc = activeAccount() || {};
	try {
		const [m, conf] = await Promise.all([
			apiGet('/api/market'),
			acc.canConfirm ? apiGet('/api/confirmations').catch(() => null) : Promise.resolve(null),
		]);
		ui.market = { ...m, confirmations: conf };
		renderMarket();
	} catch (e) { $('marketTable').innerHTML = `<div class="empty-box">${esc(e.message)}</div>`; }
}

function renderMarket() {
	const m = ui.market; if (!m) return;
	const cur = (m.listings[0] || m.buyOrders[0] || {}).currency || (ui.store && ui.store.currency) || '';
	const sumL = m.listings.reduce((s, l) => s + l.buyerPays, 0);
	const sumO = m.buyOrders.reduce((s, o) => s + o.price * o.remaining, 0);
	$('mSumListings').textContent = `${money(sumL)} ${cur}`;
	$('mSumOrders').textContent = `${money(sumO)} ${cur}`;
	$('mSumConfirm').textContent = m.confirmations ? fmt(m.confirmations.length) : '—';
	$('mCntListings').textContent = m.listings.length;
	$('mCntOrders').textContent = m.buyOrders.length;
	$('mCntConfirm').textContent = m.confirmations ? m.confirmations.length : '—';
	document.querySelectorAll('#marketTabs button').forEach(b => b.classList.toggle('active', b.dataset.mtab === ui.mtab));
	const q = ($('marketSearch').value || '').toLowerCase();
	const match = name => !q || String(name).toLowerCase().includes(q);
	const it = (img, name, sub) => `<div class="it">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}<div><div>${esc(name)}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div></div>`;
	let html = '', bulk = null;
	if (ui.mtab === 'listings') {
		const rows = m.listings.filter(l => match(l.name));
		html = rows.length ? `<table class="mt"><thead><tr><th>${esc(t('col_name'))}</th><th>${esc(t('m_status'))}</th><th class="num">${esc(t('m_buyer_pays'))}</th><th class="num">${esc(t('m_you_get'))}</th><th class="num">${esc(t('m_listed'))}</th><th></th></tr></thead><tbody>
			${rows.map(l => `<tr><td>${it(l.image, l.name)}</td><td>${esc(t('ls_' + l.status))}</td><td class="num">${money(l.buyerPays)} ${esc(l.currency)}</td><td class="num">${money(l.receive)} ${esc(l.currency)}</td><td class="num">${esc(tsDate(l.created))}</td>
			<td class="num"><button class="btn ghost small" data-mremove="${esc(l.id)}">${esc(t('m_remove'))}</button></td></tr>`).join('')}</tbody></table>` : `<div class="empty-box">${esc(t('m_empty'))}</div>`;
	} else if (ui.mtab === 'orders') {
		const rows = m.buyOrders.filter(o => match(o.name));
		html = `<div class="sell-bar"><button class="btn primary" id="boNew">+ ${esc(t('bo_title'))}</button><span class="muted small">${esc(t('bo_hint'))}</span></div>` + (rows.length ? `<table class="mt"><thead><tr><th>${esc(t('col_name'))}</th><th class="num">${esc(t('col_price'))}</th><th class="num">${esc(t('col_qty'))}</th><th class="num">${esc(t('total'))}</th><th></th></tr></thead><tbody>
			${rows.map(o => `<tr><td>${it(o.image, o.name)}</td><td class="num">${money(o.price)} ${esc(o.currency)}</td><td class="num">${o.remaining}/${o.quantity}</td><td class="num">${money(o.price * o.remaining)} ${esc(o.currency)}</td>
			<td class="num"><button class="btn ghost small" data-mcancel="${esc(o.id)}">${esc(t('m_cancel_order'))}</button></td></tr>`).join('')}</tbody></table>` : `<div class="empty-box">${esc(t('m_empty'))}</div>`);
	} else if (ui.mtab === 'confirm') {
		if (!m.confirmations) html = `<div class="empty-box">${esc(t('m_need_mafile'))}</div>`;
		else {
			const rows = m.confirmations.filter(c => match(c.title + ' ' + c.summary.join(' ')));
			if (rows.length) bulk = t('m_confirm_all', { n: rows.length });
			html = rows.length ? `<table class="mt"><thead><tr><th>${esc(t('col_name'))}</th><th>${esc(t('m_type'))}</th><th class="num">${esc(t('m_created'))}</th><th></th></tr></thead><tbody>
				${rows.map(c => `<tr><td class="pii-cell">${it(c.icon, c.title, c.summary.join(' · '))}</td><td>${esc(c.typeName || c.type)}</td><td class="num">${esc(tsDate(c.time))}</td>
				<td class="num"><button class="btn ghost small" data-cdeny="${esc(c.id)}">${esc(t('decline'))}</button> <button class="btn good small" data-callow="${esc(c.id)}">${esc(t('confirm'))}</button></td></tr>`).join('')}</tbody></table>`
				: `<div class="empty-box">${esc(t('m_no_confirm'))}</div>`;
		}
	} else if (ui.mtab === 'sell') {
		if (!ui.sell) { html = '<div class="skeleton" style="height:260px"></div>'; loadSellable(); }
		else html = renderSellTab(match, it, n => { bulk = t('m_sell_go', { n }); });
	} else if (ui.mtab === 'history') {
		const h = ui.history;
		if (!h) { html = '<div class="skeleton" style="height:260px"></div>'; loadHistory(0); }
		else {
			const rows = h.rows.filter(r => match(r.name + ' ' + r.game));
			html = `<table class="mt"><thead><tr><th>${esc(t('col_name'))}</th><th></th><th class="num">${esc(t('col_price'))}</th><th class="num">${esc(t('m_acted'))}</th><th class="num">${esc(t('m_listed'))}</th></tr></thead><tbody>
				${rows.map(r => `<tr><td>${it(r.image, r.name, r.game)}</td><td class="${r.kind}">${r.kind === 'buy' ? '+ ' + esc(t('m_bought')) : r.kind === 'sell' ? '− ' + esc(t('m_sold')) : esc(r.note)}</td><td class="num">${esc(r.price)}</td><td class="num">${esc(r.actedOn)}</td><td class="num">${esc(r.listedOn)}</td></tr>`).join('')}
				</tbody></table>${h.rows.length < h.total ? `<div class="mt-more"><button class="btn ghost" id="mMore">${esc(t('m_more', { n: h.rows.length, total: h.total }))}</button></div>` : ''}`;
		}
	}
	$('marketTable').innerHTML = html;
	sellMark();
	$('mBulk').classList.toggle('hidden', !bulk);
	$('mBulk').classList.toggle('primary', ui.mtab === 'sell');
	$('mBulk').classList.toggle('ghost', ui.mtab !== 'sell');
	if (bulk) $('mBulk').textContent = bulk;
}

// Валюты, в которых ТП Steam принимает только целые суммы (как community.WHOLE_UNITS; рубли — с копейками):
// там нельзя ставить копейки — перебивка, ордера и лоты шагом в 1 единицу. Сервер округляет так же.
const WHOLE_CUR = new Set(['JPY', 'IDR', 'VND', 'KRW', 'UAH', 'INR', 'CLP', 'COP', 'TWD', 'KZT', 'CRC', 'UYU']);
const isWhole = c => WHOLE_CUR.has(c);
const tick = c => (isWhole(c) ? 1 : 0.01);
const minPrice = c => (isWhole(c) ? 1 : 0.03);
// Цена по шагу валюты: dir 'down' / 'up' или до ближайшей
function roundPrice(v, c, dir) {
	if (v == null || !(v > 0)) return v;
	const k = v / tick(c), r = dir === 'down' ? Math.floor(k + 1e-9) : dir === 'up' ? Math.ceil(k - 1e-9) : Math.round(k);
	return Math.max(minPrice(c), Math.round(r * tick(c) * 100) / 100);
}
const pmoney = (v, c) => (isWhole(c) && Number.isInteger(Math.round(v * 100) / 100) ? fmt(v) : money(v));
const priceIn = c => `step="${tick(c)}" min="${minPrice(c)}" placeholder="${isWhole(c) ? '0' : '0.00'}"`;

// Комиссия Steam (5% + 10% игре, каждая ≥ 1 цента) — как на сервере (community.receiveFromBuyer).
function sellReceive(buyer, cy = ui.sell && ui.sell.currency) {
	const whole = isWhole(cy);
	const c = whole ? Math.max(100, Math.round(buyer) * 100) : Math.round(buyer * 100);
	const fee = r => Math.max(1, Math.floor(r * 0.05)) + Math.max(1, Math.floor(r * 0.10));
	let r = Math.max(1, Math.floor(c / 1.15));
	while (r > 1 && r + fee(r) > c) r--;
	while (r + 1 + fee(r + 1) <= c) r++;
	if (whole) while (r > 1 && (r + fee(r)) % 100) r--;  // покупатель должен платить целую сумму
	return r / 100;
}

// ---------------- продажа: выбор игры, подсказка цены (стакан, медиана, график), прибыль, продажа из ящиков
const SELL_GAMES = [[730, 'Counter-Strike 2'], [753, 'Steam'], [570, 'Dota 2'], [440, 'Team Fortress 2'], [252490, 'Rust']];
function renderSellTab(match, it, setBulk) {
	const S = ui.sell, c = S.currency;
	const rows = S.items.filter(g => match(g.name));
	const n = Object.values(S.picks).reduce((a, p) => a + (p.qty > 0 && p.price > 0 ? p.qty : 0), 0);
	if (n) setBulk(n);
	const bar = `<div class="sell-bar"><select id="mGame" class="sel-input">${SELL_GAMES.map(([id, name]) => `<option value="${id}" ${id === S.appid ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select>
		${S.appid === 730 ? `<span class="muted small">${esc(t('m_from_caskets_hint'))}</span>` : ''}${isWhole(c) ? `<span class="sell-whole small" title="${esc(t('cur_whole', { c }))}">${esc(t('cur_whole_short', { c }))}</span>` : ''}<span class="spacer"></span>
		<label class="check small"><input type="checkbox" id="mAutoConfirm" ${ui.settings.marketAutoConfirm !== false ? 'checked' : ''}> <span>${esc(t('m_auto_confirm'))}</span></label></div>`;
	if (!rows.length) return bar + `<div class="empty-box">${esc(t('m_nothing_sell'))}</div>`;
	return bar + `<table class="mt sell-table"><thead><tr><th>${esc(t('col_name'))}</th><th class="num">${esc(t('m_have'))}</th><th class="num">${esc(t('m_lot_order'))}</th><th class="num">${esc(t('col_qty'))}</th><th class="num">${esc(t('m_buyer_pays'))}</th><th class="num">${esc(t('m_you_get'))}</th></tr></thead><tbody>
		${rows.map(g => {
			const p = S.picks[g.hashName] || {};
			const q = S.quotes[g.hashName];
			const have = g.count + (g.stored || 0);
			const priceCell = q === 'loading' ? `<button class="btn ghost small sell-loading" disabled><span class="spinner tiny"></span> ${esc(t('loading'))}</button>` : q ? `<button class="sell-q" data-mquote="${esc(g.hashName)}">${q.lowestSell != null ? pmoney(q.lowestSell, c) : '—'} / ${q.highestBuy != null ? pmoney(q.highestBuy, c) : '—'}</button>`
				: `<button class="btn ghost small" data-mquote="${esc(g.hashName)}">${esc(t('m_get_price'))}</button>`;
			const get = p.price > 0 ? money(sellReceive(p.price)) + ' ' + esc(c) : '—';
			const open = S.open === g.hashName && q && q !== 'loading';
			const mkt = `https://steamcommunity.com/market/listings/${S.appid}/${encodeURIComponent(g.hashName)}`;
			return `<tr class="${open || q === 'loading' ? 'open' : ''}"><td><div class="sell-name">${it(g.image, g.name)}<button class="sell-mkt" data-open="${esc(mkt)}" title="${esc(t('m_open_market'))}"><svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div></td>
				<td class="num">${fmt(g.count)}${g.stored ? `<div class="sub" title="${esc(t('m_from_caskets_hint'))}">📦 +${fmt(g.stored)}</div>` : ''}</td><td class="num">${priceCell}</td>
				<td class="num"><span class="sell-qty"><input class="mini-in" type="number" min="0" max="${have}" value="${p.qty || ''}" placeholder="0" data-sq="${esc(g.hashName)}"><button class="btn ghost small" data-sall="${esc(g.hashName)}">${esc(t('pnl_max'))}</button></span></td>
				<td class="num"><input class="mini-in wide" type="number" ${priceIn(c)} value="${p.price || ''}" data-sp="${esc(g.hashName)}"></td>
				<td class="num" data-sget="${esc(g.hashName)}">${get}${sellProfit(g.hashName)}</td></tr>
				${q === 'loading' ? `<tr class="sell-detail"><td colspan="6"><div class="sell-quote loading"><div class="sq-stats">${Array.from({ length: 4 }, () => '<div><span class="skeleton" style="height:12px;width:90px"></span><b class="skeleton" style="height:18px;width:110px;margin-top:6px;display:block"></b></div>').join('')}</div><div class="skeleton" style="height:44px;width:240px"></div><div class="muted small">${esc(t('m_q_loading'))}</div></div></td></tr>` : ''}
				${open ? `<tr class="sell-detail"><td colspan="6"><div class="sell-quote">
					<div class="sq-stats">
						<div><span>${esc(t('m_q_lowest'))}</span><b>${q.lowestSell != null ? money(q.lowestSell) + ' ' + esc(c) : '—'}</b><em>${esc(t('m_q_listings', { n: fmt(q.sellOrders) }))}</em></div>
						<div><span>${esc(t('m_q_order'))}</span><b>${q.highestBuy != null ? money(q.highestBuy) + ' ' + esc(c) : '—'}</b><em>${esc(t('m_q_orders', { n: fmt(q.buyOrders) }))}</em></div>
						<div><span>${esc(t('m_q_median'))}</span><b>${q.median != null ? money(q.median) + ' ' + esc(c) : '—'}</b><em>${esc(t('m_q_volume', { n: fmt(q.volume) }))}</em></div>
						<div><span>${esc(t('m_q_bought'))}</span><b>${q.avgCost != null ? money(q.avgCost) + ' ' + esc(c) : '—'}</b><em>${esc(t('m_q_bought_sub'))}</em></div>
					</div>
					<div class="sq-body"><div class="bo-book">${boBook(q.asks, q.sellOrders, 'ask', c, 'slvl')}${boBook(q.bids, q.buyOrders, 'bid', c, 'slvl')}</div>${priceChart(q.history, c, 'sellChartMine')}</div>
					<div class="sq-presets">
						${q.lowestSell != null ? `<button class="btn ghost small" data-preset="undercut" data-pn="${esc(g.hashName)}">${esc(isWhole(c) ? t('m_p_undercut_u', { c }) : t('m_p_undercut'))} · ${pmoney(roundPrice(q.lowestSell - tick(c), c, 'down'), c)}</button>` : ''}
						${q.median != null ? `<button class="btn ghost small" data-preset="median" data-pn="${esc(g.hashName)}">${esc(t('m_p_median'))} · ${pmoney(roundPrice(q.median, c), c)}</button>` : ''}
						${q.highestBuy != null ? `<button class="btn ghost small" data-preset="order" data-pn="${esc(g.hashName)}" title="${esc(t('m_p_order_hint'))}">${esc(t('m_p_order'))} · ${pmoney(q.highestBuy, c)}</button>` : ''}
						<button class="btn ghost small" data-open="${esc(mkt)}">${esc(t('m_open_market'))} ↗</button>
					</div></div></td></tr>` : ''}`;
		}).join('')}</tbody></table>`;
}
// Открытая котировка продажи: пунктир выбранной цены на графике и подсветка уровня стакана
function sellMark() {
	if (!ui.sell || !ui.sell.open) return;
	const p = (ui.sell.picks[ui.sell.open] || {}).price || 0;
	markChart('sellChartMine', p);
	document.querySelectorAll('#marketTable [data-slvl]').forEach(b => b.classList.toggle('on', Number(b.dataset.slvl) === p));
}
// «вы получите» минус средняя цена покупки из «Портфеля»
function sellProfit(name) {
	const p = ui.sell.picks[name] || {}, q = ui.sell.quotes[name];
	if (!(p.price > 0) || !q || q === 'loading' || q.avgCost == null) return '';
	const d = sellReceive(p.price) - q.avgCost;
	return `<div class="sub ${signCls(d)}">${esc(t('m_profit_each', { v: (d > 0 ? '+' : '') + money(d) }))}</div>`;
}
async function loadQuote(name) {
	if (ui.sell.quotes[name] && ui.sell.quotes[name] !== 'loading') { ui.sell.open = ui.sell.open === name ? null : name; renderMarket(); return; }
	ui.sell.quotes[name] = 'loading'; renderMarket();
	try {
		const q = await apiGet(`/api/market/quote?appid=${ui.sell.appid}&name=${encodeURIComponent(name)}`);
		ui.sell.quotes[name] = q; ui.sell.open = name;
		const pick = ui.sell.picks[name] || (ui.sell.picks[name] = { qty: 0, price: 0 });
		if (!pick.price && q.lowestSell) pick.price = roundPrice(q.lowestSell - tick(ui.sell.currency), ui.sell.currency, 'down');  // на шаг (цент или целую единицу) ниже самого дешёвого лота
	} catch (e) { delete ui.sell.quotes[name]; toast(e.message, 'bad'); }
	renderMarket();
}

async function loadSellable() {
	try {
		const appid = (ui.sell && ui.sell.appid) || ui.sellAppid || 730;
		const items = await apiGet('/api/market/sellable?appid=' + appid);
		ui.sell = { appid, items, picks: {}, quotes: {}, open: null, currency: (ui.store && ui.store.currency) || ((activeAccount() || {}).currency) || '' };
		if (!ui.sell.currency && ui.state && ui.state.wallet) ui.sell.currency = ui.state.wallet.currency;
		if (ui.mtab === 'sell') renderMarket();
	} catch (e) { $('marketTable').innerHTML = `<div class="empty-box">${esc(e.message)}</div>`; }
}

async function sellNow() {
	const items = [];
	let total = 0;
	const fromCaskets = {};
	let count = 0;
	for (const g of ui.sell.items) {
		const p = ui.sell.picks[g.hashName];
		if (!p || !(p.qty > 0) || !(p.price > 0)) continue;
		for (const assetid of g.assetids.slice(0, p.qty)) { items.push({ assetid, buyerPays: p.price, appid: g.appid, contextid: g.contextid }); total += sellReceive(p.price); count++; }
		const rest = Math.min(p.qty - Math.min(p.qty, g.assetids.length), g.stored || 0);  // не хватает в инвентаре — берём из ящиков
		if (rest > 0) { fromCaskets[g.hashName] = { qty: rest, price: p.price }; total += rest * sellReceive(p.price); count += rest; }
	}
	if (!count) return;
	const fromN = Object.values(fromCaskets).reduce((a, x) => a + x.qty, 0);
	if (!(await askConfirm('sell', { title: t('m_sell'), text: t('m_sell_confirm', { n: count, total: money(total), currency: ui.sell.currency }) + (fromN ? ' ' + t('m_sell_from_caskets', { n: fmt(fromN) }) : '') })).ok) return;
	$('mBulk').disabled = true;
	toast(t('m_selling', { n: count }));
	try {
		const r = await apiPost('/api/market/sell', { items, fromCaskets });
		toast(t('m_sold_result', { n: r.listed }) + (r.confirmed ? ' · ' + t('m_auto_confirmed', { n: r.confirmed }) : r.needsConfirmation ? ' · ' + t('trade_need_confirm') : ''), r.failed.length ? 'bad' : 'good');
		if (r.failed.length) toast(r.failed[0].error, 'bad');
		ui.sellAppid = ui.sell.appid; ui.sell = null; ui.market = null; await loadMarket();
	} catch (e) { toast(e.message, 'bad'); }
	finally { $('mBulk').disabled = false; }
}

async function loadHistory(start) {
	try {
		const page = await apiGet(`/api/market/history?start=${start}&count=100`);
		ui.history = start && ui.history ? { total: page.total, rows: ui.history.rows.concat(page.rows) } : page;
		if (ui.mtab === 'history') renderMarket();
	} catch (e) { $('marketTable').innerHTML = `<div class="empty-box">${esc(e.message)}</div>`; }
}

async function marketAct(url, body, okText) {
	try { await apiPost(url, body); toast(okText, 'good'); await loadMarket(); }
	catch (e) { toast(e.message, 'bad'); }
}

$('tradeDir').addEventListener('click', e => { const b = e.target.closest('[data-dir]'); if (b) { ui.tradeDir = b.dataset.dir; ui.tradeSel = null; renderTrades(); } });
$('tradeActive').addEventListener('change', loadTrades);
$('tradesRefresh').addEventListener('click', loadTrades);
$('tradeItems').addEventListener('click', e => { const r = e.target.closest('[data-offer]'); if (r) { ui.tradeSel = r.dataset.offer; renderTrades(); } });
$('tradeDetail').addEventListener('click', e => { const b = e.target.closest('[data-tact]'); if (b) tradeAction(b.dataset.tact); });
$('giftToggle').addEventListener('change', async e => {
	try { ui.settings = await api('/api/settings', { autoAcceptGifts: e.target.checked }); toast(t(e.target.checked ? 'gift_on' : 'gift_off'), 'good'); }
	catch (err) { toast(err.message, 'bad'); }
});
$('giftsNow').addEventListener('click', async () => {
	try { const r = await apiPost('/api/trades/gifts'); toast(t('gift_accepted', { n: r.accepted }), 'good'); loadTrades(); }
	catch (e) { toast(e.message, 'bad'); }
});
$('marketRefresh').addEventListener('click', () => { ui.history = null; ui.sell = null; loadMarket(); });
$('marketTabs').addEventListener('click', e => { const b = e.target.closest('[data-mtab]'); if (b) { ui.mtab = b.dataset.mtab; renderMarket(); } });
document.querySelector('.market-stats').addEventListener('click', e => { const b = e.target.closest('[data-mtab]'); if (b) { ui.mtab = b.dataset.mtab; renderMarket(); } });
$('marketSearch').addEventListener('input', renderMarket);
$('marketTable').addEventListener('click', e => {
	const d = e.target.dataset;
	if (d.mremove) askConfirm('mremove', { text: t('m_remove_confirm') }).then(r => r.ok && marketAct('/api/market/remove', { id: d.mremove }, t('m_removed')));
	if (d.mcancel) askConfirm('mremove', { text: t('m_cancel_confirm') }).then(r => r.ok && marketAct('/api/market/cancelorder', { id: d.mcancel }, t('m_cancelled')));
	if (d.callow) marketAct('/api/confirmations', { ids: [d.callow], accept: true }, t('m_confirmed'));
	if (d.cdeny) marketAct('/api/confirmations', { ids: [d.cdeny], accept: false }, t('m_denied'));
	if (e.target.id === 'mMore') { e.target.disabled = true; loadHistory(ui.history.rows.length); }
	if (e.target.id === 'boNew') { openBuyOrder(); return; }
	const ob = e.target.closest('[data-open]');
	if (ob) { openExt(ob.dataset.open); return; }
	const qb = e.target.closest('[data-mquote]');
	if (qb) loadQuote(qb.dataset.mquote);
	const lv = e.target.closest('[data-slvl]');
	if (lv && ui.sell && ui.sell.open) {   // уровень стакана — взять его цену
		const pick = ui.sell.picks[ui.sell.open] || (ui.sell.picks[ui.sell.open] = { qty: 0, price: 0 });
		pick.price = roundPrice(Number(lv.dataset.slvl), ui.sell.currency);
		if (!pick.qty) pick.qty = 1;
		renderMarket();
	}
	const pb = e.target.closest('[data-preset]');
	if (pb) {
		const name = pb.dataset.pn, q = ui.sell.quotes[name];
		const pick = ui.sell.picks[name] || (ui.sell.picks[name] = { qty: 0, price: 0 });
		const c = ui.sell.currency;
		pick.price = pb.dataset.preset === 'undercut' ? roundPrice(q.lowestSell - tick(c), c, 'down') : roundPrice(pb.dataset.preset === 'median' ? q.median : q.highestBuy, c);
		if (!pick.qty) pick.qty = 1;
		renderMarket();
	}
	const all = e.target.closest('[data-sall]');
	if (all) {
		const g = ui.sell.items.find(x => x.hashName === all.dataset.sall);
		const pick = ui.sell.picks[g.hashName] || (ui.sell.picks[g.hashName] = { qty: 0, price: 0 });
		pick.qty = g.count + (g.stored || 0);
		renderMarket();
	}
});
$('marketTable').addEventListener('change', e => {
	// без копеек: введённую цену сразу показываем округлённой
	if (e.target.dataset.sp && ui.sell) { const p = ui.sell.picks[e.target.dataset.sp]; if (p && p.price > 0) e.target.value = p.price; }
	if (e.target.id === 'mGame') { ui.sellAppid = Number(e.target.value); ui.sell = null; renderMarket(); }
	if (e.target.id === 'mAutoConfirm') saveSetting({ marketAutoConfirm: e.target.checked });
});
$('marketTable').addEventListener('input', e => {
	const d = e.target.dataset, name = d.sq || d.sp;
	if (!name || !ui.sell) return;
	const g = ui.sell.items.find(x => x.hashName === name);
	const p = ui.sell.picks[name] || (ui.sell.picks[name] = { qty: 0, price: 0 });
	if (d.sq) p.qty = Math.max(0, Math.min(g.count + (g.stored || 0), Math.floor(Number(e.target.value) || 0)));
	if (d.sp) p.price = roundPrice(Math.max(0, Number(e.target.value) || 0), ui.sell.currency) || 0;
	const cell = document.querySelector(`[data-sget="${CSS.escape(name)}"]`);
	if (cell) cell.innerHTML = (p.price > 0 ? `${money(sellReceive(p.price))} ${esc(ui.sell.currency)}` : '—') + sellProfit(name);
	if (name === ui.sell.open) sellMark();
	const n = Object.values(ui.sell.picks).reduce((a, x) => a + (x.qty > 0 && x.price > 0 ? x.qty : 0), 0);
	$('mBulk').classList.toggle('hidden', !n);
	if (n) $('mBulk').textContent = t('m_sell_go', { n });
});
$('mBulk').addEventListener('click', () => {
	if (ui.mtab === 'sell') return sellNow();
	const q = ($('marketSearch').value || '').toLowerCase();
	const ids = (ui.market.confirmations || []).filter(c => !q || (c.title + ' ' + c.summary.join(' ')).toLowerCase().includes(q)).map(c => c.id);
	if (ids.length) miniConfirm({ title: t('m_confirm_all', { n: ids.length }), text: t('guard_confirm_all') }).then(r => r.ok && marketAct('/api/confirmations', { ids, accept: true }, t('m_confirmed')));
});

// ---------------- ордер на покупку: стакан (лоты и ордера), график за 30 дней, место в очереди
function boCur() { return (ui.bo && ui.bo.quote && ui.bo.quote.currency) || (ui.state && ui.state.wallet && ui.state.wallet.currency) || ''; }
function boSetStep() {
	const c = boCur();
	$('boPrice').step = tick(c); $('boPrice').min = minPrice(c); $('boPrice').placeholder = isWhole(c) ? '0' : '0.00';
}
function openBuyOrder(name) {
	ui.bo = { quote: null };
	$('boName').value = name || '';
	$('boPrice').value = ''; $('boQty').value = 1;
	$('boQuote').classList.add('hidden'); $('boQuote').innerHTML = '';
	boSetStep();
	boTotal();
	$('boModal').classList.remove('hidden');
	if (name) boLoadQuote(name); else $('boName').focus();
}
function boTotal() {
	const c = boCur();
	const p = roundPrice(Number($('boPrice').value) || 0, c) || 0, q = Math.max(1, Math.floor(Number($('boQty').value) || 1));
	$('boTotal').textContent = p > 0 ? `${money(p * q)} ${c}` : '—';
	const bal = ui.state && ui.state.wallet ? ui.state.wallet.balance : null;
	$('boTotal').classList.toggle('bad-text', bal != null && p * q > bal);
	// где окажется ордер: лот уходит самому старому ордеру с ценой ≥ лота, так что впереди — все ордера не дешевле
	const Q = ui.bo && ui.bo.quote, note = $('boQueue');
	let txt = '';
	if (Q && p > 0) {
		if (Q.lowestSell != null && p >= Q.lowestSell) txt = t('bo_instant');
		else if (Q.bids && Q.bids.length) { const ahead = Q.bids.filter(x => x.price >= p).reduce((n, x) => n + x.qty, 0); txt = ahead ? t('bo_queue', { n: fmt(ahead) }) : t('bo_first'); }
	}
	note.textContent = txt; note.classList.toggle('hidden', !txt);
	document.querySelectorAll('#boQuote [data-bo]').forEach(b => b.classList.toggle('on', Number(b.dataset.bo) === p));
	markChart('boChartMine', p);
}
// График средних цен по дням + пунктир вашей цены (id — для markChart; общий для ордера и продажи)
const charts = {};
function priceChart(hist, c, id) {
	charts[id] = null;
	if (!hist || hist.length < 2) return `<div class="bo-chart-empty muted small">${esc(t('pv_history_empty'))}</div>`;
	const W = 520, H = 72, v = hist.map(h => h.price), lo = Math.min(...v), hi = Math.max(...v), span = (hi - lo) || hi * 0.1 || 1;
	const y = p => (H - 6 - (p - lo) / span * (H - 14)).toFixed(1);
	const pts = v.map((p, i) => `${(i / (v.length - 1) * W).toFixed(1)},${y(p)}`);
	charts[id] = { lo, span, H };
	return `<div class="bo-chart ${v[v.length - 1] >= v[0] ? 'up' : 'down'}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
		<polygon points="0,${H} ${pts.join(' ')} ${W},${H}" fill="currentColor" opacity=".12"/>
		<polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/>
		<line id="${id}" x1="0" x2="${W}" y1="-10" y2="-10" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/></svg>
		<div class="bo-chart-l"><span>${esc(pmoney(hi, c))}</span><span>${esc(pmoney(lo, c))}</span></div>
		<div class="bo-chart-b muted"><span>${esc(t('m_q_30d'))}</span><span>${esc(t('bo_chart_last'))}: <b>${esc(pmoney(v[v.length - 1], c))} ${esc(c)}</b></span></div></div>`;
}
function markChart(id, p) {
	const line = document.getElementById(id), ch = charts[id];
	if (!line || !ch) return;
	const yy = p > 0 ? ch.H - 6 - (p - ch.lo) / ch.span * (ch.H - 14) : -10;
	const v = yy < 0 || yy > ch.H ? -10 : yy;
	line.setAttribute('y1', v); line.setAttribute('y2', v);
}
// Колонка стакана: цена · штук, полоса — накопленная глубина
function boBook(levels, total, side, c, attr = 'bo') {
	if (!levels || !levels.length) return `<div class="bo-book-col"><div class="bo-book-h">${esc(t(side === 'ask' ? 'bo_asks' : 'bo_bids'))}</div><div class="muted small bo-book-empty">${esc(t('bo_book_empty'))}</div></div>`;
	const rows = levels.slice(0, 5);
	let acc = 0; const cum = rows.map(r => (acc += r.qty));
	const max = cum[cum.length - 1] || 1;
	const shown = cum[cum.length - 1], rest = Math.max(0, (total || 0) - shown);
	return `<div class="bo-book-col ${side}"><div class="bo-book-h">${esc(t(side === 'ask' ? 'bo_asks' : 'bo_bids'))}<em>${esc(fmt(total || shown))}</em></div>
		${rows.map((r, i) => `<button class="bo-lvl" data-${attr}="${r.price}" title="${esc(t('bo_lvl_pick'))}"><i style="width:${(cum[i] / max * 100).toFixed(1)}%"></i><span>${esc(pmoney(r.price, c))}</span><b>${esc(fmt(r.qty))}</b></button>`).join('')}
		${rest > 0 ? `<div class="bo-book-more muted">${esc(t('bo_book_more', { n: fmt(rest) }))}</div>` : ''}</div>`;
}
async function boLoadQuote(name) {
	$('boQuote').classList.remove('hidden');
	$('boQuote').innerHTML = `<div class="bo-loading"><span class="spinner tiny"></span> ${esc(t('m_q_loading'))}</div>`;
	try {
		const q = await apiGet(`/api/market/quote?appid=730&name=${encodeURIComponent(name)}`);
		if ($('boName').value !== name) return;
		ui.bo.quote = q;
		boSetStep();
		const c = q.currency, mkt = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(name)}`;
		const outbid = q.highestBuy != null ? roundPrice(q.highestBuy + tick(c), c) : null;
		$('boQuote').innerHTML = `<div class="sq-stats bo-stats">
				<div><span>${esc(t('m_q_order'))}</span><b>${q.highestBuy != null ? pmoney(q.highestBuy, c) + ' ' + esc(c) : '—'}</b><em>${esc(t('m_q_orders', { n: fmt(q.buyOrders) }))}</em></div>
				<div><span>${esc(t('m_q_lowest'))}</span><b>${q.lowestSell != null ? pmoney(q.lowestSell, c) + ' ' + esc(c) : '—'}</b><em>${esc(t('m_q_listings', { n: fmt(q.sellOrders) }))}</em></div>
				<div><span>${esc(t('m_q_median'))}</span><b>${q.median != null ? money(q.median) + ' ' + esc(c) : '—'}</b><em>${esc(t('m_q_volume', { n: fmt(q.volume) }))}</em></div>
			</div>
			<div class="bo-book">${boBook(q.asks, q.sellOrders, 'ask', c)}${boBook(q.bids, q.buyOrders, 'bid', c)}</div>
			${priceChart(q.history, c, 'boChartMine')}
			<div class="bo-presets">
				${outbid != null ? `<button class="btn ghost small" data-bo="${outbid}">${esc(isWhole(c) ? t('bo_p_outbid_u', { c }) : t('bo_p_outbid'))} · ${pmoney(outbid, c)}</button>` : ''}
				${q.highestBuy != null ? `<button class="btn ghost small" data-bo="${q.highestBuy}">${esc(t('bo_p_same'))} · ${pmoney(q.highestBuy, c)}</button>` : ''}
				${q.median != null ? `<button class="btn ghost small" data-bo="${roundPrice(q.median, c)}">${esc(t('m_p_median'))} · ${pmoney(roundPrice(q.median, c), c)}</button>` : ''}
				<button class="btn ghost small" data-open="${esc(mkt)}">${esc(t('m_open_market'))} ↗</button>
				${isWhole(c) ? `<span class="sell-whole small bo-whole" title="${esc(t('cur_whole', { c }))}">${esc(t('cur_whole_short', { c }))}</span>` : ''}
			</div>`;
		if (!$('boPrice').value && outbid != null) $('boPrice').value = outbid;
		boTotal();
	} catch (e) { $('boQuote').innerHTML = `<div class="muted small">${esc(e.message)}</div>`; }
}
combo($('boName'), { source: q => (q.length < 2 ? [] : apiGet('/api/market/search?q=' + encodeURIComponent(q))), onPick: x => { $('boPrice').value = ''; boLoadQuote(x.name); } });
$('boQuote').addEventListener('click', e => {
	const b = e.target.closest('[data-bo]'); if (b) { $('boPrice').value = b.dataset.bo; boTotal(); }
	const o = e.target.closest('[data-open]'); if (o) openExt(o.dataset.open);
});
$('boPrice').addEventListener('input', boTotal);
$('boPrice').addEventListener('change', () => { const v = roundPrice(Number($('boPrice').value) || 0, boCur()); if (v > 0) $('boPrice').value = v; boTotal(); });
$('boQty').addEventListener('input', boTotal);
$('boCancel').addEventListener('click', () => $('boModal').classList.add('hidden'));
$('boCreate').addEventListener('click', async () => {
	const c = boCur();
	const name = $('boName').value.trim(), price = roundPrice(Number($('boPrice').value), c), qty = Math.floor(Number($('boQty').value));
	if (!name || !(price >= minPrice(c)) || !(qty >= 1)) return toast(t('bo_check'), 'bad');
	// деньги резервируются — подтверждение обязательно, без «больше не показывать»
	const r = await miniConfirm({ icon: ICON_WALLET, title: t('bo_title'), text: t('bo_confirm', { n: qty, name, price: `${money(price)} ${c}`, total: `${money(price * qty)} ${c}` }), ok: t('bo_create') });
	if (!r.ok) return;
	$('boCreate').disabled = true;
	try {
		const x = await apiPost('/api/market/buyorder', { appid: 730, name, price, quantity: qty });
		if (x.ok) { toast(t('bo_done'), 'good'); $('boModal').classList.add('hidden'); ui.market = null; loadMarket(); }
		else toast(x.message || t('bo_check'), 'bad');
	} catch (e) { toast(e.message, 'bad'); }
	$('boCreate').disabled = false;
});

// ============================================================ Steam Guard (мини-SDA)
async function loadGuard() {
	// Возврат во вкладку: сразу показываем то, что уже есть, обновляем в фоне.
	if (ui.guard) renderGuard();
	else $('guardList').innerHTML = Array.from({ length: 4 }, () => '<div class="skeleton" style="height:64px"></div>').join('');
	clearInterval(ui.guardTimer);
	ui.guardTimer = setInterval(guardTick, 1000);
	try {
		const [accounts, codes] = await Promise.all([api('/api/guard/accounts'), api('/api/guard/codes')]);
		ui.guard = { accounts, codes, at: Date.now(), conf: (ui.guard && ui.guard.conf) || {} };
		if (!ui.guardSel || !accounts.some(a => a.login === ui.guardSel)) ui.guardSel = (accounts.find(a => a.login === ui.active) || accounts[0] || {}).login || null;
		renderGuard();
		const c = ui.guardSel && ui.guard.conf[ui.guardSel];
		if (ui.guardSel && (!c || !c.at || Date.now() - c.at > 30000)) loadGuardConf(ui.guardSel);
	} catch (e) { if (!ui.guard) $('guardList').innerHTML = `<div class="empty-box">${esc(e.message)}</div>`; }
}

// Обратный отсчёт кода; на смене 30-секундного окна берём новые коды.
async function guardTick() {
	if (ui.tab !== 'guard' || !ui.guard) { clearInterval(ui.guardTimer); return; }
	const left = guardLeft();
	if (left >= ui.guard.codes.period - 0.5 || left <= 0) {
		try { ui.guard.codes = await api('/api/guard/codes'); ui.guard.at = Date.now(); } catch (e) { /* следующая секунда */ }
	}
	syncGuardRings();
	document.querySelectorAll('[data-gcode]').forEach(el => { el.textContent = ui.guard.codes.codes[el.dataset.gcode] || '—'; });
	document.querySelectorAll('[data-gleft]').forEach(el => { el.textContent = `${Math.ceil(guardLeft())} s`; });
}
const guardLeft = () => Math.max(0, ui.guard.codes.left - (Date.now() - ui.guard.at) / 1000);

// Полоска таймера: плавно в пределах периода; на скачках (новый код, возврат в окно, перерисовка) — без анимации.
function syncGuardRings() {
	if (!ui.guard) return;
	const pct = guardLeft() / ui.guard.codes.period * 100;
	document.querySelectorAll('[data-gring]').forEach(el => {
		const cur = parseFloat(el.style.width) || 0;
		if (Math.abs(cur - pct) > 6 || !el.dataset.ready) { el.style.transition = 'none'; el.style.width = `${pct}%`; void el.offsetWidth; el.style.transition = ''; el.dataset.ready = '1'; }
		else el.style.width = `${pct}%`;
	});
}

// Окно снова активно — сразу догоняем таймер и коды (пока окно было свёрнуто, таймеры замедлялись).
document.addEventListener('visibilitychange', () => { if (!document.hidden && ui.tab === 'guard' && ui.guard) guardTick(); });
window.addEventListener('focus', () => { if (ui.tab === 'guard' && ui.guard) guardTick(); });

function renderGuard() {
	const g = ui.guard; if (!g) return;
	const badProxy = g.accounts.filter(a => a.proxyStatus && !a.proxyStatus.ok).length;
	$('guardTopBadge').classList.toggle('hidden', !badProxy); $('guardTopBadge').textContent = badProxy;
	$('guardList').innerHTML = g.accounts.map(a => {
		const code = g.codes.codes[a.login];
		const px = !a.proxy ? '' : a.proxyStatus ? (a.proxyStatus.ok ? `<span class="g-proxy-ok">● ${esc(t('proxy_ok'))}</span>` : `<span class="g-proxy-bad">● ${esc(t('proxy_bad'))}</span>`) : `<span class="muted">● ${esc(t('proxy_label'))}</span>`;
		return `<div class="g-acc ${a.login === ui.guardSel ? 'sel' : ''}" data-gacc="${esc(a.login)}">
			${avatarHtml(a)}
			<div style="min-width:0"><div class="strong" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(accName(a))}</div>
				<div class="sub">${a.online ? `<span class="g-proxy-ok">● ${esc(t('online'))}</span>` : `<span>${esc(accSub(a) || (streamer() ? '' : a.login))}</span>`}${px}${a.wallet ? `<span class="good-text">${esc(walletText(a.wallet))}</span>` : ''}</div></div>
			${code ? `<div style="text-align:right"><div class="g-code" data-gcode="${esc(a.login)}" data-gcopy="${esc(a.login)}" title="${esc(t('copy'))}">${esc(code)}</div><div class="g-ring"><i data-gring></i></div></div>`
				: `<button class="btn ghost small" data-gadd="${esc(a.login)}">${esc(t('guard_add_mafile'))}</button>`}
		</div>`;
	}).join('') || `<div class="empty-box">${esc(t('guard_no_accounts'))}</div>`;
	renderGuardDetail();
	syncGuardRings();
}

function renderGuardDetail() {
	const g = ui.guard; const a = g && g.accounts.find(x => x.login === ui.guardSel);
	if (!a) { $('guardDetail').innerHTML = `<div class="empty-box">${esc(t('guard_pick'))}</div>`; return; }
	const code = g.codes.codes[a.login];
	const conf = g.conf[a.login];
	const head = `<div class="g-head">${avatarHtml(a)}<div style="flex:1"><div class="strong">${esc(accName(a))}</div><div class="muted small">${esc(streamer() ? '' : a.login)}${a.proxy ? ` · ${esc(t('proxy_label'))}: ${a.proxyStatus ? (a.proxyStatus.ok ? t('proxy_ok') : `<span class="g-proxy-bad">${esc(t('proxy_bad'))}</span>`) : '…'}` : ''}</div></div>
		${a.proxy ? `<button class="btn ghost small" data-gproxy="${esc(a.login)}">${esc(t('proxy_check'))}</button>` : ''}</div>`;
	if (!code) {
		$('guardDetail').innerHTML = head + `<div class="g-add"><div class="strong">${esc(t('guard_no_mafile_t'))}</div>
			<p class="muted small" style="margin:6px 0 12px">${esc(t('guard_no_mafile'))}</p>
			<button class="btn primary" data-gadd="${esc(a.login)}">${esc(t('guard_add_mafile'))}</button></div>`;
		return;
	}
	$('guardDetail').innerHTML = head + `
		<div class="card" style="padding:16px;display:flex;align-items:center;gap:16px">
			<div><div class="muted small">Steam Guard</div><div class="g-big-code" data-gcode="${esc(a.login)}">${esc(code)}</div></div>
			<div style="flex:1"><div class="g-ring"><i data-gring></i></div><div class="muted small" data-gleft style="margin-top:4px"></div></div>
			<button class="btn primary" data-gcopy="${esc(a.login)}">${esc(t('copy'))}</button>
		</div>
		<div id="gConfBox"></div>`;
	syncGuardRings();
	renderGuardConf();
}

// Подтверждения — отдельный блок: обновляется сам, не трогая код и таймер.
function renderGuardConf() {
	const box = document.getElementById('gConfBox'); if (!box) return;
	const g = ui.guard; const a = g && g.accounts.find(x => x.login === ui.guardSel); if (!a) return;
	const conf = g.conf[a.login];
	let confHtml;
	if (!a.canConfirm) confHtml = `<div class="muted small">${esc(t('guard_no_identity'))}</div>`;
	else if (!conf || (conf.loading && !conf.list)) confHtml = '<div class="skeleton" style="height:120px"></div>';
	else if (conf.error) confHtml = `<div class="empty-box">${esc(conf.error)}</div>`;
	else if (!conf.list.length) confHtml = `<div class="empty-box">${esc(t('m_no_confirm'))}</div>`;
	else confHtml = conf.list.map(c => `<div class="g-conf">${c.icon ? `<img src="${esc(c.icon)}" alt="">` : '<span></span>'}
		<div style="min-width:0"><div class="strong pii">${esc(c.title)}</div><div class="muted small">${esc(c.typeName || '')} · ${esc(c.summary.join(' · '))} · ${esc(tsDate(c.time))}</div></div>
		<div class="acts"><button class="btn ghost small" data-gdeny="${esc(c.id)}">${esc(t('decline'))}</button><button class="btn good small" data-gallow="${esc(c.id)}">${esc(t('confirm'))}</button></div></div>`).join('');
	box.innerHTML = `
		<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><div class="section-title" style="flex:1">${esc(t('m_confirm'))}${conf && conf.list ? ` · ${conf.list.length}` : ''}${conf && conf.loading ? ' <span class="spinner tiny"></span>' : ''}</div>
			${conf && conf.list && conf.list.length > 1 ? `<button class="btn good small" data-gallowall="1">${esc(t('m_confirm_all', { n: conf.list.length }))}</button>` : ''}
			${a.canConfirm ? `<button class="btn ghost small" data-gconfreload="1">${esc(t('refresh'))}</button>` : ''}</div>
		<div style="display:flex;flex-direction:column;gap:8px">${confHtml}</div>`;
}

async function loadGuardConf(login) {
	const a = ui.guard.accounts.find(x => x.login === login);
	if (!a || !a.canConfirm || !ui.guard.codes.codes[login]) return;
	const prev = ui.guard.conf[login];
	ui.guard.conf[login] = { ...(prev || {}), loading: true };  // старый список остаётся на экране, пока грузится новый
	if (ui.guardSel === login) renderGuardConf();
	try { ui.guard.conf[login] = { list: await api('/api/guard/confirmations?login=' + encodeURIComponent(login)), at: Date.now() }; }
	catch (e) { ui.guard.conf[login] = { error: e.message, at: Date.now() }; }
	if (ui.guardSel === login) renderGuardConf();
}

async function guardRespond(ids, accept) {
	const login = ui.guardSel;
	try {
		await api('/api/guard/confirmations', { login, ids, accept });
		toast(t(accept ? 'm_confirmed' : 'm_denied'), 'good');
	} catch (e) { toast(e.message, 'bad'); }
	loadGuardConf(login);
}

$('guardList').addEventListener('click', e => {
	const add = e.target.closest('[data-gadd]'); if (add) { ui.guardAddFor = add.dataset.gadd; $('guardMaFileInput').value = ''; $('guardMaFileInput').click(); return; }
	const cp = e.target.closest('[data-gcopy]'); if (cp) { copyText(ui.guard.codes.codes[cp.dataset.gcopy] || ''); return; }
	const row = e.target.closest('[data-gacc]');
	if (row && row.dataset.gacc !== ui.guardSel) { ui.guardSel = row.dataset.gacc; renderGuard(); loadGuardConf(ui.guardSel); }
});
$('guardDetail').addEventListener('click', async e => {
	const d = e.target.closest('button') ? e.target.closest('button').dataset : {};
	if (d.gadd) { ui.guardAddFor = d.gadd; $('guardMaFileInput').value = ''; $('guardMaFileInput').click(); }
	if (d.gcopy) copyText(ui.guard.codes.codes[d.gcopy] || '');
	if (d.gallow) guardRespond([d.gallow], true);
	if (d.gdeny) guardRespond([d.gdeny], false);
	if (d.gallowall) { const list = (ui.guard.conf[ui.guardSel] || {}).list || []; const r = await miniConfirm({ title: t('m_confirm_all', { n: list.length }), text: t('guard_confirm_all'), ok: t('confirm') }); if (r.ok) guardRespond(list.map(c => c.id), true); }
	if (d.gconfreload) loadGuardConf(ui.guardSel);
	if (d.gproxy) { try { const r = await api('/api/guard/proxycheck', { login: d.gproxy }); toast(r.ok ? t('proxy_ok') : `${t('proxy_bad')}: ${r.error}`, r.ok ? 'good' : 'bad'); loadGuard(); } catch (err) { toast(err.message, 'bad'); } }
});
$('guardMaFileInput').addEventListener('change', e => {
	const f = e.target.files[0]; if (!f || !ui.guardAddFor) return;
	const r = new FileReader();
	r.onload = async () => {
		try {
			const ma = JSON.parse(r.result);
			await api('/api/guard/mafile', { login: ui.guardAddFor, maFile: ma });
			toast(t('guard_mafile_added', { login: loginName(ui.guardAddFor) }), 'good');
			ui.guardSel = ui.guardAddFor; loadGuard();
		} catch (err) { toast(err.message || t('mafile_bad'), 'bad'); }
	};
	r.readAsText(f);
});
$('guardRefresh').addEventListener('click', loadGuard);

// Уведомления сервера (например, прокси перестал работать) — тост + системное уведомление.
function handleAlerts(alerts) {
	if (!alerts || !alerts.length) return;
	if (ui.alertSeen == null) { ui.alertSeen = alerts[alerts.length - 1].id; return; }  // старые не показываем
	for (const a of alerts.filter(x => x.id > ui.alertSeen)) {
		const text = a.kind === 'proxy_bad' ? t('alert_proxy_bad', { login: loginName(a.login) }) : t('alert_proxy_ok', { login: loginName(a.login) });
		toast(text + (a.error ? ` — ${a.error}` : ''), a.kind === 'proxy_bad' ? 'bad' : 'good');
		try { if (a.kind === 'proxy_bad' && window.Notification && Notification.permission !== 'denied') new Notification('Caskit', { body: text }); } catch (e) { /* без системных уведомлений */ }
	}
	ui.alertSeen = alerts[alerts.length - 1].id;
	if (ui.tab === 'guard') loadGuard();
}

// ============================================================ первый запуск: приветствие и гайд
const GITHUB_URL = 'https://github.com/pythonMaster2002/cs2-storage-manager';
document.querySelectorAll('[data-gh]').forEach(b => b.addEventListener('click', () => openExt(GITHUB_URL)));  // ссылки на репозиторий в настройках

function maybeWelcome() {
	if (ui.settings.welcomed) return;
	if (window.desktop) window.desktop.version().then(v => { $('welcomeVersion').textContent = v; });
	else $('welcomeVersion').textContent = '—';
	$('welcomeModal').classList.remove('hidden');
}

// Гайд: подсвечиваем элементы по очереди. Запускается один раз после первого входа (или из настроек).
// Шаги переключают вкладки и показывают, как делать сложные вещи (а не очевидные элементы).
// el — список селекторов: берётся первый видимый (например, если ящиков нет — подсвечиваем пустой экран).
const TOUR = [
	{ tab: 'caskets', el: ['#casketList .casket', '#casketList', '#emptyState'], key: 'tour_c1' },
	{ tab: 'caskets', el: ['#modeSwitch'], key: 'tour_c2', before: () => { if (!ui.casketId && ui.state && ui.state.caskets[0]) selectCasket(ui.state.caskets[0].id); } },
	{ tab: 'caskets', el: ['#itemList .stepper', '#itemList'], key: 'tour_c3' },
	{ tab: 'caskets', el: ['#actionBtn'], key: 'tour_c4' },
	{ tab: 'caskets', el: ['#rulesBtn'], key: 'tour_c5' },
	{ tab: 'store', el: ['#storeGrid .store-card .qty', '#storeGrid'], key: 'tour_s1' },
	{ tab: 'store', el: ['#cartBtn'], key: 'tour_s2' },
	{ tab: 'guard', el: ['#guardList .g-acc', '#guardList'], key: 'tour_g1' },
	{ tab: 'guard', el: ['#guardDetail'], key: 'tour_g2' },
	{ tab: 'trades', el: ['#giftToggle'], key: 'tour_t1', target: el => el.closest('label') || el },
	{ tab: null, el: ['#sideNav'], key: 'tour_nav' },
];

function startTour() {
	ui.tourStep = 0;
	$('tour').classList.remove('hidden');
	showTourStep();
}

function endTour() {
	$('tour').classList.add('hidden');
	ui.tourStep = null;
	switchTab('caskets');
	if (!ui.settings.tourDone) saveSetting({ tourDone: true });
}

async function showTourStep() {
	const st = TOUR[ui.tourStep];
	if (!st) return endTour();
	if (st.tab && ui.tab !== st.tab) { switchTab(st.tab); await sleep(450); }
	if (st.before) { try { await st.before(); } catch (e) { /* шаг без подготовки */ } await sleep(350); }
	if (ui.tourStep == null) return;
	let el = null;
	for (const sel of st.el) { const x = document.querySelector(sel); if (x && x.getBoundingClientRect().width) { el = x; break; } }
	if (el && st.target) el = st.target(el);
	if (!el) { ui.tourStep++; return showTourStep(); }
	const r = el.getBoundingClientRect(), pad = 6;
	Object.assign($('tourSpot').style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${Math.min(r.height, innerHeight - r.top - 10) + pad * 2}px` });
	$('tourStep').textContent = `${ui.tourStep + 1} / ${TOUR.length}`;
	$('tourTitle').textContent = t(st.key + '_t');
	$('tourText').textContent = t(st.key);
	$('tourNext').textContent = ui.tourStep === TOUR.length - 1 ? t('tour_done') : t('next');
	const card = $('tourCard'), cw = 340, ch = card.offsetHeight || 180, W = innerWidth, H = innerHeight;
	let left = r.right + 16, top = Math.max(12, r.top);
	if (left + cw > W - 12) { left = Math.max(12, Math.min(W - cw - 12, r.left)); top = r.bottom + 16; }
	if (top + ch > H - 12) top = Math.max(12, r.top - ch - 16);
	if (top < 12 || r.height > H * 0.6) { top = Math.max(12, Math.min(H - ch - 12, r.top + 20)); left = Math.max(12, Math.min(W - cw - 12, r.right - cw - 20)); }
	Object.assign(card.style, { left: `${left}px`, top: `${top}px` });
}

function maybeTour() {
	if (ui.settings.welcomed && !ui.settings.tourDone && ui.tourStep == null && !$('mainView').classList.contains('hidden')) setTimeout(startTour, 600);
}

$('welcomeStart').addEventListener('click', () => { $('welcomeModal').classList.add('hidden'); saveSetting({ welcomed: true }).then(maybeTour); });
$('welcomeGithub').addEventListener('click', () => openExt(GITHUB_URL));
$('welcomeSupport').addEventListener('click', () => openSupport());
$('tourNext').addEventListener('click', () => { if (ui.tourStep == null) return; ui.tourStep++; showTourStep(); });
$('tourSkip').addEventListener('click', endTour);
$('settingsTour').addEventListener('click', () => { $('settingsModal').classList.add('hidden'); startTour(); });
$('settingsAbout').addEventListener('click', () => { $('settingsModal').classList.add('hidden'); if (window.desktop) window.desktop.version().then(v => { $('welcomeVersion').textContent = v; }); $('welcomeModal').classList.remove('hidden'); });
window.addEventListener('resize', () => { if (ui.tourStep != null) showTourStep(); });

// ============================================================ поддержка разработчика
const openExt = url => { if (window.desktop && window.desktop.openExternal) window.desktop.openExternal(url); else window.open(url, '_blank'); };

async function copyText(text) {
	try { await navigator.clipboard.writeText(text); }
	catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
	toast(t('copied'), 'good');
}

// Реквизиты поддержки: одно и то же в окне «Поддержать» и в «Настройки → Caskit»
async function renderSupport(box) {
	if (!ui.support) { try { ui.support = await api('/api/support'); } catch (e) { ui.support = {}; } }
	const s = ui.support, rows = [];
	if (s.steamTrade) rows.push(`<div class="sup"><div class="grow"><div class="strong">${esc(t('sup_skin'))}</div><div class="muted small">${esc(t('sup_skin_hint'))}</div></div><button class="btn primary small" data-open="${esc(s.steamTrade)}">${esc(t('sup_skin_btn'))}</button></div>`);
	if (s.kofi) rows.push(`<div class="sup"><div class="grow"><div class="strong">Ko-fi</div><div class="muted small">${esc(t('sup_kofi_hint'))}</div></div><button class="btn primary small" data-open="${esc(s.kofi)}">${esc(t('sup_kofi_btn'))}</button></div>`);
	if (s.binancePayId) rows.push(`<div class="sup"><div class="grow"><div class="strong">Binance Pay <span class="sup-tag">${esc(t('sup_nofee'))}</span></div><div class="muted small">${esc(t('sup_binance_hint'))}</div><div class="addr">Binance ID (UID): ${esc(s.binancePayId)}</div></div><button class="btn ghost small" data-copy="${esc(s.binancePayId)}">${esc(t('copy'))}</button></div>`);
	for (const c of (s.crypto || []).filter(c => c.address)) {
		rows.push(`<div class="sup"><img class="qr" data-qr="${esc(c.address)}" alt=""><div class="grow"><div class="strong">${esc(c.label)}</div><div class="addr">${esc(c.address)}</div><div class="muted small" style="margin-top:4px">${esc(t('sup_crypto_hint'))}</div></div><button class="btn ghost small" data-copy="${esc(c.address)}">${esc(t('copy'))}</button></div>`);
	}
	if (s.github) rows.push(`<div class="sup"><div class="grow"><div class="strong">GitHub ★</div><div class="muted small">${esc(t('sup_star_hint'))}</div></div><button class="btn ghost small" data-open="${esc(s.github)}">GitHub</button></div>`);
	box.innerHTML = rows.join('') || `<div class="empty-box">—</div>`;
	for (const img of box.querySelectorAll('[data-qr]')) {
		api('/api/qr?text=' + encodeURIComponent(img.dataset.qr)).then(r => { img.src = r.dataUrl; }).catch(() => img.remove());
	}
}
function openSupport() { $('supportModal').classList.remove('hidden'); renderSupport($('supportList')); }

$('loginSupport').addEventListener('click', openSupport);
$('supportClose').addEventListener('click', () => $('supportModal').classList.add('hidden'));
for (const box of [$('supportList'), $('setSupportList')]) box.addEventListener('click', e => {
	const b = e.target.closest('[data-open],[data-copy]'); if (!b) return;
	if (b.dataset.open) openExt(b.dataset.open);
	if (b.dataset.copy) copyText(b.dataset.copy);
});


// ============================================================ наклейки
async function loadStickers() {
	$('stWeapons').innerHTML = Array.from({ length: 5 }, () => '<div class="skeleton" style="height:96px"></div>').join('');
	try { ui.stk = await apiGet('/api/stickers'); if (ui.stkSel && !ui.stk.stickers.some(s => s.stickerId === ui.stkSel)) ui.stkSel = null; renderStickers(); }
	catch (e) { $('stWeapons').innerHTML = `<div class="empty-box">${esc(e.message)}</div>`; $('stStickers').innerHTML = ''; }
}

function renderStickers() {
	const d = ui.stk; if (!d) return;
	const q = ($('stSearch').value || '').toLowerCase();
	const sel = ui.stkSel != null ? d.stickers.find(s => s.stickerId === ui.stkSel) : null;
	$('stHint').textContent = sel ? t('st_pick_slot', { name: sel.name }) : t('st_pick_sticker');
	$('stStickers').innerHTML = d.stickers.length ? d.stickers.map(s => `<div class="st-stk ${s.stickerId === ui.stkSel ? 'sel' : ''}" data-stk="${s.stickerId}">
		${s.image ? `<img src="${esc(s.image)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<div style="min-width:0;flex:1"><div style="font-size:12.5px">${esc(s.name)}</div><div class="muted small">×${s.count}</div></div></div>`).join('')
		: `<div class="empty-box">${esc(t('st_no_stickers'))}</div>`;
	const ws = d.weapons.filter(w => !q || w.name.toLowerCase().includes(q) || w.stickers.some(s => s.name.toLowerCase().includes(q)));
	$('stWeapons').innerHTML = ws.length ? ws.map(w => {
		// все наклейки (по позиции на модели), затем свободные позиции; действия — по индексу атрибута (s.slot)
		const placed = w.stickers.map(s => `<div class="st-slot full" title="${esc(s.name)} · ${t('st_wear')} ${Math.round(s.wear * 100)}%">${s.image ? `<img src="${esc(s.image)}" alt="">` : ''}<div class="nm">${esc(s.name.replace(/^Sticker \| /, ''))}</div>
				<div class="st-wear">${t('st_wear')} ${Math.round(s.wear * 100)}%</div>
				<div class="acts"><button data-scrape="${esc(w.id)}" data-slot="${s.slot}">${esc(t('st_scrape'))}</button><button class="rm" data-remove="${esc(w.id)}" data-slot="${s.slot}">${esc(t('delete'))}</button></div></div>`);
		const usedPos = new Set(w.stickers.map(s => s.pos));
		const free = Array.from({ length: d.slots }, (_, i) => i).filter(i => !usedPos.has(i)).slice(0, Math.max(0, d.slots - w.stickers.length));
		const empty = free.map(i => sel ? `<div class="st-slot target" data-put="${esc(w.id)}" data-slot="${i}">+ ${esc(t('st_put'))}</div>` : `<div class="st-slot"><span class="muted">${i + 1}</span></div>`);
		const slots = [...placed, ...empty].join('');
		const acts = [
			w.inspect ? `<button class="btn ghost small" data-insp-game="${esc(w.inspect)}">${esc(t('inspect_game'))}</button>` : '',
			w.invLink ? `<button class="btn ghost small" data-open-inv="${esc(w.invLink)}">${esc(t('st_in_inventory'))}</button>` : '',
		].join('');
		const fl = w.float != null ? `<div class="st-float"><span class="muted small">float ${fl4(w.float)}</span>${floatBar(w.float, { cls: 'sm' })}</div>` : '';
		return `<div class="st-w"><button class="st-view" data-view="${esc(w.id)}" title="${esc(t('iv_open'))}">${w.image ? `<img src="${esc(w.image)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<span class="st-view-ico">⤢</span></button><div><div class="st-wh"><span class="strong st-view-name" data-view="${esc(w.id)}">${esc(w.name)}</span>${acts ? `<span class="st-insp">${acts}</span>` : ''}</div>${fl}<div class="st-slots">${slots}</div></div></div>`;
	}).join('') : `<div class="empty-box">${esc(t('st_no_weapons'))}</div>`;
}

// ---------------- «Как в игре»: большая карточка скина — износ, паттерн, наклейки (с износом) и брелок
const EXT_NAMES = [[0.07, 'Factory New'], [0.15, 'Minimal Wear'], [0.38, 'Field-Tested'], [0.45, 'Well-Worn'], [1.01, 'Battle-Scarred']];
function openItemView(w) {
	if (!w) return;
	if ($('ivModal').nextElementSibling) document.body.appendChild($('ivModal'));  // поверх других окон (например, итога контракта)
	const color = RARITY_COLORS[w.rarity] || '#4b69ff';
	$('ivCard').style.setProperty('--rc', color);
	const big = w.image ? w.image.replace(/\/\d+fx\d+f$/, '/512fx384f') : '';
	// наклейки — колонкой сбоку от оружия (точных координат на модели у нас нет), прозрачность — по износу
	const stk = w.stickers.map(s => `<div class="iv-stk" title="${esc(s.name)} · ${Math.round(s.wear * 100)}%">
		${s.image ? `<img src="${esc(s.image)}" alt="" style="opacity:${(1 - s.wear * 0.75).toFixed(2)};filter:grayscale(${(s.wear * 0.7).toFixed(2)}) drop-shadow(0 3px 6px rgba(0,0,0,.5))">` : ''}
		<span>${Math.round(s.wear * 100)}%</span></div>`).join('');
	$('ivStage').innerHTML = `<div class="iv-glow"></div>${big ? `<img class="iv-skin" src="${esc(big)}" alt="">` : ''}
		${w.stickers.length ? `<div class="iv-side">${stk}</div>` : ''}
		${w.nameTag ? `<div class="iv-tag">“${esc(w.nameTag)}”</div>` : ''}`;
	const ext = w.float != null ? (EXT_NAMES.find(([m]) => w.float < m) || [0, ''])[1] : '';
	const badges = [w.kills != null ? `<span class="iv-badge st">StatTrak™ · ${fmt(w.kills)}</span>` : '', w.souvenir ? '<span class="iv-badge sv">Souvenir</span>' : '',
		w.rarity ? `<span class="iv-badge" style="--bc:${color}">${esc(RARITY_NAMES[w.rarity] || '')}</span>` : ''].join('');
	const mkt = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(w.name)}`;
	$('ivInfo').innerHTML = `<div class="iv-name">${esc(w.name)}</div><div class="iv-badges">${badges}</div>
		${w.float != null ? `<div class="iv-block"><div class="iv-row"><span>${esc(t('iv_wear'))}</span><b>${esc(ext)}</b></div>
			<div class="iv-row"><span>Float</span><b class="mono">${Number(w.float).toFixed(10)}</b></div>${floatBar(w.float)}</div>` : ''}
		${w.seed != null ? `<div class="iv-block"><div class="iv-row"><span>${esc(t('iv_seed'))}</span><b class="mono">${w.seed}</b></div></div>` : ''}
		<div class="iv-block"><div class="iv-sub">${esc(t('iv_stickers'))} · ${w.stickers.length}/5</div>
			${w.stickers.length ? w.stickers.map(s => `<div class="iv-srow">${s.image ? `<img src="${esc(s.image)}" alt="">` : '<span></span>'}<div class="grow"><div>${esc(s.name.replace(/^Sticker \| /, ''))}</div>
				<div class="iv-sw"><i style="width:${Math.max(2, (1 - s.wear) * 100)}%"></i></div></div><b>${Math.round(s.wear * 100)}%</b></div>`).join('') : `<div class="muted small">${esc(t('iv_no_stickers'))}</div>`}</div>
		<div class="iv-actions">
			${w.inspect ? `<button class="btn primary" data-iv-insp="${esc(w.inspect)}">${esc(t('craft_inspect'))}</button>` : ''}
			${w.invLink ? `<button class="btn ghost" data-iv-open="${esc(w.invLink)}">${esc(t('st_in_inventory'))}</button>` : ''}
			<button class="btn ghost" data-iv-open="${esc(mkt)}">${esc(t('m_open_market'))} ↗</button>
		</div>`;
	$('ivModal').classList.remove('hidden');
}
$('ivClose').addEventListener('click', () => $('ivModal').classList.add('hidden'));
$('ivInfo').addEventListener('click', e => {
	const a = e.target.closest('[data-iv-insp]'); if (a) launchInspect(a.dataset.ivInsp);
	const o = e.target.closest('[data-iv-open]'); if (o) openExt(o.dataset.ivOpen);
});

async function stickerAct(url, body, msg) {
	if (ui.stkBusy) return;
	ui.stkBusy = true;
	$('stHint').textContent = t('st_working');
	try { await apiPost(url, body); toast(msg, 'good'); }
	catch (e) { toast(e.message, 'bad'); }
	finally { ui.stkBusy = false; await loadStickers(); }  // сразу показываем результат на оружии
}

async function stickerApply(weaponId, slot) {
	const sel = ui.stk.stickers.find(s => s.stickerId === ui.stkSel); if (!sel) return;
	const w = ui.stk.weapons.find(x => x.id === weaponId);
	const img = src => src ? `<img src="${esc(src)}" alt="">` : '';
	const r = await askConfirm('sticker', {
		title: t('st_apply_title'), text: t('st_apply_confirm', { name: sel.name, weapon: w ? w.name : '' }),
		extra: sel.image || (w && w.image) ? `<div class="mini-preview">${img(sel.image)}<span class="arrow">→</span>${img(w && w.image)}</div>` : '',
		ok: t('st_put'),
	});
	if (!r.ok) return;
	await stickerAct('/api/stickers/apply', { weaponId, stickerItemId: sel.ids[0], slot }, t('st_applied'));
}

// Соскоблить — тоже с подтверждением: шаг необратим (+10–15% износа), а на 100% следующий шаг снимает наклейку.
async function stickerScrape(weaponId, slot) {
	const w = ui.stk && ui.stk.weapons.find(x => x.id === weaponId);
	const s = w && w.stickers.find(x => x.slot === slot);
	const name = s ? s.name.replace(/^Sticker \| /, '') : '';
	const wear = s ? Math.round(s.wear * 100) : 0;
	const r = await askConfirm('scrape', { warn: true, title: t('st_scrape_title'),
		text: s && s.wear >= 0.999 ? t('st_scrape_last', { name }) : t('st_scrape_confirm', { name, wear }),
		extra: s && s.image ? `<div class="mini-preview"><img src="${esc(s.image)}" alt=""></div>` : '', ok: t('st_scrape') });
	if (r.ok) await stickerAct('/api/stickers/scrape', { weaponId, slot }, t('st_scraped'));
}

async function stickerRemove(weaponId, slot) {
	const r = await miniConfirm({ warn: true, title: t('st_remove_title'), text: t('st_remove_confirm'), ok: t('delete') });
	if (r.ok) await stickerAct('/api/stickers/scrape', { weaponId, slot, remove: true }, t('st_removed'));
}

$('stRefresh').addEventListener('click', loadStickers);
$('stSearch').addEventListener('input', renderStickers);
$('stStickers').addEventListener('click', e => { const s = e.target.closest('[data-stk]'); if (s) { const id = Number(s.dataset.stk); ui.stkSel = ui.stkSel === id ? null : id; renderStickers(); } });
$('stWeapons').addEventListener('click', e => {
	const d = e.target.dataset;
	const v = e.target.closest('[data-view]');
	if (v) { openItemView(ui.stk.weapons.find(x => x.id === v.dataset.view)); return; }
	if (d.inspGame) launchInspect(d.inspGame);
	if (d.openInv) openExt(d.openInv);
	if (d.put) stickerApply(d.put, Number(d.slot));
	if (d.scrape) stickerScrape(d.scrape, Number(d.slot));
	if (d.remove) stickerRemove(d.remove, Number(d.slot));
});

// ============================================================ Armory
const STAR_SVG = '<svg viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8L12 3.5Z" fill="currentColor"/></svg>';

async function loadArmory() {
	$('armGrid').innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton" style="height:220px"></div>').join('');
	try { ui.armory = await apiGet('/api/armory'); ui.armQty = ui.armQty || {}; renderArmory(); }
	catch (e) { $('armGrid').innerHTML = `<div class="empty-box">${esc(e.message)}</div>`; }
}

function renderArmory() {
	const a = ui.armory; if (!a) return;
	$('armBalance').textContent = fmt(a.balance);
	$('armNote').classList.toggle('hidden', a.hasPass);
	$('armNote').textContent = t('arm_no_pass');
	const now = Date.now() / 1000;
	$('armGrid').innerHTML = a.items.map(i => {
		const q = ui.armQty[i.redeemId] || 1;
		const can = a.balance >= i.points * q;
		return `<div class="arm-card">
			<div class="arm-thumb">${i.isNew && i.isNew > now - 30 * 86400 ? `<span class="arm-new">NEW</span>` : ''}${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : ''}</div>
			<div class="arm-name">${esc(i.name)}</div>
			<div class="arm-foot">
				<span class="arm-cost">${STAR_SVG}${i.points}</span>
				<span class="qty"><button data-astep="-1" data-rid="${i.redeemId}">−</button><input type="number" min="1" max="50" value="${q}" data-aq="${i.redeemId}"><button data-astep="1" data-rid="${i.redeemId}">+</button></span>
				<button class="btn good small" data-redeem="${i.redeemId}" ${can ? '' : 'disabled'}>${esc(t('arm_redeem'))}</button>
			</div>
		</div>`;
	}).join('');
}

async function armRedeem(rid) {
	const i = ui.armory.items.find(x => x.redeemId === rid); if (!i) return;
	const q = ui.armQty[rid] || 1;
	if (!(await askConfirm('armory', { title: 'Armory', text: t('arm_confirm', { name: i.name, n: q, cost: i.points * q }) })).ok) return;
	document.querySelectorAll('[data-redeem]').forEach(b => { b.disabled = true; });
	try {
		const r = await apiPost('/api/armory/redeem', { redeemId: rid, count: q });
		toast(t('arm_done', { name: r.name, n: r.redeemed }), 'good');
		ui.armory.balance = r.balance;
		loadState().catch(() => {});
	} catch (e) { toast(e.message, 'bad'); }
	renderArmory();
}

$('armRefresh').addEventListener('click', loadArmory);
$('armPass').addEventListener('click', async () => {
	try {
		if (!ui.store) ui.store = await apiGet('/api/store/catalog');
		const it = storeItem(1354);  // XpShopTicket1 = пропуск Armory
		if (!it) throw new Error(t('unavailable'));
		openCheckout([{ def: it.def, name: it.name, image: it.image, unit: it.price, qty: 1 }]);
	} catch (e) { toast(e.message, 'bad'); }
});
$('armGrid').addEventListener('click', e => {
	const st = e.target.closest('[data-astep]');
	if (st) { const rid = Number(st.dataset.rid); ui.armQty[rid] = Math.max(1, Math.min(50, (ui.armQty[rid] || 1) + Number(st.dataset.astep))); renderArmory(); return; }
	const b = e.target.closest('[data-redeem]');
	if (b) armRedeem(Number(b.dataset.redeem));
});
$('armGrid').addEventListener('change', e => { if (e.target.dataset.aq) { ui.armQty[Number(e.target.dataset.aq)] = Math.max(1, Math.min(50, Math.floor(Number(e.target.value) || 1))); renderArmory(); } });

// ============================================================ правила автоперекладки
const RULE_KINDS = ['any', 'container', 'sticker', 'skin', 'knifeglove', 'graffiti', 'other'];

function ruleRow(r) {
	const caskets = ((ui.state && ui.state.caskets) || []).filter(c => c.name).map(c => c.name);
	return `<div class="rule-row">
		<select data-f="kind">${RULE_KINDS.map(k => `<option value="${k}" ${r.kind === k ? 'selected' : ''}>${esc(t('kind_' + k))}</option>`).join('')}</select>
		<input data-f="text" value="${esc(r.text || '')}" placeholder="${esc(t('rule_text_ph'))}" spellcheck="false">
		<input data-f="casket" value="${esc(r.casket || '')}" placeholder="Cases" list="casketNames" spellcheck="false">
		<button class="x" title="${esc(t('delete'))}">×</button>
	</div>`;
}

function openRules() {
	const names = [...new Set(((ui.state && ui.state.caskets) || []).filter(c => c.name).map(c => c.name.replace(/\s*\d+$/, '')))];
	$('rulesList').innerHTML = (ui.settings.rules || []).map(ruleRow).join('') +
		`<datalist id="casketNames">${names.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`;
	if (!(ui.settings.rules || []).length) $('rulesList').insertAdjacentHTML('afterbegin', ruleRow({ kind: 'container', text: '', casket: names[0] || '' }));
	$('rulesAuto').checked = Boolean(ui.settings.autoApplyRules);
	$('rulesPlan').classList.add('hidden'); $('rulesApply').classList.add('hidden');
	$('rulesModal').classList.remove('hidden');
}

function readRules() {
	return [...document.querySelectorAll('#rulesList .rule-row')].map(row => ({
		kind: row.querySelector('[data-f="kind"]').value, text: row.querySelector('[data-f="text"]').value.trim(),
		casket: row.querySelector('[data-f="casket"]').value.trim(),
	})).filter(r => r.casket);
}

async function saveRules() {
	ui.settings = await api('/api/settings', { rules: readRules(), autoApplyRules: $('rulesAuto').checked });
}

async function previewRules() {
	try {
		await saveRules();
		const plan = await apiGet('/api/rules/plan');
		const lines = plan.steps.map(st => `<div class="pl"><span>→ <b>${esc(st.casketName)}</b> <span class="muted">${esc(st.top.map(([n, c]) => `${n} ×${c}`).join(', '))}</span></span><b>${fmt(st.count)}</b></div>`);
		for (const u of plan.unplaced) lines.push(`<div class="pl warn-text"><span>${esc(t('rules_noroom', { n: u.rule + 1 }))}</span><b>${fmt(u.count)}</b></div>`);
		$('rulesPlan').innerHTML = lines.join('') || `<span class="muted">${esc(t('rules_nothing'))}</span>`;
		$('rulesPlan').classList.remove('hidden');
		$('rulesApply').textContent = t('rules_apply', { n: fmt(plan.total) });
		$('rulesApply').classList.toggle('hidden', !plan.total);
	} catch (e) { toast(e.message, 'bad'); }
}

async function applyRules() {
	$('rulesApply').disabled = true;
	try {
		const plan = await apiPost('/api/rules/apply');
		$('rulesModal').classList.add('hidden');
		toast(t('rules_started', { n: fmt(plan.total), c: plan.steps.length }), 'good');
	} catch (e) { toast(e.message, 'bad'); }
	finally { $('rulesApply').disabled = false; }
}

$('rulesBtn').addEventListener('click', openRules);
$('ruleAdd').addEventListener('click', () => { $('rulesList').insertAdjacentHTML('beforeend', ruleRow({ kind: 'any', text: '', casket: '' })); $('rulesPlan').classList.add('hidden'); $('rulesApply').classList.add('hidden'); });
$('rulesList').addEventListener('click', e => { if (e.target.classList.contains('x')) { e.target.closest('.rule-row').remove(); $('rulesApply').classList.add('hidden'); } });
$('rulesList').addEventListener('input', () => { $('rulesApply').classList.add('hidden'); });
$('rulesPreview').addEventListener('click', previewRules);
$('rulesApply').addEventListener('click', applyRules);
$('rulesClose').addEventListener('click', async () => { try { await saveRules(); } catch (e) { /* ignore */ } $('rulesModal').classList.add('hidden'); });

// ============================================================ старт
fillLangSelects();
applyStaticI18n();

if (window.desktop) {
	window.desktop.version().then(v => { $('versionText').textContent = t('version', { v }); });
	if (window.desktop.version) window.desktop.version().then(v => { ui.appVersion = v; }).catch(() => {});
	if (window.desktop.onUpdate) window.desktop.onUpdate(onUpdateEvent);
}
setMode('qr');
try {
	const r = JSON.parse(sessionStorage.getItem('ui_restore') || 'null');
	sessionStorage.removeItem('ui_restore');
	if (r) { if (r.active) ui.active = r.active; if (r.tab) ui.restoreTab = r.tab; }
} catch (e) { /* ignore */ }
loadSettings();
poll(true);

// Клик по затемнённому фону закрывает любое окно — так же, как его кнопка «Отмена» / «Закрыть».
// Окно оформления покупки во время оплаты не закрывается.
const BACKDROP_CLOSE = {
	miniModal: () => ui.miniAnswer && ui.miniAnswer(false),
	qtyModal: () => $('qtyCancel').click(),
	tdModal: () => closeTransferDone(),
	craftModal: () => $('craftOk').click(),
	checkoutModal: () => { if (!(ui.co && ui.co.busy)) { if (ui.co && ui.co.answer) ui.co.answer(false); else closeCheckout(); } },
	guardModal: () => $('guardCancel').click(),
	rulesModal: () => $('rulesClose').click(),
	supportModal: () => $('supportClose').click(),
	welcomeModal: () => $('welcomeStart').click(),
	updModal: () => $('updLater').click(),
	pnlModal: () => $('pnlCancel').click(),
	ivModal: () => $('ivClose').click(),
	boModal: () => $('boCancel').click(),
	settingsModal: () => $('settingsModal').classList.add('hidden'),
};
let backdropDown = null;
document.addEventListener('mousedown', e => { backdropDown = e.target.classList && e.target.classList.contains('modal') ? e.target : null; });
document.addEventListener('mouseup', e => {
	// только если и нажали, и отпустили на фоне (выделение текста в поле с выходом за окно не закрывает его)
	const m = backdropDown; backdropDown = null;
	if (!m || e.target !== m || m.classList.contains('hidden')) return;
	const fn = BACKDROP_CLOSE[m.id];
	if (fn) fn(); else m.classList.add('hidden');
});
