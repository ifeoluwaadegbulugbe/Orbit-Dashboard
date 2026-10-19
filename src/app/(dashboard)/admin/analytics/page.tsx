import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Product analytics · Orbit" };

/**
 * Internal product analytics. The admin check runs here on the server
 * (and again in /api/admin/analytics); anyone else gets a plain 404.
 */
export default async function AdminAnalyticsPage() {
  if (!(await getAdminUser())) notFound();
  return <AdminAnalytics />;
}
