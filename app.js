// ============================================================
// DOM Elements
// ============================================================
const addTaskForm = document.getElementById("add-task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const completedSection = document.getElementById("completed-section");
const completedList = document.getElementById("completed-list");

// Targets DOM
const addTargetForm = document.getElementById("add-target-form");
const targetInput = document.getElementById("target-input");
const targetList = document.getElementById("target-list");
const targetsCompletedSection = document.getElementById("targets-completed-section");
const targetsCompletedList = document.getElementById("targets-completed-list");

// ============================================================
// API
// ============================================================
const API_BASE = "/api";

async function fetchTasks() {
    const res = await fetch(`${API_BASE}/tasks`);
    return res.json();
}

async function apiAddTask(title) {
    const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
    });
    return res.json();
}

async function apiUpdateTask(id, updates) {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });
    return res.json();
}

async function apiCompleteTask(id) {
    const res = await fetch(`${API_BASE}/tasks/${id}/complete`, { method: "POST" });
    return res.json();
}

async function apiUncompleteTask(id) {
    const res = await fetch(`${API_BASE}/tasks/${id}/uncomplete`, { method: "POST" });
    return res.json();
}

async function apiDeleteTask(id) {
    await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
}

// Targets API
async function fetchTargets() {
    const res = await fetch(`${API_BASE}/targets`);
    return res.json();
}

async function apiAddTarget(title) {
    const res = await fetch(`${API_BASE}/targets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
    });
    return res.json();
}

async function apiUpdateTarget(id, updates) {
    const res = await fetch(`${API_BASE}/targets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });
    return res.json();
}

async function apiCompleteTarget(id) {
    const res = await fetch(`${API_BASE}/targets/${id}/complete`, { method: "POST" });
    return res.json();
}

async function apiUncompleteTarget(id) {
    const res = await fetch(`${API_BASE}/targets/${id}/uncomplete`, { method: "POST" });
    return res.json();
}

async function apiDeleteTarget(id) {
    await fetch(`${API_BASE}/targets/${id}`, { method: "DELETE" });
}

// ============================================================
// Audio — Bell Ding 🔔
// ============================================================
const dingAudio = new Audio("floraphonic-servant-bell-ring-2-211683.mp3");

function playDing() {
    dingAudio.currentTime = 0;
    dingAudio.play();
}

// ============================================================
// Prefix Parsing
// ============================================================
function parsePrefix(title) {
    const match = title.match(/^([A-Z0-9]+)\s*-\s*/);
    if (match) {
        return {
            prefix: match[1],
            displayTitle: title.slice(match[0].length),
        };
    }
    return { prefix: null, displayTitle: title };
}

// ============================================================
// Priority Parsing
// ============================================================
function parsePriority(title) {
    const match = title.match(/\s*-\s*(P[012])\s*$/i);
    if (match) {
        return {
            priority: match[1].toUpperCase(),
            titleWithoutPriority: title.slice(0, -match[0].length),
        };
    }
    return { priority: null, titleWithoutPriority: title };
}

// ============================================================
// Task Operations
// ============================================================
async function loadTasks() {
    const data = await fetchTasks();
    renderTasks(data.tasks);
    renderCompletedTasks(data.completed);
}

async function addTask(title) {
    await apiAddTask(title);
    await loadTasks();
}

async function updateTaskNotes(taskId, notes) {
    await apiUpdateTask(taskId, { notes });
}

function completeTask(taskId, element) {
    playDing();

    const checkbox = element.querySelector(".task-checkbox");
    checkbox.classList.add("checked", "ding");
    element.classList.add("completed");

    setTimeout(async () => {
        await apiCompleteTask(taskId);

        setTimeout(() => {
            element.style.height = element.offsetHeight + "px";
            element.style.overflow = "hidden";
            element.style.transition = "all 0.3s ease";
            requestAnimationFrame(() => {
                element.style.height = "0px";
                element.style.padding = "0 16px";
                element.style.margin = "0";
                element.style.opacity = "0";
            });
            setTimeout(() => {
                element.remove();
                loadTasks();
            }, 300);
        }, 400);
    }, 200);
}

