/* =====================================================
   Clínica Dr. Goizueta — main.js
   Settings are in js/config.js.
   ===================================================== */
/* CLINIC settings live in js/config.js */

/* ---------- English texts (Spanish lives in index.html) ---------- */
const EN = {
	'skip': 'Skip to content',
	'brand.sub': 'Medical clinic',
	'nav.services': 'Services', 'nav.doctor': 'The doctor', 'nav.appt': 'Appointments', 'nav.pay': 'Payments', 'nav.loc': 'Location', 'nav.faq': 'FAQ',
	'cta.book': 'Book appointment', 'cta.wa': 'Message us on WhatsApp',
	'hero.eyebrow': 'General and family medicine in Costa Rica',
	'nx.h': 'Next available times', 'nx.live': 'Live', 'nx.all': 'See all times', 'nx.fb': 'Ask about availability on WhatsApp.',
	'hero.lead': 'Health comes first for everyone. At the Cuban doctor\'s clinic you get close, professional, unhurried care — in Spanish or English.',
	'hero.alt': 'Portraits of patients of all ages',
	'chip.1': 'Spanish & English', 'chip.2': 'Booking by WhatsApp', 'chip.3': 'SINPE Móvil, card or cash',
	'em.t': 'Emergency?', 'em.p': 'If your life is in danger, call <a href="tel:911">9-1-1</a> or go to the nearest hospital. This clinic does not handle emergencies.',
	'sv.eyebrow': 'Made for the family', 'sv.h': 'Our services',
	'sv.p': 'We see you promptly and professionally, so you and your family can trust the quality of your care.',
	'sv.1.t': 'General consultation', 'sv.1.p': 'Assessment, diagnosis and treatment for adults, with prescription and follow-up.',
	'sv.2.t': 'Family medicine', 'sv.2.p': 'Care for children, adults and seniors in one place.',
	'sv.3.t': 'Chronic condition care', 'sv.3.p': 'Follow-up for blood pressure, diabetes, cholesterol and other conditions.',
	'sv.4.t': 'Wound care & minor procedures', 'sv.4.p': 'Wound dressing, stitches, suture removal and ear cleaning.',
	'sv.5.t': 'Injections & vital signs', 'sv.5.p': 'Administration of prescribed medication, blood sugar and blood pressure checks.',
	'sv.6.t': 'Medical certificates', 'sv.6.p': 'Driver\'s licence medical exam (dictamen), health certificates for work or school.',
	'sv.7.t': 'Telemedicine', 'sv.7.p': 'Video consultation for follow-ups, results and questions.',
	'sv.8.t': 'Home visits', 'sv.8.p': 'Care at your home or hotel when you cannot travel.',
	'sv.note': 'Don\'t see what you need? Message us and we\'ll gladly guide you.',
	'dr.eyebrow': 'Meet your doctor', 'dr.h': 'A doctor who listens',
	'dr.p1': 'Dr. Goizueta is a Cuban physician practising in Costa Rica. His approach is simple: time to listen, clear explanations and a plan you understand.',
	'dr.p2': '[Add the doctor\'s training, years of experience and specialties here.]',
	'dr.l1': 'Registered with the Costa Rican College of Physicians and Surgeons — licence [MED-0000]',
	'dr.l2': 'Care in Spanish and English', 'dr.l3': 'Prescriptions, referrals and receipts for your insurer',
	'ap.eyebrow': 'Appointments', 'ap.h': 'Book your visit in one minute',
	'ap.p': 'Pick a free time and send your request. It shows in yellow until the clinic confirms it; then it turns blue and we message you on WhatsApp or email.',
	'ap.s1t': 'Send your request', 'ap.s1p': 'Choose a service, a day and a free time.',
	'ap.s2t': 'Get your confirmation', 'ap.s2p': 'We reply with the exact time.',
	'ap.s3t': 'Come to your visit', 'ap.s3p': 'Bring your ID and any previous test results.',
	'ap.cancel': 'If you can\'t make it, please let us know at least 24 hours ahead so another patient can take the slot.',
	'f.name': 'Full name', 'f.phone': 'Phone / WhatsApp', 'f.email': 'Email', 'e.email': 'Check the email address.', 'f.service': 'Service', 'f.choose': 'Select…',
	'f.date': 'Date', 'f.slot': 'Available times', 'lg.free': 'Free', 'lg.req': 'Requested', 'lg.sch': 'Booked',
	'f.patient': 'Is this your first visit?', 'f.yes': 'Yes', 'f.no': 'No',
	'f.note': 'Reason for visit', 'f.opt': '(optional)',
	'f.consent': 'I agree that the clinic may use this information to manage my appointment.',
	'f.send': 'Request appointment',
	'e.name': 'Please enter your name.', 'e.phone': 'Please enter a valid phone number.', 'e.service': 'Please choose a service.',
	'e.date': 'Choose a date when the clinic is open.', 'e.slot': 'Choose a free time.', 'e.ok': 'You must agree to continue.',
	'pay.eyebrow': 'Payments', 'pay.h': 'Payment methods',
	'pay.p': 'Payment is made on the day of your visit. We issue an electronic invoice and a receipt for your insurer.',
	'pay.sinpe': 'Transfer from your bank app to:', 'pay.copy': 'Copy', 'pay.sinpe2': 'Send the receipt by WhatsApp.',
	'pay.card.t': 'Card', 'pay.card.p': 'Visa and Mastercard debit and credit at the clinic.',
	'pay.cash.t': 'Cash', 'pay.cash.p': 'Colones (₡) or US dollars at the day\'s exchange rate.',
	'pay.bank.t': 'Bank transfer', 'pay.bank.p': 'Bank transfer (IBAN). Ask for the account details on WhatsApp.',
	'pay.ins.t': 'Insurance', 'pay.ins.p': 'We give you an invoice and medical report so you can claim reimbursement from your local or international insurer.',
	'pay.price': 'Want to know what a visit costs?', 'pay.ask': 'Ask for fees on WhatsApp',
	'loc.h': 'Location and hours', 'loc.hours': 'Opening hours',
	'loc.tz': 'Costa Rica time (GMT-6). Public holidays: ask on WhatsApp.',
	'faq.h': 'Frequently asked questions',
	'faq.1q': 'Do I need an appointment or can I walk in?', 'faq.1a': 'We recommend booking so you don\'t wait. Walk-ins are seen subject to availability.',
	'faq.2q': 'Do you see patients in English?', 'faq.2a': 'Yes. The visit, instructions and documents can be in Spanish or English.',
	'faq.3q': 'What should I bring?', 'faq.3a': 'Your cédula, DIMEX or passport, a list of the medication you take, and any previous tests or prescriptions.',
	'faq.4q': 'Do you see tourists and foreigners?', 'faq.4a': 'Yes. We provide an invoice and medical report for your travel insurance.',
	'faq.5q': 'How does telemedicine work?', 'faq.5a': 'Book like any appointment, pay by SINPE Móvil or transfer, and get the video-call link on WhatsApp.',
	'faq.6q': 'Do you issue electronic invoices?', 'faq.6a': 'Yes — just tell us the name and email to send it to.',
	'cta.h': 'Your health, in good hands', 'cta.p': 'Stay connected and get in touch.',
	'ft.tag': 'General and family medicine in Costa Rica.', 'ft.links': 'Links', 'ft.contact': 'Contact', 'ft.staff': 'Clinic access',
	'ft.rights': 'All rights reserved.', 'ft.disc': 'The information on this site is for guidance only and does not replace a medical consultation.'
};

