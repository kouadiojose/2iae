// Le bouton principal d'un écran de parcours : collé en bas sur téléphone
// (toujours sous le pouce), à sa place dans la page sur ordinateur.
import type { ReactNode } from "react";

export function PiedAction({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 w-full border-t border-ligne-douce bg-white/95 px-4 pt-3 backdrop-blur-md sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:px-0 sm:pt-8 sm:backdrop-blur-none">
      <div className="mx-auto flex w-full max-w-[520px] flex-col items-stretch gap-1 pb-[max(12px,env(safe-area-inset-bottom))] sm:max-w-none sm:pb-0">{children}</div>
    </div>
  );
}

/** Lien discret sous le bouton principal (« Plus tard », « Ce n'est pas moi »). */
export function LienDiscret({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="min-h-[44px] text-[15px] font-semibold text-texte-gris hover:text-encre">
      {children}
    </button>
  );
}