function deleteTask(taskId, element) {
    element.style.transition = "all 0.3s ease";
    element.style.opacity = "0";
    element.style.transform = "translateX(20px)";

    setTimeout(async () => {
        await apiDeleteTask(taskId);
        loadTasks();
    }, 300);
}

// ============================================================
// Render
// ============================================================
function createTaskElement(task, isCompleted) {
    const { priority, titleWithoutPriority } = parsePriority(task.title);
    const displayTitle = titleWithoutPriority;

    const item = document.createElement("div");
    item.className = "task-item" + (isCompleted ? " task-item-completed" : "");

    const priorityTag = priority
        ? `<span class="priority-tag priority-${priority.toLowerCase()}">${priority}</span>`
        : "";

    const timestamp = isCompleted && task.completedAt
        ? `Completed ${formatTimestamp(task.completedAt)}`
        : task.createdAt
            ? `Created ${formatTimestamp(task.createdAt)}`
            : "";

    item.innerHTML = `
        <div class="task-checkbox${isCompleted ? " checked" : ""}" data-id="${task.id}"></div>
        <div class="task-content">
            <span class="task-title">${escapeHtml(displayTitle)}</span>
            ${timestamp ? `<span class="task-timestamp">${timestamp}</span>` : ""}
            <div class="task-notes-panel hidden">
                <div class="task-notes-links"></div>
                <textarea class="task-notes" placeholder="Add notes...">${escapeHtml(task.notes || "")}</textarea>
            </div>
        </div>
        <div class="task-actions">
            ${priorityTag}
            <button class="task-edit" title="Edit">✎</button>
            <button class="task-delete" data-id="${task.id}">✕</button>
        </div>
    `;

    const titleEl = item.querySelector(".task-title");
    const notesPanel = item.querySelector(".task-notes-panel");
    const notesArea = item.querySelector(".task-notes");
    const notesLinks = item.querySelector(".task-notes-links");
    const editBtn = item.querySelector(".task-edit");

    // Extract hyperlinks from notes and render as buttons
    function renderNoteLinks(text) {
        notesLinks.innerHTML = "";
        const urlRegex = /https?:\/\/[^\s]+/g;
        const matches = text.match(urlRegex);
        if (matches) {
            matches.forEach(url => {
                const btn = document.createElement("a");
                btn.href = url;
                btn.target = "_blank";
                btn.rel = "noopener noreferrer";
                btn.className = "note-link-btn";
                const lower = url.toLowerCase();
                if (lower.includes("teams")) {
                    btn.innerHTML = `<img class="note-link-icon" src="https://upload.wikimedia.org/wikipedia/commons/0/07/Microsoft_Office_Teams_%282025%E2%80%93present%29.svg" alt="Teams"> Teams Chat`;
                    btn.classList.add("note-link-teams");
                } else if (lower.includes("outlook")) {
                    btn.innerHTML = `<img class="note-link-icon" src="https://upload.wikimedia.org/wikipedia/commons/c/cc/Microsoft_Outlook_Icon_%282025%E2%80%93present%29.svg" alt="Outlook"> Email`;
                    btn.classList.add("note-link-outlook");
                } else {
                    // Fluent UI link icon
                    btn.innerHTML = `<svg class="note-link-icon" width="12" height="12" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7.72 3.72a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06L11.44 9H3.75a.75.75 0 0 1 0-1.5h7.69L7.72 4.78a.75.75 0 0 1 0-1.06Z"/><path d="M13.5 3.75a.75.75 0 0 1 1.5 0v12.5a.75.75 0 0 1-1.5 0V3.75Z"/></svg>`;
                    try {
                        const u = new URL(url);
                        btn.innerHTML += ` ${u.hostname.replace("www.", "")}`;
                    } catch { btn.innerHTML += " Open Link"; }
                    btn.classList.add("note-link-generic");
                }
                notesLinks.appendChild(btn);
            });
        }
    }

    // Auto-expand textarea to fit content
    function autoExpand() {
        notesArea.style.height = "auto";
        notesArea.style.height = notesArea.scrollHeight + "px";
    }

    renderNoteLinks(task.notes || "");

    titleEl.addEventListener("click", (e) => {
        e.stopPropagation();
        notesPanel.classList.toggle("hidden");
        if (!notesPanel.classList.contains("hidden")) {
            autoExpand();
            notesArea.focus();
        }
    });

    editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const input = document.createElement("input");
        input.type = "text";
        input.className = "task-edit-input";
        input.value = task.title;
        titleEl.replaceWith(input);
        input.focus();
        input.select();

        function saveEdit() {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== task.title) {
                apiUpdateTask(task.id, { title: newTitle }).then(() => loadTasks());
                return;
            }
            loadTasks();
        }

        input.addEventListener("blur", saveEdit);
        input.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") { input.blur(); }
            if (ev.key === "Escape") { loadTasks(); }
        });
    });

    if (!isCompleted) {
        notesArea.addEventListener("input", () => {
            autoExpand();
            renderNoteLinks(notesArea.value);
            updateTaskNotes(task.id, notesArea.value);
        });

        item.querySelector(".task-checkbox").addEventListener("click", () => {
            completeTask(task.id, item);
        });

        item.querySelector(".task-delete").addEventListener("click", () => {
            deleteTask(task.id, item);
        });
    } else {
        notesArea.readOnly = true;

        item.querySelector(".task-checkbox").addEventListener("click", async () => {
            await apiUncompleteTask(task.id);
            loadTasks();
        });

        item.querySelector(".task-delete").addEventListener("click", () => {
            item.style.transition = "all 0.3s ease";
            item.style.opacity = "0";
            item.style.transform = "translateX(20px)";
            setTimeout(async () => {
                await apiDeleteTask(task.id);
                loadTasks();
            }, 300);
        });
    }

    return item;
}

