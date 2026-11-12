import { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const name = (request.nextUrl.searchParams.get("name") || "Membership").slice(
    0,
    42,
  );
  const symbol = (request.nextUrl.searchParams.get("symbol") || "PASS").slice(
    0,
    12,
  );
  const color = sanitize(request.nextUrl.searchParams.get("color") || "1f4a3a");
  const dark = shade(color, 0.55);
  const mid = shade(color, 0.25);
  const lift = mix(color, "f6f1e7", 0.55);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="750" viewBox="0 0 1200 750">
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#${lift}"/>
      <stop offset="0.45" stop-color="#${color}"/>
      <stop offset="1" stop-color="#${dark}"/>
    </linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e4c07a"/>
      <stop offset="1" stop-color="#${mid}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="750" fill="url(#field)"/>
  <circle cx="860" cy="250" r="210" fill="url(#sun)" opacity="0.9"/>
  <circle cx="860" cy="250" r="150" fill="#f6f1e7" opacity="0.18"/>
  <path d="M180 520 C220 420 250 360 210 250 C250 340 300 390 340 300 C300 400 280 460 310 540 Z" fill="#0e2a22" opacity="0.35"/>
  <path d="M980 560 C940 470 900 410 940 300 C900 400 860 450 820 360 C860 460 900 510 860 600 Z" fill="#0e2a22" opacity="0.28"/>
  <g fill="#1b3a4b" opacity="0.85">
    <ellipse cx="150" cy="150" rx="54" ry="32" transform="rotate(-30 150 150)"/>
    <ellipse cx="210" cy="130" rx="54" ry="32" transform="rotate(30 210 130)"/>
    <circle cx="180" cy="148" r="8" fill="#f6f1e7"/>
  </g>
  <g fill="#7a4e12" opacity="0.9">
    <ellipse cx="1040" cy="120" rx="48" ry="28" transform="rotate(20 1040 120)"/>
    <ellipse cx="1100" cy="150" rx="48" ry="28" transform="rotate(-24 1100 150)"/>
    <circle cx="1072" cy="140" r="7" fill="#f6f1e7"/>
  </g>
  <rect x="470" y="250" width="260" height="260" rx="28" fill="#f6f1e7"/>
  <rect x="494" y="274" width="212" height="212" rx="16" fill="none" stroke="#${dark}" stroke-width="10"/>
  <text x="600" y="400" text-anchor="middle" fill="#${dark}" font-family="Georgia, serif" font-size="64">${escapeXml(symbol.slice(0, 4))}</text>
  <rect x="0" y="590" width="1200" height="160" fill="#14120e"/>
  <text x="64" y="650" fill="#a39888" font-family="Arial, sans-serif" font-size="18" letter-spacing="4">MEMBERSHIP</text>
  <text x="64" y="702" fill="#f6f1e7" font-family="Georgia, serif" font-size="40">${escapeXml(name)}</text>
  <text x="1136" y="702" text-anchor="end" fill="#e4c07a" font-family="Arial, sans-serif" font-size="28" letter-spacing="3">${escapeXml(symbol)}</text>
</svg>`;
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}

function sanitize(value: string) {
  const hex = value.replace("#", "").trim();
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex : "1f4a3a";
}

function shade(hex: string, amount: number) {
  const channels = [0, 2, 4].map((index) => {
    const value = Number.parseInt(hex.slice(index, index + 2), 16);
    return Math.max(0, Math.round(value * (1 - amount)))
      .toString(16)
      .padStart(2, "0");
  });
  return channels.join("");
}

function mix(hex: string, toward: string, amount: number) {
  const channels = [0, 2, 4].map((index) => {
    const from = Number.parseInt(hex.slice(index, index + 2), 16);
    const to = Number.parseInt(toward.slice(index, index + 2), 16);
    return Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, "0");
  });
  return channels.join("");
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return map[char] ?? char;
  });
}
