export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

export function getStatusColor(status?: string) {
  const s = String(status || "").toLowerCase();
  if (s === "full" || s === "เต็ม") return "bg-rose-100 text-rose-700 border-rose-200";
  if (s === "filling fast" || s === "ใกล้เต็ม") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

export function makeQrSvg(text = "") {
  const safe = String(text).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'>
    <rect x='0' y='0' width='200' height='200' fill='black'/>
    <rect x='18' y='18' width='164' height='164' fill='white'/>
    <rect x='32' y='32' width='40' height='40' fill='black'/>
    <rect x='128' y='32' width='40' height='40' fill='black'/>
    <rect x='32' y='128' width='40' height='40' fill='black'/>
    <text x='100' y='110' text-anchor='middle' font-size='10' fill='black'>${safe.slice(0,18)}</text>
  </svg>`;
}
