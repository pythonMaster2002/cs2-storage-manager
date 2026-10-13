// Учёт покупок и продаж для прибыли/убытка (P&L): записи хранятся только на этом компьютере (ledger.json).
// Источники: история Торговой площадки Steam (импорт), ручной ввод, CSV. Себестоимость — по FIFO:
// продажа «съедает» самые старые покупки этого предмета, остаток покупок — себестоимость того, что лежит сейчас.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COMMUNITY = 'https://steamcommunity.com';
const MAX_RECORDS = 200000;

class Ledger {
	constructor(dataDir) {
		this.file = path.join(dataDir, 'ledger.json');
		this.data = null;
	}

	_load() {
		if (!this.data) {
			try { this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { this.data = null; }
			if (!this.data || !Array.isArray(this.data.records)) this.data = { records: [], imports: {} };
		}
		return this.data;
	}

	_save() {
		fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data));
		fs.renameSync(this.file + '.tmp', this.file);
	}

	// Запись: { id, login, kind: 'buy'|'sell', name, qty, unit (за 1 шт), cur, ts, src: 'market'|'manual'|'csv', ref? }
	add(list) {
		const d = this._load();
		const refs = new Set(d.records.filter(r => r.ref).map(r => r.ref));
		let added = 0;
		for (const r of list) {
			if (r.ref && refs.has(r.ref)) continue;
			if (!r.name || !(r.qty > 0) || !(r.unit >= 0) || !/^[A-Z]{3}$/.test(r.cur || '')) continue;
			d.records.push({ id: crypto.randomBytes(6).toString('hex'), login: r.login || '', kind: r.kind === 'sell' ? 'sell' : 'buy',
				name: String(r.name).slice(0, 200), qty: Math.floor(r.qty), unit: Math.round(r.unit * 10000) / 10000, cur: r.cur,
				ts: Number(r.ts) || Date.now(), src: r.src || 'manual', ...(r.ref ? { ref: r.ref } : {}) });
			if (r.ref) refs.add(r.ref);
			added++;
		}
		if (d.records.length > MAX_RECORDS) d.records.splice(0, d.records.length - MAX_RECORDS);
		if (added) this._save();
		return added;
	}

	// Изменить цену (за 1 шт) и валюту записи — в том числе импортированной или «по текущей цене».
	// qty меньше количества в записи — партия делится: новая цена только у qty штук, остальные остаются как были.
	update(id, { unit, cur, qty }) {
		const d = this._load();
		const r = d.records.find(x => x.id === id);
		if (!r) throw new Error('запись не найдена');
		if (!(Number(unit) >= 0) || (cur && !/^[A-Z]{3}$/.test(cur))) throw new Error('проверьте цену');
		const n = qty == null || qty === '' ? r.qty : Math.floor(Number(qty));
		if (!(n >= 1 && n <= r.qty)) throw new Error(`количество — от 1 до ${r.qty}`);
		let target = r;
		if (n < r.qty) {
			r.qty -= n;
			target = { ...r, id: crypto.randomBytes(6).toString('hex'), qty: n };
			delete target.ref;  // ссылка на сделку ТП остаётся у исходной записи (защита от повторного импорта)
			d.records.splice(d.records.indexOf(r) + 1, 0, target);
		}
		target.unit = Math.round(Number(unit) * 10000) / 10000;
		if (cur) target.cur = cur;
		target.edited = true;
		this._save();
		return { record: target, split: target !== r };
	}

	remove(ids) {
		const d = this._load();
		const set = new Set(ids);
		const before = d.records.length;
		d.records = d.records.filter(r => !set.has(r.id));
		if (d.records.length !== before) this._save();
		return before - d.records.length;
	}

	// Удалить всё импортированное с Торговой площадки для аккаунта (например, чтобы импортировать заново).
	clearImport(login) {
		const d = this._load();
		const before = d.records.length;
		d.records = d.records.filter(r => !(r.src === 'market' && r.login === login));
		delete d.imports[login];
		this._save();
		return before - d.records.length;
	}

	records(logins) {
		const set = logins ? new Set(logins) : null;
		return this._load().records.filter(r => !set || set.has(r.login) || r.login === '');
	}

	importInfo(login) { return this._load().imports[login] || null; }
	setImportInfo(login, info) { this._load().imports[login] = info; this._save(); }

	// Средняя цена покупки (USD) того, что осталось после продаж (FIFO), для одного предмета; null — нет записей.
	avgCost(logins, name, toUsd) {
		const lots = [];
		for (const r of this.records(logins).filter(x => x.name === name).sort((a, b) => a.ts - b.ts)) {
			const usd = toUsd(r.unit, r.cur);
			if (usd == null) continue;
			if (r.kind === 'buy') { lots.push({ qty: r.qty, usd }); continue; }
			let left = r.qty;
			while (left > 0 && lots.length) { const k = Math.min(left, lots[0].qty); lots[0].qty -= k; left -= k; if (!lots[0].qty) lots.shift(); }
		}
		const qty = lots.reduce((n, l) => n + l.qty, 0);
		return qty ? lots.reduce((n, l) => n + l.qty * l.usd, 0) / qty : null;
	}

	// P&L по позициям. holdings: { название: { count, usd, image } } — что лежит сейчас (по всем выбранным аккаунтам);
	// toUsd(amount, cur) — перевод суммы записи в USD (по текущему курсу).
	compute(holdings, logins, toUsd) {
		const recs = this.records(logins).slice().sort((a, b) => a.ts - b.ts);
		const byName = new Map();
		for (const r of recs) { if (!byName.has(r.name)) byName.set(r.name, []); byName.get(r.name).push(r); }
		const names = new Set([...byName.keys(), ...Object.keys(holdings)]);
		const positions = [];
		let invested = 0, value = 0, realized = 0, uncoveredQty = 0, uncoveredUsd = 0, soldNoCost = 0;
		for (const name of names) {
			const lots = [];  // FIFO: [{ qty, usd }]
			let real = 0, sold = 0, bought = 0, buyUsd = 0;
			for (const r of byName.get(name) || []) {
				const usd = toUsd(r.unit, r.cur);
				if (usd == null) continue;
				if (r.kind === 'buy') { lots.push({ qty: r.qty, usd }); bought += r.qty; buyUsd += r.qty * usd; continue; }
				let left = r.qty;
				sold += r.qty;
				while (left > 0 && lots.length) {
					const l = lots[0];
					const k = Math.min(left, l.qty);
					real += k * (usd - l.usd);
					l.qty -= k; left -= k;
					if (!l.qty) lots.shift();
				}
				if (left > 0) soldNoCost += left;  // продано то, что куплено не здесь (нет цены покупки)
			}
			const h = holdings[name] || { count: 0, usd: null };
			// себестоимость того, что лежит сейчас: самые новые из оставшихся покупок
			let need = h.count, cost = 0, covered = 0;
			for (let i = lots.length - 1; i >= 0 && need > 0; i--) {
				const k = Math.min(need, lots[i].qty);
				cost += k * lots[i].usd; covered += k; need -= k;
			}
			const cur = h.usd != null ? covered * h.usd : null;
			realized += real;
			if (covered && cur != null) { invested += cost; value += cur; }
			if (h.count > covered) { uncoveredQty += h.count - covered; if (h.usd != null) uncoveredUsd += (h.count - covered) * h.usd; }
			if (!covered && !real && !sold) continue;  // нет записей по тому, что лежит, — позицию не показываем
			positions.push({
				name, image: h.image || null, held: h.count, covered, avgUsd: covered ? cost / covered : (bought ? buyUsd / bought : null),
				unitUsd: h.usd, costUsd: cost, valueUsd: cur, pnlUsd: cur != null && covered ? cur - cost : null,
				realizedUsd: real, sold, bought,
			});
		}
		positions.sort((a, b) => Math.abs(b.pnlUsd || 0) + Math.abs(b.realizedUsd) - Math.abs(a.pnlUsd || 0) - Math.abs(a.realizedUsd));
		return { positions, invested, value, unrealized: value - invested, realized, uncoveredQty, uncoveredUsd, soldNoCost,
			records: recs.length };
	}
}

