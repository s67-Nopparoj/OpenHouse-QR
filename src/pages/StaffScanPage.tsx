import React, { useState, useEffect, useRef } from "react";

export default function StaffScanPage({
  booths = [],
  onBack = () => {},
  onCheckin = (payload: { email: string; boothId: number }) => {},
}: {
  booths: any[];
  onBack?: () => void;
  onCheckin?: (p: { email: string; boothId: number }) => any;
}) {
  const [boothId, setBoothId] = useState<number | null>(
    Number(localStorage.getItem("lastBoothId")) || booths[0]?.id || null
  );
  const [status, setStatus] = useState<{
    type: "success" | "warn" | "error";
    msg: string;
  } | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // ✅ เริ่มเปิดกล้อง
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
        }
      } catch (e: any) {
        setStatus({
          type: "error",
          msg: "❌ ไม่สามารถเปิดกล้องได้: " + e.message,
        });
      }
    }
    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((t) => t.stop());
      }
    };
  }, []);

  // ✅ เมื่อเลือกบูธใหม่ ให้บันทึกไว้
  useEffect(() => {
    if (boothId) localStorage.setItem("lastBoothId", boothId.toString());
  }, [boothId]);

  // ✅ ฟังก์ชันสแกน (mock)
  function handleDecoded(raw: string) {
    const text = String(raw || "").trim();
    if (!text.includes("@")) {
      setStatus({ type: "warn", msg: "⚠️ QR ไม่ถูกต้อง: " + text.slice(0, 32) });
      return;
    }
    if (!boothId) {
      setStatus({ type: "warn", msg: "กรุณาเลือกบูธก่อนสแกน" });
      return;
    }
    const result = onCheckin({ email: text.toLowerCase(), boothId });
    setStatus(result || { type: "success", msg: "✅ เช็คอินสำเร็จ" });
  }

  function handleManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    handleDecoded(String(form.get("qr") || ""));
    e.currentTarget.reset();
  }

  return (
    <div className="min-h-screen bg-white text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border hover:bg-slate-50"
          >
            ⬅ ย้อนกลับ
          </button>
          <h1 className="text-sm font-bold">Staff • สแกนเช็คอิน</h1>
          <div className="w-[86px]" />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-md mx-auto px-4 pt-4 pb-24 space-y-4">
        {/* เลือกบูธ */}
        <div className="rounded-2xl border p-3">
          <div className="text-[12px] text-slate-500 mb-1">เลือกบูธ</div>
          <select
            value={boothId ?? ""}
            onChange={(e) => setBoothId(Number(e.target.value))}
            className="w-full h-12 rounded-xl border px-3 text-sm"
          >
            {booths.length > 0 ? (
              booths.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))
            ) : (
              <option value="">ยังไม่มีข้อมูลบูธ</option>
            )}
          </select>
        </div>

        {/* กล้อง */}
        <section className="rounded-2xl border overflow-hidden">
          <div className="bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
            กล้อง (Camera)
          </div>
          <div className="p-3">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-xl border bg-black aspect-video object-cover"
            />
            {!cameraReady && (
              <p className="mt-2 text-[12px] text-slate-500">
                ⏳ กำลังเปิดกล้อง หรือผู้ใช้ยังไม่อนุญาตการเข้าถึงกล้อง
              </p>
            )}
            <p className="mt-2 text-[12px] text-slate-500">
              *โค้ดนี้ยังไม่ได้ decode QR จริง — หากต้องการใช้งานจริง ให้เพิ่ม
              <code> jsQR </code> หรือ <code> zxing-js </code>
            </p>
          </div>
        </section>

        {/* ฟอร์มกรอก QR ด้วยมือ */}
        <section className="rounded-2xl border p-3">
          <div className="text-[12px] text-slate-600 mb-2">
            กรอกหรือวางค่าจาก QR Code (อีเมลหรือข้อมูลใน QR)
          </div>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              name="qr"
              className="flex-1 h-12 rounded-xl border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder="เช่น user@example.com"
            />
            <button
              type="submit"
              className="h-12 px-4 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
            >
              เช็คอิน
            </button>
          </form>
        </section>

        {/* แสดงผลลัพธ์ */}
        {status && (
          <div
            className={`rounded-xl border p-3 text-sm font-medium ${
              status.type === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : status.type === "warn"
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-rose-300 bg-rose-50 text-rose-700"
            }`}
          >
            {status.msg}
          </div>
        )}
      </main>
    </div>
  );
}
