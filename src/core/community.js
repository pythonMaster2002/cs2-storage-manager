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

const steamId64 = session => session.user.steamID.getSteamID64();
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
function receiveFromBuyer(buyerCents) {
	let r = Math.max(1, Math.floor(buyerCents / 1.15));
	while (r > 1 && r + feesFor(r) > buyerCents) r--;
	while (r + 1 + feesFor(r + 1) <= buyerCents) r++;
	return r;
}

// Предметы CS2, которые можно выставить (marketable), сгруппированные по market_hash_name.
async function sellableItems(session) {
	requireWeb(session);
	const assets = [], descr = new Map();
	let start = null;
	for (let page = 0; page < 5; page++) {
		const url = `${COMMUNITY}/inventory/${steamId64(session)}/730/2?l=english&count=2000${start ? `&start_assetid=${start}` : ''}`;
		const d = await getJson(session, url);
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
			assetids: [],
		});
		groups.get(d.market_hash_name).assetids.push(String(a.assetid));
	}
	return [...groups.values()].map(g => ({ ...g, count: g.assetids.length })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const parseMoney = s => { if (!s) return null; const n = Number(String(s).replace(/[^\d.,]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

async function priceOverview(session, hashName) {
	requireWeb(session);
	const cur = (session.user.wallet && session.user.wallet.currency) || 1;
	const d = await getJson(session, `${COMMUNITY}/market/priceoverview/?appid=730&currency=${cur}&market_hash_name=${encodeURIComponent(hashName)}`);
	if (!d || !d.success) throw new Error('Steam не отдал цену этого предмета');
	return { lowest: parseMoney(d.lowest_price), median: parseMoney(d.median_price), volume: Number(String(d.volume || '0').replace(/\D/g, '')) || 0, currency: SteamUser.ECurrencyCode[cur] || '' };
}

// Выставить предметы: items = [{assetid, buyerPays (в основных единицах валюты)}]. Лоты по одному с паузой
// (иначе Steam ограничивает частоту), затем — подтверждение лотов через maFile, если он есть.
async function sellItems(session, items) {
	requireWeb(session);
	const results = [];
	for (const it of items) {
		const receive = receiveFromBuyer(Math.round(Number(it.buyerPays) * 100));
		try {
			const d = await getJson(session, `${COMMUNITY}/market/sellitem/`, {
				sessionid: session.sessionId(), appid: 730, contextid: 2, assetid: String(it.assetid), amount: 1, price: receive,
			}, { Referer: `${COMMUNITY}/profiles/${steamId64(session)}/inventory/`, Origin: COMMUNITY });
			if (!d.success) throw new Error(d.message || 'Steam отклонил лот');
			results.push({ assetid: it.assetid, ok: true, receive: receive / 100, needsConfirmation: Boolean(d.requires_confirmation || d.needs_mobile_confirmation) });
		} catch (e) { results.push({ assetid: it.assetid, ok: false, error: e.message }); }
		await new Promise(r => setTimeout(r, 1200));
	}
	let confirmed = 0;
	if (session.identitySecret && results.some(r => r.needsConfirmation)) {
		try {
			const { listings } = await myListings(session);
			const pending = new Set(listings.filter(l => l.status === 'to_confirm').map(l => String(l.id)));
			const conf = (await confirmations(session)).filter(c => pending.has(String(c.creator)));
			if (conf.length) { await respondConfirmations(session, conf, true); confirmed = conf.length; }
		} catch (e) { session.emit('log', `подтверждение лотов: ${e.message}`); }
	}
	return { listed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok), confirmed, needsConfirmation: results.some(r => r.needsConfirmation) && !confirmed };
}

module.exports = {
	sellableItems, priceOverview, sellItems, receiveFromBuyer,
	tradeOffers, offerAction, autoAcceptGifts,
	confirmations, respondConfirmations, confirmObject,
	myListings, removeListing, cancelBuyOrder, marketHistory,
};
