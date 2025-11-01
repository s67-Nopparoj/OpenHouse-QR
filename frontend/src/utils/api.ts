// src/utils/api.ts

// ✅ โหมด local → ใช้ localhost:4000
// ✅ โหมด production → ใช้ path /api (ผ่าน nginx proxy)
const LOCAL_API = "http://localhost:4000";
const CLOUD_API = "/api";

export const API_BASE =
  window.location.hostname.includes("localhost") ? LOCAL_API : CLOUD_API;

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${API_BASE}${endpoint}`;
  const online = window.navigator.onLine;

  try {
    if (online) {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
      });
      const data = await res.json();
      localStorage.setItem(`cache:${endpoint}`, JSON.stringify(data));
      return data;
    } else {
      const cached = localStorage.getItem(`cache:${endpoint}`);
      if (cached) {
        console.warn("📦 Offline mode: ใช้ข้อมูล cache:", endpoint);
        return JSON.parse(cached);
      } else {
        return { success: false, message: "⚠ ไม่มีข้อมูลออฟไลน์ใน cache" };
      }
    }
  } catch (err: any) {
    console.error("❌ apiFetch error:", err);
    return { success: false, error: err.message };
  }
}
