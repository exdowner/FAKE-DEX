// ============================================================
// WebDEX 3.0 — Auth + Apps + Personalização Total
// ============================================================

const LS = {
  USERS: 'webdex.users',
  SESSION: 'webdex.session',
  APPS: 'webdex.apps',
  WALL: 'webdex.wallpaper',
  PREFS: 'webdex.prefs'
};

const state = {
  user: null,
  apps: [],
  windows: [],
  zTop: 10,
  prefs: {
    accent: '#4cc2ff',
    iconSize: 48,
    fontSize: 13,
    fontFamily: '"Segoe UI Variable","Segoe UI",system-ui,sans-serif',
    gap: 8,
    opacity: 55,
    blur: 30,
    radius: 8,
    animSpeed: 1,
    animations: true
  }
};

// ============================================================
// AUTH — USUÁRIOS
// ============================================================
function getUsers() {
  try { return JSON.parse(localStorage.getItem(LS.USERS) || '[]'); }
  catch { return []; }
}
function saveUsers(users) {
  localStorage.setItem(LS.USERS, JSON.stringify(users));
}

async function hashPassword(pass) {
  const enc = new TextEncoder().encode(pass);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUserDataKey(username, key) {
  return `${key}.${username}`;
}

// ============================================================
// UI AUTH
// ============================================================
const $authScreen = document.getElementById('auth-screen');
const $appShell = document.getElementById('app-shell');

let pendingAvatar = null;

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    document.getElementById('form-login').style.display = isLogin ? 'block' : 'none';
    document.getElementById('form-register').style.display = isLogin ? 'none' : 'block';
    document.getElementById('auth-avatar-wrap').style.display = isLogin ? 'none' : 'flex';
    document.getElementById('auth-title').textContent = isLogin ? 'Entrar no WebDEX' : 'Criar conta';
    document.getElementById('auth-subtitle').textContent = isLogin ? 'Bem-vindo de volta' : 'Escolha sua foto de perfil';
  };
});

// Upload avatar no registro
document.getElementById('avatar-input').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingAvatar = reader.result;
    document.getElementById('avatar-preview').innerHTML = `<img src="${pendingAvatar}" alt="">`;
  };
  reader.readAsDataURL(file);
};

// Registro
document.getElementById('form-register').onsubmit = async (e) => {
  e.preventDefault();
  const user = document.getElementById('reg-user').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  const errEl = document.getElementById('reg-error');

  if (user.length < 3) { errEl.textContent = 'Usuário muito curto (min 3)'; return; }
  if (pass.length < 4) { errEl.textContent = 'Senha muito curta (min 4)'; return; }
  if (pass !== pass2) { errEl.textContent = 'As senhas não coincidem'; return; }

  const users = getUsers();
  if (users.find(u => u.name.toLowerCase() === user.toLowerCase())) {
    errEl.textContent = 'Este usuário já existe';
    return;
  }

  const hash = await hashPassword(pass);
  users.push({ name: user, pass: hash, avatar: pendingAvatar || null, created: Date.now() });
  saveUsers(users);
  errEl.style.color = '#51cf66';
  errEl.textContent = 'Conta criada! Entrando...';
  setTimeout(() => doLogin(user, hash), 600);
};

// Login
document.getElementById('form-login').onsubmit = async (e) => {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const hash = await hashPassword(pass);
  const errEl = document.getElementById('login-error');

  const found = getUsers().find(u =>
    u.name.toLowerCase() === user.toLowerCase() && u.pass === hash
  );
  if (!found) { errEl.textContent = 'Usuário ou senha incorretos'; return; }
  doLogin(found.name, hash);
};

function doLogin(username, hash) {
  state.user = username;
  localStorage.setItem(LS.SESSION, JSON.stringify({ username, hash }));
  enterApp();
}

document.getElementById('btn-logout').onclick = () => {
  if (!confirm('Sair da conta?')) return;
  localStorage.removeItem(LS.SESSION);
  location.reload();
};

// ============================================================
// ENTRAR NO APP
// ============================================================
async function enterApp() {
  $authScreen.style.display = 'none';
  $appShell.style.display = 'flex';

  loadUserAvatar();
  await initApps();
  restoreWallpaper();
  restorePrefs();
  tickClock();
  setInterval(tickClock, 1000);
}

