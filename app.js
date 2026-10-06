import { auth, db } from '../config.js';
import { requireRole, logout, createFaculty } from './auth.js';
import { MODULES } from './modules.js';
import { esc, toast, confirmDialog, friendly } from './ui.js';
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let role, ctx, unsub = null, chart = null, el;
const look = { classes: {}, students: {} };
const mods = () => MODULES.filter(m => m.perm[role]);
const myClasses = () => ctx.profile.classIds || [];
const today = () => new Date().toLocaleDateString('en-CA');

export async function boot(r) {
  role = r; ctx = await requireRole(r);
  await loadLookups();
  shell(); route();
  window.addEventListener('hashchange', route);
}
async function loadLookups() {
  try {
    const c = await getDocs(collection(db, 'classes'));
    look.classes = {}; c.forEach(d => look.classes[d.id] = { id: d.id, ...d.data() });
    if (role !== 'student') { const s = await getDocs(collection(db, 'students')); look.students = {}; s.forEach(d => look.students[d.id] = { id: d.id, ...d.data() }); }
  } catch (e) { toast(friendly(e), 'danger'); }
}
const className = id => look.classes[id]?.name || '—';
const stuLabel = id => look.students[id] ? look.students[id].name + ' (' + look.students[id].rollNo + ')' : '—';
const classOptions = () => Object.values(look.classes).filter(c => role !== 'faculty' || myClasses().includes(c.id));

function shell() {
  const name = ctx.profile.name || ctx.profile.email;
  const nav = [['overview', 'bi-grid-1x2', 'Overview'], ...mods().map(m => [m.key, m.icon, m.title]), ['profile', 'bi-person-circle', 'Profile']];
  document.getElementById('app').innerHTML = `
  <aside class="sidebar" id="sidebar"><div class="brand"><i class="bi bi-mortarboard-fill"></i> ClassMate</div>
    <nav>${nav.map(n => `<a href="#${n[0]}" data-nav="${n[0]}"><i class="bi ${n[1]}"></i><span>${n[2]}</span></a>`).join('')}</nav></aside>
  <div class="main"><header class="topbar">
    <button class="btn btn-light d-lg-none" id="menuBtn"><i class="bi bi-list"></i></button>
    <span class="role-pill">${role}</span>
    <div class="dropdown ms-auto"><button class="avatar-btn" data-bs-toggle="dropdown"><span class="avatar">${esc(name[0].toUpperCase())}</span><span class="d-none d-md-inline">${esc(name)}</span></button>
      <ul class="dropdown-menu dropdown-menu-end"><li><a class="dropdown-item" href="#profile"><i class="bi bi-person me-2"></i>Profile</a></li>
      <li><button class="dropdown-item" id="logoutBtn"><i class="bi bi-box-arrow-right me-2"></i>Log out</button></li></ul></div></header>
    <main class="content" id="view"></main></div>`;
  el = document.getElementById('view');
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('menuBtn').onclick = () => document.getElementById('sidebar').classList.toggle('open');
}
function route() {
  const h = location.hash.slice(1) || 'overview';
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === h));
  document.getElementById('sidebar').classList.remove('open');
  if (unsub) { unsub(); unsub = null; }
  if (chart) { chart.destroy(); chart = null; }
  if (h === 'overview') return overview();
  if (h === 'profile') return profile();
  const m = mods().find(x => x.key === h);
  m ? renderModule(m) : (location.hash = 'overview');
}
function scopedQuery(m) {
  const ref = collection(db, m.key);
  if (role === 'student') {
    if (m.scope === 'class') return query(ref, where('classId', '==', ctx.profile.classId));
    if (m.scope === 'student') return query(ref, where('studentId', '==', ctx.user.uid));
  }
  return ref;
}
function inScope(m, d) {
  if (role !== 'faculty') return true;
  if (m.key === 'classes') return myClasses().includes(d.id);
  return m.scope === 'none' || myClasses().includes(d.classId);
}
const toRows = (m, s) => s.docs.map(x => ({ id: x.id, ...x.data() })).filter(d => inScope(m, d));

