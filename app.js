// ============================================================
// WebDEX 4.0 — Sistema Completo
// ============================================================

// ============================================================
// HELPERS GLOBAIS
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function isImageUrl(str) {
  if (typeof str !== 'string') return false;
  return /^https?:\/\/.+\.(png|jpe?g|gif|svg|webp|ico)(\?|$)/i.test(str)
      || /^data:image\//i.test(str);
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function uid() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

// ============================================================
// STORAGE KEYS
// ============================================================
const LS = {
  USERS: 'webdex.users',
  SESSION: 'webdex.session',
  APPS: 'webdex.apps',
  WALL: 'webdex.wallpaper',
  PREFS: 'webdex.prefs',
  FILES: 'webdex.files'
};

function userKey(base) {
  return state.user ? `${base}.${state.user}` : base;
}

// ============================================================
// ESTADO GLOBAL
// ============================================================
const state = {
  user: null,
  apps: [],
  windows: [],
  zTop: 10,
  files: {}, // { path: { type: 'file'|'folder', content, created } }
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
    animations: true,
    windowAnim: true,
    snap: true,
    blurWindows: true,
    tbPosition: 'bottom',
    tbIconSize: 44,
    tbShowLabels: true,
    tbAutohide: false,
    tbCenter: true
  }
};

// ============================================================
// NOTIFICAÇÕES
// ============================================================
function notify(title, msg = '', type = 'info', duration = 3500) {
  const $zone = $('#notifications');
  if (!$zone) return;

  const el = document.createElement('div');
  el.className = `notif ${type}`;
  el.innerHTML = `
    <div style="flex:1">
      <div class="notif-title">${escapeHTML(title)}</div>
      ${msg ? `<div class="notif-msg">${escapeHTML(msg)}</div>` : ''}
    </div>
  `;
  $zone.appendChild(el);

  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
  }, duration);

  el.onclick = () => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
  };
}

// ============================================================
// CONFIRM CUSTOMIZADO (substitui confirm())
// ============================================================
let confirmResolver = null;

function customConfirm(title, message = '') {
  return new Promise(resolve => {
    confirmResolver = resolve;
    $('#confirm-title').textContent = title;
    $('#confirm-message').textContent = message;
    $('#modal-confirm').classList.add('open');
  });
}

function bindConfirmModal() {
  $('#confirm-ok').onclick = () => {
    $('#modal-confirm').classList.remove('open');
    if (confirmResolver) confirmResolver(true);
  };
  $('#confirm-cancel').onclick = () => {
    $('#modal-confirm').classList.remove('open');
    if (confirmResolver) confirmResolver(false);
  };
  $('#modal-confirm').addEventListener('click', e => {
    if (e.target.id === 'modal-confirm') {
      $('#modal-confirm').classList.remove('open');
      if (confirmResolver) confirmResolver(false);
    }
  });
}

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
  const enc = new TextEncoder().encode(pass + '::webdex4');
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// UI AUTH
// ============================================================
const $authScreen = document.getElementById('auth-screen');
const $appShell = document.getElementById('app-shell');

let pendingAvatar = null;

function bindAuthTabs() {
  $$('.auth-tab').forEach(tab => {
    tab.onclick = () => {
      $$('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      $('#form-login').style.display = isLogin ? 'block' : 'none';
      $('#form-register').style.display = isLogin ? 'none' : 'block';
      $('#auth-avatar-wrap').style.display = isLogin ? 'none' : 'flex';
      $('#auth-title').textContent = isLogin ? 'Entrar no WebDEX' : 'Criar conta';
      $('#auth-subtitle').textContent = isLogin ? 'Bem-vindo de volta' : 'Escolha sua foto de perfil';
    };
  });
}

function bindAvatarUpload() {
  const $avatarInput = document.getElementById('avatar-input');
  if ($avatarInput) {
    $avatarInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        pendingAvatar = reader.result;
        document.getElementById('avatar-preview').innerHTML =
          `<img src="${pendingAvatar}" alt="">`;
      };
      reader.readAsDataURL(file);
    };
  }

  const $avatarChange = document.getElementById('avatar-change');
  if ($avatarChange) {
    $avatarChange.onchange = (e) => {
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
          notify('Foto atualizada', '', 'success');
        }
      };
      reader.readAsDataURL(file);
    };
  }
}