function sortByPriority(tasks) {
    const priorityOrder = { P0: 0, P1: 1, P2: 2 };
    return [...tasks].sort((a, b) => {
        const pa = parsePriority(a.title).priority;
        const pb = parsePriority(b.title).priority;
        const oa = pa ? priorityOrder[pa] : 3;
        const ob = pb ? priorityOrder[pb] : 3;
        if (oa !== ob) return oa - ob;
        // Within same priority, oldest first (most recent last)
        return new Date(a.createdAt) - new Date(b.createdAt);
    });
}

function renderTasks(tasks) {
    taskList.innerHTML = "";

    const sorted = sortByPriority(tasks);

    // Update total count in header
    const totalCountEl = document.getElementById("total-count");
    if (totalCountEl) totalCountEl.textContent = sorted.length;

    if (sorted.length === 0) {
        taskList.innerHTML = '<p class="empty-state">All done! 🎉</p>';
        return;
    }

    // Group tasks by prefix
    const groups = {};
    const ungrouped = [];

    sorted.forEach((task) => {
        const { prefix } = parsePrefix(task.title);
        if (prefix) {
            if (!groups[prefix]) groups[prefix] = [];
            groups[prefix].push(task);
        } else {
            ungrouped.push(task);
        }
    });

    // Render ungrouped tasks first
    ungrouped.forEach((task) => {
        taskList.appendChild(createTaskElement(task, false));
    });

    // Sort sections by average priority (P0=0, P1=1, P2=2, none=3)
    const priorityOrder = { P0: 0, P1: 1, P2: 2 };
    const sortedPrefixes = Object.keys(groups).sort((a, b) => {
        const avgA = groups[a].reduce((sum, t) => {
            const p = parsePriority(t.title).priority;
            return sum + (p ? priorityOrder[p] : 3);
        }, 0) / groups[a].length;
        const avgB = groups[b].reduce((sum, t) => {
            const p = parsePriority(t.title).priority;
            return sum + (p ? priorityOrder[p] : 3);
        }, 0) / groups[b].length;
        if (avgA !== avgB) return avgA - avgB;
        return a.localeCompare(b);
    });

    // Render each prefix group as collapsible
    sortedPrefixes.forEach((prefix) => {
        const section = document.createElement("details");
        section.className = "prefix-section";
        section.open = true;

        const summary = document.createElement("summary");
        summary.innerHTML = `<span class="section-title">${prefix}</span><span class="section-count">${groups[prefix].length}</span>`;
        section.appendChild(summary);

        const list = document.createElement("div");
        list.className = "prefix-task-list";
        groups[prefix].forEach((task) => {
            list.appendChild(createTaskElement(task, false));
        });
        section.appendChild(list);
        taskList.appendChild(section);
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function renderCompletedTasks(completed) {
    const completedCount = document.getElementById("completed-count");
    if (!completed || completed.length === 0) {
        completedSection.classList.add("hidden");
        if (completedCount) completedCount.textContent = "";
        return;
    }

    completedSection.classList.remove("hidden");
    if (completedCount) completedCount.textContent = completed.length;
    completedList.innerHTML = "";
    completed.forEach((task) => {
        completedList.appendChild(createTaskElement(task, true));
    });
}

// ============================================================
// Targets
// ============================================================

function parseMonthPrefix(title) {
    // Match YYMM prefix like "2605 - ..."
    const match = title.match(/^(\d{4})\s*-\s*/);
    if (match) {
        return { monthPrefix: match[1], rest: title.slice(match[0].length) };
    }
    return { monthPrefix: null, rest: title };
}

async function loadTargets() {
    const data = await fetchTargets();
    renderTargets(data.targets);
    renderCompletedTargets(data.completed);
}

async function addTarget(title) {
    await apiAddTarget(title);
    await loadTargets();
}

async function updateTargetNotes(targetId, notes) {
    await apiUpdateTarget(targetId, { notes });
}

function completeTarget(targetId, element) {
    playDing();
    const checkbox = element.querySelector(".task-checkbox");
    checkbox.classList.add("checked", "ding");
    element.classList.add("completed");

    setTimeout(async () => {
        await apiCompleteTarget(targetId);
        setTimeout(() => {
            element.style.height = element.offsetHeight + "px";
            element.style.overflow = "hidden";
            element.style.transition = "all 0.3s ease";
            requestAnimationFrame(() => {
                element.style.height = "0px";
                element.style.padding = "0 16px";
                element.style.margin = "0";
                element.style.opacity = "0";
            });
            setTimeout(() => {
                element.remove();
                loadTargets();
            }, 300);
        }, 400);
    }, 200);
}

function deleteTarget(targetId, element) {
    element.style.transition = "all 0.3s ease";
    element.style.opacity = "0";
    element.style.transform = "translateX(20px)";
    setTimeout(async () => {
        await apiDeleteTarget(targetId);
        loadTargets();
    }, 300);
}

function createTargetElement(target, isCompleted) {
    const titleForDisplay = target.displayTitle || target.title;
    const { priority, titleWithoutPriority } = parsePriority(titleForDisplay);
    const displayTitle = titleWithoutPriority;

    const item = document.createElement("div");
    item.className = "task-item" + (isCompleted ? " task-item-completed" : "");

    const priorityTag = priority
        ? `<span class="priority-tag priority-${priority.toLowerCase()}">${priority}</span>`
        : "";

    const timestamp = isCompleted && target.completedAt
        ? `Completed ${formatTimestamp(target.completedAt)}`
        : target.createdAt
            ? `Created ${formatTimestamp(target.createdAt)}`
            : "";

    item.innerHTML = `
        <div class="task-checkbox${isCompleted ? " checked" : ""}" data-id="${target.id}"></div>
        <div class="task-content">
            <span class="task-title">${escapeHtml(displayTitle)}</span>
            ${timestamp ? `<span class="task-timestamp">${timestamp}</span>` : ""}
            <div class="task-notes-panel hidden">
                <div class="task-notes-links"></div>
                <textarea class="task-notes" placeholder="Add notes...">${escapeHtml(target.notes || "")}</textarea>
            </div>
        </div>
        <div class="task-actions">
            ${priorityTag}
            <button class="task-edit" title="Edit">✎</button>
            <button class="task-delete" data-id="${target.id}">✕</button>
        </div>
    `;

    const titleEl = item.querySelector(".task-title");
    const notesPanel = item.querySelector(".task-notes-panel");
    const notesArea = item.querySelector(".task-notes");
    const notesLinks = item.querySelector(".task-notes-links");
    const editBtn = item.querySelector(".task-edit");

    function renderNoteLinks(text) {
        notesLinks.innerHTML = "";
        const urlRegex = /https?:\/\/[^\s]+/g;
        const matches = text.match(urlRegex);
        if (matches) {
            matches.forEach(url => {
                const btn = document.createElement("a");
                btn.href = url;
                btn.target = "_blank";
                btn.rel = "noopener noreferrer";
                btn.className = "note-link-btn";
                const lower = url.toLowerCase();
                if (lower.includes("teams")) {
                    btn.innerHTML = `<img class="note-link-icon" src="https://upload.wikimedia.org/wikipedia/commons/0/07/Microsoft_Office_Teams_%282025%E2%80%93present%29.svg" alt="Teams"> Teams Chat`;
                    btn.classList.add("note-link-teams");
                } else if (lower.includes("outlook")) {
                    btn.innerHTML = `<img class="note-link-icon" src="https://upload.wikimedia.org/wikipedia/commons/c/cc/Microsoft_Outlook_Icon_%282025%E2%80%93present%29.svg" alt="Outlook"> Email`;
                    btn.classList.add("note-link-outlook");
                } else {
                    btn.innerHTML = `<svg class="note-link-icon" width="12" height="12" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7.72 3.72a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06L11.44 9H3.75a.75.75 0 0 1 0-1.5h7.69L7.72 4.78a.75.75 0 0 1 0-1.06Z"/><path d="M13.5 3.75a.75.75 0 0 1 1.5 0v12.5a.75.75 0 0 1-1.5 0V3.75Z"/></svg>`;
                    try {
                        const u = new URL(url);
                        btn.innerHTML += ` ${u.hostname.replace("www.", "")}`;
                    } catch { btn.innerHTML += " Open Link"; }
                    btn.classList.add("note-link-generic");
                }
                notesLinks.appendChild(btn);
            });
        }
    }

    function autoExpand() {
        notesArea.style.height = "auto";
        notesArea.style.height = notesArea.scrollHeight + "px";
    }

    renderNoteLinks(target.notes || "");

    titleEl.addEventListener("click", (e) => {
        e.stopPropagation();
        notesPanel.classList.toggle("hidden");
        if (!notesPanel.classList.contains("hidden")) {
            autoExpand();
            notesArea.focus();
        }
    });

    editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const input = document.createElement("input");
        input.type = "text";
        input.className = "task-edit-input";
        input.value = target.title;
        titleEl.replaceWith(input);
        input.focus();
        input.select();

        function saveEdit() {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== target.title) {
                apiUpdateTarget(target.id, { title: newTitle }).then(() => loadTargets());
                return;
            }
            loadTargets();
        }

        input.addEventListener("blur", saveEdit);
        input.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") { input.blur(); }
            if (ev.key === "Escape") { loadTargets(); }
        });
    });

    if (!isCompleted) {
        notesArea.addEventListener("input", () => {
            autoExpand();
            renderNoteLinks(notesArea.value);
            updateTargetNotes(target.id, notesArea.value);
        });

        item.querySelector(".task-checkbox").addEventListener("click", () => {
            completeTarget(target.id, item);
        });

        item.querySelector(".task-delete").addEventListener("click", () => {
            deleteTarget(target.id, item);
        });
    } else {
        notesArea.readOnly = true;

        item.querySelector(".task-checkbox").addEventListener("click", async () => {
            await apiUncompleteTarget(target.id);
            loadTargets();
        });

        item.querySelector(".task-delete").addEventListener("click", () => {
            deleteTarget(target.id, item);
        });
    }

    return item;
}

