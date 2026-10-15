import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();

  // Server-side auth check — validates JWT with GoTrue, not just local storage.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <>{children}</>;
}
