#!/usr/bin/env node
// Проверка релиза на VirusTotal: скачивает .exe из релиза GitHub, отправляет в VirusTotal (если файла там ещё нет),
// ждёт окончания анализа и дописывает в описание релиза блок со ссылками и результатом («0/72»).
//   node tools/virustotal.js v1.1.0
// Переменные: VT_API_KEY (бесплатный ключ virustotal.com → профиль → API key), GH_TOKEN, GITHUB_REPOSITORY (owner/repo).
// Публичный API VirusTotal — 4 запроса в минуту, поэтому между запросами пауза 16 с.
'use strict';
const crypto = require('crypto');

const TAG = process.argv[2] || process.env.GITHUB_REF_NAME;
const REPO = process.env.GITHUB_REPOSITORY || 'pythonMaster2002/cs2-storage-manager';
const VT = 'https://www.virustotal.com/api/v3';
const { VT_API_KEY, GH_TOKEN } = process.env;
const ASSETS = /\.exe$/i;
const START = '<!-- virustotal -->', END = '<!-- /virustotal -->';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastVt = 0;
async function vt(path, opts = {}) {
	const wait = lastVt + 16000 - Date.now();
	if (wait > 0) await sleep(wait);
	lastVt = Date.now();
	const r = await fetch(path.startsWith('http') ? path : VT + path, { ...opts, headers: { 'x-apikey': VT_API_KEY, ...(opts.headers || {}) } });
	if (r.status === 404) return null;
	if (r.status === 429) { await sleep(60000); return vt(path, opts); }
	if (!r.ok) throw new Error(`VirusTotal ${path}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
	return r.json();
}
async function gh(path, opts = {}) {
	const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, { ...opts,
		headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'caskit-release', ...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}), ...(opts.headers || {}) } });
	if (!r.ok) throw new Error(`GitHub ${path}: HTTP ${r.status}`);
	return r.json();
}

// Отправить файл (если VirusTotal его ещё не знает) и дождаться результата анализа
async function scan(name, buf) {
	const sha = crypto.createHash('sha256').update(buf).digest('hex');
	let file = await vt(`/files/${sha}`);
	if (!file) {
		console.log(`${name}: загрузка ${(buf.length / 1048576).toFixed(1)} МБ`);
		const form = new FormData();
		form.append('file', new Blob([buf]), name);
		// файлы больше 32 МБ — через отдельный адрес загрузки
		const url = buf.length > 32 * 1048576 ? (await vt('/files/upload_url')).data : `${VT}/files`;
		const up = await vt(url, { method: 'POST', body: form });
		const id = up.data.id;
		for (let i = 0; i < 60; i++) {   // до ~20 минут
			const a = await vt(`/analyses/${id}`);
			if (a && a.data.attributes.status === 'completed') break;
		}
		file = await vt(`/files/${sha}`);
	} else console.log(`${name}: уже есть в VirusTotal`);
	const st = (file && file.data.attributes.last_analysis_stats) || {};
	const total = ['malicious', 'suspicious', 'undetected', 'harmless'].reduce((n, k) => n + (st[k] || 0), 0);
	return { name, sha, detected: (st.malicious || 0) + (st.suspicious || 0), total, link: `https://www.virustotal.com/gui/file/${sha}` };
}

(async () => {
	if (!VT_API_KEY) { console.log('VT_API_KEY не задан — проверка на VirusTotal пропущена'); return; }
	if (!TAG) throw new Error('укажите тег релиза: node tools/virustotal.js v1.2.3');
	const rel = await gh(`/releases/tags/${TAG}`);
	const assets = rel.assets.filter(a => ASSETS.test(a.name));
	if (!assets.length) throw new Error(`в релизе ${TAG} нет .exe`);
	const results = [];
	for (const a of assets) {
		const r = await fetch(a.browser_download_url, { headers: { 'User-Agent': 'caskit-release' } });
		if (!r.ok) throw new Error(`скачивание ${a.name}: HTTP ${r.status}`);
		results.push(await scan(a.name, Buffer.from(await r.arrayBuffer())));
	}
	for (const x of results) console.log(`${x.name}: ${x.detected}/${x.total} ${x.link}`);
	const block = `${START}\n**VirusTotal:** ${results.map(x => `[${x.name} — ${x.detected}/${x.total}](${x.link})`).join(' · ')}\n${END}`;
	const body = rel.body || '';
	const next = body.includes(START) ? body.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block) : `${body.trimEnd()}\n\n${block}\n`;
	if (!GH_TOKEN) { console.log('GH_TOKEN не задан — описание релиза не обновлено\n' + block); return; }
	await gh(`/releases/${rel.id}`, { method: 'PATCH', body: JSON.stringify({ body: next }) });
	console.log('описание релиза обновлено');
})().catch(e => { console.error(e.message); process.exit(1); });
