
let currentView = 'grid';
let ideas = [];
let collections = [];
let selectedRootId = 'all'; // For mind map

document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    loadData();
    setupEventListeners();

    // Theme Sync
    window.addEventListener('message', (e) => {
        if (e.data.type === 'theme-change') {
            document.documentElement.setAttribute('data-theme', e.data.theme);
        } else if (e.data.type === 'idea-added') {
            loadData(); // Reload on external add
        }
    });

    // Request initial theme
    if (window.parent) {
        window.parent.postMessage({ type: 'request-theme' }, '*');
    }
}

function setupEventListeners() {
    // Nav Buttons
    document.querySelectorAll('.btn-sidebar[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-sidebar[data-view]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            updateControlsVisibility();
            render();
        });
    });

    // Controls
    const filterCol = document.getElementById('filter-collection');
    if (filterCol) {
        filterCol.addEventListener('change', render);
    }

    const selectRoot = document.getElementById('select-root-node');
    if (selectRoot) {
        selectRoot.addEventListener('change', (e) => {
            selectedRootId = e.target.value;
            render();
        });
    }

    // Modals
    document.getElementById('btn-new-idea').addEventListener('click', () => openModal('modal-idea'));
    document.getElementById('btn-new-collection').addEventListener('click', () => openModal('modal-collection'));

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('active');
        });
    });

    document.getElementById('form-idea').addEventListener('submit', saveIdea);
    document.getElementById('form-collection').addEventListener('submit', saveCollection);

    // Delete Button in Modal
    document.getElementById('btn-delete-idea').addEventListener('click', () => {
        const id = document.getElementById('inp-editing-id').value;
        if (id && confirm("Delete this idea and its children?")) {
            deleteIdea(id);
            document.getElementById('modal-idea').classList.remove('active');
        }
    });
}

function updateControlsVisibility() {
    const filterContainer = document.getElementById('grid-controls');
    const mapControls = document.getElementById('map-controls');

    if (filterContainer) filterContainer.style.display = currentView === 'grid' ? 'block' : 'none';
    if (mapControls) mapControls.style.display = currentView === 'mindmap' ? 'block' : 'none';
}

async function loadData() {
    try {
        const res = await fetch('/api/storage/idea_vault.json');
        if (res.ok) {
            const data = await res.json();
            ideas = data.ideas || [];
            collections = data.collections || [];
        } else {
            ideas = [];
            collections = [];
        }
        populateCollectionSelects();
        populateRootSelect();
        render();
    } catch (e) {
        console.error("Failed to load data", e);
    }
}

function render() {
    const container = document.getElementById('view-container');
    container.innerHTML = '';

    if (currentView === 'grid') {
        renderGridView(container);
    } else if (currentView === 'list') {
        renderListView(container);
    } else if (currentView === 'mindmap') {
        renderMindMap(container);
    } else if (currentView === 'collections') {
        renderCollectionsView(container);
    }
}

// --- Views ---

