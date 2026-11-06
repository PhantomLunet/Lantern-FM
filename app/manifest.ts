import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lantern.fm — Ambient Radio for Late-Night Coders",
    short_name: "Lantern.fm",
    description:
      "A cinematic ambient radio platform for late-night coders, creatives, writers, and deep-focus builders.",
    start_url: "/",
    id: "/",
    scope: "/",
    display: "standalone",
    background_color: "#050d1a",
    theme_color: "#050d1a",
    orientation: "any",
    categories: ["music", "productivity", "lifestyle"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
