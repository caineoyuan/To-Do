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

async function apiAddTask(title, targetNumber) {
    const body = { title };
    if (targetNumber) body.targetNumber = targetNumber;
    const res = await fetch(`${API_BASE}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
// Target Number Suffix Parsing
// ============================================================
// Parse suffixes right-to-left: trailing - P[012] = priority, then trailing - \d+ = target number
function parseSuffixes(title) {
    let remaining = title;
    let priority = null;
    let targetNum = null;

    // Try stripping from right: could be "- 05", "- P0", "- P0 - 05", or "- 05 - P0"
    // First pass: check rightmost suffix
    const tMatch = remaining.match(/\s*-\s*(\d+)\s*$/);
    const pMatch = remaining.match(/\s*-\s*(P[012])\s*$/i);

    if (tMatch) {
        // Rightmost is target number
        targetNum = parseInt(tMatch[1]);
        remaining = remaining.slice(0, -tMatch[0].length);
        // Check if priority is next
        const pMatch2 = remaining.match(/\s*-\s*(P[012])\s*$/i);
        if (pMatch2) {
            priority = pMatch2[1].toUpperCase();
            remaining = remaining.slice(0, -pMatch2[0].length);
        }
    } else if (pMatch) {
        // Rightmost is priority
        priority = pMatch[1].toUpperCase();
        remaining = remaining.slice(0, -pMatch[0].length);
        // Check if target number is next
        const tMatch2 = remaining.match(/\s*-\s*(\d+)\s*$/);
        if (tMatch2) {
            targetNum = parseInt(tMatch2[1]);
            remaining = remaining.slice(0, -tMatch2[0].length);
        }
    }

    return { priority, targetNumber: targetNum, cleanTitle: remaining };
}

// ============================================================
// Task Operations
// ============================================================

// Global targets cache for lookups
let allTargets = [];

async function loadTasks() {
    const data = await fetchTasks();
    renderTasks(data.tasks);
    renderCompletedTasks(data.completed);
}

async function addTask(title) {
    // Parse target number from suffix
    const { targetNumber } = parseSuffixes(title);
    // Only link if target exists
    let validTargetNum = null;
    if (targetNumber && allTargets.some(t => t.targetNumber === targetNumber)) {
        validTargetNum = targetNumber;
    }

    // Auto-link by prefix if no explicit target ID
    if (!validTargetNum) {
        const { prefix } = parsePrefix(title);
        if (prefix) {
            // Find a target whose title (after month prefix) starts with the same prefix
            const matchingTarget = allTargets.find(t => {
                const { rest } = parseMonthPrefix(t.title);
                const { prefix: tPrefix } = parsePrefix(rest);
                return tPrefix === prefix;
            });
            if (matchingTarget && matchingTarget.targetNumber) {
                validTargetNum = matchingTarget.targetNumber;
            }
        }
    }

    await apiAddTask(title, validTargetNum);
    await loadTasks();
    if (validTargetNum) loadTargets();
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
                loadTargets();
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
        loadTargets();
    }, 300);
}

// ============================================================
// Render
// ============================================================
function createTaskElement(task, isCompleted) {
    const { priority, targetNumber, cleanTitle } = parseSuffixes(task.title);
    const displayTitle = cleanTitle;

    // Find parent target if task has a targetNumber
    const parentTarget = task.targetNumber ? allTargets.find(t => t.targetNumber === task.targetNumber) : null;

    const item = document.createElement("div");
    item.className = "task-item" + (isCompleted ? " task-item-completed" : "");

    const priorityTag = priority
        ? `<span class="priority-tag priority-${priority.toLowerCase()}">${priority}</span>`
        : "";

    const parentBadge = parentTarget
        ? `<span class="parent-target-badge" title="${escapeHtml(parentTarget.title)}"><svg class="parent-target-icon" width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="6.5" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg><span class="target-id-badge">${String(parentTarget.targetNumber).padStart(2, '0')}</span></span>`
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
            ${parentBadge ? `<div class="task-parent-line">${parentBadge}</div>` : ""}
            ${timestamp ? `<span class="task-timestamp">${timestamp}</span>` : ""}
            <div class="task-notes-panel hidden">
                <div class="task-notes-links"></div>
                <textarea class="task-notes" placeholder="Add notes...">${escapeHtml(task.notes || "")}</textarea>
            </div>
            <div class="task-parent-detail hidden"></div>
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
                    btn.innerHTML = `<svg class="note-link-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`;
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

    // Parent target badge click → show parent target info
    const parentBadgeEl = item.querySelector(".parent-target-badge");
    const parentDetail = item.querySelector(".task-parent-detail");
    if (parentBadgeEl && parentTarget) {
        parentBadgeEl.addEventListener("click", (e) => {
            e.stopPropagation();
            parentDetail.classList.toggle("hidden");
            if (!parentDetail.classList.contains("hidden")) {
                parentDetail.innerHTML = `<div class="parent-target-info">🎯 <strong>${escapeHtml(parentTarget.title)}</strong> <span class="parent-target-id">#${String(parentTarget.targetNumber).padStart(2, '0')}</span></div>`;
            }
        });
    }

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
                const { targetNumber } = parseSuffixes(newTitle);
                let validTargetNum = null;
                if (targetNumber && allTargets.some(t => t.targetNumber === targetNumber)) {
                    validTargetNum = targetNumber;
                }
                // Auto-link by prefix if no explicit target ID
                if (!validTargetNum) {
                    const { prefix } = parsePrefix(newTitle);
                    if (prefix) {
                        const matchingTarget = allTargets.find(t => {
                            const { rest } = parseMonthPrefix(t.title);
                            const { prefix: tPrefix } = parsePrefix(rest);
                            return tPrefix === prefix;
                        });
                        if (matchingTarget && matchingTarget.targetNumber) {
                            validTargetNum = matchingTarget.targetNumber;
                        }
                    }
                }
                apiUpdateTask(task.id, { title: newTitle, targetNumber: validTargetNum }).then(() => { loadTasks(); loadTargets(); });
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
            loadTargets();
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
    allTargets = [...data.targets, ...data.completed];
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
    const targetNumStr = target.targetNumber ? String(target.targetNumber).padStart(2, '0') : '';

    const item = document.createElement("div");
    item.className = "task-item target-item" + (isCompleted ? " task-item-completed" : "");

    const priorityTag = priority
        ? `<span class="priority-tag priority-${priority.toLowerCase()}">${priority}</span>`
        : "";

    const targetIdBadge = targetNumStr
        ? `<span class="target-id-badge">${targetNumStr}</span>`
        : "";

    const timestamp = isCompleted && target.completedAt
        ? `Completed ${formatTimestamp(target.completedAt)}`
        : target.createdAt
            ? `Created ${formatTimestamp(target.createdAt)}`
            : "";

    item.innerHTML = `
        <div class="task-checkbox${isCompleted ? " checked" : ""}" data-id="${target.id}"></div>
        <div class="task-content">
            <span class="task-title">${targetIdBadge}${escapeHtml(displayTitle)}</span>
            <div class="target-progress-wrapper hidden"><div class="target-progress-bar"><div class="target-progress-fill"></div></div><span class="target-progress-pct">0%</span></div>
            ${timestamp ? `<span class="task-timestamp">${timestamp}</span>` : ""}
            <div class="target-children hidden"></div>
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
                    btn.innerHTML = `<svg class="note-link-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`;
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

    // Load and display progress bar if target has a number
    const progressWrapper = item.querySelector(".target-progress-wrapper");
    const progressFill = item.querySelector(".target-progress-fill");
    const progressPct = item.querySelector(".target-progress-pct");
    const childrenPanel = item.querySelector(".target-children");

    if (target.targetNumber && !isCompleted) {
        // Always show progress bar for targets with a number
        progressWrapper.classList.remove("hidden");
        fetch(`${API_BASE}/targets/${target.targetNumber}/tasks`)
            .then(r => r.json())
            .then(data => {
                const total = data.active.length + data.completed.length;
                if (total > 0) {
                    const pct = Math.round((data.completed.length / total) * 100);
                    progressFill.style.width = pct + "%";
                    progressPct.textContent = pct + "%";
                    progressFill.title = `${data.completed.length}/${total} tasks completed`;
                } else {
                    progressFill.style.width = "0%";
                    progressPct.textContent = "0%";
                }
            }).catch(() => {});
    }

    titleEl.addEventListener("click", async (e) => {
        e.stopPropagation();
        // Toggle children panel
        if (target.targetNumber) {
            childrenPanel.classList.toggle("hidden");
            if (!childrenPanel.classList.contains("hidden")) {
                childrenPanel.innerHTML = "<em>Loading...</em>";
                try {
                    const data = await fetch(`${API_BASE}/targets/${target.targetNumber}/tasks`).then(r => r.json());
                    childrenPanel.innerHTML = "";
                    if (data.active.length === 0 && data.completed.length === 0) {
                        childrenPanel.innerHTML = '<span class="empty-state" style="font-size:0.8rem">No linked tasks</span>';
                    } else {
                        data.active.forEach(t => {
                            const el = document.createElement("div");
                            el.className = "child-task-item";
                            el.innerHTML = `<span class="child-task-dot">○</span> ${escapeHtml(parseSuffixes(t.title).cleanTitle)}`;
                            childrenPanel.appendChild(el);
                        });
                        data.completed.forEach(t => {
                            const el = document.createElement("div");
                            el.className = "child-task-item child-task-done";
                            el.innerHTML = `<svg class="child-task-check" width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#4caf50" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ${escapeHtml(parseSuffixes(t.title).cleanTitle)}`;
                            childrenPanel.appendChild(el);
                        });
                    }
                } catch { childrenPanel.innerHTML = "<em>Error loading tasks</em>"; }
            }
        } else {
            notesPanel.classList.toggle("hidden");
            if (!notesPanel.classList.contains("hidden")) {
                autoExpand();
                notesArea.focus();
            }
        }
    });

    // Right-click or long-press for notes on targets with children
    if (target.targetNumber) {
        item.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            notesPanel.classList.toggle("hidden");
            if (!notesPanel.classList.contains("hidden")) {
                autoExpand();
                notesArea.focus();
            }
        });
    }

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

    // Determine current month in YYMM format
    const now = new Date();
    const currentMonth = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0');

    // Split months into current/future and past
    const allMonths = Object.keys(monthGroups);
    const currentAndFuture = allMonths.filter(m => m >= currentMonth).sort((a, b) => {
        // Current month first, then ascending
        if (a === currentMonth) return -1;
        if (b === currentMonth) return 1;
        return a.localeCompare(b);
    });
    const pastMonths = allMonths.filter(m => m < currentMonth).sort((a, b) => b.localeCompare(a));

    // Render current and future months
    currentAndFuture.forEach((month) => {
        targetList.appendChild(renderMonthSection(month, monthGroups[month], true));
    });

    // Render past months in a collapsed "Past" section
    if (pastMonths.length > 0) {
        const pastSection = document.createElement("details");
        pastSection.className = "prefix-section month-section";
        pastSection.open = false;

        const pastSummary = document.createElement("summary");
        const pastCount = pastMonths.reduce((sum, m) => sum + monthGroups[m].length, 0);
        pastSummary.innerHTML = `<span class="section-title">Past</span><span class="section-count">${pastCount}</span>`;
        pastSection.appendChild(pastSummary);

        const pastContent = document.createElement("div");
        pastContent.className = "prefix-task-list";
        pastMonths.forEach((month) => {
            pastContent.appendChild(renderMonthSection(month, monthGroups[month], false));
        });
        pastSection.appendChild(pastContent);
        targetList.appendChild(pastSection);
    }
}

