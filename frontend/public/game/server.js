// server.js — Scoreboard (Supabase only, High Score mode)
const path = require("path");
const fs = require("fs");
const express = require("express");
const compression = require("compression");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// ---------- CONFIG ----------
const PORT = Number(process.env.PORT || 8000);
const STATIC_ROOT = path.join(__dirname, "public");
const TOP_RETURN = 50;

// ---------- SUPABASE ----------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

console.log("🌐 Connected to Supabase:", SUPABASE_URL);

// ---------- EXPRESS APP ----------
const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use(express.json({ limit: "256kb" }));

// ---------- CORS ----------
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// ---------- UTIL ----------
function sanitizeName(name) {
  try {
    name = String(name || "").trim();
    if (name.length > 16) name = name.slice(0, 16);
    let safe = "";
    for (const ch of name) {
      const code = ch.codePointAt(0);
      if ((code >= 32 && code <= 126) || code >= 0x0e00) safe += ch; // ASCII + ไทย
    }
    return safe || "anon";
  } catch {
    return "anon";
  }
}

// ---------- API ----------

// ✅ POST /api/score — บันทึกคะแนน (เฉพาะคะแนนสูงสุด)
app.post("/api/score", async (req, res) => {
  try {
    const uuid = String(req.body?.uuid || "");
    const nickname = sanitizeName(req.body?.name); // จาก client ส่ง name -> ใช้เก็บเป็น nickname
    const score = Number.parseInt(req.body?.score, 10);
    const ts = Math.floor(Date.now() / 1000);

    if (!Number.isFinite(score))
      return res.status(400).json({ ok: false, error: "invalid score" });

    // ---- Supabase: ตรวจคะแนนเก่า ----
    const { data: existing, error: findErr } = await supabase
      .from("users")
      .select("score")
      .eq("uuid", uuid)
      .maybeSingle();

    if (findErr) console.warn("⚠️ Supabase find error:", findErr.message);

    const oldScore = existing?.score ?? 0;

    // ---- ถ้าคะแนนใหม่มากกว่าเดิม ค่อยอัปเดต ----
    if (!existing) {
      await supabase.from("users").insert([{ uuid, nickname, score, ts }]);
      console.log(`☁️ Added new user ${uuid}: ${score}`);
    } else if (score > oldScore) {
      await supabase.from("users").update({ score, ts }).eq("uuid", uuid);
      console.log(`☁️ Updated high score for ${uuid}: ${oldScore} → ${score}`);
    } else {
      console.log(`ℹ️ Skipped update (${score} ≤ ${oldScore})`);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("❌ POST /api/score error:", e);
    res.status(500).json({ ok: false });
  }
});

// ✅ GET /api/scores — ดึงคะแนนจาก Supabase (เรียลไทม์)
app.get("/api/scores", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("nickname, uuid, score, ts")
      .not("score", "is", null)
      .order("score", { ascending: false })
      .limit(TOP_RETURN);

    if (error) throw error;

    const formatted = data.map((r) => ({
      name: r.uuid ? `${r.nickname} (${r.uuid})` : r.nickname,
      score: r.score,
      ts: r.ts,
    }));

    res.json(formatted);
  } catch (e) {
    console.error("❌ GET /api/scores error:", e);
    res.status(500).json([]);
  }
});

// ✅ Ping check
app.get("/api/ping", (req, res) => {
  res.json({ pong: true, time: new Date().toISOString() });
});

// ---------- STATIC ----------
app.use(
  express.static(STATIC_ROOT, {
    etag: true,
    maxAge: "7d",
    extensions: ["html"],
  })
);

// ---------- FALLBACK ----------
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  const fp = path.join(STATIC_ROOT, "index.html");
  if (fs.existsSync(fp)) return res.sendFile(fp);
  next();
});

// ---------- START ----------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving static from: ${STATIC_ROOT}`);
});