/* ---------- UI strings generated by JS ---------- */
const UI = {
	es: { days: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], closed: 'Cerrado', open: 'Abierto ahora', shut: 'Cerrado ahora', until: 'hasta las', copied: '¡Copiado!', sent: 'Se abrió WhatsApp. Pulse "Enviar" para completar su solicitud.' },
	en: { days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], closed: 'Closed', open: 'Open now', shut: 'Closed now', until: 'until', copied: 'Copied!', sent: 'WhatsApp opened. Tap "Send" to complete your request.' }
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
document.documentElement.classList.add('js');
let lang = 'es';

/* ---------- Helpers ---------- */
const waLink = (msg) => `https://wa.me/${CLINIC.whatsapp}${msg ? '?text=' + encodeURIComponent(msg) : ''}`;
window.waLink = waLink;
const crNow = () => new Date(Date.now() - 6 * 3600 * 1000); // read with getUTC*()
const fmtHour = (h) => {
	const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
	const s = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`;
	return `${s} ${hh < 12 ? 'a.m.' : 'p.m.'}`;
};

/* ---------- Language ---------- */
function setLang(l) {
	lang = l === 'en' ? 'en' : 'es';
	document.documentElement.lang = lang;
	$$('[data-i18n]').forEach((el) => {
		if (el.dataset.es === undefined) el.dataset.es = el.innerHTML;
		el.innerHTML = lang === 'en' ? (EN[el.dataset.i18n] ?? el.dataset.es) : el.dataset.es;
	});
	$$('[data-i18n-alt]').forEach((el) => {
		if (el.dataset.esAlt === undefined) el.dataset.esAlt = el.alt || 'Retratos de pacientes de todas las edades';
		el.alt = lang === 'en' ? EN[el.dataset.i18nAlt] : el.dataset.esAlt;
	});
	$$('.lang__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
	$$('[data-cfg="address"]').forEach((el) => (el.textContent = CLINIC.address[lang]));
	fillWaLinks();
	renderHours();
	try { localStorage.setItem('lang', lang); } catch (e) { /* ignore */ }
	document.dispatchEvent(new CustomEvent('langchange'));
}
window.getLang = () => lang;

/* ---------- Config → DOM ---------- */
function fillConfig() {
	$$('[data-cfg="phoneDisplay"]').forEach((el) => (el.textContent = CLINIC.phoneDisplay));
	$$('[data-cfg="sinpe"]').forEach((el) => (el.textContent = CLINIC.sinpe));
	$$('[data-cfg-tel]').forEach((el) => (el.href = 'tel:+' + CLINIC.whatsapp));
	$('#year').textContent = crNow().getUTCFullYear();
	if (CLINIC.mapsQuery) {
		const q = encodeURIComponent(CLINIC.mapsQuery);
		$('#gmaps').href = 'https://www.google.com/maps/search/?api=1&query=' + q;
		$('#waze').href = 'https://waze.com/ul?q=' + q + '&navigate=yes';
		$('#mapFrame').src = 'https://www.google.com/maps?q=' + q + '&output=embed';
		$('#mapLinks').hidden = false;
		$('#mapWrap').hidden = false;
	}
}
function fillWaLinks() {
	const hello = lang === 'en' ? 'Hello, I would like some information.' : 'Hola, quisiera información.';
	const price = lang === 'en' ? 'Hello, could you tell me your consultation fees?' : 'Hola, ¿me puede indicar las tarifas de consulta?';
	$$('[data-cfg-wa]').forEach((el) => (el.href = waLink(el.dataset.cfgWa === 'price' ? price : hello)));
}

/* ---------- Hours + open-now ---------- */
function renderHours() {
	const t = UI[lang], now = crNow(), today = now.getUTCDay();
	const body = $('#hoursTable tbody');
	body.innerHTML = '';
	[1, 2, 3, 4, 5, 6, 0].forEach((d) => {
		const h = CLINIC.hours[d];
		const tr = document.createElement('tr');
		if (d === today) tr.className = 'is-today';
		tr.innerHTML = `<td>${t.days[d]}</td><td>${h ? fmtHour(h[0]) + ' – ' + fmtHour(h[1]) : t.closed}</td>`;
		body.appendChild(tr);
	});
	const h = CLINIC.hours[today], cur = now.getUTCHours() + now.getUTCMinutes() / 60;
	const open = !!h && cur >= h[0] && cur < h[1];
	$('#openDot').classList.toggle('is-open', open);
	$('#openText').textContent = open ? `${t.open} · ${t.until} ${fmtHour(h[1])}` : t.shut;
}

/* ---------- Navigation ---------- */
function initNav() {
	const burger = $('#burger'), nav = $('#nav');
	const close = () => { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); };
	burger.addEventListener('click', () => {
		const open = nav.classList.toggle('is-open');
		burger.setAttribute('aria-expanded', String(open));
	});
	nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
	document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

	if (!('IntersectionObserver' in window)) { $$('.reveal').forEach((el) => el.classList.add('is-in')); return; }
	const links = $$('.nav a[href^="#"]:not(.btn)');
	const spy = new IntersectionObserver((entries) => {
		entries.forEach((en) => {
			if (en.isIntersecting) links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
		});
	}, { rootMargin: '-45% 0px -50% 0px' });
	$$('main section[id]').forEach((s) => spy.observe(s));

	const rev = new IntersectionObserver((entries) => {
		entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); rev.unobserve(en.target); } });
	}, { threshold: 0.12 });
	$$('.reveal').forEach((el) => rev.observe(el));
}

/* ---------- Appointment form → WhatsApp ---------- */
function initForm() {
	const form = $('#apptForm'), date = $('#f-date');
	const iso = (d) => d.toISOString().slice(0, 10);
	const now = crNow();
	date.min = iso(now);
	const max = new Date(now); max.setUTCDate(max.getUTCDate() + 90);
	date.max = iso(max);

	const dateOk = () => {
		if (!date.value || date.value < date.min || date.value > date.max) return false;
		const dow = new Date(date.value + 'T12:00:00Z').getUTCDay();
		return !!CLINIC.hours[dow];
	};
	const mark = (input, ok) => { input.closest('.field').classList.toggle('is-invalid', !ok); return ok; };
	const check = (input) => mark(input, input === date ? dateOk() : input.checkValidity());

	['#f-name', '#f-phone', '#f-email', '#f-service', '#f-date'].forEach((id) => {
		const el = $(id);
		el.addEventListener('blur', () => check(el));
		el.addEventListener('change', () => check(el));
	});

	form.addEventListener('submit', (e) => {
		e.preventDefault();
		const inputs = ['#f-name', '#f-phone', '#f-email', '#f-service', '#f-date'].map((id) => $(id));
		const bad = inputs.filter((el) => !check(el));
		const ok = $('#f-ok').checked;
		$('#okErr').classList.toggle('is-shown', !ok);
		if (bad.length || !ok) { (bad[0] || $('#f-ok')).focus(); return; }

		const sv = $('#f-service').selectedOptions[0];
		const note = $('#f-note').value.trim();
		const data = {
			name: $('#f-name').value.trim(), phone: $('#f-phone').value.trim(), email: $('#f-email').value.trim(),
			service: sv.dataset.es || sv.textContent, date: date.value,
			first: form.elements.first.value, note, lang
		};
		// Live agenda (js/booking.js). If it could not load, fall back to WhatsApp.
		if (window.BOOKING) { window.BOOKING.submit(data); return; }
		const [y, m, d] = date.value.split('-');
		const dow = new Date(date.value + 'T12:00:00Z').getUTCDay();
		const msg = [
			'*Solicitud de cita* 🩺',
			`*Nombre:* ${data.name}`,
			`*Teléfono:* ${data.phone}`,
			`*Servicio:* ${data.service}`,
			`*Fecha:* ${UI.es.days[dow]} ${d}/${m}/${y}`,
			`*Primera visita:* ${data.first}`,
			note ? `*Motivo:* ${note}` : '',
			lang === 'en' ? '*Idioma preferido:* inglés / English' : ''
		].filter(Boolean).join('\n');
		window.open(waLink(msg), '_blank', 'noopener');
		$('#formMsg').textContent = UI[lang].sent;
	});
}

/* ---------- Copy SINPE number ---------- */
function initCopy() {
	const btn = $('#copySinpe');
	btn.addEventListener('click', async () => {
		const text = CLINIC.sinpe.replace(/\s/g, '');
		try { await navigator.clipboard.writeText(text); }
		catch (e) {
			const ta = document.createElement('textarea');
			ta.value = text; document.body.appendChild(ta); ta.select();
			try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
			ta.remove();
		}
		const label = lang === 'en' ? EN['pay.copy'] : btn.dataset.es;
		btn.textContent = UI[lang].copied;
		setTimeout(() => (btn.textContent = label), 1800);
	});
}

/* ---------- Start ---------- */
document.addEventListener('DOMContentLoaded', () => {
	fillConfig();
	initNav();
	initForm();
	initCopy();
	$$('.lang__btn').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
	let saved = null;
	try { saved = localStorage.getItem('lang'); } catch (e) { /* ignore */ }
	setLang(saved || ((navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es'));
	setInterval(renderHours, 60000);
});
