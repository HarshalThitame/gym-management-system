"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type SignOutButtonProps = {
  compact?: boolean;
};

export function SignOutButton({ compact = false }: SignOutButtonProps) {
  const clearPrivateCaches = () => {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHES" });
  };

  if (compact) {
    return (
      <Button aria-label="Sign out" onClick={clearPrivateCaches} size="icon" type="submit" variant="secondary">
        <LogOut aria-hidden="true" className="size-4" />
      </Button>
    );
  }

  return (
    <Button className="w-full justify-start" onClick={clearPrivateCaches} type="submit" variant="ghost">
      <LogOut aria-hidden="true" className="size-4" />
      Sign out
    </Button>
  );
}