// ---------------------------------------------------------------- импорт истории Торговой площадки Steam
// /market/myhistory/render/?norender=1: events (event_type 3 — наш лот продан, 4 — мы купили), purchases с суммами в
// центах (paid_amount + paid_fee — сколько заплатил покупатель, received_amount — сколько получил продавец) и assets
// с market_hash_name. Только CS2 (appid 730).
async function importMarketHistory(session, ledger, { onProgress = () => {}, shouldStop = () => false, maxPages = 600 } = {}) {
	const SteamUser = require('steam-user');
	const curOf = id => SteamUser.ECurrencyCode[Number(id) > 2000 ? Number(id) - 2000 : Number(id)] || null;
	const me = typeof session.sid64 === 'function' ? session.sid64() : session.user.steamID.getSteamID64();
	const prev = ledger.importInfo(session.login);
	// Страницы по 500 (как у SIH): Steam отдаёт столько за раз, а лимит считает запросы, а не события —
	// по 100 импорт в ~1000+ сделок упирался в 429 и подолгу ждал («застревал»).
	const PAGE = 500;
	const sleep = ms => new Promise(r => setTimeout(r, ms));
	let start = 0, total = null, pages = 0, reachedOld = false, found = 0, added = 0, newest = prev && prev.lastTs || 0;
	// Темп как в TCP: пауза между страницами сама уменьшается, пока Steam отвечает (до 0.3 с),
	// а на 429 — резко растёт; так импорт идёт с максимальной скоростью, которую Steam сейчас пропускает.
	let gap = 1000;
	while (pages < maxPages && (total == null || start < total) && !reachedOld) {
		if (shouldStop()) break;
		// Страница: 429 — ждём (минута, потом дольше); сбой (5xx, success:false, обрыв) — повтор через 5–60 с.
		// Только после многих неудач подряд — ошибка (загруженное уже сохранено).
		let d = null, limited = 0, failed = 0, lastErr = '';
		while (!d && !shouldStop()) {
			let res = null;
			try { res = await session.webRequest('GET', `${COMMUNITY}/market/myhistory/render/?query=&start=${start}&count=${PAGE}&norender=1`); }
			catch (e) { lastErr = e.message; }
			let wait = 0;
			if (res && res.status === 429) {
				if (++limited > 8) throw new Error('Steam ограничил частоту запросов — импорт остановлен, нажмите ещё раз позже: загруженное сохранено');
				gap = Math.min(15000, gap * 2 + 2000);
				wait = Math.min(240, 20 * 2 ** (limited - 1));   // 20, 40, 80, 160, 240 с
			} else if (res && res.status === 200) {
				let x = null;
				try { x = JSON.parse(res.body); } catch (e) { lastErr = 'Steam вернул не JSON — войдите в аккаунт заново'; }
				if (x && x.success) d = x; else if (x) lastErr = 'Steam не отдал историю Торговой площадки';
			} else if (res) lastErr = `Steam не отдал историю Торговой площадки (HTTP ${res.status})`;
			if (d) break;
			if (!wait) {
				if (++failed > 6) throw new Error(lastErr || 'Steam не отдал историю Торговой площадки');
				wait = [5, 10, 20, 30, 60, 60][failed - 1];
			}
			for (let s = wait; s > 0 && !shouldStop(); s--) { onProgress({ done: start, total, found, waiting: s }); await sleep(1000); }
		}
		if (shouldStop() || !d) break;
		total = Number(d.total_count) || 0;
		const assets = (d.assets && d.assets['730']) || {};
		const nameOf = a => { const x = a && assets[String(a.contextid)] && assets[String(a.contextid)][String(a.id)]; return x && x.market_hash_name; };
		const out = [];
		for (const e of d.events || []) {
			if (prev && prev.complete && prev.lastTs && e.time_event < prev.lastTs - 86400) { reachedOld = true; break; }  // дальше уже импортировано
			if (e.event_type !== 3 && e.event_type !== 4) continue;
			const p = d.purchases && d.purchases[`${e.listingid}_${e.purchaseid}`];
			if (!p || p.failed || p.needs_rollback || !p.asset || Number(p.asset.appid) !== 730) continue;
			const name = nameOf(p.asset);
			if (!name) continue;
			const qty = Math.max(1, Number(p.asset.amount) || 1);
			const buy = e.event_type === 4 && String(p.steamid_purchaser) === me;
			const cents = buy ? (Number(p.paid_amount) || 0) + (Number(p.paid_fee) || 0) : Number(p.received_amount) || 0;
			const cur = curOf(buy ? p.currencyid : p.received_currencyid);
			if (!cur || !cents) continue;
			out.push({ login: session.login, kind: buy ? 'buy' : 'sell', name, qty, unit: cents / 100 / qty, cur, ts: e.time_event * 1000, src: 'market',
				ref: `m:${e.listingid}_${e.purchaseid}_${buy ? 'b' : 's'}` });
			newest = Math.max(newest, e.time_event);
		}
		// сохраняем постранично: остановка или сбой не теряют уже загруженное
		found += out.length;
		added += ledger.add(out);
		pages++; start += PAGE;
		onProgress({ done: Math.min(start, total), total, found, added });
		if (!limited && !failed) gap = Math.max(300, Math.round(gap * 0.75));
		if (start < total && !reachedOld) await sleep(gap);
	}
	const complete = total != null && (start >= total || reachedOld);
	ledger.setImportInfo(session.login, { at: Date.now(), lastTs: newest, total, found, complete: Boolean(complete || (prev && prev.complete)) });
	return { added, found, total, complete, stopped: shouldStop() };
}

