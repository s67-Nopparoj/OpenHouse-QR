// src/utils/config.ts

/**
 * ✅ ค่าการเชื่อมต่อ Supabase (อ่านจาก .env)
 * หมายเหตุ: สำหรับโหมดใหม่ — ระบบจะทำงานแบบ Offline Manual Sync เสมอ
 * และเชื่อมต่อ Supabase เฉพาะตอนที่ผู้ใช้กดปุ่ม "Sync ตอนนี้"
 */

// ✅ อ่านค่าจากไฟล์ .env (ต้องตั้งค่าไว้ใน .env ของ frontend)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string;

/**
 * ✅ Helper สำหรับตรวจสถานะอินเทอร์เน็ต
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * ✅ Helper สำหรับโหลด / เซฟข้อมูลใน localStorage
 * ใช้สำหรับเก็บข้อมูลออฟไลน์ เช่น offline_users, offline_booths, pending_booths
 */
export const LocalStore = {
  get<T = any>(key: string, fallback: T = [] as any): T {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: any) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key: string) {
    localStorage.removeItem(key);
  },
};
