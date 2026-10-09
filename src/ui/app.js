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
	document.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== mode));
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
	if (ui.qr.state === 'loading' || ui.qr.state === 'shown' || qrPending(p)) api('/api/login/qr/cancel', {}).catch(() => {});
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
			<div class="grow"><div class="strong">${esc(a.personaName || a.login)}</div>${a.personaName && a.personaName !== a.login ? `<div class="muted small">${esc(a.login)}</div>` : ''}
				<div class="muted small">${a.hasMaFile ? 'maFile · ' : ''}${a.proxy ? t('proxy_label').toLowerCase() : ''}</div></div>
			<button class="btn primary small" data-login="${esc(a.login)}">${esc(t('btn_login'))}</button>
			<button class="forget" data-forget="${esc(a.login)}">×</button>
		</div>`).join('');
}

async function login(body) {
	$('loginError').classList.add('hidden');
	if (body.mode !== 'qr') ui.qr.state = 'idle';  // сервер заменит висящий QR этим входом
	if (body.mode !== 'qr') { showView('connectingView'); $('connectingTitle').textContent = body.login ? t('connecting_to', { login: body.login }) : t('connecting'); }
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
			$('dropText').textContent = `maFile: ${ma.account_name || file.name}`;
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
	// pending завершился входом -> показываем новый аккаунт
	if (ui._wasPending && !pending) {
		ui.addingAccount = false;
		if (accounts.length) { ui.active = accounts[accounts.length - 1].login; ui._freshActive = true; }
	}
	ui._wasPending = Boolean(pending && ['connecting', 'guard', 'qr'].includes(pending.status));

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
		loadState().catch(e => toast(e.message, 'bad'));
	}
	handleActiveJob(active);
}

function renderLoginFlow(pending, hasAccounts) {
	$('loginBack').classList.toggle('hidden', !hasAccounts);
	const st = pending && pending.status;
	if (st === 'connecting' && !qrPending(pending)) {
		showView('connectingView');
		$('connectingTitle').textContent = pending.login ? t('connecting_to', { login: pending.login }) : t('connecting');
		$('guardModal').classList.add('hidden');
	} else if (st === 'guard') {
		showView('connectingView');
		$('connectingTitle').textContent = pending.login ? t('connecting_to', { login: pending.login }) : t('connecting');
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

// Аватарка Steam (кэш на диске, см. session._loadProfile) или буква логина, пока её нет.
function avatarHtml(a, cls = '') {
	return a && a.avatar
		? `<img class="avatar ${cls}" src="${esc(a.avatar)}" alt="">`
		: `<div class="avatar ${cls}">${esc(((a && a.login) || '?')[0].toUpperCase())}</div>`;
}

function renderAccountBar(accounts, pending) {
	const chips = accounts.map(a => {
		const busy = a.job && !a.job.finished;
		const cls = a.proxyBad ? 'bad' : a.needsRelogin ? 'warn' : a.status === 'online' ? 'ok' : a.status === 'connecting' ? 'warn' : 'bad';
		return `<div class="acct ${a.login === ui.active ? 'sel' : ''}" data-acct="${esc(a.login)}">
			${avatarHtml(a, 'acct-av')}
			<span class="acct-dot ${cls}"></span>
			<span class="acct-text" title="${esc(a.login)}"><span class="acct-name">${esc(a.personaName || a.login)}</span>${
				// у выбранного аккаунта под ником — баланс кошелька, у остальных — логин
				a.login === ui.active && a.wallet ? `<span class="acct-wallet">${money(a.wallet.balance)} ${esc(a.wallet.currency)}</span>`
				: a.personaName && a.personaName !== a.login ? `<span class="acct-login">${esc(a.login)}</span>` : ''}</span>
			${busy ? '<span class="acct-spin"><span class="spinner tiny"></span></span>' : ''}
			<button class="acct-x" data-logout="${esc(a.login)}" title="${esc(t('logout'))}">×</button>
		</div>`;
	}).join('');
	const adding = pending && ['connecting', 'guard', 'qr'].includes(pending.status);
	$('accountBar').innerHTML = chips + `<button class="acct add" id="addAcct">${adding ? esc(t('connecting')) : esc(t('add_account'))}</button>`;
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
		if (!job.error && ui.settings.transferModal !== false) showTransferDone(job, secs);
		else {
			toast(job.error ? t('done_err', { e: job.error }) : t('done_ok', { n: fmt(job.done) }), job.error ? 'bad' : 'good');
			if (!job.error && job.done >= 50) setTimeout(() => nudgeSupport(t('nudge_moved', { n: fmt(job.done), s: secs })), 1500);
		}
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
				<div class="item-sub">${ui.op === 'store' ? t('in_inventory') : t('in_casket')}: ${fmt(i.count)}${lock}</div></div>
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
async function showTransferDone(job, secs) {
	const support = !ui.settings.supportHideNudges
		? `<div class="td-support">♥ ${esc(t('td_support'))} <button class="btn support-btn small" id="tdSupport">${esc(t('support_short'))}</button></div>` : '';
	const p = miniConfirm({
		icon: ICON_OK, title: job.kind === 'store' ? t('td_stored', { name: job.casketName || '—' }) : t('td_taken', { name: job.casketName || '—' }),
		text: t('td_text', { n: fmt(job.done), s: secs, v: (job.done / secs).toFixed(1) }),
		extra: support, cancel: false, dontShow: true, dontText: t('td_dont_show'),
	});
	const b = document.getElementById('tdSupport');
	if (b) b.onclick = () => { ui.miniAnswer && ui.miniAnswer(true); openSupport(); };
	const r = await p;
	if (r.dont) saveSetting({ transferModal: false });
}

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
	$('storeWallet').textContent = `${money(st.balance)} ${st.currency}`;
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
	if (ui.settings.lang && ui.settings.lang !== LANG && window.I18N.dict[ui.settings.lang]) setLang(ui.settings.lang, false);
	updateCartBtn();
	maybeWelcome();
}

function openSettings() {
	$('stickerConfirmToggle').checked = ui.settings.stickerConfirm !== false;
	$('nudgeToggle').checked = !ui.settings.supportHideNudges;
	$('transferModalToggle').checked = ui.settings.transferModal !== false;
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
	$('coLogin').textContent = acc.personaName || ui.active || '';
	$('coBalance').textContent = ui.store && ui.store.balance != null ? `(${money(ui.store.balance)} ${ui.store.currency})` : '';
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
			if (order.balance != null) $('coBalance').textContent = `(${money(order.balance)} ${order.currency})`;
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
		const qty = await askQuantity(it.name, it.price);
		if (qty) openCheckout([{ def: it.def, name: it.name, image: it.image, unit: it.price, qty }]);
	} catch (e) { toast(e.message, 'bad'); }
}

function askQuantity(name, unit) {
	return new Promise(resolve => {
		$('qtyTitle').textContent = name;
		$('qtyUnit').textContent = t('qty_unit', { price: fmt(unit), currency: ui.store ? ui.store.currency : '' });
		$('qtyInput').value = '1';
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
	if (chip && chip.dataset.acct !== ui.active) { ui.active = chip.dataset.acct; ui._freshActive = true; renderAccounts(ui.status); }
});

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
$('stickerConfirmToggle').addEventListener('change', e => saveSetting({ stickerConfirm: e.target.checked }));
$('nudgeToggle').addEventListener('change', e => saveSetting({ supportHideNudges: !e.target.checked }));
$('transferModalToggle').addEventListener('change', e => saveSetting({ transferModal: e.target.checked }));
document.addEventListener('keydown', e => {
	if (e.key !== 'Escape') return;
	if (ui.tourStep != null) return endTour();
	if (ui.miniAnswer) return ui.miniAnswer(false);
	if (!$('supportModal').classList.contains('hidden')) return $('supportModal').classList.add('hidden');
	if (!$('settingsModal').classList.contains('hidden')) return $('settingsModal').classList.add('hidden');
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
		ovTile(t('ov_protected'), fmt(sum('protectedCount')), t('ov_protected_sub')),
		ovTile(t('ov_tradeup_ready'), fmt(sum('tradeUpReady')), t('ov_tradeup_sub')),
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
			${rows.map(o => o.inventoryLimit ? `<tr><td><div class="it">${avatarHtml(o, 'acct-av')}<div><div>${esc(o.personaName || o.login)}</div><div class="sub">${esc(o.login)}</div></div></div></td>
				<td><div class="ov-mini">${fmt(o.inventoryCount)} / ${fmt(o.inventoryLimit)}<div class="meter"><i style="width:${o.inventoryCount / o.inventoryLimit * 100}%"></i></div></div></td>
				<td class="num">${fmt(o.stored)} <span class="sub">· ${fmt(o.casketCount)} ${esc(t('caskets').toLowerCase())}</span></td><td class="num">${fmt(o.inventoryCount + o.stored)}</td>
				<td class="num good-text">${o.wallet ? `${money(o.wallet.balance)} ${esc(o.wallet.currency)}` : '—'}</td></tr>`
				: `<tr><td>${esc(o.login)}</td><td colspan="4" class="muted">${esc(o.error || t('offline'))}</td></tr>`).join('')}
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

$('ovScope').addEventListener('click', e => { const b = e.target.closest('[data-scope]'); if (b) { ui.ovScope = b.dataset.scope; renderOverview(); loadOverview(); } });
$('ovRefresh').addEventListener('click', loadOverview);

// ============================================================ контракт обмена (трейд-ап)
// Названия грейдов — игровые термины CS2, одинаковы на всех языках.
const GRADES = { 1: 'Consumer', 2: 'Industrial', 3: 'Mil-Spec', 4: 'Restricted', 5: 'Classified', 6: 'Covert' };
const gradeName = (r, st) => (st ? 'StatTrak™ ' : '') + (GRADES[r] || ('#' + r));

async function loadTradeup() {
	$('tuGroups').innerHTML = Array.from({ length: 5 }, () => '<div class="skeleton" style="height:46px;margin:6px 0"></div>').join('');
	$('tuEmpty').classList.remove('hidden'); $('tuPanel').classList.add('hidden');
	try {
		ui.tu.groups = await apiGet('/api/tradeup/groups' + ($('tuCaskets').checked ? '?caskets=1' : ''));
		ui.tu.rarity = null; ui.tu.stattrak = null; ui.tu.picks = {}; ui.tu.preview = null;
		renderTuGroups(); tuUpdateAction(); renderTuOdds();
	} catch (e) { $('tuGroups').innerHTML = `<p class="muted" style="padding:16px">${esc(e.message)}</p>`; }
}

function currentTuGroup() { return (ui.tu.groups || []).find(g => g.rarity === ui.tu.rarity && g.stattrak === ui.tu.stattrak); }

function renderTuGroups() {
	const gs = ui.tu.groups || [];
	if (!gs.length) { $('tuGroups').innerHTML = `<p class="muted" style="padding:16px">${esc(t('tradeup_no_items'))}</p>`; return; }
	$('tuGroups').innerHTML = gs.map(g => {
		const sel = g.rarity === ui.tu.rarity && g.stattrak === ui.tu.stattrak;
		return `<div class="tu-group ${sel ? 'sel' : ''} ${g.total >= 10 ? '' : 'short'}" data-rarity="${g.rarity}" data-st="${g.stattrak ? 1 : 0}">
			<span class="tu-dot r${g.rarity}"></span>
			<span class="grow">${esc(gradeName(g.rarity, g.stattrak))}</span>
			<span class="muted small">${g.total}</span>
		</div>`;
	}).join('');
}

function selectTuGroup(rarity, stattrak) {
	ui.tu.rarity = rarity; ui.tu.stattrak = stattrak; ui.tu.picks = {}; ui.tu.preview = null;
	renderTuGroups();
	const g = currentTuGroup();
	$('tuEmpty').classList.toggle('hidden', Boolean(g));
	$('tuPanel').classList.toggle('hidden', !g);
	if (g) { $('tuGroupName').textContent = gradeName(g.rarity, g.stattrak) + ' · ' + g.total; renderTuItems(); }
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
function renderTuItems() {
	const g = currentTuGroup(); if (!g) return;
	const q = ($('tuSearch').value || '').toLowerCase();
	const items = g.items.filter(i => !q || i.name.toLowerCase().includes(q));
	$('tuItems').innerHTML = items.map(i => {
		const n = ui.tu.picks[i.name] || 0;
		const full = tuTotal() >= 10 && !n;
		return `<div class="tu-card r${g.rarity} ${n ? 'picked' : ''} ${full || i.noUpgrade ? 'dim' : ''} ${i.noUpgrade ? 'blocked' : ''}" data-tu="${esc(i.name)}" title="${esc(i.noUpgrade ? t('tu_no_upgrade') : i.name)}">
			${i.noUpgrade ? `<span class="tu-block">${esc(t('tu_no_upgrade_short'))}</span>` : ''}
			${n ? `<span class="tu-n">×${n}</span><button class="tu-minus" data-tuminus="${esc(i.name)}">−</button>` : ''}
			<div class="tu-img">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : ''}</div>
			${i.inspect ? `<button class="tu-eye" data-insp-game="${esc(i.inspect)}" title="${esc(t('craft_inspect'))}">${EYE}</button>` : ''}
			<div class="tu-name">${esc(i.name)}</div>
			<div class="tu-sub">${t('in_inventory')}: ${fmt(i.count - (i.stored || 0))}${i.stored ? ` · ${t('in_casket')}: ${fmt(i.stored)}` : ''}</div>
			${tuFloatRange(i)}
		</div>`;
	}).join('') || `<div class="empty-box">${esc(t('nothing_found'))}</div>`;
	renderTuTray();
	tuUpdateAction();
}

function tuFloatRange(i) {
	const f = (i.floats || []).filter(x => x != null);
	if (!f.length) return '';
	const lo = Math.min(...f), hi = Math.max(...f);
	return `<div class="tu-float">float ${fl4(lo)}${hi !== lo ? ` – ${fl4(hi)}` : ''}</div>${floatBar(f.length > 3 ? [lo, hi] : f, { cls: 'sm' })}`;
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
	$('tuOddsList').innerHTML = (p.topTier && p.topTier.length ? `<div class="tu-odds-warn">${esc(t('tu_top_tier', { names: [...new Set(p.topTier)].join(', ') }))}</div>` : '')
		+ (p.unknown && p.unknown.length ? `<div class="tu-odds-warn">${esc(t('tu_unknown', { names: [...new Set(p.unknown)].join(', ') }))}</div>` : '')
		+ p.outcomes.map(o => `<div class="tu-out" style="--rc:${nextColor}">
			<div class="tu-out-img">${o.image ? `<img src="${esc(o.image)}" alt="" loading="lazy">` : ''}</div>
			<div class="tu-out-body">
				<div class="tu-out-name" title="${esc(o.name)}">${esc(o.name)}</div>
				<div class="muted small">${o.float != null ? `float ≈ ${fl4(o.float)} · ${esc(o.exterior)}` : esc(o.collection || '')}</div>
				${o.float != null ? floatBar(o.float, { min: o.min, max: o.max, cls: 'sm' }) : ''}
				<div class="tu-out-bar"><i style="width:${Math.max(2, o.chance * 100).toFixed(1)}%"></i></div>
			</div>
			<div class="tu-out-side"><b>${(o.chance * 100).toFixed(o.chance < 0.1 ? 1 : 0)}%</b>
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
	// «На Торговой площадке» — сразу (по названию); «Осмотреть» — когда предмет появится в веб-инвентаре
	$('craftMarket').classList.toggle('hidden', !r.name);
	$('craftMarket').onclick = () => openExt(marketUrl(r.name));
	const insp = $('craftInspect');
	insp.classList.toggle('hidden', !r.id);
	insp.disabled = true; insp.title = t('craft_inspect_wait'); insp.onclick = null;
	if (r.id) apiGet('/api/inspect?wait=1&id=' + encodeURIComponent(r.id)).then(x => {
		if (!x.link) { insp.classList.add('hidden'); return; }
		insp.disabled = false; insp.title = ''; insp.onclick = () => openExt(x.link);
	}).catch(() => insp.classList.add('hidden'));
	$('craftModal').classList.remove('hidden');
	$('craftOk').focus();
}