// ---------------------------------------------------------------- CSV: название; количество; цена за шт; [валюта]; [дата]; [buy/sell]
function parseCsv(text, { login, cur: defCur }) {
	const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
	if (!lines.length) return { rows: [], errors: [] };
	const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : lines[0].includes('\t') ? '\t' : ',';
	const split = line => {
		const out = []; let cur = '', q = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
			else if (ch === '"') q = true;
			else if (ch === sep) { out.push(cur.trim()); cur = ''; } else cur += ch;
		}
		out.push(cur.trim());
		return out;
	};
	const num = v => { const s = String(v || '').replace(/[^\d.,-]/g, ''); if (!s) return NaN; const n = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, ''); return Number(n); };
	const rows = [], errors = [];
	lines.forEach((line, i) => {
		const c = split(line);
		if (i === 0 && !Number.isFinite(num(c[1]))) return;  // строка заголовков
		const [name, qty, unit, cur, date, kind] = c;
		const r = { login, name, qty: num(qty), unit: num(unit), cur: (cur || defCur || 'USD').toUpperCase().slice(0, 3),
			ts: date ? Date.parse(date) : Date.now(), kind: /^(sell|продажа|s)$/i.test(kind || '') ? 'sell' : 'buy', src: 'csv' };
		if (!name || !(r.qty > 0) || !(r.unit >= 0) || !/^[A-Z]{3}$/.test(r.cur) || !Number.isFinite(r.ts)) errors.push(i + 1);
		else rows.push(r);
	});
	return { rows, errors };
}

