import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Astute Academy — math & reading",
    short_name: "Astute",
    description: "Curriculum-aligned math and reading practice for kids, grades 1–8.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f3faf7",
    theme_color: "#1d9e75",
    categories: ["education", "kids"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