function renderCollectionsView(container) {
    if (collections.length === 0) {
        container.innerHTML = '<div style="opacity:0.5; text-align:center; margin-top:50px;">No collections found.</div>';
        return;
    }

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    collections.forEach(col => {
        const colIdeas = ideas.filter(i => i.collectionId === col.id);

        const item = document.createElement('div');
        item.className = 'accordion-item';

        // Header
        const header = document.createElement('div');
        header.className = 'accordion-header';
        header.onclick = (e) => {
            // Toggle body
            const content = item.querySelector('.accordion-content');
            content.classList.toggle('active');
        };

        header.innerHTML = `
            <div class="acc-title">${col.name}</div>
            <div class="acc-meta">${colIdeas.length} ideas</div>
            <div class="acc-actions">
                <button class="btn-sidebar" style="padding:5px; font-size:0.8rem;" id="btn-edit-col-${col.id}">
                    <i class="fas fa-pencil-alt"></i>
                </button>
                <button class="btn-sidebar" style="padding:5px; font-size:0.8rem;" id="btn-del-col-${col.id}">
                    <i class="fas fa-trash" style="color:#ff4444;"></i>
                </button>
            </div>
        `;

        // Body
        const content = document.createElement('div');
        content.className = 'accordion-content';

        if (colIdeas.length === 0) {
            content.innerHTML = '<div style="opacity:0.5; font-size:0.9rem; padding:10px;">No ideas in this collection.</div>';
        } else {
            colIdeas.forEach(idea => {
                const row = document.createElement('div');
                row.style.padding = '5px 0';
                row.style.borderBottom = '1px solid var(--border-color)';
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.fontSize = '0.9rem';
                row.style.cursor = 'pointer';
                row.onclick = () => openEditModal(idea);

                row.innerHTML = `
                    <span>${idea.title}</span>
                    <span style="opacity:0.6; font-size:0.8rem;">${idea.stage}</span>
                `;
                content.appendChild(row);
            });
        }

        item.appendChild(header);
        item.appendChild(content);
        list.appendChild(item);

        // Bind Actions (prevent bubble)
        setTimeout(() => {
            document.getElementById(`btn-edit-col-${col.id}`).onclick = (e) => {
                e.stopPropagation();
                editCollection(col);
            };
            document.getElementById(`btn-del-col-${col.id}`).onclick = (e) => {
                e.stopPropagation();
                deleteCollection(col.id);
            };
        }, 0);
    });

    container.appendChild(list);
}

function editCollection(col) {
    openModal('modal-collection');
    document.getElementById('inp-col-name').value = col.name;
    document.getElementById('inp-col-editing-id').value = col.id;
    document.querySelector('#modal-collection h3').textContent = 'Edit Collection';
    document.querySelector('#modal-collection button[type="submit"]').textContent = 'Save Changes';
}

async function saveCollection(e) {
    e.preventDefault();
    const name = document.getElementById('inp-col-name').value;
    const editingId = document.getElementById('inp-col-editing-id').value;

    if (editingId) {
        // Update
        const col = collections.find(c => c.id === editingId);
        if (col) col.name = name;
    } else {
        // Create
        const newCol = {
            id: crypto.randomUUID(),
            name: name
        };
        collections.push(newCol);
    }

    await saveData();

    populateCollectionSelects();
    document.getElementById('modal-collection').classList.remove('active');
    render();
}

// Helper for deleting collections
async function deleteCollection(id) {
    if (!confirm("Delete this collection? Ideas will remain but be unassigned.")) return;

    collections = collections.filter(c => c.id !== id);
    // Unassign ideas
    ideas.forEach(i => {
        if (i.collectionId === id) i.collectionId = null;
    });

    await saveData();
    populateCollectionSelects();
    render();
}


