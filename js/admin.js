// Clinic panel: dashboard, calendar (month / week / day), patients, payments, settings.
import { db, auth, collection, doc, onSnapshot, writeBatch, serverTimestamp, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from './firebase.js';
import { C, slotTimes, fmtTime, todayCR, addDays, dow, slotId, isPast } from './agenda-util.js';
import { compose, waLink, smsLink, mailLink, sendEmail, emailReady, phoneDigits, money, niceDate } from './notify.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DSHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const LABEL = { requested: 'Por confirmar', scheduled: 'Agendada', completed: 'Completada', cancelled: 'Cancelada' };
const VIEWS = { dash: 'Resumen', cal: 'Calendario', patients: 'Pacientes', payments: 'Pagos', settings: 'Ajustes' };
const ROW = 46; // px per slot in week/day views

const isPhone = () => matchMedia('(max-width: 767px)').matches;
const mondayOf = (d) => addDays(d, -((dow(d) + 6) % 7));
const monthTitle = (d) => { const [y, m] = d.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
const shortDate = (d) => { const [, m, dd] = d.split('-').map(Number); return `${DSHORT[dow(d)]} ${dd} ${MONTHS[m - 1].slice(0, 3)}`; };
const longDate = (d) => { const [y, m, dd] = d.split('-').map(Number); return `${DAYS[dow(d)]} ${dd} de ${MONTHS[m - 1]} de ${y}`; };
const active = (a) => a.status !== 'cancelled';
const chip = (s) => `<span class="st st--${s}">${LABEL[s]}</span>`;

let appts = [], byId = new Map(), unsub = null, known = null;
let view = 'dash', calMode = isPhone() ? 'day' : 'month', cursor = todayCR();
let selId = null, patQuery = '', selPatient = null, payMonth = todayCR().slice(0, 7);

/* =========================================================
   Feedback
   ========================================================= */
function toast(msg, actions = [], ms = 9000) {
	const t = document.createElement('div');
	t.className = 'toast';
	t.innerHTML = `<p>${esc(msg)}</p>`;
	if (actions.length) {
		const row = document.createElement('div'); row.className = 'toast__acts';
		actions.forEach((a) => {
			const x = a.href ? document.createElement('a') : document.createElement('button');
			x.className = 'btn btn--sm btn--ghost'; x.textContent = a.label;
			if (a.href) { x.href = a.href; x.target = '_blank'; x.rel = 'noopener'; } else x.addEventListener('click', a.onClick);
			row.appendChild(x);
		});
		t.appendChild(row);
	}
	const close = document.createElement('button'); close.className = 'toast__x'; close.setAttribute('aria-label', 'Cerrar'); close.innerHTML = '<svg class="ic"><use href="#i-x"/></svg>';
	close.addEventListener('click', () => t.remove()); t.appendChild(close);
	$('#toasts').appendChild(t);
	setTimeout(() => t.remove(), ms);
}
function fail(e) {
	console.error(e);
	const b = $('#banner');
	b.textContent = e && e.code === 'permission-denied'
		? 'Este usuario no tiene permiso. Revise que su correo esté en las reglas de Firestore.'
		: 'No se pudo completar la acción. Revise la conexión e intente de nuevo.';
	b.hidden = false;
}
function chime() {
	try {
		const ctx = new (window.AudioContext || window.webkitAudioContext)(), o = ctx.createOscillator(), g = ctx.createGain();
		o.frequency.value = 880; g.gain.setValueAtTime(.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .5);
		o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .5);
	} catch (e) { /* audio not available */ }
}

/* Tell the patient: automatic e-mail when possible, otherwise offer WhatsApp / SMS / mail. */
async function tellPatient(a, kind, intro) {
	if (emailReady() && a.email) {
		try { await sendEmail(a, kind); toast(`${intro} Se envió un correo a ${a.email}.`, [{ label: 'WhatsApp', href: waLink(a, kind) }]); return; }
		catch (e) { console.error(e); }
	}
	const acts = [{ label: 'WhatsApp', href: waLink(a, kind) }, { label: 'SMS', href: smsLink(a, kind) }];
	if (a.email) acts.push({ label: 'Correo', href: mailLink(a, kind) });
	toast(`${intro} Avise al paciente:`, acts, 15000);
}

/* =========================================================
   Data changes
   ========================================================= */
async function setStatus(a, status) {
	if (status === 'cancelled' && !confirm(`¿Cancelar la cita de ${a.name} (${shortDate(a.date)}, ${fmtTime(a.time)})? El horario quedará libre.`)) return;
	try {
		const b = writeBatch(db);
		b.update(doc(db, 'appointments', a.id), { status, updatedAt: serverTimestamp() });
		if (status === 'cancelled') b.delete(doc(db, 'slots', a.slotId));
		else b.set(doc(db, 'slots', a.slotId), { date: a.date, time: a.time, status });
		await b.commit();
		const next = { ...a, status };
		if (status === 'scheduled' && a.status === 'requested') tellPatient(next, 'confirm', 'Cita confirmada.');
		else if (status === 'cancelled') tellPatient(next, 'cancel', 'Cita cancelada.');
		else toast(status === 'completed' ? 'Cita marcada como completada.' : 'Cita actualizada.');
	} catch (e) { fail(e); }
}
async function patch(a, data, okMsg) {
	try { const b = writeBatch(db); b.update(doc(db, 'appointments', a.id), { ...data, updatedAt: serverTimestamp() }); await b.commit(); if (okMsg) toast(okMsg); }
	catch (e) { fail(e); }
}

/* =========================================================
   Shell / navigation
   ========================================================= */
function go(v) {
	view = v;
	$$('.side__nav button').forEach((b) => (b.dataset.view === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
	render();
	$('.main').scrollTop = 0;
}
$$('.side__nav button').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));

function render() {
	$('#viewTitle').textContent = VIEWS[view];
	$('#topTools').innerHTML = '';
	$('#viewSub').textContent = '';
	({ dash: renderDash, cal: renderCal, patients: renderPatients, payments: renderPayments, settings: renderSettings })[view]();
	renderMini();
	const pend = appts.filter((a) => a.status === 'requested').length;
	$('#navBadge').hidden = !pend; $('#navBadge').textContent = pend;
	if (selId && !$('#drawer').contains(document.activeElement)) renderDrawer();
}

/* Delegated clicks inside views */
document.addEventListener('click', (e) => {
	const t = e.target.closest('[data-act]');
	if (!t) return;
	const a = byId.get(t.dataset.id);
	switch (t.dataset.act) {
		case 'open': openDrawer(t.dataset.id); break;
		case 'confirm': e.stopPropagation(); setStatus(a, 'scheduled'); break;
		case 'pay': e.stopPropagation(); openPay(a); break;
		case 'new': openNew(t.dataset.date, t.dataset.time); break;
		case 'day': cursor = t.dataset.date; calMode = 'day'; if (view !== 'cal') view = 'cal'; go('cal'); break;
		case 'patient': selPatient = t.dataset.key; renderPatients(); break;
		case 'back': selPatient = null; renderPatients(); break;
		case 'receipt': e.stopPropagation(); openReceipt(a); break;
		case 'remind-all': remindTomorrow(); break;
	}
});

/* =========================================================
   Dashboard
   ========================================================= */
function renderDash() {
	const today = todayCR(), week0 = mondayOf(today), week1 = addDays(week0, 6), month = today.slice(0, 7);
	$('#viewSub').textContent = longDate(today);
	const todays = appts.filter((a) => a.date === today && active(a)).sort((x, y) => x.time.localeCompare(y.time));
	const pending = appts.filter((a) => a.status === 'requested').sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
	const week = appts.filter((a) => a.date >= week0 && a.date <= week1 && active(a));
	const paidMonth = appts.filter((a) => a.payment && (a.payment.paidDate || a.date).startsWith(month));
	const sum = (cur) => paidMonth.filter((a) => a.payment.currency === cur).reduce((s, a) => s + Number(a.payment.amount || 0), 0);
	const crc = sum('CRC'), usd = sum('USD');
	const unpaid = appts.filter((a) => a.status === 'completed' && !a.payment).sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
	const tomorrow = addDays(today, 1);
	const tmr = appts.filter((a) => a.date === tomorrow && a.status === 'scheduled');
	const nextUp = todays.find((a) => !isPast(a.date, a.time) && a.status !== 'completed');

	const row = (a, opts = {}) => `
		<button class="row" data-act="open" data-id="${a.id}">
			<span class="row__time">${opts.date ? `${shortDate(a.date)}<br>` : ''}${fmtTime(a.time)}</span>
			<span class="row__main"><strong>${esc(a.name)}</strong><small>${esc(a.service)}</small></span>
			${opts.confirm ? `<span class="btn btn--sm btn--ok" data-act="confirm" data-id="${a.id}">Confirmar</span>` : opts.pay ? `<span class="btn btn--sm btn--ok" data-act="pay" data-id="${a.id}">Cobrar</span>` : chip(a.status)}
		</button>`;
	const empty = (t) => `<p class="empty">${t}</p>`;

	$('#view').innerHTML = `
		<div class="kpis">
			<button class="kpi" data-act="day" data-date="${today}"><span>Hoy</span><strong>${todays.length}</strong><small>${nextUp ? `Próxima: ${fmtTime(nextUp.time)}, ${esc(nextUp.name.split(' ')[0])}` : todays.length ? 'No quedan más hoy' : 'Sin citas'}</small></button>
			<div class="kpi kpi--req"><span>Por confirmar</span><strong>${pending.length}</strong><small>${pending.length ? 'Solicitudes de la web' : 'Todo al día'}</small></div>
			<div class="kpi"><span>Esta semana</span><strong>${week.length}</strong><small>${shortDate(week0)} – ${shortDate(week1)}</small></div>
			<div class="kpi kpi--money"><span>Cobrado en ${MONTHS[Number(month.slice(5)) - 1]}</span><strong>${money({ amount: crc, currency: 'CRC' })}</strong><small>${usd ? `+ ${money({ amount: usd, currency: 'USD' })}` : `${paidMonth.length} pago${paidMonth.length === 1 ? '' : 's'}`}</small></div>
		</div>
		<div class="dash">
			<section class="card dash__today"><header><h2>Agenda de hoy</h2><button class="linkbtn" data-act="day" data-date="${today}">Ver en calendario</button></header>
				${todays.length ? todays.map((a) => row(a)).join('') : empty('No hay citas hoy. Las solicitudes nuevas aparecerán aquí al instante.')}</section>
			<section class="card"><header><h2>Por confirmar</h2>${pending.length ? `<span class="st st--requested">${pending.length}</span>` : ''}</header>
				${pending.length ? pending.slice(0, 8).map((a) => row(a, { date: true, confirm: true })).join('') : empty('No hay solicitudes pendientes.')}</section>
			<section class="card"><header><h2>Mañana</h2>${tmr.length ? '<button class="linkbtn" data-act="remind-all">Enviar recordatorios</button>' : ''}</header>
				${tmr.length ? tmr.sort((x, y) => x.time.localeCompare(y.time)).map((a) => row(a)).join('') : empty('No hay citas agendadas para mañana.')}</section>
			<section class="card"><header><h2>Completadas sin cobrar</h2></header>
				${unpaid.length ? unpaid.slice(0, 8).map((a) => row(a, { date: true, pay: true })).join('') : empty('Todas las consultas completadas están cobradas.')}</section>
		</div>`;
}

async function remindTomorrow() {
	const tmr = appts.filter((a) => a.date === addDays(todayCR(), 1) && a.status === 'scheduled');
	let sent = 0; const manual = [];
	for (const a of tmr) {
		if (emailReady() && a.email) { try { await sendEmail(a, 'reminder'); sent++; continue; } catch (e) { console.error(e); } }
		manual.push(a);
	}
	if (sent) toast(`Recordatorio enviado por correo a ${sent} paciente${sent > 1 ? 's' : ''}.`);
	manual.forEach((a) => toast(`Recordatorio para ${a.name} (${fmtTime(a.time)})`, [{ label: 'WhatsApp', href: waLink(a, 'reminder') }, { label: 'SMS', href: smsLink(a, 'reminder') }], 30000));
}

/* =========================================================
   Calendar
   ========================================================= */
function calTools(title) {
	$('#topTools').innerHTML = `
		<div class="calnav">
			<button class="iconbtn" data-cal="prev" aria-label="Anterior"><svg class="ic"><use href="#i-left"/></svg></button>
			<button class="btn btn--sm btn--ghost" data-cal="today">Hoy</button>
			<button class="iconbtn" data-cal="next" aria-label="Siguiente"><svg class="ic"><use href="#i-right"/></svg></button>
		</div>
		<div class="seg" role="tablist" aria-label="Vista">
			${['month', 'week', 'day'].map((m) => `<button role="tab" data-mode="${m}" aria-selected="${calMode === m}">${{ month: 'Mes', week: 'Semana', day: 'Día' }[m]}</button>`).join('')}
		</div>`;
	$('#viewSub').textContent = title;
	$$('[data-mode]').forEach((b) => b.addEventListener('click', () => { calMode = b.dataset.mode; renderCal(); renderMini(); }));
	$$('[data-cal]').forEach((b) => b.addEventListener('click', () => {
		const k = b.dataset.cal;
		if (k === 'today') cursor = todayCR();
		else {
			const s = k === 'next' ? 1 : -1;
			if (calMode === 'month') { const [y, m] = cursor.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + s, 1)); cursor = d.toISOString().slice(0, 10); }
			else cursor = addDays(cursor, calMode === 'week' ? 7 * s : s);
		}
		renderCal(); renderMini();
	}));
}