function bindAuthForms() {
  // Registro
  const $formReg = document.getElementById('form-register');
  if ($formReg) {
    $formReg.onsubmit = async (e) => {
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
      users.push({
        name: user,
        pass: hash,
        avatar: pendingAvatar || null,
        created: Date.now()
      });
      saveUsers(users);
      errEl.style.color = '#51cf66';
      errEl.textContent = 'Conta criada! Entrando...';
      setTimeout(() => doLogin(user, hash), 500);
    };
  }

  // Login
  const $formLogin = document.getElementById('form-login');
  if ($formLogin) {
    $formLogin.onsubmit = async (e) => {
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
  }

  // Logout
  const $logout = document.getElementById('btn-logout');
  if ($logout) {
    $logout.onclick = async () => {
      const ok = await customConfirm('Sair da conta?', 'Você precisará fazer login novamente.');
      if (!ok) return;
      localStorage.removeItem(LS.SESSION);
      location.reload();
    };
  }
}

function doLogin(username, hash) {
  state.user = username;
  localStorage.setItem(LS.SESSION, JSON.stringify({ username, hash }));
  enterApp();
}

function loadUserAvatar() {
  const users = getUsers();
  const me = users.find(u => u.name === state.user);
  const avatar = me?.avatar || '';

  const $top = document.getElementById('user-avatar-top');
  const $modal = document.getElementById('user-avatar-modal');

  const nameEl = document.getElementById('user-name-modal');
  if (nameEl) nameEl.textContent = state.user;

  const fallbackSvg = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      <rect width="40" height="40" fill="#4cc2ff"/>
      <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
        font-family="sans-serif" font-size="20" font-weight="600" fill="#000">
        ${(state.user || '?')[0].toUpperCase()}
      </text>
    </svg>`
  )}`;

  if ($top) $top.src = avatar || fallbackSvg;
  if ($modal) $modal.src = avatar || fallbackSvg;
}

// ============================================================
// ENTRAR NO APP
// ============================================================
async function enterApp() {
  $authScreen.style.display = 'none';
  $appShell.style.display = 'flex';

  loadUserAvatar();
  await initApps();
  initFiles();
  restoreWallpaper();
  restorePrefs();
  applyPrefs();
  startClock();
  bindAllUI();
}

// ============================================================
// RELÓGIO
// ============================================================
function startClock() {
  const tick = () => {
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

    const $c = document.getElementById('clock');
    const $d = document.getElementById('date');
    const $wc = document.getElementById('w-clock');
    const $wd = document.getElementById('w-date');

    if ($c) $c.textContent = time;
    if ($d) $d.textContent = date;
    if ($wc) $wc.textContent = time;
    if ($wd) $wd.textContent = date;
  };
  tick();
  setInterval(tick, 1000);
}// ============================================================
// APPS
// ============================================================
function appsKey() { return userKey(LS.APPS); }

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
    { id: 'editor', name: 'Editor', icon: '📄', url: 'editor.html', embed: true },
    { id: 'files', name: 'Arquivos', icon: '📁', url: 'files.html', embed: true },
    { id: 'music', name: 'Música', icon: '🎵', url: 'music.html', embed: true },
    { id: 'settings', name: 'Config', icon: '⚙️', url: 'settings.html', embed: true }
  ];
}

function renderGrid(apps) {
  const $grid = document.getElementById('app-grid');
  if (!$grid) return;
  $grid.innerHTML = '';
  apps.forEach((app, i) => {
    const el = document.createElement('div');
    el.className = 'app-icon';
    el.style.animationDelay = (i * 20) + 'ms';
    el.dataset.appId = app.id;

    const iconHTML = isImageUrl(app.icon)
      ? `<img src="${escapeHTML(app.icon)}" alt="" />`
      : escapeHTML(app.icon);

    el.innerHTML = `
      <div class="icon-box">${iconHTML}</div>
      <div class="name">${escapeHTML(app.name)}</div>
      <button class="remove-btn" title="Remover">✕</button>
    `;

    el.onclick = (e) => {
      if (e.target.classList.contains('remove-btn')) return;
      openApp(app);
    };
    el.oncontextmenu = (e) => {
      e.preventDefault();
      showAppContextMenu(e, app);
    };
    el.querySelector('.remove-btn').onclick = async (e) => {
      e.stopPropagation();
      const ok = await customConfirm(`Remover "${app.name}"?`, 'O app será removido do seu desktop.');
      if (ok) removeApp(app.id);
    };

    $grid.appendChild(el);
  });
}

function addApp(app) {
  app.id = app.id || uid();
  state.apps.push(app);
  saveApps();
  renderGrid(state.apps);
  notify('App adicionado', app.name, 'success');
}

function removeApp(id) {
  state.apps = state.apps.filter(a => a.id !== id);
  saveApps();
  renderGrid(state.apps);
  const win = state.windows.find(w => w.appId === id);
  if (win) closeWindow(win.id);
  notify('App removido', '', 'info');
}

function showAppContextMenu(e, app) {
  const menu = $('#context-menu');
  if (!menu) return;
  menu.innerHTML = `
    <button data-action="open-app">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 3h6v6M10 14L21 3M21 14v7H3V3h7"/>
      </svg>
      Abrir
    </button>
    <button data-action="open-new-tab">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
      </svg>
      Abrir em nova aba
    </button>
    <div class="cm-divider"></div>
    <button data-action="edit-app">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
      Editar
    </button>
    <button data-action="remove-app">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      </svg>
      Remover
    </button>
  `;
  menu.querySelector('[data-action="open-app"]').onclick = () => {
    hideContextMenu();
    openApp(app);
  };
  menu.querySelector('[data-action="open-new-tab"]').onclick = () => {
    hideContextMenu();
    window.open(app.url, '_blank');
  };
  menu.querySelector('[data-action="edit-app"]').onclick = () => {
    hideContextMenu();
    editApp(app);
  };
  menu.querySelector('[data-action="remove-app"]').onclick = async () => {
    hideContextMenu();
    const ok = await customConfirm(`Remover "${app.name}"?`, '');
    if (ok) removeApp(app.id);
  };
  positionContextMenu(e);
}

function editApp(app) {
  const name = prompt('Novo nome:', app.name);
  if (name === null) return;
  const url = prompt('Nova URL:', app.url);
  if (url === null) return;
  app.name = name.trim() || app.name;
  app.url = url.trim() || app.url;
  saveApps();
  renderGrid(state.apps);
  notify('App atualizado', app.name, 'success');
}

