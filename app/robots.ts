import type { MetadataRoute } from "next";

// Şirket içi kullanım: arama motorlarında listelenmesin
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
