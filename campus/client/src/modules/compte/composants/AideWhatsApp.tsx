// « Besoin d'aide ? » avant d'être connecté : la vie scolaire de chaque
// campus sur WhatsApp, message déjà rédigé. On ne sait pas encore qui écrit,
// donc on ne révèle aucun compte : la personne choisit son campus.
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, MapPin } from "lucide-react";
import { Fenetre } from "@/components/ui/fenetre";
import { Squelette } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import type { ContactSite } from "@shared/schema";
import { lienWhatsApp, ressembleMatricule } from "../outils";

export function useContactsSites() {
  return useQuery<ContactSite[]>({ queryKey: ["/api/compte/contacts-sites"], staleTime: 5 * 60_000 });
}

function messageAide(identifiant?: string) {
  const matricule = identifiant && ressembleMatricule(identifiant) ? ` Mon matricule : ${identifiant.trim().toUpperCase()}.` : "";
  return `Bonjour, je n'arrive pas à me connecter au campus numérique 2IAE.${matricule} Pouvez-vous m'aider ?`;
}

/** Liste des cinq campus avec leur bouton WhatsApp. */
export function ListeContactsSites({ identifiant, className }: { identifiant?: string; className?: string }) {
  const { data, isLoading, isError } = useContactsSites();
  if (isLoading) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        {Array.from({ length: 5 }, (_, i) => (
          <Squelette key={i} className="h-14" />
        ))}
      </div>
    );
  }
  if (isError || !data?.length) {
    return (
      <p className={cn("rounded-2xl bg-creme px-4 py-3 text-[15px] text-texte-doux", className)}>
        Passe voir la vie scolaire de ton campus : elle peut te remettre un nouveau code tout de suite.
      </p>
    );
  }
  return (
    <ul className={cn("flex flex-col gap-2", className)}>
      {data.map((s) => (
        <li key={s.id}>
          {s.whatsapp ? (
            <a
              href={lienWhatsApp(s.whatsapp, messageAide(identifiant))}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-ligne bg-white px-4 py-3 text-encre no-underline transition-colors hover:border-[#25D366] hover:text-encre"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#25D366] text-white">
                <MessageCircle className="h-5 w-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-extrabold">{s.nomCourt}</span>
                <span className="truncate font-mono text-xs text-texte-gris">{s.nom}</span>
              </span>
              <span className="text-sm font-bold text-[#128C7E]">Écrire</span>
            </a>
          ) : (
            <div className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-dashed border-ligne px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-creme text-texte-gris">
                <MapPin className="h-5 w-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-extrabold">{s.nomCourt}</span>
                <span className="text-[13px] text-texte-gris">Passe au bureau de la vie scolaire</span>
              </span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AideWhatsApp({ ouverte, onFermer, identifiant }: { ouverte: boolean; onFermer: () => void; identifiant?: string }) {
  return (
    <Fenetre ouverte={ouverte} onFermer={onFermer} titre="Besoin d'aide ?" description="Choisis ton campus : la vie scolaire te répond sur WhatsApp.">
      <ListeContactsSites identifiant={identifiant} className="pb-3" />
    </Fenetre>
  );
}
