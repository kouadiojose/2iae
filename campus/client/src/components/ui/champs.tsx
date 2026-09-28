import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const BASE =
  "w-full rounded-xl border border-ligne bg-white px-4 py-3 text-[15px] text-encre placeholder:text-texte-gris outline-none transition-colors focus:border-orange focus:ring-2 focus:ring-orange/20 disabled:bg-creme disabled:text-texte-gris";

type Enveloppe = { libelle?: ReactNode; aide?: ReactNode; erreur?: ReactNode; className?: string };

function Cadre({ id, libelle, aide, erreur, className, children }: Enveloppe & { id: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {libelle && (
        <label htmlFor={id} className="text-sm font-bold text-encre">
          {libelle}
        </label>
      )}
      {children}
      {erreur ? <p className="text-[13px] font-semibold text-danger">{erreur}</p> : aide ? <p className="text-[13px] text-texte-gris">{aide}</p> : null}
    </div>
  );
}

export const Champ = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Enveloppe>(function Champ(
  { libelle, aide, erreur, className, id, ...reste },
  ref,
) {
  const auto = useId();
  const cle = id ?? auto;
  return (
    <Cadre id={cle} libelle={libelle} aide={aide} erreur={erreur} className={className}>
      <input ref={ref} id={cle} className={cn(BASE, erreur && "border-danger")} {...reste} />
    </Cadre>
  );
});

export const ZoneTexte = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Enveloppe>(function ZoneTexte(
  { libelle, aide, erreur, className, id, rows = 4, ...reste },
  ref,
) {
  const auto = useId();
  const cle = id ?? auto;
  return (
    <Cadre id={cle} libelle={libelle} aide={aide} erreur={erreur} className={className}>
      <textarea ref={ref} id={cle} rows={rows} className={cn(BASE, "resize-y leading-relaxed", erreur && "border-danger")} {...reste} />
    </Cadre>
  );
});

/** Liste déroulante native : la plus simple à utiliser sur téléphone. */
export const Selection = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Enveloppe>(function Selection(
  { libelle, aide, erreur, className, id, children, ...reste },
  ref,
) {
  const auto = useId();
  const cle = id ?? auto;
  return (
    <Cadre id={cle} libelle={libelle} aide={aide} erreur={erreur} className={className}>
      <select ref={ref} id={cle} className={cn(BASE, "appearance-none bg-[length:16px] bg-[position:right_14px_center] bg-no-repeat pr-10", erreur && "border-danger")}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23141414' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
        {...reste}
      >
        {children}
      </select>
    </Cadre>
  );
});

/** Case à cocher avec libellé cliquable. */
export function CaseACocher({
  checked,
  onChange,
  libelle,
  aide,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  libelle: ReactNode;
  aide?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3", disabled && "cursor-not-allowed opacity-60")}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 accent-[#E4793A]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold text-encre">{libelle}</span>
        {aide && <span className="text-[13px] text-texte-gris">{aide}</span>}
      </span>
    </label>
  );
}

/** Interrupteur (préférences). */
export function Interrupteur({ actif, onChange, libelle }: { actif: boolean; onChange: (v: boolean) => void; libelle?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      onClick={() => onChange(!actif)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", actif ? "bg-orange" : "bg-ligne")}
    >
      <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", actif ? "left-6" : "left-1")} />
    </button>
  );
}