// ---------------------------------------------------------------- CSV из SIH (Steam Inventory Helper → «Экспорт истории ТП»)
// Колонки: Item Name, Game Name, Listed On, Acted On, Display Price, Price in Cents, Type, Market Name, App Id, …
// Type: purchase / sale (остальное — выставления и снятия лотов). Цена в копейках валюты кошелька, валюта — по символу
// в Display Price. Дата — как отформатировал браузер (12.10.2026, 10/12/2026, 2026-10-12…) или «12 Oct» без года.
const SIH_HEAD = /^﻿?"?Item Name"?,"?Game Name"?,"?Listed On"?,"?Acted On"?,"?Display Price"?,"?Price in Cents"?,"?Type"?/i;
const isSihCsv = text => SIH_HEAD.test(String(text || '').slice(0, 300));
// символ валюты Steam -> код (длинные — раньше коротких: «CDN$» прежде «$»)
const CUR_SYMBOLS = [['CDN$', 'CAD'], ['A$', 'AUD'], ['NZ$', 'NZD'], ['HK$', 'HKD'], ['S$', 'SGD'], ['NT$', 'TWD'], ['Mex$', 'MXN'], ['CLP$', 'CLP'],
	['COL$', 'COP'], ['ARS$', 'ARS'], ['$U', 'UYU'], ['R$', 'BRL'], ['S/.', 'PEN'], ['CHF', 'CHF'], ['AED', 'AED'], ['руб', 'RUB'], ['pуб', 'RUB'], ['₽', 'RUB'],
	['zł', 'PLN'], ['TL', 'TRY'], ['₺', 'TRY'], ['₴', 'UAH'], ['₸', 'KZT'], ['₹', 'INR'], ['₩', 'KRW'], ['₪', 'ILS'], ['₡', 'CRC'], ['₫', 'VND'], ['฿', 'THB'],
	['Rp', 'IDR'], ['RM', 'MYR'], ['SR', 'SAR'], ['KD', 'KWD'], ['QR', 'QAR'], ['Kč', 'CZK'], ['Ft', 'HUF'], ['lei', 'RON'], ['лв', 'BGN'], ['kn', 'HRK'],
	['€', 'EUR'], ['£', 'GBP'], ['¥', null], ['kr', null], ['$', 'USD'], ['P', 'PHP'], ['R ', 'ZAR']];