function renderCal() {
	if (calMode === 'month') return renderMonth();
	const days = calMode === 'week' ? [...Array(7)].map((_, i) => addDays(mondayOf(cursor), i)) : [cursor];
	const title = calMode === 'week' ? `${shortDate(days[0])} – ${shortDate(days[6])}` : longDate(cursor);
	calTools(title);
	renderGrid(days);
}

function renderMonth() {
	const [y, m] = cursor.split('-').map(Number);
	const first = `${y}-${String(m).padStart(2, '0')}-01`;
	const start = mondayOf(first);
	const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
	const weeks = Math.ceil((((dow(first) + 6) % 7) + dim) / 7);
	const today = todayCR();
	calTools(monthTitle(first));
	const byDay = new Map();
	appts.filter(active).forEach((a) => { if (!byDay.has(a.date)) byDay.set(a.date, []); byDay.get(a.date).push(a); });
	let cells = '';
	for (let i = 0; i < weeks * 7; i++) {
		const d = addDays(start, i), list = (byDay.get(d) || []).sort((p, q) => p.time.localeCompare(q.time));
		const out = d.slice(0, 7) !== first.slice(0, 7), closed = !C.hours[dow(d)];
		const max = 3;
		cells += `<div class="mcell${out ? ' is-out' : ''}${closed ? ' is-closed' : ''}${d === today ? ' is-today' : ''}${d === cursor ? ' is-sel' : ''}">
			<button class="mcell__day" data-act="day" data-date="${d}" aria-label="${longDate(d)}"><span>${Number(d.slice(8))}</span></button>
			<div class="mcell__evs">
				${list.slice(0, max).map((a) => `<button class="ev ev--${a.status}" data-act="open" data-id="${a.id}"><b>${fmtTime(a.time).replace(' ', ' ')}</b> ${esc(a.name)}</button>`).join('')}
				${list.length > max ? `<button class="ev__more" data-act="day" data-date="${d}">${list.length - max} más</button>` : ''}
			</div>
			${list.length ? `<span class="mcell__dots" aria-hidden="true">${list.slice(0, 4).map((a) => `<i class="dot--${a.status}"></i>`).join('')}</span>` : ''}
		</div>`;
	}
	$('#view').innerHTML = `
		<div class="month">
			<div class="month__head">${['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((x) => `<span>${x}</span>`).join('')}</div>
			<div class="month__grid" style="grid-template-rows: repeat(${weeks}, minmax(0, 1fr))">${cells}</div>
		</div>
		${legend()}`;
}