async function runTradeUp() {
	const g = currentTuGroup(); if (!g) return;
	const ids = tuPickedIds();
	if (ids.length !== 10) return toast(t('tradeup_need10', { n: ids.length }), 'bad');
	if (!(await miniConfirm({ warn: true, title: t('tradeup_do'), text: t('tradeup_confirm') })).ok) return;
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
const tuLink = e => { const b = e.target.closest('[data-insp-game],[data-open]'); if (!b) return false; openExt(b.dataset.inspGame || b.dataset.open); return true; };
$('tuOddsList').addEventListener('click', tuLink);
$('tuItems').addEventListener('click', e => {
	if (tuLink(e)) return;
	const minus = e.target.closest('[data-tuminus]');
	const card = e.target.closest('[data-tu]');
	const g = currentTuGroup(); if (!g) return;
	if (minus) { const name = minus.dataset.tuminus; tuSetPick(name, (ui.tu.picks[name] || 0) - 1, 999); renderTuItems(); return; }
	if (card) {
		const it = g.items.find(x => x.name === card.dataset.tu);
		if (it && it.noUpgrade) { toast(t('tu_no_upgrade'), 'bad'); return; }
		if (it && tuTotal() < 10) { tuSetPick(it.name, (ui.tu.picks[it.name] || 0) + 1, it.count); renderTuItems(); }
	}
});
$('tuTray').addEventListener('click', e => { if (tuLink(e)) return; const s2 = e.target.closest('[data-tuminus]'); if (s2) { tuSetPick(s2.dataset.tuminus, (ui.tu.picks[s2.dataset.tuminus] || 0) - 1, 999); renderTuItems(); } });
$('tuSearch').addEventListener('input', renderTuItems);
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
			${o.partnerAvatar ? `<img class="avatar" src="${esc(o.partnerAvatar)}" alt="">` : `<div class="avatar">${esc((o.partnerName || '?')[0].toUpperCase())}</div>`}
			<div style="min-width:0;flex:1">
				<div class="strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(o.partnerName || o.partner)}</div>
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
			${o.partnerAvatar ? `<img class="avatar" src="${esc(o.partnerAvatar)}" alt="">` : `<div class="avatar">${esc((o.partnerName || '?')[0].toUpperCase())}</div>`}
			<div><div class="strong">${esc(o.partnerName || o.partner)}</div><div class="muted small">#${esc(o.id)} · ${esc(tsDate(o.created))} · <span class="tstate ${esc(o.state)}">${esc(t('ts_' + o.state))}</span></div></div>
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
		html = rows.length ? `<table class="mt"><thead><tr><th>${esc(t('col_name'))}</th><th class="num">${esc(t('col_price'))}</th><th class="num">${esc(t('col_qty'))}</th><th class="num">${esc(t('total'))}</th><th></th></tr></thead><tbody>
			${rows.map(o => `<tr><td>${it(o.image, o.name)}</td><td class="num">${money(o.price)} ${esc(o.currency)}</td><td class="num">${o.remaining}/${o.quantity}</td><td class="num">${money(o.price * o.remaining)} ${esc(o.currency)}</td>
			<td class="num"><button class="btn ghost small" data-mcancel="${esc(o.id)}">${esc(t('m_cancel_order'))}</button></td></tr>`).join('')}</tbody></table>` : `<div class="empty-box">${esc(t('m_empty'))}</div>`;
	} else if (ui.mtab === 'confirm') {
		if (!m.confirmations) html = `<div class="empty-box">${esc(t('m_need_mafile'))}</div>`;
		else {
			const rows = m.confirmations.filter(c => match(c.title + ' ' + c.summary.join(' ')));
			if (rows.length) bulk = t('m_confirm_all', { n: rows.length });
			html = rows.length ? `<table class="mt"><thead><tr><th>${esc(t('col_name'))}</th><th>${esc(t('m_type'))}</th><th class="num">${esc(t('m_created'))}</th><th></th></tr></thead><tbody>
				${rows.map(c => `<tr><td>${it(c.icon, c.title, c.summary.join(' · '))}</td><td>${esc(c.typeName || c.type)}</td><td class="num">${esc(tsDate(c.time))}</td>
				<td class="num"><button class="btn ghost small" data-cdeny="${esc(c.id)}">${esc(t('decline'))}</button> <button class="btn good small" data-callow="${esc(c.id)}">${esc(t('confirm'))}</button></td></tr>`).join('')}</tbody></table>`
				: `<div class="empty-box">${esc(t('m_no_confirm'))}</div>`;
		}
	} else if (ui.mtab === 'sell') {
		if (!ui.sell) { html = '<div class="skeleton" style="height:260px"></div>'; loadSellable(); }
		else {
			const rows = ui.sell.items.filter(g => match(g.name));
			const cur = ui.sell.currency;
			const n = Object.values(ui.sell.picks).reduce((a, p) => a + (p.qty > 0 && p.price > 0 ? p.qty : 0), 0);
			if (n) bulk = t('m_sell_go', { n });
			html = rows.length ? `<table class="mt"><thead><tr><th>${esc(t('col_name'))}</th><th class="num">${esc(t('m_have'))}</th><th class="num">${esc(t('m_market_price'))}</th><th class="num">${esc(t('col_qty'))}</th><th class="num">${esc(t('m_buyer_pays'))}</th><th class="num">${esc(t('m_you_get'))}</th></tr></thead><tbody>
				${rows.map(g => {
					const p = ui.sell.picks[g.hashName] || {};
					const pr = ui.sell.prices[g.hashName];
					const priceCell = pr === 'loading' ? '…' : pr ? `${pr.lowest != null ? money(pr.lowest) : '—'} / ${pr.median != null ? money(pr.median) : '—'} <span class="sub">· ${fmt(pr.volume)}</span>`
						: `<button class="btn ghost small" data-mprice="${esc(g.hashName)}">${esc(t('m_get_price'))}</button>`;
					const get = p.price > 0 ? money(sellReceive(p.price)) + ' ' + esc(cur) : '—';
					return `<tr><td>${it(g.image, g.name)}</td><td class="num">${fmt(g.count)}</td><td class="num">${priceCell}</td>
						<td class="num"><input class="mini-in" type="number" min="0" max="${g.count}" value="${p.qty || ''}" placeholder="0" data-sq="${esc(g.hashName)}"></td>
						<td class="num"><input class="mini-in wide" type="number" min="0" step="0.01" value="${p.price || ''}" placeholder="0.00" data-sp="${esc(g.hashName)}"></td>
						<td class="num" data-sget="${esc(g.hashName)}">${get}</td></tr>`;
				}).join('')}</tbody></table>` : `<div class="empty-box">${esc(t('m_nothing_sell'))}</div>`;
		}
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
	$('mBulk').classList.toggle('hidden', !bulk);
	if (bulk) $('mBulk').textContent = bulk;
}

