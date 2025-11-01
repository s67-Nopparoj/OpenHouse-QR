import React, { useEffect, useState } from "react";
import { useZxing } from "react-zxing";
import mqtt from "mqtt";

type Booth = { id: number; title: string };
type Checkin = {
  uuid: string;
  nickname?: string;
  booth: string;
  time: string;
  source: "camera" | "mqtt";
  highlight?: boolean;
};

export default function QrScanPage({
  onBack,
  onOpenAll,
}: {
  onBack: () => void;
  onOpenAll: () => void;
}) {
  const [tab, setTab] = useState<"camera" | "mqtt" | "table">("camera");
  const [booths, setBooths] = useState<Booth[]>([]);
  const [selectedBooth, setSelectedBooth] = useState<number | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const mqttUrl = "ws://172.23.208.1:9001";
  const apiBase = `http://${window.location.hostname}:4000`;

  // ✅ โหลด booth
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/booths`);
        const data = await res.json();
        setBooths(data);
      } catch {
        console.error("โหลด booth ล้มเหลว");
      }
    })();
  }, []);

  // ✅ โหลดเช็กอินจาก SQLite
  const loadCheckins = async () => {
    try {
      const res = await fetch(`${apiBase}/checkins`);
      const data = await res.json();
      const formatted = data.map((c: any) => ({
        uuid: c.uuid,
        nickname: c.nickname || "ไม่ระบุชื่อ",
        booth: c.boothTitle || `Booth ${c.boothId}`,
        time: new Date(c.timestamp).toLocaleString(),
        source: c.source || "camera",
      }));
      // เรียงเวลาใหม่สุดอยู่บนสุด
      setCheckins(
        formatted.sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
        )
      );
    } catch (err) {
      console.error("โหลด checkins ล้มเหลว", err);
    }
  };

  useEffect(() => {
    loadCheckins();
  }, []);

  // ✅ ฟังก์ชันเช็กอิน
  const handleCheckin = async (
    qrData: string | object,
    boothId?: number | null,
    source: "camera" | "mqtt" = "camera"
  ) => {
    const booth = boothId ?? selectedBooth;
    if (booth === null) {
      alert("⚠ กรุณาเลือกบูธก่อนสแกน");
      return;
    }

    try {
      let uuid = "";
      if (typeof qrData === "string") {
        if (qrData.startsWith("{")) uuid = JSON.parse(qrData).uuid;
        else if (qrData.includes("/uuid/"))
          uuid = qrData.split("/uuid/").pop() || "";
        else uuid = qrData;
      } else uuid = (qrData as any).uuid;
      if (!uuid) {
        console.warn("⚠️ ไม่พบ UUID ใน QR:", qrData);
        return;
      }

      if (uuid === lastScan) {
        console.warn("⚠️ สแกนซ้ำ:", uuid);
        return;
      }
      setLastScan(uuid);
      setTimeout(() => setLastScan(null), 2000);

      const res = await fetch(`${apiBase}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuid, boothId: Number(booth) }),
      });

      const data = await res.json();
      if (!data.success) {
        console.error("❌ เช็กอินล้มเหลว:", data.error);
        return;
      }

      console.log(`✅ เช็กอินสำเร็จ: ${uuid} (${source})`);

      const newEntry: Checkin = {
        uuid,
        nickname: data.user?.nickname || data.nickname || "ไม่ระบุชื่อ",
        booth: data.boothTitle || `Booth ${booth}`,
        time: new Date().toLocaleString(),
        source,
        highlight: true,
      };

      // ✅ เพิ่มรายการใหม่ขึ้นบนสุด
      setCheckins((prev) =>
        [newEntry, ...prev]
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
          .slice(0, 100)
      );

      // ✅ อัปเดต highlight
      setTimeout(
        () => setCheckins((p) => p.map((x) => ({ ...x, highlight: false }))),
        2500
      );

      // ✅ optional: sync SQLite ทีหลังเล็กน้อย
      setTimeout(loadCheckins, 1000);
    } catch (err) {
      console.error("❌ checkin error", err);
    }
  };

  // ✅ MQTT connect ทันที (ไม่ต้องรอ tab)
  useEffect(() => {
    const client = mqtt.connect(mqttUrl, {
      reconnectPeriod: 2000,
      clean: true,
    });

    client.on("connect", () => {
      console.log("✅ MQTT Connected");
      setMqttConnected(true);
      client.subscribe("openhouse/scan");
    });

    client.on("message", async (_t, payload) => {
      console.log("📩 MQTT raw payload:", payload.toString());
      try {
        const data = JSON.parse(payload.toString());
        if (data.qrCode && data.boothId) {
          await handleCheckin(data.qrCode, data.boothId, "mqtt");
        }
      } catch (err) {
        console.error("❌ MQTT payload invalid", err);
      }
    });

    client.on("close", () => setMqttConnected(false));
    return () => client.end();
  }, []);

  // ✅ กล้อง
  const { ref } = useZxing({
    onDecodeResult(result) {
      handleCheckin(result.getText(), selectedBooth, "camera");
    },
  });

  // ✅ เรียง 5 รายการล่าสุดใหม่สุดก่อน
  const latest = [...checkins]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-blue-950 text-slate-100 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          📷 ระบบสแกน QR
        </h1>
        <div className="flex gap-2">
          <button
            onClick={onOpenAll}
            className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            📋 ดูทั้งหมด
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-800 transition"
          >
            ⬅ กลับ
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        {[
          { key: "camera", label: "📱 กล้องมือถือ" },
          { key: "mqtt", label: "🤖 Raspberry Pi (MQTT)" },
          { key: "table", label: "📋 ข้อมูลสแกนทั้งหมด" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex-1 py-3 rounded-xl font-semibold border transition-all shadow-md ${
              tab === t.key
                ? "bg-blue-600 border-blue-400 text-white shadow-blue-500/30 scale-[1.02]"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Camera Tab */}
      {tab === "camera" && (
        <>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-6">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              🎪 เลือกบูธกิจกรรม
            </label>
            <select
              value={selectedBooth ?? ""}
              onChange={(e) => setSelectedBooth(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:ring-2 focus:ring-blue-400 outline-none"
            >
              <option value="">-- เลือกบูธ --</option>
              {booths.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center mb-8">
            <div className="rounded-2xl overflow-hidden border-4 border-blue-500 shadow-lg animate-[pulse_2s_infinite]">
              <video ref={ref} className="w-80 h-80 object-cover bg-black" />
            </div>
          </div>
        </>
      )}

      {/* MQTT Tab */}
      {tab === "mqtt" && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-bold text-blue-400 mb-3">
            🔌 สถานะ MQTT:{" "}
            {mqttConnected ? (
              <span className="text-green-400">🟢 Connected</span>
            ) : (
              <span className="text-red-400">🔴 Disconnected</span>
            )}
          </h2>
          <p className="text-slate-400 text-sm">
            ระบบกำลังรอข้อมูลจาก Raspberry Pi ผ่าน MQTT topic:{" "}
            <span className="text-blue-400 font-mono">openhouse/scan</span>
          </p>
        </div>
      )}

      {/* Table Tab */}
      {tab === "table" && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-lg p-5">
          <h2 className="text-lg font-bold text-blue-400 mb-3">
            📋 ข้อมูลสแกนทั้งหมด ({checkins.length} รายการ)
          </h2>
          <div className="grid grid-cols-5 text-sm font-semibold border-b border-slate-600 pb-2 mb-2 text-slate-300">
            <div>UUID</div>
            <div>ชื่อเล่น</div>
            <div>บูธ</div>
            <div>เวลา</div>
            <div className="text-right">แหล่งที่มา</div>
          </div>
          {checkins.length === 0 ? (
            <p className="text-slate-500 text-center py-6">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="overflow-y-auto max-h-[60vh]">
              {checkins.map((c, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-5 py-2 px-1 text-sm border-b border-slate-700 ${
                    i % 2 === 0 ? "bg-slate-900/30" : ""
                  }`}
                >
                  <div className="font-mono">{c.uuid.slice(0, 8)}</div>
                  <div>{c.nickname}</div>
                  <div className="text-slate-300">{c.booth}</div>
                  <div className="text-slate-400 text-xs">{c.time}</div>
                  <div className="text-right">
                    {c.source === "camera" ? (
                      <span className="text-blue-400">📱 กล้อง</span>
                    ) : (
                      <span className="text-green-400">🤖 MQTT</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ✅ 5 รายการล่าสุด */}
      {tab !== "table" && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-lg p-5 mt-6">
          <h2 className="text-lg font-bold text-blue-400 mb-3">
            ✅ 5 รายการล่าสุด
          </h2>
          {latest.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">
              ยังไม่มีการเช็กอิน
            </p>
          ) : (
            <div className="space-y-2">
              {latest.map((c, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg transition ${
                    c.highlight
                      ? "bg-green-600/30 border border-green-400"
                      : "bg-slate-900/40"
                  }`}
                >
                  <div className="flex justify-between text-sm">
                    <div>
                      <span className="font-mono text-white">
                        {c.uuid.slice(0, 8)}
                      </span>{" "}
                      <span className="text-slate-400">({c.nickname})</span>
                    </div>
                    <div className="text-xs text-slate-400">{c.time}</div>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    📍 {c.booth} —{" "}
                    {c.source === "camera" ? "📱 กล้อง" : "🤖 MQTT"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
