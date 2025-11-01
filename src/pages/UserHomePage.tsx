// src/pages/UserHomePage.tsx
import React, { useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { ContactButton } from "../components/ContactButton";

type Booth = {
  id: number;
  title: string;
  image: string;
  attendees: number;
  description?: string;
  location?: string;
};

export default function UserHomePage({
  uuid: propUuid,
  nickname: initialNickname,
  school: initialSchool,
  onLogout,
}: {
  uuid: string | null;
  nickname: string;
  school: string;
  onLogout: () => void;
}) {
  // ✅ โหลด uuid จาก localStorage ถ้า props ไม่มี (กัน refresh แล้วหลุด)
  const storedUuid = localStorage.getItem("user_uuid");
  const uuid = propUuid || storedUuid || null;
  const [nickname, setNickname] = useState(initialNickname || "");
  const [school, setSchool] = useState(initialSchool || "");
  const [booths, setBooths] = useState<Booth[]>([]);
  const [loading, setLoading] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);

  const [popupOpen, setPopupOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [schoolInput, setSchoolInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [qrPopupOpen, setQrPopupOpen] = useState(false);
  const [errorPopup, setErrorPopup] = useState<string | null>(null);


  const apiBase = `http://${window.location.hostname}:4000`;
  const frontendBase =
    window.location.hostname === "localhost"
      ? "http://192.168.1.51:5173"
      : window.location.origin;

  useEffect(() => {
    // ✅ ตรวจหา UUID จาก URL หรือ localStorage
    let activeUuid =
      window.location.pathname.includes("/uuid/")
        ? window.location.pathname.split("/uuid/")[1]
        : uuid || localStorage.getItem("user_uuid") || "";

    if (!activeUuid) {
      console.warn("⚠️ ไม่มี UUID ที่จะโหลดข้อมูลผู้ใช้");
      onLogout(); // ถ้าไม่มี uuid เลยให้กลับหน้า login
      return;
    }

    // ✅ เก็บ uuid ลง localStorage เพื่อกันหลุดเวลา refresh
    localStorage.setItem("user_uuid", activeUuid);

    const loadUser = async () => {
      try {
        const res = await fetch(`${apiBase}/uuid/${activeUuid}`);
        if (res.status === 404) {
          setErrorPopup("❌ ไม่พบรหัสผู้ใช้ในระบบ กรุณาติดต่อเจ้าหน้าที่");
          return;
        }

        const data = await res.json();

        if (!data || !data.uuid) {
          setErrorPopup("❌ ไม่พบข้อมูลผู้ใช้ในระบบ");
          return;
        }

        // ⚠️ ถ้ามี uuid แต่ยังไม่มีชื่อ → เปิด popup ลงทะเบียน
        if (!data.nickname || data.nickname.trim() === "") {
          setNickname("");
          setSchool("");
          setPopupOpen(true); // ✅ เด้ง popup ลงทะเบียนทันที
          setOfflineMode(false);
          return;
        }

        // ✅ ถ้าพบข้อมูลครบ → โหลดข้อมูลตามปกติ
        setNickname(data.nickname);
        setSchool(data.school || "ไม่ระบุโรงเรียน");
        setPopupOpen(false);
        setOfflineMode(false);
      } catch {
        setOfflineMode(true);
      }
    };

    loadUser();
    loadBooths();
  }, [uuid]);

  const loadBooths = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/booths`);
      const data = await res.json();
      setBooths(data);
      localStorage.setItem("cache_booths", JSON.stringify(data));
      setOfflineMode(false);
    } catch {
      const cache = JSON.parse(localStorage.getItem("cache_booths") || "[]");
      setBooths(cache);
      setOfflineMode(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterName = async () => {
    if (!nicknameInput.trim()) {
      setPopupMessage("⚠️ กรุณากรอกชื่อก่อน");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/uuid-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid,
          nickname: nicknameInput,
          school: schoolInput || "",
        }),
      });
      const data = await res.json();

      if (data.success) {
        setNickname(nicknameInput);
        setSchool(schoolInput || "ไม่ระบุโรงเรียน");
        setPopupMessage("✅ บันทึกข้อมูลเรียบร้อย");
        setTimeout(() => setPopupOpen(false), 1200);
      } else {
        setPopupMessage("❌ ไม่สามารถบันทึกข้อมูลได้");
      }
    } catch {
      setPopupMessage("🚫 ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 text-slate-800 flex flex-col">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-600 text-white shadow-md py-3 px-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-lg font-semibold">
            👤
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg">
              {nickname || "ผู้ใช้งานทั่วไป"}
            </h1>
            <p className="text-xs opacity-80">{school || "ไม่ระบุโรงเรียน"}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-rose-500 text-white hover:bg-rose-600 shadow-sm transition active:scale-[.98]"
        >
          ออกจากระบบ
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-8">
        {/* Profile + QR Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center relative overflow-hidden transform transition duration-300 hover:-translate-y-1 hover:shadow-lg">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-2xl" />
          <h2 className="text-xl font-bold mt-2">QR CHECKIN</h2>
          <p className="text-sm text-slate-500">
            แสดง QR นี้เพื่อเช็กอินที่บูธกิจกรรม
          </p>

          <div className="mt-5 flex flex-col items-center transition-transform duration-300 hover:scale-105">
            {uuid ? (
              <div
                className="bg-slate-50 border rounded-xl shadow-inner p-3 shadow-md animate-fade-in cursor-pointer hover:shadow-lg active:scale-95 transition"
                onClick={() => setQrPopupOpen(true)} // ✅ คลิกแล้วเปิด popup
              >
                <QRCodeCanvas
                  value={`${frontendBase}/uuid/${uuid}`}
                  size={window.innerWidth < 500 ? 150 : 200}
                  level="H"
                  includeMargin={true}
                />
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-500 font-medium">
                ⚠️ ไม่พบรหัสผู้ใช้ (UUID)
                <p className="text-xs text-rose-400 mt-1">
                  กรุณาลองล็อกอินใหม่หรือติดต่อเจ้าหน้าที่
                </p>
              </div>
            )}

            <p className="mt-2 text-xs text-slate-500">
              UUID:{" "}
              <span className="font-mono text-slate-600">
                {uuid || "ไม่มีข้อมูล"}
              </span>
            </p>
            <a
              href={`/game/index.html?uuid=${uuid}&name=${encodeURIComponent(nickname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow active:scale-[.98] transition font-semibold"
            >
              🎮 เข้าร่วมเล่นเกมกิจกรรม
            </a>

          </div>
        </div>

        {/* Booth Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2 border-l-4 border-blue-600 pl-2">
              🧩 บูธกิจกรรมทั้งหมด
            </h3>
            <button
              onClick={loadBooths}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 hover:bg-slate-100 transition"
            >
              🔄 รีเฟรช
            </button>
          </div>

          {loading ? (
            <p className="text-slate-500 text-sm">⏳ กำลังโหลดข้อมูล...</p>
          ) : booths.length === 0 ? (
            <p className="text-slate-500 text-sm">
              {offlineMode
                ? "ไม่มีข้อมูลบูธในเครื่อง"
                : "ยังไม่มีข้อมูลบูธในระบบ"}
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {booths.map((b) => (
                <div
                  key={b.id}
                  className="bg-white border rounded-2xl shadow-sm hover:shadow-md overflow-hidden transition group"
                >
                  <div className="relative">
                    <img
                      src={
                        b.image || "https://placehold.co/400x200?text=No+Image"
                      }
                      alt={b.title}
                      className="h-40 w-full object-cover group-hover:scale-[1.03] transition-transform"
                    />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent text-white p-2 text-sm font-medium">
                      {b.title}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-slate-500 mb-2">
                      👥 ผู้เข้าร่วม: {b.attendees} คน
                    </p>
                    <button
                      onClick={() => setSelectedBooth(b)}
                      className="w-full py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[.98] transition"
                    >
                      🔍 ดูรายละเอียด
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 py-4 border-t bg-white/50">
        OpenHouse QR System © 2025 — Software Development Group 2
      </footer>

      {/* Booth Detail Popup */}
      {selectedBooth && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedBooth(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-md relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedBooth(null)}
              className="absolute top-2 right-2 text-slate-400 hover:text-slate-700"
            >
              ✖
            </button>
            <img
              src={
                selectedBooth.image ||
                "https://placehold.co/600x300?text=No+Image"
              }
              alt={selectedBooth.title}
              className="w-full h-48 object-cover rounded-lg mb-3"
            />
            <h2 className="text-lg font-bold mb-1">{selectedBooth.title}</h2>
            <p className="text-sm text-slate-600 mb-1">
              📍 {selectedBooth.location || "ไม่ระบุสถานที่"}
            </p>
            <p className="text-sm text-slate-700 mb-3">
              {selectedBooth.description || "ไม่มีคำอธิบายสำหรับบูธนี้"}
            </p>
            <p className="text-sm text-slate-500">
              👥 ผู้เข้าร่วมทั้งหมด:{" "}
              <span className="font-semibold text-slate-800">
                {selectedBooth.attendees}
              </span>{" "}
              คน
            </p>
          </div>
        </div>
      )}

      {/* Register Popup */}
      {popupOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-md text-center">
            <h2 className="text-lg font-bold text-blue-700 mb-2">
              ลงทะเบียนชื่อของคุณ
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              กรุณากรอกชื่อเล่นและโรงเรียนเพื่อบันทึกข้อมูลในระบบ
            </p>
            <input
              type="text"
              placeholder="กรอกชื่อเล่นภาษาอังกฤษ"
              className="border border-slate-300 rounded-lg p-2 w-full mb-3 text-center focus:ring-2 focus:ring-blue-300 outline-none"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
            />
            <input
              type="text"
              placeholder="กรอกเฉพาะชื่อโรงเรียน (ไม่บังคับกรอก)"
              className="border border-slate-300 rounded-lg p-2 w-full mb-3 text-center focus:ring-2 focus:ring-blue-300 outline-none"
              value={schoolInput}
              onChange={(e) => setSchoolInput(e.target.value)}
            />
            <button
              onClick={handleRegisterName}
              disabled={saving}
              className="w-full py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 active:scale-[.98] transition"
            >
              {saving ? "⏳ กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
            <p className="text-sm mt-3 text-slate-500">{popupMessage}</p>
          </div>
        </div>
      )}
      {/* ❌ Popup แจ้งเตือน Error ผู้ใช้ไม่พบ */}
      {errorPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-sm text-center animate-fade-in">
            <h2 className="text-lg font-bold text-rose-600 mb-2">เกิดข้อผิดพลาด</h2>
            <p className="text-sm text-slate-600 mb-4">{errorPopup}</p>
            <button
              onClick={() => {
                setErrorPopup(null);
                onLogout(); // กลับหน้าหลักทันทีเมื่อกดตกลง
              }}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 active:scale-[.97] transition"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
      {/* ✅ Popup แสดง QR ขนาดใหญ่ */}
      {qrPopupOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setQrPopupOpen(false)} // คลิกพื้นหลังเพื่อปิด
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()} // ป้องกันคลิกทะลุปิด
          >
            <button
              onClick={() => setQrPopupOpen(false)}
              className="absolute top-2 right-2 text-slate-500 hover:text-black text-xl"
            >
              ✖
            </button>
            <h2 className="text-lg font-bold text-slate-800 mb-3">
              QR Code ของคุณ
            </h2>
            <QRCodeCanvas
              value={`${frontendBase}/uuid/${uuid}`}
              size={300} // ✅ ขยายขนาดใหญ่ขึ้น
              level="H"
              includeMargin={true}
            />
            <p className="text-sm text-slate-600 mt-3">
              แตะพื้นหลังหรือปุ่ม ✖ เพื่อปิด
            </p>
          </div>
        </div>
      )}
    <ContactButton />
    </div>
  );
}
