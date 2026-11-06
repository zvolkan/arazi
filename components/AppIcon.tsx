// Ana ekran ikonu: yeşil zemin üzerinde basit tarla sıraları + konum işareti
export function AppIcon({ size }: { size: number }) {
  const s = size / 512;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#2f6b3a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={360 * s} height={360 * s} viewBox="0 0 360 360">
        <path d="M30 250 Q180 190 330 250" stroke="#cfe3c8" strokeWidth="22" fill="none" strokeLinecap="round" />
        <path d="M30 300 Q180 240 330 300" stroke="#cfe3c8" strokeWidth="22" fill="none" strokeLinecap="round" />
        <path d="M180 40 C125 40 95 80 95 120 C95 175 180 225 180 225 C180 225 265 175 265 120 C265 80 235 40 180 40 Z" fill="#ffffff" />
        <circle cx="180" cy="120" r="32" fill="#2f6b3a" />
      </svg>
    </div>
  );
}
