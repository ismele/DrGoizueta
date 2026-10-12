// Shared helpers for the public booking form and the clinic panel.
export const C = window.CLINIC;
const pad = (n) => String(n).padStart(2, '0');
export const crNow = () => new Date(Date.now() - 6 * 3600 * 1000); // Costa Rica time, read as UTC
export const todayCR = () => crNow().toISOString().slice(0, 10);
export const dow = (date) => new Date(date + 'T12:00:00Z').getUTCDay();
export const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export function slotTimes(date) {
	const h = C.hours[dow(date)];
	if (!h) return [];
	const step = C.slotMinutes || 30, out = [];
	for (let m = h[0] * 60; m + step <= h[1] * 60; m += step) out.push(pad(Math.floor(m / 60)) + ':' + pad(m % 60));
	return out;
}
export const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'a.m.' : 'p.m.'}`; };
export const isPast = (date, t) => `${date} ${t}` <= crNow().toISOString().slice(0, 16).replace('T', ' ');
export const slotId = (date, t) => `${date}_${t}`;
