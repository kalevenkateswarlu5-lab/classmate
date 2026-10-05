export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function toast(msg, type = 'success') {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toast-container position-fixed top-0 end-0 p-3'; document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast align-items-center text-bg-' + type + ' border-0';
  el.innerHTML = '<div class="d-flex"><div class="toast-body">' + esc(msg) + '</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>';
  box.appendChild(el);
  new bootstrap.Toast(el, { delay: 3500 }).show();
  el.addEventListener('hidden.bs.toast', () => el.remove());
}
export function confirmDialog(msg) {
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'modal fade';
    m.innerHTML = '<div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-body p-4"><h5>Are you sure?</h5><p class="text-muted mb-4">' + esc(msg) + '</p><div class="text-end"><button class="btn btn-light" data-no>Cancel</button><button class="btn btn-danger ms-2" data-yes>Delete</button></div></div></div></div>';
    document.body.appendChild(m);
    const bm = new bootstrap.Modal(m); let out = false;
    m.querySelector('[data-yes]').onclick = () => { out = true; bm.hide(); };
    m.querySelector('[data-no]').onclick = () => bm.hide();
    m.addEventListener('hidden.bs.modal', () => { m.remove(); res(out); });
    bm.show();
  });
}
export function friendly(e) {
  const map = {
    'auth/invalid-credential': 'Incorrect email or password.', 'auth/user-not-found': 'No account with that email.',
    'auth/wrong-password': 'Incorrect email or password.', 'auth/email-already-in-use': 'That email is already registered.',
    'auth/weak-password': 'Password must be at least 6 characters.', 'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Try again later.', 'permission-denied': 'Permission denied. Make sure the Firestore rules are deployed.'
  };
  return map[e.code] || e.message || 'Something went wrong.';
}
