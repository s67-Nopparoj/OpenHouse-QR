// api.js — Score API + Realtime Leaderboard
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const API_BASE = `${window.location.origin.replace(':5173', ':8000')}`;

// ---------- Supabase Config ----------
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co"; // ✅ เปลี่ยนเป็นของคุณ
const SUPABASE_KEY = "YOUR_ANON_KEY"; // ✅ ใช้ anon key (ไม่ใช่ service role)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- ส่งคะแนนไป backend ----------
export async function sendScore(name, score, uuid = "") {
  try {
    const res = await fetch(`${API_BASE}/api/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score, uuid }),
    });

    if (!res.ok) {
      console.warn("⚠️ เซิร์ฟเวอร์ตอบกลับไม่สำเร็จ:", await res.text());
      return false;
    }

    console.log(`✅ ส่งคะแนนสำเร็จ: ${name} = ${score}`);
    return true;
  } catch (e) {
    console.warn("❌ ส่งคะแนนไม่สำเร็จ:", e);
    return false;
  }
}

// ---------- โหลดตารางคะแนน ----------
export async function loadScores(render) {
  try {
    const res = await fetch(`${API_BASE}/api/scores`);
    const data = await res.json();

    const rows = Array.isArray(data) ? data : [];
    render(rows.sort((a, b) => b.score - a.score));

    console.log("📊 Loaded scores:", rows.length);
  } catch (e) {
    console.warn("❌ โหลดคะแนนไม่สำเร็จ:", e);
    render([]);
  }
}

// ---------- Real-time Updates ----------
export function subscribeRealtime(render) {
  try {
    const channel = supabase
      .channel("realtime-scores")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
        },
        async () => {
          console.log("🔄 Realtime update detected!");
          await loadScores(render);
        }
      )
      .subscribe();
    console.log("👂 Listening for realtime score updates...");
    return channel;
  } catch (err) {
    console.error("Realtime setup failed:", err);
  }
}

// ---------- Escape HTML ----------
export function escapeHtml(s) {
  return (s || "").replace(/[&<>\"']/g, (c) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c])
  );
}

// ---------- Render Scoreboard ----------
export function renderScores(rows, boardList, boardEmpty) {
  if (!rows.length) {
    boardList.innerHTML = "";
    if (boardEmpty) boardEmpty.style.display = "";
    return;
  }
  if (boardEmpty) boardEmpty.style.display = "none";

  boardList.innerHTML = rows
    .map(
      (r, i) => `
        <li>
          <b>#${i + 1} ${escapeHtml(r.name)}</b> — ${Number(r.score || 0)} pts
          <small>${new Date((r.ts || 0) * 1000).toLocaleString()}</small>
        </li>`
    )
    .join("");
}