function renderMonthSection(month, targets, open) {
    const monthSection = document.createElement("details");
    monthSection.className = "prefix-section month-section";
    monthSection.open = open;

    const monthSummary = document.createElement("summary");
    monthSummary.innerHTML = `<span class="section-title">${month}</span><span class="section-count">${targets.length}</span>`;
    monthSection.appendChild(monthSummary);

    const monthContent = document.createElement("div");
    monthContent.className = "prefix-task-list";

    // Sub-group by prefix within month
    const subGroups = {};
    const subUngrouped = [];

    targets.forEach((target) => {
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
    return monthSection;
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

// Export targets as bulleted list
document.getElementById("export-targets-btn").addEventListener("click", async () => {
    const data = await fetch(`${API_BASE}/targets`).then(r => r.json());
    const targets = data.targets || [];

    const monthGroups = {};
    const ungrouped = [];

    targets.forEach(t => {
        const { monthPrefix, rest } = parseMonthPrefix(t.title);
        if (monthPrefix) {
            if (!monthGroups[monthPrefix]) monthGroups[monthPrefix] = [];
            monthGroups[monthPrefix].push(rest);
        } else {
            ungrouped.push(t.title);
        }
    });

    let html = "";
    let text = "";
    const sortedMonths = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));
    sortedMonths.forEach(month => {
        html += `<b>${month} Targets:</b><ul>`;
        text += `${month} Targets:\n`;
        const subGroups = {};
        const subUngrouped = [];
        monthGroups[month].forEach(title => {
            const { prefix, displayTitle } = parsePrefix(title);
            if (prefix) {
                if (!subGroups[prefix]) subGroups[prefix] = [];
                subGroups[prefix].push(parseSuffixes(displayTitle).cleanTitle);
            } else {
                subUngrouped.push(parseSuffixes(title).cleanTitle);
            }
        });
        subUngrouped.forEach(t => { html += `<li>${escapeHtml(t)}</li>`; text += `- ${t}\n`; });
        Object.keys(subGroups).sort().forEach(prefix => {
            html += `<li><b>${escapeHtml(prefix)}</b><ul>`;
            text += `- ${prefix}\n`;
            subGroups[prefix].forEach(t => { html += `<li>${escapeHtml(t)}</li>`; text += `  - ${t}\n`; });
            html += `</ul></li>`;
        });
        html += `</ul>`;
        text += "\n";
    });
    if (ungrouped.length) {
        html += `<b>Other Targets:</b><ul>`;
        text += `Other Targets:\n`;
        ungrouped.forEach(t => { const c = parseSuffixes(t).cleanTitle; html += `<li>${escapeHtml(c)}</li>`; text += `- ${c}\n`; });
        html += `</ul>`;
    }

    copyRichText(html, text.trim());
    showExportToast("Targets copied to clipboard!");
});

// Export tasks as bulleted list
document.getElementById("export-tasks-btn").addEventListener("click", async () => {
    const data = await fetch(`${API_BASE}/tasks`).then(r => r.json());
    const tasks = data.tasks || [];

    const prefixGroups = {};
    const ungrouped = [];

    tasks.forEach(t => {
        const { prefix, displayTitle } = parsePrefix(t.title);
        if (prefix) {
            if (!prefixGroups[prefix]) prefixGroups[prefix] = [];
            prefixGroups[prefix].push(parseSuffixes(displayTitle).cleanTitle);
        } else {
            ungrouped.push(parseSuffixes(t.title).cleanTitle);
        }
    });

    let html = "<b>Tasks:</b><ul>";
    let text = "Tasks:\n";
    Object.keys(prefixGroups).sort().forEach(prefix => {
        html += `<li><b>${escapeHtml(prefix)}</b><ul>`;
        text += `- ${prefix}\n`;
        prefixGroups[prefix].forEach(t => { html += `<li>${escapeHtml(t)}</li>`; text += `  - ${t}\n`; });
        html += `</ul></li>`;
    });
    ungrouped.forEach(t => { html += `<li>${escapeHtml(t)}</li>`; text += `- ${t}\n`; });
    html += `</ul>`;

    copyRichText(html, text.trim());
    showExportToast("Tasks copied to clipboard!");
});

function copyRichText(html, plainText) {
    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([plainText], { type: "text/plain" });
    navigator.clipboard.write([
        new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob })
    ]);
}

function showExportToast(msg) {
    const toast = document.createElement("div");
    toast.className = "export-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 2000);
}

// ============================================================
// ============================================================
// Init
// ============================================================
// Load targets first so allTargets is available for task rendering
loadTargets().then(() => loadTasks());
