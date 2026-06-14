"use client";

import { LogOut, AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type SignOutButtonProps = { compact?: boolean };

export function SignOutButton({ compact = false }: SignOutButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSignOut = () => {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PRIVATE_CACHES" });
    const form = document.getElementById(compact ? "sign-out-form-desktop" : "sign-out-form-mobile") as HTMLFormElement | null;
    if (form) form.requestSubmit();
    setShowConfirm(false);
  };

  return (
    <>
      {compact ? (
        <Button aria-label="Sign out" onClick={() => setShowConfirm(true)} size="icon" type="button" variant="secondary">
          <LogOut aria-hidden="true" className="size-4" />
        </Button>
      ) : (
        <Button className="w-full justify-start" onClick={() => setShowConfirm(true)} type="button" variant="ghost">
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </Button>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowConfirm(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-red-50">
                  <LogOut className="size-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black">Sign out</h3>
                  <p className="text-sm text-muted-foreground">Are you sure you want to sign out?</p>
                </div>
              </div>
              <button onClick={() => setShowConfirm(false)} className="rounded-md p-1 hover:bg-accent/10" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>Any unsaved changes will be lost. You will need to sign in again to access the platform.</span>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-accent/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
