// Patient messages: e-mail (automatic with EmailJS, otherwise the mail app), WhatsApp, SMS.
import { fmtTime, dow } from './agenda-util.js';

const C = window.CLINIC;
const DAYS = { es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
const niceDate = (d) => d.split('-').reverse().join('/');
const money = (p) => (p.currency === 'USD' ? 'US$' : '₡') + Number(p.amount).toLocaleString('es-CR', { minimumFractionDigits: p.currency === 'USD' ? 2 : 0, maximumFractionDigits: 2 });
export { money, niceDate };

export const emailReady = () => !!(C.emailjs && C.emailjs.publicKey && C.emailjs.serviceId && C.emailjs.templateId);

export function phoneDigits(phone) {
	let n = (phone || '').replace(/\D/g, '');
	if (n.length === 8) n = '506' + n;
	return n;
}

/** Build the message for a given kind: confirm | request | cancel | reminder | receipt */
export function compose(kind, a) {
	const en = a.lang === 'en', L = en ? 'en' : 'es';
	const when = en ? `${DAYS.en[dow(a.date)]} ${niceDate(a.date)} at ${fmtTime(a.time)}` : `el ${DAYS.es[dow(a.date)]} ${niceDate(a.date)} a las ${fmtTime(a.time)}`;
	const addr = C.address[L], sign = en ? `\n\n${C.legalName}\n${C.phoneDisplay}` : `\n\n${C.legalName}\n${C.phoneDisplay}`;
	const M = {
		confirm: en
			? [`Appointment confirmed – ${C.legalName}`, `Hello ${a.name},\n\nYour appointment (${a.service}) is confirmed for ${when}.\nAddress: ${addr}\n\nPlease bring your ID and any previous test results. If you cannot come, let us know at least 24 hours before.`]
			: [`Cita confirmada – ${C.legalName}`, `Hola ${a.name}:\n\nSu cita (${a.service}) está confirmada para ${when}.\nDirección: ${addr}\n\nTraiga su identificación y exámenes previos. Si no puede asistir, avísenos con al menos 24 horas.`],
		request: en
			? [`Request received – ${C.legalName}`, `Hello ${a.name},\n\nWe received your appointment request for ${when}. We will confirm it shortly.`]
			: [`Solicitud recibida – ${C.legalName}`, `Hola ${a.name}:\n\nRecibimos su solicitud de cita para ${when}. En breve se la confirmamos.`],
		cancel: en
			? [`Appointment not available – ${C.legalName}`, `Hello ${a.name},\n\nWe are sorry: your appointment for ${when} could not be kept. Please choose another time on our website or reply to this message.`]
			: [`Cita no disponible – ${C.legalName}`, `Hola ${a.name}:\n\nLo sentimos: su cita de ${when} no pudo mantenerse. Por favor elija otro horario en nuestra web o responda este mensaje.`],
		reminder: en
			? [`Reminder: your appointment – ${C.legalName}`, `Hello ${a.name},\n\nThis is a reminder of your appointment ${when}.\nAddress: ${addr}`]
			: [`Recordatorio de su cita – ${C.legalName}`, `Hola ${a.name}:\n\nLe recordamos su cita ${when}.\nDirección: ${addr}`],
		receipt: a.payment ? (en
			? [`Payment receipt ${a.payment.receiptNo} – ${C.legalName}`, `Hello ${a.name},\n\nWe received your payment of ${money(a.payment)} (${a.payment.method}) for ${a.service} on ${niceDate(a.date)}.\nReceipt no.: ${a.payment.receiptNo}\n\nThank you.`]
			: [`Comprobante de pago ${a.payment.receiptNo} – ${C.legalName}`, `Hola ${a.name}:\n\nRecibimos su pago de ${money(a.payment)} (${a.payment.method}) por ${a.service} del ${niceDate(a.date)}.\nComprobante n.º: ${a.payment.receiptNo}\n\nGracias por su visita.`]) : ['', '']
	};
	const [subject, body] = M[kind];
	return { subject, body: body + sign };
}

export const waLink = (a, kind) => `https://wa.me/${phoneDigits(a.phone)}?text=${encodeURIComponent(compose(kind, a).body)}`;
export const smsLink = (a, kind) => `sms:+${phoneDigits(a.phone)}?&body=${encodeURIComponent(compose(kind, a).body)}`;
export const mailLink = (a, kind) => { const m = compose(kind, a); return `mailto:${encodeURIComponent(a.email || '')}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`; };

/** Send an e-mail automatically through EmailJS. Resolves true when sent. */
export async function sendEmail(a, kind) {
	if (!emailReady() || !a.email) return false;
	const m = compose(kind, a);
	const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
		method: 'POST', headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			service_id: C.emailjs.serviceId, template_id: C.emailjs.templateId, user_id: C.emailjs.publicKey,
			template_params: { to_email: a.email, to_name: a.name, subject: m.subject, message: m.body, clinic: C.legalName }
		})
	});
	if (!res.ok) throw new Error('EmailJS ' + res.status);
	return true;
}
