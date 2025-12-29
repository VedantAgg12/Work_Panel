const API_URL = '/api/storage/event_manager.json';

let allEvents = [];
let currentDate = new Date();

// DOM Elements
const views = {
    calendar: document.getElementById('view-calendar'),
    list: document.getElementById('view-list')
};
const navBtns = document.querySelectorAll('.nav-btn');
const calendarDays = document.getElementById('calendar-days');
const calendarTitle = document.getElementById('calendar-title');
const eventModal = document.getElementById('event-modal');
const eventForm = document.getElementById('event-form');
const eventListContainer = document.getElementById('event-list-container');
const searchInput = document.getElementById('search-events');

const filterStatus = document.getElementById('filter-status');

// Subtasks state
let currentSubtasks = [];

// Init
async function init() {
    await loadEvents();
    renderCalendar();
    renderList();
    setupEventListeners();
}

// Data Fetching
async function loadEvents() {
    try {
        const res = await fetch(API_URL);
        if (res.ok) {
            allEvents = await res.json();
            if (!Array.isArray(allEvents)) allEvents = [];
        }
    } catch (e) {
        console.error("Failed to load events", e);
        allEvents = [];
    }
}

async function saveEvents() {
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: allEvents })
        });
        // Notify parent to update dashboard widget if needed
        if (window.parent) {
            window.parent.postMessage({ type: 'module-update', module: 'event_manager' }, '*');
        }
    } catch (e) {
        console.error("Failed to save events", e);
    }
}

