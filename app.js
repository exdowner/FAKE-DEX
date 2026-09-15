// ===================== ESTADO =====================
const state = {
  apps: [],
  windows: [], // { id, appId, x, y, w, h, minimized, zIndex }
  zTop: 10
};

const $grid = document.getElementById('app-grid');
const $windows = document.getElementById('windows');
const $tasks = document.getElementById('tasks');
const $search = document.getElementById('search');

// ===================== CARREGAR APPS =====================
async function loadApps() {
  const res = await fetch('apps.json');
  state.apps = await res.json();
  renderGrid(state.apps);
}

function renderGrid(apps) {
  $grid.innerHTML = '';
  apps.forEach(app => {
    const el = document.createElement('div');
    el.className = 'app-icon';
    el.innerHTML = `
      <span class="emoji">${app.icon}</span>
      <span class="name">${app.name}</span>
    `;
    el.onclick = () => openApp(app);
    $grid.appendChild(el);
  });
}

// ===================== ABRIR APP =====================
function openApp(app) {
  // Já está aberto? Foca.
  const existing = state.windows.find(w => w.appId === app.id);
  if (existing) {
    existing.minimized = false;
    focusWindow(existing.id);
    return;
  }

  const id = crypto.randomUUID();
  const win = {
    id,
    appId: app.id,
    app,
    x: 80 + state.windows.length * 30,
    y: 60 + state.windows.length * 30,
    w: 800,
    h: 500,
    minimized: false,
    zIndex: ++state.zTop
  };
  state.windows.push(win);
  renderWindow(win);
  renderTasks();
}

// ===================== RENDER JANELA =====================
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

  el.innerHTML = `
    <div class="window-header">
      <span>${win.app.icon}</span>
      <span class="window-title">${win.app.name}</span>
      <button class="window-btn min" title="Minimizar">—</button>
      <button class="window-btn close" title="Fechar">✕</button>
    </div>
    ${canEmbed
      ? `<iframe src="${win.app.url}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`
      : `<div class="placeholder">
           <p>⚠️ Este site bloqueia incorporação (iframe).</p>
           <button>Abrir em nova aba</button>
         </div>`
    }
  `;

  // Botões
  el.querySelector('.min').onclick = (e) => {
    e.stopPropagation();
    win.minimized = true;
    el.style.display = 'none';
    renderTasks();
  };
  el.querySelector('.close').onclick = (e) => {
    e.stopPropagation();
    closeWindow(win.id);
  };
  const btnOpen = el.querySelector('.placeholder button');
  if (btnOpen) btnOpen.onclick = () => window.open(win.app.url, '_blank');

  // Foco ao clicar
  el.addEventListener('mousedown', () => focusWindow(win.id));

  // Arrastar pela header
  makeDraggable(el, el.querySelector('.window-header'), win);

  $windows.appendChild(el);
}

// ===================== ARRASTAR =====================
function makeDraggable(el, handle, win) {
  let startX, startY, origX, origY, dragging = false;

  handle.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origX = win.x;
    origY = win.y;
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    win.x = origX + (e.clientX - startX);
    win.y = Math.max(0, origY + (e.clientY - startY));
    el.style.left = win.x + 'px';
    el.style.top = win.y + 'px';
  });

  document.addEventListener('mouseup', () => {
    dragging = false;
    document.body.style.userSelect = '';
  });
}

// ===================== FOCO / Z-INDEX =====================
function focusWindow(id) {
  const win = state.windows.find(w => w.id === id);
  if (!win) return;
  win.zIndex = ++state.zTop;
  win.minimized = false;
  const el = document.getElementById(`win-${id}`);
  el.style.zIndex = win.zIndex;
  el.style.display = 'flex';
  renderTasks();
}

// ===================== FECHAR =====================
function closeWindow(id) {
  state.windows = state.windows.filter(w => w.id !== id);
  document.getElementById(`win-${id}`)?.remove();
  renderTasks();
}

// ===================== TASKBAR =====================
function renderTasks() {
  $tasks.innerHTML = '';
  state.windows.forEach(win => {
    const btn = document.createElement('button');
    btn.className = 'task' + (win.minimized ? '' : ' active');
    btn.textContent = `${win.app.icon} ${win.app.name}`;
    btn.onclick = () => {
      if (win.minimized) focusWindow(win.id);
      else {
        win.minimized = true;
        document.getElementById(`win-${win.id}`).style.display = 'none';
        renderTasks();
      }
    };
    $tasks.appendChild(btn);
  });
}

// ===================== BUSCA =====================
$search.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  renderGrid(state.apps.filter(a => a.name.toLowerCase().includes(q)));
});

// ===================== RELÓGIO =====================
setInterval(() => {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}, 1000);

// ===================== BOTÃO HOME =====================
document.getElementById('btn-home').onclick = () => {
  state.windows.forEach(w => {
    w.minimized = true;
    document.getElementById(`win-${w.id}`).style.display = 'none';
  });
  renderTasks();
};

// ===================== INIT =====================
loadApps();
