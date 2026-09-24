import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Fenêtre modale. Sur téléphone elle monte du bas de l'écran (feuille),
 * sur ordinateur elle s'affiche au centre.
 */
export function Fenetre({
  ouverte,
  onFermer,
  titre,
  description,
  children,
  pied,
  large,
}: {
  ouverte: boolean;
  onFermer: () => void;
  titre: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  pied?: ReactNode;
  large?: boolean;
}) {
  return (
    <Dialog.Root open={ouverte} onOpenChange={(o) => !o && onFermer()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-encre/50 backdrop-blur-[2px] animate-apparait" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[92dvh] w-full flex-col bg-white shadow-2xl animate-monte focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-[28px] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]",
            large ? "sm:max-w-3xl" : "sm:max-w-lg",
          )}
        >
          <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <div>
              <Dialog.Title className="text-2xl font-black tracking-serre">{titre}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[15px] text-texte-pale">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof titre === "string" ? titre : "Fenêtre"}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="rounded-full p-2 text-texte-pale hover:bg-creme hover:text-encre" aria-label="Fermer">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-6 py-3">{children}</div>
          {pied && <div className="bas-sur flex flex-wrap justify-end gap-3 border-t border-ligne-douce px-6 py-4">{pied}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
