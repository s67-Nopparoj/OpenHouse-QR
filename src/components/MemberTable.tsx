import React, { useState, useEffect } from "react";

type Member = {
  id: number;
  uuid: string;
  nickname: string;
  school: string;
  visitedBooths?: number;
};

type Checkin = {
  id: number;
  boothId: number;
  timestamp: number;
  boothTitle?: string;
};

export default function MemberTable({
  members,
  setMembers,
}: {
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
}) {
  const [showCheckins, setShowCheckins] = useState<Member | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [totalBooths, setTotalBooths] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const apiBase = `http://${window.location.hostname}:4000`;

  // ✅ โหลดข้อมูล users ใหม่
  const loadMembers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/users`);
      const data = await res.json();
      setMembers(data);
    } finally {
      setLoading(false);
    }
  };

  // ✅ โหลดจำนวน booth ทั้งหมด
  const loadBooths = async () => {
    const res = await fetch(`${apiBase}/booths`);
    const data = await res.json();
    setTotalBooths(data.length);
  };

  // ✅ โหลด check-in ของ user
  const loadCheckins = async (uuid: string) => {
    try {
      const res = await fetch(`${apiBase}/user-checkins/${uuid}`);
      const data = await res.json();
      setCheckins(data);
    } catch (err) {
      console.error("❌ โหลดเช็คอินล้มเหลว:", err);
      alert("🚫 ไม่สามารถโหลดข้อมูลเช็คอินได้");
    }
  };

  useEffect(() => {
    loadBooths();
  }, []);

  // ✅ ลบผู้ใช้
  const deleteMember = async (id: number) => {
    if (!confirm("❗ แน่ใจหรือไม่ที่จะลบสมาชิกนี้?")) return;
    await fetch(`${apiBase}/users/${id}`, { method: "DELETE" });
    await loadMembers();
  };

  // ✅ ลบ check-in
  const deleteCheckin = async (checkinId: number, uuid: string) => {
    if (!confirm("ลบเช็คอินนี้ใช่ไหม?")) return;
    await fetch(`${apiBase}/checkins/${checkinId}`, { method: "DELETE" });
    await loadCheckins(uuid);
    await loadMembers();
  };

  // ✅ ฟังก์ชันคัดลอก UUID
  const copyUUID = (uuid: string) => {
    navigator.clipboard.writeText(uuid);
    alert(`📋 คัดลอก UUID แล้ว: ${uuid}`);
  };

  // ✅ บันทึกข้อมูลสมาชิก (ชื่อ+โรงเรียน)
  const saveEditMember = async () => {
    if (!editMember) return;
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/users/${editMember.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: editMember.nickname,
          school: editMember.school,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ บันทึกข้อมูลเรียบร้อยแล้ว");
        setEditMember(null);
        await loadMembers();
      } else {
        alert("❌ ไม่สามารถบันทึกข้อมูลได้");
      }
    } catch {
      alert("🚫 เกิดข้อผิดพลาดระหว่างการบันทึก");
    } finally {
      setSaving(false);
    }
  };

  // ✅ เวลากด “ดูเช็คอิน” → โหลดข้อมูลก่อนเปิด Modal
  const handleViewCheckins = async (m: Member) => {
    setShowCheckins(m);
    await loadCheckins(m.uuid);
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-slate-700">รายชื่อสมาชิก</h3>
        <button
          onClick={loadMembers}
          disabled={loading}
          className="px-3 py-1 text-sm bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50"
        >
          🔄 รีเฟรช
        </button>
      </div>

      <table className="w-full border-collapse bg-white shadow rounded-lg text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-3 text-center">ID</th>
            <th className="p-3">ชื่อเล่น</th>
            <th className="p-3">โรงเรียน</th>
            <th className="p-3">UUID</th>
            <th className="p-3 text-center">บูธที่เข้าแล้ว</th>
            <th className="p-3 text-center">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const visited = m.visitedBooths || 0;
            const progress =
              totalBooths > 0 ? Math.round((visited / totalBooths) * 100) : 0;

            return (
              <tr key={m.id} className="border-t hover:bg-gray-50">
                <td className="p-3 text-center font-mono text-xs">{m.id}</td>
                <td className="p-3">{m.nickname}</td>
                <td className="p-3">{m.school || "-"}</td>
                <td className="p-3 font-mono text-xs flex items-center gap-2">
                  <span>{m.uuid}</span>
                  <button
                    onClick={() => copyUUID(m.uuid)}
                    className="text-[10px] px-2 py-0.5 bg-slate-200 rounded hover:bg-slate-300 active:scale-[.95]"
                  >
                    Copy
                  </button>
                </td>
                <td className="p-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-32 bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-green-500 h-3 rounded-full"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-600">
                      {visited}/{totalBooths}
                    </span>
                  </div>
                </td>
                <td className="p-3 text-center space-x-2">
                  <button
                    onClick={() => handleViewCheckins(m)}
                    className="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600"
                  >
                    ดูเช็คอิน
                  </button>
                  <button
                    onClick={() => setEditMember(m)}
                    className="px-3 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => deleteMember(m.id)}
                    className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    ลบ
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ✅ Modal: Checkins */}
      {showCheckins && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCheckins(null)}
        >
          <div
            className="bg-white p-6 rounded-lg shadow relative w-[32rem] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowCheckins(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-black"
            >
              ✖
            </button>
            <h3 className="text-lg font-semibold mb-4">
              เช็คอินของ {showCheckins.nickname}
            </h3>

            {checkins.length === 0 ? (
              <p className="text-gray-500">ยังไม่มีเช็คอิน</p>
            ) : (
              <ul className="divide-y">
                {checkins.map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between items-center py-2"
                  >
                    <div>
                      <span className="font-semibold">
                        {c.boothTitle || `Booth ${c.boothId}`}
                      </span>
                      <span className="text-gray-500 ml-2 text-sm">
                        {new Date(c.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteCheckin(c.id, showCheckins.uuid)}
                      className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      ลบ
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ✅ Modal: Edit Member */}
      {editMember && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setEditMember(null)}
        >
          <div
            className="bg-white p-6 rounded-lg shadow relative w-[22rem]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setEditMember(null)}
              className="absolute top-2 right-2 text-gray-400 hover:text-black"
            >
              ✖
            </button>
            <h3 className="text-lg font-semibold mb-4 text-center">
              แก้ไขข้อมูลสมาชิก
            </h3>

            <label className="block text-sm mb-1 text-gray-600">ชื่อเล่น</label>
            <input
              type="text"
              value={editMember.nickname}
              onChange={(e) =>
                setEditMember({ ...editMember, nickname: e.target.value })
              }
              className="w-full border rounded px-3 py-2 mb-3"
            />

            <label className="block text-sm mb-1 text-gray-600">โรงเรียน</label>
            <input
              type="text"
              value={editMember.school}
              onChange={(e) =>
                setEditMember({ ...editMember, school: e.target.value })
              }
              className="w-full border rounded px-3 py-2 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditMember(null)}
                className="px-4 py-2 rounded border hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={saveEditMember}
                disabled={saving}
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "⏳ กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
