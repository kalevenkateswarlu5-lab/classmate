import { login, signupStudent } from './auth.js';
import { toast, friendly } from './ui.js';
import { db } from '../firebase/config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const role = document.body.dataset.role;
function wire(form, label, action) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Please wait';
    try { await action(Object.fromEntries(new FormData(form))); }
    catch (err) { toast(friendly(err), 'danger'); btn.disabled = false; btn.textContent = label; }
  });
}
const lf = document.getElementById('loginForm');
if (lf) wire(lf, 'Sign in', d => login(role, d.email.trim(), d.password));
const sf = document.getElementById('signupForm');
if (sf) {
  getDocs(collection(db, 'classes')).then(s => {
    sf.classId.innerHTML = '<option value="">Select your class</option>' + s.docs.map(d => '<option value="' + d.id + '">' + d.data().name + '</option>').join('');
  }).catch(e => toast(friendly(e), 'danger'));
  wire(sf, 'Create account', d => signupStudent({ ...d, name: d.name.trim(), email: d.email.trim(), rollNo: d.rollNo.trim() }));
}
