// Steam Community: торговые предложения, маркет (лоты, ордера, история), мобильные подтверждения.
// Всё идёт напрямую в Steam с веб-сессией аккаунта и через его прокси — сторонних серверов нет.
'use strict';

const SteamTotp = require('steam-totp');
const SteamUser = require('steam-user');

const COMMUNITY = 'https://steamcommunity.com';
const ICON_CDN = 'https://community.akamai.steamstatic.com/economy/image/';

// Состояния трейда (ETradeOfferState).
const OFFER_STATE = {
	1: 'invalid', 2: 'active', 3: 'accepted', 4: 'countered', 5: 'expired', 6: 'canceled', 7: 'declined',
	8: 'invalid_items', 9: 'needs_confirmation', 10: 'canceled_2fa', 11: 'in_escrow',
};

function requireWeb(session) {
	session.ensureOnline();
	if (!session.webCookies) throw new Error('веб-сессия Steam ещё не готова — подождите несколько секунд');
}

// access_token веб-сессии: cookie steamLoginSecure = "<steamid>||<jwt>".
function accessToken(session) {
	const c = (session.webCookies || []).find(x => x.startsWith('steamLoginSecure='));
	if (!c) throw new Error('нет веб-сессии Steam');
	return decodeURIComponent(c.split('=')[1].split(';')[0]).split('||')[1];
}

async function getJson(session, url, form, headers) {
	const res = await session.webRequest(form ? 'POST' : 'GET', url, form, headers);
	if (res.status === 429) throw new Error('Steam ограничил частоту запросов — подождите минуту');
	if (res.status === 401 || res.status === 403) throw new Error('Steam отклонил запрос (нужно войти заново)');
	let data;
	try { data = JSON.parse(res.body); } catch (e) { throw new Error(`Steam вернул не JSON (HTTP ${res.status})`); }
	return data;
}

const steamId64 = session => {
	const id = typeof session.sid64 === 'function' ? session.sid64() : (session.user && session.user.steamID && session.user.steamID.getSteamID64());
	if (!id) throw new Error('нет связи со Steam — подождите несколько секунд и обновите');
	return id;
};
const accountIdToSteamId = accountId => (BigInt('76561197960265728') + BigInt(accountId)).toString();

// ---------------------------------------------------------------- торговые предложения

function describe(item, descriptions) {
	const d = descriptions.get(`${item.appid}_${item.classid}_${item.instanceid}`) || descriptions.get(`${item.appid}_${item.classid}_0`) || {};
	return {
		appid: item.appid, assetid: item.assetid, amount: Number(item.amount || 1),
		name: d.market_name || d.name || `#${item.classid}`,
		image: d.icon_url ? `${ICON_CDN}${d.icon_url}/96fx96f` : null,
		color: d.name_color ? `#${d.name_color}` : null,
	};
}

async function tradeOffers(session, { activeOnly = true } = {}) {
	requireWeb(session);
	const qs = new URLSearchParams({
		get_received_offers: 1, get_sent_offers: 1, get_descriptions: 1, active_only: activeOnly ? 1 : 0,
		historical_only: 0, language: 'english', access_token: accessToken(session),
	});
	if (!activeOnly) qs.set('time_historical_cutoff', Math.floor(Date.now() / 1000) - 30 * 86400);
	const data = await getJson(session, `https://api.steampowered.com/IEconService/GetTradeOffers/v1/?${qs}`);
	const r = data.response || {};
	const descriptions = new Map((r.descriptions || []).map(d => [`${d.appid}_${d.classid}_${d.instanceid}`, d]));
	const map = (o, incoming) => ({
		id: o.tradeofferid, incoming, state: OFFER_STATE[o.trade_offer_state] || String(o.trade_offer_state),
		partner: accountIdToSteamId(o.accountid_other), message: o.message || '',
		created: o.time_created, updated: o.time_updated, expires: o.expiration_time,
		escrowEnd: o.escrow_end_date || 0,
		give: (o.items_to_give || []).map(i => describe(i, descriptions)),
		receive: (o.items_to_receive || []).map(i => describe(i, descriptions)),
	});
	const offers = [...(r.trade_offers_received || []).map(o => map(o, true)), ...(r.trade_offers_sent || []).map(o => map(o, false))]
		.sort((a, b) => b.updated - a.updated);
	// Имена и аватарки партнёров — из CM (быстро, без лишних веб-запросов).
	const partners = [...new Set(offers.map(o => o.partner))];
	if (partners.length) {
		try {
			const { personas } = await session.user.getPersonas(partners);
			for (const o of offers) {
				const p = personas[o.partner];
				if (p) { o.partnerName = p.player_name; o.partnerAvatar = p.avatar_url_medium || null; }
			}
		} catch (e) { /* имена не критичны */ }
	}
	return offers;
}

