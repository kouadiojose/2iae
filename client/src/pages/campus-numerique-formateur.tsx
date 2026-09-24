// /campus-numerique/formateurs/:slug — fiche publique d'un formateur du
// campus (publiée seulement avec son consentement, côté campus) : photo,
// titre, « depuis Lyon », bio, cours, prochain live avec compte à rebours.
import { Link, useParams } from "wouter";
import { ArrowLeft, MapPin } from "lucide-react";
import { usePageMeta } from "@/lib/seo";
import type { VitrineFormateur } from "@shared/campus";
import {
  AvatarFormateur,
  BOUTON_PRINCIPAL,
  BOUTON_SECONDAIRE,
  CarteCoursCampus,
  CompteARebours,
  ETIQUETTE,
  LienCampus,
  LigneLive,
  ORANGE_TEXTE,
  PointDirect,
  dansCourt,
  estNouveau,
  heure,
  jourLongMaj,
  liveEnDirect,
  nomFormateur,
  useMaintenant,
  useVitrineCampus,
} from "@/components/campus-numerique";

export default function CampusNumeriqueFormateurPage() {
  const { slug } = useParams<{ slug: string }>();
  const { vitrine, chargement } = useVitrineCampus();
  const maintenant = useMaintenant(60_000);

  // Le formateur peut n'être connu que par l'un de ses cours.
  const formateur: VitrineFormateur | null =
    vitrine?.formateurs.find((f) => f.slug === slug) ??
    vitrine?.cours.map((c) => c.formateur).find((f): f is VitrineFormateur => f?.slug === slug) ??
    null;

  usePageMeta(
    formateur
      ? `${nomFormateur(formateur)} — formateur au campus numérique | Groupe 2IAE`
      : "Formateur du campus numérique | Groupe 2IAE",
    formateur
      ? `${nomFormateur(formateur)}${formateur.titre ? `, ${formateur.titre}` : ""}${formateur.localisation ? `, depuis ${formateur.localisation}` : ""} : enseigne en direct aux étudiants des cinq campus du Groupe 2IAE.`
      : "Les formateurs du campus numérique du Groupe 2IAE enseignent en direct aux étudiants de nos cinq campus.",
    `/campus-numerique/formateurs/${slug}`,
  );

  if (chargement) {
    return (
      <div className="container mx-auto mobile-padding py-16" aria-busy="true">
        <div className="h-40 w-40 animate-pulse rounded-3xl bg-muted" />
        <div className="mt-6 h-12 max-w-md animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (!formateur || !vitrine) {
    return (
      <div className="min-h-[60vh] bg-white">
        <div className="container mx-auto mobile-padding py-20 text-center" data-testid="formateur-introuvable">
          <p className={`${ETIQUETTE} ${ORANGE_TEXTE}`}>Campus numérique</p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl text-[#1a1815]">Cette fiche n'est plus publiée.</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-[#5e554f]">
            Un formateur choisit d'apparaître ou non sur le site, et peut retirer sa fiche à tout moment. Découvrez les
            autres formateurs du campus numérique.
          </p>
          <div className="mt-8 flex justify-center">
            <Link href="/campus-numerique" className={BOUTON_PRINCIPAL}>
              Voir les formateurs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const f = formateur;
  const codes = new Set(f.cours.map((c) => c.code));
  const coursAnnonces = vitrine.cours.filter((c) => codes.has(c.code) || c.formateur?.slug === f.slug);
  const autresCours = f.cours.filter((c) => !coursAnnonces.some((a) => a.code === c.code));
  const nom = nomFormateur(f);
  // Lives de ses cours : on rapproche par le code du cours, et par le nom en secours.
  const lives = vitrine.lives.filter(
    (l) =>
      (codes.has(l.coursCode) || coursAnnonces.some((c) => c.code === l.coursCode) ||
        (l.formateur && nomFormateur(l.formateur) === nom)) &&
      (liveEnDirect(l, maintenant) || Date.parse(l.debut) > maintenant),
  );
  const prochain = lives[0] ?? null;
  const prochainDirect = prochain ? liveEnDirect(prochain, maintenant) : false;

  return (
    <div className="min-h-screen bg-white mobile-safe">
      <section className="bg-white mobile-no-overflow">
        <div className="container mx-auto mobile-padding py-8 lg:py-14">
          <Link href="/campus-numerique" className={`inline-flex min-h-[44px] items-center gap-2 font-semibold ${ORANGE_TEXTE} hover:underline`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Campus numérique
          </Link>
          <div className="mt-6 grid items-start gap-10 lg:grid-cols-[auto_1fr_minmax(0,24rem)] lg:gap-12">
            <AvatarFormateur formateur={f} taille="h-40 w-40 sm:h-56 sm:w-56 text-6xl" carre />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className={`${ETIQUETTE} ${ORANGE_TEXTE}`}>Formateur du campus numérique</p>
                {estNouveau(f, maintenant) && (
                  <span className={`${ETIQUETTE} rounded-full bg-[#fff1e6] px-2 py-0.5 text-[10px] font-semibold ${ORANGE_TEXTE}`}>Nouveau</span>
                )}
              </div>
              <h1 className="mt-3 font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.02] text-[#1a1815]" data-testid="text-formateur-nom">
                {nom}
              </h1>
              {f.titre && <p className="mt-3 text-xl text-[#3d382f]">{f.titre}</p>}
              {f.localisation && (
                <p className="mt-3 flex items-center gap-2 text-[17px] text-[#5e554f]">
                  <MapPin className="h-5 w-5 text-[#E8720C]" aria-hidden="true" /> Enseigne depuis {f.localisation}
                </p>
              )}
              {f.bio && <p className="mt-6 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-[#3d382f]">{f.bio}</p>}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/preinscription" className={BOUTON_PRINCIPAL} data-testid="link-formateur-preinscription">
                  Suivre ses cours : préinscription
                </Link>
                <LienCampus href={f.url} className={BOUTON_SECONDAIRE} testId="link-formateur-campus">
                  Voir sur le campus
                </LienCampus>
              </div>
            </div>

            {prochain && (
              <aside className="rounded-[28px] bg-[#1a1815] p-6 text-white" data-testid="formateur-prochain-live">
                {prochainDirect ? (
                  <p className={`${ETIQUETTE} inline-flex items-center gap-2 text-[#FFD2B3]`}>
                    <PointDirect /> En direct maintenant
                  </p>
                ) : (
                  <p className={`${ETIQUETTE} text-[#FFD2B3]`}>Prochain cours {dansCourt(Date.parse(prochain.debut), maintenant)}</p>
                )}
                <h2 className="mt-3 text-2xl font-extrabold leading-tight">{prochain.coursTitre}</h2>
                <p className="mt-1 text-[#d8cfc7]">{prochain.titre}</p>
                {!prochainDirect && (
                  <>
                    <p className="mt-2 text-[15px] text-[#d8cfc7]">
                      {jourLongMaj(prochain.debut)} · {heure(prochain.debut)} à Abidjan
                    </p>
                    <div className="mt-5">
                      <CompteARebours cible={Date.parse(prochain.debut)} />
                    </div>
                  </>
                )}
              </aside>
            )}
          </div>
        </div>
      </section>

      <section className="bg-background mobile-no-overflow">
        <div className="container mx-auto mobile-padding py-14 lg:py-20">
          <p className={`${ETIQUETTE} ${ORANGE_TEXTE} mb-3`}>Ses cours</p>
          <h2 className="mb-8 font-serif text-3xl sm:text-4xl text-[#1a1815]">Les cours de {f.prenom}</h2>
          {coursAnnonces.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {coursAnnonces.map((c) => (
                <CarteCoursCampus key={c.slug} cours={c} vitrine={vitrine} />
              ))}
            </div>
          ) : null}
          {autresCours.length > 0 && (
            <ul className={`flex flex-col gap-2 ${coursAnnonces.length ? "mt-6" : ""}`}>
              {autresCours.map((c) => (
                <li key={c.code} className="rounded-2xl border border-[#EADFD5] bg-white px-5 py-4">
                  <span className={`${ETIQUETTE} mr-3 font-semibold text-[#1a1815]`}>{c.code}</span>
                  <span className="font-semibold text-[#1a1815]">{c.titre}</span>
                </li>
              ))}
            </ul>
          )}
          {coursAnnonces.length === 0 && autresCours.length === 0 && (
            <div className="rounded-3xl border border-dashed border-[#d9c9bb] bg-white/70 p-6 text-lg text-[#5e554f]">
              Les prochains cours de {f.prenom} seront annoncés ici. Préinscrivez-vous pour être prévenu.
            </div>
          )}

          {lives.length > 1 && (
            <div className="mt-12">
              <p className={`${ETIQUETTE} ${ORANGE_TEXTE} mb-4`}>Ses prochains lives</p>
              <div className="flex max-w-3xl flex-col gap-3">
                {lives.map((l) => (
                  <LigneLive key={l.id} live={l} vitrine={vitrine} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
