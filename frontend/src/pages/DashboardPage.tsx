// src/pages/DashboardPage.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion } from "framer-motion";

type Booth = {
  id: number;
  title: string;
  attendees: number;
};

type Checkin = {
  id: number;
  nickname: string;
  booth: string;
  time: string;
};

export default function DashboardPage({ onBack }: { onBack: () => void }) {
  const [booths, setBooths] = useState<Booth[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [usersCount, setUsersCount] = useState<number>(0);
  const [lastCheckins, setLastCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const apiBase = `http://${window.location.hostname}:4000`;

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString("th-TH");
    setLogs((prev) => [...prev.slice(-19), `[${time}] ${msg}`]);
  };

  // โหลดข้อมูลจาก SQLite
  const loadData = async () => {
    addLog("กำลังโหลดข้อมูลจาก SQLite...");
    setLoading(true);
    try {
      const [boothRes, checkinRes, userRes] = await Promise.all([
        fetch(`${apiBase}/booths`),
        fetch(`${apiBase}/checkins`),
        fetch(`${apiBase}/users`),
      ]);

      const boothData = await boothRes.json();
      const checkinData = await checkinRes.json();
      const userData = await userRes.json();

      setBooths(boothData);
      setCheckins(checkinData);
      setUsersCount(userData.length);

      const sorted = [...checkinData].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      setLastCheckins(sorted.slice(0, 5));

      addLog(`โหลดข้อมูลสำเร็จ ✅ Users: ${userData.length}, Checkins: ${checkinData.length}`);
    } catch (err) {
      console.error("โหลดข้อมูลล้มเหลว:", err);
      addLog("❌ โหลดข้อมูลล้มเหลว (ตรวจสอบ backend)");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const totalCheckins = checkins.length;
  const totalUsers = usersCount || 1;
  const checkinRate = Math.round((totalCheckins / totalUsers) * 100);
  const COLORS = ["#00C49F", "#FF4444"];

  const pieData = [
    { name: "เช็คอินแล้ว", value: checkinRate },
    { name: "ยังไม่เช็คอิน", value: 100 - checkinRate },
  ];

  const mostVisited = booths.sort((a, b) => b.attendees - a.attendees)[0];

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      addLog("เข้าสู่โหมด Full Screen");
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
      addLog("ออกจากโหมด Full Screen");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1221] text-white text-xl">
        ⏳ กำลังโหลดข้อมูล...
      </div>
    );

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0b1221] text-white flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-cyan-800">
        <h1 className="text-2xl font-bold text-cyan-400">📊 Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={toggleFullscreen}
            className="bg-cyan-700 hover:bg-cyan-600 px-4 py-2 rounded-lg text-sm"
          >
            {isFullscreen ? "🗗 Exit Fullscreen" : "🗖 Fullscreen"}
          </button>
          <button
            onClick={onBack}
            className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm"
          >
            ⬅ กลับหน้า Admin
          </button>
        </div>
      </div>

      {/* Main Dashboard Area */}
      <div className="flex-1 grid grid-cols-3 gap-4 p-4">
        {/* Summary Cards */}
        <div className="col-span-1 flex flex-col gap-4">
          <motion.div className="bg-[#16213e] p-4 rounded-xl text-center flex-1">
            <h2 className="text-sm text-gray-300">ผู้ลงทะเบียนทั้งหมด</h2>
            <p className="text-3xl font-bold text-cyan-400 mt-1">
              {usersCount.toLocaleString()}
            </p>
          </motion.div>

          <motion.div className="bg-[#16213e] p-4 rounded-xl text-center flex-1">
            <h2 className="text-sm text-gray-300">เช็คอินทั้งหมด</h2>
            <p className="text-3xl font-bold text-green-400 mt-1">
              {totalCheckins.toLocaleString()}
            </p>
          </motion.div>

          <motion.div className="bg-[#16213e] p-4 rounded-xl text-center flex-1">
            <h2 className="text-sm text-gray-300">บูธยอดนิยม</h2>
            <p className="text-lg font-semibold text-yellow-400 mt-1">
              {mostVisited?.title || "-"}
            </p>
            <p className="text-xs text-gray-400">
              👥 {mostVisited?.attendees || 0} คน
            </p>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="col-span-2 grid grid-rows-2 gap-4">
          {/* Bar Chart */}
          <motion.div className="bg-[#16213e] rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-2 text-cyan-300">
              จำนวนเช็คอินในแต่ละบูธ
            </h3>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={booths}>
                <XAxis dataKey="title" stroke="#aaa" />
                <YAxis stroke="#aaa" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "none",
                    color: "#fff",
                  }}
                />
                <Bar dataKey="attendees" fill="#00C49F" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Donut Chart */}
          <motion.div className="bg-[#16213e] rounded-xl p-4 flex flex-col items-center justify-center">
            <h3 className="text-sm font-semibold mb-2 text-cyan-300">
              อัตราการเช็คอิน
            </h3>
            <PieChart width={200} height={200}>
              <Pie
                data={pieData}
                cx={100}
                cy={100}
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
            <p className="text-2xl font-bold text-green-400 mt-2">
              {checkinRate}%
            </p>
            <p className="text-xs text-gray-400">ของผู้ลงทะเบียนทั้งหมด</p>
          </motion.div>
        </div>
      </div>

      {/* Console Log */}
      <div
        ref={logRef}
        className="bg-black text-green-400 text-xs font-mono p-2 h-32 overflow-y-auto border-t border-green-800"
      >
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
    </div>
  );
}
