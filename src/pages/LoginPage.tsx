import React, { useState, useEffect } from "react";

type Props = {
  onLoginSuccess: (role: "admin" | "user", user?: any) => void;
  onBack?: () => void;
};

export default function LoginPage({ onLoginSuccess, onBack }: Props) {
  const [mode, setMode] = useState<"user" | "admin">("user");
  const [uuid, setUuid] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ Event config จาก backend
  const [eventConfig, setEventConfig] = useState({
    eventName: "OpenHouse QR System",
    logoUrl: "https://placehold.co/80x80?text=QR",
  });

  const apiBase = `http://${window.location.hostname}:4000`;

  // ✅ โหลด Event Config
  useEffect(() => {
    const loadEventConfig = async () => {
      try {
        const res = await fetch(`${apiBase}/event-config`);
        const data = await res.json();

        setEventConfig({
          eventName: data.eventName || "OpenHouse QR System",
          logoUrl:
            data.logoUrl || "https://placehold.co/80x80?text=QR",
        });
      } catch {
        console.warn("⚠️ โหลด event-config ไม่ได้ ใช้ค่าเริ่มต้นแทน");
      }
    };
    loadEventConfig();
  }, []);

  // ✅ ตรวจ role เก่าที่เคย login ไว้
  useEffect(() => {
    const role = localStorage.getItem("role");
    const userData = localStorage.getItem("user");
    if (role) {
      const user = userData ? JSON.parse(userData) : null;
      onLoginSuccess(role as "admin" | "user", user);
    }
  }, []);

  const handleLogin = async () => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const body = mode === "admin" ? { username, password } : { uuid };
      const res = await fetch(`${apiBase}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setLoading(false);

      if (!data.success) {
        setError(data.error || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        return;
      }

      // ✅ บันทึกข้อมูล
      localStorage.setItem("role", data.role);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
      if (data.user?.uuid) localStorage.setItem("user_uuid", data.user.uuid);

      onLoginSuccess(data.role, data.user);
    } catch {
      setLoading(false);
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md bg-white border-2 border-blue-500/60 shadow-xl rounded-2xl p-10 pt-14 relative overflow-visible">
        {/* โลโก้ */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white rounded-full border-2 border-blue-500 shadow-lg p-3">
          <img
            src={eventConfig.logoUrl}
            alt="Event Logo"
            className="w-20 h-20 object-contain"
          />
        </div>

        <div className="text-center mt-8 mb-6">
          <h1 className="text-2xl font-bold text-blue-700">
            {eventConfig.eventName}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            เข้าสู่ระบบเพื่อใช้งานระบบเช็กอิน
          </p>
        </div>

        {/* ฟอร์มล็อกอิน */}
        {mode === "user" ? (
          <>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              รหัสผู้ใช้ (UUID)
            </label>
            <input
              type="text"
              value={uuid}
              onChange={(e) => setUuid(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="เช่น 026ee99d"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
            />
          </>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              ชื่อผู้ใช้ (Admin)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="เช่น adminnay"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-3 text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
            />
            <label className="block text-sm font-medium text-slate-700 mb-1">
              รหัสผ่าน
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="••••••••"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none transition"
            />
          </>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-50 text-red-600 text-sm text-center px-3 py-2 rounded-md border border-red-200 shadow-sm">
            {error}
          </div>
        )}

        {/* ปุ่มเข้าสู่ระบบ */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className={`w-full mt-6 py-2.5 rounded-lg font-semibold shadow-md transition-all ${
            loading
              ? "bg-slate-300 text-slate-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 active:scale-[.98]"
          }`}
        >
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>

        {/* ปุ่มเปลี่ยนโหมด */}
        <div className="flex justify-between items-center mt-5 text-sm text-slate-500">
          <button
            onClick={() => setMode(mode === "user" ? "admin" : "user")}
            className="hover:text-blue-600 font-medium transition"
          >
            {mode === "user"
              ? "เข้าสู่ระบบผู้ดูแล →"
              : "← กลับสู่โหมดผู้ใช้"}
          </button>

          {onBack && (
            <button
              onClick={onBack}
              className="hover:text-blue-600 font-medium transition"
            >
              กลับหน้าแรก
            </button>
          )}
        </div>

        <p className="text-xs text-center text-slate-400 mt-6">
          หากไม่มีรหัส UUID กรุณาติดต่อเจ้าหน้าที่ที่หน้าภาควิชาวิศวกรรมไฟฟ้าและคอมพิวเตอร์
        </p>
      </div>
    </div>
  );
}