function renderGrid(days) {
	const step = C.slotMinutes || 30;
	const opens = Object.values(C.hours).filter(Boolean);
	let minH = Math.min(...opens.map((h) => h[0])), maxH = Math.max(...opens.map((h) => h[1]));
	const dayAppts = (d) => appts.filter((a) => a.date === d);
	days.forEach((d) => dayAppts(d).filter(active).forEach((a) => { const h = Number(a.time.slice(0, 2)); minH = Math.min(minH, h); maxH = Math.max(maxH, h + 1); }));
	const rows = ((maxH - minH) * 60) / step;
	const times = [...Array(rows)].map((_, i) => { const mm = minH * 60 + i * step; return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`; });
	const today = todayCR();
	const nowCR = new Date(Date.now() - 6 * 3600e3), nowMin = nowCR.getUTCHours() * 60 + nowCR.getUTCMinutes();
	const single = days.length === 1;

	const cols = days.map((d) => {
		const open = new Set(slotTimes(d));
		const list = dayAppts(d).filter(active);
		const taken = new Set(list.map((a) => a.time));
		const cells = times.map((t) => {
			const can = open.has(t) && !taken.has(t) && !isPast(d, t);
			return can ? `<button class="gcell" data-act="new" data-date="${d}" data-time="${t}" aria-label="Agendar ${shortDate(d)} ${fmtTime(t)}">${single ? '<span>+ Agendar</span>' : ''}</button>`
				: `<div class="gcell${open.has(t) ? '' : ' is-closed'}"></div>`;
		}).join('');
		const evs = list.map((a) => {
			const mm = Number(a.time.slice(0, 2)) * 60 + Number(a.time.slice(3));
			const top = ((mm - minH * 60) / step) * ROW;
			return `<button class="gev ev--${a.status}" style="top:${top + 2}px;height:${ROW - 4}px" data-act="open" data-id="${a.id}">
				<b>${fmtTime(a.time)}</b><span>${esc(a.name)}</span>${single ? `<small>${esc(a.service)}${a.payment ? ' · pagado' : ''}</small>` : ''}</button>`;
		}).join('');
		const now = d === today && nowMin >= minH * 60 && nowMin <= maxH * 60 ? `<i class="gnow" style="top:${((nowMin - minH * 60) / step) * ROW}px"></i>` : '';
		return `<div class="gcol${d === today ? ' is-today' : ''}">${cells}${evs}${now}</div>`;
	}).join('');

	$('#view').innerHTML = `
		<div class="grid ${single ? 'grid--day' : 'grid--week'}">
			<div class="grid__head" style="--n:${days.length}">
				<span></span>
				${days.map((d) => `<button class="ghead${d === today ? ' is-today' : ''}" data-act="day" data-date="${d}"><small>${DSHORT[dow(d)]}</small><b>${Number(d.slice(8))}</b></button>`).join('')}
			</div>
			<div class="grid__body" style="--n:${days.length}">
				<div class="gtimes">${times.map((t) => `<span>${t.endsWith(':00') ? fmtTime(t).replace(':00', '') : ''}</span>`).join('')}</div>
				${cols}
			</div>
		</div>
		${legend()}`;
	const nowLine = $('.gnow');
	if (nowLine) nowLine.scrollIntoView({ block: 'center' });
}

const legend = () => `<ul class="legend">${Object.keys(LABEL).map((s) => `<li><i class="dot--${s}"></i>${LABEL[s]}</li>`).join('')}</ul>`;

/* Sidebar mini calendar */
function renderMini() {
	const box = $('#mini');
	if (!box) return;
	const [y, m] = cursor.split('-').map(Number);
	const first = `${y}-${String(m).padStart(2, '0')}-01`, start = mondayOf(first), today = todayCR();
	const has = new Set(appts.filter(active).map((a) => a.date));
	let html = `<div class="mini__head"><b>${monthTitle(first)}</b></div><div class="mini__grid">${['l', 'm', 'm', 'j', 'v', 's', 'd'].map((x) => `<span>${x}</span>`).join('')}`;
	for (let i = 0; i < 42; i++) {
		const d = addDays(start, i);
		html += `<button data-act="day" data-date="${d}" class="${d.slice(0, 7) !== first.slice(0, 7) ? 'is-out' : ''}${d === today ? ' is-today' : ''}${d === cursor && view === 'cal' ? ' is-sel' : ''}${has.has(d) ? ' has' : ''}">${Number(d.slice(8))}</button>`;
	}
	box.innerHTML = html + '</div>';
}

/* =========================================================
   Detail drawer
   ========================================================= */
function openDrawer(id) { selId = id; renderDrawer(); $('#drawer').hidden = false; $('#scrim').hidden = false; requestAnimationFrame(() => $('#drawer').classList.add('is-open')); }
function closeDrawer() { selId = null; $('#drawer').classList.remove('is-open'); $('#scrim').hidden = true; setTimeout(() => { if (!selId) $('#drawer').hidden = true; }, 220); }
$('#dClose').addEventListener('click', closeDrawer);
$('#scrim').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && selId && !$('dialog[open]')) closeDrawer(); });

function renderDrawer() {
	const a = byId.get(selId);
	if (!a) return closeDrawer();
	$('#dTitle').textContent = a.name;
	$('#dWhen').textContent = `${longDate(a.date)}, ${fmtTime(a.time)}`;
	const p = a.payment;
	const acts = [];
	if (a.status === 'requested') acts.push(['scheduled', 'Confirmar cita', 'btn--primary']);
	if (a.status === 'scheduled') acts.push(['completed', 'Marcar completada', 'btn--primary']);
	if (a.status === 'completed') acts.push(['scheduled', 'Reabrir', 'btn--ghost']);
	if (a.status === 'requested' || a.status === 'scheduled') acts.push(['cancelled', 'Cancelar cita', 'btn--danger']);
	const kinds = [['confirm', 'Confirmación'], ['reminder', 'Recordatorio'], ['cancel', 'Cancelación']];
	if (p) kinds.push(['receipt', 'Comprobante de pago']);
	$('#dBody').innerHTML = `
		<div class="d-status">${chip(a.status)}${p ? '<span class="st st--paid">Pagado</span>' : ''}</div>
		<div class="d-acts">${acts.map(([s, l, c]) => `<button class="btn ${c}" data-status="${s}">${l}</button>`).join('')}</div>
		<div class="d-contact">
			<a class="cbtn" href="tel:+${phoneDigits(a.phone)}"><svg class="ic"><use href="#i-phone"/></svg>Llamar</a>
			<a class="cbtn" href="${waLink(a, a.status === 'requested' ? 'request' : 'confirm')}" target="_blank" rel="noopener"><svg class="ic"><use href="#i-wa"/></svg>WhatsApp</a>
			<a class="cbtn" href="${smsLink(a, a.status === 'requested' ? 'request' : 'confirm')}"><svg class="ic"><use href="#i-sms"/></svg>SMS</a>
			${a.email ? `<a class="cbtn" href="${mailLink(a, 'confirm')}"><svg class="ic"><use href="#i-mail"/></svg>Correo</a>` : ''}
		</div>
		<dl class="d-info">
			<dt>Servicio</dt><dd>${esc(a.service)}</dd>
			<dt>Teléfono</dt><dd>${esc(a.phone)}</dd>
			${a.email ? `<dt>Correo</dt><dd>${esc(a.email)}</dd>` : ''}
			<dt>Primera visita</dt><dd>${esc(a.first || '—')}</dd>
			<dt>Idioma</dt><dd>${a.lang === 'en' ? 'Inglés' : 'Español'}</dd>
			${a.note ? `<dt>Motivo</dt><dd>${esc(a.note)}</dd>` : ''}
		</dl>
		<section class="d-sec">
			<h3>Pago</h3>
			${p ? `<div class="d-pay"><strong>${money(p)}</strong><span>${esc(p.method)}${p.ref ? `, ref. ${esc(p.ref)}` : ''}</span><small>Comprobante ${esc(p.receiptNo)}</small></div>
				<div class="d-row"><button class="btn btn--sm btn--ghost" data-act="receipt" data-id="${a.id}"><svg class="ic"><use href="#i-doc"/></svg>Ver comprobante</button>
				<button class="btn btn--sm btn--ghost" id="dSendReceipt">Enviar comprobante</button>
				<button class="linkbtn linkbtn--danger" id="dUnpay">Anular pago</button></div>`
		: `<p class="muted">Sin pago registrado.</p><button class="btn btn--sm btn--ok" data-act="pay" data-id="${a.id}"><svg class="ic"><use href="#i-cash"/></svg>Registrar pago</button>`}
		</section>
		<section class="d-sec">
			<h3>Enviar mensaje</h3>
			<div class="d-msg">
				<select id="dKind" aria-label="Tipo de mensaje">${kinds.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
				<div class="d-row">
					<a class="btn btn--sm btn--ghost" id="dWa" target="_blank" rel="noopener">WhatsApp</a>
					<a class="btn btn--sm btn--ghost" id="dSms">SMS</a>
					${a.email ? `<button class="btn btn--sm btn--ghost" id="dMail">${emailReady() ? 'Enviar correo' : 'Correo'}</button>` : ''}
				</div>
			</div>
		</section>
		<section class="d-sec">
			<h3>Nota interna</h3>
			<textarea id="dNote" rows="3" maxlength="1000" placeholder="Solo la ve la clínica">${esc(a.staffNote || '')}</textarea>
			<button class="btn btn--sm btn--ghost" id="dSaveNote">Guardar nota</button>
		</section>`;
	$$('[data-status]', $('#dBody')).forEach((b) => b.addEventListener('click', () => setStatus(a, b.dataset.status)));
	const kindSel = $('#dKind');
	const syncMsg = () => { $('#dWa').href = waLink(a, kindSel.value); $('#dSms').href = smsLink(a, kindSel.value); };
	kindSel.addEventListener('change', syncMsg); syncMsg();
	const mailBtn = $('#dMail');
	if (mailBtn) mailBtn.addEventListener('click', async () => {
		if (emailReady()) { try { await sendEmail(a, kindSel.value); toast(`Correo enviado a ${a.email}.`); } catch (e) { toast('No se pudo enviar el correo automático. Se abrirá su aplicación de correo.'); location.href = mailLink(a, kindSel.value); } }
		else location.href = mailLink(a, kindSel.value);
	});
	$('#dSaveNote').addEventListener('click', () => patch(a, { staffNote: $('#dNote').value.trim() }, 'Nota guardada.'));
	if (p) {
		$('#dSendReceipt').addEventListener('click', () => tellPatient(a, 'receipt', 'Comprobante listo.'));
		$('#dUnpay').addEventListener('click', () => { if (confirm('¿Anular el pago registrado?')) patch(a, { payment: null }, 'Pago anulado.'); });
	}
}

/* =========================================================
   New appointment (by the clinic)
   ========================================================= */
function fillTimes(selTime) {
	const d = $('#n-date').value, sel = $('#n-time');
	const taken = new Set(appts.filter((a) => a.date === d && active(a)).map((a) => a.time));
	const free = d ? slotTimes(d).filter((t) => !taken.has(t) && !isPast(d, t)) : [];
	sel.innerHTML = free.length ? free.map((t) => `<option value="${t}"${t === selTime ? ' selected' : ''}>${fmtTime(t)}</option>`).join('') : '<option value="">Sin horarios libres</option>';
}
function openNew(date, time) {
	$('#newForm').reset();
	$('#n-date').value = date || (view === 'cal' ? cursor : todayCR());
	$('#n-date').min = todayCR();
	fillTimes(time);
	const seen = new Map(); appts.forEach((a) => seen.set(a.name, a));
	$('#patientList').innerHTML = [...seen.keys()].map((n) => `<option value="${esc(n)}">`).join('');
	$('#newDlg').showModal();
}
$('#n-date').addEventListener('change', () => fillTimes());
$('#n-name').addEventListener('change', () => {
	const prev = [...appts].reverse().find((a) => a.name === $('#n-name').value);
	if (prev) { if (!$('#n-phone').value) $('#n-phone').value = prev.phone; if (!$('#n-email').value && prev.email) $('#n-email').value = prev.email; }
});
$('#newBtn').addEventListener('click', () => openNew());
$('#newForm').addEventListener('submit', async (e) => {
	e.preventDefault();
	const date = $('#n-date').value, time = $('#n-time').value;
	if (!time) return toast('Elija un día con horarios libres.');
	const data = {
		slotId: slotId(date, time), date, time, status: 'scheduled',
		name: $('#n-name').value.trim(), phone: $('#n-phone').value.trim(), service: $('#n-service').value,
		first: appts.some((a) => phoneDigits(a.phone) === phoneDigits($('#n-phone').value)) ? 'No' : 'Sí',
		note: $('#n-note').value.trim(), lang: 'es', createdAt: serverTimestamp(), source: 'clinic'
	};
	const email = $('#n-email').value.trim();
	if (email) data.email = email;
	try {
		const b = writeBatch(db);
		b.set(doc(db, 'slots', data.slotId), { date, time, status: 'scheduled' });
		b.set(doc(collection(db, 'appointments')), data);
		await b.commit();
		$('#newDlg').close();
		if ($('#n-notify').checked) tellPatient(data, 'confirm', 'Cita agendada.');
		else toast('Cita agendada.');
	} catch (err) { fail(err); }
});
$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

/* =========================================================
   Payments + receipts
   ========================================================= */
let payTarget = null;
function openPay(a) {
	payTarget = a;
	$('#payForm').reset();
	$('#payWho').textContent = `${a.name}, ${a.service}, ${shortDate(a.date)} ${fmtTime(a.time)}`;
	$('#p-send').parentElement.hidden = false;
	$('#payDlg').showModal();
}
$('#payForm').addEventListener('submit', async (e) => {
	e.preventDefault();
	const a = payTarget, now = new Date(Date.now() - 6 * 3600e3);
	const payment = {
		amount: Number($('#p-amount').value), currency: $('#p-currency').value, method: $('#p-method').value, ref: $('#p-ref').value.trim(),
		receiptNo: 'R-' + now.toISOString().slice(2, 16).replace(/[-T:]/g, '').replace(/^(\d{6})(\d{4})$/, '$1-$2'),
		paidDate: todayCR(), paidAt: serverTimestamp()
	};
	const extra = a.status === 'scheduled' && isPast(a.date, a.time) ? { status: 'completed' } : {};
	try {
		const b = writeBatch(db);
		b.update(doc(db, 'appointments', a.id), { payment, ...extra, updatedAt: serverTimestamp() });
		if (extra.status) b.set(doc(db, 'slots', a.slotId), { date: a.date, time: a.time, status: 'completed' });
		await b.commit();
		$('#payDlg').close();
		const next = { ...a, ...extra, payment };
		if ($('#p-send').checked) tellPatient(next, 'receipt', `Pago de ${money(payment)} registrado.`);
		else toast(`Pago de ${money(payment)} registrado.`, [{ label: 'Ver comprobante', onClick: () => openReceipt(next) }]);
	} catch (err) { fail(err); }
});

function openReceipt(a) {
	const p = a.payment; if (!p) return;
	const w = window.open('', '_blank');
	if (!w) return toast('Permita las ventanas emergentes para ver el comprobante.');
	let logo = new URL('assets/logg.png', location.href).href;
	try { // embed the logo so it shows in the new window and in the saved PDF
		const img = $('.side__brand img'), cv = document.createElement('canvas');
		cv.width = img.naturalWidth; cv.height = img.naturalHeight; cv.getContext('2d').drawImage(img, 0, 0); logo = cv.toDataURL('image/png');
	} catch (e) { /* keep the URL */ }
	w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Comprobante ${esc(p.receiptNo)}</title>
<style>
body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#14233A;margin:0;background:#F3F7F9}
.r{max-width:640px;margin:24px auto;background:#fff;padding:40px;border:1px solid #DCE3EB;border-radius:16px}
header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #102A4C;padding-bottom:20px;margin-bottom:24px}
header img{width:72px}header h1{margin:0;font-size:22px;color:#1F4E8C}header p{margin:2px 0 0;color:#4A5870;font-size:14px}
h2{font-size:18px;margin:0 0 4px}.no{color:#4A5870;margin:0 0 24px}
table{width:100%;border-collapse:collapse;font-size:15px}td{padding:10px 0;border-bottom:1px solid #DCE3EB;vertical-align:top}td:first-child{color:#4A5870;width:40%}
.total{display:flex;justify-content:space-between;align-items:baseline;margin-top:24px;padding:18px 20px;background:#E6F2F1;border-radius:12px}
.total strong{font-size:28px}.legal{font-size:12px;color:#6E7B90;margin-top:28px}
.bar{max-width:640px;margin:0 auto 24px;display:flex;gap:8px;justify-content:flex-end}
.bar button{font:inherit;font-weight:700;padding:10px 18px;border-radius:999px;border:0;background:#1F4E8C;color:#fff;cursor:pointer}
@media print{body{background:#fff}.r{border:0;margin:0;padding:0}.bar{display:none}}
</style></head><body>
<div class="r">
<header><img src="${logo}" alt=""><div><h1>${esc(C.legalName)}</h1><p>${esc(C.address.es)}</p><p>${esc(C.phoneDisplay)}</p></div></header>
<h2>Comprobante de pago</h2><p class="no">N.º ${esc(p.receiptNo)} · ${niceDate(p.paidDate || a.date)}</p>
<table>
<tr><td>Paciente</td><td>${esc(a.name)}</td></tr>
<tr><td>Teléfono</td><td>${esc(a.phone)}</td></tr>
<tr><td>Servicio</td><td>${esc(a.service)}</td></tr>
<tr><td>Fecha de la consulta</td><td>${longDate(a.date)}, ${fmtTime(a.time)}</td></tr>
<tr><td>Forma de pago</td><td>${esc(p.method)}${p.ref ? ` (ref. ${esc(p.ref)})` : ''}</td></tr>
</table>
<div class="total"><span>Total pagado</span><strong>${money(p)}</strong></div>
<p class="legal">Este comprobante confirma el pago recibido. No sustituye la factura electrónica, que se emite por separado según la normativa de Hacienda.</p>
</div>
<div class="bar"><button onclick="window.print()">Imprimir o guardar PDF</button></div>
</body></html>`);
	w.document.close();
}

function renderPayments() {
	const [y, m] = payMonth.split('-').map(Number);
	$('#topTools').innerHTML = `
		<div class="calnav">
			<button class="iconbtn" data-pm="-1" aria-label="Mes anterior"><svg class="ic"><use href="#i-left"/></svg></button>
			<b class="calnav__label">${MONTHS[m - 1]} ${y}</b>
			<button class="iconbtn" data-pm="1" aria-label="Mes siguiente"><svg class="ic"><use href="#i-right"/></svg></button>
		</div>
		<button class="btn btn--sm btn--ghost" id="csv"><svg class="ic"><use href="#i-down"/></svg>Exportar CSV</button>`;
	$$('[data-pm]').forEach((b) => b.addEventListener('click', () => { const d = new Date(Date.UTC(y, m - 1 + Number(b.dataset.pm), 1)); payMonth = d.toISOString().slice(0, 7); renderPayments(); }));
	const list = appts.filter((a) => a.payment && (a.payment.paidDate || a.date).startsWith(payMonth)).sort((p, q) => (q.payment.paidDate || q.date).localeCompare(p.payment.paidDate || p.date));
	const tot = (cur) => list.filter((a) => a.payment.currency === cur).reduce((s, a) => s + Number(a.payment.amount || 0), 0);
	const methods = {};
	list.forEach((a) => { const k = a.payment.method; methods[k] = methods[k] || { CRC: 0, USD: 0, n: 0 }; methods[k][a.payment.currency] += Number(a.payment.amount || 0); methods[k].n++; });
	$('#csv').addEventListener('click', () => {
		const rows = [['Comprobante', 'Fecha pago', 'Paciente', 'Teléfono', 'Servicio', 'Fecha cita', 'Forma de pago', 'Referencia', 'Moneda', 'Monto']]
			.concat(list.map((a) => [a.payment.receiptNo, a.payment.paidDate || a.date, a.name, a.phone, a.service, a.date, a.payment.method, a.payment.ref || '', a.payment.currency, a.payment.amount]));
		const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
		const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = `pagos-${payMonth}.csv`; link.click();
	});
	const unpaid = appts.filter((a) => a.status === 'completed' && !a.payment);
	$('#view').innerHTML = `
		<div class="kpis kpis--3">
			<div class="kpi kpi--money"><span>Total en colones</span><strong>${money({ amount: tot('CRC'), currency: 'CRC' })}</strong><small>${list.filter((a) => a.payment.currency === 'CRC').length} pagos</small></div>
			<div class="kpi"><span>Total en dólares</span><strong>${money({ amount: tot('USD'), currency: 'USD' })}</strong><small>${list.filter((a) => a.payment.currency === 'USD').length} pagos</small></div>
			<div class="kpi kpi--req"><span>Pendientes de cobro</span><strong>${unpaid.length}</strong><small>Consultas completadas</small></div>
		</div>
		${Object.keys(methods).length ? `<div class="methods">${Object.entries(methods).map(([k, v]) => `<div><span>${esc(k)}</span><b>${[v.CRC ? money({ amount: v.CRC, currency: 'CRC' }) : '', v.USD ? money({ amount: v.USD, currency: 'USD' }) : ''].filter(Boolean).join(' + ')}</b><small>${v.n} pago${v.n > 1 ? 's' : ''}</small></div>`).join('')}</div>` : ''}
		<section class="card">
			<header><h2>Pagos de ${MONTHS[m - 1]}</h2></header>
			${list.length ? `<div class="table"><table>
				<thead><tr><th>Fecha</th><th>Paciente</th><th class="hide-sm">Servicio</th><th class="hide-sm">Forma</th><th class="num">Monto</th><th></th></tr></thead>
				<tbody>${list.map((a) => `<tr data-act="open" data-id="${a.id}">
					<td>${niceDate(a.payment.paidDate || a.date)}<small>${esc(a.payment.receiptNo)}</small></td>
					<td><strong>${esc(a.name)}</strong></td><td class="hide-sm">${esc(a.service)}</td><td class="hide-sm">${esc(a.payment.method)}</td>
					<td class="num"><strong>${money(a.payment)}</strong></td>
					<td><button class="iconbtn" data-act="receipt" data-id="${a.id}" aria-label="Ver comprobante" title="Ver comprobante"><svg class="ic"><use href="#i-doc"/></svg></button></td></tr>`).join('')}</tbody>
			</table></div>` : '<p class="empty">No hay pagos registrados este mes. Registre un pago desde el detalle de una cita.</p>'}
		</section>`;
}

/* =========================================================
   Patients
   ========================================================= */
function patients() {
	const map = new Map();
	appts.forEach((a) => {
		const k = phoneDigits(a.phone) || a.name.toLowerCase();
		if (!map.has(k)) map.set(k, { key: k, list: [] });
		map.get(k).list.push(a);
	});
	const today = todayCR();
	return [...map.values()].map((p) => {
		p.list.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
		const last = p.list[p.list.length - 1];
		p.name = last.name; p.phone = last.phone; p.email = [...p.list].reverse().find((a) => a.email)?.email || '';
		p.visits = p.list.filter((a) => a.status === 'completed').length;
		p.lastVisit = [...p.list].reverse().find((a) => a.status === 'completed')?.date || '';
		p.next = p.list.find((a) => active(a) && a.status !== 'completed' && a.date >= today);
		p.paid = { CRC: 0, USD: 0 };
		p.list.forEach((a) => { if (a.payment) p.paid[a.payment.currency] += Number(a.payment.amount || 0); });
		return p;
	}).sort((x, y) => x.name.localeCompare(y.name, 'es'));
}
function renderPatients() {
	const all = patients();
	$('#viewSub').textContent = `${all.length} paciente${all.length === 1 ? '' : 's'}`;
	if (!$('#pSearch')) $('#topTools').innerHTML = `<label class="search"><svg class="ic"><use href="#i-search"/></svg><input id="pSearch" type="search" placeholder="Buscar por nombre o teléfono" value="${esc(patQuery)}"></label>`;
	const s = $('#pSearch');
	s.oninput = () => { patQuery = s.value; renderPatients(); };
	const q = patQuery.trim().toLowerCase();
	const list = all.filter((p) => !q || p.name.toLowerCase().includes(q) || p.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '') || '~'));
	const paidTxt = (p) => [p.paid.CRC ? money({ amount: p.paid.CRC, currency: 'CRC' }) : '', p.paid.USD ? money({ amount: p.paid.USD, currency: 'USD' }) : ''].filter(Boolean).join(' + ') || '—';
	const sel = all.find((p) => p.key === selPatient);
	const detail = sel ? `
		<section class="card pdetail">
			<button class="linkbtn pdetail__back" data-act="back"><svg class="ic"><use href="#i-left"/></svg>Todos los pacientes</button>
			<h2>${esc(sel.name)}</h2>
			<p class="muted">${esc(sel.phone)}${sel.email ? ` · ${esc(sel.email)}` : ''}</p>
			<div class="d-contact">
				<a class="cbtn" href="tel:+${phoneDigits(sel.phone)}"><svg class="ic"><use href="#i-phone"/></svg>Llamar</a>
				<a class="cbtn" href="https://wa.me/${phoneDigits(sel.phone)}" target="_blank" rel="noopener"><svg class="ic"><use href="#i-wa"/></svg>WhatsApp</a>
				${sel.email ? `<a class="cbtn" href="mailto:${esc(sel.email)}"><svg class="ic"><use href="#i-mail"/></svg>Correo</a>` : ''}
			</div>
			<div class="pstats"><div><b>${sel.visits}</b><span>consultas</span></div><div><b>${sel.lastVisit ? niceDate(sel.lastVisit) : '—'}</b><span>última visita</span></div><div><b>${paidTxt(sel)}</b><span>pagado</span></div></div>
			<h3>Historial</h3>
			${[...sel.list].reverse().map((a) => `<button class="row" data-act="open" data-id="${a.id}"><span class="row__time">${niceDate(a.date)}<br>${fmtTime(a.time)}</span><span class="row__main"><strong>${esc(a.service)}</strong><small>${a.payment ? money(a.payment) : 'Sin pago'}${a.staffNote ? ' · con nota' : ''}</small></span>${chip(a.status)}</button>`).join('')}
		</section>` : '';
	$('#view').innerHTML = `
		<div class="patients${sel ? ' has-sel' : ''}">
			<section class="card plist">
				${list.length ? `<div class="table"><table>
					<thead><tr><th>Paciente</th><th class="hide-sm">Teléfono</th><th class="num">Consultas</th><th class="hide-md">Próxima cita</th><th class="num hide-sm">Pagado</th></tr></thead>
					<tbody>${list.map((p) => `<tr data-act="patient" data-key="${esc(p.key)}" class="${p.key === selPatient ? 'is-sel' : ''}">
						<td><strong>${esc(p.name)}</strong><small class="show-sm">${esc(p.phone)}</small></td><td class="hide-sm">${esc(p.phone)}</td>
						<td class="num">${p.visits}</td><td class="hide-md">${p.next ? `${shortDate(p.next.date)}, ${fmtTime(p.next.time)}` : '—'}</td>
						<td class="num hide-sm">${paidTxt(p)}</td></tr>`).join('')}</tbody></table></div>`
				: `<p class="empty">${q ? 'Ningún paciente coincide con la búsqueda.' : 'Aún no hay pacientes. Aparecerán al recibir la primera cita.'}</p>`}
			</section>
			${detail}
		</div>`;
}

