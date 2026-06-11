"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type AuthSubmitButtonProps = {
  children: string;
};

export function AuthSubmitButton({ children }: AuthSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <Button className="w-full" disabled={pending || !isHydrated} size="lg" type="submit" variant="accent">
      {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {pending ? "Processing" : children}
    </Button>
  );
}