// ============================================================
// JANELAS
// ============================================================
function openApp(app) {
  const existing = state.windows.find(w => w.appId === app.id);
  if (existing) {
    if (existing.minimized) {
      existing.minimized = false;
      const el = document.getElementById(`win-${existing.id}`);
      if (el) el.style.display = 'flex';
    }
    focusWindow(existing.id);
    return;
  }

  const id = uid();
  const isMobile = window.innerWidth < 768;
  const offset = state.windows.length * 28;

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

  if (startMax && !isMobile) {
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
  if (win.maximized) el.classList.add('maximized');

  const canEmbed = win.app.embed !== false;
  const iconHTML = isImageUrl(win.app.icon)
    ? `<img src="${escapeHTML(win.app.icon)}" alt="" />`
    : escapeHTML(win.app.icon);

  const maxIcon = win.maximized
    ? `<svg width="12" height="12" viewBox="0 0 12 12"><rect x="3" y="3" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3 3v-1h1M9 3v-1h-1M3 9v1h1M9 9v1h-1" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>`
    : `<svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;

  el.innerHTML = `
    <div class="window-header">
      <div class="window-icon">${iconHTML}</div>
      <div class="window-title">${escapeHTML(win.app.name)}</div>
      <div class="window-controls">
        <button class="window-btn min" title="Minimizar">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
        <button class="window-btn max" title="Tela cheia">${maxIcon}</button>
        <button class="window-btn reload" title="Recarregar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
        </button>
        <button class="window-btn close" title="Fechar">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
      </div>
    </div>
    <div class="window-body">
      ${canEmbed
        ? `<iframe src="${escapeHTML(win.app.url)}"
             allow="clipboard-read; clipboard-write; fullscreen; camera; microphone; geolocation"
             allowfullscreen
             sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-orientation-lock allow-presentation"></iframe>`
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
  el.querySelector('.reload').onclick = (e) => {
    e.stopPropagation();
    const iframe = el.querySelector('iframe');
    if (iframe) {
      iframe.src = iframe.src;
      notify('Recarregado', win.app.name, 'info');
    }
  };

  const btnOpen = el.querySelector('.window-placeholder button');
  if (btnOpen) btnOpen.onclick = () => window.open(win.app.url, '_blank');

  el.addEventListener('mousedown', () => focusWindow(win.id));

  if (window.innerWidth >= 768) {
    makeDraggable(el, el.querySelector('.window-header'), win);
    makeResizable(el, el.querySelector('.window-resize'), win);
  }

  // Context menu da janela
  el.querySelector('.window-header').oncontextmenu = (e) => {
    e.preventDefault();
    showWindowContextMenu(e, win);
  };

  document.getElementById('windows').appendChild(el);
}

function showWindowContextMenu(e, win) {
  const menu = $('#context-menu');
  if (!menu) return;
  menu.innerHTML = `
    <button data-action="win-reload">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
      </svg>
      Recarregar
    </button>
    <button data-action="win-max">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
      </svg>
      ${win.maximized ? 'Restaurar' : 'Tela cheia'}
    </button>
    <button data-action="win-min">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14"/>
      </svg>
      Minimizar
    </button>
    <div class="cm-divider"></div>
    <button data-action="win-close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
      Fechar
    </button>
  `;
  menu.querySelector('[data-action="win-reload"]').onclick = () => {
    hideContextMenu();
    const iframe = document.querySelector(`#win-${win.id} iframe`);
    if (iframe) iframe.src = iframe.src;
  };
  menu.querySelector('[data-action="win-max"]').onclick = () => {
    hideContextMenu();
    toggleMaximize(win.id);
  };
  menu.querySelector('[data-action="win-min"]').onclick = () => {
    hideContextMenu();
    minimizeWindow(win.id);
  };
  menu.querySelector('[data-action="win-close"]').onclick = () => {
    hideContextMenu();
    closeWindow(win.id);
  };
  positionContextMenu(e);
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
// DRAG / RESIZE com SNAP
// ============================================================
function makeDraggable(el, handle, win) {
  let dragging = false, startX, startY, origX, origY;
  let snapPreview = null;

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

    // Snap preview
    if (state.prefs.snap) {
      const zone = getSnapZone(e.clientX, e.clientY);
      updateSnapPreview(zone);
    }
  });

  document.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    if (state.prefs.snap) {
      const zone = getSnapZone(e.clientX, e.clientY);
      applySnap(el, win, zone);
    }
    removeSnapPreview();
  });
}

function getSnapZone(x, y) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const margin = 30;
  if (x < margin) return 'left';
  if (x > w - margin) return 'right';
  if (y < margin) return 'top';
  return null;
}

function updateSnapPreview(zone) {
  removeSnapPreview();
  if (!zone) return;
  const el = document.createElement('div');
  el.id = 'snap-preview';
  el.style.cssText = `
    position:fixed; background:rgba(76,194,255,.25);
    border:2px solid #4cc2ff; border-radius:8px;
    pointer-events:none; z-index:9998;
    transition: all .12s ease;
  `;
  const h = window.innerHeight - 108;
  if (zone === 'left') {
    el.style.cssText += `left:0; top:48px; width:50%; height:${h}px;`;
  } else if (zone === 'right') {
    el.style.cssText += `right:0; top:48px; width:50%; height:${h}px;`;
  } else if (zone === 'top') {
    el.style.cssText += `left:0; top:48px; width:100%; height:${h}px;`;
  }
  document.body.appendChild(el);
}

function removeSnapPreview() {
  const el = document.getElementById('snap-preview');
  if (el) el.remove();
}

