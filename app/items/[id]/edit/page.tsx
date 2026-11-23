import { NewItemForm } from "@/components/items/new-item-form";

export const metadata = {
  title: "Edit Item | LedgerFlow",
  description: "Edit inventory item details.",
};

export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-6 lg:py-8 px-2 sm:px-4">
      <NewItemForm mode="edit" itemId={id} />
    </div>
  );
}