/* =========================================================
   Settings
   ========================================================= */
function renderSettings() {
	const ej = emailReady();
	const perm = 'Notification' in window ? Notification.permission : 'unsupported';
	const hours = [1, 2, 3, 4, 5, 6, 0].map((d) => { const h = C.hours[d]; return `<tr><td>${DAYS[d]}</td><td>${h ? `${fmtTime(String(h[0]).padStart(2, '0') + ':00')} – ${fmtTime(String(h[1]).padStart(2, '0') + ':00')}` : 'Cerrado'}</td></tr>`; }).join('');
	$('#view').innerHTML = `
		<div class="settings">
			<section class="card">
				<header><h2>Correos automáticos</h2><span class="st ${ej ? 'st--completed' : 'st--requested'}">${ej ? 'Activos' : 'Sin configurar'}</span></header>
				<p>${ej ? 'Las confirmaciones, cancelaciones, recordatorios y comprobantes se envían solos por correo cuando el paciente dejó su dirección.' : 'Mientras no se configuren, el panel prepara cada mensaje y usted lo envía con un toque por WhatsApp, SMS o su aplicación de correo.'}</p>
				${ej ? '' : `<ol class="howto">
					<li>Cree una cuenta gratuita en <a href="https://www.emailjs.com" target="_blank" rel="noopener">emailjs.com</a> y conecte el correo de la clínica (Gmail u Outlook) en <b>Email Services</b>.</li>
					<li>En <b>Email Templates</b> cree una plantilla con asunto <code>{{subject}}</code>, destinatario <code>{{to_email}}</code> y cuerpo <code>{{message}}</code>.</li>
					<li>Copie el <b>Public Key</b>, el <b>Service ID</b> y el <b>Template ID</b> en <code>js/config.js</code>, sección <code>emailjs</code>, o envíelos a su desarrollador.</li>
				</ol>`}
			</section>
			<section class="card">
				<header><h2>Avisos de nuevas solicitudes</h2></header>
				<p>Con el panel abierto, cada solicitud nueva suena y aparece arriba a la derecha. ${perm === 'granted' ? 'Los avisos del sistema están activados.' : 'También puede recibir un aviso del sistema aunque esté en otra pestaña.'}</p>
				${perm === 'default' ? '<button class="btn btn--sm btn--ghost" id="askNotif"><svg class="ic"><use href="#i-bell"/></svg>Activar avisos del sistema</button>' : ''}
				${perm === 'denied' ? '<p class="muted">El navegador bloqueó los avisos. Actívelos en la configuración del sitio.</p>' : ''}
			</section>
			<section class="card">
				<header><h2>Mensajes de texto (SMS)</h2></header>
				<p>El botón SMS abre la aplicación de mensajes del iPhone, iPad o Android con el texto listo. El envío totalmente automático de SMS requiere un proveedor de pago (por ejemplo Twilio) y un pequeño servidor; se puede agregar más adelante.</p>
			</section>
			<section class="card">
				<header><h2>Horario de citas</h2></header>
				<table class="simple">${hours}</table>
				<p class="muted">Turnos de ${C.slotMinutes} minutos. El horario se cambia en <code>js/config.js</code>.</p>
			</section>
			<section class="card">
				<header><h2>Instalar en el iPad o celular</h2></header>
				<p>En Safari, toque <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>. La agenda se abrirá como una aplicación.</p>
				<a class="btn btn--sm btn--ghost" href="index.html" target="_blank" rel="noopener">Abrir la web pública</a>
			</section>
		</div>`;
	const ask = $('#askNotif');
	if (ask) ask.addEventListener('click', async () => { await Notification.requestPermission(); renderSettings(); });
}

