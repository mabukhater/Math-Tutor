import type { MetadataRoute } from "next";

const SITE = "https://math-tutor-production-f83f.up.railway.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/placement", "/practice", "/children", "/vet"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