// Navigation
function switchView(viewName) {
    // Buttons
    navBtns.forEach(btn => {
        if (btn.dataset.view === viewName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Content
    Object.keys(views).forEach(key => {
        if (key === viewName) views[key].classList.add('active');
        else views[key].classList.remove('active');
    });
}

// Calendar Logic
function renderCalendar() {
    calendarDays.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Set Title
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentDate);
    calendarTitle.textContent = `${monthName} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const prevLastDay = new Date(year, month, 0);

    const daysInMonth = lastDay.getDate();
    const startDayIndex = firstDay.getDay(); // 0 is Sunday
    const nextDays = 7 - lastDay.getDay() - 1;

    // Previous Month Days
    for (let x = startDayIndex; x > 0; x--) {
        const day = prevLastDay.getDate() - x + 1;
        const cell = createDayCell(day, true);
        calendarDays.appendChild(cell);
    }

    // Current Month Days
    for (let i = 1; i <= daysInMonth; i++) {
        const cell = createDayCell(i, false, year, month);
        calendarDays.appendChild(cell);
    }

    // Next Month Days
    // Next Month Days (Handled by remaining logic below)
    // Simple fill to complete rows if we want fixed height, but flex is fine.
    // Let's restart the next days loop to be consistent with grid
    const totalCells = calendarDays.children.length;
    const remaining = 7 - (totalCells % 7);
    if (remaining < 7) {
        for (let j = 1; j <= remaining; j++) {
            const cell = createDayCell(j, true);
            calendarDays.appendChild(cell);
        }
    }
}

function createDayCell(day, isOtherMonth, year, month) {
    const div = document.createElement('div');
    div.className = 'day-cell';
    if (isOtherMonth) div.classList.add('other-month');

    div.innerHTML = `<div class="day-number">${day}</div>`;

    if (!isOtherMonth) {
        // Check for today
        const today = new Date();
        if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            div.classList.add('today');
        }

        // Add Events
        // Filter events for this day
        // Simple check: start date includes YYYY-MM-DD
        // Format check: ISO strings can be compared
        const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const dayEvents = allEvents.filter(ev => {
            if (!ev.start) return false;
            return ev.start.startsWith(cellDateStr) && ev.status !== 'Cancelled';
        });

        dayEvents.forEach(ev => {
            const dot = document.createElement('div');
            dot.className = 'cal-event-dot';
            dot.textContent = ev.title;
            dot.title = ev.title;
            // Click to edit?
            dot.onclick = (e) => {
                e.stopPropagation();
                openEventModal(ev);
            };
            div.appendChild(dot);
        });

        // Add click to add event on this day
        div.onclick = () => {
            openEventModal(null, cellDateStr);
        };
    }

    return div;
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

// List Logic
function renderList() {
    eventListContainer.innerHTML = '';

    // Filter
    const term = searchInput.value.toLowerCase();
    const stat = filterStatus.value;

    let filtered = allEvents.filter(ev => {
        const matchesTerm = ev.title.toLowerCase().includes(term) || (ev.description || '').toLowerCase().includes(term);
        const matchesStatus = stat === 'all' || ev.status === stat;
        return matchesTerm && matchesStatus;
    });

    // Sort by Date Descending or Ascending? Usually upcoming first.
    filtered.sort((a, b) => new Date(a.start) - new Date(b.start));

    if (filtered.length === 0) {
        eventListContainer.innerHTML = '<div style="text-align:center; padding:20px; opacity:0.6;">No events found</div>';
        return;
    }

    filtered.forEach(ev => {
        const el = createAccordionItem(ev);
        eventListContainer.appendChild(el);
    });
}

function createAccordionItem(ev) {
    const item = document.createElement('div');
    item.className = 'accordion-item';

    const startObj = new Date(ev.start);
    const dateStr = startObj.toLocaleDateString() + ' ' + startObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    item.innerHTML = `
        <div class="accordion-header" onclick="toggleAccordion(this)">
            <span class="accordion-title">${ev.title}</span>
            <span class="accordion-date">${dateStr}</span>
            <span class="accordion-status">${ev.status}</span>
        </div>
        <div class="accordion-content">
            <div class="detail-grid">
                <div class="detail-label">Description</div>
                <div>${ev.description || '-'}</div>

                <div class="detail-label">Location</div>
                <div>${ev.location || '-'}</div>

                <div class="detail-label">Participants</div>
                <div>${ev.participants || '-'}</div>
                
                <div class="detail-label">Category</div>
                <div>${ev.category || '-'}</div>

                <div class="detail-label">Attachments</div>
                <div>${ev.attachments || '-'}</div>
            </div>
            <div style="margin-top:15px; text-align:right;">
                <button class="btn-cancel" onclick="openEventModalFromId('${ev.id}')" style="font-size:0.8rem; padding: 5px 10px;">Edit</button>
            </div>
        </div>
    `;
    return item;
}

function toggleAccordion(header) {
    const item = header.parentElement;
    item.classList.toggle('open');
}

// Modal Logic
function openEventModal(eventData = null, defaultDateStr = null) {
    eventModal.classList.add('open');
    eventForm.reset();

    if (eventData) {
        document.getElementById('modal-title').textContent = 'Edit Event';
        // Populate
        document.getElementById('ev-title').value = eventData.title;
        document.getElementById('ev-start').value = eventData.start;
        document.getElementById('ev-end').value = eventData.end;
        document.getElementById('ev-allday').checked = eventData.allDay;
        document.getElementById('ev-repeat').value = eventData.repeat;
        document.getElementById('ev-category').value = eventData.category || '';
        document.getElementById('ev-location').value = eventData.location || '';
        document.getElementById('ev-desc').value = eventData.description || '';
        document.getElementById('ev-participants').value = eventData.participants || '';
        document.getElementById('ev-status').value = eventData.status;
        document.getElementById('ev-attachments').value = eventData.attachments || ''; // simplified text for now

        eventForm.dataset.id = eventData.id;

        // Render Subtasks
        currentSubtasks = eventData.subtasks || [];
        renderSubtasks();

    } else {
        document.getElementById('modal-title').textContent = 'Add Event';
        eventForm.dataset.id = '';
        currentSubtasks = [];
        renderSubtasks();

        if (defaultDateStr) {
            // Set start date to selected day at 9am
            document.getElementById('ev-start').value = `${defaultDateStr}T09:00`;
            document.getElementById('ev-end').value = `${defaultDateStr}T10:00`;
        } else {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            document.getElementById('ev-start').value = now.toISOString().slice(0, 16);
        }
    }
}

function openEventModalFromId(id) {
    const ev = allEvents.find(e => e.id === id);
    if (ev) openEventModal(ev);
}

function closeEventModal() {
    eventModal.classList.remove('open');
}

// Event Listeners setup
function setupEventListeners() {
    // Navigation
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchView(btn.dataset.view);
        });
    });

    // Calendar Controls
    document.getElementById('prev-month').onclick = () => changeMonth(-1);
    document.getElementById('next-month').onclick = () => changeMonth(1);
    document.getElementById('today-btn').onclick = () => {
        currentDate = new Date();
        renderCalendar();
    };

    // Sidebar Add
    document.getElementById('btn-add-event').onclick = () => openEventModal();

    // Subtasks
    document.getElementById('btn-add-subtask').onclick = () => {
        const input = document.getElementById('ev-subtask-input');
        const title = input.value.trim();
        if (title) {
            currentSubtasks.push({
                id: crypto.randomUUID(),
                title: title,
                completed: false
            });
            input.value = '';
            renderSubtasks();
        }
    };

    // Modal
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = closeEventModal;
    });

    // Form Submit
    eventForm.onsubmit = async (e) => {
        e.preventDefault();

        const id = eventForm.dataset.id || crypto.randomUUID();

        const newEvent = {
            id: id,
            title: document.getElementById('ev-title').value,
            start: document.getElementById('ev-start').value,
            end: document.getElementById('ev-end').value,
            allDay: document.getElementById('ev-allday').checked,
            repeat: document.getElementById('ev-repeat').value,
            category: document.getElementById('ev-category').value,
            location: document.getElementById('ev-location').value,
            description: document.getElementById('ev-desc').value,

            participants: document.getElementById('ev-participants').value,
            subtasks: currentSubtasks,
            status: document.getElementById('ev-status').value,
            attachments: document.getElementById('ev-attachments').value
        };

        // Update or Add
        const existingIdx = allEvents.findIndex(e => e.id === id);
        if (existingIdx >= 0) {
            allEvents[existingIdx] = newEvent;
        } else {
            allEvents.push(newEvent);
        }

        await saveEvents();
        closeEventModal();
        renderCalendar();
        renderList();
    };

    // Search/Filter
    searchInput.addEventListener('input', renderList);
    filterStatus.addEventListener('change', renderList);
}

function renderSubtasks() {
    const list = document.getElementById('subtask-list');
    list.innerHTML = '';
    currentSubtasks.forEach((task, index) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '10px';
        row.style.background = 'var(--item-bg)';
        row.style.padding = '5px 10px';
        row.style.borderRadius = '4px';

        row.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleSubtask('${task.id}')">
            <span style="flex:1; text-decoration:${task.completed ? 'line-through' : 'none'}; opacity:${task.completed ? 0.6 : 1}">${task.title}</span>
            <i class="fas fa-trash" style="cursor:pointer; opacity:0.6; font-size:0.8rem;" onclick="removeSubtask('${task.id}')"></i>
        `;
        list.appendChild(row);
    });
}

function toggleSubtask(id) {
    const task = currentSubtasks.find(t => t.id === id);
    if (task) {
        task.completed = !task.completed;
        renderSubtasks();
    }
}

function removeSubtask(id) {
    currentSubtasks = currentSubtasks.filter(t => t.id !== id);
    renderSubtasks();
}

// Run
init();
