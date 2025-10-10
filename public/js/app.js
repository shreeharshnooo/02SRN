// Simple frontend logic for Student Portal
const APP = (function () {
  let currentUser = null;
  async function api(path, opts = {}) {
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function ensureLoggedIn() {
    const r = await api('/api/me');
    if (!r.ok) {
      location.href = '/';
      return;
    }
    currentUser = r.data.user;
    if (!currentUser) location.href = '/';
    document.getElementById('user-name').textContent = currentUser.fullName;
    document.getElementById('welcome-name').textContent = currentUser.fullName;
  }

  function showElement(id) {
    document.querySelectorAll('#page-container > section').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById('page-' + id);
    if (el) el.classList.remove('hidden');
  }

  function showPage(page) {
    // valid pages: dashboard, courses, mycourses, schedule, grades, settings
    const valid = ['dashboard','courses','mycourses','schedule','grades','settings'];
    if (!valid.includes(page)) page = 'dashboard';
    showElement(page);
    // update active nav
    document.querySelectorAll('[data-page]').forEach(a => {
      a.classList.toggle('bg-blue-600', a.getAttribute('data-page') === page);
    });
  }

  async function loadCourses(q = '') {
    const url = q ? `/api/courses?q=${encodeURIComponent(q)}` : '/api/courses';
    const r = await api(url);
    if (!r.ok) return;
    const courses = r.data.courses || [];
    const tbody = document.getElementById('courses-table');
    tbody.innerHTML = '';
    courses.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = 'text-sm';
      tr.innerHTML = `
        <td class="px-4 py-3">${c.code}</td>
        <td class="px-4 py-3">${c.title}</td>
        <td class="px-4 py-3">${c.instructor}</td>
        <td class="px-4 py-3">${c.schedule}</td>
        <td class="px-4 py-3">${c.credits}</td>
        <td class="px-4 py-3">${c.availability}</td>
        <td class="px-4 py-3">
          <button class="btn-register inline-block py-1 px-3 rounded mr-2">Register</button>
          <button class="btn-view inline-block py-1 px-3 rounded border">View</button>
        </td>
      `;
      // style buttons
      tr.querySelector('.btn-register').classList.add('bg-green-600','text-white');
      tr.querySelector('.btn-view').classList.add('text-blue-600');
      // actions
      tr.querySelector('.btn-register').addEventListener('click', () => registerCourse(c.code));
      tr.querySelector('.btn-view').addEventListener('click', () => viewCourse(c.code));
      tbody.appendChild(tr);
    });
  }

  async function registerCourse(code) {
    const res = await api('/api/courses/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseCode: code })
    });
    if (res.ok) {
      alert('Registered for ' + code);
      await refreshUser();
      loadCourses();
      loadMyCourses();
      updateStats();
    } else {
      alert(res.data.error || 'Unable to register');
    }
  }

  async function viewCourse(code) {
    const res = await api('/api/courses/' + encodeURIComponent(code));
    if (!res.ok) { alert('Course not found'); return; }
    const c = res.data.course;
    alert(`${c.code} — ${c.title}\nInstructor: ${c.instructor}\nSchedule: ${c.schedule}\nCredits: ${c.credits}\nAvailability: ${c.availability}`);
  }

  async function refreshUser() {
    const r = await api('/api/me');
    if (r.ok) currentUser = r.data.user;
    document.getElementById('user-name').textContent = currentUser ? currentUser.fullName : '';
    document.getElementById('welcome-name').textContent = currentUser ? currentUser.fullName : '';
  }

  async function loadMyCourses() {
    await refreshUser();
    const list = document.getElementById('my-courses-list');
    list.innerHTML = '';
    if (!currentUser || !currentUser.registeredCourses || currentUser.registeredCourses.length === 0) {
      list.innerHTML = '<p class="text-sm text-gray-600">No registered courses.</p>';
      return;
    }
    // fetch course details for each
    for (const code of currentUser.registeredCourses) {
      const r = await api('/api/courses/' + encodeURIComponent(code));
      if (!r.ok) continue;
      const c = r.data.course;
      const div = document.createElement('div');
      div.className = 'p-3 border rounded flex items-center justify-between';
      div.innerHTML = `<div>
          <div class="font-semibold">${c.code} — ${c.title}</div>
          <div class="text-sm text-gray-500">${c.instructor} • ${c.schedule} • ${c.credits} credits</div>
        </div>
        <div class="text-sm text-gray-500">Registered</div>`;
      list.appendChild(div);
    }
  }

  function calcCredits(coursesList, allCourses) {
    let sum = 0;
    (coursesList || []).forEach(code => {
      const c = (allCourses || []).find(x => x.code === code);
      if (c) sum += Number(c.credits || 0);
    });
    return sum;
  }

  async function updateStats() {
    await refreshUser();
    const r = await api('/api/courses');
    const all = r.ok ? r.data.courses : [];
    const registered = currentUser && currentUser.registeredCourses ? currentUser.registeredCourses.length : 0;
    const credits = calcCredits(currentUser ? currentUser.registeredCourses : [], all);
    const totalPossible = all.reduce((s, c) => s + (c.credits || 0), 0) || 1;
    const progress = Math.round((credits / totalPossible) * 100);
    document.getElementById('stat-registered').textContent = registered;
    document.getElementById('stat-credits').textContent = credits;
    document.getElementById('stat-progress').textContent = progress + '%';
    document.getElementById('stat-upcoming').textContent = '-';
  }

  return {
    api, ensureLoggedIn, showPage, loadCourses, registerCourse, viewCourse, loadMyCourses, updateStats, refreshUser
  };
})();
