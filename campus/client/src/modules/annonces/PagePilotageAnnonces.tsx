// /pilotage/annonces — la vie scolaire et la direction écrivent au groupe,
// à un campus, une classe ou un cours, et vérifient qui a lu. La vie
// scolaire d'un campus ne voit et ne vise que son campus. La direction
// valide ici les annonces proposées pour 2iae.com.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { BellRing, ChevronRight, Globe, Megaphone, PenLine, Users } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { useTousEvenements } from "@/lib/flux";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { jourLong, relatif } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { BarreProgression, Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { Onglets } from "@/components/ui/onglets";
import { toast, toastErreur } from "@/components/ui/toast";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import type { AnnonceGestion } from "@shared/schema";
import { BadgesAnnonce, PanneauLectures } from "./composants";
import { FenetreAnnonce } from "./FenetreAnnonce";
import { extrait } from "../accueil/outils";

type Vue = "en_ligne" | "expirees";

export default function PagePilotageAnnonces() {
  const moi = useMoiConnecte();
  const [, naviguer] = useLocation();
  const maintenant = useMaintenant(60_000);
  const [redaction, setRedaction] = useState(false);
  const [lectures, setLectures] = useState<AnnonceGestion | null>(null);
  const [vue, setVue] = useState<Vue>("en_ligne");

  const { data, isLoading, error, refetch } = useQuery<AnnonceGestion[]>({ queryKey: ["/api/annonces/gestion"], refetchInterval: 120_000 });
  useTousEvenements((e) => {
    if (e.type === "annonce") void rafraichir("/api/annonces/gestion");
  });

  const liste = data ?? [];
  const aValider = moi.role === "admin" ? liste.filter((a) => a.proposeSurSite && !a.expiree) : [];
  const enLigne = liste.filter((a) => !a.expiree);
  const expirees = liste.filter((a) => a.expiree);
  const affichees = vue === "en_ligne" ? enLigne : expirees;
  const perimetre = moi.role === "vie_scolaire" && moi.site ? `Campus ${moi.site.nomCourt}` : "Tout le groupe";

  return (
    <Page>
      <EnTetePage
        etiquette={`Pilotage · ${perimetre}`}
        titre="Annonces"
        sousTitre={
          moi.role === "vie_scolaire" && moi.site
            ? `Écrivez aux étudiants du campus ${moi.site.nomCourt}, d'une de ses classes ou d'un de ses cours, puis vérifiez qui a lu.`
            : "Écrivez à tout le groupe, à un campus, une classe ou un cours, puis vérifiez qui a lu."
        }
        actions={
          <Bouton onClick={() => setRedaction(true)} taille="lg" className="min-h-[52px]" icone={<PenLine className="h-4 w-4" />}>
            Nouvelle annonce
          </Bouton>
        }
      />

      {aValider.length > 0 && (
        <section aria-labelledby="titre-a-valider" className="flex flex-col gap-3 rounded-[24px] bg-alerte-clair p-4 sm:p-6">
          <TitreSection
            className="mb-0"
            titre={
              <span id="titre-a-valider" className="flex items-center gap-2">
                <Globe className="h-5 w-5" aria-hidden /> À valider pour 2iae.com
              </span>
            }
          />
          <p className="text-[15px] text-texte-doux">Ces annonces ont été proposées pour le site du groupe. Elles ne sont publiées qu'après votre accord.</p>
          <ul className="flex flex-col gap-2.5">
            {aValider.map((a) => (
              <LigneValidation key={a.id} annonce={a} />
            ))}
          </ul>
        </section>
      )}

      <Onglets<Vue>
        valeur={vue}
        onChange={setVue}
        options={[
          { valeur: "en_ligne", libelle: "En ligne", compteur: enLigne.length },
          { valeur: "expirees", libelle: "Expirées", compteur: expirees.length },
        ]}
        className="self-start"
      />

      {error && !data ? (
        <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
      ) : isLoading ? (
        <Chargement lignes={4} />
      ) : !affichees.length ? (
        <EtatVide
          icone={<Megaphone className="h-5 w-5" />}
          titre={vue === "en_ligne" ? "Aucune annonce en ligne" : "Aucune annonce expirée"}
          texte={
            vue === "en_ligne"
              ? "Une annonce importante sonne sur le téléphone des étudiants concernés et reste en haut de leur accueil jusqu'à la lecture. Vous verrez ici, campus par campus, qui l'a lue."
              : "Les annonces dont la date de retrait est passée sont rangées ici."
          }
          action={vue === "en_ligne" ? <Bouton onClick={() => setRedaction(true)}>Écrire une annonce</Bouton> : undefined}
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {affichees.map((a) => (
            <LigneGestion key={a.id} annonce={a} maintenant={maintenant} onLectures={() => setLectures(a)} />
          ))}
        </ul>
      )}

      <FenetreAnnonce ouverte={redaction} onFermer={() => setRedaction(false)} onEnregistree={() => void rafraichir("/api/annonces/gestion")} />
      <Fenetre
        ouverte={Boolean(lectures)}
        onFermer={() => setLectures(null)}
        titre="Qui a lu ?"
        description={lectures ? `« ${lectures.titre} » · ${lectures.cibleLibelle}` : undefined}
        pied={
          lectures ? (
            <Bouton variante="doux" onClick={() => naviguer(`/annonces/${lectures.id}`)} className="min-h-[48px]">
              Ouvrir l'annonce
            </Bouton>
          ) : undefined
        }
      >
        {lectures && (
          <div className="pb-3">
            <PanneauLectures annonceId={lectures.id} expiree={lectures.expiree} />
          </div>
        )}
      </Fenetre>
    </Page>
  );
}

