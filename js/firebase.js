// Firebase connection (project: drgoizueta). These keys are public by design;
// the data is protected by firestore.rules.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, doc, query, where, onSnapshot, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const app = initializeApp({
	apiKey: 'AIzaSyCOFq1QYbvmbR4YBb8cgFCTPl4__pxxiqk',
	authDomain: 'drgoizueta.firebaseapp.com',
	projectId: 'drgoizueta',
	storageBucket: 'drgoizueta.firebasestorage.app',
	messagingSenderId: '166824336555',
	appId: '1:166824336555:web:ad28982c0b27a454afabee'
});
export const db = getFirestore(app);
export const auth = getAuth(app);
export { collection, doc, query, where, onSnapshot, writeBatch, serverTimestamp, signInWithEmailAndPassword, signOut, onAuthStateChanged };
