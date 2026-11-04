import { RecurringExpenseForm } from "@/components/purchases/recurring-expense-form";

export default async function ViewRecurringExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecurringExpenseForm mode="edit" id={id} />;
}
