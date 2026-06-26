import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://astute.academy";

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
