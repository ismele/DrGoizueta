// Public booking: live slot grid + appointment request saved to Firestore.
import { db, collection, doc, query, where, onSnapshot, writeBatch, serverTimestamp } from './firebase.js';
import { slotTimes, fmtTime, isPast, slotId, todayCR, addDays, dow } from './agenda-util.js';

const T = {
	es: { pick: 'Elija primero una fecha.', closed: 'La clínica está cerrada ese día.', none: 'No quedan horarios libres ese día.', loading: 'Cargando horarios…',
		free: 'libre', requested: 'solicitado', scheduled: 'agendado', past: 'no disponible',
		sending: 'Enviando…', ok: 'Solicitud recibida para las {t} del {d}. Queda pendiente hasta que la clínica la confirme.',
		taken: 'Ese horario acaba de ocuparse. Elija otro, por favor.', denied: 'La agenda en línea no está disponible ahora mismo. Escríbanos por WhatsApp para reservar.', loadErr: 'No se pudieron cargar los horarios. Escríbanos por WhatsApp para reservar.', fail: 'No se pudo enviar. Revise su conexión o escríbanos por WhatsApp.',
		wa: 'Avisar también por WhatsApp', today: 'Hoy', tomorrow: 'Mañana', wd: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], mo: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], nxNone: 'No hay horarios libres en los próximos 14 días. Escríbanos por WhatsApp.', nxErr: 'Consulte la disponibilidad por WhatsApp.', nxLoad: 'Buscando horarios…', waMsg: 'Hola, solicité una cita en la web para las {t} del {d}. Mi nombre es {n}.' },
	en: { pick: 'Choose a date first.', closed: 'The clinic is closed that day.', none: 'No free times left that day.', loading: 'Loading times…',
		free: 'free', requested: 'requested', scheduled: 'booked', past: 'unavailable',
		sending: 'Sending…', ok: 'Request received for {t} on {d}. It stays pending until the clinic confirms it.',
		taken: 'That time was just taken. Please choose another.', denied: 'Online booking is not available right now. Please message us on WhatsApp to book.', loadErr: 'Could not load the available times. Please message us on WhatsApp to book.', fail: 'Could not send. Check your connection or message us on WhatsApp.',
		wa: 'Also notify us on WhatsApp', today: 'Today', tomorrow: 'Tomorrow', wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], mo: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], nxNone: 'No free times in the next 14 days. Message us on WhatsApp.', nxErr: 'Ask about availability on WhatsApp.', nxLoad: 'Looking for times…', waMsg: 'Hello, I requested an appointment on the website for {t} on {d}. My name is {n}.' }
};
const t = () => T[window.getLang ? window.getLang() : 'es'];
const fill = (s, v) => s.replace(/\{(\w)\}/g, (_, k) => v[k]);
const niceDate = (d) => d.split('-').reverse().join('/');

const dateEl = document.querySelector('#f-date'), box = document.querySelector('#slots');
const field = document.querySelector('#slotField'), msg = document.querySelector('#formMsg');
let unsub = null, taken = new Map(), picked = null, ready = false, busy = false, loadErr = false, pendingPick = null;

function render() {
	box.textContent = '';
	const hint = (text) => { const p = document.createElement('p'); p.className = 'muted slots__hint'; p.textContent = text; box.appendChild(p); };
	const date = dateEl.value;
	if (!date) return hint(t().pick);
	const times = slotTimes(date);
	if (!times.length) return hint(t().closed);
	if (loadErr) return hint(t().loadErr);
	if (!ready) return hint(t().loading);
	if (picked && (taken.has(picked) || isPast(date, picked))) picked = null;
	let free = 0;
	times.forEach((time) => {
		const st = taken.get(time), past = isPast(date, time);
		const state = st === 'requested' ? 'requested' : st ? 'scheduled' : past ? 'past' : 'free';
		if (state === 'free') free++;
		const b = document.createElement('button');
		b.type = 'button';
		b.className = `slot slot--${state}` + (picked === time ? ' is-picked' : '');
		b.textContent = fmtTime(time);
		b.disabled = state !== 'free';
		b.setAttribute('aria-pressed', String(picked === time));
		b.setAttribute('aria-label', `${fmtTime(time)}, ${t()[state]}`);
		b.addEventListener('click', () => { picked = time; field.classList.remove('is-invalid'); render(); });
		box.appendChild(b);
	});
	if (!free) hint(t().none);
}

