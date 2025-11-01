// src/App.tsx
import React, { useEffect, useState } from "react";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import UserHomePage from "./pages/UserHomePage";
import AdminPanel from "./pages/AdminPanel";
import QrScanPage from "./pages/QrScanPage";
import DashboardPage from "./pages/DashboardPage";

type Route = "home" | "login" | "userhome" | "admin" | "scan" | "dashboard";

export default function App() {
  const [route, setRoute] = useState<Route>("home");
  const [session, setSession] = useState<any>(null);
  const [uuid, setUuid] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [initialized, setInitialized] = useState(false);

  const go = (r: Route) => {
    setRoute(r);
    localStorage.setItem("lastRoute", r); // ✅ บันทึกเส้นทางล่าสุดทุกครั้งที่เปลี่ยนหน้า
  };

  // ✅ โหลด session หรือเปิดผ่าน /uuid/xxxx
  useEffect(() => {
    const path = window.location.pathname;

    // 📌 ถ้าเปิดผ่าน QR → เข้าหน้า userhome โดยตรง
    if (path.startsWith("/uuid/")) {
      const id = path.split("/").pop();
      setUuid(id || null);
      setRoute("userhome");
      setInitialized(true);
      return;
    }

    // 📌 โหลดข้อมูลที่เคยล็อกอินไว้
    const savedRole = localStorage.getItem("role");
    const savedUser = localStorage.getItem("user");
    const lastRoute = localStorage.getItem("lastRoute");

    if (savedRole) {
      const user = savedUser ? JSON.parse(savedUser) : null;
      setSession(user);

      // 🔁 ถ้ามีหน้าเดิมให้กลับไปที่หน้านั้นเลย
      if (lastRoute) {
        setRoute(lastRoute as Route);
      } else if (savedRole === "admin") {
        setRoute("admin");
      } else {
        setRoute("userhome");
      }
    } else {
      setRoute("home");
    }

    setInitialized(true);
  }, []);

  // ✅ เก็บ session ใหม่ทุกครั้ง
  useEffect(() => {
    if (session) localStorage.setItem("user", JSON.stringify(session));
    else localStorage.removeItem("user");
  }, [session]);

  // ✅ จัดการสถานะออนไลน์ / ออฟไลน์
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ✅ ออกจากระบบ
  const handleLogout = () => {
    setSession(null);
    setUuid(null);
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    localStorage.removeItem("lastRoute");
    setRoute("home");
    window.history.replaceState({}, "", "/");
  };

  // ✅ Routing หลัก
  if (!initialized) return null;

  // -------------------------
  // 🔹 หน้า Home (Landing)
  // -------------------------
  if (route === "home") {
    return (
      <div>
        {!online && (
          <div className="bg-rose-600 text-white text-center text-sm py-1">
            ⚠️ ขณะนี้อยู่ในโหมดออฟไลน์ (Offline Mode)
          </div>
        )}
        <HomePage onLogin={() => go("login")} />
      </div>
    );
  }

  // -------------------------
  // 🔹 หน้า Login
  // -------------------------
  if (route === "login") {
    return (
      <LoginPage
        onBack={() => go("home")}
        onLoginSuccess={(role, user) => {
          localStorage.setItem("role", role);
          if (user) localStorage.setItem("user", JSON.stringify(user));
          setSession(user);
          if (role === "admin") go("admin");
          else go("userhome");
        }}
      />
    );
  }

  // -------------------------
  // 🔹 หน้า UserHome
  // -------------------------
  if (route === "userhome") {
    return (
      <UserHomePage
        uuid={uuid || session?.uuid || ""}
        nickname={session?.nickname || ""}
        school={session?.school || ""}
        onLogout={handleLogout}
      />
    );
  }

  // -------------------------
  // 🔹 หน้า Admin
  // -------------------------
  if (route === "admin") {
    return (
      <AdminPanel
        onBack={handleLogout}
        onScan={() => go("scan")}
        onDashboard={() => go("dashboard")} // ✅ เพิ่มตรงนี้
      />
    );
  }

  // -------------------------
  // 🔹 หน้า Scan
  // -------------------------
  if (route === "scan") {
    return <QrScanPage onBack={() => go("admin")} />;
  }

  // -------------------------
  // 🔹 หน้า Dashboard
  // -------------------------
  if (route === "dashboard") {
    return <DashboardPage onBack={() => go("admin")} />;
  }

  return null;
}
