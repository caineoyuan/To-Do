const express = require("express");
const cors = require("cors");
const session = require("express-session");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const APP_PASSWORD = process.env.APP_PASSWORD || "";
const API_KEY = process.env.API_KEY || "";

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session config — use PostgreSQL store if DATABASE_URL is set (persists across redeploys)
const sessionConfig = {
    secret: process.env.SESSION_SECRET || "local-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
};

if (process.env.DATABASE_URL) {
    const pgSession = require("connect-pg-simple")(session);
    sessionConfig.store = new pgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
    });
}

app.use(session(sessionConfig));

// Auth middleware — session OR API key
function requireAuth(req, res, next) {
    if (req.session.authenticated) return next();
    if (API_KEY && req.headers["x-api-key"] === API_KEY) return next();
    if (req.path === "/login" || req.path === "/api/login") return next();
    if (req.path === "/quick-add.html" || req.path === "/favicon.svg") return next();
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "unauthorized" });
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
                    target_number INTEGER,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    completed_at TIMESTAMPTZ
                )
            `);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS targets (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    notes TEXT DEFAULT '',
                    target_number INTEGER UNIQUE,
                    completed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    completed_at TIMESTAMPTZ
                )
            `);
            // Add columns if they don't exist (for existing deployments)
            await pool.query(`ALTER TABLE targets ADD COLUMN IF NOT EXISTS target_number INTEGER UNIQUE`);
            await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_number INTEGER`);

            // Re-link tasks whose title contains a target suffix but target_number is null
            const unlinked = await pool.query("SELECT id, title FROM tasks WHERE target_number IS NULL");
            const allTargetsRes = await pool.query("SELECT target_number, title FROM targets");
            const validNums = new Set(allTargetsRes.rows.map(r => r.target_number));
            // Build prefix-to-target_number map for auto-linking
            const prefixMap = {};
            for (const t of allTargetsRes.rows) {
                const monthMatch = t.title.match(/^\d{4}\s*-\s*/);
                const rest = monthMatch ? t.title.slice(monthMatch[0].length) : t.title;
                const prefixMatch = rest.match(/^([A-Z0-9]+)\s*-\s*/);
                if (prefixMatch && t.target_number) {
                    prefixMap[prefixMatch[1]] = t.target_number;
                }
            }
            for (const row of unlinked.rows) {
                let linked = false;
                const tMatch = row.title.match(/\s*-\s*(\d+)\s*$/);
                if (tMatch) {
                    const num = parseInt(tMatch[1]);
                    if (validNums.has(num)) {
                        await pool.query("UPDATE tasks SET target_number = $1 WHERE id = $2", [num, row.id]);
                        linked = true;
                    }
                } else {
                    // Check if priority is rightmost, then target next
                    const pMatch = row.title.match(/\s*-\s*P[012]\s*$/i);
                    if (pMatch) {
                        const remaining = row.title.slice(0, -pMatch[0].length);
                        const tMatch2 = remaining.match(/\s*-\s*(\d+)\s*$/);
                        if (tMatch2) {
                            const num = parseInt(tMatch2[1]);
                            if (validNums.has(num)) {
                                await pool.query("UPDATE tasks SET target_number = $1 WHERE id = $2", [num, row.id]);
                                linked = true;
                            }
                        }
                    }
                }
                // Auto-link by prefix if no explicit target ID found
                if (!linked) {
                    const prefixMatch = row.title.match(/^([A-Z0-9]+)\s*-\s*/);
                    if (prefixMatch && prefixMap[prefixMatch[1]]) {
                        await pool.query("UPDATE tasks SET target_number = $1 WHERE id = $2", [prefixMap[prefixMatch[1]], row.id]);
                    }
                }
            }
        },
        async getAll() {
            const active = await pool.query("SELECT * FROM tasks WHERE completed = FALSE ORDER BY created_at DESC");
            const completed = await pool.query("SELECT * FROM tasks WHERE completed = TRUE ORDER BY completed_at DESC");
            return { tasks: active.rows.map(rowToTask), completed: completed.rows.map(rowToTask) };
        },
        async create(id, title, notes, targetNumber) {
            const result = await pool.query(
                "INSERT INTO tasks (id, title, notes, target_number) VALUES ($1, $2, $3, $4) RETURNING *", [id, title, notes, targetNumber || null]
            );
            return rowToTask(result.rows[0]);
        },
        async update(id, fields) {
            const sets = []; const values = []; let idx = 1;
            if (fields.title !== undefined) { sets.push(`title = $${idx++}`); values.push(fields.title); }
            if (fields.notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(fields.notes); }
            if (fields.targetNumber !== undefined) { sets.push(`target_number = $${idx++}`); values.push(fields.targetNumber); }
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
        // Targets
        async getAllTargets() {
            const active = await pool.query("SELECT * FROM targets WHERE completed = FALSE ORDER BY created_at DESC");
            const completed = await pool.query("SELECT * FROM targets WHERE completed = TRUE ORDER BY completed_at DESC");
            return { targets: active.rows.map(rowToTarget), completed: completed.rows.map(rowToTarget) };
        },
        async createTarget(id, title, notes) {
            // Auto-generate next target_number
            const maxRes = await pool.query("SELECT COALESCE(MAX(target_number), 0) as max_num FROM targets");
            const nextNum = maxRes.rows[0].max_num + 1;
            const result = await pool.query(
                "INSERT INTO targets (id, title, notes, target_number) VALUES ($1, $2, $3, $4) RETURNING *", [id, title, notes, nextNum]
            );
            return rowToTarget(result.rows[0]);
        },
        async updateTarget(id, fields) {
            const sets = []; const values = []; let idx = 1;
            if (fields.title !== undefined) { sets.push(`title = $${idx++}`); values.push(fields.title); }
            if (fields.notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(fields.notes); }
            if (sets.length === 0) return null;
            values.push(id);
            const result = await pool.query(`UPDATE targets SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`, values);
            return result.rows.length ? rowToTarget(result.rows[0]) : null;
        },
        async completeTarget(id) {
            const result = await pool.query("UPDATE targets SET completed = TRUE, completed_at = NOW() WHERE id = $1 RETURNING *", [id]);
            return result.rows.length ? rowToTarget(result.rows[0]) : null;
        },
        async uncompleteTarget(id) {
            const result = await pool.query("UPDATE targets SET completed = FALSE, completed_at = NULL WHERE id = $1 RETURNING *", [id]);
            return result.rows.length ? rowToTarget(result.rows[0]) : null;
        },
        async deleteTarget(id) {
            const result = await pool.query("DELETE FROM targets WHERE id = $1", [id]);
            return result.rowCount > 0;
        },
        async getTasksForTarget(targetNumber) {
            const active = await pool.query("SELECT * FROM tasks WHERE target_number = $1 AND completed = FALSE ORDER BY created_at DESC", [targetNumber]);
            const completed = await pool.query("SELECT * FROM tasks WHERE target_number = $1 AND completed = TRUE ORDER BY completed_at DESC", [targetNumber]);
            return { active: active.rows.map(rowToTask), completed: completed.rows.map(rowToTask) };
        },
    };

    function rowToTask(row) {
        const task = { id: row.id, title: row.title, notes: row.notes, createdAt: row.created_at };
        if (row.completed_at) task.completedAt = row.completed_at;
        if (row.target_number) task.targetNumber = row.target_number;
        return task;
    }

    function rowToTarget(row) {
        const target = { id: row.id, title: row.title, notes: row.notes, createdAt: row.created_at, targetNumber: row.target_number };
        if (row.completed_at) target.completedAt = row.completed_at;
        return target;
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
        async create(id, title, notes, targetNumber) {
            const data = readData();
            const task = { id, title, notes, createdAt: new Date().toISOString() };
            if (targetNumber) task.targetNumber = targetNumber;
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
            if (fields.targetNumber !== undefined) task.targetNumber = fields.targetNumber;
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
        // Targets (JSON fallback)
        async getAllTargets() {
            const data = readData();
            return { targets: data.targets || [], completed: data.targetsCompleted || [] };
        },
        async createTarget(id, title, notes) {
            const data = readData();
            if (!data.targets) data.targets = [];
            const allTargets = [...(data.targets || []), ...(data.targetsCompleted || [])];
            const maxNum = allTargets.reduce((max, t) => Math.max(max, t.targetNumber || 0), 0);
            const target = { id, title, notes, targetNumber: maxNum + 1, createdAt: new Date().toISOString() };
            data.targets.unshift(target);
            writeData(data);
            return target;
        },
        async updateTarget(id, fields) {
            const data = readData();
            const target = (data.targets || []).find(t => t.id === id) || (data.targetsCompleted || []).find(t => t.id === id);
            if (!target) return null;
            if (fields.title !== undefined) target.title = fields.title;
            if (fields.notes !== undefined) target.notes = fields.notes;
            writeData(data);
            return target;
        },
        async completeTarget(id) {
            const data = readData();
            if (!data.targets) data.targets = [];
            if (!data.targetsCompleted) data.targetsCompleted = [];
            const idx = data.targets.findIndex(t => t.id === id);
            if (idx === -1) return null;
            const [target] = data.targets.splice(idx, 1);
            target.completedAt = new Date().toISOString();
            data.targetsCompleted.unshift(target);
            writeData(data);
            return target;
        },
        async uncompleteTarget(id) {
            const data = readData();
            if (!data.targets) data.targets = [];
            if (!data.targetsCompleted) data.targetsCompleted = [];
            const idx = data.targetsCompleted.findIndex(t => t.id === id);
            if (idx === -1) return null;
            const [target] = data.targetsCompleted.splice(idx, 1);
            delete target.completedAt;
            data.targets.unshift(target);
            writeData(data);
            return target;
        },
        async deleteTarget(id) {
            const data = readData();
            let idx = (data.targets || []).findIndex(t => t.id === id);
            if (idx !== -1) { data.targets.splice(idx, 1); writeData(data); return true; }
            idx = (data.targetsCompleted || []).findIndex(t => t.id === id);
            if (idx !== -1) { data.targetsCompleted.splice(idx, 1); writeData(data); return true; }
            return false;
        },
        async getTasksForTarget(targetNumber) {
            const data = readData();
            const active = (data.tasks || []).filter(t => t.targetNumber === targetNumber);
            const completed = (data.completed || []).filter(t => t.targetNumber === targetNumber);
            return { active, completed };
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
    const { title, notes, targetNumber } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    try {
        const task = await db.create(Date.now().toString(), title, notes || "", targetNumber || null);
        res.status(201).json(task);
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.patch("/api/tasks/:id", async (req, res) => {
    const { title, notes, targetNumber } = req.body;
    try {
        const task = await db.update(req.params.id, { title, notes, targetNumber });
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
// Targets Routes
// ============================================================

app.get("/api/targets", async (req, res) => {
    try { res.json(await db.getAllTargets()); }
    catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.post("/api/targets", async (req, res) => {
    const { title, notes } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    try {
        const target = await db.createTarget(Date.now().toString(), title, notes || "");
        res.status(201).json(target);
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.patch("/api/targets/:id", async (req, res) => {
    const { title, notes } = req.body;
    try {
        const target = await db.updateTarget(req.params.id, { title, notes });
        if (!target) return res.status(404).json({ error: "target not found" });
        res.json(target);
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.post("/api/targets/:id/complete", async (req, res) => {
    try {
        const target = await db.completeTarget(req.params.id);
        if (!target) return res.status(404).json({ error: "target not found" });
        res.json(target);
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.post("/api/targets/:id/uncomplete", async (req, res) => {
    try {
        const target = await db.uncompleteTarget(req.params.id);
        if (!target) return res.status(404).json({ error: "target not found" });
        res.json(target);
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.delete("/api/targets/:id", async (req, res) => {
    try {
        const deleted = await db.deleteTarget(req.params.id);
        if (!deleted) return res.status(404).json({ error: "target not found" });
        res.status(204).send();
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.get("/api/targets/:targetNumber/tasks", async (req, res) => {
    try {
        const result = await db.getTasksForTarget(parseInt(req.params.targetNumber));
        res.json(result);
    } catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

// ============================================================
// Start
// ============================================================
db.init().then(() => {
    app.listen(PORT, () => console.log(`To-Do server running on http://localhost:${PORT}`));
}).catch(err => { console.error("Failed to initialize database:", err); process.exit(1); });
