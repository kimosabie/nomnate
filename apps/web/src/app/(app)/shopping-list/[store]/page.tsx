import { redirect } from "next/navigation";

export default async function StoreShoppingListPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store } = await params;
  redirect(`/shopping-list?store=${store}`);
}
