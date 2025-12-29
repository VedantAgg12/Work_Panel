document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const navToggle = document.getElementById('nav-toggle');
    const quickToggle = document.getElementById('quick-action-toggle');
    const notificationToggle = document.getElementById('notification-toggle');
    const themeToggle = document.getElementById('theme-toggle');

    // UI Elements
    const navDrawer = document.getElementById('nav-drawer');
    const quickDrawer = document.getElementById('quick-drawer');
    const notificationPopup = document.getElementById('notification-popup');
    const overlay = document.getElementById('drawer-overlay');
    const closeButtons = document.querySelectorAll('.close-drawer');
    const navLinks = document.querySelectorAll('.nav-link');
    const contentFrame = document.getElementById('content-frame');

    // Central State
    const appState = {
        theme: localStorage.getItem('theme') || 'dark',
        visible_notifications: localStorage.getItem('visible_notifications') !== 'false', // Default true
        visible_quick_actions: localStorage.getItem('visible_quick_actions') !== 'false', // Default true
        visible_themes: localStorage.getItem('visible_themes') !== 'false' // Default true
    };

    // --- Initialization ---
    // Apply Theme
    document.documentElement.setAttribute('data-theme', appState.theme);

    // Apply Visibility
    updateHeaderVisibility();

    // --- Notification Logic ---
    if (notificationToggle) {
        notificationToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationPopup.classList.toggle('active');
        });
    }

    // Close notifications when clicking outside
    document.addEventListener('click', (e) => {
        if (notificationPopup && !notificationPopup.contains(e.target) && notificationToggle && !notificationToggle.contains(e.target)) {
            notificationPopup.classList.remove('active');
        }
    });

    // --- Theme Logic (Simple Toggle) ---
    function toggleTheme() {
        const newTheme = appState.theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }

    function setTheme(theme) {
        appState.theme = theme;
        document.documentElement.setAttribute('data-theme', appState.theme);
        localStorage.setItem('theme', appState.theme);
        notifyIframeTheme(appState.theme);

        // Update Icon
        const icon = themeToggle.querySelector('i');
        if (icon) {
            if (theme === 'dark') {
                icon.className = 'fas fa-moon';
            } else {
                icon.className = 'fas fa-sun';
            }
        }
    }

    // Header Theme Button
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            toggleTheme();
        });
    }

    // --- State Management ---
    function updateHeaderVisibility() {
        if (notificationToggle) notificationToggle.style.display = appState.visible_notifications ? 'flex' : 'none';
        if (quickToggle) quickToggle.style.display = appState.visible_quick_actions ? 'flex' : 'none';
        if (themeToggle) themeToggle.style.display = appState.visible_themes ? 'flex' : 'none';

        // Save to local storage
        localStorage.setItem('visible_notifications', appState.visible_notifications);
        localStorage.setItem('visible_quick_actions', appState.visible_quick_actions);
        localStorage.setItem('visible_themes', appState.visible_themes);
    }

    // Broadcast state to iframe
    function broadcastState() {
        if (contentFrame && contentFrame.contentWindow) {
            contentFrame.contentWindow.postMessage({
                type: 'sync-state',
                state: appState
            }, '*');
        }
    }

    function notifyIframeTheme(theme) {
        if (contentFrame && contentFrame.contentWindow) {
            contentFrame.contentWindow.postMessage({ type: 'theme-change', theme: theme }, '*');
        }
    }

    // --- Message Handling ---
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (data.type === 'request-theme') {
            notifyIframeTheme(appState.theme);
        } else if (data.type === 'request-state') {
            broadcastState();
        } else if (data.type === 'open-theme-modal') {
            // Fallback to toggle if module requests modal
            toggleTheme();
        } else if (data.type === 'toggle-visibility') {
            // Update State
            if (data.target === 'notifications') appState.visible_notifications = data.visible;
            if (data.target === 'quickActions') appState.visible_quick_actions = data.visible;
            if (data.target === 'themes') appState.visible_themes = data.visible;

            // Update UI
            updateHeaderVisibility();

            // Re-broadcast (to ensure all listeners are in sync, if multiple)
            broadcastState();
        } else if (data.type === 'navigate') {
            loadModule(data.module);
            updateActiveLink(data.module);
        } else if (data.type === 'module-toggled') {
            // Find the link
            const link = document.querySelector(`.nav-link[data-module="${data.module}"]`);
            if (link) {
                // If it exists, toggle parent li visibility
                // We assume link is wrapped in <li>
                const li = link.closest('li');
                if (li) {
                    li.style.display = data.enabled ? '' : 'none';
                }
            }
        }
    });

    function updateActiveLink(moduleName) {
        navLinks.forEach(l => {
            l.classList.remove('active');
            if (l.getAttribute('data-module') === moduleName) {
                l.classList.add('active');
            }
        });
    }

    // --- Drawer Logic ---
    function openDrawer(drawer) {
        closeAllDrawers(false);
        drawer.classList.add('open');
        overlay.classList.add('active');
    }

    function closeAllDrawers(removeOverlay = true) {
        navDrawer.classList.remove('open');
        quickDrawer.classList.remove('open');
        if (removeOverlay) {
            overlay.classList.remove('active');
        }
    }

    if (navToggle) navToggle.addEventListener('click', () => openDrawer(navDrawer));
    if (quickToggle) quickToggle.addEventListener('click', () => openDrawer(quickDrawer));
    overlay.addEventListener('click', () => closeAllDrawers());

    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => closeAllDrawers());
    });

    // --- Navigation ---
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const moduleName = link.getAttribute('data-module');
            loadModule(moduleName);
            closeAllDrawers();
        });
    });

    function loadModule(moduleName) {
        if (moduleName === 'dashboard') {
            contentFrame.src = '/modules/dashboard/index.html';
        } else {
            contentFrame.src = `/modules/${moduleName}/index.html`;
        }
        contentFrame.addEventListener('load', () => {
            notifyIframeTheme(appState.theme);
            broadcastState();
        }, { once: true });
    }

    // Load initial module (Dashboard)
    loadModule('dashboard');

    // --- Quick Actions ---
    // REMOVED: Conflicting Quick Action listeners. 
    // Logic is now handled by inline script in base.html which opens global modals.
});


