import React, { useEffect, useState } from "react";

export default function UuidPage() {
  const [uuid, setUuid] = useState<string>("");
  const [nickname, setNickname] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  // ✅ ดึง UUID จาก URL
  useEffect(() => {
    const parts = window.location.pathname.split("/");
    const id = parts[parts.length - 1];
    setUuid(id || "");
  }, []);

  // ✅ ตรวจสอบว่า UUID นี้เคยลงทะเบียนชื่อแล้วหรือยัง
  useEffect(() => {
    if (!uuid) return;
    const checkExisting = async () => {
      try {
        const res = await fetch(`http://localhost:4000/uuid/${uuid}`);
        const data = await res.json();
        console.log("🧾 ตรวจสอบ uuid:", data);

        if (data && data.nickname && data.nickname.trim() !== "") {
          // เคยมีชื่อแล้ว → บันทึก session และข้ามไปหน้า userhome
          const session = {
            nickname: data.nickname,
            school: data.school || "ไม่ระบุโรงเรียน",
            qrCode: `http://localhost:5173/uuid/${uuid}`,
          };
          localStorage.setItem("session", JSON.stringify(session));
          setAlreadyRegistered(true);

          // ✅ ไปหน้า UserHome โดยตรง (ใช้ replace ปลอดภัยกว่า href)
          setTimeout(() => {
            window.location.replace("/"); // reload พร้อม redirect
          }, 800);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("❌ ตรวจสอบ uuid ไม่ได้:", err);
        setLoading(false);
      }
    };
    checkExisting();
  }, [uuid]);

  // ✅ ฟังก์ชันบันทึกชื่อเข้า DB
  async function handleSave() {
    if (!nickname.trim()) {
      setError("⚠️ กรุณากรอกชื่อเล่นก่อนบันทึก");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("http://localhost:4000/uuid-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid, nickname }),
      });

      const data = await res.json();
      console.log("📦 ผลลัพธ์จาก backend:", data);

      if (data.success) {
        // ✅ บันทึก session ไว้ใน localStorage
        const session = {
          nickname,
          school: data.school || "ไม่ระบุโรงเรียน",
          qrCode: `http://localhost:5173/uuid/${uuid}`,
        };
        localStorage.setItem("session", JSON.stringify(session));

        setSuccess(true);

        // ✅ redirect แบบ reload จริง (ไม่ค้าง)
        setTimeout(() => {
          window.location.replace("/");
        }, 800);
      } else {
        setError("❌ ไม่สามารถบันทึกข้อมูลได้");
      }
    } catch (err) {
      console.error("🚫 ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้:", err);
      setError("🚫 ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  // ✅ กำลังโหลด (ระหว่างตรวจสอบ uuid)
  if (loading && !alreadyRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600 bg-gray-100">
        กำลังตรวจสอบข้อมูล...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-sm text-center">
          {!success ? (
            <>
              <h2 className="text-lg font-bold mb-2 text-indigo-700">
                ✨ ลงทะเบียนชื่อของคุณ
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                กรุณากรอกชื่อเล่นเพื่อบันทึกข้อมูลในระบบ
              </p>
              <input
                type="text"
                placeholder="ชื่อเล่นของคุณ"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="border border-gray-300 rounded-lg p-2 w-full mb-3 text-center focus:ring focus:ring-indigo-200"
                disabled={loading}
              />
              {error && (
                <p className="text-red-500 text-sm mb-2">{error}</p>
              )}
              <button
                onClick={handleSave}
                disabled={loading}
                className={`w-full py-2 rounded-lg text-white font-semibold ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {loading ? "⏳ กำลังบันทึก..." : "บันทึกชื่อ"}
              </button>
            </>
          ) : (
            <div className="text-center">
              <h2 className="text-lg font-bold text-emerald-600 mb-2">
                ✅ บันทึกสำเร็จ!
              </h2>
              <p className="text-sm text-gray-600">
                กำลังเข้าสู่หน้าโปรไฟล์ของคุณ...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
