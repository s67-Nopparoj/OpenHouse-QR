// src/utils/sync.ts
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config"; // ✅ ใช้ config เดิม

// ✅ ตั้งค่าเชื่อมต่อ Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * ✅ Sync เฉพาะข้อมูล Users และ Check-ins ขึ้น Cloud
 * - Users ที่สมัครออฟไลน์ (offline_users)
 * - Check-ins ที่เกิดขึ้นออฟไลน์ (offline_checkins)
 * 📌 Booths จะไม่ถูก sync เพื่อป้องกันข้อมูลทับซ้อน
 */
export async function syncOfflineData() {
  if (!navigator.onLine) {
    alert("⚠️ กรุณาเชื่อมต่ออินเทอร์เน็ตก่อนซิงค์");
    return;
  }

  // ✅ ดึงข้อมูลจาก localStorage
  const localUsers = JSON.parse(localStorage.getItem("offline_users") || "[]");
  const localCheckins = JSON.parse(localStorage.getItem("pending_checkins") || "[]"); // ← ใช้ pending_checkins แทน เพื่อ sync เฉพาะที่ยังไม่ขึ้น cloud

  let syncedUsers = 0;
  let syncedCheckins = 0;
  const errors: string[] = [];

  try {
    // --------------------------------------------------
    // 👤 Sync Users
    // --------------------------------------------------
    if (localUsers.length > 0) {
      for (const user of localUsers) {
        try {
          const { error } = await supabase
            .from("users")
            .upsert(user, { onConflict: "uuid" });
          if (error) errors.push(`User: ${user.nickname} → ${error.message}`);
          else syncedUsers++;
        } catch (e) {
          errors.push(`User: ${user.nickname} → unexpected error`);
        }
      }
    }

    // --------------------------------------------------
    // 🕓 Sync Check-ins (เฉพาะที่รอ sync)
    // --------------------------------------------------
    if (localCheckins.length > 0) {
      for (const item of localCheckins) {
        try {
          const { error } = await supabase
            .from("checkins")
            .insert([item]);
          if (error)
            errors.push(
              `Check-in: ${item.uuid} @ ${item.boothId} → ${error.message}`
            );
          else syncedCheckins++;
        } catch (e) {
          errors.push(`Check-in: ${item.uuid} → unexpected error`);
        }
      }

      // ✅ ล้าง pending_checkins เมื่อ sync เสร็จ
      localStorage.removeItem("pending_checkins");
    }

    // --------------------------------------------------
    // 📦 เก็บ offline ข้อมูลไว้ต่อ (ไม่ลบ)
    // --------------------------------------------------
    localStorage.setItem("offline_users", JSON.stringify(localUsers));

    // --------------------------------------------------
    // ✅ แจ้งผลสรุป
    // --------------------------------------------------
    if (errors.length > 0) {
      alert(
        `⚠️ ซิงค์บางส่วนสำเร็จ\n\n👤 Users: ${syncedUsers}\n🕓 Check-ins: ${syncedCheckins}\n\n❌ Errors:\n${errors.join(
          "\n"
        )}`
      );
    } else {
      alert(
        `✅ ซิงค์สำเร็จ!\n👤 Users: ${syncedUsers}\n🕓 Check-ins: ${syncedCheckins}`
      );
    }

    // แจ้งหน้า AdminPanel ให้รีโหลดข้อมูลใหม่
    window.dispatchEvent(new Event("sync-finished"));
  } catch (err) {
    console.error("❌ Sync error:", err);
    alert("🚫 เกิดข้อผิดพลาดระหว่างการ Sync");
  }
}
