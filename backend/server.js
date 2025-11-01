import express from "express";
import Database from "better-sqlite3";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = 4000;

// --------------------------------------------------
// ✅ MODE STORAGE (จำโหมดถาวรในไฟล์)
// --------------------------------------------------
const MODE_FILE = path.join(__dirname, "mode.json");
function readMode() {
  try {
    const raw = fs.readFileSync(MODE_FILE, "utf8");
    const { mode } = JSON.parse(raw);
    return ["local", "cloud"].includes(mode) ? mode : "local";
  } catch {
    return process.env.MODE === "cloud" ? "cloud" : "local";
  }
}
function writeMode(mode) {
  fs.writeFileSync(MODE_FILE, JSON.stringify({ mode }, null, 2));
}

// --------------------------------------------------
// ✅ GLOBALS
// --------------------------------------------------
let mode = readMode();           // "local" | "cloud"
let db = null;                   // SQLite handle
let supabase = null;             // Supabase client

console.log("✅ ENV loaded:");
console.log("MODE(initial) =", mode);
console.log("URL =", process.env.SUPABASE_URL);
console.log("KEY =", process.env.SUPABASE_KEY ? "Loaded ✅" : "Missing ❌");

// --------------------------------------------------
// ✅ Middleware
// --------------------------------------------------
app.use(cors());
app.use(express.json());

