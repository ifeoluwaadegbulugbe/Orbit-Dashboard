import type { MetadataRoute } from "next";

/** Lets owners install Orbit to their home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Orbit - CRM for service businesses",
    short_name: "Orbit",
    description: "Clients, bookings, invoices and reminders for your business.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#F2F1EF",
    theme_color: "#E8557A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Bookings", url: "/bookings" },
      { name: "New invoice", url: "/payments/new" },
      { name: "Clients", url: "/clients" },
    ],
  };
}
