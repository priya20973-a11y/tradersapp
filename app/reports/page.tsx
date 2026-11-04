import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CustomReportsView } from "@/components/reports/custom/custom-reports-view";

export const metadata = {
  title: "Custom Reports & Analytics | Trader App",
  description: "Build custom cross-module reports, pick columns, filter data, and export to Excel, CSV, or PDF.",
};

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <CustomReportsView initialTab="saved" />
    </Suspense>
  );
}
