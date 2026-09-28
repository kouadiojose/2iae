// /questions : les questions fréquentes des étudiants et des parents
// (première connexion, code perdu, forfait, téléphone partagé, relevé…),
// saisies et ordonnées dans le back-office. Filtre par thème, recherche, et
// le contact WhatsApp réel (groupe et vie scolaire de chaque campus).
import { useMemo, useState } from "react";
import { ChevronDown, Mail, MessageCircle, Phone, Search } from "lucide-react";
import { Squelette } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import { LIBELLES_THEMES, THEMES_QUESTIONS, type ThemeQuestion } from "@shared/schema";
import { EnTetePagePublique, EtatVidePublic, Paragraphes } from "./composants";
import { useSitePublic, useSitePublicOuSecours } from "./donnees";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { lienTelephone, lienWhatsappVers, numeroLisible, typo, useTitreDocument } from "./outils";

/** Minuscules sans accents, pour la recherche. */
const simplifier = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export default function PageQuestions() {
  useTitreDocument("Questions fréquentes · Campus numérique 2IAE");
  const { site: charge, chargement } = useSitePublic();
  const site = useSitePublicOuSecours();
  const [theme, setTheme] = useState<ThemeQuestion | "tous">("tous");
  const [recherche, setRecherche] = useState("");

  const themesPresents = THEMES_QUESTIONS.filter((t) => site.questions.some((q) => q.theme === t));
  const visibles = useMemo(() => {
    const r = simplifier(recherche.trim());
    return site.questions.filter((q) => (theme === "tous" || q.theme === theme) && (!r || simplifier(`${q.question} ${q.reponse}`).includes(r)));
  }, [site.questions, theme, recherche]);
  const campusWhatsapp = site.campus.filter((c) => c.whatsappCampus);

  return (
    <MiseEnPagePublique>
      <EnTetePagePublique
        fil={[{ libelle: "Questions fréquentes" }]}
        etiquette="Étudiants et parents"
        titre="Questions fréquentes."
        texte="Se connecter pour la première fois, retrouver son code, suivre un cours avec un petit forfait, suivre la scolarité de son enfant : les réponses."
      />

      <section className="conteneur grid gap-10 pb-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3">
            <label className="relative block">
              <span className="sr-only">Chercher une question</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" aria-hidden />
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Chercher : code, forfait, parents…"
                className="min-h-[52px] w-full rounded-2xl border border-ligne bg-white pl-12 pr-4 text-base text-encre outline-none placeholder:text-texte-gris focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
            </label>
            {themesPresents.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par thème">
                {(["tous", ...themesPresents] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={theme === t}
                    onClick={() => setTheme(t)}
                    className={cn(
                      "min-h-[44px] rounded-full px-4 text-[15px] font-bold transition-colors",
                      theme === t ? "bg-encre text-white" : "bg-creme text-texte-doux hover:bg-orange-clair hover:text-encre",
                    )}
                  >
                    {t === "tous" ? "Toutes" : LIBELLES_THEMES[t]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {chargement && !charge ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2, 3].map((i) => (
                <Squelette key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : visibles.length ? (
            <ul className="flex flex-col border-t-2 border-encre">
              {visibles.map((q) => (
                <li key={q.id} className="border-b border-ligne">
                  <details className="group">
                    <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-left [&::-webkit-details-marker]:hidden">
                      <span className="flex flex-col gap-1">
                        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-orange-fonce">{LIBELLES_THEMES[q.theme]}</span>
                        <span className="text-lg font-extrabold leading-snug tracking-[-0.01em] sm:text-xl">{typo(q.question)}</span>
                      </span>
                      <ChevronDown className="h-5 w-5 shrink-0 text-texte-gris transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <Paragraphes texte={q.reponse} className="max-w-[680px] pb-6 text-[16px]" />
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <EtatVidePublic
              icone={<Search className="h-6 w-6" />}
              titre="Aucune question ne correspond."
              texte="Essayez un autre mot, ou posez directement votre question sur WhatsApp : une personne vous répond."
            />
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-4 rounded-[28px] bg-encre p-6 text-white">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">Pas trouvé ?</span>
            <h2 className="text-2xl font-black leading-tight tracking-serre">Une personne vous répond.</h2>
            <p className="text-[15px] leading-relaxed text-nuit-doux">Écrivez au Groupe 2IAE sur WhatsApp, ou appelez le standard.</p>
            {site.contacts.whatsapp && (
              <a
                href={lienWhatsappVers(site.contacts.whatsapp, "Bonjour, j'ai une question sur le campus numérique 2IAE.")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-base font-bold text-encre no-underline hover:bg-white hover:text-encre"
              >
                <MessageCircle className="h-5 w-5" /> WhatsApp {site.contacts.whatsapp}
              </a>
            )}
            <ul className="flex flex-col">
              {site.contacts.telephones.map((t) => (
                <li key={t}>
                  <a href={lienTelephone(t)} className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-white no-underline hover:text-orange">
                    <Phone className="h-4 w-4 text-nuit-gris" aria-hidden /> {t}
                  </a>
                </li>
              ))}
              {site.contacts.email && (
                <li>
                  <a href={`mailto:${site.contacts.email}`} className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-white no-underline hover:text-orange">
                    <Mail className="h-4 w-4 text-nuit-gris" aria-hidden /> {site.contacts.email}
                  </a>
                </li>
              )}
            </ul>
          </div>
          {campusWhatsapp.length > 0 && (
            <div className="flex flex-col gap-3 rounded-[28px] border border-ligne p-6">
              <h2 className="text-lg font-extrabold">La vie scolaire de votre campus</h2>
              <p className="text-[14px] leading-relaxed text-texte-pale">Pour un code de connexion, une absence ou le relevé d'un enfant.</p>
              <ul className="flex flex-col">
                {campusWhatsapp.map((c) => (
                  <li key={c.slug} className="border-t border-ligne-douce first:border-t-0">
                    <a
                      href={lienWhatsappVers(c.whatsapp, `Bonjour, je vous écris depuis le site du campus numérique 2IAE (campus ${c.nomCourt}).`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[52px] items-center justify-between gap-3 py-2 text-encre no-underline hover:text-encre"
                    >
                      <span className="flex flex-col">
                        <span className="font-bold">{c.nomCourt}</span>
                        <span className="font-mono text-xs text-texte-gris">{numeroLisible(c.whatsapp)}</span>
                      </span>
                      <span className="text-sm font-bold text-[#128C7E]">Écrire</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </section>
    </MiseEnPagePublique>
  );
}
