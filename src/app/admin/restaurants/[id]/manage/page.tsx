import { redirect } from "next/navigation";

export default async function ManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/restaurants/${id}/manage/menu`);
}
