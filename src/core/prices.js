// Цены предметов для аналитики: публичные выгрузки цен, раз в ~12 ч в кэш на диске. Данные инвентаря никуда
// не отправляются — только скачиваем общий прайс (как Casemove: Steam / Buff163 / Skinport, все в USD).
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const CSGOTRADER = 'https://prices.csgotrader.app/latest';
const SOURCES = {
	// Steam: средняя цена продаж за 7 дней (у редких предметов — за 24 ч / 30 / 90 дней)
	steam: { url: `${CSGOTRADER}/steam.json`, fee: 1.15,
		build: d => map(d, v => v && (v.last_7d || v.last_24h || v.last_30d || v.last_90d)) },
	// Buff163: самое дешёвое предложение; у Doppler — по фазам
	buff: { url: `${CSGOTRADER}/buff163.json`, fee: 1.025,
		build: d => map(d, (v, name, out) => {
			const s = v && v.starting_at;
			if (s && s.doppler) for (const [ph, p] of Object.entries(s.doppler)) if (p > 0) out[`${name}|${ph}`] = p;
			return s && s.price;
		}) },
	// Skinport: самое дешёвое предложение, иначе рекомендуемая цена
	skinport: { url: 'https://api.skinport.com/v1/items?app_id=730&currency=USD', fee: 1.08,
		build: d => map(Object.fromEntries((Array.isArray(d) ? d : []).map(x => [x.market_hash_name, x])), v => v && (v.min_price || v.suggested_price)) },
};
const RATES_URL = `${CSGOTRADER}/exchange_rates.json`;
const MAX_AGE = 12 * 3600e3;

function map(obj, pick) {
	const out = {};
	for (const [name, v] of Object.entries(obj || {})) {
		const p = Number(pick(v, name, out));
		if (p > 0) out[name] = Math.round(p * 1000) / 1000;
	}
	return out;
}

// Фазы Doppler по paint_index (на рынке фаза не входит в название, а цена отличается в разы).
const PHASES = {
	415: 'Ruby', 416: 'Sapphire', 417: 'Black Pearl', 418: 'Phase 1', 419: 'Phase 2', 420: 'Phase 3', 421: 'Phase 4',
	568: 'Emerald', 569: 'Phase 1', 570: 'Phase 2', 571: 'Phase 3', 572: 'Phase 4',
	617: 'Black Pearl', 618: 'Phase 2', 619: 'Sapphire', 852: 'Phase 1', 853: 'Phase 2', 854: 'Phase 3', 855: 'Phase 4',
	1119: 'Emerald', 1120: 'Phase 1', 1121: 'Phase 2', 1122: 'Phase 3', 1123: 'Phase 4',
};
const phaseOf = item => (item && PHASES[Math.round(item.paint_index || 0)]) || null;

function cacheDir() {
	const base = process.env.CASKET_DATA_CACHE;
	return base ? path.join(base, 'prices') : null;
}

function download(url, timeout = 30000) {
	return new Promise((resolve, reject) => {
		const req = https.get(url, { headers: { 'User-Agent': 'Caskit', 'Accept-Encoding': 'gzip, deflate, br' } }, res => {
			if (res.statusCode !== 200) { res.resume(); return reject(new Error(`цены: HTTP ${res.statusCode}`)); }
			const enc = res.headers['content-encoding'];
			const stream = enc === 'gzip' ? res.pipe(zlib.createGunzip()) : enc === 'br' ? res.pipe(zlib.createBrotliDecompress())
				: enc === 'deflate' ? res.pipe(zlib.createInflate()) : res;
			const chunks = [];
			stream.on('data', c => chunks.push(c));
			stream.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (e) { reject(new Error('цены: неверный ответ')); } });
			stream.on('error', reject);
		});
		req.on('error', reject);
		req.setTimeout(timeout, () => req.destroy(new Error('цены: таймаут')));
	});
}

const readJson = file => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } };
function writeJson(file, data) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file + '.tmp', JSON.stringify(data));
	fs.renameSync(file + '.tmp', file);
}

// Прайсы в памяти по источникам: { steam: { source, ts, prices: {name: usd}, rates: {CUR: perUsd} }, … }
const mem = {};
const loading = new Map();

// Загрузить прайс источника: из памяти/кэша, если свежий; иначе скачать (при ошибке — остаётся старый кэш).
async function ensure(source = 'steam', { force = false } = {}) {
	if (!SOURCES[source]) source = 'steam';
	const fresh = x => x && x.prices && Date.now() - x.ts < MAX_AGE;
	if (!force && fresh(mem[source])) return mem[source];
	const dir = cacheDir();
	const file = dir && path.join(dir, `${source}.json`);
	const cached = mem[source] || (file && readJson(file));
	if (!force && fresh(cached)) return (mem[source] = cached);
	if (loading.has(source)) return loading.get(source);
	const job = (async () => {
		try {
			const [raw, rates] = await Promise.all([download(SOURCES[source].url), download(RATES_URL).catch(() => null)]);
			const prices = SOURCES[source].build(raw);
			if (Object.keys(prices).length < 1000) throw new Error('цены: выгрузка неполная');
			const data = { source, ts: Date.now(), prices, rates: rates && rates.USD === 1 ? rates : (cached && cached.rates) || { USD: 1 } };
			if (file) writeJson(file, data);
			return (mem[source] = data);
		} catch (e) {
			if (cached && cached.prices) return (mem[source] = cached);  // старый прайс лучше, чем никакого
			throw e;
		} finally { loading.delete(source); }
	})();
	loading.set(source, job);
	return job;
}

// Остальные источники — заранее и в фоне, чтобы переключение в настройках/«Обзоре» было мгновенным.
function prefetchOthers(active) {
	let delay = 20000;
	for (const s of Object.keys(SOURCES)) {
		if (s === active) continue;
		setTimeout(() => ensure(s).catch(() => {}), delay).unref();
		delay += 20000;
	}
}

// Цены по текущим настройкам: usd() — как в прайсе, value() — в валюте пользователя (и за вычетом комиссии,
// если включено). k — множитель USD -> валюта пользователя.
function pricer(data, { currency = 'USD', afterFee = false } = {}) {
	const rate = (data.rates && data.rates[currency]) || null;
	const k = (rate || 1) / (afterFee ? SOURCES[data.source].fee : 1);
	const usd = (name, phase) => (phase && data.prices[`${name}|${phase}`]) || data.prices[name] || null;
	return {
		currency: rate ? currency : 'USD', source: data.source, ts: data.ts, k, afterFee: Boolean(afterFee), phaseOf, usd,
		value: (name, phase) => { const u = usd(name, phase); return u == null ? null : u * k; },
		rate: rate || 1,  // USD -> валюта пользователя (без комиссии)
		toUsd: (amount, cur) => { const r = data.rates && data.rates[cur]; return r ? amount / r : null; },
	};
}

// Загружен ли прайс источника в память (без скачивания)
const loaded = source => Boolean(mem[source]);

module.exports = { ensure, pricer, loaded, prefetchOthers, phaseOf, SOURCES, RATES_URL };