// Комиссия Steam (5% + 10% игре, каждая ≥ 1 цента) — как на сервере (community.receiveFromBuyer).
function sellReceive(buyer) {
	const c = Math.round(buyer * 100);
	const fee = r => Math.max(1, Math.floor(r * 0.05)) + Math.max(1, Math.floor(r * 0.10));
	let r = Math.max(1, Math.floor(c / 1.15));
	while (r > 1 && r + fee(r) > c) r--;
	while (r + 1 + fee(r + 1) <= c) r++;
	return r / 100;
}

async function loadSellable() {
	try {
		const items = await apiGet('/api/market/sellable');
		ui.sell = { items, picks: {}, prices: {}, currency: (ui.store && ui.store.currency) || ((activeAccount() || {}).currency) || '' };
		if (!ui.sell.currency && ui.state && ui.state.wallet) ui.sell.currency = ui.state.wallet.currency;
		if (ui.mtab === 'sell') renderMarket();
	} catch (e) { $('marketTable').innerHTML = `<div class="empty-box">${esc(e.message)}</div>`; }
}

async function loadPrice(hashName) {
	ui.sell.prices[hashName] = 'loading'; renderMarket();
	try {
		const p = await apiGet('/api/market/price?name=' + encodeURIComponent(hashName));
		ui.sell.prices[hashName] = p;
		const pick = ui.sell.picks[hashName] || (ui.sell.picks[hashName] = { qty: 0, price: 0 });
		if (!pick.price && p.lowest) pick.price = Math.max(0.03, Math.round((p.lowest - 0.01) * 100) / 100);  // на цент ниже минимальной
	} catch (e) { delete ui.sell.prices[hashName]; toast(e.message, 'bad'); }
	renderMarket();
}