function renderTargets(targets) {
    targetList.innerHTML = "";

    const sorted = sortByPriority(targets);

    // Update total count
    const totalCountEl = document.getElementById("targets-total-count");
    if (totalCountEl) totalCountEl.textContent = sorted.length;

    if (sorted.length === 0) {
        targetList.innerHTML = '<p class="empty-state">No targets yet. Add one above!</p>';
        return;
    }

    // Group by month prefix first, then by sub-prefix
    const monthGroups = {};
    const ungrouped = [];

    sorted.forEach((target) => {
        const { monthPrefix, rest } = parseMonthPrefix(target.title);
        if (monthPrefix) {
            if (!monthGroups[monthPrefix]) monthGroups[monthPrefix] = [];
            monthGroups[monthPrefix].push({ ...target, displayTitle: rest });
        } else {
            ungrouped.push(target);
        }
    });

    // Render ungrouped targets first
    ungrouped.forEach((target) => {
        targetList.appendChild(createTargetElement(target, false));
    });

    // Sort months (most recent first)
    const sortedMonths = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));

    sortedMonths.forEach((month) => {
        const monthSection = document.createElement("details");
        monthSection.className = "prefix-section month-section";
        monthSection.open = true;

        const monthSummary = document.createElement("summary");
        monthSummary.innerHTML = `<span class="section-title">${month}</span><span class="section-count">${monthGroups[month].length}</span>`;
        monthSection.appendChild(monthSummary);

        const monthContent = document.createElement("div");
        monthContent.className = "prefix-task-list";

        // Sub-group by prefix within month
        const subGroups = {};
        const subUngrouped = [];

        monthGroups[month].forEach((target) => {
            const { prefix } = parsePrefix(target.displayTitle);
            if (prefix) {
                if (!subGroups[prefix]) subGroups[prefix] = [];
                subGroups[prefix].push(target);
            } else {
                subUngrouped.push(target);
            }
        });

        // Render ungrouped within month
        subUngrouped.forEach((target) => {
            monthContent.appendChild(createTargetElement(target, false));
        });

        // Sort sub-groups by average priority
        const priorityOrder = { P0: 0, P1: 1, P2: 2 };
        const sortedSubPrefixes = Object.keys(subGroups).sort((a, b) => {
            const avgA = subGroups[a].reduce((sum, t) => {
                const p = parsePriority(t.title).priority;
                return sum + (p ? priorityOrder[p] : 3);
            }, 0) / subGroups[a].length;
            const avgB = subGroups[b].reduce((sum, t) => {
                const p = parsePriority(t.title).priority;
                return sum + (p ? priorityOrder[p] : 3);
            }, 0) / subGroups[b].length;
            if (avgA !== avgB) return avgA - avgB;
            return a.localeCompare(b);
        });

        sortedSubPrefixes.forEach((prefix) => {
            const subSection = document.createElement("details");
            subSection.className = "prefix-section sub-section";
            subSection.open = true;

            const subSummary = document.createElement("summary");
            subSummary.innerHTML = `<span class="section-title">${prefix}</span><span class="section-count">${subGroups[prefix].length}</span>`;
            subSection.appendChild(subSummary);

            const subList = document.createElement("div");
            subList.className = "prefix-task-list";
            subGroups[prefix].forEach((target) => {
                subList.appendChild(createTargetElement(target, false));
            });
            subSection.appendChild(subList);
            monthContent.appendChild(subSection);
        });

        monthSection.appendChild(monthContent);
        targetList.appendChild(monthSection);
    });
}

function renderCompletedTargets(completed) {
    const completedCount = document.getElementById("targets-completed-count");
    if (!completed || completed.length === 0) {
        targetsCompletedSection.classList.add("hidden");
        if (completedCount) completedCount.textContent = "";
        return;
    }

    targetsCompletedSection.classList.remove("hidden");
    if (completedCount) completedCount.textContent = completed.length;
    targetsCompletedList.innerHTML = "";
    completed.forEach((target) => {
        targetsCompletedList.appendChild(createTargetElement(target, true));
    });
}

// ============================================================
// Event Listeners
// ============================================================
addTaskForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = taskInput.value.trim();
    if (!title) return;
    taskInput.value = "";
    addTask(title);
});

addTargetForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = targetInput.value.trim();
    if (!title) return;
    targetInput.value = "";
    addTarget(title);
});

// ============================================================
// ============================================================
// Init
// ============================================================
loadTasks();
loadTargets();
