"use client";

import { useEffect, useRef } from "react";
import { signOutAction } from "@/features/auth/actions/auth-actions";

export default function NoRolePage() {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => formRef.current?.requestSubmit(), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <form ref={formRef} action={signOutAction}>
        <p className="text-sm text-muted-foreground">Signing out...</p>
      </form>
    </main>
  );
}
