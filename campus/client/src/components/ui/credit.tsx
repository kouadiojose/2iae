import { cn } from "@/lib/utils";

/** « Conçu et développé par José Kouadio · Markel Technology », avec le logo de Markel Technology. */
export function CreditMarkel({ sombre = false, className }: { sombre?: boolean; className?: string }) {
  const fort = sombre ? "font-semibold text-white" : "font-semibold text-encre";
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-left", className)}>
      <img src="/markel-technology.png" alt="Markel Technology" width={42} height={30} loading="lazy" decoding="async" className="h-[30px] w-auto shrink-0 rounded-[4px]" />
      <span className="leading-snug">
        Conçu et développé par
        <br />
        <strong className={fort}>José Kouadio</strong> · <strong className={fort}>Markel Technology</strong>
      </span>
    </span>
  );
}