async function offerAction(session, offerId, action, partner) {
	requireWeb(session);
	const id = String(offerId).replace(/\D/g, '');
	const referer = { Referer: `${COMMUNITY}/tradeoffer/${id}/`, Origin: COMMUNITY };
	if (action === 'accept') {
		const res = await getJson(session, `${COMMUNITY}/tradeoffer/${id}/accept`,
			{ sessionid: session.sessionId(), serverid: 1, tradeofferid: id, partner: String(partner), captcha: '' }, referer);
		if (res.strError) throw new Error(res.strError);
		if (res.needs_mobile_confirmation || res.needs_email_confirmation) {
			if (res.needs_mobile_confirmation && session.identitySecret) {
				await confirmObject(session, id);
				return { accepted: true, confirmed: true };
			}
			return { accepted: true, needsConfirmation: res.needs_mobile_confirmation ? 'mobile' : 'email' };
		}
		return { accepted: true, tradeId: res.tradeid || null };
	}
	if (action === 'decline' || action === 'cancel') {
		const res = await getJson(session, `${COMMUNITY}/tradeoffer/${id}/${action}`, { sessionid: session.sessionId() }, referer);
		if (res.strError) throw new Error(res.strError);
		return { ok: true };
	}
	throw new Error('неизвестное действие');
}

// Подарок = мы ничего не отдаём, только получаем. Такие предложения безопасно принимать автоматически.
async function autoAcceptGifts(session) {
	const offers = await tradeOffers(session, { activeOnly: true });
	const gifts = offers.filter(o => o.incoming && o.state === 'active' && !o.give.length && o.receive.length && !o.escrowEnd);
	const accepted = [];
	for (const o of gifts) {
		try { await offerAction(session, o.id, 'accept', o.partner); accepted.push(o); }
		catch (e) { session.emit('log', `автоприём подарка ${o.id}: ${e.message}`); }
	}
	return accepted;
}

// ---------------------------------------------------------------- мобильные подтверждения

function deviceId(session) {
	return session.deviceId || SteamTotp.getDeviceID(steamId64(session));
}

function confParams(session, tag) {
	const time = SteamTotp.time();
	return new URLSearchParams({
		p: deviceId(session), a: steamId64(session), k: SteamTotp.getConfirmationKey(session.identitySecret, time, tag),
		t: time, m: 'react', tag,
	});
}

async function confirmations(session) {
	requireWeb(session);
	if (!session.identitySecret) throw new Error('для подтверждений нужен maFile (identity_secret) — войдите через maFile');
	const data = await getJson(session, `${COMMUNITY}/mobileconf/getlist?${confParams(session, 'list')}`);
	if (!data.success) throw new Error(data.message || 'Steam не отдал список подтверждений (перевойдите)');
	return (data.conf || []).map(c => ({
		id: c.id, key: c.nonce, type: c.type, typeName: c.type_name, creator: c.creator_id,
		title: c.headline, summary: c.summary || [], icon: c.icon || null, time: c.creation_time,
	}));
}

async function respondConfirmations(session, list, accept) {
	if (!list.length) return { ok: true, count: 0 };
	const qs = confParams(session, accept ? 'accept' : 'reject');
	qs.set('op', accept ? 'allow' : 'cancel');
	const form = new URLSearchParams(qs);
	for (const c of list) { form.append('cid[]', c.id); form.append('ck[]', c.key); }
	const res = await session.webRequest('POST', `${COMMUNITY}/mobileconf/multiajaxop`, form.toString(), { Referer: `${COMMUNITY}/mobileconf/conf` });
	let data; try { data = JSON.parse(res.body); } catch (e) { data = {}; }
	if (!data.success) throw new Error('Steam не принял подтверждение');
	return { ok: true, count: list.length };
}

// Подтвердить конкретный объект (трейд или лот маркета) по его id.
async function confirmObject(session, objectId) {
	for (let i = 0; i < 4; i++) {
		const list = await confirmations(session);
		const c = list.find(x => String(x.creator) === String(objectId));
		if (c) return respondConfirmations(session, [c], true);
		await new Promise(r => setTimeout(r, 1500));
	}
	throw new Error('подтверждение не появилось — подтвердите в мобильном приложении Steam');
}

