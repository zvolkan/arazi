import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arazi Takip Sistemi",
    short_name: "Arazi Takip",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f3ee",
    theme_color: "#2f6b3a",
    lang: "tr",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
