// Покупка ящиков (Storage Unit) во внутриигровом магазине CS2 через Game Coordinator.
//
//   1. StoreGetUserData (2500→2501) — прайс магазина: LZMA (формат Valve) + бинарный KeyValues;
//      ящик — запись «casket», цены в минимальных единицах каждой валюты (USD 199 = $1.99).
//   2. StorePurchaseInit (2510→2511) — GC создаёт заказ (orderid), деньги ещё НЕ списаны.
//      Одновременно Steam (CM, не GC) присылает ClientMicroTxnAuthRequest (5504): extended-заголовок,
//      тело = 1 байт + бинарный KeyValues «MessageObject» с transid (64 бита), orderid, суммой.
//   3. ClientMicroTxnAuthorize (5505): transid (uint64 LE) + uint32 1 — это кнопка «Купить» оверлея,
//      здесь списание. Ответ ClientMicroTxnAuthorizeResponse (5506): eresult (uint32) + 1 байт.
//   4. StorePurchaseFinalize (2504→2505) с orderid — GC выдаёт предметы. Сообщение должно идти
//      с source job id (иначе GC молча игнорирует), поэтому шлём через sendToGC с колбэком.
'use strict';

const fs = require('fs');
const path = require('path');
const LZMA = require('lzma');
const SteamUser = require('steam-user');
const Protos = require('globaloffensive/protobufs/generated/_load.js');

const cat = require('./catalog');

const CASKET_DEF = 1201;
// item_link из прайса магазина -> def_index (построено из items_game.txt, точное; см. tools).
const STORE_DEFS = cat.loadMap('store_defs.json');
const NAMES = cat.loadMap('names.json');
const IMAGES = cat.loadMap('images.json');
Object.assign(NAMES, { 'def:1201': 'Storage Unit', 'def:1200': 'Name Tag' });

function waitGC(user, msgType, ms) {
	return new Promise((resolve, reject) => {
		const handler = (appid, type, payload) => {
			if (appid !== 730 || type !== msgType) return;
			clearTimeout(timer);
			user.off('receivedFromGC', handler);
			resolve(payload);
		};
		const timer = setTimeout(() => { user.off('receivedFromGC', handler); reject(new Error(`GC не ответил (${msgType})`)); }, ms);
		user.on('receivedFromGC', handler);
	});
}

function decompressValve(buf) {
	if (buf.slice(0, 4).toString() !== 'LZMA') return buf;
	const realSize = buf.readUInt32LE(4);
	const compSize = buf.readUInt32LE(8);
	// Формат .lzma (alone): 5 байт параметров + 8 байт размера + данные.
	const header = Buffer.alloc(13);
	buf.copy(header, 0, 12, 17);
	header.writeUInt32LE(realSize, 5);
	const out = LZMA.decompress(Buffer.concat([header, buf.slice(17, 17 + compSize)]));
	return Buffer.from(out);
}

function parseBinaryKV(buf) {
	let i = 0;
	const cstr = () => { const j = buf.indexOf(0, i); const s = buf.toString('utf8', i, j); i = j + 1; return s; };
	const parse = () => {
		const obj = {};
		while (i < buf.length) {
			const t = buf[i++];
			if (t === 0x08 || t === 0x0b) return obj;
			const key = cstr();
			if (t === 0x00) { const v = parse(); obj[key] = key in obj ? [].concat(obj[key], v) : v; }
			else if (t === 0x01) obj[key] = cstr();
			else if (t === 0x02) { obj[key] = buf.readInt32LE(i); i += 4; }
			else if (t === 0x03) { obj[key] = buf.readFloatLE(i); i += 4; }
			else if (t === 0x04 || t === 0x06) { obj[key] = buf.readUInt32LE(i); i += 4; }
			else if (t === 0x07) { obj[key] = buf.readBigUInt64LE(i).toString(); i += 8; }
			else if (t === 0x0a) { obj[key] = buf.readBigInt64LE(i).toString(); i += 8; }
			else throw new Error(`неизвестный тип KeyValues ${t}`);
		}
		return obj;
	};
	return parse();
}