// ---------- Overview ----------
async function overview() {
  el.innerHTML = '<div class="center-box"><div class="spinner-border text-primary"></div></div>';
  const keys = role === 'student' ? ['announcements', 'assignments', 'notes', 'attendance', 'timetable']
    : ['classes', ...(role === 'admin' ? ['faculty'] : []), 'students', 'notes', 'assignments', 'announcements', 'doubts'];
  const data = {};
  try {
    await Promise.all(keys.map(async k => { const m = MODULES.find(x => x.key === k); data[k] = toRows(m, await getDocs(scopedQuery(m))); }));
  } catch (e) { el.innerHTML = ''; return toast(friendly(e), 'danger'); }
  const name = esc(ctx.profile.name || 'there');
  let stats, extra = '';
  if (role === 'student') {
    const att = data.attendance, pres = att.filter(a => a.status === 'Present').length;
    const pct = att.length ? Math.round(pres / att.length * 100) : 0;
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const tt = data.timetable.filter(t => t.day === dayName).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const due = data.assignments.filter(a => a.deadline >= today()).sort((a, b) => a.deadline.localeCompare(b.deadline));
    stats = [['Attendance', pct + '%', 'bi-check2-square'], ['Pending assignments', due.length, 'bi-clipboard-check'], ['Notes', data.notes.length, 'bi-file-earmark-text'], ['Announcements', data.announcements.length, 'bi-megaphone']];
    extra = `<div class="row g-3 mt-1"><div class="col-lg-4"><div class="card-glass"><h6>Attendance</h6><canvas id="chart" height="200"></canvas></div></div>
      <div class="col-lg-4"><div class="card-glass"><h6>Today's timetable (${dayName})</h6>${tt.length ? tt.map(t => `<div class="row-item"><b>${esc(t.startTime)}–${esc(t.endTime)}</b> ${esc(t.subject)} <small class="text-muted">${esc(t.room || '')}</small></div>`).join('') : '<p class="text-muted mb-0">No classes today.</p>'}</div></div>
      <div class="col-lg-4"><div class="card-glass"><h6>Upcoming deadlines</h6>${due.length ? due.slice(0, 5).map(a => `<div class="row-item"><b>${esc(a.title)}</b> <small class="text-muted">${esc(a.subject)} · due ${esc(a.deadline)}</small></div>`).join('') : '<p class="text-muted mb-0">Nothing due. Nice.</p>'}</div></div></div>`;
    setTimeout(() => { chart = new Chart(document.getElementById('chart'), { type: 'doughnut', data: { labels: ['Present', 'Absent'], datasets: [{ data: [pres, att.length - pres], backgroundColor: ['#6366f1', '#e5e7eb'] }] }, options: { cutout: '70%' } }); }, 0);
  } else {
    const icons = { classes: 'bi-building', faculty: 'bi-person-workspace', students: 'bi-people', notes: 'bi-file-earmark-text', assignments: 'bi-clipboard-check', announcements: 'bi-megaphone', doubts: 'bi-chat-dots' };
    stats = keys.map(k => [k[0].toUpperCase() + k.slice(1), data[k].length, icons[k]]);
    const recent = data.announcements.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 4);
    extra = `<div class="row g-3 mt-1"><div class="col-lg-7"><div class="card-glass"><h6>Overview chart</h6><canvas id="chart" height="120"></canvas></div></div>
      <div class="col-lg-5"><div class="card-glass"><h6>Recent announcements</h6>${recent.length ? recent.map(a => `<div class="row-item"><b>${esc(a.title)}</b> <small class="text-muted">${esc(className(a.classId))}</small></div>`).join('') : '<p class="text-muted mb-0">No announcements yet.</p>'}</div></div></div>`;
    setTimeout(() => { chart = new Chart(document.getElementById('chart'), { type: 'bar', data: { labels: stats.map(s => s[0]), datasets: [{ data: stats.map(s => s[1]), backgroundColor: '#6366f1', borderRadius: 6 }] }, options: { plugins: { legend: { display: false } } } }); }, 0);
  }
  el.innerHTML = `<div class="fade-in"><h3 class="mb-1">Hello, ${name}</h3><p class="text-muted">Here is what is happening in your classroom.</p>
    <div class="row g-3">${stats.map(s => `<div class="col-6 col-xl-3"><div class="stat"><i class="bi ${s[2]}"></i><div><div class="stat-n">${s[1]}</div><div class="text-muted small">${s[0]}</div></div></div></div>`).join('')}</div>${extra}</div>`;
}
function profile() {
  const p = ctx.profile;
  const rows = [['Name', p.name], ['Email', p.email], ['Role', role], ['Roll number', p.rollNo], ['Class', p.classId ? className(p.classId) : null], ['Subject', p.subject]].filter(r => r[1]);
  el.innerHTML = `<div class="fade-in card-glass" style="max-width:560px"><h4 class="mb-3">Profile</h4>${rows.map(r => `<div class="row-item"><span class="text-muted">${r[0]}</span><b class="float-end">${esc(r[1])}</b></div>`).join('')}
    <button class="btn btn-primary mt-3" id="resetBtn">Send password reset email</button></div>`;
  document.getElementById('resetBtn').onclick = async () => { try { await sendPasswordResetEmail(auth, p.email); toast('Reset link sent to ' + p.email); } catch (e) { toast(friendly(e), 'danger'); } };
}

