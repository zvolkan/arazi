"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="empty">
      <p style={{ fontWeight: 600, color: "var(--text)", marginTop: 0 }}>Bir sorun oluştu.</p>
      <p>İnternet bağlantısını kontrol edip tekrar deneyin. Sorun sürerse veritabanı ayarlarına bakılmalı.</p>
      <button className="btn btn-primary" onClick={() => reset()}>Tekrar dene</button>
    </div>
  );
}
