import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="max-w-md">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-4xl font-black text-foreground">This page is off the training floor.</h1>
        <p className="mt-4 text-muted-foreground">Return to Apex or book a free trial with the team.</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/" variant="primary">Home</ButtonLink>
          <ButtonLink href="/free-trial" variant="accent">Book Free Trial</ButtonLink>
        </div>
      </div>
    </main>
  );
}

