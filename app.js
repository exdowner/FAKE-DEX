// ============================================================
// WebDEX 11 — Lógica principal
// ============================================================

const STORAGE = {
  APPS: 'webdex.apps',
  WALL: 'webdex.wallpaper',
  ACCENT: 'webdex.accent'
};

const state = {
  apps: [],
  windows: [],
  zTop: 10
};

const $grid = document.getElementById('app-grid');
const $windows = document.getElementById('windows');
const $tasks = document.getElementById('tasks');
const $search = document.getElementById('search');
const $wall = document.getElementById('wallpaper');

// ============================================================
// PERSISTÊNCIA
// ============================================================
function saveApps() {
  localStorage.setItem(STORAGE.APPS, JSON.stringify(state.apps));
}
function loadStoredApps() {
  try {
    const raw = localStorage.getItem(STORAGE.APPS);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ============================================================
// APPS
// ============================================================
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
    { id: 'calc', name: 'Calculadora', icon: '🧮', url: 'apps/calc.html', embed: true, internal: true },
    { id: 'notes', name: 'Notas', icon: '📝', url: 'apps/notes.html', embed: true, internal: true },
    { id: 'terminal', name: 'Terminal', icon: '💻', url: 'apps/terminal.html', embed: true, internal: true },
    { id: 'settings', name: 'Config', icon: '⚙️', url: 'apps/settings.html', embed: true, internal: true }
  ];
}