// ---------------------------------------------------------------- маркет

function currencyOf(id) {
	const n = Number(id) > 2000 ? Number(id) - 2000 : Number(id);
	return SteamUser.ECurrencyCode[n] || '';
}

async function myListings(session) {
	requireWeb(session);
	const listings = [], buyOrders = [];
	let start = 0, total = 0, assets = {};
	do {
		const d = await getJson(session, `${COMMUNITY}/market/mylistings/render/?query=&start=${start}&count=100&l=english&norender=1`);
		if (!d.success) throw new Error('Steam не отдал список лотов');
		assets = d.assets || {};
		const asset = a => (((assets[a.appid] || {})[a.contextid] || {})[a.id]) || {};
		const push = (l, status) => {
			const a = asset(l.asset);
			listings.push({
				id: l.listingid, status, created: l.time_created, appid: Number(l.asset.appid),
				name: a.market_name || a.name || l.asset.id, hashName: a.market_hash_name || null,
				image: a.icon_url ? `${ICON_CDN}${a.icon_url}/96fx96f` : null,
				receive: l.price / 100, buyerPays: (l.price + l.fee) / 100, currency: currencyOf(l.currencyid),
			});
		};
		(d.listings || []).forEach(l => push(l, 'active'));
		(d.listings_to_confirm || []).forEach(l => push(l, 'to_confirm'));
		(d.listings_on_hold || []).forEach(l => push(l, 'on_hold'));
		if (start === 0) for (const o of d.buy_orders || []) {
			buyOrders.push({
				id: o.buy_orderid, appid: o.appid, hashName: o.hash_name,
				name: (o.description && (o.description.market_name || o.description.name)) || o.hash_name,
				image: o.description && o.description.icon_url ? `${ICON_CDN}${o.description.icon_url}/96fx96f` : null,
				price: Number(o.price) / 100, quantity: Number(o.quantity), remaining: Number(o.quantity_remaining),
				currency: SteamUser.ECurrencyCode[o.wallet_currency] || '',
			});
		}
		total = d.num_active_listings || d.total_count || 0;
		start += 100;
	} while (start < total && start < 1000);
	return { listings, buyOrders };
}

async function removeListing(session, listingId) {
	requireWeb(session);
	const id = String(listingId).replace(/\D/g, '');
	const res = await session.webRequest('POST', `${COMMUNITY}/market/removelisting/${id}`, { sessionid: session.sessionId() },
		{ Referer: `${COMMUNITY}/market/`, 'X-Requested-With': 'XMLHttpRequest' });
	if (res.status !== 200) throw new Error(`Steam не снял лот (HTTP ${res.status})`);
	return { ok: true };
}

async function cancelBuyOrder(session, orderId) {
	requireWeb(session);
	const d = await getJson(session, `${COMMUNITY}/market/cancelbuyorder/`, { sessionid: session.sessionId(), buy_orderid: String(orderId) },
		{ Referer: `${COMMUNITY}/market/`, 'X-Requested-With': 'XMLHttpRequest' });
	if (d.success !== 1) throw new Error('Steam не отменил ордер');
	return { ok: true };
}

const unhtml = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

// История маркета: строки из results_html (Steam отдаёт её только HTML-разметкой).
async function marketHistory(session, start = 0, count = 100) {
	requireWeb(session);
	const d = await getJson(session, `${COMMUNITY}/market/myhistory?count=${count}&start=${start}&l=english`);
	if (!d.success) throw new Error('Steam не отдал историю маркета');
	const html = d.results_html || '';
	const rows = [];
	const re = /<div class="market_listing_row market_recent_listing_row" id="(history_row_[^"]+)">([\s\S]*?)(?=<div class="market_listing_row market_recent_listing_row"|$)/g;
	let m;
	while ((m = re.exec(html))) {
		const body = m[2];
		const pick = cls => { const x = body.match(new RegExp(`class="[^"]*${cls}[^"]*"[^>]*>([\\s\\S]*?)</(?:div|span)>`)); return x ? unhtml(x[1]) : ''; };
		const sign = pick('market_listing_gainorloss');
		const dates = [...body.matchAll(/class="market_listing_right_cell market_listing_listed_date[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map(x => unhtml(x[1]));
		const img = body.match(/<img[^>]+src="([^"]+)"/);
		rows.push({
			id: m[1], kind: sign === '+' ? 'buy' : sign === '-' ? 'sell' : 'other',
			name: pick('market_listing_item_name'), game: pick('market_listing_game_name'),
			price: pick('market_listing_price'), actedOn: dates[0] || '', listedOn: dates[1] || '',
			note: pick('market_listing_whoactedwith'), image: img ? img[1].replace(/\/\d+fx\d+f.*$/, '/62fx62f') : null,
		});
	}
	return { total: d.total_count || 0, start, rows };
}

