
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

    const filterSearch = document.getElementById('filter-search');
    if (filterSearch) {
        filterSearch.addEventListener('input', render);
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

    // Search Filter for Connect Nodes
    document.getElementById('inp-connect-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const container = document.getElementById('div-connect-nodes-list');
        const items = container.querySelectorAll('div'); // The rows
        items.forEach(div => {
            const span = div.querySelector('span');
            if (span) {
                const text = span.textContent.toLowerCase();
                div.style.display = text.includes(term) ? 'flex' : 'none';
            }
        });
    });
}

function updateControlsVisibility() {
    const filterContainer = document.getElementById('grid-controls');
    const mapControls = document.getElementById('map-controls');

    // Show collection filter for both Grid and Mind Map
    if (filterContainer) filterContainer.style.display = (currentView === 'grid' || currentView === 'mindmap') ? 'block' : 'none';

    // Hide old map controls (Tree Root Selector)
    if (mapControls) mapControls.style.display = 'none';
}

async function loadData() {
    try {
        const res = await fetch('/api/storage/idea_vault.json');
        if (res.ok) {
            const data = await res.json();
            ideas = data.ideas || [];
            collections = data.collections || [];

            // Migration: upIdeaId -> parentIds
            ideas.forEach(i => {
                if (!i.parentIds) i.parentIds = [];
                if (i.upIdeaId) {
                    if (!i.parentIds.includes(i.upIdeaId)) i.parentIds.push(i.upIdeaId);
                    delete i.upIdeaId; // Cleanup
                }
            });

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

function renderConnectNodesList(currentIdeaId, selectedParentIds = []) {
    const container = document.getElementById('div-connect-nodes-list');
    if (!container) return;
    container.innerHTML = '';

    const sorted = [...ideas].sort((a, b) => a.title.localeCompare(b.title));

    if (sorted.length === 0) {
        container.innerHTML = '<div style="opacity:0.6; font-size:0.8rem;">No other ideas available.</div>';
        return;
    }

    sorted.forEach(idea => {
        // Cannot be parent of self
        if (currentIdeaId && idea.id === currentIdeaId) return;

        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.marginBottom = '4px';

        const isChecked = selectedParentIds.includes(idea.id) ? 'checked' : '';

        row.innerHTML = `
            <label style="display:flex; align-items:center; width:100%; cursor:pointer;">
                <input type="checkbox" class="chk-connect-node" value="${idea.id}" ${isChecked} style="margin-right:8px;">
                <span style="font-size:0.9rem;">${idea.title}</span>
            </label>
        `;
        container.appendChild(row);
    });
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
    const searchVal = document.getElementById('filter-search')?.value.toLowerCase() || '';

    // Sort by created desc (pinned items items logic could be added later)
    let sorted = [...ideas].sort((a, b) => new Date(b.created) - new Date(a.created));

    if (filterVal !== 'all') {
        if (filterVal === 'unassigned') {
            sorted = sorted.filter(i => !i.collectionId);
        } else {
            sorted = sorted.filter(i => i.collectionId === filterVal);
        }
    }

    if (searchVal) {
        sorted = sorted.filter(i => i.title.toLowerCase().includes(searchVal));
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

    const filterVal = document.getElementById('filter-collection')?.value || 'all';
    const searchVal = document.getElementById('filter-search')?.value.toLowerCase() || '';

    let sorted = [...ideas].sort((a, b) => new Date(b.created) - new Date(a.created));

    if (filterVal !== 'all') {
        sorted = sorted.filter(i => i.collectionId === filterVal);
    }

    if (searchVal) {
        sorted = sorted.filter(i => i.title.toLowerCase().includes(searchVal));
    }

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
    mapContainer.id = 'vis-network-container';
    container.appendChild(mapContainer);

    // Prepare Data for Vis.js
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const nodeColor = isDark ? '#2d2d2d' : '#ffffff';
    const textColor = isDark ? '#e0e0e0' : '#333333';
    const borderColor = isDark ? '#444' : '#ddd';

    // Filter Items based on Collection Select
    const filterEl = document.getElementById('filter-collection');
    const filterVal = filterEl ? filterEl.value : 'all';

    console.log("[MindMap] Filtering by:", filterVal);

    let filteredIdeas = ideas;
    if (filterVal !== 'all') {
        if (filterVal === 'unassigned') {
            filteredIdeas = ideas.filter(i => !i.collectionId);
        } else {
            // Use loose comparison or string conversion to handle potential type mismatches (legacy IDs)
            filteredIdeas = ideas.filter(i => String(i.collectionId) === String(filterVal));
        }
    }
    console.log("[MindMap] Filtered ideas count:", filteredIdeas.length);

    filteredIdeas.forEach(idea => {
        // Node
        nodes.add({
            id: idea.id,
            label: idea.title,
            shape: 'box',
            color: {
                background: nodeColor,
                border: borderColor,
                highlight: { background: isDark ? '#3d3d3d' : '#f0f0f0', border: '#1a73e8' }
            },
            font: { color: textColor, size: 20 }, // Increased size
            margin: 15, // Larger box
            shadow: true
        });

        // Edges
        // Only add edges if both nodes are in the view
        if (idea.parentIds && idea.parentIds.length > 0) {
            idea.parentIds.forEach(pid => {
                // Ensure parent exists AND is in the filtered list
                // (Requirement: "If there is a connection between any ideas obtained as a result of filter, I would like them to be connected.")
                const parentInView = filteredIdeas.find(i => i.id === pid);
                if (parentInView) {
                    edges.add({
                        from: pid,
                        to: idea.id,
                        arrows: 'to',
                        color: { color: isDark ? '#666' : '#ccc' }
                    });
                }
            });
        }
    });

    // Options
    const options = {
        layout: {
            hierarchical: false
        },
        physics: {
            enabled: true,
            stabilization: {
                iterations: 1000, // Pre-stabilize heavily
                updateInterval: 50,
                onlyDynamicEdges: false,
                fit: true
            },
            barnesHut: {
                gravitationalConstant: -3000,
                centralGravity: 0.3,
                springLength: 120, // More space
                springConstant: 0.04,
                damping: 0.09,
                avoidOverlap: 0.5 // Avoid overlap
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 200,
            zoomView: true,
            dragView: true
        }
    };

    // Initialize Network
    const network = new vis.Network(mapContainer, { nodes, edges }, options);

    // Freeze after stabilization (Keep it static)
    network.on("stabilizationIterationsDone", function () {
        network.setOptions({ physics: false });
    });

    // Fallback if stabilization stops early
    network.on("stabilized", function () {
        network.setOptions({ physics: false });
    });

    // Event: Double Click to Edit
    network.on("doubleClick", function (params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const idea = ideas.find(i => i.id === nodeId);
            if (idea) {
                openEditModal(idea);
            }
        }
    });

    // Hover Text Effect
    network.on("hoverNode", function (params) {
        nodes.update({ id: params.node, font: { color: '#000000' } });
    });

    network.on("blurNode", function (params) {
        nodes.update({ id: params.node, font: { color: textColor } });
    });
}
// createTreeNode is removed as it is no longer used.

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

        // Populate connect list
        renderConnectNodesList(null, []);
        document.getElementById('inp-connect-search').value = '';

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

    // Populate Connect List
    renderConnectNodesList(idea.id, idea.parentIds || []);

    // Set Editing ID
    document.getElementById('inp-editing-id').value = idea.id;

    // Update Modal Title
    document.querySelector('#modal-idea h3').textContent = 'Edit Idea';

    // Show delete button
    document.getElementById('btn-delete-idea').style.display = 'block';
}

function openSubIdeaModal(parentId) {
    openModal('modal-idea');
    renderConnectNodesList(null, [parentId]);
}

async function saveIdea(e) {
    e.preventDefault();
    const title = document.getElementById('inp-idea-title').value;
    const stage = document.getElementById('inp-idea-stage').value;
    const priority = document.getElementById('inp-idea-priority').value;
    const collectionId = document.getElementById('inp-idea-collection').value;
    const description = document.getElementById('inp-idea-desc').value;

    // Get parent IDs from checkboxes
    const checkboxes = document.querySelectorAll('.chk-connect-node:checked');
    const parentIds = Array.from(checkboxes).map(cb => cb.value);

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
                parentIds: parentIds
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
            parentIds: parentIds,
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
    // Confirmation handled by caller (UI)

    // Remove idea
    ideas = ideas.filter(i => i.id !== id);

    // Remove references in other ideas
    ideas.forEach(i => {
        if (i.parentIds && i.parentIds.includes(id)) {
            i.parentIds = i.parentIds.filter(pid => pid !== id);
        }
    });

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
        filterSel.innerHTML = '<option value="all">All Collections</option><option value="unassigned">No Collection</option>';
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

function populateParentSelect(currentIdeaId, selectedParentId) {
    const sel = document.getElementById('inp-idea-parent');
    if (!sel) return;

    sel.innerHTML = '<option value="">(None - Root)</option>';

    // Flatten logic or simple list? Simple list is fine, but we must avoid circular dependency (self as parent).
    // Also excluding descendants would be ideal but simple self-exclusion is MVP.
    // Actually, simple self-exclusion allows creating cycles if I pick a child. 
    // Cycle check is complex. Let's just exclude self for now.

    // Sort logic? Alphabetical
    const sorted = [...ideas].sort((a, b) => a.title.localeCompare(b.title));

    sorted.forEach(idea => {
        // Cannot be parent of self
        if (currentIdeaId && idea.id === currentIdeaId) return;

        const opt = document.createElement('option');
        opt.value = idea.id;
        opt.textContent = idea.title;
        sel.appendChild(opt);
    });

    if (selectedParentId) {
        sel.value = selectedParentId;
    }
}
