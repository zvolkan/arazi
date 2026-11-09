import Link from "next/link";

// İnternet yokken daha önce açılmamış bir sayfaya gidilirse gösterilir (service worker önbelleğe alır)
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="empty" style={{ marginTop: 24 }}>
      <p style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>📴 İnternet yok</p>
      <p style={{ margin: "0 0 16px" }}>
        Bu sayfa daha önce açılmadığı için şu an gösterilemiyor. Ana listedeki tarlalar ve reçete ekranları
        internetsiz de açılır.
      </p>
      <Link href="/" className="btn btn-primary">Listeye dön</Link>
    </div>
  );
}