// --------------------------------------------------
// ✅ INIT LOCAL (SQLite)
// --------------------------------------------------
function initSQLite() {
  if (db) return;
  const dbPath = path.join(__dirname, "openhouse.db");
  console.log("📂 Using local DB:", dbPath);
  db = new Database(dbPath);

  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      nickname TEXT DEFAULT '',
      school TEXT DEFAULT '',
      createdAt INTEGER
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS booths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      image TEXT,
      description TEXT,
      location TEXT,
      attendees INTEGER DEFAULT 0
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT,
      boothId INTEGER,
      timestamp INTEGER
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS event_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eventName TEXT,
      subtitle TEXT,
      dateText TEXT,
      locationText TEXT,
      logoUrl TEXT,
      bannerUrls TEXT
    )
  `).run();

  console.log("✅ Local database ready.");
}

// --------------------------------------------------
// ✅ INIT CLOUD (Supabase)
// --------------------------------------------------
function initSupabase() {
  if (supabase) return;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    console.error("❌ Missing Supabase credentials");
    return;
  }
  supabase = createClient(url, key);
  console.log("☁️ Connected to Supabase:", url);
}

// เริ่มระบบตามโหมดปัจจุบัน
if (mode === "local") initSQLite();
if (mode === "cloud") initSupabase();

// --------------------------------------------------
// ✅ HELPERS: เลือกแหล่งข้อมูลตามโหมด
// --------------------------------------------------
const isCloud = () => mode === "cloud";

// USERS
async function selectUsers() {
  if (isCloud()) {
    const { data, error } = await supabase.from("users").select("*").order("createdAt", { ascending: false });
    if (error) throw new Error(error.message);
    // เติม visitedBooths (นับจาก checkins ใน cloud)
    const { data: chk, error: e2 } = await supabase
      .from("checkins").select("uuid", { count: "exact", head: false });
    if (e2) throw new Error(e2.message);
    const countMap = {};
    (chk || []).forEach(c => {
      countMap[c.uuid] = (countMap[c.uuid] || 0) + 1;
    });
    return (data || []).map(u => ({ ...u, visitedBooths: countMap[u.uuid] || 0 }));
  } else {
    return db.prepare(`
      SELECT u.*, (SELECT COUNT(*) FROM checkins c WHERE c.uuid = u.uuid) AS visitedBooths
      FROM users u ORDER BY createdAt DESC
    `).all();
  }
}

async function getUserByUUID(uuid) {
  // 🔒 เพิ่ม safety log และ guard
  if (!["local", "cloud"].includes(mode)) {
    console.warn("⚠️ Unknown mode detected. Defaulting to LOCAL.");
    mode = "local";
  }

  if (mode === "local") {
    console.log("🗄️ [LOCAL MODE] Searching user in SQLite:", uuid);
    return db.prepare("SELECT * FROM users WHERE uuid = ?").get(uuid);
  }

  if (mode === "cloud") {
    console.log("☁️ [CLOUD MODE] Fetching user from Supabase:", uuid);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("uuid", uuid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  }
}


async function upsertUser({ uuid, nickname = "", school = "", createdAt }) {
  if (isCloud()) {
    const payload = { uuid, nickname, school, createdAt: createdAt || Date.now() };
    const { error } = await supabase.from("users").upsert(payload, { onConflict: "uuid" });
    if (error) throw new Error(error.message);
  } else {
    const exists = db.prepare("SELECT 1 FROM users WHERE uuid = ?").get(uuid);
    if (exists) {
      db.prepare("UPDATE users SET nickname = ?, school = ? WHERE uuid = ?")
        .run(nickname, school, uuid);
    } else {
      db.prepare("INSERT INTO users (uuid, nickname, school, createdAt) VALUES (?, ?, ?, ?)")
        .run(uuid, nickname, school, createdAt || Date.now());
    }
  }
}

async function updateUserById(id, { nickname, school }) {
  if (isCloud()) {
    // ใน cloud ไม่มี id auto ในตารางเดิมของคุณ -> หา uuid จาก id ใน local ไม่ได้
    // แนะนำให้ฝั่ง AdminPanel ส่ง uuid มาด้วยจะดีที่สุด
    // แต่เพื่อความเข้ากัน: ไม่รองรับแก้ด้วย id ใน cloud; ให้ใช้ uuid-register ใน cloud แทน
    throw new Error("Update by id is not supported in CLOUD mode. Use /uuid-register with uuid.");
  } else {
    db.prepare("UPDATE users SET nickname = ?, school = ? WHERE id = ?").run(nickname, school, id);
  }
}

async function deleteUserById(id) {
  if (isCloud()) {
    // ไม่รองรับลบด้วย id ใน cloud (ไม่มีคอลัมน์ id แบบเดียวกับ local)
    throw new Error("Delete by id is not supported in CLOUD mode. Use DELETE by uuid endpoint if needed.");
  } else {
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  }
}

// BOOTHS
async function selectBooths() {
  if (isCloud()) {
    const { data, error } = await supabase.from("booths").select("*").order("id", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  } else {
    return db.prepare("SELECT * FROM booths ORDER BY id DESC").all();
  }
}
async function insertBooth({ title, image, description, location }) {
  if (isCloud()) {
    const { data, error } = await supabase.from("booths").insert({ title, image, description, location, attendees: 0 }).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  } else {
    const info = db.prepare(
      "INSERT INTO booths (title, image, description, location, attendees) VALUES (?, ?, ?, ?, 0)"
    ).run(title, image, description, location);
    return db.prepare("SELECT * FROM booths WHERE id = ?").get(info.lastInsertRowid);
  }
}
async function updateBooth(id, { title, image, description, location }) {
  if (isCloud()) {
    const { data, error } = await supabase.from("booths")
      .update({ title, image, description, location })
      .eq("id", Number(id)).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  } else {
    db.prepare(
      "UPDATE booths SET title = ?, image = ?, description = ?, location = ? WHERE id = ?"
    ).run(title, image, description, location, id);
    return db.prepare("SELECT * FROM booths WHERE id = ?").get(id);
  }
}
async function deleteBooth(id) {
  if (isCloud()) {
    const { error } = await supabase.from("booths").delete().eq("id", Number(id));
    if (error) throw new Error(error.message);
  } else {
    db.prepare("DELETE FROM booths WHERE id = ?").run(id);
  }
}

// CHECKINS
async function selectCheckinsWithJoin() {
  if (isCloud()) {
    const { data: cks, error: e1 } = await supabase.from("checkins").select("*").order("timestamp", { ascending: false });
    if (e1) throw new Error(e1.message);
    const { data: users, error: e2 } = await supabase.from("users").select("uuid,nickname");
    if (e2) throw new Error(e2.message);
    const { data: booths, error: e3 } = await supabase.from("booths").select("id,title");
    if (e3) throw new Error(e3.message);

    const userMap = Object.fromEntries((users || []).map(u => [u.uuid, u.nickname]));
    const boothMap = Object.fromEntries((booths || []).map(b => [b.id, b.title]));
    return (cks || []).map(c => ({
      ...c,
      nickname: userMap[c.uuid] || "",
      boothTitle: boothMap[c.boothId] || ""
    }));
  } else {
    return db.prepare(`
      SELECT c.*, u.nickname, b.title AS boothTitle
      FROM checkins c
      LEFT JOIN users u ON c.uuid = u.uuid
      LEFT JOIN booths b ON c.boothId = b.id
      ORDER BY c.timestamp DESC
    `).all();
  }
}
async function insertCheckin({ uuid, boothId }) {
  if (isCloud()) {
    // ป้องกันเช็กอินซ้ำ
    const { data: exists, error: e0 } = await supabase
      .from("checkins").select("*").eq("uuid", uuid).eq("boothId", Number(boothId)).maybeSingle();
    if (e0) throw new Error(e0.message);
    if (exists) return { duplicated: true };

    const { error } = await supabase.from("checkins").insert({ uuid, boothId: Number(boothId), timestamp: Date.now() });
    if (error) throw new Error(error.message);

    // update attendees
    await supabase.rpc("increment_attendees", { booth_id_input: Number(boothId) })
      .catch(async () => {
        // Fallback: update ด้วย update ปกติ
        const { data: b, error: e1 } = await supabase.from("booths").select("attendees").eq("id", Number(boothId)).maybeSingle();
        if (!e1 && b) {
          await supabase.from("booths").update({ attendees: (b.attendees || 0) + 1 }).eq("id", Number(boothId));
        }
      });
    return { success: true };
  } else {
    const exists = db.prepare("SELECT 1 FROM checkins WHERE uuid = ? AND boothId = ?").get(uuid, boothId);
    if (exists) return { duplicated: true };
    db.prepare("INSERT INTO checkins (uuid, boothId, timestamp) VALUES (?, ?, ?)").run(uuid, boothId, Date.now());
    db.prepare("UPDATE booths SET attendees = attendees + 1 WHERE id = ?").run(boothId);
    return { success: true };
  }
}
async function deleteAllCheckins() {
  if (isCloud()) {
    const { error: e1 } = await supabase.from("checkins").delete().neq("uuid", "__never__");
    if (e1) throw new Error(e1.message);
    // รีเซ็ต attendees ทั้งหมด
    const { data: booths, error: e2 } = await supabase.from("booths").select("id");
    if (e2) throw new Error(e2.message);
    for (const b of booths || []) {
      await supabase.from("booths").update({ attendees: 0 }).eq("id", b.id);
    }
  } else {
    db.prepare("DELETE FROM checkins").run();
    db.prepare("UPDATE booths SET attendees = 0").run();
  }
}
async function selectUserCheckins(uuid) {
  if (isCloud()) {
    const { data: c, error: e1 } = await supabase.from("checkins").select("*").eq("uuid", uuid).order("timestamp", { ascending: false });
    if (e1) throw new Error(e1.message);
    const { data: booths, error: e2 } = await supabase.from("booths").select("id,title");
    if (e2) throw new Error(e2.message);
    const boothMap = Object.fromEntries((booths || []).map(b => [b.id, b.title]));
    return (c || []).map(x => ({ id: x.id, boothId: x.boothId, timestamp: x.timestamp, boothTitle: boothMap[x.boothId] || "" }));
  } else {
    return db.prepare(`
      SELECT c.id, c.boothId, c.timestamp, b.title AS boothTitle
      FROM checkins c
      LEFT JOIN booths b ON b.id = c.boothId
      WHERE c.uuid = ?
      ORDER BY c.timestamp DESC
    `).all(uuid);
  }
}
async function deleteCheckinById(id) {
  if (isCloud()) {
    // หา checkin เพื่อรู้ boothId
    const { data: rec, error: e0 } = await supabase.from("checkins").select("*").eq("id", Number(id)).maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!rec) return;
    const boothId = rec.boothId;
    const { error: e1 } = await supabase.from("checkins").delete().eq("id", Number(id));
    if (e1) throw new Error(e1.message);
    // ลด attendees
    const { data: b, error: e2 } = await supabase.from("booths").select("attendees").eq("id", Number(boothId)).maybeSingle();
    if (!e2 && b) {
      const newVal = Math.max(0, (b.attendees || 0) - 1);
      await supabase.from("booths").update({ attendees: newVal }).eq("id", Number(boothId));
    }
  } else {
    const checkin = db.prepare("SELECT boothId FROM checkins WHERE id = ?").get(id);
    if (!checkin) return;
    db.prepare("DELETE FROM checkins WHERE id = ?").run(id);
    db.prepare("UPDATE booths SET attendees = attendees - 1 WHERE id = ? AND attendees > 0").run(checkin.boothId);
  }
}

// --------------------------------------------------
// ✅ MODE ENDPOINTS
// --------------------------------------------------
app.get("/mode", (req, res) => res.json({ mode }));

app.post("/switch-mode", async (req, res) => {
  try {
    const { newMode } = req.body;
    if (!["local", "cloud"].includes(newMode)) {
      return res.status(400).json({ success: false, error: "Invalid mode" });
    }

    // ปิด db เดิมถ้ามี (ป้องกันค้าง handle)
    if (mode !== newMode) {
      if (newMode === "local") {
        if (db) { try { db.close(); } catch {} db = null; }
        initSQLite();
      }
      if (newMode === "cloud") {
        initSupabase();
      }
      mode = newMode;
      writeMode(mode);
      console.log(`🔁 Switched to ${mode.toUpperCase()} mode.`);
    }

    res.json({ success: true, mode });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// ✅ USERS (UUID SYSTEM)
// --------------------------------------------------
app.post("/uuid-create", async (req, res) => {
  try {
    const { uuid } = req.body;
    if (!uuid)
      return res.status(400).json({ success: false, error: "Missing uuid" });

    const exists = await getUserByUUID(uuid);
    if (exists) {
      return res.json({ success: true, message: "UUID already exists" });
    }

    // ❌ ห้ามสร้างใหม่
    return res.status(404).json({ success: false, error: "UUID not found in system" });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



app.get("/uuid/:id", async (req, res) => {
  try {
    const row = await getUserByUUID(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: "UUID not found" });
    }
    res.json({
      success: true,
      uuid: row.uuid,
      nickname: row.nickname || "",
      school: row.school || ""
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


app.post("/uuid-register", async (req, res) => {
  try {
    const { uuid, nickname, school } = req.body;
    if (!uuid || !nickname) return res.status(400).json({ success: false, error: "missing data" });

    await upsertUser({ uuid, nickname, school: school || "" });
    const user = await getUserByUUID(uuid);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/users", async (req, res) => {
  try {
    const rows = await selectUsers();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/users/:id", async (req, res) => {
  try {
    await updateUserById(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/users/:id", async (req, res) => {
  try {
    await deleteUserById(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// ✅ BOOTHS CRUD
// --------------------------------------------------
app.get("/booths", async (req, res) => {
  try {
    const booths = await selectBooths();
    res.json(booths);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/booths", async (req, res) => {
  try {
    const booth = await insertBooth(req.body || {});
    res.json({ success: true, booth });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put("/booths/:id", async (req, res) => {
  try {
    const updated = await updateBooth(req.params.id, req.body || {});
    res.json({ success: true, booth: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/booths/:id", async (req, res) => {
  try {
    await deleteBooth(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// ✅ CHECKINS
// --------------------------------------------------
app.get("/checkins", async (req, res) => {
  try {
    const rows = await selectCheckinsWithJoin();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/checkin", async (req, res) => {
  try {
    const { uuid, boothId } = req.body;
    if (!uuid || !boothId) return res.status(400).json({ success: false, error: "missing uuid or boothId" });
    const r = await insertCheckin({ uuid, boothId });
    if (r.duplicated) return res.json({ success: false, error: "เช็คอินแล้ว" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/checkins", async (req, res) => {
  try {
    await deleteAllCheckins();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// ✅ USER CHECKINS (ประวัติรายบุคคล)
// --------------------------------------------------
app.get("/user-checkins/:uuid", async (req, res) => {
  try {
    const rows = await selectUserCheckins(req.params.uuid);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching user checkins:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ ลบเช็คอินรายบุคคล
app.delete("/checkins/:id", async (req, res) => {
  try {
    await deleteCheckinById(req.params.id);
    res.json({ success: true, message: "ลบเช็คอินสำเร็จ" });
  } catch (err) {
    console.error("❌ ลบเช็คอินไม่สำเร็จ:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// ✅ BACKUP & RESTORE (Supabase): users, checkins, booths
// --------------------------------------------------
app.post("/backup", async (req, res) => {
  try {
    initSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    // ดึงจาก LOCAL เสมอเพราะ backup คือส่งขึ้น cloud
    initSQLite();
    const users = db.prepare("SELECT * FROM users").all().map(({ id, ...rest }) => rest);
    const checkins = db.prepare("SELECT * FROM checkins").all().map(({ id, ...rest }) => rest);
    const booths = db.prepare("SELECT * FROM booths").all().map(({ id, ...rest }) => ({ id, ...rest }));

    await supabase.from("users").upsert(users, { onConflict: "uuid" });
    await supabase.from("checkins").upsert(checkins, { onConflict: "uuid,boothId" });
    await supabase.from("booths").upsert(booths, { onConflict: "id" });

    // ✅ Backup event_config (เก็บแค่ 1 record ล่าสุด)
    const eventConfig = db.prepare("SELECT * FROM event_config ORDER BY id DESC LIMIT 1").get();
    if (eventConfig) {
      const payload = {
        id: 1, // ใช้ id คงที่ใน cloud
        eventName: eventConfig.eventName,
        subtitle: eventConfig.subtitle,
        dateText: eventConfig.dateText,
        locationText: eventConfig.locationText,
        logoUrl: eventConfig.logoUrl,
        bannerUrls: eventConfig.bannerUrls,
      };
      await supabase.from("event_config").upsert(payload, { onConflict: "id" });
    }


    res.json({ success: true, message: "✅ Backup completed!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/restore", async (req, res) => {
  try {
    initSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    // 🗄️ ดึงข้อมูลจาก CLOUD → ใส่ LOCAL
    const { data: users, error: e1 } = await supabase.from("users").select("*");
    if (e1) throw new Error(e1.message);
    const { data: checkins, error: e2 } = await supabase.from("checkins").select("*");
    if (e2) throw new Error(e2.message);
    const { data: booths, error: e3 } = await supabase.from("booths").select("*");
    if (e3) throw new Error(e3.message);
    const { data: configs, error: e4 } = await supabase.from("event_config").select("*");
    if (e4) throw new Error(e4.message);

    // 🔧 เตรียม SQLite ใหม่
    initSQLite();
    db.prepare("DELETE FROM users").run();
    db.prepare("DELETE FROM checkins").run();
    db.prepare("DELETE FROM booths").run();
    db.prepare("DELETE FROM event_config").run();

    const insertUser = db.prepare(
      "INSERT INTO users (uuid, nickname, school, createdAt) VALUES (?, ?, ?, ?)"
    );
    const insertCheckin = db.prepare(
      "INSERT INTO checkins (uuid, boothId, timestamp) VALUES (?, ?, ?)"
    );
    const insertBooth = db.prepare(
      "INSERT INTO booths (id, title, image, description, location, attendees) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const insertConfig = db.prepare(
      "INSERT INTO event_config (eventName, subtitle, dateText, locationText, logoUrl, bannerUrls) VALUES (?, ?, ?, ?, ?, ?)"
    );

    db.transaction(() => {
      (users || []).forEach(u =>
        insertUser.run(u.uuid, u.nickname || "", u.school || "", u.createdAt || Date.now())
      );
      (checkins || []).forEach(c =>
        insertCheckin.run(c.uuid, Number(c.boothId), c.timestamp || Date.now())
      );
      (booths || []).forEach(b =>
        insertBooth.run(
          Number(b.id),
          b.title || "",
          b.image || "",
          b.description || "",
          b.location || "",
          Number(b.attendees || 0)
        )
      );

      // ✅ เพิ่มส่วนนี้เพื่อ restore event_config
      if (configs && configs.length > 0) {
        const c = configs[0];
        insertConfig.run(
          c.eventName || "",
          c.subtitle || "",
          c.dateText || "",
          c.locationText || "",
          c.logoUrl || "",
          typeof c.bannerUrls === "string"
            ? c.bannerUrls
            : JSON.stringify(c.bannerUrls || [])
        );
      }
    })();

    res.json({ success: true, message: "✅ Restore completed successfully!" });
  } catch (err) {
    console.error("❌ Restore error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// ✅ EVENT CONFIG & BANNERS  (เก็บ local เหมือนเดิม)
// --------------------------------------------------
app.post("/event-config", (req, res) => {
  let { eventName, subtitle, dateText, locationText, logoUrl, bannerUrls } = req.body;

  try {
    if (typeof bannerUrls === "string") {
      bannerUrls = bannerUrls
        .split("\n")
        .map((url) => url.trim())
        .filter((u) => u.length > 0);
    }
    initSQLite();
    db.prepare("DELETE FROM event_config").run();
    db.prepare(
      `INSERT INTO event_config (eventName, subtitle, dateText, locationText, logoUrl, bannerUrls)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      eventName || "",
      subtitle || "",
      dateText || "",
      locationText || "",
      logoUrl || "",
      JSON.stringify(bannerUrls || [])
    );

    console.log("✅ Event config updated:", eventName);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error saving event config:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/banners", (req, res) => {
  try {
    initSQLite();
    const cfg = db.prepare("SELECT * FROM event_config ORDER BY id DESC LIMIT 1").get();
    if (cfg?.bannerUrls) {
      const banners = JSON.parse(cfg.bannerUrls).map((url, i) => ({
        id: i + 1,
        imageUrl: url,
      }));
      return res.json(banners);
    }
    res.json([
      { id: 1, imageUrl: "https://placehold.co/1200x400?text=Banner+1" },
      { id: 2, imageUrl: "https://placehold.co/1200x400?text=Banner+2" },
    ]);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------
// ✅ LOGIN (รองรับ uuid ที่ดึงตามโหมด)
// --------------------------------------------------
app.post("/login", async (req, res) => {
  const { uuid, username, password } = req.body;
  try {
    console.log(`🔐 Login request received (mode = ${mode})`);

    if (username && password) {
      if (username === "1" && password === "1")
        return res.json({ success: true, role: "admin", user: { username: "adminnay" } });
      else return res.json({ success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }

    if (uuid) {
      const user = await getUserByUUID(uuid);
      if (!user) return res.json({ success: false, error: "ไม่พบ UUID ในระบบ" });
      return res.json({ success: true, role: "user", user });
    }

    res.json({ success: false, error: "ข้อมูลไม่ครบถ้วน" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ✅ ดึงข้อมูล event config
app.get("/event-config", (req, res) => {
  try {
    initSQLite();
    const config = db.prepare("SELECT * FROM event_config ORDER BY id DESC LIMIT 1").get();
    if (!config) return res.json({});
    res.json({
      eventName: config.eventName,
      subtitle: config.subtitle,
      dateText: config.dateText,
      locationText: config.locationText,
      logoUrl: config.logoUrl,
      bannerUrls: config.bannerUrls,
    });
  } catch (err) {
    console.error("❌ Error fetching event config:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/mode-check", (req, res) => {
  res.json({
    mode,
    using: mode === "cloud" ? "Supabase (cloud)" : "SQLite (local)",
    dbConnected: !!db,
    supabaseConnected: !!supabase,
  });
});

// --------------------------------------------------
// ✅ START SERVER
// --------------------------------------------------
app.listen(port, () => console.log(`🚀 Server running at http://localhost:${port}`));
