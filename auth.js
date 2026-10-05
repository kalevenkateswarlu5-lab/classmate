import { auth, db, firebaseConfig } from '../firebase/config.js';
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const HOME = { student: 'student-dashboard.html', faculty: 'faculty-dashboard.html', admin: 'admin-dashboard.html' };
export const LOGIN = { student: 'student-login.html', faculty: 'faculty-login.html', admin: 'admin-login.html' };

export async function login(role, email, pw) {
  const { user } = await signInWithEmailAndPassword(auth, email, pw);
  const s = await getDoc(doc(db, 'users', user.uid));
  if (!s.exists() || s.data().role !== role) { await signOut(auth); throw new Error('This account is not a ' + role + ' account.'); }
  location.href = HOME[role];
}
export async function signupStudent(d) {
  const { user } = await createUserWithEmailAndPassword(auth, d.email, d.password);
  const base = { name: d.name, email: d.email, rollNo: d.rollNo, classId: d.classId, createdAt: serverTimestamp() };
  const b = writeBatch(db);
  b.set(doc(db, 'users', user.uid), { ...base, role: 'student' });
  b.set(doc(db, 'students', user.uid), base);
  await b.commit();
  location.href = HOME.student;
}
// Creates the faculty login on a SECOND Firebase app instance so the admin stays signed in.
export async function createFaculty(d) {
  const sec = initializeApp(firebaseConfig, 'sec' + Date.now());
  try {
    const sa = getAuth(sec);
    const { user } = await createUserWithEmailAndPassword(sa, d.email, d.password);
    await signOut(sa);
    const base = { name: d.name, email: d.email, subject: d.subject || '', classIds: d.classIds || [], createdAt: serverTimestamp() };
    const b = writeBatch(db);
    b.set(doc(db, 'users', user.uid), { ...base, role: 'faculty' });
    b.set(doc(db, 'faculty', user.uid), base);
    await b.commit();
  } finally { await deleteApp(sec); }
}
export function requireRole(role) {
  return new Promise(res => {
    const off = onAuthStateChanged(auth, async u => {
      off();
      if (!u) { location.href = LOGIN[role]; return; }
      const s = await getDoc(doc(db, 'users', u.uid));
      if (!s.exists() || s.data().role !== role) { await signOut(auth); location.href = LOGIN[role]; return; }
      res({ user: u, profile: { id: u.uid, ...s.data() } });
    });
  });
}
export async function logout() { await signOut(auth); location.href = 'index.html'; }
