import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Little Moments Photo Booth",
    short_name: "Little Moments",
    description: "Your pocket photo booth. Four photos, one little keepsake.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1c211c",
    theme_color: "#1c211c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
