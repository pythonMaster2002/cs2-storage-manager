'use strict';

const TOKEN = location.hash.slice(1);
const CFG = window.APP_CONFIG || {};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

function setLang(l) {
	LANG = l;
	try { localStorage.setItem('lang', l); } catch (e) { /* ignore */ }
	[$('langSelect'), $('langSelect2')].forEach(sel => { if (sel) sel.value = l; });
	applyStaticI18n();
	rerenderAll();
}

function fillLangSelects() {
	const opts = window.I18N.langs.map(l => `<option value="${l.code}">${esc(l.name)}</option>`).join('');
	[$('langSelect'), $('langSelect2')].forEach(sel => { if (sel) { sel.innerHTML = opts; sel.value = LANG; sel.addEventListener('change', e => setLang(e.target.value)); } });
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
	status: null, active: null, state: null,
	casketId: null, op: 'store', contents: {}, picks: {},
	search: '', onlyCases: false, showFull: false, loadingItems: false,
	tab: 'caskets', store: null, overview: null,
	tu: { groups: null, rarity: null, stattrak: null, picks: {} },
	lastJobKey: {}, jobDismissed: null,
	addingAccount: false, cart: {}, co: null,
	settings: { fastBuy: false, favorites: [], autoAcceptGifts: false },
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
	ui.mode = mode;
	document.querySelectorAll('.login-card .segmented button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
	document.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== mode));
	if (!$('loginBtn').dataset.cancel) $('loginBtn').textContent = mode === 'qr' ? t('btn_show_qr') : t('btn_login');
	$('loginError').classList.add('hidden');
}