async function sellNow() {
	const items = [];
	let total = 0;
	for (const g of ui.sell.items) {
		const p = ui.sell.picks[g.hashName];
		if (!p || !(p.qty > 0) || !(p.price > 0)) continue;
		for (const assetid of g.assetids.slice(0, p.qty)) { items.push({ assetid, buyerPays: p.price }); total += sellReceive(p.price); }
	}
	if (!items.length) return;
	if (!(await miniConfirm({ title: t('m_sell'), text: t('m_sell_confirm', { n: items.length, total: money(total), currency: ui.sell.currency }) })).ok) return;
	$('mBulk').disabled = true;
	toast(t('m_selling', { n: items.length }));
	try {
		const r = await apiPost('/api/market/sell', { items });
		toast(t('m_sold_result', { n: r.listed }) + (r.confirmed ? ' · ' + t('m_auto_confirmed', { n: r.confirmed }) : r.needsConfirmation ? ' · ' + t('trade_need_confirm') : ''), r.failed.length ? 'bad' : 'good');
		if (r.failed.length) toast(r.failed[0].error, 'bad');
		ui.sell = null; ui.market = null; await loadMarket();
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
	if (d.mremove) miniConfirm({ text: t('m_remove_confirm') }).then(r => r.ok && marketAct('/api/market/remove', { id: d.mremove }, t('m_removed')));
	if (d.mcancel) miniConfirm({ text: t('m_cancel_confirm') }).then(r => r.ok && marketAct('/api/market/cancelorder', { id: d.mcancel }, t('m_cancelled')));
	if (d.callow) marketAct('/api/confirmations', { ids: [d.callow], accept: true }, t('m_confirmed'));
	if (d.cdeny) marketAct('/api/confirmations', { ids: [d.cdeny], accept: false }, t('m_denied'));
	if (e.target.id === 'mMore') { e.target.disabled = true; loadHistory(ui.history.rows.length); }
	if (d.mprice) loadPrice(d.mprice);
});
$('marketTable').addEventListener('input', e => {
	const d = e.target.dataset, name = d.sq || d.sp;
	if (!name || !ui.sell) return;
	const g = ui.sell.items.find(x => x.hashName === name);
	const p = ui.sell.picks[name] || (ui.sell.picks[name] = { qty: 0, price: 0 });
	if (d.sq) p.qty = Math.max(0, Math.min(g.count, Math.floor(Number(e.target.value) || 0)));
	if (d.sp) p.price = Math.max(0, Number(e.target.value) || 0);
	const cell = document.querySelector(`[data-sget="${CSS.escape(name)}"]`);
	if (cell) cell.textContent = p.price > 0 ? `${money(sellReceive(p.price))} ${ui.sell.currency}` : '—';
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
			<div style="min-width:0"><div class="strong" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.personaName || a.login)}</div>
				<div class="sub">${a.online ? `<span class="g-proxy-ok">● ${esc(t('online'))}</span>` : `<span>${esc(a.login)}</span>`}${px}${a.wallet ? `<span class="good-text">${money(a.wallet.balance)} ${esc(a.wallet.currency)}</span>` : ''}</div></div>
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
	const head = `<div class="g-head">${avatarHtml(a)}<div style="flex:1"><div class="strong">${esc(a.personaName || a.login)}</div><div class="muted small">${esc(a.login)}${a.proxy ? ` · ${esc(t('proxy_label'))}: ${a.proxyStatus ? (a.proxyStatus.ok ? t('proxy_ok') : `<span class="g-proxy-bad">${esc(t('proxy_bad'))}</span>`) : '…'}` : ''}</div></div>
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
		<div style="min-width:0"><div class="strong">${esc(c.title)}</div><div class="muted small">${esc(c.typeName || '')} · ${esc(c.summary.join(' · '))} · ${esc(tsDate(c.time))}</div></div>
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
			toast(t('guard_mafile_added', { login: ui.guardAddFor }), 'good');
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
		const text = a.kind === 'proxy_bad' ? t('alert_proxy_bad', { login: a.login }) : t('alert_proxy_ok', { login: a.login });
		toast(text + (a.error ? ` — ${a.error}` : ''), a.kind === 'proxy_bad' ? 'bad' : 'good');
		try { if (a.kind === 'proxy_bad' && window.Notification && Notification.permission !== 'denied') new Notification('Caskit', { body: text }); } catch (e) { /* без системных уведомлений */ }
	}
	ui.alertSeen = alerts[alerts.length - 1].id;
	if (ui.tab === 'guard') loadGuard();
}

// ============================================================ первый запуск: приветствие и гайд
const GITHUB_URL = 'https://github.com/pythonMaster2002/cs2-storage-manager';

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

async function openSupport() {
	$('supportModal').classList.remove('hidden');
	if (!ui.support) { try { ui.support = await api('/api/support'); } catch (e) { ui.support = {}; } }
	const s = ui.support, rows = [];
	if (s.steamTrade) rows.push(`<div class="sup"><div class="grow"><div class="strong">${esc(t('sup_skin'))}</div><div class="muted small">${esc(t('sup_skin_hint'))}</div></div><button class="btn primary small" data-open="${esc(s.steamTrade)}">${esc(t('sup_skin_btn'))}</button></div>`);
	if (s.kofi) rows.push(`<div class="sup"><div class="grow"><div class="strong">Ko-fi</div><div class="muted small">${esc(t('sup_kofi_hint'))}</div></div><button class="btn primary small" data-open="${esc(s.kofi)}">${esc(t('sup_kofi_btn'))}</button></div>`);
	if (s.binancePayId) rows.push(`<div class="sup"><div class="grow"><div class="strong">Binance Pay <span class="sup-tag">${esc(t('sup_nofee'))}</span></div><div class="muted small">${esc(t('sup_binance_hint'))}</div><div class="addr">Binance ID (UID): ${esc(s.binancePayId)}</div></div><button class="btn ghost small" data-copy="${esc(s.binancePayId)}">${esc(t('copy'))}</button></div>`);
	for (const c of (s.crypto || []).filter(c => c.address)) {
		rows.push(`<div class="sup"><img class="qr" data-qr="${esc(c.address)}" alt=""><div class="grow"><div class="strong">${esc(c.label)}</div><div class="addr">${esc(c.address)}</div><div class="muted small" style="margin-top:4px">${esc(t('sup_crypto_hint'))}</div></div><button class="btn ghost small" data-copy="${esc(c.address)}">${esc(t('copy'))}</button></div>`);
	}
	if (s.github) rows.push(`<div class="sup"><div class="grow"><div class="strong">GitHub ★</div><div class="muted small">${esc(t('sup_star_hint'))}</div></div><button class="btn ghost small" data-open="${esc(s.github)}">GitHub</button></div>`);
	$('supportList').innerHTML = rows.join('') || `<div class="empty-box">—</div>`;
	for (const img of document.querySelectorAll('#supportList [data-qr]')) {
		api('/api/qr?text=' + encodeURIComponent(img.dataset.qr)).then(r => { img.src = r.dataUrl; }).catch(() => img.remove());
	}
}

// Мягкое напоминание после полезного действия: не чаще раза в 3 дня, отключается в настройках.
// Напоминание о поддержке — только после успешной перекладки, не чаще раза в сутки,
// с галочкой «больше не показывать» (вернуть можно в настройках).
function nudgeSupport(reasonText) {
	const st = ui.settings || {};
	if (st.supportHideNudges || Date.now() - (st.supportNudgeAt || 0) < 86400e3) return;
	saveSetting({ supportNudgeAt: Date.now() });
	const el = document.createElement('div');
	el.className = 'toast good nudge';
	el.innerHTML = `<div>${esc(reasonText)}</div>
		<div class="nudge-row"><button class="btn support-btn small">♥ ${esc(t('support_short'))}</button>
		<label class="check small"><input type="checkbox"> <span>${esc(t('dont_show_again'))}</span></label>
		<button class="nudge-x" title="${esc(t('close'))}">×</button></div>`;
	const close = () => { if (el.querySelector('input').checked) saveSetting({ supportHideNudges: true }); el.remove(); };
	el.querySelector('.support-btn').onclick = () => { close(); openSupport(); };
	el.querySelector('.nudge-x').onclick = close;
	$('toasts').appendChild(el);
	setTimeout(() => { if (el.isConnected) close(); }, 20000);
}

$('loginSupport').addEventListener('click', openSupport);
$('settingsSupport').addEventListener('click', () => { $('settingsModal').classList.add('hidden'); openSupport(); });
$('supportClose').addEventListener('click', () => $('supportModal').classList.add('hidden'));
$('supportList').addEventListener('click', e => {
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
			w.inspect ? `<button class="btn ghost small" data-insp-game="${esc(w.inspect)}">${esc(t('inspect_game'))}</button><button class="btn ghost small" data-insp-copy="${esc(w.inspect)}">${esc(t('copy_link'))}</button>` : '',
			w.invLink ? `<button class="btn ghost small" data-open-inv="${esc(w.invLink)}">${esc(t('st_in_inventory'))}</button>` : '',
		].join('');
		const fl = w.float != null ? `<div class="st-float"><span class="muted small">float ${fl4(w.float)}</span>${floatBar(w.float, { cls: 'sm' })}</div>` : '';
		return `<div class="st-w">${w.image ? `<img src="${esc(w.image)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<div><div class="st-wh"><span class="strong">${esc(w.name)}</span>${acts ? `<span class="st-insp">${acts}</span>` : ''}</div>${fl}<div class="st-slots">${slots}</div></div></div>`;
	}).join('') : `<div class="empty-box">${esc(t('st_no_weapons'))}</div>`;
}

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
	if (ui.settings.stickerConfirm !== false) {
		const img = src => src ? `<img src="${esc(src)}" alt="">` : '';
		const r = await miniConfirm({
			title: t('st_apply_title'), text: t('st_apply_confirm', { name: sel.name, weapon: w ? w.name : '' }),
			extra: sel.image || (w && w.image) ? `<div class="mini-preview">${img(sel.image)}<span class="arrow">→</span>${img(w && w.image)}</div>` : '',
			ok: t('st_put'), dontShow: true,
		});
		if (!r.ok) return;
		if (r.dont) saveSetting({ stickerConfirm: false });
	}
	await stickerAct('/api/stickers/apply', { weaponId, stickerItemId: sel.ids[0], slot }, t('st_applied'));
}