function LigneGestion({ annonce: a, maintenant, onLectures }: { annonce: AnnonceGestion; maintenant: number; onLectures: () => void }) {
  const [relance, setRelance] = useState(false);
  const pct = a.total ? Math.round((a.lus / a.total) * 100) : 0;
  const nonLus = a.total - a.lus;

  async function relancer() {
    setRelance(true);
    try {
      const r = await post<{ relances: number }>(`/api/annonces/${a.id}/relancer`);
      toast(r.relances ? `Rappel envoyé à ${r.relances} personne${r.relances > 1 ? "s" : ""}.` : "Tout le monde a déjà lu.");
      await rafraichir("/api/annonces/gestion", `/api/annonces/${a.id}/lectures`);
    } catch (e) {
      toastErreur(e);
    } finally {
      setRelance(false);
    }
  }

  return (
    <li>
      <Carte className="flex h-full flex-col gap-4">
        <div className="flex flex-col gap-2">
          <BadgesAnnonce annonce={a} gestion />
          <Link href={`/annonces/${a.id}`} className="group flex items-start justify-between gap-3 text-encre no-underline hover:text-orange-fonce">
            <span className="text-[17px] font-extrabold leading-snug">{a.titre}</span>
            <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
          </Link>
          <p className="line-clamp-2 text-sm text-texte-pale">{extrait(a.corps, 140)}</p>
          <p className="font-mono text-xs text-texte-gris">
            {a.cibleLibelle} · {a.auteur.prenom} {a.auteur.nom} · {relatif(a.publieeLe, maintenant)}
            {a.expireLe && (a.expiree ? ` · expirée le ${jourLong(a.expireLe)}` : ` · jusqu'au ${jourLong(a.expireLe)}`)}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-end justify-between text-sm">
            <span className="font-semibold">
              Lue par <span className="text-lg font-black tabular-nums">{a.lus}</span> sur {a.total}
            </span>
            <span className="font-mono text-texte-pale">{pct} %</span>
          </div>
          <BarreProgression valeur={pct} ton={pct === 100 ? "succes" : "orange"} className="h-2" />
          {a.derniereRelance && <span className="font-mono text-[11px] text-texte-gris">Relancée {relatif(a.derniereRelance, maintenant)}</span>}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Bouton variante="doux" onClick={onLectures} className={cn("min-h-[48px] px-3 text-sm", !(nonLus > 0 && !a.expiree) && "col-span-2")} icone={<Users className="h-4 w-4" />}>
            {nonLus > 0 ? "Qui n'a pas lu ?" : "Lectures"}
          </Bouton>
          {nonLus > 0 && !a.expiree && (
            <Bouton variante="contour" onClick={() => void relancer()} chargement={relance} className="min-h-[48px] px-3 text-sm" icone={<BellRing className="h-4 w-4" />}>
              Relancer les {nonLus}
            </Bouton>
          )}
        </div>
      </Carte>
    </li>
  );
}

function LigneValidation({ annonce: a }: { annonce: AnnonceGestion }) {
  const [envoi, setEnvoi] = useState<null | "publier" | "refuser">(null);
  async function decider(publier: boolean) {
    setEnvoi(publier ? "publier" : "refuser");
    try {
      await post(`/api/annonces/${a.id}/site`, { publier });
      toast(publier ? "Annonce publiée sur 2iae.com." : "Proposition refusée : l'annonce reste sur le campus.");
      await rafraichir("/api/annonces");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  }
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <Link href={`/annonces/${a.id}`} className="text-base font-extrabold text-encre no-underline hover:text-orange-fonce">
          {a.titre}
        </Link>
        <span className="line-clamp-2 text-sm text-texte-pale">{extrait(a.corps, 120)}</span>
        <span className="font-mono text-xs text-texte-gris">
          Proposée par {a.auteur.prenom} {a.auteur.nom} · {a.cibleLibelle}
        </span>
      </div>
      <div className="flex shrink-0 gap-2">
        <Bouton onClick={() => void decider(true)} chargement={envoi === "publier"} disabled={envoi !== null} className="min-h-[48px]">
          Publier
        </Bouton>
        <Bouton variante="fantome" onClick={() => void decider(false)} chargement={envoi === "refuser"} disabled={envoi !== null} className="min-h-[48px]">
          Refuser
        </Bouton>
      </div>
    </li>
  );
}