function watch() {
	if (unsub) { unsub(); unsub = null; }
	taken = new Map(); picked = null; ready = false; loadErr = false;
	const date = dateEl.value;
	render();
	if (!date || !slotTimes(date).length) return;
	unsub = onSnapshot(query(collection(db, 'slots'), where('date', '==', date)), (snap) => {
		taken = new Map(snap.docs.map((d) => [d.data().time, d.data().status]));
		if (pendingPick && !taken.has(pendingPick) && !isPast(date, pendingPick)) picked = pendingPick;
		pendingPick = null;
		ready = true; loadErr = false; render();
	}, (e) => { console.error('Could not load slots:', e && e.code, e); loadErr = true; render(); });
}

async function submit(data) {
	if (busy) return;
	if (!picked) { field.classList.add('is-invalid'); box.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
	const time = picked, id = slotId(data.date, time);
	busy = true; msg.className = 'form__msg'; msg.textContent = t().sending;
	try {
		const batch = writeBatch(db);
		batch.set(doc(db, 'slots', id), { date: data.date, time, status: 'requested' });
		batch.set(doc(collection(db, 'appointments')), {
			slotId: id, date: data.date, time, status: 'requested',
			name: data.name, phone: data.phone, ...(data.email ? { email: data.email } : {}), service: data.service, first: data.first, note: data.note, lang: data.lang,
			createdAt: serverTimestamp()
		});
		await batch.commit();
		const v = { d: niceDate(data.date), t: fmtTime(time), n: data.name };
		msg.textContent = fill(t().ok, v) + ' ';
		const a = document.createElement('a');
		a.href = window.waLink(fill(T.es.waMsg, v)); a.target = '_blank'; a.rel = 'noopener'; a.textContent = t().wa;
		msg.appendChild(a);
		picked = null;
		['#f-note'].forEach((s) => (document.querySelector(s).value = ''));
		render();
	} catch (e) {
		msg.className = 'form__msg is-error';
		const code = e && e.code;
		console.error('Booking failed:', code, e);
		// A real clash means the slot now shows as taken; otherwise the database refused the write (rules not published or misconfigured).
		msg.textContent = code === 'permission-denied' ? (taken.has(time) ? t().taken : t().denied) : t().fail;
	}
	busy = false;
}

/* ---------- Hero: next free times (live) ---------- */
const nextBox = document.querySelector('#nextSlots');
let nextTaken = null, nextErr = false;
function dayLabel(d) {
	const today = todayCR();
	if (d === today) return t().today;
	if (d === addDays(today, 1)) return t().tomorrow;
	const [, m, dd] = d.split('-').map(Number);
	return `${t().wd[dow(d)]} ${dd} ${t().mo[m - 1]}`;
}
function renderNext() {
	if (!nextBox) return;
	nextBox.textContent = '';
	const note = (text) => { const p = document.createElement('p'); p.className = 'next__note'; p.textContent = text; nextBox.appendChild(p); };
	if (nextErr) return note(t().nxErr);
	if (!nextTaken) return note(t().nxLoad);
	const today = todayCR(), groups = [];
	let count = 0;
	for (let i = 0; i < 14 && count < 6; i++) {
		const d = addDays(today, i);
		const free = slotTimes(d).filter((tm) => !nextTaken.has(slotId(d, tm)) && !isPast(d, tm));
		if (!free.length) continue;
		const take = free.slice(0, Math.min(3, 6 - count));
		count += take.length;
		groups.push([d, take]);
	}
	if (!groups.length) return note(t().nxNone);
	groups.forEach(([d, times]) => {
		const row = document.createElement('div'); row.className = 'next__day';
		const lab = document.createElement('span'); lab.className = 'next__label'; lab.textContent = dayLabel(d);
		const chips = document.createElement('div'); chips.className = 'next__chips';
		times.forEach((tm) => {
			const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = fmtTime(tm);
			b.addEventListener('click', () => {
				pendingPick = tm; dateEl.value = d; dateEl.dispatchEvent(new Event('change'));
				document.querySelector('#citas').scrollIntoView({ behavior: 'smooth' });
			});
			chips.appendChild(b);
		});
		row.append(lab, chips); nextBox.appendChild(row);
	});
}
if (nextBox) {
	const from = todayCR();
	onSnapshot(query(collection(db, 'slots'), where('date', '>=', from), where('date', '<=', addDays(from, 14))), (snap) => {
		nextTaken = new Set(snap.docs.map((d) => d.id)); nextErr = false; renderNext();
	}, () => { nextErr = true; renderNext(); });
}

dateEl.addEventListener('change', watch);
document.addEventListener('langchange', () => { render(); renderNext(); });
setInterval(() => { render(); renderNext(); }, 60000);
renderNext();
window.BOOKING = { submit };
render();
