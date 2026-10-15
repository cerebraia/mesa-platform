"use client";

import { useFormStatus } from "react-dom";
import { signOut } from "@/app/login/actions";

function ButtonInner() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="button secondary small">
      {pending ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <ButtonInner />
    </form>
  );
}
