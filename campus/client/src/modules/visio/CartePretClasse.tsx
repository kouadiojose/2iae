// Carte « Prêt pour votre prochaine classe » (accueil formateur /enseigner) :
// compte à rebours dans le fuseau du formateur, et quatre cases calculées
// (essai de la visio réussi récemment, fuseau confirmé, diapos déposées,
// plan minuté), chacune avec le lien direct vers l'action qui manque.
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CheckCircle2, CircleAlert, ChevronRight, FlaskConical, Globe, Images, ListOrdered, Video } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { heure, relatif, fuseauNavigateur, villeFuseau, jourLongDans, FUSEAU_ABIDJAN } from "@/lib/dates";
import { useMaintenant, DecompteCourt } from "@/components/ui/compte-a-rebours";
import { BarreProgression } from "@/components/ui/divers";
import { LienBouton } from "@/components/ui/bouton";
import type { PretClasseDto } from "@shared/schema";

const JOUR = 86_400_000;
/** Un essai de visio compte pendant 7 jours (le réseau, l'ordinateur ou le navigateur changent). */
const VALIDITE_ESSAI = 7 * JOUR;

type Case = { cle: string; ok: boolean; titre: string; detail: string; lien: string; action: string; icone: typeof Video; surAction?: () => void };

export function CartePretClasse({ className }: { className?: string }) {
  const moi = useMoiConnecte();
  const maintenant = useMaintenant(30_000);
  const { data } = useQuery<PretClasseDto>({ queryKey: ["/api/visio/pret"], refetchInterval: 5 * 60_000 });
  if (!data?.seance) return null;
  const s = data.seance;
  const fuseau = moi.fuseau ?? fuseauNavigateur() ?? FUSEAU_ABIDJAN;
  const chezVous = fuseau !== FUSEAU_ABIDJAN;
  const debut = new Date(s.debut).getTime();
  const enDirect = s.statut === "en_direct";
  const jour = jourLongDans(s.debut, fuseau);

  const essai = data.essai;
  const essaiRecent = Boolean(essai?.reussi && maintenant - new Date(essai.le).getTime() < VALIDITE_ESSAI);
  const devine = fuseauNavigateur();
  const cases: Case[] = [
    {
      cle: "essai",
      ok: essaiRecent,
      icone: Video,
      titre: "Essai de la visio",
      detail: essaiRecent
        ? `Réussi ${relatif(essai!.le, maintenant)}${essai!.salle ? " dans la salle d'essai" : ""}.`
        : essai && !essai.reussi
          ? `Dernier essai ${relatif(essai.le, maintenant)} : la visio n'est pas passée.`
          : essai
            ? `Dernier essai réussi ${relatif(essai.le, maintenant)} : refaites-le avant le cours.`
            : "Vérifiez votre réseau et entrez dans la salle d'essai.",
      lien: "/visio/essai#salle-essai",
      action: essaiRecent ? "Refaire" : "Tester",
    },
    {
      cle: "fuseau",
      ok: Boolean(data.fuseau),
      icone: Globe,
      titre: "Fuseau horaire",
      detail: data.fuseau
        ? data.fuseau === FUSEAU_ABIDJAN
          ? "Abidjan : les horaires sont à votre heure."
          : `${villeFuseau(data.fuseau)} : ${heure(s.debut, data.fuseau)} chez vous pour ${heure(s.debut)} à Abidjan.`
        : devine
          ? `À confirmer : votre navigateur indique ${villeFuseau(devine)}.`
          : "À choisir dans votre profil.",
      lien: "/profil#fuseau",
      action: data.fuseau ? "Changer" : "Choisir",
    },
    {
      cle: "diapos",
      ok: s.diapos > 0,
      icone: Images,
      titre: "Diapos",
      detail: s.diapos > 0 ? `${s.diapos} diapo${s.diapos > 1 ? "s" : ""} déposée${s.diapos > 1 ? "s" : ""}.` : "Aucune diapo : déposez votre PDF, les étudiants à la radio les suivront.",
      lien: `/enseigner/seances/${s.id}`,
      action: s.diapos > 0 ? "Voir" : "Déposer",
    },
    {
      cle: "plan",
      ok: s.planMinute,
      icone: ListOrdered,
      titre: "Plan minuté",
      detail: s.planMinute
        ? `${s.etapes} étape${s.etapes > 1 ? "s" : ""} · ${s.minutesPlan} min prévues sur ${s.dureeMinutes}.`
        : s.etapes
          ? `${s.etapes} étape${s.etapes > 1 ? "s" : ""}, mais pas toutes minutées.`
          : "Pas encore de plan : quelques étapes minutées vous guident pendant le direct.",
      lien: `/enseigner/seances/${s.id}`,
      action: s.planMinute ? "Voir" : "Écrire",
    },
  ];
  const prets = cases.filter((c) => c.ok).length;

  return (
    <section aria-labelledby="titre-pret" className={cn("flex flex-col gap-4 rounded-[24px] border border-ligne bg-white p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="etiquette">{s.coursCode} · {prets === cases.length ? "Tout est prêt" : `${prets} sur ${cases.length} prêts`}</span>
          <h2 id="titre-pret" className="text-[22px] font-black leading-tight tracking-serre">
            Prêt pour votre prochaine classe
          </h2>
        </div>
        {s.fournisseur === "daily" && s.statut === "planifiee" && (
          <LienBouton href={`/visio/repetition/${s.id}`} variante="contour" taille="sm" icone={<FlaskConical className="h-4 w-4" />}>
            Répéter dans la salle
          </LienBouton>
        )}
      </div>

      <div className="flex flex-col gap-1 rounded-2xl bg-creme px-4 py-3">
        <span className="text-[15px] font-bold">
          {enDirect ? (
            "Votre classe est en direct."
          ) : debut > maintenant ? (
            <>
              Début dans <DecompteCourt cible={s.debut} />
            </>
          ) : (
            "C'est l'heure : les campus vous attendent."
          )}
        </span>
        <span className="text-[14px] text-texte-doux">
          {jour.charAt(0).toUpperCase() + jour.slice(1)} à {heure(s.debut, fuseau)} {chezVous ? `chez vous (${villeFuseau(fuseau)}) · ${heure(s.debut)} à Abidjan` : "à Abidjan"}
        </span>
      </div>

      <BarreProgression valeur={(prets / cases.length) * 100} ton={prets === cases.length ? "succes" : "orange"} />

      <ul className="flex flex-col divide-y divide-ligne-douce" aria-label="Préparation">
        {cases.map((c) => (
          <li key={c.cle} className="flex items-center gap-3 py-3">
            {c.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-succes" aria-label="Prêt" /> : <CircleAlert className="h-5 w-5 shrink-0 text-orange-fonce" aria-label="À faire" />}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-bold">{c.titre}</span>
              <span className="text-[14px] leading-snug text-texte-pale">{c.detail}</span>
            </span>
            {c.surAction ? (
              <button type="button" onClick={c.surAction} className="shrink-0 rounded-xl bg-orange px-3 py-2 text-[13px] font-bold text-encre hover:bg-encre hover:text-white">
                {c.action}
              </button>
            ) : (
              <Link
                href={c.lien}
                className={cn(
                  "inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-bold no-underline",
                  c.ok ? "text-texte-doux hover:text-encre" : "bg-orange text-encre hover:bg-encre hover:text-white",
                )}
              >
                {c.action}
                {c.ok && <ChevronRight className="h-4 w-4" aria-hidden />}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
