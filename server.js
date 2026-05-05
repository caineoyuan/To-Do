const express = require("express");
const cors = require("cors");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || "todo";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || "local-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Auth middleware — skip for login routes and static login page
function requireAuth(req, res, next) {
    if (req.session.authenticated) return next();
    if (req.path === "/login" || req.path === "/api/login") return next();
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "unauthorized" });
    // Serve login page for non-API requests
    return res.sendFile(path.join(__dirname, "login.html"));
}

app.post("/api/login", (req, res) => {
    const { password } = req.body;
    if (password === APP_PASSWORD) {
        req.session.authenticated = true;
        return res.json({ success: true });
    }
    res.status(401).json({ error: "wrong password" });
});

app.post("/api/logout", (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.use(requireAuth);
app.use(express.static(__dirname));

// ============================================================
// Storage abstraction — PostgreSQL when DATABASE_URL is set,
// otherwise falls back to local JSON file.
// ============================================================

let db;

if (process.env.DATABASE_URL) {
    // --- PostgreSQL storage ---
    const { Pool } = require("pg");
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes("railway") ? { rejectUnauthorized: false } : false,
    });

    db = {
        async init() {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    notes TEXT DEFAULT '',
                    completed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    completed_at TIMESTAMPTZ
                )
            `);
        },
        async getAll() {
            const active = await pool.query("SELECT * FROM tasks WHERE completed = FALSE ORDER BY created_at DESC");
            const completed = await pool.query("SELECT * FROM tasks WHERE completed = TRUE ORDER BY completed_at DESC");
            return { tasks: active.rows.map(rowToTask), completed: completed.rows.map(rowToTask) };
        },
        async create(id, title, notes) {
            const result = await pool.query(
                "INSERT INTO tasks (id, title, notes) VALUES ($1, $2, $3) RETURNING *", [id, title, notes]
            );
            return rowToTask(result.rows[0]);
        },
        async update(id, fields) {
            const sets = []; const values = []; let idx = 1;
            if (fields.title !== undefined) { sets.push(`title = $${idx++}`); values.push(fields.title); }
            if (fields.notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(fields.notes); }
            if (sets.length === 0) return null;
            values.push(id);
            const result = await pool.query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`, values);
            return result.rows.length ? rowToTask(result.rows[0]) : null;
        },
        async complete(id) {
            const result = await pool.query("UPDATE tasks SET completed = TRUE, completed_at = NOW() WHERE id = $1 RETURNING *", [id]);
            return result.rows.length ? rowToTask(result.rows[0]) : null;
        },
        async uncomplete(id) {
            const result = await pool.query("UPDATE tasks SET completed = FALSE, completed_at = NULL WHERE id = $1 RETURNING *", [id]);
            return result.rows.length ? rowToTask(result.rows[0]) : null;
        },
        async delete(id) {
            const result = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
            return result.rowCount > 0;
        },
    };

    function rowToTask(row) {
        const task = { id: row.id, title: row.title, notes: row.notes, createdAt: row.created_at };
        if (row.completed_at) task.completedAt = row.completed_at;
        return task;
    }
} else {
    // --- JSON file storage (local dev) ---
    const DATA_FILE = path.join(__dirname, "data", "tasks.json");

    function ensureDataFile() {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify({ tasks: [], completed: [] }, null, 2));
        }
    }
    function readData() { ensureDataFile(); return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")); }
    function writeData(data) { ensureDataFile(); fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

    db = {
        async init() { ensureDataFile(); },
        async getAll() { return readData(); },
        async create(id, title, notes) {
            const data = readData();
            const task = { id, title, notes, createdAt: new Date().toISOString() };
            data.tasks.unshift(task);
            writeData(data);
            return task;
        },
        async update(id, fields) {
            const data = readData();
            const task = data.tasks.find(t => t.id === id) || data.completed.find(t => t.id === id);
            if (!task) return null;
            if (fields.title !== undefined) task.title = fields.title;
            if (fields.notes !== undefined) task.notes = fields.notes;
            writeData(data);
            return task;
        },
        async complete(id) {
            const data = readData();
            const idx = data.tasks.findIndex(t => t.id === id);
            if (idx === -1) return null;
            const [task] = data.tasks.splice(idx, 1);
            task.completedAt = new Date().toISOString();
            data.completed.unshift(task);
            writeData(data);
            return task;
        },
        async uncomplete(id) {
            const data = readData();
            const idx = data.completed.findIndex(t => t.id === id);
            if (idx === -1) return null;
            const [task] = data.completed.splice(idx, 1);
            delete task.completedAt;
            data.tasks.unshift(task);
            writeData(data);
            return task;
        },
        async delete(id) {
            const data = readData();
            let idx = data.tasks.findIndex(t => t.id === id);
            if (idx !== -1) { data.tasks.splice(idx, 1); writeData(data); return true; }
            idx = data.completed.findIndex(t => t.id === id);
            if (idx !== -1) { data.completed.splice(idx, 1); writeData(data); return true; }
            return false;
        },
    };
}

// ============================================================
// Routes
// ============================================================

app.get("/api/tasks", async (req, res) => {
    try { res.json(await db.getAll()); }
    catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.post("/api/tasks", async (req, res) => {
    const { title, notes } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    try {
        const task = await db.create(Date.now().toString(), title, notes || "");
        res.status(201).json(task);
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.patch("/api/tasks/:id", async (req, res) => {
    const { title, notes } = req.body;
    try {
        const task = await db.update(req.params.id, { title, notes });
        if (!task) return res.status(404).json({ error: "task not found" });
        res.json(task);
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.post("/api/tasks/:id/complete", async (req, res) => {
    try {
        const task = await db.complete(req.params.id);
        if (!task) return res.status(404).json({ error: "task not found" });
        res.json(task);
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.post("/api/tasks/:id/uncomplete", async (req, res) => {
    try {
        const task = await db.uncomplete(req.params.id);
        if (!task) return res.status(404).json({ error: "task not found" });
        res.json(task);
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.delete("/api/tasks/:id", async (req, res) => {
    try {
        const deleted = await db.delete(req.params.id);
        if (!deleted) return res.status(404).json({ error: "task not found" });
        res.status(204).send();
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

// ============================================================
// Start
// ============================================================
db.init().then(() => {
    app.listen(PORT, () => console.log(`To-Do server running on http://localhost:${PORT}`));
}).catch(err => { console.error("Failed to initialize database:", err); process.exit(1); });
