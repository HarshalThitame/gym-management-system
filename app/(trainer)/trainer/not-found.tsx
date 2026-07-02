import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="rounded-full bg-amber-100 p-4 dark:bg-amber-900/50">
        <FileQuestion className="size-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h1 className="text-2xl font-black">Page not found</h1>
      <p className="max-w-md text-sm text-muted-foreground">The trainer page you are looking for does not exist or has been moved.</p>
      <Button asChild variant="primary"><Link href="/trainer">Back to Dashboard</Link></Button>
    </div>
  );
}
