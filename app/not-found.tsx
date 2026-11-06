import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty">
      <p style={{ marginTop: 0 }}>Kayıt bulunamadı.</p>
      <Link href="/" className="btn">Listeye dön</Link>
    </div>
  );
}