function loadUserAvatar() {
  const users = getUsers();
  const me = users.find(u => u.name === state.user);
  const avatar = me?.avatar || '';
  const $top = document.getElementById('user-avatar-top');
  const $modal = document.getElementById('user-avatar-modal');
  document.getElementById('user-name-modal').textContent = state.user;

  if (avatar) {
    $top.src = avatar;
    $modal.src = avatar;
  } else {
    // Fallback: SVG com inicial
    const svg = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#4cc2ff"/><text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="20" font-weight="600" fill="#000">${state.user[0].toUpperCase()}</text></svg>`)}`;
    $top.src = svg;
    $modal.src = svg;
  }
}

// Trocar avatar no perfil
document.getElementById('avatar-change').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const users = getUsers();
    const me = users.find(u => u.name === state.user);
    if (me) {
      me.avatar = reader.result;
      saveUsers(users);
      loadUserAvatar();
    }
  };
  reader.readAsDataURL(file);
};

// ============================================================
// APPS
// ============================================================
function appsKey() { return getUserDataKey(state.user, LS.APPS); }

function saveApps() {
  localStorage.setItem(appsKey(), JSON.stringify(state.apps));
}
function loadStoredApps() {
  try { return JSON.parse(localStorage.getItem(appsKey()) || 'null'); }
  catch { return null; }
}

async function initApps() {
  let apps = loadStoredApps();
  if (!apps) {
    try {
      const res = await fetch('apps.json');
      apps = await res.json();
    } catch {
      apps = defaultApps();
    }
  }
  state.apps = apps;
  saveApps();
  renderGrid(state.apps);
}

function defaultApps() {
  return [
    { id: 'calc', name: 'Calculadora', icon: '🧮', url: 'calc.html', embed: true },
    { id: 'notes', name: 'Notas', icon: '📝', url: 'notes.html', embed: true },
    { id: 'terminal', name: 'Terminal', icon: '💻', url: 'terminal.html', embed: true },
    { id: 'settings', name: 'Config', icon: '⚙️', url: 'settings.html', embed: true }
  ];
}

function renderGrid(apps) {
  const $grid = document.getElementById('app-grid');
  $grid.innerHTML = '';
  apps.forEach((app, i) => {
    const el = document.createElement('div');
    el.className = 'app-icon';
    el.style.animationDelay = (i * 20) + 'ms';

    const iconHTML = isImageUrl(app.icon)
      ? `<img src="${app.icon}" alt="" />`
      : app.icon;

    el.innerHTML = `
      <div class="icon-box">${iconHTML}</div>
      <div class="name">${app.name}</div>
      <button class="remove-btn" title="Remover">✕</button>
    `;
    el.onclick = (e) => {
      if (e.target.classList.contains('remove-btn')) return;
      openApp(app);
    };
    el.querySelector('.remove-btn').onclick = (e) => {
      e.stopPropagation();
      removeApp(app.id);
    };
    $grid.appendChild(el);
  });
}

function isImageUrl(str) {
  return typeof str === 'string' && /^https?:\/\/.+\.(png|jpe?g|gif|svg|webp|ico)|^data:image/i.test(str);
}

function addApp(app) {
  app.id = app.id || 'app-' + Date.now();
  state.apps.push(app);
  saveApps();
  renderGrid(state.apps);
}

function removeApp(id) {
  if (!confirm('Remover este app?')) return;
  state.apps = state.apps.filter(a => a.id !== id);
  saveApps();
  renderGrid(state.apps);
  const win = state.windows.find(w => w.appId === id);
  if (win) closeWindow(win.id);
}

// ============================================================
// JANELAS
// ============================================================
function openApp(app) {
  const existing = state.windows.find(w => w.appId === app.id);
  if (existing) {
    if (existing.minimized) {
      existing.minimized = false;
      document.getElementById(`win-${existing.id}`).style.display = 'flex';
    }
    focusWindow(existing.id);
    return;
  }

  const id = crypto.randomUUID();
  const isMobile = window.innerWidth < 768;
  const offset = state.windows.length * 28;

  // Tela cheia automática: mobile ou flag do app
  const startMax = isMobile || app.fullscreen;

  const win = {
    id,
    appId: app.id,
    app,
    x: isMobile ? 0 : 80 + offset,
    y: isMobile ? 0 : 60 + offset,
    w: isMobile ? window.innerWidth : 860,
    h: isMobile ? window.innerHeight - 108 : 540,
    minimized: false,
    maximized: startMax,
    zIndex: ++state.zTop
  };
  state.windows.push(win);
  renderWindow(win);

  if (startMax) {
    // Aguarda render e aplica max
    requestAnimationFrame(() => toggleMaximize(id, true));
  }
  renderTasks();
}

