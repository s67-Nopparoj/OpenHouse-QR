import React, { useEffect, useState } from "react";
import { ContactButton } from "../components/ContactButton";
import BoothDetailModal from "../components/BoothDetailModal";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/autoplay";
import { Autoplay } from "swiper/modules";

type Booth = {
  id: number;
  title: string;
  image: string;
  attendees: number;
  description?: string;
  location?: string;
};

type User = {
  id: number;
  uuid: string;
  nickname: string;
  school?: string;
  createdAt?: number;
};

export default function HomePage({
  onLogin,
  onAdmin,
  onScan,
}: {
  onLogin: () => void;
  onAdmin?: () => void;
  onScan?: () => void;
}) {
  const [booths, setBooths] = useState<Booth[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [viewBooth, setViewBooth] = useState<Booth | null>(null);
  const [loading, setLoading] = useState(true);

  const [eventConfig, setEventConfig] = useState({
    eventName: "ENG Open House 2025",
    subtitle: "QR-based Check-in System",
    dateText: "Nov 07–08, 2025",
    locationText: "Faculty of Engineering, KMUTNB",
    logoUrl: "https://placehold.co/120x120?text=LOGO",
    bannerUrls: [] as string[],
  });

  const apiBase = `http://${window.location.hostname}:4000`;

  useEffect(() => {
    const loadAll = async () => {
      try {
        const cfgRes = await fetch(`${apiBase}/event-config`);
        const boothRes = await fetch(`${apiBase}/booths`);
        const userRes = await fetch(`${apiBase}/users`);

        const cfg = await cfgRes.json();
        const boothData = await boothRes.json();
        const userData = await userRes.json();

        setBooths(boothData);
        setUsers(userData);

        let banners: string[] = [];
        try {
          banners =
            typeof cfg.bannerUrls === "string"
              ? JSON.parse(cfg.bannerUrls)
              : cfg.bannerUrls || [];
        } catch {
          banners = [];
        }

        setEventConfig({
          eventName: cfg.eventName || "ENG Open House 2025",
          subtitle: cfg.subtitle || "QR-based Check-in System",
          dateText: cfg.dateText || "Nov 07–08, 2025",
          locationText:
            cfg.locationText || "Faculty of Engineering, KMUTNB",
          logoUrl: cfg.logoUrl || "https://placehold.co/120x120?text=LOGO",
          bannerUrls: banners,
        });
      } catch (err) {
        console.warn("⚠️ โหลดข้อมูลไม่สำเร็จ:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const stats = {
    registered: users.length,
    booths: booths.length,
  };

  const sortedBooths = [...booths].sort((a, b) => b.attendees - a.attendees);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-blue-50 text-slate-600 text-sm">
        <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full mb-3" />
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-slate-100 text-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-indigo-600 text-white shadow-md py-3 px-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img
            src={eventConfig.logoUrl}
            alt="logo"
            className="w-10 h-10 rounded-xl bg-white/20 p-1 object-cover"
          />
          <div>
            <h1 className="font-bold text-base sm:text-lg leading-tight">
              {eventConfig.eventName}
            </h1>
            <p className="text-xs opacity-80">{eventConfig.subtitle}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onLogin}
            className="px-4 py-2 rounded-lg bg-white text-blue-700 font-semibold shadow-sm hover:bg-slate-100 transition"
          >
            เข้าสู่ระบบ
          </button>
          {onAdmin && (
            <button
              onClick={onAdmin}
              className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 shadow-sm transition"
            >
              ผู้ดูแล
            </button>
          )}
          {onScan && (
            <button
              onClick={onScan}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm transition"
            >
              สแกน QR
            </button>
          )}
        </div>
      </header>

      {/* Banner Carousel */}
      <section className="relative w-full border-b border-slate-200">
        <Swiper
          modules={[Autoplay]}
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          loop
          slidesPerView={1}
          className="w-full h-[220px] sm:h-[320px]"
        >
          {(eventConfig.bannerUrls.length
            ? eventConfig.bannerUrls.map((url, i) => ({ id: i + 1, imageUrl: url }))
            : [{ id: 0, imageUrl: "https://placehold.co/1200x400?text=Event+Banner" }]
          ).map((b) => (
            <SwiperSlide key={b.id}>
              <img
                src={b.imageUrl}
                alt="Banner"
                className="w-full h-full object-cover"
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </section>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-10">
        {/* Event Info */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-center relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-2xl" />
          <div className="grid sm:grid-cols-3 gap-4 mt-5">
            <div className="bg-slate-50 rounded-xl p-4 shadow-inner border">
              📅 <span className="font-semibold">{eventConfig.dateText}</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 shadow-inner border">
              📍 <span className="font-semibold">{eventConfig.locationText}</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 shadow-inner border">
              👥 <span className="font-semibold">{stats.registered}</span> ผู้ลงทะเบียน •{" "}
              <span className="font-semibold">{stats.booths}</span> บูธ
            </div>
          </div>
        </section>

        {/* Booth Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2 border-l-4 border-blue-600 pl-2">
              บูทกิจกรรมทั้งหมด
            </h3>
          </div>

          {booths.length === 0 ? (
            <p className="text-slate-500 text-sm">ยังไม่มีข้อมูลบูธในระบบ</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sortedBooths.map((b, i) => (
                <div
                  key={b.id}
                  className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md overflow-hidden transition transform hover:-translate-y-1 group"
                >
                  <div className="relative">
                    <img
                      src={b.image || "https://placehold.co/400x200?text=No+Image"}
                      alt={b.title}
                      className="h-40 w-full object-cover group-hover:scale-[1.03] transition-transform"
                    />
                    {i < 3 && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full shadow">
                        TOP {i + 1}
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent text-white p-2 text-sm font-medium">
                      {b.title}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-slate-500 mb-2">
                     มีผู้เข้าร่วม : {b.attendees} คน
                    </p>
                    <button
                      onClick={() => setViewBooth(b)}
                      className="w-full py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[.98] transition"
                    >
                    ดูรายละเอียด
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="text-center text-xs text-slate-500 py-4 border-t bg-white/50">
        OpenHouse QR System © 2025 — Software Development Group 2
      </footer>

      <ContactButton />
      <BoothDetailModal booth={viewBooth} onClose={() => setViewBooth(null)} />
    </div>
  );
}