// ---------- Generic CRUD module ----------
function renderModule(m) {
  const perm = m.perm[role], canAdd = ['rw', 'own'].includes(perm) && !m.noCreate, canMod = ['rw', 'own'].includes(perm);
  const cols = m.cols.filter(c => !(role === 'student' && (c === 'studentId' || c === 'studentName')));
  const hasClass = m.cols.includes('classId') && role !== 'student';
  let rows = null;
  el.innerHTML = `<div class="fade-in"><div class="d-flex flex-wrap gap-2 align-items-center mb-3"><h3 class="mb-0 me-auto">${m.title}</h3>
    ${canAdd ? '<button class="btn btn-primary" id="addBtn"><i class="bi bi-plus-lg me-1"></i>Add new</button>' : ''}</div>
    <div class="card-glass p-0"><div class="p-3 d-flex flex-wrap gap-2"><input class="form-control w-auto flex-grow-1" id="q" placeholder="Search ${m.title.toLowerCase()}…">
    ${hasClass ? '<select class="form-select w-auto" id="cf"><option value="">All classes</option>' + classOptions().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('') + '</select>' : ''}</div>
    <div class="table-responsive"><table class="table align-middle mb-0"><thead><tr>${cols.map(c => `<th>${esc(label(m, c))}</th>`).join('')}${canMod ? '<th></th>' : ''}</tr></thead><tbody id="tb"></tbody></table></div></div></div>`;
  const tb = document.getElementById('tb'), q = document.getElementById('q'), cf = document.getElementById('cf');
  const draw = () => {
    if (rows === null) return tb.innerHTML = `<tr><td colspan="${cols.length + 1}" class="center-box"><div class="spinner-border spinner-border-sm text-primary"></div> Loading…</td></tr>`;
    const t = q.value.toLowerCase();
    const list = rows.filter(d => (!cf || !cf.value || d.classId === cf.value) && (!t || cols.map(c => cellText(c, d)).join(' ').toLowerCase().includes(t)));
    tb.innerHTML = list.length ? list.map(d => `<tr>${cols.map(c => `<td>${cell(c, d)}</td>`).join('')}${canMod ? `<td class="text-end text-nowrap"><button class="btn btn-sm btn-light" data-e="${d.id}"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-light text-danger" data-d="${d.id}"><i class="bi bi-trash"></i></button></td>` : ''}</tr>`).join('')
      : `<tr><td colspan="${cols.length + 1}"><div class="empty"><i class="bi ${m.icon}"></i><p>Nothing here yet.</p></div></td></tr>`;
  };
  draw();
  q.oninput = draw; if (cf) cf.onchange = draw;
  unsub = onSnapshot(scopedQuery(m), s => { rows = toRows(m, s); draw(); }, e => { rows = []; draw(); toast(friendly(e), 'danger'); });
  if (canAdd) document.getElementById('addBtn').onclick = () => form(m, null);
  tb.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.e) return form(m, rows.find(r => r.id === b.dataset.e));
    if (b.dataset.d && await confirmDialog('This ' + m.title.toLowerCase().replace(/s$/, '') + ' record will be permanently removed.')) {
      try {
        await deleteDoc(doc(db, m.key, b.dataset.d));
        if (m.key === 'faculty' || m.key === 'students') { await deleteDoc(doc(db, 'users', b.dataset.d)); await loadLookups(); }
        if (m.key === 'classes') await loadLookups();
        toast('Deleted');
      } catch (err) { toast(friendly(err), 'danger'); }
    }
  };
}
const label = (m, c) => m.fields.find(f => f.name === c)?.label || ({ studentName: 'Student', email: 'Email', rollNo: 'Roll no', classId: 'Class', classIds: 'Classes' }[c]) || c;
function cellText(c, d) {
  if (c === 'classId') return className(d.classId);
  if (c === 'classIds') return (d.classIds || []).map(className).join(', ');
  if (c === 'studentId') return stuLabel(d.studentId);
  return String(d[c] ?? '');
}
function cell(c, d) {
  if (c === 'link' && d.link) return `<a href="${esc(d.link)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary">Open</a>`;
  const t = cellText(c, d);
  if (c === 'status') return `<span class="badge ${t === 'Present' || t === 'Done' ? 'bg-success' : 'bg-secondary'}">${esc(t)}</span>`;
  return esc(t.length > 70 ? t.slice(0, 70) + '…' : t) || '—';
}
function form(m, rec) {
  const fields = m.fields.filter(f => (!f.roles || f.roles.includes(role)) && !(rec && f.createOnly));
  const opts = f => {
    if (f.options) return f.options.map(o => [o, o]);
    if (f.ref === 'classes') return classOptions().map(c => [c.id, c.name]);
    return Object.values(look.students).filter(s => role !== 'faculty' || myClasses().includes(s.classId)).map(s => [s.id, stuLabel(s.id)]);
  };
  const input = f => {
    const v = rec?.[f.name] ?? '', req = f.required ? 'required' : '';
    if (f.type === 'textarea') return `<textarea class="form-control" name="${f.name}" rows="3" ${req}>${esc(v)}</textarea>`;
    if (f.type === 'select' || f.type === 'multiselect') {
      const multi = f.type === 'multiselect';
      return `<select class="form-select" name="${f.name}" ${multi ? 'multiple size="4"' : ''} ${req}>${multi ? '' : '<option value="">Select…</option>'}${opts(f).map(o => `<option value="${esc(o[0])}" ${(multi ? (v || []).includes(o[0]) : v === o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    }
    return `<input class="form-control" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${f.type === 'number' ? 'min="0" step="any"' : ''} ${f.type === 'password' ? 'minlength="6"' : ''} ${req}>`;
  };
  const mo = document.createElement('div'); mo.className = 'modal fade';
  mo.innerHTML = `<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><form class="modal-content needs-validation" novalidate><div class="modal-header"><h5 class="modal-title">${rec ? 'Edit' : 'Add'} ${m.title}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body">${fields.map(f => `<div class="mb-3"><label class="form-label">${f.label}</label>${input(f)}<div class="invalid-feedback">Required</div></div>`).join('')}</div>
    <div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form></div>`;
  document.body.appendChild(mo);
  const bm = new bootstrap.Modal(mo); bm.show();
  mo.addEventListener('hidden.bs.modal', () => mo.remove());
  mo.querySelector('form').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    if (!f.checkValidity()) return f.classList.add('was-validated');
    const data = {};
    fields.forEach(fd => {
      const n = f.elements[fd.name];
      data[fd.name] = fd.type === 'multiselect' ? [...n.selectedOptions].map(o => o.value) : fd.type === 'number' ? Number(n.value) : n.value.trim();
    });
    if (m.derive) data.classId = look.students[data.studentId]?.classId;
    if (role === 'student' && !rec) { data.studentId = ctx.user.uid; data.studentName = ctx.profile.name; data.classId = ctx.profile.classId; }
    if (m.key === 'faculty' && !rec && !data.classIds.length) data.classIds = [];
    const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    try {
      if (m.key === 'faculty' && !rec) await createFaculty(data);
      else if (rec) {
        await updateDoc(doc(db, m.key, rec.id), data);
        if (m.key === 'faculty' || m.key === 'students') await updateDoc(doc(db, 'users', rec.id), data);
      } else await addDoc(collection(db, m.key), { ...data, createdBy: ctx.user.uid, createdAt: serverTimestamp() });
      if (['classes', 'students', 'faculty'].includes(m.key)) await loadLookups();
      toast(rec ? 'Changes saved' : 'Saved'); bm.hide();
    } catch (err) { toast(friendly(err), 'danger'); btn.disabled = false; btn.textContent = 'Save'; }
  };
}
