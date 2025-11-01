import React from "react";

type Booth = {
  id: number;
  title: string;
  image: string;
  attendees: number;
  description?: string;
  location?: string;
};

type BoothDetailModalProps = {
  booth: Booth | null;
  onClose: () => void;
};

export default function BoothDetailModal({ booth, onClose }: BoothDetailModalProps) {
  if (!booth) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose} // ✅ คลิกพื้นหลังปิด
    >
      <div
        className="bg-white rounded-xl p-6 w-full max-w-lg shadow-lg relative animate-scaleIn overflow-hidden"
        onClick={(e) => e.stopPropagation()} // กันไม่ให้ modal ปิดถ้าคลิกข้างใน
      >
        {/* ปุ่มปิด */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-slate-600 hover:text-black transition"
        >
          ✖
        </button>

        {/* รูปภาพพร้อม fallback */}
        <img
          src={booth.image}
          alt={booth.title}
          onError={(e) => (e.currentTarget.src = "https://placehold.co/600x400?text=No+Image")}
          className="w-full h-48 object-cover rounded-lg mb-4"
        />

        {/* ข้อมูลบูธ */}
        <h2 className="text-xl font-bold mb-2">{booth.title}</h2>

        <div className="max-h-48 overflow-y-auto">
          <p className="text-sm text-slate-600 mb-2">
            {booth.description || "ไม่มีรายละเอียด"}
          </p>
        </div>

        <p className="text-sm text-slate-500 mt-1">
          📍 {booth.location || "ไม่ระบุสถานที่"}
        </p>

        <p className="mt-3 text-sm font-semibold text-slate-700">
          มีผู้เข้าร่วมแล้ว : {booth.attendees} คน
        </p>
      </div>
    </div>
  );
}
