import React, { useEffect, useState } from "react";
import MemberTable from "../components/MemberTable";

type Booth = {
  id: number;
  title: string;
  image: string;
  description?: string;
  location?: string;
  attendees: number;
};

type Member = {
  id: number;
  nickname: string;
  school: string;
  pin?: string;
  qrCode?: string;
};

type EventConfig = {
  eventName: string;
  subtitle: string;
  dateText: string;
  locationText: string;
  logoUrl: string;
  bannerUrls: string[];
};

export default function AdminPanel({
  onBack,
  onScan,
  onDashboard,
}: {
  onBack: () => void;
  onScan: () => void;
  onDashboard: () => void;
}) {
  const [booths, setBooths] = useState<Booth[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [editingBooth, setEditingBooth] = useState<Booth | null>(null);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [activeTab, setActiveTab] = useState<"booths" | "members" | "config">(
    "booths"
  );
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"local" | "cloud">("local");
  const [switching, setSwitching] = useState(false);

  // ✅ Event Config
  const [eventConfig, setEventConfig] = useState<EventConfig>({
    eventName: "",
    subtitle: "",
    dateText: "",
    locationText: "",
    logoUrl: "",
    bannerUrls: [],
  });

  // ✅ Log system
  const [logs, setLogs] = useState<string[]>([]);
  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString("th-TH", { hour12: false });
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev.slice(0, 99)]);
  };

  const apiBase = `http://${window.location.hostname}:4000`;

  // ✅ Load Data
  const loadData = async () => {
    try {
      addLog("📦 Loading data from backend...");
      setLoading(true);
      const [boothRes, userRes, configRes] = await Promise.all([
        fetch(`${apiBase}/booths`),
        fetch(`${apiBase}/users`),
        fetch(`${apiBase}/event-config`),
      ]);

      const boothData = await boothRes.json();
      const userData = await userRes.json();
      const configData = await configRes.json();

      boothData.sort((a: Booth, b: Booth) => b.attendees - a.attendees);
      setBooths(boothData);
      setMembers(userData);

      addLog(`✅ Loaded booths: ${boothData.length}, members: ${userData.length}`);

      if (configData) {
        setEventConfig({
          eventName: configData.eventName || "",
          subtitle: configData.subtitle || "",
          dateText: configData.dateText || "",
          locationText: configData.locationText || "",
          logoUrl: configData.logoUrl || "",
          bannerUrls: configData.bannerUrls
            ? JSON.parse(configData.bannerUrls)
            : [],
        });
      }
    } catch (err) {
      addLog("❌ Failed to load data from backend");
      alert("⚠️ โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบ Backend");
    } finally {
      setLoading(false);
    }
  };

  const fetchMode = async () => {
    try {
      const res = await fetch(`${apiBase}/mode`);
      const data = await res.json();
      if (data.mode) setMode(data.mode);
      addLog(`🧭 Current mode: ${data.mode}`);
    } catch {
      addLog("⚠️ Failed to fetch current mode");
    }
  };

  useEffect(() => {
    addLog("🚀 Admin Panel initialized");
    addLog(`🌐 Connected to backend: ${apiBase}`);
    fetchMode();
    loadData();
    addLog("✅ All data loaded and ready.");
  }, []);

  // ✅ Switch Mode
  const handleSwitchMode = async () => {
    const newMode = mode === "local" ? "cloud" : "local";
    if (!window.confirm(`ต้องการสลับเป็นโหมด ${newMode.toUpperCase()} หรือไม่?`))
      return;
    setSwitching(true);
    addLog(`🔁 Switching mode to ${newMode.toUpperCase()}...`);
    try {
      const res = await fetch(`${apiBase}/switch-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newMode }),
      });
      const data = await res.json();
      if (data.success) {
        setMode(newMode);
        addLog(`✅ Mode changed successfully → ${newMode.toUpperCase()}`);
        alert(`✅ เปลี่ยนเป็นโหมด ${newMode.toUpperCase()} แล้ว`);
        loadData();
      } else {
        addLog("❌ Failed to switch mode");
      }
    } catch {
      addLog("⚠️ Error while switching mode");
      alert("⚠️ ไม่สามารถสลับโหมดได้");
    } finally {
      setSwitching(false);
    }
  };

  // ✅ CRUD Booths
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { title, image, description, location };
    try {
      if (editingBooth) {
        addLog(`📝 Updating booth: ${editingBooth.title}`);
        await fetch(`${apiBase}/booths/${editingBooth.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        addLog(`➕ Adding new booth: ${title}`);
        await fetch(`${apiBase}/booths`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      addLog("✅ Booth saved successfully");
      resetForm();
      loadData();
    } catch {
      addLog("❌ Failed to save booth");
      alert("⚠️ เกิดข้อผิดพลาดในการบันทึกบูธ");
    }
  };

  const handleEdit = (booth: Booth) => {
    setEditingBooth(booth);
    setTitle(booth.title);
    setImage(booth.image || "");
    setDescription(booth.description || "");
    setLocation(booth.location || "");
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("ต้องการลบบูธนี้ใช่ไหม?")) return;
    addLog(`🗑️ Deleting booth ID: ${id}`);
    await fetch(`${apiBase}/booths/${id}`, { method: "DELETE" });
    addLog("✅ Booth deleted successfully");
    loadData();
  };

  const resetForm = () => {
    setEditingBooth(null);
    setTitle("");
    setImage("");
    setDescription("");
    setLocation("");
  };

  // ✅ Sync / Clear
  const handleBackup = async () => {
    setSyncing(true);
    addLog("☁️ Starting backup to Supabase...");
    try {
      const res = await fetch(`${apiBase}/backup`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        addLog("✅ Backup completed successfully");
        alert("☁️ Backup สำเร็จ!");
      } else {
        addLog("⚠️ Backup failed");
        alert("⚠️ Backup ล้มเหลว");
      }
    } catch {
      addLog("❌ Backup request failed");
      alert("⚠️ ไม่สามารถสำรองข้อมูลได้");
    } finally {
      setSyncing(false);
    }
  };

  const handleRestore = async () => {
    if (!window.confirm("ต้องการกู้คืนข้อมูลจาก Cloud หรือไม่?")) return;
    setSyncing(true);
    addLog("⭳ Restoring data from Supabase...");
    try {
      const res = await fetch(`${apiBase}/restore`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        addLog("✅ Restore completed successfully");
        alert("✅ กู้คืนข้อมูลสำเร็จ");
        loadData();
      } else {
        addLog("⚠️ Restore failed");
        alert("⚠️ Restore ล้มเหลว");
      }
    } catch {
      addLog("❌ Restore request failed");
      alert("⚠️ ไม่สามารถกู้คืนข้อมูลได้");
    } finally {
      setSyncing(false);
    }
  };


  const handleClearCheckins = async () => {
    if (!window.confirm("ลบเช็กอินทั้งหมดใช่ไหม?")) return;
    addLog("🧹 Clearing all check-ins...");
    const res = await fetch(`${apiBase}/checkins`, { method: "DELETE" });
    const data = await res.json();
    addLog(data.success ? "✅ Check-ins cleared" : "⚠️ Failed to clear check-ins");
    alert(data.success ? "🗑️ ลบเช็กอินสำเร็จ" : "⚠️ ล้มเหลว");
    loadData();
  };

  // ✅ Save Config
  const handleSaveEventConfig = async () => {
    addLog("⚙️ Saving event configuration...");
    try {
      const payload = {
        eventName: eventConfig.eventName,
        subtitle: eventConfig.subtitle,
        dateText: eventConfig.dateText,
        locationText: eventConfig.locationText,
        logoUrl: eventConfig.logoUrl,
        bannerUrls: eventConfig.bannerUrls.filter((u) => u.trim() !== ""),
      };

      const res = await fetch(`${apiBase}/event-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      addLog(data.success ? "✅ Event config saved successfully" : "❌ Failed to save config");
      alert(data.success ? "✅ บันทึกการตั้งค่าสำเร็จ" : "❌ บันทึกล้มเหลว");
    } catch {
      addLog("⚠️ Error saving event config");
      alert("⚠️ เกิดข้อผิดพลาดในการบันทึกการตั้งค่า");
    }
  };

  const filteredMembers = members.filter(
    (m) =>
      m.nickname.toLowerCase().includes(search.toLowerCase()) ||
      (m.school || "").toLowerCase().includes(search.toLowerCase())
  );

  // ✅ UI
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 p-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-4 mb-6 flex flex-wrap justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">Admin Control Panel</h1>
          <span
            className={`text-sm font-semibold px-3 py-1.5 rounded-full border shadow-sm ${
              mode === "local"
                ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                : "bg-sky-100 text-sky-700 border-sky-300"
            }`}
          >
            {mode === "local"
              ? "🟢 Local Mode (SQLite)"
              : "☁️ Cloud Mode (Supabase)"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            onClick={handleSwitchMode}
            disabled={switching}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition"
          >
            🔁 สลับโหมด
          </button>
          <button
            onClick={handleBackup}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition"
          >
            ☁️ Backup
          </button>
          <button
            onClick={handleRestore}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            ⭳ Restore
          </button>
          <button
            onClick={handleClearCheckins}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            🗑 ลบเช็กอิน
          </button>
          <button
            onClick={onDashboard}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            📈 Dashboard
          </button>
          <button
            onClick={onScan}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            📷 Scan
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-900 transition"
          >
            ⬅ กลับ
          </button>
        </div>
      </div>

      {/* ✅ Loading indicator */}
      {loading && (
        <div className="text-center text-slate-500 italic py-4">
          ⏳ กำลังโหลดข้อมูล...
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        {[
          { id: "booths", label: "จัดการบูธ" },
          { id: "members", label: "สมาชิก" },
          { id: "config", label: "ตั้งค่างาน" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2 rounded-xl font-semibold transition ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-md"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Booths */}
      {activeTab === "booths" && (
        <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200">
          <h2 className="font-bold text-lg text-slate-700 mb-4">ตั้งค่าบูทกิจกรรม</h2>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-3 mb-6">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ชื่อบูธ"
              className="border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-300 outline-none"
              required
            />
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="ลิงก์รูปภาพ"
              className="border border-slate-300 rounded-lg px-3 py-2"
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ตำแหน่งบูธ"
              className="border border-slate-300 rounded-lg px-3 py-2"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="คำอธิบาย"
              className="border border-slate-300 rounded-lg px-3 py-2 md:col-span-2"
            />
            <div className="flex gap-3 md:col-span-2">
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
              >
                {editingBooth ? "บันทึกการแก้ไข" : "เพิ่มบูธ"}
              </button>
              {editingBooth && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-300 rounded-lg hover:bg-gray-400 transition"
                >
                  ยกเลิก
                </button>
              )}
            </div>
          </form>

          <table className="w-full border text-sm">
            <thead className="bg-blue-50 text-slate-700">
              <tr>
                <th className="p-2 border">ชื่อบูธ</th>
                <th className="p-2 border w-40">จำนวนเช็กอิน</th>
                <th className="p-2 border w-32">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {booths.map((b) => (
                <tr key={b.id} className="border-t hover:bg-blue-50 transition">
                  <td className="p-2 border">{b.title}</td>
                  <td className="p-2 border text-center">{b.attendees}</td>
                  <td className="p-2 flex gap-2 justify-center">
                    <button
                      onClick={() => handleEdit(b)}
                      className="px-2 py-1 bg-yellow-400 text-white rounded hover:bg-yellow-500"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Members */}
      {activeTab === "members" && (
        <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200">
          <input
            type="text"
            placeholder="🔍 ค้นหาชื่อเล่น / โรงเรียน"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4"
          />
          <MemberTable members={filteredMembers} setMembers={setMembers} />
        </div>
      )}

      {/* Config */}
      {activeTab === "config" && (
        <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-200 space-y-3">
          <h2 className="font-bold text-lg text-slate-700 mb-3">
            ⚙️ ตั้งค่าข้อมูลงาน
          </h2>
          <input
            value={eventConfig.eventName}
            onChange={(e) =>
              setEventConfig({ ...eventConfig, eventName: e.target.value })
            }
            placeholder="ชื่อกิจกรรม"
            className="border border-slate-300 rounded-lg px-3 py-2 w-full"
          />
          <input
            value={eventConfig.subtitle}
            onChange={(e) =>
              setEventConfig({ ...eventConfig, subtitle: e.target.value })
            }
            placeholder="คำอธิบายสั้น"
            className="border border-slate-300 rounded-lg px-3 py-2 w-full"
          />
          <input
            value={eventConfig.dateText}
            onChange={(e) =>
              setEventConfig({ ...eventConfig, dateText: e.target.value })
            }
            placeholder="วันที่จัดงาน"
            className="border border-slate-300 rounded-lg px-3 py-2 w-full"
          />
          <input
            value={eventConfig.locationText}
            onChange={(e) =>
              setEventConfig({ ...eventConfig, locationText: e.target.value })
            }
            placeholder="สถานที่จัดงาน"
            className="border border-slate-300 rounded-lg px-3 py-2 w-full"
          />
          <input
            value={eventConfig.logoUrl}
            onChange={(e) =>
              setEventConfig({ ...eventConfig, logoUrl: e.target.value })
            }
            placeholder="ลิงก์โลโก้"
            className="border border-slate-300 rounded-lg px-3 py-2 w-full"
          />
          <textarea
            placeholder="ลิงก์แบนเนอร์ (1 รูปต่อบรรทัด)"
            value={eventConfig.bannerUrls.join("\n")}
            onChange={(e) =>
              setEventConfig({
                ...eventConfig,
                bannerUrls: e.target.value.split("\n"),
              })
            }
            className="border border-slate-300 rounded-lg px-3 py-2 w-full h-32"
          />

          <div className="border rounded-lg p-4 bg-slate-50">
            <p className="font-semibold text-slate-700 mb-2">🖼 Preview:</p>
            {eventConfig.logoUrl && (
              <img
                src={eventConfig.logoUrl}
                alt="logo"
                className="w-24 h-24 object-contain mb-3"
              />
            )}
            {eventConfig.bannerUrls.map(
              (b, i) =>
                b.trim() && (
                  <img
                    key={i}
                    src={b}
                    alt={`banner-${i}`}
                    className="w-full h-40 object-cover mb-2 rounded-lg"
                  />
                )
            )}
          </div>
          <button
            onClick={handleSaveEventConfig}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
          >
            💾 บันทึกการตั้งค่า
          </button>
        </div>
      )}

      {/* 🧾 Log Panel */}
      <div className="bg-black text-green-400 font-mono text-xs p-3 mt-8 rounded-xl shadow-inner border border-slate-700 h-56 overflow-y-auto">
        <p className="text-slate-400 mb-1">🧾 System Log:</p>
        {logs.length > 0 ? (
          logs.map((line, i) => (
            <div key={i} className="whitespace-pre text-[13px] leading-tight">
              {line}
            </div>
          ))
        ) : (
          <p className="text-slate-500 italic">No logs yet...</p>
        )}
      </div>
    </div>
  );
}
