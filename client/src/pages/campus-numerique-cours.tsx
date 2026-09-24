// /campus-numerique/cours/:slug — fiche d'un cours annoncé par le campus :
// accroche, formateur, compte à rebours du prochain live, calendrier, campus
// concernés. « Je veux suivre ce cours » crée un prospect dans le CRM du site
// (source « campus-numerique »), comme le formulaire de préinscription.
import { useState } from "react";
import { Link, useParams } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Radio } from "lucide-react";
import { usePageMeta } from "@/lib/seo";
import { apiRequest } from "@/lib/queryClient";
import { SITES_CAMPUS_REPLI, type VitrineCours } from "@shared/campus";
import {
  AvatarFormateur,
  BOUTON_PRINCIPAL,
  BOUTON_SECONDAIRE,
  CarteProchainLive,
  ETIQUETTE,
  LienCampus,
  LigneLive,
  ORANGE_TEXTE,
  dansNosCampus,
  heure,
  jourLong,
  dateComplete,
  liveEnDirect,
  nomFormateur,
  useMaintenant,
  useVitrineCampus,
} from "@/components/campus-numerique";

const WHATSAPP = "https://wa.me/2250747726729";

export default function CampusNumeriqueCoursPage() {
  const { slug } = useParams<{ slug: string }>();
  const { vitrine, campusUrl, chargement } = useVitrineCampus();
  const maintenant = useMaintenant(60_000);
  const cours = vitrine?.cours.find((c) => c.slug === slug) ?? null;

  usePageMeta(
    cours ? `${cours.titre} — cours en direct au campus numérique | Groupe 2IAE` : "Cours du campus numérique | Groupe 2IAE",
    cours?.accroche || "Un cours en direct au campus numérique du Groupe 2IAE, dans les salles de conférence de nos cinq campus et sur téléphone.",
    `/campus-numerique/cours/${slug}`,
  );

  if (chargement) {
    return (
      <div className="container mx-auto mobile-padding py-16" aria-busy="true">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-16 max-w-2xl animate-pulse rounded bg-muted" />
        <div className="mt-4 h-24 max-w-xl animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!cours || !vitrine) {
    return (
      <div className="min-h-[60vh] bg-white">
        <div className="container mx-auto mobile-padding py-20 text-center" data-testid="cours-introuvable">
          <p className={`${ETIQUETTE} ${ORANGE_TEXTE}`}>Campus numérique</p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl text-[#1a1815]">Ce cours n'est plus annoncé sur le site.</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[#5e554f]">
            Il a peut-être déjà commencé, ou son annonce a été retirée. Retrouvez les cours à venir sur la page du campus
            numérique, ou préinscrivez-vous : un conseiller vous oriente.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/campus-numerique" className={BOUTON_PRINCIPAL}>
              Voir les cours à venir
            </Link>
            <Link href="/preinscription" className={BOUTON_SECONDAIRE}>
              Préinscription
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sites = vitrine.campus.sites.length ? vitrine.campus.sites : SITES_CAMPUS_REPLI;
  const lives = vitrine.lives.filter(
    (l) => l.coursCode === cours.code && (liveEnDirect(l, maintenant) || Date.parse(l.debut) > maintenant),
  );
  const debut = cours.dateDebut ? Date.parse(cours.dateDebut) : NaN;
  const f = cours.formateur;

  return (
    <div className="min-h-screen bg-white mobile-safe">
      {/* En-tête du cours */}
      <section className="bg-white mobile-no-overflow">
        <div className="container mx-auto mobile-padding py-8 lg:py-14">
          <Link href="/campus-numerique" className={`inline-flex min-h-[44px] items-center gap-2 font-semibold ${ORANGE_TEXTE} hover:underline`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Campus numérique
          </Link>
          <div className="mt-4 grid items-start gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="h-3 w-12 rounded-full" style={{ backgroundColor: cours.couleur }} aria-hidden="true" />
                <span className={`${ETIQUETTE} font-semibold text-[#1a1815]`}>{cours.code}</span>
              </div>
              <h1 className="mt-4 font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.02] text-[#1a1815]" data-testid="text-cours-titre">
                {cours.titre}
              </h1>
              {cours.accroche && <p className="mt-5 max-w-2xl text-lg lg:text-xl leading-relaxed text-[#3d382f]">{cours.accroche}</p>}

              <ul className="mt-6 flex flex-col gap-2.5 text-[16px] text-[#3d382f]">
                {Number.isFinite(debut) && (
                  <li className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#E8720C]" aria-hidden="true" />
                    <span>
                      {debut > maintenant ? (
                        <>
                          Commence le <strong>{jourLong(debut)}</strong> à {heure(debut)} (heure d'Abidjan)
                        </>
                      ) : (
                        <>Commencé le {dateComplete(debut)}</>
                      )}
                      {cours.dateFin && <span className="text-[#6b625b]"> · jusqu'au {dateComplete(cours.dateFin)}</span>}
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-3">
                  <Radio className="mt-0.5 h-5 w-5 shrink-0 text-[#E8720C]" aria-hidden="true" />
                  <span>
                    En direct {dansNosCampus(cours.nbCampus)} et sur le téléphone des étudiants
                  </span>
                </li>
                {f?.localisation && (
                  <li className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#E8720C]" aria-hidden="true" />
                    <span>
                      Enseigné par {nomFormateur(f)}, depuis {f.localisation}
                    </span>
                  </li>
                )}
              </ul>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#interesse" className={BOUTON_PRINCIPAL} data-testid="link-je-veux-suivre">
                  Je veux suivre ce cours
                </a>
                <LienCampus href={cours.url} className={BOUTON_SECONDAIRE} testId="link-cours-sur-campus">
                  Voir sur le campus
                </LienCampus>
              </div>
            </div>
            <CarteProchainLive vitrine={vitrine} campusUrl={campusUrl} coursCode={cours.code} />
          </div>
        </div>
      </section>

      {/* Formateur et calendrier */}
      <section className="bg-background mobile-no-overflow">
        <div className="container mx-auto mobile-padding grid gap-10 py-14 lg:grid-cols-2 lg:py-20">
          {f && (
            <div>
              <p className={`${ETIQUETTE} ${ORANGE_TEXTE} mb-4`}>Votre formateur</p>
              <div className="rounded-3xl border border-[#EADFD5] bg-white p-6 sm:p-7">
                <div className="flex items-center gap-4">
                  <AvatarFormateur formateur={f} taille="h-20 w-20 text-2xl" carre />
                  <div className="min-w-0">
                    <h2 className="text-2xl font-extrabold leading-tight text-[#1a1815]">{nomFormateur(f)}</h2>
                    {f.titre && <p className="text-[15px] text-[#5e554f]">{f.titre}</p>}
                    {f.localisation && <p className="mt-1 text-sm text-[#6b625b]">depuis {f.localisation}</p>}
                  </div>
                </div>
                {f.bio && <p className="mt-5 whitespace-pre-line leading-relaxed text-[#3d382f]">{f.bio}</p>}
                <Link
                  href={`/campus-numerique/formateurs/${f.slug}`}
                  className={`mt-5 inline-flex min-h-[44px] items-center font-semibold ${ORANGE_TEXTE} hover:underline`}
                  data-testid="link-fiche-formateur"
                >
                  Voir la fiche du formateur →
                </Link>
              </div>
            </div>
          )}
          <div className={f ? "" : "lg:col-span-2"}>
            <p className={`${ETIQUETTE} ${ORANGE_TEXTE} mb-4`}>Calendrier des lives</p>
            {lives.length > 0 ? (
              <div className="flex flex-col gap-3">
                {lives.map((l) => (
                  <LigneLive key={l.id} live={l} vitrine={vitrine} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-[#d9c9bb] bg-white/70 p-6 text-[#5e554f]">
                Les prochaines séances en direct de ce cours apparaîtront ici dès qu'elles seront programmées, avec leur
                date et leur heure.
              </div>
            )}
            <p className={`${ETIQUETTE} ${ORANGE_TEXTE} mb-4 mt-10`}>Où le suivre</p>
            <ul className="flex flex-wrap gap-2" aria-label="Campus du groupe">
              {sites.map((s) => (
                <li key={s.nom} className="rounded-full border border-[#EADFD5] bg-white px-4 py-2 text-[15px] font-semibold text-[#1a1815]">
                  {s.nom}
                </li>
              ))}
              <li className="rounded-full bg-[#1a1815] px-4 py-2 text-[15px] font-semibold text-white">Sur téléphone</li>
            </ul>
            {cours.nbCampus > 0 && cours.nbCampus < sites.length && (
              <p className="mt-3 text-sm text-[#6b625b]">
                Ce cours est diffusé dans {cours.nbCampus} de nos {sites.length} campus : un conseiller vous indique lesquels.
              </p>
            )}
          </div>
        </div>
      </section>

      <FormulaireInteret cours={cours} sites={sites.map((s) => s.nom)} />
    </div>
  );
}

/** « Je veux suivre ce cours » : nom, téléphone, campus → prospect dans le CRM du site. */
function FormulaireInteret({ cours, sites }: { cours: VitrineCours; sites: string[] }) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [campus, setCampus] = useState("");
  const [envoye, setEnvoye] = useState(false);

  const envoi = useMutation({
    mutationFn: () =>
      apiRequest("/api/leads", "POST", {
        name: nom.trim(),
        phone: telephone.trim(),
        source: "campus-numerique",
        campus: campus || null,
        notes: `Souhaite suivre le cours « ${cours.titre} » (${cours.code}) du campus numérique.`,
      }),
    onSuccess: () => setEnvoye(true),
  });

  const pret = nom.trim().length >= 2 && telephone.replace(/\D/g, "").length >= 8;
  const champ =
    "mt-1.5 block min-h-[52px] w-full rounded-xl border border-[#d9c9bb] bg-white px-4 text-[17px] text-[#1a1815] placeholder:text-[#9a8f86] focus:border-[#E8720C] focus:outline-none focus:ring-2 focus:ring-[#E8720C]/40";

  return (
    <section id="interesse" className="bg-white mobile-no-overflow scroll-mt-24">
      <div className="container mx-auto mobile-padding py-14 lg:py-20">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-[#EADFD5] bg-[#fbf6f2] p-6 sm:p-10">
          {envoye ? (
            <div className="text-center" data-testid="interet-envoye" role="status">
              <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" aria-hidden="true" />
              <h2 className="mt-4 font-serif text-3xl text-[#1a1815]">C'est noté, merci {nom.trim().split(/\s+/)[0]} !</h2>
              <p className="mt-3 text-lg text-[#5e554f]">
                Un conseiller du Groupe 2IAE vous rappelle très vite au {telephone.trim()} pour vous inscrire au cours
                « {cours.titre} ».
              </p>
              <a
                href={`${WHATSAPP}?text=${encodeURIComponent(`Bonjour, je souhaite suivre le cours « ${cours.titre} » du campus numérique.`)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-green-600 px-6 font-semibold text-white hover:bg-green-700"
              >
                Écrire tout de suite sur WhatsApp
              </a>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pret && !envoi.isPending) envoi.mutate();
              }}
              noValidate
            >
              <p className={`${ETIQUETTE} ${ORANGE_TEXTE}`}>Je veux suivre ce cours</p>
              <h2 className="mt-2 font-serif text-3xl sm:text-4xl leading-tight text-[#1a1815]">Laissez votre numéro, on vous rappelle.</h2>
              <p className="mt-3 text-[16px] text-[#5e554f]">
                Gratuit et sans engagement. Un conseiller vous explique comment rejoindre « {cours.titre} ».
              </p>
              <div className="mt-6 flex flex-col gap-4">
                <label className="block text-[16px] font-semibold text-[#1a1815]">
                  Nom et prénom
                  <input
                    className={champ}
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    autoComplete="name"
                    placeholder="Ex. : Aya Kouassi"
                    data-testid="input-interet-nom"
                  />
                </label>
                <label className="block text-[16px] font-semibold text-[#1a1815]">
                  Téléphone (WhatsApp de préférence)
                  <input
                    className={champ}
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Ex. : 07 47 72 67 29"
                    data-testid="input-interet-telephone"
                  />
                </label>
                <label className="block text-[16px] font-semibold text-[#1a1815]">
                  Campus le plus proche
                  <select className={champ} value={campus} onChange={(e) => setCampus(e.target.value)} data-testid="select-interet-campus">
                    <option value="">Je ne sais pas encore</option>
                    {sites.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="En ligne (téléphone)">Depuis mon téléphone, en ligne</option>
                  </select>
                </label>
              </div>
              {envoi.isError && (
                <p className="mt-4 rounded-xl bg-red-50 p-3 text-[15px] text-red-800" role="alert">
                  L'envoi n'est pas passé. Vérifiez votre connexion et réessayez, ou écrivez-nous sur WhatsApp au +225 07 47 72 67 29.
                </p>
              )}
              <button
                type="submit"
                disabled={!pret || envoi.isPending}
                className={`${BOUTON_PRINCIPAL} mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50`}
                data-testid="button-interet-envoyer"
              >
                {envoi.isPending ? "Envoi…" : "Je veux suivre ce cours"}
              </button>
              {!pret && (
                <p className="mt-2 text-center text-sm text-[#6b625b]">Indiquez votre nom et un numéro de téléphone.</p>
              )}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