function applySnap(el, win, zone) {
  const h = window.innerHeight - 108;
  if (zone === 'left') {
    win._prevX = win.x; win._prevY = win.y;
    win._prevW = win.w; win._prevH = win.h;
    el.style.left = '0';
    el.style.top = '48px';
    el.style.width = '50%';
    el.style.height = h + 'px';
    win.x = 0; win.y = 48; win.w = window.innerWidth / 2; win.h = h;
  } else if (zone === 'right') {
    win._prevX = win.x; win._prevY = win.y;
    win._prevW = win.w; win._prevH = win.h;
    el.style.left = '50%';
    el.style.top = '48px';
    el.style.width = '50%';
    el.style.height = h + 'px';
    win.x = window.innerWidth / 2; win.y = 48; win.w = window.innerWidth / 2; win.h = h;
  } else if (zone === 'top') {
    toggleMaximize(win.id, true);
  }
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
  if (!$tasks) return;
  $tasks.innerHTML = '';
  state.windows.forEach(win => {
    const btn = document.createElement('button');
    btn.className = 'task' + (win.minimized ? '' : ' active');
    const iconHTML = isImageUrl(win.app.icon)
      ? `<img src="${escapeHTML(win.app.icon)}" alt="" />`
      : escapeHTML(win.app.icon);
    btn.innerHTML = `
      <span class="task-icon">${iconHTML}</span>
      <span class="task-label">${escapeHTML(win.app.name)}</span>
    `;
    btn.title = win.app.name;
    btn.onclick = () => {
      if (win.minimized) {
        win.minimized = false;
        const el = document.getElementById(`win-${win.id}`);
        if (el) el.style.display = 'flex';
        focusWindow(win.id);
      } else if (state.windows.slice(-1)[0]?.id === win.id) {
        minimizeWindow(win.id);
      } else {
        focusWindow(win.id);
      }
      renderTasks();
    };
    btn.oncontextmenu = (e) => {
      e.preventDefault();
      showWindowContextMenu(e, win);
    };
    $tasks.appendChild(btn);
  });
    }// ============================================================
// PREFS / PERSONALIZAÇÃO
// ============================================================
function prefsKey() { return userKey(LS.PREFS); }

function savePrefs() {
  localStorage.setItem(prefsKey(), JSON.stringify(state.prefs));
}

function applyPrefs() {
  const p = state.prefs;
  const root = document.documentElement;
  const body = document.body;

  root.style.setProperty('--accent', p.accent);
  root.style.setProperty('--icon-size', p.iconSize + 'px');
  root.style.setProperty('--icon-font', Math.round(p.iconSize * 0.66) + 'px');
  root.style.setProperty('--font-size', p.fontSize + 'px');
  root.style.setProperty('--font-family', p.fontFamily);
  root.style.setProperty('--grid-gap', p.gap + 'px');
  root.style.setProperty('--menu-opacity', (p.opacity / 100).toString());
  root.style.setProperty('--blur-amt', p.blur + 'px');
  root.style.setProperty('--radius', p.radius + 'px');
  root.style.setProperty('--radius-lg', (p.radius * 1.5) + 'px');
  root.style.setProperty('--anim-speed', p.animations ? p.animSpeed : '0.001');
  root.style.setProperty('--tb-icon-size', p.tbIconSize + 'px');

  // Taskbar position
  body.classList.remove('tb-top', 'tb-left', 'tb-right');
  if (p.tbPosition === 'top') body.classList.add('tb-top');
  else if (p.tbPosition === 'left') body.classList.add('tb-left');
  else if (p.tbPosition === 'right') body.classList.add('tb-right');

  // Taskbar flags
  body.classList.toggle('tb-hide-labels', !p.tbShowLabels);
  body.classList.toggle('tb-autohide', p.tbAutohide);
  body.classList.toggle('tb-no-center', !p.tbCenter);

  // Animações
  body.classList.toggle('no-anim', !p.animations);
  body.classList.toggle('no-blur-win', !p.blurWindows);
}

function restorePrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(prefsKey()) || 'null');
    if (saved) state.prefs = { ...state.prefs, ...saved };
  } catch {}
  applyPrefs();
  syncPrefsUI();
}

function syncPrefsUI() {
  const p = state.prefs;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  const setChk = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  };

  setVal('cfg-accent', p.accent);
  setVal('cfg-icon-size', p.iconSize);
  setTxt('cfg-icon-size-val', p.iconSize);
  setVal('cfg-font-size', p.fontSize);
  setTxt('cfg-font-size-val', p.fontSize);
  setVal('cfg-font', p.fontFamily);
  setVal('cfg-gap', p.gap);
  setTxt('cfg-gap-val', p.gap);
  setVal('cfg-opacity', p.opacity);
  setTxt('cfg-opacity-val', p.opacity);
  setVal('cfg-blur', p.blur);
  setTxt('cfg-blur-val', p.blur);
  setVal('cfg-radius', p.radius);
  setTxt('cfg-radius-val', p.radius);
  setVal('cfg-tb-position', p.tbPosition);
  setVal('cfg-tb-icon', p.tbIconSize);
  setTxt('cfg-tb-icon-val', p.tbIconSize);
  setChk('cfg-tb-icons', p.tbShowLabels);
  setChk('cfg-tb-autohide', p.tbAutohide);
  setChk('cfg-tb-center', p.tbCenter);
  setChk('cfg-anim', p.animations);
  setVal('cfg-anim-speed', p.animSpeed);
  setTxt('cfg-anim-speed-val', p.animSpeed);
  setChk('cfg-window-anim', p.windowAnim);
  setChk('cfg-snap', p.snap);
  setChk('cfg-blur-win', p.blurWindows);
}

function bindPref(id, key, isRange = false) {
  const el = document.getElementById(id);
  if (!el) return;
  const handler = () => {
    state.prefs[key] = isRange ? parseFloat(el.value) : el.value;
    const valEl = document.getElementById(id + '-val');
    if (valEl) valEl.textContent = el.value;
    savePrefs();
    applyPrefs();
  };
  el.addEventListener('input', handler);
  el.addEventListener('change', handler);
}