// Соскоблить — тоже с подтверждением: шаг необратим (+10–15% износа), а на 100% следующий шаг снимает наклейку.
async function stickerScrape(weaponId, slot) {
	const w = ui.stk && ui.stk.weapons.find(x => x.id === weaponId);
	const s = w && w.stickers.find(x => x.slot === slot);
	const name = s ? s.name.replace(/^Sticker \| /, '') : '';
	const wear = s ? Math.round(s.wear * 100) : 0;
	const r = await miniConfirm({ warn: true, title: t('st_scrape_title'),
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
	if (d.inspGame) openExt(d.inspGame);
	if (d.inspCopy) copyText(d.inspCopy);
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
	if (!(await miniConfirm({ title: 'Armory', text: t('arm_confirm', { name: i.name, n: q, cost: i.points * q }) })).ok) return;
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
	if (window.desktop.onUpdate) window.desktop.onUpdate(u => {
		const el = document.createElement('div');
		el.className = 'toast good nudge';
		el.innerHTML = `<div>${esc(t(u.ready ? 'update_ready' : 'update_available', { v: u.version }))}</div>
			<div class="nudge-row"><button class="btn primary small" data-u="go">${esc(t(u.ready ? 'update_restart' : 'update_download'))}</button>
			<button class="heart-mini" data-u="heart" title="${esc(t('support_title'))}"><svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" fill="currentColor"/></svg></button>
			<button class="nudge-x" data-u="x">×</button></div>`;
		el.addEventListener('click', e => {
			const k = e.target.closest('[data-u]'); if (!k) return;
			if (k.dataset.u === 'go') u.ready ? window.desktop.installUpdate() : openExt(u.url);
			if (k.dataset.u === 'heart') openSupport();
			if (k.dataset.u === 'x') el.remove();
		});
		$('toasts').appendChild(el);
	});
}
setMode('qr');
try {
	const r = JSON.parse(sessionStorage.getItem('ui_restore') || 'null');
	sessionStorage.removeItem('ui_restore');
	if (r) { if (r.active) ui.active = r.active; if (r.tab) ui.restoreTab = r.tab; }
} catch (e) { /* ignore */ }
loadSettings();
poll(true);
