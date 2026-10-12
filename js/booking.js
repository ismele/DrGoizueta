// Public booking: live slot grid + appointment request saved to Firestore.
import { db, collection, doc, query, where, onSnapshot, writeBatch, serverTimestamp } from './firebase.js';
import { slotTimes, fmtTime, isPast, slotId } from './agenda-util.js';

const T = {
	es: { pick: 'Elija primero una fecha.', closed: 'La clínica está cerrada ese día.', none: 'No quedan horarios libres ese día.', loading: 'Cargando horarios…',
		free: 'libre', requested: 'solicitado', scheduled: 'agendado', past: 'no disponible',
		sending: 'Enviando…', ok: 'Solicitud recibida para las {t} del {d}. Queda pendiente hasta que la clínica la confirme.',
		taken: 'Ese horario acaba de ocuparse. Elija otro, por favor.', fail: 'No se pudo enviar. Revise su conexión o escríbanos por WhatsApp.',
		wa: 'Avisar también por WhatsApp', waMsg: 'Hola, solicité una cita en la web para las {t} del {d}. Mi nombre es {n}.' },
	en: { pick: 'Choose a date first.', closed: 'The clinic is closed that day.', none: 'No free times left that day.', loading: 'Loading times…',
		free: 'free', requested: 'requested', scheduled: 'booked', past: 'unavailable',
		sending: 'Sending…', ok: 'Request received for {t} on {d}. It stays pending until the clinic confirms it.',
		taken: 'That time was just taken. Please choose another.', fail: 'Could not send. Check your connection or message us on WhatsApp.',
		wa: 'Also notify us on WhatsApp', waMsg: 'Hello, I requested an appointment on the website for {t} on {d}. My name is {n}.' }
};
const t = () => T[window.getLang ? window.getLang() : 'es'];
const fill = (s, v) => s.replace(/\{(\w)\}/g, (_, k) => v[k]);
const niceDate = (d) => d.split('-').reverse().join('/');

const dateEl = document.querySelector('#f-date'), box = document.querySelector('#slots');
const field = document.querySelector('#slotField'), msg = document.querySelector('#formMsg');
let unsub = null, taken = new Map(), picked = null, ready = false, busy = false;

function render() {
	box.textContent = '';
	const hint = (text) => { const p = document.createElement('p'); p.className = 'muted slots__hint'; p.textContent = text; box.appendChild(p); };
	const date = dateEl.value;
	if (!date) return hint(t().pick);
	const times = slotTimes(date);
	if (!times.length) return hint(t().closed);
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
	taken = new Map(); picked = null; ready = false;
	const date = dateEl.value;
	render();
	if (!date || !slotTimes(date).length) return;
	unsub = onSnapshot(query(collection(db, 'slots'), where('date', '==', date)), (snap) => {
		taken = new Map(snap.docs.map((d) => [d.data().time, d.data().status]));
		ready = true; render();
	}, () => { ready = true; render(); });
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
			name: data.name, phone: data.phone, service: data.service, first: data.first, note: data.note, lang: data.lang,
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
		msg.textContent = e && e.code === 'permission-denied' ? t().taken : t().fail;
	}
	busy = false;
}

dateEl.addEventListener('change', watch);
document.addEventListener('langchange', render);
setInterval(render, 60000);
window.BOOKING = { submit };
render();
