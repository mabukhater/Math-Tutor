import type { MetadataRoute } from "next";
import { ARTICLES } from "@/content/articles";

const SITE = "https://kareem.academy";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/how-it-works",
    "/curricula",
    "/pricing",
    "/blog",
    "/about",
    "/faq",
    "/contact",
    "/demo",
    "/privacy",
    "/terms",
    "/us",
    "/uk",
    "/singapore",
    "/login",
  ];
  const staticPages: MetadataRoute.Sitemap = routes.map((r) => ({
    url: `${SITE}${r}`,
    changeFrequency: "weekly",
    priority: r === "" ? 1 : 0.7,
  }));
  const articles: MetadataRoute.Sitemap = ARTICLES.map((a) => ({
    url: `${SITE}/blog/${a.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...staticPages, ...articles];
}
