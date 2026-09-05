import type { MetadataRoute } from "next";
import { BRAND } from "@/app/lib/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.appName,
    short_name: BRAND.appName,
    description: BRAND.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