/* =========================================================
   Live data + session
   ========================================================= */
function onData(snap) {
	appts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
	byId = new Map(appts.map((a) => [a.id, a]));
	const req = appts.filter((a) => a.status === 'requested');
	if (known) {
		req.filter((a) => !known.has(a.id) && a.source !== 'clinic').forEach((a) => {
			const msg = `Nueva solicitud: ${a.name}, ${shortDate(a.date)} a las ${fmtTime(a.time)}`;
			toast(msg, [{ label: 'Ver', onClick: () => openDrawer(a.id) }, { label: 'Confirmar', onClick: () => setStatus(byId.get(a.id), 'scheduled') }], 20000);
			chime();
			if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification('Nueva solicitud de cita', { body: msg, icon: 'assets/logg.png' });
		});
	}
	known = new Set(req.map((a) => a.id));
	$('#banner').hidden = true;
	render();
}

$('#logout').addEventListener('click', () => signOut(auth));
$('#loginForm').addEventListener('submit', async (e) => {
	e.preventDefault();
	$('#loginMsg').textContent = '';
	try { await signInWithEmailAndPassword(auth, $('#l-email').value.trim(), $('#l-pass').value); }
	catch (err) { $('#loginMsg').textContent = 'Correo o contraseña incorrectos.'; }
});
$('#forgot').addEventListener('click', async () => {
	const email = $('#l-email').value.trim();
	if (!email) { $('#loginMsg').textContent = 'Escriba su correo y vuelva a tocar "¿Olvidó su contraseña?".'; return; }
	try { await sendPasswordResetEmail(auth, email); $('#loginMsg').textContent = `Enviamos un enlace para cambiar la contraseña a ${email}.`; }
	catch (err) { $('#loginMsg').textContent = 'No se pudo enviar el enlace. Revise el correo.'; }
});
onAuthStateChanged(auth, (user) => {
	$('#loginView').hidden = !!user;
	$('#appView').hidden = !user;
	$('#who').textContent = user ? user.email : '';
	if (unsub) { unsub(); unsub = null; }
	if (user) { known = null; unsub = onSnapshot(collection(db, 'appointments'), onData, fail); render(); }
	else closeDrawer();
});
setInterval(() => { if (!$('#appView').hidden && !$('dialog[open]')) render(); }, 60000);
