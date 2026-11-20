import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db";
import { PurchaseOrder } from "@/models";
import { PurchaseOrderForm } from "@/components/purchases/purchase-order-form";
import { defaultDemoPurchaseOrders } from "@/app/api/purchases/purchase-orders/route";

export const metadata = {
  title: "Purchase Order Details | LedgerFlow",
  description: "View, edit, and track purchase order fulfillment in LedgerFlow.",
};

export default async function PurchaseOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; print?: string }>;
}) {
  const { id } = await params;
  const { mode: requestedMode, print: printParam } = await searchParams;

  await connectToDatabase().catch(() => null);

  let poDoc = await PurchaseOrder.findById(id).lean().catch(() => null);
  if (!poDoc) {
    poDoc = await PurchaseOrder.findOne({ purchaseOrderNumber: id }).lean().catch(() => null);
  }

  let poData: Record<string, unknown> | null = null;

  if (poDoc) {
    // Convert Mongoose lean document with BSON ObjectIds & Dates to a serializable plain object
    const plainDoc = JSON.parse(JSON.stringify(poDoc)) as Record<string, unknown>;
    poData = {
      ...plainDoc,
      id: String(plainDoc._id || plainDoc.purchaseOrderNumber || id),
      _id: String(plainDoc._id || plainDoc.purchaseOrderNumber || id),
      organizationId: plainDoc.organizationId ? String(plainDoc.organizationId) : "",
    };
  } else {
    // Demo fallback check
    const demo = defaultDemoPurchaseOrders.find(
      (p) => p.id === id || p._id === id || p.purchaseOrderNumber === id,
    );
    if (demo) {
      poData = JSON.parse(JSON.stringify(demo)) as Record<string, unknown>;
    }
  }

  if (!poData) {
    notFound();
  }

  const activeMode = requestedMode === "edit" ? "edit" : "view";

  return (
    <Suspense
      fallback={
        <div className="min-h-96 flex items-center justify-center p-8 text-sm text-slate-500">
          Loading purchase order details…
        </div>
      }
    >
      <PurchaseOrderForm
        initialData={poData}
        mode={activeMode}
        purchaseOrderId={id}
        isPrintView={Boolean(printParam)}
      />
    </Suspense>
  );
}