function currencyOfPrice(text, fallback) {
	const s = String(text || '');
	for (const [sym, code] of CUR_SYMBOLS) if (s.includes(sym)) return code || fallback;  // ¥ (CNY/JPY) и kr (NOK/SEK/DKK) — неоднозначны
	return fallback;
}
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
// Порядок день/месяц для «10/12/2026»: по всему файлу (где-то первое число > 12 — значит день первым)
function dateOrder(values) {
	let dmy = 0, mdy = 0;
	for (const v of values) {
		const m = String(v).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
		if (!m) continue;
		if (+m[1] > 12) dmy++; else if (+m[2] > 12) mdy++;
	}
	if (dmy || mdy) return dmy >= mdy ? 'dmy' : 'mdy';
	return values.some(v => /^\d{1,2}\.\d{1,2}\.\d{4}/.test(String(v))) ? 'dmy' : 'mdy';
}
function parseSihCsv(text, { login, cur: fallbackCur }) {
	const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
	const split = line => {
		const out = []; let cur = '', q = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"' && (line[i + 1] === ',' || i + 1 === line.length)) q = false; else cur += ch; }
			else if (ch === '"' && cur === '') q = true;
			else if (ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch;
		}
		out.push(cur.trim());
		return out;
	};
	const raw = lines.slice(1).map(split);
	const order = dateOrder(raw.map(c => c[3]));
	const now = new Date(), rows = [], errors = [];
	let year = now.getFullYear(), prevTs = null;   // для дат без года («12 Oct»): строки идут от новых к старым
	raw.forEach((c, i) => {
		const [itemName, gameName, , actedOn, display, cents, type, marketName, appId] = c;
		if (type !== 'purchase' && type !== 'sale') return;                       // выставление/снятие лота — не сделка
		if (appId ? appId !== '730' : !/counter-strike/i.test(gameName || '')) return;  // портфель — только CS2
		const name = marketName || itemName;
		const unit = Number(cents) / 100;
		let ts = NaN;
		const a = String(actedOn || '').trim();
		let m;
		if ((m = a.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/))) ts = Date.UTC(+m[1], +m[2] - 1, +m[3], 12);
		else if ((m = a.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/))) ts = order === 'dmy' ? Date.UTC(+m[3], +m[2] - 1, +m[1], 12) : Date.UTC(+m[3], +m[1] - 1, +m[2], 12);
		else if ((m = a.match(/^(\d{1,2})\s+([A-Za-z]{3})|^([A-Za-z]{3})\s+(\d{1,2})/))) {
			const day = +(m[1] || m[4]), mon = MONTHS[(m[2] || m[3]).toLowerCase()];
			if (mon != null) {
				let t = Date.UTC(year, mon, day, 12);
				if (t > now.getTime() + 86400e3 || (prevTs != null && t > prevTs + 86400e3)) { year--; t = Date.UTC(year, mon, day, 12); }
				ts = t; prevTs = t;
			}
		}
		const cur = currencyOfPrice(display, fallbackCur);
		if (!name || !(unit > 0) || !Number.isFinite(ts) || !cur) { errors.push(i + 2); return; }
		rows.push({ login, kind: type === 'purchase' ? 'buy' : 'sell', name, qty: 1, unit, cur, ts, src: 'sih' });
	});
	return { rows, errors };
}

module.exports = { Ledger, importMarketHistory, parseCsv, parseSihCsv, isSihCsv, currencyOfPrice };
