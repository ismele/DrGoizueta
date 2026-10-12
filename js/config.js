/* =====================================================
   Clínica Dr. Goizueta — config.js
   Edit this file to update the whole site.
   ===================================================== */
const CLINIC = {
	whatsapp: '50689829494',            // digits only, with country code
	phoneDisplay: '+506 8982 9494',
	sinpe: '8982 9494',                 // SINPE Móvil number  ← CONFIRM
	address: { es: '[Dirección de la clínica], Costa Rica', en: '[Clinic address], Costa Rica' }, // ← EDIT
	mapsQuery: '',                      // e.g. 'Clínica Dr. Goizueta, Alajuela' — leave '' to hide the map
	// Opening hours, 24h, Costa Rica time. 0 = Sunday. null = closed.   ← CONFIRM
	hours: { 1: [8, 18], 2: [8, 18], 3: [8, 18], 4: [8, 18], 5: [8, 18], 6: [8, 12], 0: null },
	slotMinutes: 30                     // length of each appointment slot
};
window.CLINIC = CLINIC;
