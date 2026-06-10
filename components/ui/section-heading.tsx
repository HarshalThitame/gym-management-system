import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  body?: string;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({ eyebrow, title, body, align = "left", className }: SectionHeadingProps) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p> : null}
      <h2 className="text-balance text-3xl font-black leading-tight text-foreground md:text-5xl">{title}</h2>
      {body ? <p className="mt-4 text-pretty text-base leading-7 text-muted-foreground md:text-lg">{body}</p> : null}
    </div>
  );
}