// ---------------------------------------------------------------- продажа на маркете

// Комиссия Steam: 5% Steam + 10% игре (CS2), каждая не меньше 1 цента. buyerPays -> сколько получит продавец.
function feesFor(receive) { return Math.max(1, Math.floor(receive * 0.05)) + Math.max(1, Math.floor(receive * 0.10)); }
// whole — валюта без копеек: цена для покупателя (лот + комиссии) должна выйти целой, берём ближайшую не выше.
function receiveFromBuyer(buyerCents, whole = false) {
	let r = Math.max(1, Math.floor(buyerCents / 1.15));
	while (r > 1 && r + feesFor(r) > buyerCents) r--;
	while (r + 1 + feesFor(r + 1) <= buyerCents) r++;
	if (whole) while (r > 1 && (r + feesFor(r)) % 100) r--;
	return r;
}

// Валюты, в которых ТП принимает только целые суммы: JPY, IDR, VND, KRW, UAH, INR, CLP, COP, TWD, KZT, CRC, UYU
// (bWholeUnitsOnly в g_rgCurrencyData Steam; RUB там тоже помечен, но Steam делает для него исключение — лоты с копейками;
// сверено по лотам ТП во всех валютах 11.10.2026). Цены, перебивка и ордера — шагом в 1 единицу.
const WHOLE_UNITS = new Set([8, 10, 15, 16, 18, 24, 25, 27, 30, 37, 40, 41]);
const walletCur = session => (session.user.wallet && session.user.wallet.currency) || 1;
const isWhole = cur => WHOLE_UNITS.has(Number(cur));
const wholeCents = cents => Math.max(100, Math.round(cents / 100) * 100);

// Предметы CS2, которые можно выставить (marketable), сгруппированные по market_hash_name.
// Игры, предметы которых можно продавать из Caskit: appid -> контекст инвентаря
const GAMES = { 730: { ctx: '2', name: 'Counter-Strike 2' }, 753: { ctx: '6', name: 'Steam' }, 570: { ctx: '2', name: 'Dota 2' }, 440: { ctx: '2', name: 'Team Fortress 2' }, 252490: { ctx: '2', name: 'Rust' } };
const gameOf = appid => (GAMES[Number(appid)] ? Number(appid) : 730);

