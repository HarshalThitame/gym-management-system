"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function WhiteLabelError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="p-8 max-w-md text-center space-y-4">
        <AlertTriangle className="h-12 w-12 mx-auto text-red-500" />
        <h2 className="text-xl font-bold">White Label Error</h2>
        <p className="text-sm text-muted-foreground">{error.message || "Failed to load branding data."}</p>
        <Button onClick={reset} variant="secondary">Retry</Button>
      </Card>
    </div>
  );
}
