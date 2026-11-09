// Tarayıcıda fotoğrafı küçültüp JPEG'e çevirir (telefon fotoğrafları 3–5 MB → ~200 KB)

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Fotoğraf okunamadı"));
    };
    img.src = url; // tarayıcı EXIF yönünü kendisi uygular
  });
}

function toJpeg(img: HTMLImageElement, maxSide: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve({ blob: b, w, h }) : reject(new Error("Dönüştürülemedi"))), "image/jpeg", quality)
  );
}

export async function compressPhoto(file: File) {
  const img = await loadImage(file);
  const full = await toJpeg(img, 1600, 0.78);
  const thumb = await toJpeg(img, 360, 0.7);
  return { full: full.blob, thumb: thumb.blob, width: full.w, height: full.h };
}