// --- Global Idea Vault Logic ---

async function populateGlobalIdeaCollections() {
    const select = document.getElementById('qa-idea-collection');
    if (!select) return;

    select.innerHTML = '<option value="">Loading...</option>';

    try {
        const res = await fetch('/api/storage/idea_vault.json');
        if (res.ok) {
            const data = await res.json();
            select.innerHTML = '<option value="">(None)</option>';

            if (data.collections && Array.isArray(data.collections)) {
                data.collections.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    select.appendChild(opt);
                });
            }
        } else {
            select.innerHTML = '<option value="">(None)</option>';
        }
    } catch (e) {
        console.error("Failed to load collections", e);
        select.innerHTML = '<option value="">Error</option>';
    }
}

async function saveGlobalIdea(e) {
    e.preventDefault();

    const title = document.getElementById('qa-idea-title').value;
    const desc = document.getElementById('qa-idea-desc').value;
    const stage = document.getElementById('qa-idea-stage').value;
    const priority = document.getElementById('qa-idea-priority').value;
    const collectionId = document.getElementById('qa-idea-collection').value;
    const description = document.getElementById('qa-idea-desc')?.value || "";

    const newIdea = {
        id: crypto.randomUUID(),
        title: title,
        stage: stage,
        priority: priority,
        collectionId: collectionId || null,
        description: description,
        created: new Date().toISOString(),
        upIdeaId: null,
        downIdeaIds: []
    };

    try {
        // Read existing
        const res = await fetch('/api/storage/idea_vault.json');
        let db = { ideas: [], collections: [] };
        if (res.ok) {
            db = await res.json();
        }

        if (!db.ideas) db.ideas = [];
        db.ideas.push(newIdea);

        // Save
        await fetch('/api/storage/idea_vault.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: db })
        });

        closeGlobalModal('qa-idea-modal');

        // Notify iframe if it's the idea vault
        const iframe = document.getElementById('content-frame');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'idea-added' }, '*');
        }

        // Show a success notification (simulated)
        alert("Idea Saved!");

    } catch (err) {
        console.error("Failed to save idea", err);
        alert("Failed to save idea");
    }
}

