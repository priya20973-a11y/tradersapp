import { NewItemForm } from "@/components/items/new-item-form";

export const metadata = {
  title: "New Item | LedgerFlow",
  description: "Create a new inventory good or service item in LedgerFlow.",
};

export default function NewItemPage() {
  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6 lg:py-8 px-2 sm:px-4">
      <NewItemForm />
    </div>
  );
}