function bindPrefsUI() {
  bindPref('cfg-accent', 'accent');
  bindPref('cfg-icon-size', 'iconSize', true);
  bindPref('cfg-font-size', 'fontSize', true);
  bindPref('cfg-font', 'fontFamily');
  bindPref('cfg-gap', 'gap', true);
  bindPref('cfg-opacity', 'opacity', true);
  bindPref('cfg-blur', 'blur', true);
  bindPref('cfg-radius', 'radius', true);
  bindPref('cfg-tb-position', 'tbPosition');
  bindPref('cfg-tb-icon', 'tbIconSize', true);
  bindPref('cfg-anim-speed', 'animSpeed', true);

  const bindCheck = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.onchange = () => {
      state.prefs[key] = el.checked;
      savePrefs();
      applyPrefs();
    };
  };
  bindCheck('cfg-tb-icons', 'tbShowLabels');
  bindCheck('cfg-tb-autohide', 'tbAutohide');
  bindCheck('cfg-tb-center', 'tbCenter');
  bindCheck('cfg-anim', 'animations');
  bindCheck('cfg-window-anim', 'windowAnim');
  bindCheck('cfg-snap', 'snap');
  bindCheck('cfg-blur-win', 'blurWindows');

  const $reset = document.getElementById('btn-reset-settings');
  if ($reset) {
    $reset.onclick = async () => {
      const ok = await customConfirm('Resetar tudo?', 'Todas as personalizações voltarão ao padrão.');
      if (!ok) return;
      localStorage.removeItem(prefsKey());
      location.reload();
    };
  }

  const $export = document.getElementById('btn-export');
  if ($export) {
    $export.onclick = exportConfigs;
  }

  const $import = document.getElementById('import-config');
  if ($import) {
    $import.onchange = importConfigs;
  }
}

