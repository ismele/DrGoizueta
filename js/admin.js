// Clinic panel: live agenda with status colours. Requires sign-in.
import { db, auth, collection, doc, query, where, onSnapshot, writeBatch, serverTimestamp, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase.js';
import { slotTimes, fmtTime, todayCR, addDays, dow, slotId } from './agenda-util.js';

const $ = (s) => document.querySelector(s);
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const LABEL = { requested: 'Solicitada', scheduled: 'Agendada', completed: 'Completada', cancelled: 'Cancelada' };
const niceDate = (d) => d.split('-').reverse().join('/');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

let day = todayCR(), dayAppts = [], pending = [], unsubDay = null, unsubPend = null, newTime = null;

function fail(e) {
	const b = $('#banner');
	b.textContent = e && e.code === 'permission-denied'
		? 'Este usuario no tiene permiso para ver la agenda. Revise que su correo esté en las reglas de Firestore.'
		: 'No se pudo completar la acción. Revise la conexión e intente de nuevo.';
	b.hidden = false;
}
const clearFail = () => ($('#banner').hidden = true);

/* ---------- WhatsApp to the patient ---------- */
function waPatient(a) {
	let n = (a.phone || '').replace(/\D/g, '');
	if (n.length === 8) n = '506' + n;
	const when = `las ${fmtTime(a.time)} del ${DAYS[dow(a.date)].toLowerCase()} ${niceDate(a.date)}`;
	const whenEn = `${fmtTime(a.time)} on ${niceDate(a.date)}`;
	const en = a.lang === 'en';
	const text = a.status === 'cancelled'
		? (en ? `Hello ${a.name}, we are sorry: your appointment at ${whenEn} could not be scheduled. Please choose another time on our website.` : `Hola ${a.name}, lo sentimos: su cita de ${when} no pudo agendarse. Por favor elija otro horario en nuestra web.`)
		: a.status === 'requested'
			? (en ? `Hello ${a.name}, we received your appointment request for ${whenEn}.` : `Hola ${a.name}, recibimos su solicitud de cita para ${when}.`)
			: (en ? `Hello ${a.name}, your appointment with Dr. Goizueta is confirmed for ${whenEn} (${a.service}).` : `Hola ${a.name}, su cita con el Dr. Goizueta está confirmada para ${when} (${a.service}).`);
	return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/* ---------- Status changes ---------- */
async function setStatus(a, status) {
	if (status === 'cancelled' && !confirm(`¿Cancelar la cita de ${a.name} (${fmtTime(a.time)})? El horario quedará libre.`)) return;
	clearFail();
	try {
		const batch = writeBatch(db);
		batch.update(doc(db, 'appointments', a.id), { status, updatedAt: serverTimestamp() });
		if (status === 'cancelled') batch.delete(doc(db, 'slots', a.slotId));
		else batch.set(doc(db, 'slots', a.slotId), { date: a.date, time: a.time, status });
		await batch.commit();
	} catch (e) { fail(e); }
}

function card(a, withDate) {
	const c = el('div', `appt appt--${a.status}`);
	const head = el('div', 'appt__head');
	head.append(el('strong', '', a.name), el('span', `pill pill--${a.status}`, LABEL[a.status]));
	if (withDate) head.append(el('span', 'muted', `${niceDate(a.date)} · ${fmtTime(a.time)}`));
	const meta = el('div', 'appt__meta');
	meta.append(el('span', '', `${a.service} · ${a.phone}${a.first === 'Sí' ? ' · primera visita' : ''}${a.lang === 'en' ? ' · inglés' : ''}`));
	if (a.note) meta.append(el('span', '', `Motivo: ${a.note}`));
	const acts = el('div', 'appt__acts');
	const btn = (label, cls, status) => { const b = el('button', `btn btn--sm ${cls}`, label); b.type = 'button'; b.addEventListener('click', (ev) => { ev.stopPropagation(); setStatus(a, status); }); acts.append(b); };
	if (a.status === 'requested') btn('Confirmar', 'btn--ok', 'scheduled');
	if (a.status === 'scheduled') btn('Completar', 'btn--done', 'completed');
	if (a.status === 'completed') btn('Reabrir', 'btn--ok', 'scheduled');
	if (a.status === 'requested' || a.status === 'scheduled') btn('Cancelar', 'btn--no', 'cancelled');
	const w = el('a', 'btn btn--sm btn--ghost', 'WhatsApp'); w.href = waPatient(a); w.target = '_blank'; w.rel = 'noopener';
	w.addEventListener('click', (ev) => ev.stopPropagation());
	acts.append(w);
	c.append(head, meta, acts);
	return c;
}

/* ---------- Day agenda ---------- */
function renderDay() {
	$('#day').value = day;
	$('#dayName').textContent = `${DAYS[dow(day)]} ${niceDate(day)}`;
	const active = new Map(dayAppts.filter((a) => a.status !== 'cancelled').map((a) => [a.time, a]));
	const counts = $('#counts'); counts.textContent = '';
	['requested', 'scheduled', 'completed', 'cancelled'].forEach((s) => {
		const n = dayAppts.filter((a) => a.status === s).length;
		if (n) counts.append(el('span', `pill pill--${s}`, `${n} ${LABEL[s].toLowerCase()}${n > 1 ? 's' : ''}`));
	});
	const box = $('#agenda'); box.textContent = '';
	const times = [...new Set([...slotTimes(day), ...active.keys()])].sort();
	if (!times.length) box.append(el('p', 'muted', 'La clínica está cerrada este día.'));
	times.forEach((t) => {
		const row = el('div', 'arow');
		row.append(el('div', 'arow__time', fmtTime(t)));
		const a = active.get(t);
		if (a) row.append(card(a));
		else {
			const free = el('div', 'arow__free'); free.append(el('span', '', 'Libre'));
			const b = el('button', 'btn btn--sm btn--ghost', '+ Agendar'); b.type = 'button';
			b.addEventListener('click', () => openNew(t));
			free.append(b); row.append(free);
		}
		box.append(row);
	});
	dayAppts.filter((a) => a.status === 'cancelled').sort((x, y) => x.time.localeCompare(y.time)).forEach((a) => {
		const row = el('div', 'arow'); row.append(el('div', 'arow__time', fmtTime(a.time)), card(a)); box.append(row);
	});
}
function watchDay() {
	if (unsubDay) unsubDay();
	dayAppts = []; renderDay();
	unsubDay = onSnapshot(query(collection(db, 'appointments'), where('date', '==', day)), (snap) => {
		dayAppts = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderDay();
	}, fail);
}
function goto(d) { if (d) { day = d; watchDay(); } }

/* ---------- Pending requests (all dates) ---------- */
function renderPending() {
	$('#pendCount').textContent = pending.length;
	const box = $('#pending'); box.textContent = '';
	if (!pending.length) return box.append(el('p', 'muted', 'No hay solicitudes pendientes.'));
	pending.forEach((a) => { const c = card(a, true); c.title = 'Ver ese día'; c.addEventListener('click', () => goto(a.date)); box.append(c); });
}
function watchPending() {
	if (unsubPend) unsubPend();
	unsubPend = onSnapshot(query(collection(db, 'appointments'), where('status', '==', 'requested')), (snap) => {
		pending = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
		renderPending();
	}, fail);
}

/* ---------- New appointment by the clinic ---------- */
function openNew(t) {
	newTime = t;
	$('#newTitle').textContent = `Agendar ${niceDate(day)} · ${fmtTime(t)}`;
	$('#newForm').reset();
	$('#newDlg').showModal();
}
$('#newCancel').addEventListener('click', () => $('#newDlg').close());
$('#newForm').addEventListener('submit', async (e) => {
	e.preventDefault();
	const id = slotId(day, newTime);
	clearFail();
	try {
		const batch = writeBatch(db);
		batch.set(doc(db, 'slots', id), { date: day, time: newTime, status: 'scheduled' });
		batch.set(doc(collection(db, 'appointments')), {
			slotId: id, date: day, time: newTime, status: 'scheduled',
			name: $('#n-name').value.trim(), phone: $('#n-phone').value.trim(), service: $('#n-service').value,
			first: 'No', note: $('#n-note').value.trim(), lang: 'es', createdAt: serverTimestamp()
		});
		await batch.commit();
	} catch (err) { fail(err); }
	$('#newDlg').close();
});

/* ---------- Navigation + session ---------- */
$('#prev').addEventListener('click', () => goto(addDays(day, -1)));
$('#next').addEventListener('click', () => goto(addDays(day, 1)));
$('#today').addEventListener('click', () => goto(todayCR()));
$('#day').addEventListener('change', (e) => goto(e.target.value));
$('#logout').addEventListener('click', () => signOut(auth));
$('#loginForm').addEventListener('submit', async (e) => {
	e.preventDefault();
	$('#loginMsg').textContent = '';
	try { await signInWithEmailAndPassword(auth, $('#l-email').value.trim(), $('#l-pass').value); }
	catch (err) { $('#loginMsg').textContent = 'Correo o contraseña incorrectos.'; }
});
onAuthStateChanged(auth, (user) => {
	$('#loginView').hidden = !!user;
	$('#appView').hidden = !user;
	$('#logout').hidden = !user;
	$('#who').textContent = user ? user.email : '';
	if (user) { clearFail(); watchDay(); watchPending(); }
	else { if (unsubDay) unsubDay(); if (unsubPend) unsubPend(); unsubDay = unsubPend = null; }
});