function renderGrid(apps) {
  $grid.innerHTML = '';
  apps.forEach((app, i) => {
    const el = document.createElement('div');
    el.className = 'app-icon';
    el.style.animationDelay = (i * 20) + 'ms';

    const iconHTML = isImageUrl(app.icon)
      ? `<img src="${app.icon}" alt="${app.name}" />`
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
  return typeof str === 'string' && /^https?:\/\/.+\.(png|jpe?g|gif|svg|webp|ico)/i.test(str);
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
  // Fecha janela se aberta
  const win = state.windows.find(w => w.appId === id);
  if (win) closeWindow(win.id);
}

// ============================================================
// JANELAS
// ============================================================
function openApp(app) {
  const existing = state.windows.find(w => w.appId === app.id);
  if (existing) {
    focusWindow(existing.id);
    if (existing.minimized) {
      existing.minimized = false;
      document.getElementById(`win-${existing.id}`).style.display = 'flex';
      renderTasks();
    }
    return;
  }

  const id = crypto.randomUUID();
  const isMobile = window.innerWidth < 768;
  const offset = state.windows.length * 28;

  const win = {
    id,
    appId: app.id,
    app,
    x: isMobile ? 0 : 80 + offset,
    y: isMobile ? 0 : 60 + offset,
    w: isMobile ? window.innerWidth : 860,
    h: isMobile ? window.innerHeight - 108 : 540,
    minimized: false,
    maximized: false,
    zIndex: ++state.zTop
  };
  state.windows.push(win);
  renderWindow(win);
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

  el.innerHTML = `
    <div class="window-header">
      <div class="window-icon">${iconHTML}</div>
      <div class="window-title">${win.app.name}</div>
      <div class="window-controls">
        <button class="window-btn min" title="Minimizar">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6h8" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
        <button class="window-btn max" title="Maximizar">
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
        <button class="window-btn close" title="Fechar">
          <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.2"/></svg>
        </button>
      </div>
    </div>
    <div class="window-body">
      ${canEmbed
        ? `<iframe src="${win.app.url}" allow="clipboard-read; clipboard-write; fullscreen" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"></iframe>`
        : `<div class="window-placeholder">
             <div class="icon-big">${iconHTML}</div>
             <p>⚠️ Este site bloqueia incorporação em iframe (política X-Frame-Options).</p>
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

  $windows.appendChild(el);
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

function toggleMaximize(id) {
  const win = state.windows.find(w => w.id === id);
  const el = document.getElementById(`win-${id}`);
  if (!win || !el) return;

  if (win.maximized) {
    win.x = win._prevX; win.y = win._prevY;
    win.w = win._prevW; win.h = win._prevH;
    win.maximized = false;
  } else {
    win._prevX = win.x; win._prevY = win.y;
    win._prevW = win.w; win._prevH = win.h;
    win.x = 0; win.y = 0;
    win.w = window.innerWidth;
    win.h = window.innerHeight - 108;
    win.maximized = true;
  }
  el.style.left = win.x + 'px';
  el.style.top = win.y + 'px';
  el.style.width = win.w + 'px';
  el.style.height = win.h + 'px';
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

  const move = (e) => {
    if (!dragging) return;
    win.x = Math.max(-win.w + 100, Math.min(window.innerWidth - 100, origX + (e.clientX - startX)));
    win.y = Math.max(0, Math.min(window.innerHeight - 108, origY + (e.clientY - startY)));
    el.style.left = win.x + 'px';
    el.style.top = win.y + 'px';
  };
  const up = () => { dragging = false; document.body.style.userSelect = ''; };

  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function makeResizable(el, handle, win) {
  let resizing = false, startX, startY, origW, origH;
  handle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    resizing = true;
    startX = e.clientX; startY = e.clientY;
    origW = win.w; origH = win.h;
    document.body.style.userSelect = 'none';
  });
  const move = (e) => {
    if (!resizing) return;
    win.w = Math.max(320, origW + (e.clientX - startX));
    win.h = Math.max(240, origH + (e.clientY - startY));
    el.style.width = win.w + 'px';
    el.style.height = win.h + 'px';
  };
  const up = () => { resizing = false; document.body.style.userSelect = ''; };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

// ============================================================
// TASKBAR
// ============================================================
function renderTasks() {
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
$search.addEventListener('input', (e) => {
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
    now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
setInterval(tickClock, 1000);
tickClock();

// ============================================================
// BOTÃO HOME
// ============================================================
document.getElementById('btn-home').onclick = () => {
  state.windows.forEach(w => {
    w.minimized = true;
    const el = document.getElementById(`win-${w.id}`);
    if (el) el.style.display = 'none';
  });
  renderTasks();
};

// ============================================================
// MODAL: ADICIONAR APP
// ============================================================
const $modalAdd = document.getElementById('modal-add');
document.getElementById('btn-add-app').onclick = () => $modalAdd.classList.add('open');
$modalAdd.querySelectorAll('[data-close]').forEach(b =>
  b.onclick = () => $modalAdd.classList.remove('open')
);
$modalAdd.addEventListener('click', e => {
  if (e.target === $modalAdd) $modalAdd.classList.remove('open');
});

document.getElementById('save-new-app').onclick = () => {
  const name = document.getElementById('new-name').value.trim();
  const url = document.getElementById('new-url').value.trim();
  const icon = document.getElementById('new-icon').value.trim() || '🌐';
  const embed = document.getElementById('new-embed').checked;

  if (!name || !url) return alert('Preencha nome e URL');

  addApp({ name, url, icon, embed, id: 'app-' + Date.now() });
  document.getElementById('new-name').value = '';
  document.getElementById('new-url').value = '';
  document.getElementById('new-icon').value = '';
  $modalAdd.classList.remove('open');
};

// ============================================================
// MODAL: CONFIGURAÇÕES + WALLPAPER
// ============================================================
const $modalSet = document.getElementById('modal-settings');
document.getElementById('btn-settings').onclick = () => $modalSet.classList.add('open');
$modalSet.querySelectorAll('[data-close]').forEach(b =>
  b.onclick = () => $modalSet.classList.remove('open')
);
$modalSet.addEventListener('click', e => {
  if (e.target === $modalSet) $modalSet.classList.remove('open');
});

// Accent color
const $accent = document.getElementById('accent-picker');
$accent.oninput = (e) => {
  document.documentElement.style.setProperty('--accent', e.target.value);
  localStorage.setItem(STORAGE.ACCENT, e.target.value);
};

// Wallpaper URL
const $wallUrl = document.getElementById('wall-url');
$wallUrl.onchange = (e) => {
  const url = e.target.value.trim();
  if (!url) return;
  setWallpaper({ type: 'url', value: url });
};

// Wallpaper file
const $wallFile = document.getElementById('wall-file');
$wallFile.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => setWallpaper({ type: 'data', value: reader.result, isVideo: file.type.startsWith('video') });
  reader.readAsDataURL(file);
};

// Blur toggle
const $wallBlur = document.getElementById('wall-blur');
$wallBlur.onchange = (e) => {
  $wall.classList.toggle('blur', e.target.checked);
  const w = getWallConfig();
  if (w) { w.blur = e.target.checked; localStorage.setItem(STORAGE.WALL, JSON.stringify(w)); }
};

// Limpar
document.getElementById('clear-wall').onclick = () => {
  $wall.innerHTML = '';
  $wall.style.background = '';
  localStorage.removeItem(STORAGE.WALL);
  $wallUrl.value = '';
};

function setWallpaper(cfg) {
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

  localStorage.setItem(STORAGE.WALL, JSON.stringify(cfg));
}

function getWallConfig() {
  try { return JSON.parse(localStorage.getItem(STORAGE.WALL)); } catch { return null; }
}

function restoreWallpaper() {
  const cfg = getWallConfig();
  if (cfg) {
    setWallpaper(cfg);
    if (cfg.blur) $wallBlur.checked = true;
  }
  const accent = localStorage.getItem(STORAGE.ACCENT);
  if (accent) {
    document.documentElement.style.setProperty('--accent', accent);
    $accent.value = accent;
  }
}

// ============================================================
// BOTÃO VOLTAR (Android)
// ============================================================
window.addEventListener('popstate', () => {
  const anyModal = document.querySelector('.modal.open');
  if (anyModal) { anyModal.classList.remove('open'); history.pushState(null, '', location.href); return; }
  const lastWin = state.windows[state.windows.length - 1];
  if (lastWin) { closeWindow(lastWin.id); history.pushState(null, '', location.href); }
});
history.pushState(null, '', location.href);

// Bloqueia zoom
document.addEventListener('gesturestart', e => e.preventDefault());

// ============================================================
// INIT
// ============================================================
initApps();
restoreWallpaper();