// ============================================================
// EXPORT / IMPORT
// ============================================================
function exportConfigs() {
  const data = {
    version: '4.0',
    exported: Date.now(),
    user: state.user,
    apps: state.apps,
    prefs: state.prefs,
    wallpaper: getWallConfig(),
    files: state.files
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `webdex-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  notify('Backup exportado', 'Arquivo salvo na pasta Downloads', 'success');
}

function importConfigs(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      const ok = await customConfirm('Importar backup?', 'Vai substituir apps, prefs, wallpaper e arquivos atuais.');
      if (!ok) return;

      if (data.apps) {
        state.apps = data.apps;
        saveApps();
        renderGrid(state.apps);
      }
      if (data.prefs) {
        state.prefs = { ...state.prefs, ...data.prefs };
        savePrefs();
        applyPrefs();
        syncPrefsUI();
      }
      if (data.wallpaper) {
        setWallpaper(data.wallpaper);
      }
      if (data.files) {
        state.files = data.files;
        saveFiles();
      }
      notify('Backup importado', 'Tudo restaurado com sucesso', 'success');
    } catch (err) {
      notify('Erro ao importar', 'Arquivo inválido', 'error');
    }
  };
  reader.readAsText(file);
}

// ============================================================
// WALLPAPER
// ============================================================
function wallpaperKey() { return userKey(LS.WALL); }

function setWallpaper(cfg, silent = false) {
  const $wall = document.getElementById('wallpaper');
  if (!$wall) return;
  $wall.innerHTML = '';
  $wall.style.background = '';

  if (cfg.type === 'url' && /\.(mp4|webm|ogg)(\?|$)/i.test(cfg.value)) {
    const v = document.createElement('video');
    v.src = cfg.value;
    v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    $wall.appendChild(v);
  } else if (cfg.isVideo) {
    const v = document.createElement('video');
    v.src = cfg.value;
    v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    $wall.appendChild(v);
  } else {
    $wall.style.backgroundImage = `url("${cfg.value}")`;
  }

  localStorage.setItem(wallpaperKey(), JSON.stringify(cfg));
  if (!silent) notify('Wallpaper atualizado', '', 'success');
}

function getWallConfig() {
  try {
    return JSON.parse(localStorage.getItem(wallpaperKey()) || 'null');
  } catch { return null; }
}

function restoreWallpaper() {
  const cfg = getWallConfig();
  if (cfg) {
    setWallpaper(cfg, true);
    const blurToggle = document.getElementById('wall-blur');
    if (cfg.blur && blurToggle) {
      blurToggle.checked = true;
      const $wall = document.getElementById('wallpaper');
      if ($wall) $wall.classList.add('blur');
    }
  }
}

function bindWallpaperUI() {
  const $wallUrl = document.getElementById('wall-url');
  if ($wallUrl) {
    $wallUrl.onchange = (e) => {
      const url = e.target.value.trim();
      if (!url) return;
      setWallpaper({ type: 'url', value: url });
    };
  }

  const $wallFile = document.getElementById('wall-file');
  if ($wallFile) {
    $wallFile.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setWallpaper({
        type: 'data',
        value: reader.result,
        isVideo: file.type.startsWith('video')
      });
      reader.readAsDataURL(file);
    };
  }

  const $wallBlur = document.getElementById('wall-blur');
  if ($wallBlur) {
    $wallBlur.onchange = (e) => {
      const $wall = document.getElementById('wallpaper');
      if ($wall) $wall.classList.toggle('blur', e.target.checked);
      const w = getWallConfig();
      if (w) {
        w.blur = e.target.checked;
        localStorage.setItem(wallpaperKey(), JSON.stringify(w));
      }
    };
  }

  const $clearWall = document.getElementById('clear-wall');
  if ($clearWall) {
    $clearWall.onclick = () => {
      const $wall = document.getElementById('wallpaper');
      if ($wall) {
        $wall.innerHTML = '';
        $wall.style.background = '';
      }
      localStorage.removeItem(wallpaperKey());
      const $wallUrl = document.getElementById('wall-url');
      if ($wallUrl) $wallUrl.value = '';
      notify('Wallpaper removido', '', 'info');
    };
  }
}

// ============================================================
// SISTEMA DE ARQUIVOS (virtual)
// ============================================================
function filesKey() { return userKey(LS.FILES); }

function initFiles() {
  try {
    state.files = JSON.parse(localStorage.getItem(filesKey()) || '{}');
  } catch {
    state.files = {};
  }
  if (!state.files['/']) {
    state.files['/'] = { type: 'folder', created: Date.now() };
  }
}

function saveFiles() {
  localStorage.setItem(filesKey(), JSON.stringify(state.files));
}

function createFile(path, content = '') {
  if (state.files[path]) {
    notify('Já existe', path, 'error');
    return false;
  }
  state.files[path] = {
    type: 'file',
    content,
    created: Date.now()
  };
  saveFiles();
  return true;
}

function createFolder(path) {
  if (state.files[path]) {
    notify('Já existe', path, 'error');
    return false;
  }
  state.files[path] = {
    type: 'folder',
    created: Date.now()
  };
  saveFiles();
  return true;
        }// ============================================================
// CONTEXT MENU GLOBAL
// ============================================================
function positionContextMenu(e) {
  const menu = $('#context-menu');
  if (!menu) return;
  menu.classList.add('open');

  const isMobile = window.innerWidth < 768;
  if (isMobile) {
    // No mobile, o CSS já posiciona (bottom sheet)
    return;
  }

  const menuW = menu.offsetWidth;
  const menuH = menu.offsetHeight;
  let x = e.clientX;
  let y = e.clientY;

  if (x + menuW > window.innerWidth - 8) x = window.innerWidth - menuW - 8;
  if (y + menuH > window.innerHeight - 8) y = window.innerHeight - menuH - 8;
  if (x < 8) x = 8;
  if (y < 8) y = 8;

  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

function hideContextMenu() {
  const menu = $('#context-menu');
  if (menu) menu.classList.remove('open');
}

function bindGlobalContextMenu() {
  // Clique direito no desktop/app-shell
  const desktop = document.getElementById('desktop');
  if (desktop) {
    desktop.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.app-icon')) return;
      e.preventDefault();
      showDesktopContextMenu(e);
    });
  }

  // Clique direito em qualquer lugar vazio
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.window')) return;
    if (e.target.closest('.app-icon')) return;
    if (e.target.closest('input, textarea')) return;
    if (e.target.closest('.modal-card')) return;
    if (e.target.closest('#context-menu')) return;
    if (e.target.closest('#desktop')) return; // já tratado acima

    e.preventDefault();
    showDesktopContextMenu(e);
  });

  // Fecha menu ao clicar
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#context-menu')) hideContextMenu();
  });

  // Fecha ao scroll / resize
  window.addEventListener('resize', hideContextMenu);
  window.addEventListener('blur', hideContextMenu);

  // ESC fecha
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu();
  });
}

function showDesktopContextMenu(e) {
  const menu = $('#context-menu');
  if (!menu) return;

  menu.innerHTML = `
    <button data-action="refresh">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6M1 20v-6h6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
      </svg>
      Atualizar
    </button>
    <div class="cm-divider"></div>
    <button data-action="new-folder">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      Nova pasta
    </button>
    <button data-action="new-file">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
      </svg>
      Novo arquivo
    </button>
    <button data-action="new-app">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
      </svg>
      Adicionar app
    </button>
    <div class="cm-divider"></div>
    <button data-action="change-wall">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
      </svg>
      Trocar wallpaper
    </button>
    <button data-action="fullscreen">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>
      </svg>
      Tela cheia
    </button>
    <div class="cm-divider"></div>
    <button data-action="close-all">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
      Fechar todas janelas
    </button>
    <button data-action="settings">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
      Personalizar
    </button>
  `;

  menu.querySelector('[data-action="refresh"]').onclick = () => {
    hideContextMenu();
    location.reload();
  };
  menu.querySelector('[data-action="new-folder"]').onclick = () => {
    hideContextMenu();
    openFileModal('folder');
  };
  menu.querySelector('[data-action="new-file"]').onclick = () => {
    hideContextMenu();
    openFileModal('file');
  };
  menu.querySelector('[data-action="new-app"]').onclick = () => {
    hideContextMenu();
    openAddAppModal();
  };
  menu.querySelector('[data-action="change-wall"]').onclick = () => {
    hideContextMenu();
    openSettingsModal();
    setTimeout(() => {
      const el = document.getElementById('wall-url');
      if (el) el.focus();
    }, 200);
  };
  menu.querySelector('[data-action="fullscreen"]').onclick = () => {
    hideContextMenu();
    toggleFullscreen();
  };
  menu.querySelector('[data-action="close-all"]').onclick = async () => {
    hideContextMenu();
    if (!state.windows.length) return;
    const ok = await customConfirm('Fechar todas as janelas?', '');
    if (!ok) return;
    [...state.windows].forEach(w => closeWindow(w.id));
  };
  menu.querySelector('[data-action="settings"]').onclick = () => {
    hideContextMenu();
    openSettingsModal();
  };

  positionContextMenu(e);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
}

// ============================================================
// MODAIS — helpers
// ============================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function bindModalCloseButtons() {
  $$('.modal').forEach(modal => {
    modal.querySelectorAll('[data-close]').forEach(btn => {
      btn.onclick = () => modal.classList.remove('open');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  });
}

// ============================================================
// MODAL — ADICIONAR APP
// ============================================================
function openAddAppModal() {
  openModal('modal-add');
  // Reset
  const ids = ['new-name', 'new-url', 'new-icon', 'nat-name', 'nat-package', 'nat-icon'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const $preview = document.getElementById('icon-preview');
  if ($preview) $preview.innerHTML = '🌐';
  const $natPreview = document.getElementById('nat-icon-preview');
  if ($natPreview) $natPreview.innerHTML = '🔥';
  switchAddAppTab('link');
}

function switchAddAppTab(tab) {
  $$('#modal-add .tab-mini button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const $link = document.getElementById('form-link');
  const $native = document.getElementById('form-native');
  if ($link) $link.style.display = tab === 'link' ? 'block' : 'none';
  if ($native) $native.style.display = tab === 'native' ? 'block' : 'none';
}

function bindAddAppUI() {
  $$('#modal-add .tab-mini button').forEach(b => {
    b.onclick = () => switchAddAppTab(b.dataset.tab);
  });

  // Preview do ícone link
  const $newIcon = document.getElementById('new-icon');
  const $iconPreview = document.getElementById('icon-preview');
  if ($newIcon) {
    $newIcon.oninput = (e) => {
      const v = e.target.value.trim();
      $iconPreview.innerHTML = isImageUrl(v) ? `<img src="${escapeHTML(v)}" alt="">` : escapeHTML(v || '🌐');
    };
  }

  const $iconFile = document.getElementById('icon-file');
  if ($iconFile) {
    $iconFile.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        $iconPreview.innerHTML = `<img src="${reader.result}" alt="">`;
        $newIcon.value = reader.result;
      };
      reader.readAsDataURL(file);
    };
  }

  // Preview do ícone nativo
  const $natIcon = document.getElementById('nat-icon');
  const $natPreview = document.getElementById('nat-icon-preview');
  if ($natIcon) {
    $natIcon.oninput = (e) => {
      const v = e.target.value.trim();
      $natPreview.innerHTML = isImageUrl(v) ? `<img src="${escapeHTML(v)}" alt="">` : escapeHTML(v || '🔥');
    };
  }

  const $natFile = document.getElementById('nat-icon-file');
  if ($natFile) {
    $natFile.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        $natPreview.innerHTML = `<img src="${reader.result}" alt="">`;
        $natIcon.value = reader.result;
      };
      reader.readAsDataURL(file);
    };
  }

  // Salvar
  const $save = document.getElementById('save-new-app');
  if ($save) {
    $save.onclick = () => {
      const isNative = document.getElementById('form-native').style.display !== 'none';

      if (isNative) {
        const name = document.getElementById('nat-name').value.trim();
        const pkg = document.getElementById('nat-package').value.trim();
        const icon = document.getElementById('nat-icon').value.trim() || '🔥';
        if (!name || !pkg) {
          notify('Faltou informação', 'Preencha nome e package', 'error');
          return;
        }
        addApp({
          name,
          url: `intent://#Intent;package=${pkg};end`,
          icon,
          embed: false,
          native: true,
          package: pkg,
          fullscreen: true
        });
      } else {
        const name = document.getElementById('new-name').value.trim();
        const url = document.getElementById('new-url').value.trim();
        const icon = document.getElementById('new-icon').value.trim() || '🌐';
        const embed = document.getElementById('new-embed').checked;
        const fullscreen = document.getElementById('new-fullscreen').checked;
        if (!name || !url) {
          notify('Faltou informação', 'Preencha nome e URL', 'error');
          return;
        }
        addApp({ name, url, icon, embed, fullscreen });
      }
      closeModal('modal-add');
    };
  }
}