function renderWindow(win) {
  const el = document.createElement('div');
  el.className = 'window';
  el.id = `win-${win.id}`;
  el.style.cssText = `
    left:${win.x}px; top:${win.y}px;
    width:${win.w}px; height:${win.h}px;
    z-index:${win.zIndex};
  `;

  const canEmbed = win.app.embed !== false;
  const iconHTML = isImageUrl(win.app.icon)
    ? `<img src="${win.app.icon}" alt="" />`
    : win.app.icon;

  const maxIcon = win.maximized
    ? `<svg width="12" height="12" viewBox="0 0 12 12"><rect x="3" y="3" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3 3v-1h1M9 3v-1h-1M3 9v1h1M9 9v1h-1" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`
    : `<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;

  el.innerHTML = `
    <div class="window-header">
      <div class="window-icon">${iconHTML}</div>
      <div class="window-title">${win.app.name}</div>
      <div class="window-controls">
        <button class="window-btn min" title="Minimizar">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
        <button class="window-btn max" title="Tela cheia">${maxIcon}</button>
        <button class="window-btn close" title="Fechar">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
      </div>
    </div>
    <div class="window-body">
      ${canEmbed
        ? `<iframe src="${win.app.url}" allow="clipboard-read; clipboard-write; fullscreen; camera; microphone; geolocation" allowfullscreen sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-orientation-lock allow-presentation"></iframe>`
        : `<div class="window-placeholder">
             <div class="icon-big">${iconHTML}</div>
             <p>Este site bloqueia abertura dentro do WebDEX (política X-Frame-Options).</p>
             <button>Abrir em nova aba</button>
           </div>`
      }
    </div>
    <div class="window-resize"></div>
  `;

  el.querySelector('.min').onclick = (e) => { e.stopPropagation(); minimizeWindow(win.id); };
  el.querySelector('.max').onclick = (e) => { e.stopPropagation(); toggleMaximize(win.id); };
  el.querySelector('.close').onclick = (e) => { e.stopPropagation(); closeWindow(win.id); };

  const btnOpen = el.querySelector('.window-placeholder button');
  if (btnOpen) btnOpen.onclick = () => window.open(win.app.url, '_blank');

  el.addEventListener('mousedown', () => focusWindow(win.id));

  if (window.innerWidth >= 768) {
    makeDraggable(el, el.querySelector('.window-header'), win);
    makeResizable(el, el.querySelector('.window-resize'), win);
  }

  document.getElementById('windows').appendChild(el);
}

function focusWindow(id) {
  const win = state.windows.find(w => w.id === id);
  if (!win) return;
  win.zIndex = ++state.zTop;
  const el = document.getElementById(`win-${id}`);
  if (el) el.style.zIndex = win.zIndex;
  renderTasks();
}

function minimizeWindow(id) {
  const win = state.windows.find(w => w.id === id);
  if (!win) return;
  win.minimized = true;
  const el = document.getElementById(`win-${id}`);
  if (el) el.style.display = 'none';
  renderTasks();
}

function toggleMaximize(id, forceMax = false) {
  const win = state.windows.find(w => w.id === id);
  const el = document.getElementById(`win-${id}`);
  if (!win || !el) return;

  const wantMax = forceMax || !win.maximized;

  if (wantMax) {
    if (!win.maximized) {
      win._prevX = win.x; win._prevY = win.y;
      win._prevW = win.w; win._prevH = win.h;
    }
    el.classList.add('maximized');
    win.maximized = true;

    // Atualiza ícone
    el.querySelector('.max').innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12"><rect x="3" y="3" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3 3v-1h1M9 3v-1h-1M3 9v1h1M9 9v1h-1" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`;
  } else {
    el.classList.remove('maximized');
    win.maximized = false;
    if (win._prevX !== undefined) {
      win.x = win._prevX; win.y = win._prevY;
      win.w = win._prevW; win.h = win._prevH;
      el.style.left = win.x + 'px';
      el.style.top = win.y + 'px';
      el.style.width = win.w + 'px';
      el.style.height = win.h + 'px';
    }

    el.querySelector('.max').innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
  }
}

