// « Besoin d'aide ? » avant d'être connecté : la vie scolaire de chaque
// campus sur WhatsApp, message déjà rédigé. On ne sait pas encore qui écrit,
// donc on ne révèle aucun compte : la personne choisit son campus.
// Dessous, les deux manuels illustrés (PDF publics) : on ne sait pas qui lit,
// la personne choisit le sien.
import { useQuery } from "@tanstack/react-query";
import { BookImage, MessageCircle, MapPin } from "lucide-react";
import { Fenetre } from "@/components/ui/fenetre";
import { Squelette } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import type { ContactSite } from "@shared/schema";
import { lienWhatsApp, ressembleMatricule } from "../outils";
import { useTextes } from "@/lib/textes";
import { MANUELS } from "@/modules/manuels/manuels";
import { t } from "@shared/textes/manuels";

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
        La vie scolaire de chaque campus peut remettre un nouveau code tout de suite.
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
    <Fenetre ouverte={ouverte} onFermer={onFermer} titre="Besoin d'aide ?" description="Choisir son campus : la vie scolaire répond sur WhatsApp.">
      <ListeContactsSites identifiant={identifiant} />
      <LiensManuels />
    </Fenetre>
  );
}

/** Les deux manuels illustrés (PDF publics, lisibles sans compte) : se connecter, la première fois, le code oublié. */
function LiensManuels() {
  const tx = useTextes(t);
  const manuels = [
    { ...MANUELS.etudiants, libelle: tx("aide.etudiants") },
    { ...MANUELS.formateurs, libelle: tx("aide.formateurs") },
  ];
  return (
    <section aria-labelledby="titre-aide-manuels" className="mt-4 flex flex-col gap-2 border-t border-ligne pb-3 pt-4">
      <h3 id="titre-aide-manuels" className="text-[15px] font-extrabold">
        {tx("aide.titre")}
      </h3>
      <p className="text-sm leading-snug text-texte-pale">{tx("aide.texte")}</p>
      <ul className="grid grid-cols-2 gap-2">
        {manuels.map((m) => (
          <li key={m.id}>
            <a
              href={m.pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[56px] items-center gap-2.5 rounded-2xl border border-ligne bg-white px-3 py-2 text-encre no-underline transition-colors hover:border-orange hover:text-encre"
            >
              <BookImage className="h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-bold leading-snug">{m.libelle}</span>
                <span className="font-mono text-[11px] text-texte-gris">{tx("aide.infos", { v: { poids: m.poids } })}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