// ============================================================
// MODAL — PERFIL
// ============================================================
function bindUserUI() {
  const $btnUser = document.getElementById('btn-user');
  if ($btnUser) {
    $btnUser.onclick = () => openModal('modal-user');
  }
}

// ============================================================
// MODAL — PERSONALIZAÇÃO
// ============================================================
function openSettingsModal() {
  openModal('modal-settings');
  syncPrefsUI();
}

function bindSettingsUI() {
  const $btn = document.getElementById('btn-settings');
  if ($btn) {
    $btn.onclick = openSettingsModal;
  }
}

// ============================================================
// MODAL — NOVO ARQUIVO / PASTA
// ============================================================
let fileModalMode = 'file';

function openFileModal(mode) {
  fileModalMode = mode;
  const $title = document.getElementById('file-modal-title');
  const $wrap = document.getElementById('file-content-wrap');
  if ($title) $title.textContent = mode === 'file' ? 'Novo arquivo' : 'Nova pasta';
  if ($wrap) $wrap.style.display = mode === 'file' ? 'block' : 'none';
  const $name = document.getElementById('file-name');
  const $content = document.getElementById('file-content');
  if ($name) $name.value = '';
  if ($content) $content.value = '';
  openModal('modal-file');
  setTimeout(() => $name?.focus(), 100);
}

function bindFileModalUI() {
  const $save = document.getElementById('file-save');
  if (!$save) return;
  $save.onclick = () => {
    const name = document.getElementById('file-name').value.trim();
    if (!name) {
      notify('Faltou nome', '', 'error');
      return;
    }
    const path = name.startsWith('/') ? name : '/' + name;

    if (fileModalMode === 'folder') {
      if (createFolder(path)) {
        notify('Pasta criada', path, 'success');
        closeModal('modal-file');
      }
    } else {
      const content = document.getElementById('file-content').value || '';
      if (createFile(path, content)) {
        notify('Arquivo criado', path, 'success');
        closeModal('modal-file');
      }
    }
  };
}

// ============================================================
// BOTÕES DA TASKBAR
// ============================================================
function bindTaskbarUI() {
  const $home = document.getElementById('btn-home');
  if ($home) {
    $home.onclick = () => {
      state.windows.forEach(w => {
        w.minimized = true;
        const el = document.getElementById(`win-${w.id}`);
        if (el) el.style.display = 'none';
      });
      renderTasks();
    };
    $home.oncontextmenu = (e) => {
      e.preventDefault();
      showDesktopContextMenu(e);
    };
  }

  const $add = document.getElementById('btn-add-app');
  if ($add) $add.onclick = openAddAppModal;

  const $music = document.getElementById('btn-music');
  if ($music) {
    $music.onclick = () => {
      const musicApp = state.apps.find(a => a.id === 'music') || {
        id: 'music', name: 'Música', icon: '🎵', url: 'music.html', embed: true
      };
      openApp(musicApp);
    };
  }
}

// ============================================================
// BUSCA
// ============================================================
function bindSearch() {
  const $search = document.getElementById('search');
  if (!$search) return;
  $search.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderGrid(state.apps);
      return;
    }
    renderGrid(state.apps.filter(a => a.name.toLowerCase().includes(q)));
  });
}

