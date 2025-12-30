const API_URL = '/api/storage/startup_planner.json';
let startups = [];
let currentStartupId = null;

// DOM Elements
const sidebarList = document.getElementById('startup-list');
const mainContent = document.getElementById('main-content');
const emptyState = document.getElementById('empty-state');
const canvasView = document.getElementById('canvas-view');

const btnAddStartup = document.getElementById('btn-add-startup');
const modalAddStartup = document.getElementById('modal-add-startup');
const formAddStartup = document.getElementById('form-add-startup');
const inpStartupName = document.getElementById('inp-startup-name');
const inpDesignerName = document.getElementById('inp-designer-name');

const startupNameInput = document.getElementById('startup-name-input');
const designerNameDisplay = document.getElementById('designer-name');
const btnSaveCanvas = document.getElementById('btn-save-canvas');
const btnDeleteStartup = document.getElementById('btn-delete-startup');

// Theme check
function checkTheme() {
    if (window.parent) {
        window.parent.postMessage({ type: 'request-theme' }, '*');
    }
}

window.addEventListener('message', (event) => {
    if (event.data.type === 'theme-change') {
        document.documentElement.setAttribute('data-theme', event.data.theme);
    }
});

checkTheme();

// Init
async function init() {
    await fetchStartups();
    renderSidebar();
}

async function fetchStartups() {
    try {
        const res = await fetch(API_URL);
        if (res.ok) {
            startups = await res.json();
            if (!Array.isArray(startups)) startups = [];
        } else {
            startups = [];
        }
    } catch (e) {
        console.error("Failed to load startups", e);
        startups = [];
    }
}

async function saveStartups() {
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: startups })
        });
    } catch (e) {
        console.error("Failed to save startups", e);
        alert("Failed to save changes.");
    }
}

function renderSidebar() {
    sidebarList.innerHTML = '';
    startups.forEach(s => {
        const btn = document.createElement('button');
        btn.className = `btn-sidebar ${s.id === currentStartupId ? 'active' : ''}`;
        btn.innerHTML = `<i class="fas fa-rocket"></i> ${s.name}`;
        btn.onclick = () => loadStartup(s.id);
        sidebarList.appendChild(btn);
    });

    if (startups.length === 0) {
        sidebarList.innerHTML = '<div style="padding:10px; font-size:0.8rem; opacity:0.5;">No startups yet.</div>';
    }
}

function loadStartup(id) {
    currentStartupId = id;
    const startup = startups.find(s => s.id === id);

    if (!startup) {
        showEmptyState();
        return;
    }

    // Update Sidebar Active State
    renderSidebar();

    // Show Canvas
    emptyState.style.display = 'none';
    canvasView.style.display = 'flex';

    // Populate Header
    startupNameInput.value = startup.name || '';
    designerNameDisplay.textContent = startup.designedBy || 'User';

    // Populate Canvas Fields
    const fields = document.querySelectorAll('textarea[data-field]');
    fields.forEach(field => {
        const key = field.getAttribute('data-field');
        field.value = startup[key] || '';
    });
}

function showEmptyState() {
    currentStartupId = null;
    emptyState.style.display = 'flex';
    canvasView.style.display = 'none';
    renderSidebar();
}

// Actions
btnAddStartup.onclick = () => {
    modalAddStartup.classList.add('open');
    inpStartupName.value = '';
    inpStartupName.focus();
};

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = () => {
        modalAddStartup.classList.remove('open');
    };
});

formAddStartup.onsubmit = async (e) => {
    e.preventDefault();
    const name = inpStartupName.value.trim();
    const designer = inpDesignerName.value.trim() || 'User';

    if (!name) return;

    const newStartup = {
        id: crypto.randomUUID(),
        name: name,
        designedBy: designer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    startups.push(newStartup);
    await saveStartups();
    modalAddStartup.classList.remove('open');
    loadStartup(newStartup.id);
};

// Save Canvas
async function saveCurrentStartup() {
    if (!currentStartupId) return;
    const startup = startups.find(s => s.id === currentStartupId);
    if (!startup) return;

    // Update fields
    const fields = document.querySelectorAll('textarea[data-field]');
    fields.forEach(field => {
        const key = field.getAttribute('data-field');
        startup[key] = field.value;
    });

    // Update Name
    startup.name = startupNameInput.value.trim() || "Untitled Startup";

    startup.updatedAt = new Date().toISOString();

    await saveStartups();
    renderSidebar(); // Update name in sidebar
}

btnSaveCanvas.onclick = () => {
    saveCurrentStartup();
    // Visual feedback?
    const originalText = btnSaveCanvas.innerHTML;
    btnSaveCanvas.innerHTML = '<i class="fas fa-check"></i> Saved';
    setTimeout(() => {
        btnSaveCanvas.innerHTML = originalText;
    }, 1500);
};

// Auto-save name on blur
startupNameInput.addEventListener('blur', () => {
    saveCurrentStartup();
});

// Delete
btnDeleteStartup.onclick = async () => {
    if (!confirm("Are you sure you want to delete this startup?")) return;

    startups = startups.filter(s => s.id !== currentStartupId);
    await saveStartups();
    showEmptyState();
};

// Initial Load
init();

