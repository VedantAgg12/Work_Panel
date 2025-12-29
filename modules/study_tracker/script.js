document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const dbPath = '/api/storage/study_data.json';
    let data = {
        subjects: [],
        schedules: [],
        goals: [],
        sessions: []
    };

    let timerInterval = null;
    let timerSeconds = 0;
    let currentSessionSubject = null;

    // --- DOM Elements ---
    const timerDisplay = document.getElementById('timer');
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnStop = document.getElementById('btn-stop');
    const sessionInfo = document.getElementById('active-session-info');
    const sessionChecklist = document.getElementById('session-checklist');
    const checklistItems = document.getElementById('checklist-items');

    // --- Initialization ---
    async function init() {
        await loadData();
        // renderSubjects(); // Removed as it was undefined. renderSyllabus handles subjects.
        renderGoals();
        renderSyllabus();
        renderCalendar();
        populateSelects();
        renderAnalytics();

        // Theme Sync
        if (window.parent) {
            window.parent.postMessage({ type: 'request-theme' }, '*');
        }
    }

    // --- Data Persistence ---
    async function loadData() {
        try {
            const res = await fetch(dbPath);
            if (res.ok) {
                const json = await res.json();
                // Merge simply replacing
                data = { ...data, ...json };
                // Ensure arrays
                if (!data.subjects) data.subjects = [];
                if (!data.schedules) data.schedules = [];
                if (!data.goals) data.goals = [];
                if (!data.sessions) data.sessions = [];
            }
        } catch (e) {
            console.error("Failed to load data", e);
            // Keep default empty
        }
    }

    async function saveData() {
        try {
            await fetch(dbPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: data })
            });
        } catch (e) {
            console.error("Failed to save data", e);
        }
    }

    // --- Navigation (Screens) ---
    window.showScreen = (screenId, btn) => {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        // Show target
        document.getElementById(screenId).classList.add('active');

        // Sidebar active state
        document.querySelectorAll('.btn-sidebar').forEach(el => el.classList.remove('active'));
        if (btn) btn.classList.add('active');

        // Refresh views if needed
        if (screenId === 'screen-calendar') renderCalendar();
        if (screenId === 'screen-syllabus') renderSyllabus();
    };

    // --- Modals ---
    window.openModal = (modalId) => {
        document.getElementById(modalId).classList.add('active');
        populateSelects(); // Refresh selects just in case
    };

    window.closeModal = (modalId) => {
        document.getElementById(modalId).classList.remove('active');
    };

    // --- CRUD: Subjects ---
    document.getElementById('form-subject').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const name = formData.get('name');

        const newSubject = {
            id: crypto.randomUUID(),
            name: name,
            topics: []
        };

        data.subjects.push(newSubject);
        await saveData();

        closeModal('modal-subject');
        e.target.reset();
        renderSyllabus();
        populateSelects();
    });

    window.deleteSubject = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Delete this subject and all its topics?')) return;
        data.subjects = data.subjects.filter(s => s.id !== id);
        await saveData();
        renderSyllabus();
        populateSelects();
    };

    // --- CRUD: Topics ---
    window.openTopicModal = (subjectId) => {
        document.getElementById('topic-subject-id').value = subjectId;
        document.getElementById('topic-id').value = '';
        document.getElementById('form-topic').reset();
        openModal('modal-topic');
    };

    document.getElementById('form-topic').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const subId = fd.get('subjectId');
        const topicId = fd.get('topicId');
        const name = fd.get('name');

        const subject = data.subjects.find(s => s.id === subId);
        if (!subject) return;

        if (!topicId) {
            // New Topic
            subject.topics.push({
                id: crypto.randomUUID(),
                name: name,
                subtopics: []
            });
        }
        // If edit logic were added, handle here

        await saveData();
        closeModal('modal-topic');
        renderSyllabus();
    });

    window.deleteTopic = async (subId, topicId, e) => {
        e.stopPropagation();
        if (!confirm('Delete this topic?')) return;
        const sub = data.subjects.find(s => s.id === subId);
        if (sub) {
            sub.topics = sub.topics.filter(t => t.id !== topicId);
            await saveData();
            renderSyllabus();
        }
    };

    // --- CRUD: Subtopics ---
    window.openSubtopicModal = (subId, topicId) => {
        document.getElementById('subtopic-subject-id').value = subId;
        document.getElementById('subtopic-topic-id').value = topicId;
        document.getElementById('subtopic-id').value = '';
        document.getElementById('form-subtopic').reset();
        openModal('modal-subtopic');
    };

    document.getElementById('form-subtopic').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const subId = fd.get('subjectId');
        const topId = fd.get('topicId');
        const name = fd.get('name');

        const subject = data.subjects.find(s => s.id === subId);
        if (!subject) return;
        const topic = subject.topics.find(t => t.id == topId); // loose match if ID type differs (string/number)
        if (!topic) return;

        if (!topic.subtopics) topic.subtopics = [];

        topic.subtopics.push({
            id: crypto.randomUUID(),
            name: name
        });

        await saveData();
        closeModal('modal-subtopic');
        renderSyllabus();
    });

    window.deleteSubtopic = async (subId, topId, subtopId, e) => {
        e.stopPropagation();
        if (!confirm('Delete this subtopic?')) return;
        const subject = data.subjects.find(s => s.id === subId);
        if (!subject) return;
        const topic = subject.topics.find(t => t.id == topId);
        if (topic && topic.subtopics) {
            topic.subtopics = topic.subtopics.filter(st => st.id !== subtopId);
            await saveData();
            renderSyllabus();
        }
    };


    // --- CRUD: Schedules & Goals (Existing) ---
    document.getElementById('form-schedule').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newSchedule = {
            id: crypto.randomUUID(),
            title: formData.get('title'),
            subjectId: formData.get('subject'),
            date: formData.get('date'),
            type: formData.get('type')
        };
        data.schedules.push(newSchedule);
        await saveData();
        closeModal('modal-schedule');
        e.target.reset();
        renderCalendar();
    });

    document.getElementById('form-goal').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newGoal = {
            id: crypto.randomUUID(),
            description: formData.get('description'),
            subjectId: formData.get('subject'),
            targetDate: formData.get('targetDate'),
            status: formData.get('status')
        };
        data.goals.push(newGoal);
        await saveData();
        closeModal('modal-goal');
        e.target.reset();
        renderGoals();
    });

    // --- Renderers ---
    function populateSelects() {
        const selects = [
            document.getElementById('schedule-subject-select'),
            document.getElementById('goal-subject-select'),
            document.getElementById('session-subject-select')
        ];
        selects.forEach(sel => {
            if (!sel) return;
            const currentVal = sel.value;
            sel.innerHTML = '<option value="">Select Subject...</option>';
            data.subjects.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub.id;
                opt.textContent = sub.name;
                sel.appendChild(opt);
            });
            if (currentVal) sel.value = currentVal;
        });
    }

    function renderSyllabus() {
        const container = document.getElementById('syllabus-accordion');
        container.innerHTML = '';
        if (data.subjects.length === 0) {
            container.innerHTML = '<p style="text-align:center; opacity:0.6;">No subjects added yet.</p>';
            return;
        }

        data.subjects.forEach(sub => {
            const item = document.createElement('div');
            item.className = 'accordion-item';

            const header = document.createElement('div');
            header.className = 'accordion-header';
            header.onclick = (e) => {
                if (e.target.closest('.btn-mini')) return; /* Ignore btn clicks */
                item.classList.toggle('active');
            };

            header.innerHTML = `
                <span>${sub.name}</span>
                <div style="display:flex; gap:5px; align-items:center;">
                    <button class="btn-mini" onclick="openTopicModal('${sub.id}')" title="Add Topic"><i class="fas fa-plus"></i></button>
                    <button class="btn-mini btn-mini-danger" onclick="deleteSubject('${sub.id}', event)" title="Delete Subject"><i class="fas fa-trash"></i></button>
                    <i class="fas fa-chevron-down" style="margin-left:5px;"></i>
                </div>
            `;

            const body = document.createElement('div');
            body.className = 'accordion-body';

            if (!sub.topics || sub.topics.length === 0) {
                body.innerHTML = '<div style="opacity:0.6; font-size:0.9rem; padding:10px;">No topics.</div>';
            } else {
                sub.topics.forEach(topic => {
                    const tDiv = document.createElement('div');
                    tDiv.className = 'topic-container';

                    const tHeader = document.createElement('div');
                    tHeader.className = 'topic-header';
                    tHeader.innerHTML = `
                        <span>${topic.name}</span>
                        <div>
                            <button class="btn-mini" onclick="openSubtopicModal('${sub.id}', '${topic.id}')" title="Add Subtopic"><i class="fas fa-plus-circle"></i></button>
                            <button class="btn-mini btn-mini-danger" onclick="deleteTopic('${sub.id}', '${topic.id}', event)" title="Delete Topic"><i class="fas fa-trash"></i></button>
                        </div>
                    `;
                    tDiv.appendChild(tHeader);

                    const stContainer = document.createElement('div');
                    stContainer.className = 'subtopic-container';
                    if (topic.subtopics && topic.subtopics.length > 0) {
                        topic.subtopics.forEach(st => {
                            const stItem = document.createElement('div');
                            stItem.className = 'subtopic-item';
                            stItem.innerHTML = `
                                <span>- ${st.name}</span>
                                <button class="btn-mini btn-mini-danger" onclick="deleteSubtopic('${sub.id}', '${topic.id}', '${st.id}', event)"><i class="fas fa-times"></i></button>
                            `;
                            stContainer.appendChild(stItem);
                        });
                    }
                    tDiv.appendChild(stContainer);
                    body.appendChild(tDiv);
                });
            }

            item.appendChild(header);
            item.appendChild(body);
            container.appendChild(item);
        });
    }

    function renderGoals() {
        // ... (as before, code truncated for brevity but functionality preserved)
        // Re-implementing for completeness
        const container = document.getElementById('goals-list');
        container.innerHTML = '';
        if (data.goals.length === 0) {
            container.innerHTML = '<p style="opacity:0.6; grid-column: 1/-1; text-align:center;">No study goals yet.</p>';
            return;
        }
        data.goals.forEach(goal => {
            const card = document.createElement('div');
            card.className = 'goal-card';
            const sub = data.subjects.find(s => s.id === goal.subjectId);
            const subName = sub ? sub.name : 'Unknown';
            const statusClass = `status-${goal.status.toLowerCase().replace(' ', '')}`;
            card.innerHTML = `
                <div class="goal-status ${statusClass}">${goal.status}</div>
                <h4 style="margin: 0 0 5px 0;">${subName}</h4>
                <p style="margin: 0 0 10px 0; font-size: 0.95rem;">${goal.description}</p>
                <div style="font-size: 0.8rem; opacity: 0.6;">Target: ${new Date(goal.targetDate).toLocaleDateString()}</div>
                <button onclick="deleteGoal('${goal.id}')" style="position:absolute; bottom:10px; right:10px; border:none; background:transparent; cursor:pointer; color:var(--danger);"><i class="fas fa-trash"></i></button>
            `;
            container.appendChild(card);
        });
    }

    window.deleteGoal = async (id) => {
        if (!confirm('Delete this goal?')) return;
        data.goals = data.goals.filter(g => g.id !== id);
        await saveData();
        renderGoals();
    }

    // --- Calendar State ---
    let currentViewDate = new Date();

    window.changeMonth = (offset) => {
        currentViewDate.setMonth(currentViewDate.getMonth() + offset);
        renderCalendar();
    };

    function renderCalendar() {
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';

        // Headers
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        days.forEach(d => {
            const h = document.createElement('div');
            h.className = 'calendar-header-cell';
            h.textContent = d;
            grid.appendChild(h);
        });

        const year = currentViewDate.getFullYear();
        const month = currentViewDate.getMonth();
        document.getElementById('cal-month-name').textContent = currentViewDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDay = new Date(year, month, 1).getDay();

        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = 'calendar-day';
            empty.style.background = 'transparent';
            empty.style.border = 'none';
            grid.appendChild(empty);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day';
            cell.innerHTML = `<span class="day-number">${day}</span>`;
            const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const events = data.schedules.filter(s => s.date.startsWith(cellDateStr));
            events.forEach(ev => {
                const dot = document.createElement('div');
                dot.className = `event-dot event-${ev.type.toLowerCase()}`;
                dot.textContent = `${ev.type[0]} - ${ev.title}`;
                dot.title = ev.title;
                cell.appendChild(dot);
            });
            grid.appendChild(cell);
        }
    }

    // --- Stopwatch & Session Logic ---
    window.startTimer = () => {
        const subId = document.getElementById('session-subject-select').value;
        if (!subId) {
            alert('Please select a subject first.');
            return;
        }
        currentSessionSubject = data.subjects.find(s => s.id === subId);
        renderSessionChecklist(currentSessionSubject);

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timerSeconds++;
            updateTimerDisplay();
        }, 1000);

        btnStart.style.display = 'none';
        btnPause.style.display = 'inline-flex';
        btnStop.disabled = false;
        sessionInfo.textContent = `Studying: ${currentSessionSubject.name}`;
        sessionChecklist.style.display = 'block';
    };

    window.pauseTimer = () => {
        clearInterval(timerInterval);
        timerInterval = null;
        btnStart.style.display = 'inline-flex';
        btnPause.style.display = 'none';
        sessionInfo.textContent = 'Paused';
    };

    window.stopTimer = async () => {
        clearInterval(timerInterval);
        timerInterval = null;

        const session = {
            id: crypto.randomUUID(),
            subjectId: currentSessionSubject.id,
            durationSeconds: timerSeconds,
            date: new Date().toISOString(),
            completedTopics: [] // Placeholder
        };

        data.sessions.push(session);
        await saveData();
        renderAnalytics();

        // Reset
        timerSeconds = 0;
        updateTimerDisplay();
        currentSessionSubject = null;
        btnStart.style.display = 'inline-flex';
        btnPause.style.display = 'none';
        btnStop.disabled = true;
        sessionInfo.textContent = 'Ready to start';
        sessionChecklist.style.display = 'none';
    };

    function updateTimerDisplay() {
        const h = Math.floor(timerSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((timerSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (timerSeconds % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${h}:${m}:${s}`;
    }

    function renderSessionChecklist(subject) {
        checklistItems.innerHTML = '';
        if (!subject || !subject.topics) return;
        subject.topics.forEach(topic => {
            const label = document.createElement('label');
            label.style.display = 'block';
            label.style.marginBottom = '5px';
            label.innerHTML = `<input type="checkbox" style="margin-right:8px;"> ${topic.name}`;
            checklistItems.appendChild(label);
        });
    }

    // --- Analytics ---
    function renderAnalytics() {
        const totalEl = document.getElementById('analytics-total-sessions');
        const timeEl = document.getElementById('analytics-total-hours');
        const historyBody = document.getElementById('analytics-history-body');

        if (!data.sessions || data.sessions.length === 0) {
            totalEl.textContent = '0';
            timeEl.textContent = '0h 0m';
            historyBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:10px; opacity:0.6;">No history</td></tr>';
            return;
        }

        const totalSessions = data.sessions.length;
        const totalSeconds = data.sessions.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);

        totalEl.textContent = totalSessions;
        timeEl.textContent = `${h}h ${m}m`;

        // Render History (Newest First)
        historyBody.innerHTML = '';
        const reversed = [...data.sessions].reverse();
        reversed.forEach(s => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';

            const sub = data.subjects.find(sb => sb.id === s.subjectId);
            const subName = sub ? sub.name : 'Unknown';

            const hh = Math.floor(s.durationSeconds / 3600);
            const mm = Math.floor((s.durationSeconds % 3600) / 60);
            const ss = s.durationSeconds % 60;
            const durStr = (hh > 0 ? `${hh}h ` : '') + `${mm}m ${ss}s`;

            const dateStr = new Date(s.date).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            tr.innerHTML = `
                <td style="padding: 5px;">${dateStr}</td>
                <td style="padding: 5px;">${subName}</td>
                <td style="padding: 5px;">${durStr}</td>
            `;
            historyBody.appendChild(tr);
        });
    }

    window.clearAnalytics = async () => {
        if (!confirm('Clear all session history? This cannot be undone.')) return;
        data.sessions = [];
        await saveData();
        renderAnalytics();
    }

    // --- Message Listener (Theme & Refresh) ---
    window.addEventListener('message', async (e) => {
        if (e.data.type === 'theme-change') {
            document.documentElement.setAttribute('data-theme', e.data.theme);
        } else if (e.data.type === 'refresh-data') {
            // Reload data from DB and re-render
            await loadData();
            renderGoals();
            renderCalendar();
            renderSyllabus();
            populateSelects();
            renderAnalytics();
        }
    });

    // Run
    init();
});