function renderGridView(container) {
    const grid = document.createElement('div');
    grid.className = 'idea-grid';

    const filterVal = document.getElementById('filter-collection')?.value || 'all';

    // Sort by created desc (pinned items items logic could be added later)
    let sorted = [...ideas].sort((a, b) => new Date(b.created) - new Date(a.created));

    if (filterVal !== 'all') {
        sorted = sorted.filter(i => i.collectionId === filterVal);
    }

    sorted.forEach(idea => {
        const card = document.createElement('div');
        card.className = 'idea-card';
        card.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">${idea.title}</h3>
                <span class="card-badge">${idea.stage}</span>
            </div>
            <div class="card-meta">
                <span class="priority-${idea.priority.toLowerCase()}"><i class="fas fa-circle" style="font-size:0.5rem; margin-right:4px;"></i>${idea.priority}</span>
                <span>${new Date(idea.created).toLocaleDateString()}</span>
            </div>
        `;
        // Edit Trigger
        card.onclick = () => openEditModal(idea);
        grid.appendChild(card);
    });

    if (sorted.length === 0) {
        container.innerHTML = '<div style="opacity:0.5; text-align:center; margin-top:50px;">No ideas found.</div>';
    } else {
        container.appendChild(grid);
    }
}

function renderListView(container) {
    const list = document.createElement('div');
    list.className = 'idea-list';

    // Header
    const header = document.createElement('div');
    header.className = 'list-item list-header';
    header.style.fontWeight = 'bold';
    header.style.opacity = '1';
    header.style.background = 'rgba(0,0,0,0.05)';
    header.innerHTML = `
        <div class="list-col" style="flex:2">Title</div>
        <div class="list-col">Stage</div>
        <div class="list-col">Priority</div>
        <div class="list-col">Collection</div>
        <div class="list-col" style="text-align:right;">Created</div>
    `;
    list.appendChild(header);

    const sorted = [...ideas].sort((a, b) => new Date(b.created) - new Date(a.created));

    sorted.forEach(idea => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.cursor = 'pointer';
        item.onclick = () => openEditModal(idea);

        const colName = collections.find(c => c.id === idea.collectionId)?.name || '-';

        item.innerHTML = `
            <div class="list-col" style="flex:2"><span class="list-title">${idea.title}</span></div>
            <div class="list-col">${idea.stage}</div>
            <div class="list-col priority-${idea.priority.toLowerCase()}">${idea.priority}</div>
            <div class="list-col" style="opacity:0.7">${colName}</div>
            <div class="list-col" style="text-align:right; font-size:0.8rem; opacity:0.6">${new Date(idea.created).toLocaleDateString()}</div>
        `;
        list.appendChild(item);
    });

    if (ideas.length === 0) {
        container.innerHTML = '<div style="opacity:0.5; text-align:center; margin-top:50px;">No ideas yet.</div>';
    } else {
        container.appendChild(list);
    }
}

function renderMindMap(container) {
    const mapContainer = document.createElement('div');
    mapContainer.className = 'mind-map-container';

    let roots = [];
    if (selectedRootId === 'all') {
        // Show only actual roots (no parents)
        roots = ideas.filter(i => !i.upIdeaId);
    } else {
        // Show selected node as root
        roots = ideas.filter(i => i.id === selectedRootId);
    }

    if (roots.length === 0) {
        mapContainer.innerHTML = '<div style="opacity:0.5; text-align:center;">No idea trees found.</div>';
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'root-node';
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';
    wrapper.style.gap = '40px';

    roots.forEach(root => {
        wrapper.appendChild(createTreeNode(root));
    });

    mapContainer.appendChild(wrapper);
    container.appendChild(mapContainer);
}

function createTreeNode(idea) {
    const node = document.createElement('div');
    node.className = 'tree-node';

    const content = document.createElement('div');
    content.className = 'node-content';
    content.innerHTML = `
        <div>${idea.title}</div>
    `;
    content.onclick = (e) => { // Click to edit
        e.stopPropagation();
        openEditModal(idea);
    };

    const actions = document.createElement('div');
    actions.className = 'node-actions';

    const btnAdd = document.createElement('button');
    btnAdd.className = 'node-btn';
    btnAdd.innerHTML = '<i class="fas fa-plus"></i>';
    btnAdd.title = "Add Sub-idea";
    btnAdd.onclick = (e) => {
        e.stopPropagation();
        openSubIdeaModal(idea.id);
    };

    // REMOVED DELETE BUTTON FROM HERE

    actions.appendChild(btnAdd);
    content.appendChild(actions);

    node.appendChild(content);

    // Find children
    const children = ideas.filter(i => i.upIdeaId === idea.id);
    if (children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'node-children';
        children.forEach(child => {
            childrenContainer.appendChild(createTreeNode(child));
        });
        node.appendChild(childrenContainer);
    }

    return node;
}

// --- Actions ---

function openModal(id) {
    document.getElementById(id).classList.add('active');

    // Reset forms
    if (id === 'modal-idea') {
        document.getElementById('form-idea').reset();
        document.getElementById('inp-parent-id').value = '';
        document.getElementById('inp-editing-id').value = '';
        document.querySelector('#modal-idea h3').textContent = 'New Idea'; // Reset title

        // Hide delete, show save
        document.getElementById('btn-delete-idea').style.display = 'none';

    } else if (id === 'modal-collection') {
        document.getElementById('form-collection').reset();
        // Reset Edit state
        document.getElementById('inp-col-editing-id').value = '';
        document.querySelector('#modal-collection h3').textContent = 'New Collection';
        document.querySelector('#modal-collection button[type="submit"]').textContent = 'Create Collection';
    }
}

function openEditModal(idea) {
    openModal('modal-idea');

    // Fill data
    document.getElementById('inp-idea-title').value = idea.title;
    document.getElementById('inp-idea-stage').value = idea.stage;
    document.getElementById('inp-idea-priority').value = idea.priority;
    document.getElementById('inp-idea-collection').value = idea.collectionId || "";
    document.getElementById('inp-idea-desc').value = idea.description || "";

    // Set Editing ID
    document.getElementById('inp-editing-id').value = idea.id;
    document.getElementById('inp-parent-id').value = idea.upIdeaId || ''; // Keep parent if exists

    // Update Modal Title
    document.querySelector('#modal-idea h3').textContent = 'Edit Idea';

    // Show delete button
    document.getElementById('btn-delete-idea').style.display = 'block';
}

function openSubIdeaModal(parentId) {
    openModal('modal-idea');
    document.getElementById('inp-parent-id').value = parentId;
}

async function saveIdea(e) {
    e.preventDefault();
    const title = document.getElementById('inp-idea-title').value;
    const stage = document.getElementById('inp-idea-stage').value;
    const priority = document.getElementById('inp-idea-priority').value;
    const collectionId = document.getElementById('inp-idea-collection').value;
    const description = document.getElementById('inp-idea-desc').value;
    const parentId = document.getElementById('inp-parent-id').value;
    const editingId = document.getElementById('inp-editing-id').value; // Check if editing

    if (editingId) {
        // Update Existing
        const idx = ideas.findIndex(i => i.id === editingId);
        if (idx > -1) {
            ideas[idx] = {
                ...ideas[idx],
                title: title,
                stage: stage,
                priority: priority,
                collectionId: collectionId || null,
                description: description || "",
                // don't change created, upIdeaId (unless re-parenting implemented), downIdeaIds
            };
        }
    } else {
        // Create New
        const newIdea = {
            id: crypto.randomUUID(),
            title: title,
            stage: stage,
            priority: priority,
            collectionId: collectionId || null,
            description: description || "",
            created: new Date().toISOString(),
            upIdeaId: parentId || null,
            downIdeaIds: []
        };
        ideas.push(newIdea);
    }

    await saveData();

    document.getElementById('modal-idea').classList.remove('active');

    // Refresh selects/views
    populateRootSelect();
    render();
}




async function deleteIdea(id) {
    // Simple recursive delete
    const toDelete = [id];
    let idx = 0;
    while (idx < toDelete.length) {
        const current = toDelete[idx];
        const children = ideas.filter(i => i.upIdeaId === current);
        children.forEach(c => toDelete.push(c.id));
        idx++;
    }

    ideas = ideas.filter(i => !toDelete.includes(i.id));
    await saveData();
    populateRootSelect();
    render();
}

async function saveData() {
    const db = {
        ideas: ideas,
        collections: collections
    };

    await fetch('/api/storage/idea_vault.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: db })
    });
}

function populateCollectionSelects() {
    // Modal Select
    const modalSel = document.getElementById('inp-idea-collection');
    if (modalSel) {
        modalSel.innerHTML = '<option value="">(None)</option>';
        collections.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            modalSel.appendChild(opt);
        });
    }

    // Filter Select
    const filterSel = document.getElementById('filter-collection');
    if (filterSel) {
        const current = filterSel.value;
        filterSel.innerHTML = '<option value="all">All Collections</option>';
        collections.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            filterSel.appendChild(opt);
        });
        filterSel.value = current;
    }
}

function populateRootSelect() {
    const sel = document.getElementById('select-root-node');
    if (!sel) return;

    const current = sel.value;
    sel.innerHTML = '<option value="all">All Trees</option>';

    // Only items that are roots themselves
    const roots = ideas.filter(i => !i.upIdeaId);

    roots.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.title;
        sel.appendChild(opt);
    });

    // If selection no longer exists, reset
    if (current && roots.find(r => r.id === current)) {
        sel.value = current;
    } else {
        sel.value = 'all';
    }
}