async function renderSaved() {
	const list = await api('/api/accounts').catch(() => []);
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
	$('guardModal').classList.add('hidden');
	renderAccountBar(accounts, pending);
	const active = activeAccount();
	if (!active) return;
	if (ui._freshActive || ui._loadedActive !== ui.active) {
		ui._loadedActive = ui.active; ui._freshActive = false;
		ui.contents = {}; ui.casketId = null; ui.picks = {}; ui.store = null; ui.cart = {};
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
	if (st === 'connecting') {
		showView('connectingView');
		$('connectingTitle').textContent = pending.login ? t('connecting_to', { login: pending.login }) : t('connecting');
		$('guardModal').classList.add('hidden');
	} else if (st === 'guard') {
		showView('connectingView');
		$('connectingTitle').textContent = pending.login ? t('connecting_to', { login: pending.login }) : t('connecting');
		showGuard(pending);
	} else if (st === 'qr') {
		showView('loginView'); setMode('qr'); renderSaved(); showQr(pending); $('guardModal').classList.add('hidden');
	} else {
		showView('loginView'); $('guardModal').classList.add('hidden'); hideQr(); renderSaved();
		if (pending && pending.error) showLoginError(pending.error);
		if (pending && pending.needsRelogin && pending.login) prefillRelogin(pending.login);
	}
}

function showQr(pending) {
	$('qrImg').src = pending.qr || '';
	$('qrImg').classList.toggle('hidden', !pending.qr);
	$('qrPlaceholder').classList.toggle('hidden', Boolean(pending.qr));
	$('loginBtn').textContent = t('btn_cancel'); $('loginBtn').dataset.cancel = '1';
}
function hideQr() {
	$('qrImg').classList.add('hidden'); $('qrPlaceholder').classList.remove('hidden');
	delete $('loginBtn').dataset.cancel;
	if (ui.mode === 'qr') $('loginBtn').textContent = t('btn_show_qr');
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
		const cls = a.needsRelogin ? 'warn' : a.status === 'online' ? 'ok' : a.status === 'connecting' ? 'warn' : 'bad';
		return `<div class="acct ${a.login === ui.active ? 'sel' : ''}" data-acct="${esc(a.login)}">
			${avatarHtml(a, 'acct-av')}
			<span class="acct-dot ${cls}"></span>
			<span class="acct-text"><span class="acct-name">${esc(a.personaName || a.login)}</span>${a.personaName && a.personaName !== a.login ? `<span class="acct-login">${esc(a.login)}</span>` : ''}</span>
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
		toast(job.error ? t('done_err', { e: job.error }) : t('done_ok', { n: fmt(job.done) }), job.error ? 'bad' : 'good');
		if (!job.error && job.done >= 50) setTimeout(() => nudgeSupport(t('nudge_moved', { n: fmt(job.done), s: Math.max(1, Math.round((job.ended - job.started) / 1000)) })), 1500);
	}
	ui.lastJobKey[active.login] = key;
	renderJob(job);
	updateAction();
}

// ============================================================ основной экран (активный аккаунт)
async function loadState() {
	ui.state = await apiGet('/api/state');
	renderTop(); renderCaskets();
	if (ui.casketId && !ui.state.caskets.some(c => c.id === ui.casketId)) selectCasket(null);
	else renderPanel();
}

function renderTop() {
	const s = ui.state; if (!s) return;
	$('invMeterText').textContent = `${s.inventoryCount} / ${s.inventoryLimit}`;
	const pct = s.inventoryCount / s.inventoryLimit * 100;
	$('invMeter').style.width = `${pct}%`;
	$('invMeter').className = pct >= 98 ? 'full' : pct >= 85 ? 'warn' : '';
	const inCaskets = s.caskets.reduce((n, c) => n + c.count, 0);
	$('emptyStats').textContent = t('empty_stats', { c: s.caskets.length, a: fmt(inCaskets), b: fmt(s.inventoryCount) });
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
	if (!id) return;
	const c = currentCasket();
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
	try { ui.status = await api('/api/status'); renderAccounts(ui.status); }
	catch (e) { /* сервер ещё стартует */ }
	const s = ui.status;
	const busy = s && ((s.pending && ['connecting', 'guard', 'qr'].includes(s.pending.status)) || (s.accounts || []).some(a => a.job && !a.job.finished));
	pollTimer = setTimeout(poll, busy ? 700 : 2000);
}

// ============================================================ вкладки и магазин
function switchTab(tab) {
	ui.tab = tab;
	document.querySelectorAll('#topnav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
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
		$('storeWallet').textContent = ui.store.balance != null ? t('wallet', { balance: fmt(ui.store.balance), currency: ui.store.currency }) : '';
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
	$('fastBadge').classList.toggle('hidden', !ui.settings.fastBuy);
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
	$('fastBuyToggle').checked = ui.settings.fastBuy;
	$('giftToggle').checked = ui.settings.autoAcceptGifts;
	updateCartBtn();
}

function openSettings() {
	$('fastBuyToggle').checked = ui.settings.fastBuy;
	$('nudgeOff').checked = Boolean(ui.settings.supportHideNudges);
	$('settingsModal').classList.remove('hidden');
}

async function setFastBuy(on) {
	ui.settings.fastBuy = on;
	try { ui.settings = await api('/api/settings', { fastBuy: on }); } catch (e) { toast(e.message, 'bad'); }
	updateCartBtn();
	if (ui.co) $('coHint').classList.toggle('hidden', ui.settings.fastBuy);
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
	$('coHint').classList.toggle('hidden', ui.settings.fastBuy);
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
		<label class="check co-dontshow"><input type="checkbox" id="coDontShow"> <span>${esc(t('dont_show'))}</span></label>
		<div class="co-actions" id="coActions"></div>`);
	// Двухшаговое подтверждение: «Оплатить» → «Подтверждаю оплату {сумма}». Только после второго шага списание.
	return new Promise(resolve => {
		ui.co.answer = ok => { ui.co.answer = null; resolve(ok); };
		const sum = `${money(order.total)} ${order.currency}`;
		const step1 = () => {
			$('coActions').innerHTML = `
				<button class="btn ghost" id="coCancel">${esc(t('cancel'))}</button>
				<button class="btn primary big" id="coAuthorize">${esc(t('authorize'))}</button>`;
			$('coCancel').onclick = () => ui.co.answer && ui.co.answer(false);
			$('coAuthorize').onclick = step2;
			$('coAuthorize').focus();
		};
		const step2 = () => {
			$('coActions').innerHTML = `
				<button class="btn ghost" id="coBack">${esc(t('back'))}</button>
				<span class="co-confirm-text">${esc(t('pay_confirm_text', { total: sum }))}</span>
				<button class="btn primary big" id="coPay">${esc(t('pay_confirm_btn'))}</button>`;
			$('coBack').onclick = step1;
			$('coPay').onclick = async () => {
				if ($('coDontShow').checked) await setFastBuy(true);  // дальше — без окна (вернуть можно в настройках)
				ui.co.answer && ui.co.answer(true);
			};
			$('coPay').focus();
		};
		step1();
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
			if (!ui.settings.fastBuy) {
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
		coFinish('good', t('checkout_done', { n }), [
			{ label: '♥ ' + t('support_short'), run: () => { closeCheckout(); openSupport(); } },
			{ label: t('close'), primary: true, run: closeCheckout },
		]);
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
$('loginBtn').addEventListener('click', () => $('loginBtn').dataset.cancel ? api('/api/logout', {}).then(() => poll(true)) : loginFromForm());
['crPassword', 'maPassword'].forEach(id => $(id).addEventListener('keydown', e => e.key === 'Enter' && loginFromForm()));
$('loginBack').addEventListener('click', () => { ui.addingAccount = false; renderAccounts(ui.status || { accounts: [], pending: null }); });
$('savedList').addEventListener('click', e => {
	const l = e.target.dataset.login, f = e.target.dataset.forget;
	if (l) login({ mode: 'saved', login: l });
	if (f && confirm(t('forget_confirm', { login: f }))) api('/api/accounts/forget', { login: f }).then(renderSaved);
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
	if (add) { ui.addingAccount = true; ui.maFile = null; setMode('qr'); renderLoginFlow(ui.status && ui.status.pending, true); return; }
	if (x) { const login = x.dataset.logout; api('/api/logout', { account: login }).then(() => { if (ui.active === login) ui.active = null; poll(true); }); return; }
	if (chip && chip.dataset.acct !== ui.active) { ui.active = chip.dataset.acct; ui._freshActive = true; ui.tab = 'caskets'; switchTab('caskets'); renderAccounts(ui.status); }
});

$('topnav').addEventListener('click', e => { const t2 = e.target.dataset.tab; if (t2) switchTab(t2); });
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
$('exportBtn').addEventListener('click', async () => {
	$('exportBtn').disabled = true;
	try {
		const r = await apiPost('/api/export', {});
		toast(t('saved_json_csv'), 'good', window.desktop ? { label: t('open_folder'), run: () => window.desktop.openPath(r.folder) } : null);
	} catch (e) { toast(e.message, 'bad'); }
	$('exportBtn').disabled = false;
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
$('settingsBtn').addEventListener('click', openSettings);
$('settingsClose').addEventListener('click', () => $('settingsModal').classList.add('hidden'));
$('fastBuyToggle').addEventListener('change', e => setFastBuy(e.target.checked));
$('coHintLink').addEventListener('click', e => { e.preventDefault(); openSettings(); });
document.addEventListener('keydown', e => {
	if (e.key !== 'Escape') return;
	if (!$('supportModal').classList.contains('hidden')) return $('supportModal').classList.add('hidden');
	if (!$('settingsModal').classList.contains('hidden')) return $('settingsModal').classList.add('hidden');
	if (ui.co && ui.co.answer) return ui.co.answer(false);
	if (ui.co && !ui.co.busy) closeCheckout();
});

// ============================================================ обзор (аналитика)
const RARITY_COLORS = { 1: '#b0c3d9', 2: '#5e98d9', 3: '#4b69ff', 4: '#8847ff', 5: '#d32ce6', 6: '#eb4b4b', 7: '#e4ae39' };
const RARITY_NAMES = { 1: 'Consumer', 2: 'Industrial', 3: 'Mil-Spec', 4: 'Restricted', 5: 'Classified', 6: 'Covert', 7: 'Contraband' };

async function loadOverview() {
	try { ui.overview = await apiGet('/api/overview'); renderOverview(); }
	catch (e) { toast(e.message, 'bad'); }
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

function renderOverview() {
	const o = ui.overview; if (!o) return;
	$('ovTotal').textContent = fmt(o.totalItems);
	$('ovTotalSub').textContent = `${fmt(o.inventoryCount)} ${t('in_inventory')} · ${fmt(o.stored)} ${t('in_casket')}`;
	$('ovInv').textContent = fmt(o.inventoryCount);
	$('ovInvNum').textContent = `${o.inventoryCount} / ${o.inventoryLimit}`;
	const ip = o.inventoryCount / o.inventoryLimit * 100;
	$('ovInvMeter').style.width = `${ip}%`;
	$('ovInvMeter').className = ip >= 98 ? 'full' : ip >= 85 ? 'warn' : '';
	$('ovStored').textContent = fmt(o.stored);
	$('ovStNum').textContent = t('ov_caskets', { n: o.casketCount });
	const sp = o.casketCapacity ? o.stored / o.casketCapacity * 100 : 0;
	$('ovStMeter').style.width = `${sp}%`;
	$('ovStMeter').className = sp >= 98 ? 'full' : sp >= 85 ? 'warn' : '';
	const rarityRows = Object.keys(o.byRarity).map(Number).sort((a, b) => b - a)
		.map(r => ({ label: RARITY_NAMES[r] || ('#' + r), count: o.byRarity[r], color: RARITY_COLORS[r] }));
	ovBars('ovRarity', rarityRows);
	const kindRows = Object.entries(o.byKind).sort((a, b) => b[1] - a[1])
		.map(([k, c]) => ({ label: t('kind_' + k), count: c }));
	ovBars('ovKind', kindRows);
}

// ============================================================ контракт обмена (трейд-ап)
// Названия грейдов — игровые термины CS2, одинаковы на всех языках.
const GRADES = { 1: 'Consumer', 2: 'Industrial', 3: 'Mil-Spec', 4: 'Restricted', 5: 'Classified', 6: 'Covert' };
const gradeName = (r, st) => (st ? 'StatTrak™ ' : '') + (GRADES[r] || ('#' + r));

async function loadTradeup() {
	$('tuGroups').innerHTML = Array.from({ length: 5 }, () => '<div class="skeleton" style="height:46px;margin:6px 0"></div>').join('');
	$('tuEmpty').classList.remove('hidden'); $('tuPanel').classList.add('hidden');
	try {
		ui.tu.groups = await apiGet('/api/tradeup/groups' + ($('tuCaskets').checked ? '?caskets=1' : ''));
		ui.tu.rarity = null; ui.tu.stattrak = null; ui.tu.picks = {};
		renderTuGroups(); tuUpdateAction();
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
	ui.tu.rarity = rarity; ui.tu.stattrak = stattrak; ui.tu.picks = {};
	renderTuGroups();
	const g = currentTuGroup();
	$('tuEmpty').classList.toggle('hidden', Boolean(g));
	$('tuPanel').classList.toggle('hidden', !g);
	if (g) { $('tuGroupName').textContent = gradeName(g.rarity, g.stattrak) + ' · ' + g.total; renderTuItems(); }
}

const tuTotal = () => Object.values(ui.tu.picks).reduce((a, b) => a + b, 0);
function tuSetPick(name, value, max) { const n = Math.max(0, Math.min(max, Math.floor(Number(value) || 0))); if (n) ui.tu.picks[name] = n; else delete ui.tu.picks[name]; }

function renderTuItems() {
	const g = currentTuGroup(); if (!g) return;
	$('tuItems').innerHTML = g.items.map(i => {
		const n = ui.tu.picks[i.name] || 0;
		return `<div class="item ${n ? 'picked' : ''}">
			<div class="thumb">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy">` : ''}</div>
			<div style="min-width:0"><div class="item-name" title="${esc(i.name)}">${esc(i.name)}</div>
				<div class="item-sub">${t('in_inventory')}: ${fmt(i.count - (i.stored || 0))}${i.stored ? ` · ${t('in_casket')}: ${fmt(i.stored)}` : ''}</div></div>
			<div class="stepper" data-name="${esc(i.name)}" data-max="${i.count}">
				<button data-step="-1">−</button>
				<input type="number" min="0" max="${i.count}" value="${n || ''}" placeholder="0">
				<button data-step="1">+</button>
			</div>
		</div>`;
	}).join('');
	tuUpdateAction();
}

function tuUpdateAction() {
	const total = tuTotal();
	$('tuCount').textContent = total;
	$('tuWarn').textContent = total === 10 ? '' : (total > 10 ? t('tradeup_need10', { n: total }) : '');
	$('tuDo').disabled = total !== 10;
	document.querySelectorAll('#tuItems .stepper').forEach(st => {
		const n = ui.tu.picks[st.dataset.name] || 0;
		const input = st.querySelector('input');
		if (document.activeElement !== input) input.value = n || '';
		st.closest('.item').classList.toggle('picked', Boolean(n));
	});
}

async function runTradeUp() {
	const g = currentTuGroup(); if (!g) return;
	const ids = [];
	for (const [name, count] of Object.entries(ui.tu.picks)) {
		const it = g.items.find(x => x.name === name);
		if (it) ids.push(...it.ids.slice(0, count));
	}
	if (ids.length !== 10) return toast(t('tradeup_need10', { n: ids.length }), 'bad');
	if (!confirm(t('tradeup_confirm'))) return;
	$('tuDo').disabled = true;
	try {
		const r = await apiPost('/api/tradeup/craft', { itemIds: ids });
		toast(r.name ? t('tradeup_done', { name: r.name }) : t('tradeup_done_unknown'), 'good');
		setTimeout(() => nudgeSupport(t('nudge_generic')), 1500);
		await loadTradeup();
		if (ui.state) loadState().catch(() => {});
	} catch (e) { toast(e.message, 'bad'); tuUpdateAction(); }
}

$('tuGroups').addEventListener('click', e => { const el = e.target.closest('[data-rarity]'); if (el) selectTuGroup(Number(el.dataset.rarity), el.dataset.st === '1'); });
$('tuItems').addEventListener('click', e => {
	const st = e.target.closest('.stepper'); const step = e.target.dataset.step;
	if (!st || !step) return;
	tuSetPick(st.dataset.name, (ui.tu.picks[st.dataset.name] || 0) + Number(step), Number(st.dataset.max));
	tuUpdateAction();
});
$('tuItems').addEventListener('input', e => { const st = e.target.closest('.stepper'); if (!st) return; tuSetPick(st.dataset.name, e.target.value, Number(st.dataset.max)); tuUpdateAction(); });
$('tuDo').addEventListener('click', runTradeUp);
$('tuCaskets').addEventListener('change', loadTradeup);


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
	if (action === 'accept' && o.give.length && !confirm(t('trade_accept_confirm', { n: o.give.length }))) return;
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
	if (!confirm(t('m_sell_confirm', { n: items.length, total: money(total), currency: ui.sell.currency }))) return;
	$('mBulk').disabled = true;
	toast(t('m_selling', { n: items.length }));
	try {
		const r = await apiPost('/api/market/sell', { items });
		toast(t('m_sold_result', { n: r.listed }) + (r.confirmed ? ' · ' + t('m_auto_confirmed', { n: r.confirmed }) : r.needsConfirmation ? ' · ' + t('trade_need_confirm') : ''), r.failed.length ? 'bad' : 'good');
		if (r.failed.length) toast(r.failed[0].error, 'bad');
		ui.sell = null; ui.market = null; await loadMarket();
		if (r.listed) setTimeout(() => nudgeSupport(t('nudge_generic')), 1500);
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
	if (d.mremove && confirm(t('m_remove_confirm'))) marketAct('/api/market/remove', { id: d.mremove }, t('m_removed'));
	if (d.mcancel && confirm(t('m_cancel_confirm'))) marketAct('/api/market/cancelorder', { id: d.mcancel }, t('m_cancelled'));
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
	if (ids.length && confirm(t('m_confirm_all', { n: ids.length }) + '?')) marketAct('/api/confirmations', { ids, accept: true }, t('m_confirmed'));
});

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
function nudgeSupport(reasonText) {
	const st = ui.settings || {};
	if (st.supportHideNudges || Date.now() - (st.supportNudgeAt || 0) < 3 * 86400e3) return;
	ui.settings.supportNudgeAt = Date.now();
	api('/api/settings', { supportNudgeAt: ui.settings.supportNudgeAt }).catch(() => {});
	const el = document.createElement('div');
	el.className = 'toast good';
	el.innerHTML = `${esc(reasonText)} <button class="btn support-btn small" style="margin-left:10px">♥ ${esc(t('support_short'))}</button><button class="nudge-x" title="${esc(t('close'))}">×</button>`;
	el.querySelector('.support-btn').onclick = () => { el.remove(); openSupport(); };
	el.querySelector('.nudge-x').onclick = () => el.remove();
	$('toasts').appendChild(el);
	setTimeout(() => el.remove(), 15000);
}

$('supportBtn').addEventListener('click', openSupport);
$('loginSupport').addEventListener('click', openSupport);
$('settingsSupport').addEventListener('click', () => { $('settingsModal').classList.add('hidden'); openSupport(); });
$('supportClose').addEventListener('click', () => $('supportModal').classList.add('hidden'));
$('supportList').addEventListener('click', e => {
	const b = e.target.closest('[data-open],[data-copy]'); if (!b) return;
	if (b.dataset.open) openExt(b.dataset.open);
	if (b.dataset.copy) copyText(b.dataset.copy);
});
$('nudgeOff').addEventListener('change', async e => { try { ui.settings = await api('/api/settings', { supportHideNudges: e.target.checked }); } catch (err) { toast(err.message, 'bad'); } });

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
		const slots = Array.from({ length: d.slots }, (_, i) => {
			const s = w.stickers.find(x => x.slot === i);
			if (s) return `<div class="st-slot full" title="${esc(s.name)} · ${t('st_wear')} ${Math.round(s.wear * 100)}%">${s.image ? `<img src="${esc(s.image)}" alt="">` : ''}<div class="nm">${esc(s.name.replace(/^Sticker \| /, ''))}</div>
				<div class="acts"><button data-scrape="${esc(w.id)}" data-slot="${i}">${esc(t('st_scrape'))}</button><button class="rm" data-remove="${esc(w.id)}" data-slot="${i}">${esc(t('delete'))}</button></div></div>`;
			return sel ? `<div class="st-slot target" data-put="${esc(w.id)}" data-slot="${i}">+ ${esc(t('st_put'))}</div>` : `<div class="st-slot"><span class="muted">${i + 1}</span></div>`;
		}).join('');
		return `<div class="st-w">${w.image ? `<img src="${esc(w.image)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<div><div class="strong">${esc(w.name)}</div><div class="st-slots">${slots}</div></div></div>`;
	}).join('') : `<div class="empty-box">${esc(t('st_no_weapons'))}</div>`;
}

async function stickerAct(url, body, msg, ask) {
	if (ui.stkBusy) return;
	if (ask && !confirm(ask)) return;
	ui.stkBusy = true;
	try { await apiPost(url, body); toast(msg, 'good'); await loadStickers(); }
	catch (e) { toast(e.message, 'bad'); }
	finally { ui.stkBusy = false; }
}

$('stRefresh').addEventListener('click', loadStickers);
$('stSearch').addEventListener('input', renderStickers);
$('stStickers').addEventListener('click', e => { const s = e.target.closest('[data-stk]'); if (s) { const id = Number(s.dataset.stk); ui.stkSel = ui.stkSel === id ? null : id; renderStickers(); } });
$('stWeapons').addEventListener('click', e => {
	const d = e.target.dataset;
	if (d.put) {
		const sel = ui.stk.stickers.find(s => s.stickerId === ui.stkSel); if (!sel) return;
		const w = ui.stk.weapons.find(x => x.id === d.put);
		stickerAct('/api/stickers/apply', { weaponId: d.put, stickerItemId: sel.ids[0], slot: Number(d.slot) }, t('st_applied'), t('st_apply_confirm', { name: sel.name, weapon: w ? w.name : '' }));
	}
	if (d.scrape) stickerAct('/api/stickers/scrape', { weaponId: d.scrape, slot: Number(d.slot) }, t('st_scraped'));
	if (d.remove) stickerAct('/api/stickers/scrape', { weaponId: d.remove, slot: Number(d.slot), remove: true }, t('st_removed'), t('st_remove_confirm'));
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
	if (!confirm(t('arm_confirm', { name: i.name, n: q, cost: i.points * q }))) return;
	document.querySelectorAll('[data-redeem]').forEach(b => { b.disabled = true; });
	try {
		const r = await apiPost('/api/armory/redeem', { redeemId: rid, count: q });
		toast(t('arm_done', { name: r.name, n: r.redeemed }), 'good');
		setTimeout(() => nudgeSupport(t('nudge_generic')), 1500);
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
$('donateLink').addEventListener('click', e => { e.preventDefault(); openSupport(); });
if (window.desktop) {
	window.desktop.version().then(v => { $('versionText').textContent = t('version', { v }); });
	if (window.desktop.onUpdate) window.desktop.onUpdate(u => {
		const action = u.ready ? { label: t('update_restart'), run: () => window.desktop.installUpdate() } : { label: t('update_download'), run: () => openExt(u.url) };
		toast(t(u.ready ? 'update_ready' : 'update_available', { v: u.version }), 'good', action);
	});
}
setMode('qr');
loadSettings();
poll(true);