function closeWindow(id) {
  const el = document.getElementById(`win-${id}`);
  if (el) {
    el.classList.add('closing');
    setTimeout(() => el.remove(), 180);
  }
  state.windows = state.windows.filter(w => w.id !== id);
  renderTasks();
}

// ============================================================
// ARRASTAR / RESIZE
// ============================================================
function makeDraggable(el, handle, win) {
  let dragging = false, startX, startY, origX, origY;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.closest('.window-controls')) return;
    if (win.maximized) return;
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    origX = win.x; origY = win.y;
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    win.x = Math.max(-win.w + 100, Math.min(window.innerWidth - 100, origX + (e.clientX - startX)));
    win.y = Math.max(0, Math.min(window.innerHeight - 108, origY + (e.clientY - startY)));
    el.style.left = win.x + 'px';
    el.style.top = win.y + 'px';
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    document.body.style.userSelect = '';
  });
}

function makeResizable(el, handle, win) {
  let resizing = false, startX, startY, origW, origH;
  handle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (win.maximized) return;
    resizing = true;
    startX = e.clientX; startY = e.clientY;
    origW = win.w; origH = win.h;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    win.w = Math.max(320, origW + (e.clientX - startX));
    win.h = Math.max(240, origH + (e.clientY - startY));
    el.style.width = win.w + 'px';
    el.style.height = win.h + 'px';
  });
  document.addEventListener('mouseup', () => {
    resizing = false;
    document.body.style.userSelect = '';
  });
}

// ============================================================
// TASKBAR
// ============================================================
function renderTasks() {
  const $tasks = document.getElementById('tasks');
  $tasks.innerHTML = '';
  state.windows.forEach(win => {
    const btn = document.createElement('button');
    btn.className = 'task' + (win.minimized ? '' : ' active');
    const iconHTML = isImageUrl(win.app.icon)
      ? `<img src="${win.app.icon}" alt="" />`
      : win.app.icon;
    btn.innerHTML = `
      <span class="task-icon">${iconHTML}</span>
      <span class="task-label">${win.app.name}</span>
    `;
    btn.title = win.app.name;
    btn.onclick = () => {
      if (win.minimized) {
        win.minimized = false;
        document.getElementById(`win-${win.id}`).style.display = 'flex';
        focusWindow(win.id);
      } else if (state.windows.slice(-1)[0]?.id === win.id) {
        minimizeWindow(win.id);
      } else {
        focusWindow(win.id);
      }
      renderTasks();
    };
    $tasks.appendChild(btn);
  });
}

// ============================================================
// BUSCA
// ============================================================
document.getElementById('search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  renderGrid(state.apps.filter(a => a.name.toLowerCase().includes(q)));
});

// ============================================================
// RELÓGIO
// ============================================================
function tickClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('date').textContent =
    now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ============================================================
// MODAL ADD APP
// ============================================================
const $modalAdd = document.getElementById('modal-add');
document.getElementById('btn-add-app').onclick = () => $modalAdd.classList.add('open');
$modalAdd.querySelectorAll('[data-close]').forEach(b =>
  b.onclick = () => $modalAdd.classList.remove('open')
);
$modalAdd.addEventListener('click', e => {
  if (e.target === $modalAdd) $modalAdd.classList.remove('open');
});

// Preview do ícone em tempo real
const $newIcon = document.getElementById('new-icon');
const $iconPreview = document.getElementById('icon-preview');
$newIcon.oninput = (e) => {
  const v = e.target.value.trim();
  $iconPreview.innerHTML = isImageUrl(v) ? `<img src="${v}" alt="">` : (v || '🌐');
};
document.getElementById('icon-file').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    $iconPreview.innerHTML = `<img src="${reader.result}" alt="">`;
    $newIcon.value = reader.result; // salva como data URL
  };
  reader.readAsDataURL(file);
};

document.getElementById('save-new-app').onclick = () => {
  const name = document.getElementById('new-name').value.trim();
  const url = document.getElementById('new-url').value.trim();
  const icon = document.getElementById('new-icon').value.trim() || '🌐';
  const embed = document.getElementById('new-embed').checked;
  const fullscreen = document.getElementById('new-fullscreen').checked;

  if (!name || !url) return alert('Preencha nome e URL');

  addApp({ name, url, icon, embed, fu
