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
	const PAGE = 100;  // большими страницами Steam быстрее упирается в лимит
	const sleep = ms => new Promise(r => setTimeout(r, ms));
	let start = 0, total = null, pages = 0, reachedOld = false, found = 0, added = 0, newest = prev && prev.lastTs || 0;
	while (pages < maxPages && (total == null || start < total) && !reachedOld) {
		if (shouldStop()) break;
		let res, tries = 0;
		for (;;) {
			res = await session.webRequest('GET', `${COMMUNITY}/market/myhistory/render/?query=&start=${start}&count=${PAGE}&norender=1`);
			if (res.status !== 429 || tries >= 8) break;
			tries++;
			// лимит Steam: ждём и продолжаем с той же страницы (минута, потом дольше)
			const wait = Math.min(300, 60 * tries);
			for (let s = wait; s > 0 && !shouldStop(); s--) { onProgress({ done: start, total, found, waiting: s }); await sleep(1000); }
			if (shouldStop()) break;
		}
		if (shouldStop()) break;
		if (res.status === 429) throw new Error('Steam ограничил частоту запросов — импорт остановлен, нажмите ещё раз позже: загруженное сохранено');
		if (res.status !== 200) throw new Error(`Steam не отдал историю Торговой площадки (HTTP ${res.status})`);
		let d;
		try { d = JSON.parse(res.body); } catch (e) { throw new Error('Steam вернул не JSON — войдите в аккаунт заново'); }
		if (!d || !d.success) throw new Error('Steam не отдал историю Торговой площадки');
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
		if (start < total && !reachedOld) await sleep(2500);
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

module.exports = { Ledger, importMarketHistory, parseCsv };
