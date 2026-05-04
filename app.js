// ============================================================
// CONFIGURATION — Replace with your Azure AD app registration
// ============================================================
const msalConfig = {
    auth: {
        clientId: "YOUR_CLIENT_ID_HERE", // <-- Replace this
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin + window.location.pathname,
    },
    cache: {
        cacheLocation: "localStorage",
        storeAuthStateInCookie: false,
    },
};

const graphScopes = ["Tasks.ReadWrite"];

// ============================================================
// MSAL Instance
// ============================================================
const msalInstance = new msal.PublicClientApplication(msalConfig);

// ============================================================
// DOM Elements
// ============================================================
const signInBtn = document.getElementById("sign-in-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const appContent = document.getElementById("app-content");
const signedOutMsg = document.getElementById("signed-out-msg");
const addTaskForm = document.getElementById("add-task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");

// ============================================================
// State
// ============================================================
let currentAccount = null;
let taskListId = null; // Microsoft To-Do default list ID

// ============================================================
// Audio — Satisfying Ding 🔔
// ============================================================
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function playDing() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }

    const now = audioCtx.currentTime;

    // Primary tone — bright bell
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Harmonic overtone
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1320, now + 0.05); // E6
    gain2.gain.setValueAtTime(0.2, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.5);

    // High shimmer
    const osc3 = audioCtx.createOscillator();
    const gain3 = audioCtx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(2640, now + 0.08); // E7
    gain3.gain.setValueAtTime(0.08, now + 0.08);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc3.connect(gain3);
    gain3.connect(audioCtx.destination);
    osc3.start(now + 0.08);
    osc3.stop(now + 0.35);
}

// ============================================================
// Auth
// ============================================================
async function signIn() {
    try {
        const response = await msalInstance.loginPopup({ scopes: graphScopes });
        currentAccount = response.account;
        updateUI(true);
        await loadTasks();
    } catch (error) {
        console.error("Sign-in error:", error);
    }
}

function signOut() {
    msalInstance.logoutPopup();
    currentAccount = null;
    updateUI(false);
}

async function getAccessToken() {
    if (!currentAccount) return null;
    try {
        const response = await msalInstance.acquireTokenSilent({
            scopes: graphScopes,
            account: currentAccount,
        });
        return response.accessToken;
    } catch (error) {
        // Fallback to interactive
        const response = await msalInstance.acquireTokenPopup({
            scopes: graphScopes,
        });
        return response.accessToken;
    }
}

// ============================================================
// Graph API Helpers
// ============================================================
async function graphRequest(url, method = "GET", body = null) {
    const token = await getAccessToken();
    if (!token) return null;

    const options = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`https://graph.microsoft.com/v1.0${url}`, options);
    if (response.status === 204) return null;
    return response.json();
}

async function getDefaultTaskList() {
    const result = await graphRequest("/me/todo/lists");
    if (result && result.value && result.value.length > 0) {
        // Use the default "Tasks" list
        const defaultList = result.value.find(l => l.wellknownListName === "defaultList") || result.value[0];
        return defaultList.id;
    }
    return null;
}

// ============================================================
// Task Operations
// ============================================================
async function loadTasks() {
    taskListId = await getDefaultTaskList();
    if (!taskListId) {
        taskList.innerHTML = '<p class="empty-state">Could not load task list.</p>';
        return;
    }

    const result = await graphRequest(
        `/me/todo/lists/${taskListId}/tasks?$filter=status ne 'completed'&$orderby=createdDateTime desc&$top=50`
    );

    if (result && result.value) {
        renderTasks(result.value);
    } else {
        taskList.innerHTML = '<p class="empty-state">No tasks yet. Add one above!</p>';
    }
}

async function addTask(title) {
    if (!taskListId) return;

    const result = await graphRequest(`/me/todo/lists/${taskListId}/tasks`, "POST", {
        title: title,
        isReminderOn: false,
    });

    if (result) {
        await loadTasks();
    }
}

async function completeTask(taskId, element) {
    // Play ding and animate
    playDing();

    const checkbox = element.querySelector(".task-checkbox");
    checkbox.classList.add("checked", "ding");
    element.classList.add("completed");

    // Wait for animation then update API
    setTimeout(async () => {
        await graphRequest(`/me/todo/lists/${taskListId}/tasks/${taskId}`, "PATCH", {
            status: "completed",
        });

        // Remove from list after a moment
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
            setTimeout(() => element.remove(), 300);
        }, 400);
    }, 200);
}

async function deleteTask(taskId, element) {
    element.style.transition = "all 0.3s ease";
    element.style.opacity = "0";
    element.style.transform = "translateX(20px)";

    setTimeout(async () => {
        await graphRequest(`/me/todo/lists/${taskListId}/tasks/${taskId}`, "DELETE");
        element.remove();
    }, 300);
}

// ============================================================
// Render
// ============================================================
function renderTasks(tasks) {
    if (tasks.length === 0) {
        taskList.innerHTML = '<p class="empty-state">All done! 🎉</p>';
        return;
    }

    taskList.innerHTML = "";
    tasks.forEach((task) => {
        const item = document.createElement("div");
        item.className = "task-item";
        item.innerHTML = `
            <div class="task-checkbox" data-id="${task.id}"></div>
            <span class="task-title">${escapeHtml(task.title)}</span>
            <button class="task-delete" data-id="${task.id}">✕</button>
        `;

        item.querySelector(".task-checkbox").addEventListener("click", () => {
            completeTask(task.id, item);
        });

        item.querySelector(".task-delete").addEventListener("click", () => {
            deleteTask(task.id, item);
        });

        taskList.appendChild(item);
    });
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// UI State
// ============================================================
function updateUI(signedIn) {
    if (signedIn) {
        signInBtn.classList.add("hidden");
        signOutBtn.classList.remove("hidden");
        appContent.classList.remove("hidden");
        signedOutMsg.classList.add("hidden");
    } else {
        signInBtn.classList.remove("hidden");
        signOutBtn.classList.add("hidden");
        appContent.classList.add("hidden");
        signedOutMsg.classList.remove("hidden");
        taskList.innerHTML = "";
    }
}

// ============================================================
// Event Listeners
// ============================================================
signInBtn.addEventListener("click", signIn);
signOutBtn.addEventListener("click", signOut);

addTaskForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = taskInput.value.trim();
    if (!title) return;
    taskInput.value = "";
    await addTask(title);
});

// ============================================================
// Init — Check for existing session
// ============================================================
(async () => {
    await msalInstance.initialize();

    // Handle redirect response (if using redirect flow)
    await msalInstance.handleRedirectPromise();

    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
        currentAccount = accounts[0];
        updateUI(true);
        await loadTasks();
    } else {
        updateUI(false);
    }
})();
