import type { MetadataRoute } from "next";

const SITE = "https://kareem.academy";

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
