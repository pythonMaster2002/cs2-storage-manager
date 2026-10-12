// История стоимости портфеля: раз в день на аккаунт сохраняем снимок (сумма и цены предметов) — только на этом
// компьютере. По снимкам — график, изменение за 24 ч / 7 / 30 дней и «что подорожало / подешевело».
'use strict';

const fs = require('fs');
const path = require('path');

const DETAIL_DAYS = 120;   // цены по предметам храним 120 дней, дальше — только суммы
const MAX_POINTS = 1500;
const DAY = 86400e3;

const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString('sv');  // YYYY-MM-DD по местному времени

class Portfolio {
	constructor(dataDir) {
		this.file = path.join(dataDir, 'portfolio.json');
		this.data = null;
	}

	_load() {
		if (!this.data) {
			try { this.data = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { this.data = {}; }
			if (!this.data || typeof this.data !== 'object') this.data = {};
		}
		return this.data;
	}

	_save() {
		try {
			fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data));
			fs.renameSync(this.file + '.tmp', this.file);
		} catch (e) { /* история — не критично */ }
	}

	// Снимок за сегодня (перезаписывает сегодняшний). v — результат CasketSession.valuation().
	record(login, source, v) {
		const all = this._load();
		const list = (all[login] = all[login] || []);
		const d = dayKey();
		const point = { d, src: source, usd: round(v.usd), inv: round(v.invUsd), st: round(v.storageUsd), items: compact(v.items) };
		const i = list.findIndex(p => p.d === d && p.src === source);
		if (i >= 0) list[i] = point; else list.push(point);
		list.sort((a, b) => a.d.localeCompare(b.d));
		const cut = dayKey(Date.now() - DETAIL_DAYS * DAY);
		for (const p of list) if (p.d < cut) delete p.items;
		if (list.length > MAX_POINTS) list.splice(0, list.length - MAX_POINTS);
		this._save();
	}

	hasToday(login, source) {
		return (this._load()[login] || []).some(p => p.d === dayKey() && p.src === source);
	}

	points(login, source) { return (this._load()[login] || []).filter(p => p.src === source); }

	// Сводка для набора аккаунтов. now: { login: valuation } — текущие значения (сегодняшний снимок).
	summary(now, source) {
		const logins = Object.keys(now);
		// график: сумма по дням (по каждому аккаунту — последний снимок не позже этого дня)
		const days = [...new Set(logins.flatMap(l => this.points(l, source).map(p => p.d)))].sort();
		const series = days.map(d => {
			let usd = 0, n = 0;
			for (const l of logins) {
				const p = lastBefore(this.points(l, source), d);
				if (p) { usd += p.usd; n++; }
			}
			return { d, usd: round(usd), accounts: n };
		});
		const change = {};
		for (const [key, days] of [['d1', 1], ['d7', 7], ['d30', 30]]) change[key] = this._change(now, source, days);
		change.all = this._change(now, source, null);
		return { series, change, since: days[0] || null };
	}

	// Изменение за N дней (null — с первого снимка): общее (с учётом перекладок и продаж) и «из‑за цен» —
	// по предметам, которые были и тогда, и сейчас. Снимок-основа — последний не позже, чем N дней назад,
	// но и не намного старше (иначе «за 24 ч» показало бы изменение за неделю).
	_change(now, source, days) {
		const target = days ? dayKey(Date.now() - days * DAY) : dayKey(Date.now() - DAY);
		const oldest = days ? dayKey(Date.now() - (days + Math.max(2, days / 2)) * DAY) : '';
		let base = 0, cur = 0, priceEffect = 0, has = false, from = null;
		const movers = new Map();
		for (const [login, v] of Object.entries(now)) {
			const pts = this.points(login, source);
			const p = days ? lastBefore(pts, target) : pts.find(x => x.d <= target);
			if (!p || p.d < oldest) continue;
			has = true;
			from = !from || p.d < from ? p.d : from;
			base += p.usd; cur += v.usd;
			if (!p.items) continue;
			for (const [name, [count, usd]] of Object.entries(v.items || {})) {
				const old = p.items[name];
				if (!old || !(old[1] > 0)) continue;
				const delta = Math.min(count, old[0]) * (usd - old[1]);
				priceEffect += delta;
				const m = movers.get(name) || { name, count: 0, delta: 0, was: old[1], now: usd };
				m.count += Math.min(count, old[0]); m.delta += delta;
				movers.set(name, m);
			}
		}
		if (!has) return null;
		const list = [...movers.values()].filter(m => Math.abs(m.delta) >= 0.005);
		return {
			from, base: round(base), usd: round(cur - base), pct: base > 0 ? (cur - base) / base : null, priceUsd: round(priceEffect),
			up: list.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 8).map(roundMover),
			down: list.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 8).map(roundMover),
		};
	}
}

function lastBefore(points, d) {
	let best = null;
	for (const p of points) if (p.d <= d) best = p;
	return best;
}
const round = x => Math.round((x || 0) * 100) / 100;
const roundMover = m => ({ name: m.name, count: m.count, delta: round(m.delta), was: m.was, now: m.now, pct: m.was > 0 ? (m.now - m.was) / m.was : null });
function compact(items) {
	const out = {};
	for (const [name, [count, usd]] of Object.entries(items || {})) out[name] = [count, Math.round(usd * 1000) / 1000];
	return out;
}

module.exports = { Portfolio, dayKey };
