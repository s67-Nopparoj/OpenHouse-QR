import React from "react";

const CONTACT_URL = "https://lin.ee/zcktH0G";

export function ContactButton({
  href = CONTACT_URL,
  label = "ติดต่อแอดมิน",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed z-50 bottom-5 right-4 flex items-center gap-2 select-none"
      aria-label={label}
    >
      <span className="hidden sm:inline-block bg-slate-700 text-white text-[12px] font-semibold px-3 py-1 rounded-lg shadow-md">
        {label}
      </span>
      <span className="h-12 w-12 rounded-full bg-emerald-600 shadow-lg grid place-items-center active:scale-95 transition">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 10h6M7 14h10M5 19l2.5-2.5H17a4 4 0 004-4V8a4 4 0 00-4-4H7a4 4 0 00-4 4v4a4 4 0 004 4"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </a>
  );
}