async function sellableItems(session, appid = 730) {
	requireWeb(session);
	appid = gameOf(appid);
	const ctx = GAMES[appid].ctx;
	const assets = [], descr = new Map();
	let start = null;
	for (let page = 0; page < 5; page++) {
		const url = `${COMMUNITY}/inventory/${steamId64(session)}/${appid}/${ctx}?l=english&count=2000${start ? `&start_assetid=${start}` : ''}`;
		const d = await getJson(session, url);
		if (d && d.success && !d.assets && !d.total_inventory_count) break;  // в этой игре нет предметов
		if (!d || !d.success) throw new Error('Steam не отдал инвентарь (возможно, он скрыт или временный лимит)');
		assets.push(...(d.assets || []));
		for (const x of d.descriptions || []) descr.set(`${x.classid}_${x.instanceid}`, x);
		if (!d.more_items) break;
		start = d.last_assetid;
	}
	const groups = new Map();
	for (const a of assets) {
		const d = descr.get(`${a.classid}_${a.instanceid}`);
		if (!d || !d.marketable) continue;
		if (!groups.has(d.market_hash_name)) groups.set(d.market_hash_name, {
			hashName: d.market_hash_name, name: d.market_name || d.name,
			image: d.icon_url ? `${ICON_CDN}${d.icon_url}/96fx96f` : null, color: d.name_color ? `#${d.name_color}` : null,
			assetids: [], appid, contextid: ctx,
		});
		groups.get(d.market_hash_name).assetids.push(String(a.assetid));
	}
	return [...groups.values()].map(g => ({ ...g, count: g.assetids.length })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const parseMoney = s => { if (!s) return null; const n = Number(String(s).replace(/[^\d.,]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

async function priceOverview(session, hashName, appid = 730) {
	requireWeb(session);
	const cur = (session.user.wallet && session.user.wallet.currency) || 1;
	const d = await getJson(session, `${COMMUNITY}/market/priceoverview/?appid=${gameOf(appid)}&currency=${cur}&market_hash_name=${encodeURIComponent(hashName)}`);
	if (!d || !d.success) throw new Error('Steam не отдал цену этого предмета');
	return { lowest: parseMoney(d.lowest_price), median: parseMoney(d.median_price), volume: Number(String(d.volume || '0').replace(/\D/g, '')) || 0, currency: SteamUser.ECurrencyCode[cur] || '' };
}

// Котировка для продажи: самый дешёвый лот и лучший ордер (стакан новой Торговой площадки, /market/orderbook),
// медиана и продажи за сутки (priceoverview), медианы по дням за 30 дней (pricehistory). Всё — в валюте кошелька.
async function marketQuote(session, hashName, appid = 730) {
	requireWeb(session);
	appid = gameOf(appid);
	const cur = (session.user.wallet && session.user.wallet.currency) || 1;
	const out = { appid, currency: SteamUser.ECurrencyCode[cur] || '', whole: isWhole(cur), lowestSell: null, highestBuy: null, median: null, volume: 0, history: [], sellOrders: 0, buyOrders: 0, bids: [], asks: [] };
	try { const p = await priceOverview(session, hashName, appid); Object.assign(out, { median: p.median, volume: p.volume, lowestSell: p.lowest }); } catch (e) { /* бывает лимит — дальше стакан */ }
	try {
		const r = await session.webRequest('GET', `${COMMUNITY}/market/orderbook?q=Load&qp=${encodeURIComponent(JSON.stringify([appid, hashName]))}`, null, { 'x-valve-request-type': 'queryAction' });
		const book = r.status === 200 && JSON.parse(r.body);
		const b = book && book.data && book.data.success && book.data.data;
		if (b) {
			if (b.amtMinSellOrder) out.lowestSell = b.amtMinSellOrder / 100;
			if (b.amtMaxBuyOrder) out.highestBuy = b.amtMaxBuyOrder / 100;
			out.sellOrders = Number(b.cSellOrders) || 0;
			out.buyOrders = Number(b.cBuyOrders) || 0;
			if (b.eCurrency && SteamUser.ECurrencyCode[b.eCurrency]) { out.currency = SteamUser.ECurrencyCode[b.eCurrency]; out.whole = isWhole(b.eCurrency); }
			// уровни стакана: плоские [цена в центах, штук, цена, штук, …] от лучшей цены
			const levels = flat => { const a = []; for (let i = 0; i + 1 < (flat || []).length && a.length < 12; i += 2) a.push({ price: Number(flat[i]) / 100, qty: Number(flat[i + 1]) || 0 }); return a; };
			out.bids = levels(b.rgCompactBuyOrders);
			out.asks = levels(b.rgCompactSellOrders);
		}
	} catch (e) { /* без стакана */ }
	try {
		const ph = await getJson(session, `${COMMUNITY}/market/pricehistory/?appid=${appid}&market_hash_name=${encodeURIComponent(hashName)}`);
		if (ph && ph.success && Array.isArray(ph.prices)) {
			const byDay = new Map();
			const cut = Date.now() - 31 * 86400e3;
			for (const [when, price, vol] of ph.prices) {
				const ts = Date.parse(String(when).replace(/: \+0$/, ':00 +0000'));
				if (!(ts >= cut)) continue;
				const d = new Date(ts).toISOString().slice(0, 10);
				const x = byDay.get(d) || { d, sum: 0, n: 0, vol: 0 };
				const v = Number(vol) || 1;
				x.sum += Number(price) * v; x.n += v; x.vol += Number(vol) || 0;
				byDay.set(d, x);
			}
			out.history = [...byDay.values()].map(x => ({ d: x.d, price: Math.round(x.sum / x.n * 100) / 100, volume: x.vol }));
		}
	} catch (e) { /* без графика */ }
	return out;
}

// Выставить предметы: items = [{assetid, buyerPays (в основных единицах валюты)}]. Лоты по одному с паузой
// (иначе Steam ограничивает частоту), затем — подтверждение лотов через maFile, если он есть.
async function sellItems(session, items, { autoConfirm = true } = {}) {
	requireWeb(session);
	const results = [];
	const whole = isWhole(walletCur(session));
	for (let k = 0; k < items.length; k++) {
		const it = items[k];
		const cents = Math.round(Number(it.buyerPays) * 100);
		const receive = receiveFromBuyer(whole ? wholeCents(cents) : cents, whole);
		try {
			const d = await getJson(session, `${COMMUNITY}/market/sellitem/`, {
				sessionid: session.sessionId(), appid: gameOf(it.appid || 730), contextid: String(it.contextid || GAMES[gameOf(it.appid || 730)].ctx), assetid: String(it.assetid), amount: 1, price: receive,
			}, { Referer: `${COMMUNITY}/profiles/${steamId64(session)}/inventory/`, Origin: COMMUNITY });
			if (!d.success) throw new Error(d.message || 'Steam отклонил лот');
			results.push({ assetid: it.assetid, ok: true, receive: receive / 100, needsConfirmation: Boolean(d.requires_confirmation || d.needs_mobile_confirmation) });
		} catch (e) {
			// только что вынутый из ящика предмет может ещё не появиться в веб-инвентаре — одна повторная попытка
			if (it.fresh && !it.retried) { it.retried = true; items.push(it); await new Promise(r => setTimeout(r, 2500)); continue; }
			results.push({ assetid: it.assetid, ok: false, error: e.message });
		}
		await new Promise(r => setTimeout(r, 1200));
	}
	let confirmed = 0;
	if (autoConfirm && session.identitySecret && results.some(r => r.needsConfirmation)) {
		try {
			const { listings } = await myListings(session);
			const pending = new Set(listings.filter(l => l.status === 'to_confirm').map(l => String(l.id)));
			const conf = (await confirmations(session)).filter(c => pending.has(String(c.creator)));
			if (conf.length) { await respondConfirmations(session, conf, true); confirmed = conf.length; }
		} catch (e) { session.emit('log', `подтверждение лотов: ${e.message}`); }
	}
	return { listed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok), confirmed, needsConfirmation: results.some(r => r.needsConfirmation) && !confirmed };
}

// Ордер на покупку (как в steamTrader): price — сколько платит покупатель за штуку (в валюте кошелька).
// Если Steam просит мобильное подтверждение — подтверждаем через maFile и повторяем запрос с его id.
async function createBuyOrder(session, { appid = 730, name, price, quantity }) {
	requireWeb(session);
	appid = gameOf(appid);
	const cur = walletCur(session);
	let cents = Math.round(Number(price) * 100);
	if (isWhole(cur) && cents > 0) cents = wholeCents(cents);  // гривны, тенге, иены… — только целые суммы
	const qty = Math.floor(Number(quantity));
	if (!name || !(cents >= 3) || !(qty >= 1)) throw new Error('проверьте предмет, цену и количество');
	const form = { sessionid: session.sessionId(), currency: cur, appid, market_hash_name: name, price_total: cents * qty, tradefee_tax: 0,
		quantity: qty, billing_state: '', save_my_address: '0', confirmation: '0' };
	const ref = { Referer: `${COMMUNITY}/market/listings/${appid}/${encodeURIComponent(name)}`, Origin: COMMUNITY, 'X-Requested-With': 'XMLHttpRequest' };
	for (let attempt = 0; attempt < 3; attempt++) {
		const d = await getJson(session, `${COMMUNITY}/market/createbuyorder/`, form, ref);
		if (d && d.success === 1) return { ok: true, orderId: d.buy_orderid ? String(d.buy_orderid) : null };
		const conf = d && d.confirmation;
		if (d && (d.need_confirmation || d.success === 22) && conf && conf.confirmation_id) {
			const cid = String(conf.confirmation_id);
			if (!session.identitySecret) return { ok: false, needsConfirmation: true, message: 'подтвердите ордер в мобильном приложении Steam и создайте его ещё раз' };
			await new Promise(r => setTimeout(r, 2000));
			const list = (await confirmations(session)).filter(c => String(c.id) === cid || String(c.creator) === cid);
			if (list.length) await respondConfirmations(session, list, true);
			form.confirmation = cid;
			continue;
		}
		throw new Error((d && d.message) || 'Steam не создал ордер');
	}
	throw new Error('ордер не подтвердился — проверьте подтверждения Steam Guard');
}

module.exports = { createBuyOrder,
	sellableItems, priceOverview, sellItems, receiveFromBuyer, marketQuote, GAMES,
	tradeOffers, offerAction, autoAcceptGifts,
	confirmations, respondConfirmations, confirmObject,
	myListings, removeListing, cancelBuyOrder, marketHistory,
};
