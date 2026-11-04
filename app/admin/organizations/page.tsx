import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AdminOrganizations } from "@/components/admin/admin-organizations";
import { authOptions } from "@/lib/auth";

export default function AdminOrganizationsPage() {
  return (
    <Suspense fallback={<main className="p-8 text-sm text-slate-500">Loading organization administration…</main>}>
      <AdminOrganizationsContent />
    </Suspense>
  );
}

async function AdminOrganizationsContent() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.id !== "admin" && session.user.role !== "Super Admin")) {
    redirect("/");
  }
  return <AdminOrganizations />;
}
