import { NewItemForm } from "@/components/items/new-item-form";

export const metadata = {
  title: "New Item | LedgerFlow",
  description: "Create a new inventory good or service item in LedgerFlow.",
};

export default function NewItemPage() {
  return (
    <div className="max-w-4xl mx-auto py-2">
      <NewItemForm />
    </div>
  );
}