// Прайс магазина CS2 целиком (кэш на 10 минут в сессии): валюта аккаунта + записи по item_link.
async function priceSheet(session) {
	const { user, csgo } = session;
	const currencyId = user.wallet && user.wallet.currency;
	if (!currencyId) throw new Error('у аккаунта нет кошелька Steam');
	if (session._priceSheet && Date.now() - session._priceSheet.ts < 10 * 60000) return session._priceSheet;
	const answer = waitGC(user, 2501, 20000);
	csgo._send(2500, Protos.CMsgStoreGetUserData, { price_sheet_version: 0, currency: currencyId });
	const res = Protos.CMsgStoreGetUserDataResponse.decode(await answer);
	if (res.result !== 1) throw new Error(`GC вернул прайс с ошибкой ${res.result}`);
	const sheet = parseBinaryKV(decompressValve(Buffer.from(res.price_sheet)));
	const currency = SteamUser.ECurrencyCode[currencyId];
	session._priceSheet = { ts: Date.now(), currencyId, currency, entries: (sheet.store || {}).entries || {} };
	return session._priceSheet;
}

function unitPrice(entry, currency) {
	return entry && entry.prices && entry.prices[currency];
}

async function casketPrice(session) {
	const ps = await priceSheet(session);
	const unit = unitPrice(ps.entries.casket, ps.currency);
	if (!unit) throw new Error(`в прайсе нет цены контейнера в ${ps.currency}`);
	return { currencyId: ps.currencyId, currency: ps.currency, unit, balance: session.user.wallet.balance };
}