// ============================================================
// ATALHOS DE TECLADO
// ============================================================
function bindKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + R — recarregar app focado
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
      e.preventDefault();
      const focused = state.windows.slice().sort((a, b) => b.zIndex - a.zIndex)[0];
      if (focused) {
        const iframe = document.querySelector(`#win-${focused.id} iframe`);
        if (iframe) iframe.src = iframe.src;
      } else {
        location.reload();
      }
    }

    // Ctrl/Cmd + W — fechar janela focada
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
      e.preventDefault();
      const focused = state.windows.slice().sort((a, b) => b.zIndex - a.zIndex)[0];
      if (focused) closeWindow(focused.id);
    }

    // F11 — fullscreen
    if (e.key === 'F11') {
      e.preventDefault();
      toggleFullscreen();
    }

    // Ctrl/Cmd + K — focar busca
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const $search = document.getElementById('search');
      if ($search) $search.focus();
    }

    // Esc — fecha modais e menus
    if (e.key === 'Escape') {
      $$('.modal.open').forEach(m => m.classList.remove('open'));
      hideContextMenu();
    }
  });
}

// ============================================================
// BOTÃO VOLTAR ANDROID
// ============================================================
function bindAndroidBack() {
  window.addEventListener('popstate', () => {
    const openModalEl = document.querySelector('.modal.open');
    if (openModalEl) {
      openModalEl.classList.remove('open');
      history.pushState(null, '', location.href);
      return;
    }
    const menu = document.getElementById('context-menu');
    if (menu && menu.classList.contains('open')) {
      hideContextMenu();
      history.pushState(null, '', location.href);
      return;
    }
    const lastWin = state.windows[state.windows.length - 1];
    if (lastWin) {
      closeWindow(lastWin.id);
      history.pushState(null, '', location.href);
    }
  });
  history.pushState(null, '', location.href);
}

// Bloqueia zoom com pinça
document.addEventListener('gesturestart', e => e.preventDefault());

// ============================================================
// DETECÇÃO DE APP NATIVO (Android WebView)
// ============================================================
function isNativeAndroid() {
  return typeof window.Android !== 'undefined' && window.Android !== null;
}// ============================================================
// BIND ALL UI (chamado após login)
// ============================================================
function bindAllUI() {
  bindAuthTabs();
  bindAvatarUpload();
  bindAuthForms();
  bindConfirmModal();
  bindAddAppUI();
  bindUserUI();
  bindSettingsUI();
  bindPrefsUI();
  bindFileModalUI();
  bindTaskbarUI();
  bindWallpaperUI();
  bindSearch();
  bindGlobalContextMenu();
  bindModalCloseButtons();
  bindKeyboardShortcuts();
  bindAndroidBack();

  // Ajusta estado inicial da taskbar customizada
  applyPrefs();
}

// ============================================================
// ABERTURA DO APP NATIVO (Android WebView + Intent)
// ============================================================
function launchNativeApp(pkg) {
  if (isNativeAndroid() && typeof window.Android.launchApp === 'function') {
    try {
      window.Android.launchApp(pkg);
      return true;
    } catch (err) {
      notify('Erro ao abrir app', pkg, 'error');
      return false;
    }
  }
  notify(
    'App nativo indisponível',
    'Este recurso só funciona na versão APK do WebDEX.',
    'warn'
  );
  return false;
}

// Intercepta abertura de apps nativos
const _originalOpenApp = openApp;
openApp = function(app) {
  if (app.native && app.package) {
    const ok = launchNativeApp(app.package);
    if (ok) return;
  }
  return _originalOpenApp(app);
};

// ============================================================
// BOOT — Checa sessão e inicia
// ============================================================
(async function boot() {
  // Esconde a boot screen após ~1.8s
  const bootScreen = document.getElementById('boot-screen');
  setTimeout(() => {
    if (bootScreen) {
      bootScreen.classList.add('hide');
      setTimeout(() => {
        if (bootScreen.parentNode) bootScreen.style.display = 'none';
      }, 700);
    }
  }, 1800);

  // Sempre bind os listeners básicos da tela auth ANTES de checar sessão
  // (caso contrário, o botão Registrar não responde)
  document.addEventListener('DOMContentLoaded', () => {
    // nada — o DOM já está pronto nesse ponto
  });

  bindAuthTabs();
  bindAvatarUpload();
  bindAuthForms();
  bindConfirmModal();

  // Checa se tem sessão salva
  const sess = localStorage.getItem(LS.SESSION);
  if (sess) {
    try {
      const { username, hash } = JSON.parse(sess);
      const user = getUsers().find(u => u.name === username && u.pass === hash);
      if (user) {
        state.user = username;
        // Aguarda boot terminar pra entrar
        setTimeout(() => enterApp(), 1600);
        return;
      }
    } catch (err) {
      console.warn('Sessão inválida:', err);
    }
    localStorage.removeItem(LS.SESSION);
  }

  // Sem sessão: mostra tela de login após boot
  setTimeout(() => {
    if ($authScreen) $authScreen.style.display = 'flex';
  }, 1600);
})();

// ============================================================
// EXPÕE API GLOBAL (pra debug / apps internos)
// ============================================================
window.WebDEX = {
  state,
  notify,
  openApp,
  closeWindow,
  toggleMaximize,
  minimizeWindow,
  focusWindow,
  setWallpaper,
  createFile,
  createFolder,
  getWallConfig,
  savePrefs,
  applyPrefs,
  renderGrid,
  renderTasks
};

console.log('%cWebDEX 4.0', 'color:#4cc2ff;font-size:20px;font-weight:bold');
console.log('%cSistema carregado com sucesso!', 'color:#888;font-size:12px');
