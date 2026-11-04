import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AdminBuyingRequests } from "@/components/admin/admin-buying-requests";
import { authOptions } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buying Requests Approval | Admin | LedgerFlow",
  description: "Review and approve buying requests submitted by users across all organizations.",
};

export default function AdminBuyingRequestsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-500">Loading buying requests administration…</main>}>
      <AdminBuyingRequestsContent />
    </Suspense>
  );
}

async function AdminBuyingRequestsContent() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.id !== "admin" && session.user.role !== "Super Admin")) {
    redirect("/");
  }
  return <AdminBuyingRequests />;
}