// Товар магазина по item_link: def_index, название и картинка из файлов игры (catalog.storeMeta,
// обновляется само раз в сутки), запасной вариант — старые встроенные карты.
function describeLink(link) {
	const meta = cat.storeMeta();
	const def = (meta.links && meta.links[link] != null) ? meta.links[link] : STORE_DEFS[link];
	if (def == null) return null;
	const m = (meta.defs && meta.defs[def]) || {};
	const tail = IMAGES.images && IMAGES.images[`def:${def}`];
	let image = m.image || (tail ? `${IMAGES.cdn}${tail}` : null);
	if (image && /economy\/image\//.test(image) && !/\/\d+fx\d+f$/.test(image)) image += '/128fx128f';
	return { def: Number(def), name: m.name || NAMES[`def:${def}`] || null, image, generic: Boolean(m.generic) || !image };
}

// Весь каталог магазина для UI: {link, def, name, image, price (в основных единицах), buyable}.
// Товары, которые не удалось опознать (нет def_index или названия), не показываем — купить их нельзя.
async function catalog(session) {
	const ps = await priceSheet(session);
	const items = [];
	for (const [link, entry] of Object.entries(ps.entries)) {
		const unit = unitPrice(entry, ps.currency);
		if (!unit) continue;
		const d = describeLink(link);
		if (!d || !d.name) continue;
		items.push({
			link, def: d.def, name: d.name, image: d.image, generic: d.generic,
			price: unit / 100, unit,
			category: entry.category_tags || '',
			buyable: true,
		});
	}
	// Порядок: контейнер, лицензия игры, пропуск Armory — первыми; дальше товары с иконками, без иконок — в конце.
	const PINNED = [1201, 1353, 1354];
	const rank = it => (PINNED.includes(it.def) ? PINNED.indexOf(it.def) : it.generic ? 20 : 10);  // «конверты» — в конец
	items.sort((a, b) => rank(a) - rank(b) || a.price - b.price || a.name.localeCompare(b.name));
	return { currency: ps.currency, balance: session.user.wallet.balance, items };
}

// ---------------------------------------------------------------- покупка (микротранзакция Steam)

const EMSG_MICROTXN_AUTH_REQUEST = 5504;
const EMSG_MICROTXN_AUTHORIZE = 5505;
const EMSG_MICROTXN_AUTHORIZE_RESPONSE = 5506;
const PROTO_MASK = 0x80000000;

// steam-user не знает сообщений 5504/5506 и выбрасывает их как «Unhandled», поэтому читаем их
// из сырого входящего трафика (событие приходит и для сообщений внутри Multi).
function cmBody(buf) {
	const raw = buf.readUInt32LE(0);
	return (raw & PROTO_MASK) ? buf.slice(8 + buf.readUInt32LE(4)) : buf.slice(36);
}

function waitCM(user, emsg, ms, match = () => true) {
	return new Promise((resolve, reject) => {
		const handler = (buf, type) => {
			if (type !== emsg) return;
			let body;
			try { body = cmBody(Buffer.from(buf)); if (!match(body)) return; } catch (e) { return; }
			clearTimeout(timer);
			user.off('debug-traffic-incoming', handler);
			resolve(body);
		};
		const timer = setTimeout(() => { user.off('debug-traffic-incoming', handler); reject(new Error(`Steam не ответил (${emsg})`)); }, ms);
		user.on('debug-traffic-incoming', handler);
	});
}

// Поиск ключа в KeyValues без учёта регистра и на любой глубине (Steam меняет регистр: transid/transID).
function kvFind(obj, name) {
	if (!obj || typeof obj !== 'object') return undefined;
	const want = name.toLowerCase();
	for (const [k, v] of Object.entries(obj)) if (k.toLowerCase() === want) return v;
	for (const v of Object.values(obj)) { const r = kvFind(v, name); if (r !== undefined) return r; }
	return undefined;
}

// 5504: {transId, orderId, total, currency, items:[{description, def, quantity, amount}]}
function parseAuthRequest(body) {
	// Перед KeyValues идёт короткий заголовок (обычно 1 байт) — ищем начало «MessageObject» по сигнатуре.
	const sig = Buffer.from('\0MessageObject\0', 'latin1');
	const at = body.indexOf(sig);
	const kv = parseBinaryKV(body.slice(at >= 0 ? at : 1));
	const txn = [].concat(kvFind(kv, 'MessageObject') || kv).find(o => kvFind(o, 'transid') !== undefined) || {};
	const lineitems = kvFind(txn, 'lineitems') || {};
	const items = Object.values(lineitems).filter(li => li && typeof li === 'object').map(li => ({
		description: kvFind(li, 'description'), def: Number(kvFind(li, 'gameitemid')),
		quantity: Number(kvFind(li, 'quantity')), amount: Number(kvFind(li, 'amount')),
	}));
	const billingTotal = kvFind(txn, 'BillingTotal');
	const billingCurrency = kvFind(txn, 'BillingCurrency');
	const orderId = kvFind(txn, 'orderid');
	const refundable = kvFind(txn, 'Refundable');
	return {
		refundable: refundable == null ? null : Number(refundable) === 1,
		transId: kvFind(txn, 'transid'), orderId: orderId != null ? String(orderId) : undefined,
		total: Number(billingTotal != null ? billingTotal : kvFind(txn, 'total')),
		currencyId: Number(billingCurrency != null ? billingCurrency : kvFind(txn, 'currency')),
		items,
	};
}

// Сырые 5504 пишем в purchase-debug.log (папка данных приложения) — для разбора, если Steam поменяет формат.
function debugDump(session, label, body) {
	if (!session.dataDir) return;
	try { fs.appendFileSync(path.join(session.dataDir, 'purchase-debug.log'), `${new Date().toISOString()} ${label} ${body.toString('hex')}\n`); } catch (e) { /* ignore */ }
}

// Шаг 1: создаём заказ в GC и ловим запрос авторизации от Steam. Деньги ещё НЕ списаны —
// возвращаем итог, который Steam спишет, чтобы пользователь подтвердил его сам.
async function initPurchase(session, defId, count) {
	const { user, csgo } = session;
	const ps = await priceSheet(session);
	const link = Object.keys(ps.entries).find(l => { const d = describeLink(l); return d && d.def === Number(defId); });
	const entry = link ? ps.entries[link] : null;
	const unit = unitPrice(entry, ps.currency);
	if (!unit) throw new Error('этого товара нет в магазине для вашей валюты');
	const total = unit * count;
	if (total > Math.round(user.wallet.balance * 100)) {
		throw new Error(`на кошельке ${user.wallet.balance} ${ps.currency}, нужно ${(total / 100).toFixed(2)}`);
	}
	const country = (user.accountInfo && user.accountInfo.country) || 'US';
	// Steam может прислать несколько 5504 (например, по старому заказу) — собираем все и берём свой.
	const seen = [];
	let wake = null;
	const onCM = (buf, type) => {
		if (type !== EMSG_MICROTXN_AUTH_REQUEST) return;
		try {
			const body = cmBody(Buffer.from(buf));
			debugDump(session, 'auth-request', body);
			let auth; try { auth = parseAuthRequest(body); } catch (e) { auth = { error: e.message }; }
			seen.push(auth);
			if (wake) wake();
		} catch (e) { /* ignore */ }
	};
	user.on('debug-traffic-incoming', onCM);
	try {
		const initAnswer = waitGC(user, 2511, 30000);
		csgo._send(2510, Protos.CMsgGCStorePurchaseInit, {
			country, language: 0, currency: ps.currencyId,
			line_items: [{ item_def_id: Number(defId), quantity: count, cost_in_local_currency: unit, purchase_type: 0 }],
		});
		const init = Protos.CMsgGCStorePurchaseInitResponse.decode(await initAnswer);
		if (init.result !== 1 || !init.txn_id) throw new Error(`Steam не создал заказ (код ${init.result})`);
		var orderId = init.txn_id.toString();
		const deadline = Date.now() + 30000;
		var auth;
		while (!(auth = seen.find(a => a.orderId === orderId)) && Date.now() < deadline) {
			await new Promise(r => { wake = r; setTimeout(r, 500); });
		}
		if (!auth) {
			const got = seen.map(a => a.error || a.orderId).join(', ') || 'ничего';
			throw new Error(`Steam не прислал счёт по заказу ${orderId} (получено: ${got}) — детали в purchase-debug.log`);
		}
	} finally {
		user.off('debug-traffic-incoming', onCM);
	}
	// Защита: списываем только то, что пользователь видел в прайсе.
	const line = auth.items.find(i => i.def === Number(defId));
	if (!auth.transId || auth.items.length !== 1 || !line || line.quantity !== count || auth.total !== total || auth.currencyId !== ps.currencyId) {
		throw new Error(`Steam выставил не тот счёт (${(auth.total / 100).toFixed(2)}, ожидалось ${(total / 100).toFixed(2)} ${ps.currency}) — покупка отменена`);
	}
	session.emit('log', `заказ ${orderId}: ${(total / 100).toFixed(2)} ${ps.currency} — ждём подтверждения`);
	return {
		txnId: orderId, transId: auth.transId, total: total / 100, unit: unit / 100, currency: ps.currency, count,
		refundable: auth.refundable, balance: user.wallet.balance,
		image: (describeLink(link) || {}).image || null,
		def: Number(defId), name: (describeLink(link) || {}).name || line.description || `товар ${defId}`,
	};
}

// Шаг 2: подтверждение (списание) — то же, что кнопка «Купить» в оверлее Steam.
async function authorizePurchase(session, transId) {
	const { user } = session;
	const body = Buffer.alloc(12);
	body.writeBigUInt64LE(BigInt(transId), 0);
	body.writeUInt32LE(1, 8);  // 1 = одобрить
	// Ответ ищем с запасом: Steam отвечает на extended-заголовок, на всякий случай повторяем с protobuf.
	let res;
	for (const header of [{ msg: EMSG_MICROTXN_AUTHORIZE }, { msg: EMSG_MICROTXN_AUTHORIZE, proto: {} }]) {
		const answer = waitCM(user, EMSG_MICROTXN_AUTHORIZE_RESPONSE, 15000);
		user._send(header, body);
		try { res = await answer; break; } catch (e) { /* пробуем второй вариант заголовка */ }
	}
	if (!res) throw new Error('Steam не ответил на подтверждение оплаты');
	const eresult = res.readUInt32LE(0);
	if (eresult !== 1) throw new Error(`Steam отклонил оплату: ${SteamUser.EResult[eresult] || eresult}`);
}

// Шаг 3: GC выдаёт оплаченные предметы.
async function finalizePurchase(session, orderId) {
	const { user } = session;
	// Ответ приходит в колбэк job'а; если GC ответит без job target — в обычный receivedFromGC.
	const fallback = waitGC(user, 2505, 60000);
	const viaJob = new Promise(resolve => {
		const buf = Buffer.from(Protos.CMsgGCStorePurchaseFinalize.encode({ txn_id: String(orderId) }).finish());
		user.sendToGC(730, 2504, {}, buf, (appid, msgType, body) => { if (msgType === 2505) resolve(body); });
	});
	const payload = await Promise.race([viaJob, fallback]).catch(() => {
		throw new Error('GC не выдал предметы — нажмите «Проверить оплату» позже');
	});
	fallback.catch(() => {});
	const fin = Protos.CMsgGCStorePurchaseFinalizeResponse.decode(payload);
	if (fin.result !== 1) throw new Error(`GC не подтвердил покупку (код ${fin.result})`);
	return { txnId: String(orderId), itemIds: (fin.item_ids || []).map(String), currency: SteamUser.ECurrencyCode[user.wallet.currency] };
}

module.exports = { casketPrice, catalog, initPurchase, authorizePurchase, finalizePurchase, parseAuthRequest, CASKET_DEF, decompressValve, parseBinaryKV };
