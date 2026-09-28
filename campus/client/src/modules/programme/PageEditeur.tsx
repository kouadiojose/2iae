// /pilotage/programme/:id : l'éditeur d'une session. Une grille qui
// ressemble au document du service des études (clic sur une case vide :
// ajouter ; clic sur un créneau : modifier), la vue « Semaines » pour poser
// un « Pas de cours ce jour-là », les réglages, et « Publier » / « Mettre à
// jour les séances » (idempotent, avec un bilan lisible).
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarOff,
  CalendarRange,
  CheckCircle2,
  Copy,
  Eye,
  MoreHorizontal,
  Plus,
  Printer,
  RefreshCw,
  Settings2,
  Send,
  TriangleAlert,
  Archive,
  ArchiveRestore,
  Undo2,
  Trash2,
  Users,
} from "lucide-react";
import type { ApercuPublicationDto, BilanPublication, CreneauEditionDto, OccurrenceDto, SessionEditionDto } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Badge, BadgeDirect, Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Menu, ElementMenu, SeparateurMenu } from "@/components/ui/menu";
import { Onglets } from "@/components/ui/onglets";
import { Fenetre } from "@/components/ui/fenetre";
import { Champ } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, suppr } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { cn, pluriel } from "@/lib/utils";
import { SousNav } from "@/modules/pilotage/composants/SousNav";
import { GrilleProgramme } from "./GrilleProgramme";
import { FenetreCreneau } from "./FenetreCreneau";
import { FenetreReglages } from "./FenetreReglages";
import { FenetreDupliquer } from "./PageSessions";
import { JOURS, LIBELLES_STATUT_SESSION, heureAbidjan, hh, jourMois, libelleJour, parJour, parSemaine, periode } from "./outils";

type Edition = { creneau?: CreneauEditionDto; prerempli?: { jour: number; heureDebut: string; heureFin: string } } | null;

export default function PageEditeur({ id }: { id: string }) {
  const cle = ["/api/pilotage/programme/sessions", id];
  const { data: s, isLoading, error, refetch } = useQuery<SessionEditionDto>({ queryKey: cle });
  const [vue, setVue] = useState<"grille" | "semaines">("grille");
  const [edition, setEdition] = useState<Edition>(null);
  const [reglages, setReglages] = useState(false);
  const [copie, setCopie] = useState(false);
  const [bilan, setBilan] = useState<BilanPublication | null>(null);
  const [aPublier, setAPublier] = useState(false);
  const [confirmation, setConfirmation] = useState<"archiver" | "retirer" | "supprimer" | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [, naviguer] = useLocation();

  const appliquer = (maj: SessionEditionDto) => {
    queryClient.setQueryData(cle, maj);
    void rafraichir("/api/pilotage/programme/sessions/" + id + "/occurrences");
    void queryClient.invalidateQueries({ queryKey: ["/api/pilotage/programme/sessions"], exact: true });
  };

  // « Publier » et « Mettre à jour les séances » passent d'abord par un aperçu exact de ce qui va changer.
  const publier = () => setAPublier(true);
  const surPublie = async (b: BilanPublication) => {
    setAPublier(false);
    setBilan(b);
    await refetch();
    void rafraichir("/api/pilotage/programme", "/api/programme", "/api/public/programme", "/api/seances", "/api/cours");
  };

  const action = async (quoi: "archiver" | "retirer" | "desarchiver" | "supprimer") => {
    setEnvoi(true);
    try {
      if (quoi === "supprimer") {
        await suppr(`/api/pilotage/programme/sessions/${id}`);
        toast("Session supprimée.");
        void rafraichir("/api/pilotage/programme");
        naviguer("/pilotage/programme");
        return;
      }
      const maj = await post<SessionEditionDto>(`/api/pilotage/programme/sessions/${id}/${quoi}`);
      appliquer(maj);
      void rafraichir("/api/programme", "/api/public/programme", "/api/seances");
      toast(quoi === "archiver" ? "Session archivée." : quoi === "retirer" ? "Emploi du temps retiré de la publication." : "Session désarchivée : elle est en brouillon.");
      setConfirmation(null);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  if (isLoading) {
    return (
      <Page large>
        <SousNav />
        <Chargement lignes={4} />
      </Page>
    );
  }
  if (error || !s) {
    return (
      <Page large>
        <SousNav />
        <Erreur message={(error as Error)?.message ?? "Emploi du temps introuvable."} reessayer={() => refetch()} />
      </Page>
    );
  }

  const modifiable = s.modifiable && s.statut !== "archivee";
  const publiee = s.statut === "publiee";

  return (
    <Page large>
      <SousNav />
      <Link href="/pilotage/programme" className="-mb-3 inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm font-bold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" /> Toutes les sessions
      </Link>
      <EnTetePage
        etiquette={`Emploi du temps · Année académique ${s.anneeAcademique}`}
        titre={
          <span className="flex flex-wrap items-center gap-3">
            {s.titre}
            <Badge ton={publiee ? "succes" : s.statut === "archivee" ? "gris" : "alerte"} className="text-[13px]">
              {LIBELLES_STATUT_SESSION[s.statut]}
            </Badge>
          </span>
        }
        sousTitre={`${s.public ? `${s.public} · ` : ""}${periode(s.debut, s.fin)}${s.pause ? ` · pause ${hh(s.pause.debut)}–${hh(s.pause.fin)}` : ""}`}
        actions={
          <>
            {modifiable && (
              <Bouton
                taille="lg"
                className={cn("min-h-[52px]", publiee && !s.aRepercuter && "bg-creme hover:bg-orange-clair hover:text-encre")}
                icone={publiee ? <RefreshCw className="h-5 w-5" /> : <Send className="h-5 w-5" />}
                chargement={envoi}
                disabled={!s.creneaux.length}
                onClick={publier}
              >
                {publiee ? "Mettre à jour les séances" : "Publier"}
              </Bouton>
            )}
            <LienBouton href={`/pilotage/programme/${s.id}/imprimer`} variante="contour" taille="lg" icone={<Printer className="h-5 w-5" />} className="min-h-[52px]">
              Imprimer
            </LienBouton>
            {modifiable && (
              <Bouton variante="contour" taille="lg" icone={<Settings2 className="h-5 w-5" />} onClick={() => setReglages(true)} className="min-h-[52px]">
                Réglages
              </Bouton>
            )}
            <Menu
              declencheur={
                <Bouton variante="contour" taille="icone" aria-label="Plus d'actions" className="h-[52px] w-[52px]">
                  <MoreHorizontal className="h-5 w-5" />
                </Bouton>
              }
            >
              <ElementMenu icone={<Copy className="h-4 w-4" />} onSelect={() => setCopie(true)}>
                Dupliquer (nouvelles dates)
              </ElementMenu>
              {publiee && (
                <ElementMenu icone={<Eye className="h-4 w-4" />} onSelect={() => naviguer(`/programme/${s.id}`)}>
                  Voir la page publique
                </ElementMenu>
              )}
              {s.modifiable && <SeparateurMenu />}
              {s.modifiable && publiee && (
                <ElementMenu icone={<Undo2 className="h-4 w-4" />} onSelect={() => setConfirmation("retirer")}>
                  Retirer de la publication
                </ElementMenu>
              )}
              {s.modifiable && s.statut !== "archivee" && (
                <ElementMenu icone={<Archive className="h-4 w-4" />} onSelect={() => setConfirmation("archiver")}>
                  Archiver
                </ElementMenu>
              )}
              {s.modifiable && s.statut === "archivee" && (
                <ElementMenu icone={<ArchiveRestore className="h-4 w-4" />} onSelect={() => action("desarchiver")}>
                  Désarchiver
                </ElementMenu>
              )}
              {s.modifiable && !s.publieeLe && !s.nbSeances && (
                <ElementMenu danger icone={<Trash2 className="h-4 w-4" />} onSelect={() => setConfirmation("supprimer")}>
                  Supprimer
                </ElementMenu>
              )}
            </Menu>
          </>
        }
      />

      {!s.modifiable && (
        <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] text-texte-doux">Cet emploi du temps concerne d'autres campus que le vôtre : seule la direction peut le modifier. Vous pouvez le consulter et l'imprimer.</p>
      )}
      {s.statut === "archivee" && <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] text-texte-doux">Session archivée : elle n'apparaît plus nulle part. Désarchivez-la pour la modifier ou la republier.</p>}
      {publiee && s.aRepercuter && modifiable && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-alerte bg-alerte-clair p-4">
          <p className="flex items-start gap-2 text-[15px] font-semibold text-alerte">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            Vous avez modifié l'emploi du temps depuis sa publication. La grille est à jour partout ; les séances du direct le seront quand vous cliquerez sur « Mettre à jour les séances ».
          </p>
          <Bouton onClick={publier} chargement={envoi} icone={<RefreshCw className="h-4 w-4" />}>
            Mettre à jour les séances
          </Bouton>
        </div>
      )}
      {!publiee && s.statut === "brouillon" && s.creneaux.length > 0 && (
        <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] text-texte-doux">
          Brouillon : personne ne le voit encore. « Publier » l'affiche sur le site et dans l'espace des étudiants et des formateurs, crée les séances du direct et prévient chacun une seule fois.
        </p>
      )}
      {s.avertissements.length > 0 && modifiable && (
        <details className="rounded-2xl border border-ligne bg-white p-4 [&[open]>summary>svg]:rotate-0" open={s.avertissements.length <= 4}>
          <summary className="flex cursor-pointer list-none items-center gap-2 font-extrabold">
            <TriangleAlert className="h-5 w-5 text-alerte" /> {pluriel(s.avertissements.length, "point à vérifier", "points à vérifier")}
          </summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-7 text-[15px] text-texte-doux">
            {s.avertissements.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Onglets
          valeur={vue}
          onChange={setVue}
          options={[
            { valeur: "grille", libelle: "Grille" },
            { valeur: "semaines", libelle: "Semaines", compteur: s.exceptions.length || undefined },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3 text-sm text-texte-pale">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" /> {s.classes.length ? pluriel(s.classes.length, "classe") : "Aucune classe"}
          </span>
          {publiee && <span>{pluriel(s.nbSeances, "séance créée", "séances créées")}</span>}
          {vue === "grille" && modifiable && (
            <Bouton variante="doux" icone={<Plus className="h-4 w-4" />} onClick={() => setEdition({ prerempli: { jour: 1, heureDebut: "08:30", heureFin: "12:30" } })} className="min-h-[44px]">
              Ajouter un créneau
            </Bouton>
          )}
        </div>
      </div>

      {vue === "grille" ? (
        <>
          {!s.creneaux.length && modifiable && (
            <p className="text-[15px] text-texte-pale">Cliquez sur une case pour ajouter le premier créneau (jour et heures déjà remplis). Les lignes se forment d'elles-mêmes à partir des heures des créneaux.</p>
          )}
          <GrilleProgramme
            session={s}
            surCaseVide={modifiable ? (jour, heureDebut, heureFin) => setEdition({ prerempli: { jour, heureDebut, heureFin } }) : undefined}
            surCreneau={modifiable ? (c) => setEdition({ creneau: s.creneaux.find((x) => x.id === c.id) }) : undefined}
          />
          {s.classes.length > 0 && <ClassesParCampus classes={s.classes} />}
        </>
      ) : (
        <VueSemaines session={s} modifiable={modifiable} surChange={() => refetch()} />
      )}

      {edition && (
        <FenetreCreneau
          session={s}
          creneau={edition.creneau}
          prerempli={edition.prerempli}
          onFermer={() => setEdition(null)}
          surEnregistre={(maj) => {
            appliquer(maj);
            setEdition(null);
          }}
        />
      )}
      {reglages && (
        <FenetreReglages
          session={s}
          onFermer={() => setReglages(false)}
          surEnregistre={(maj) => {
            appliquer(maj);
            setReglages(false);
          }}
        />
      )}
      {copie && (
        <FenetreDupliquer
          source={{ ...s, nbCreneaux: s.creneaux.length }}
          onFermer={() => setCopie(false)}
          surCree={(nouveau) => {
            setCopie(false);
            naviguer(`/pilotage/programme/${nouveau}`);
          }}
        />
      )}
      {aPublier && <FenetrePublication session={s} onFermer={() => setAPublier(false)} surPublie={surPublie} />}
      {bilan && <FenetreBilan bilan={bilan} session={s} onFermer={() => setBilan(null)} />}
      {confirmation && (
        <Fenetre
          ouverte
          onFermer={() => setConfirmation(null)}
          titre={confirmation === "archiver" ? "Archiver cette session ?" : confirmation === "retirer" ? "Retirer de la publication ?" : "Supprimer cette session ?"}
          description={
            confirmation === "archiver"
              ? [
                  publiee ? "Elle disparaît du site et de l'espace de chacun." : "Elle disparaît de la liste des sessions en cours.",
                  s.nbSeancesAVenir
                    ? `${pluriel(s.nbSeancesAVenir, "séance à venir sera annulée", "séances à venir seront annulées")} ; les intervenants${s.publieeLe ? " et les étudiants" : ""} sont prévenus. Les séances passées restent dans l'historique.`
                    : "Aucune séance à venir n'est annulée.",
                  `Vous pourrez la désarchiver puis la republier${s.nbSeancesAVenir ? " : ses séances seront alors rétablies" : ""}.`,
                ].join(" ")
              : confirmation === "retirer"
                ? "Elle repasse en brouillon et disparaît du site et de l'espace des étudiants. Les séances déjà créées restent prévues dans le direct, sans être annoncées publiquement."
                : "Ce brouillon n'a jamais été publié : il est supprimé avec ses créneaux."
          }
          pied={
            <>
              <Bouton variante="fantome" onClick={() => setConfirmation(null)}>
                Annuler
              </Bouton>
              <Bouton variante={confirmation === "retirer" ? "encre" : "danger"} chargement={envoi} onClick={() => action(confirmation)}>
                {confirmation === "archiver" ? "Archiver" : confirmation === "retirer" ? "Retirer" : "Supprimer"}
              </Bouton>
            </>
          }
        />
      )}
    </Page>
  );
}

/** « Riviera : Tronc commun 1BTS, Tronc commun 2BTS · Yopougon : … » */
function ClassesParCampus({ classes }: { classes: SessionEditionDto["classes"] }) {
  const parSite = new Map<string, string[]>();
  for (const c of classes) parSite.set(c.site, [...(parSite.get(c.site) ?? []), c.nom]);
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-creme px-4 py-3 text-[13.5px] text-texte-doux">
      <span className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">Classes destinataires</span>
      <ul className="flex flex-wrap gap-x-5 gap-y-1">
        {[...parSite.entries()].map(([site, noms]) => (
          <li key={site}>
            <strong className="text-encre">{site}</strong> : {noms.join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Aperçu avant publication ───────────────────────────────────────────────

const NATURES: Record<ApercuPublicationDto["changements"][number]["nature"], string> = { creee: "créée", modifiee: "modifiée", annulee: "annulée", retablie: "rétablie" };

function FenetrePublication({ session, onFermer, surPublie }: { session: SessionEditionDto; onFermer: () => void; surPublie: (b: BilanPublication) => void }) {
  const url = `/api/pilotage/programme/sessions/${session.id}/apercu`;
  const { data: a, isLoading, error } = useQuery<ApercuPublicationDto>({ queryKey: [url], staleTime: 0, gcTime: 0 });
  const [envoi, setEnvoi] = useState(false);
  const rien = a && !a.premiere && !a.seancesCreees && !a.seancesMisesAJour && !a.seancesAnnulees;
  const confirmer = async () => {
    setEnvoi(true);
    try {
      surPublie(await post<BilanPublication>(`/api/pilotage/programme/sessions/${session.id}/publier`));
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  // Les séances rétablies (jour levé, session désarchivée) comptent parmi les mises à jour : on les nomme à part.
  const retablies = a ? a.changements.filter((c) => c.nature === "retablie").length : 0;
  const lignes = a
    ? [
        a.seancesCreees && pluriel(a.seancesCreees, "séance du direct sera créée", "séances du direct seront créées"),
        a.seancesMisesAJour - retablies > 0 && pluriel(a.seancesMisesAJour - retablies, "séance sera modifiée", "séances seront modifiées"),
        retablies && pluriel(retablies, "séance annulée sera rétablie", "séances annulées seront rétablies"),
        a.seancesAnnulees && pluriel(a.seancesAnnulees, "séance sera annulée", "séances seront annulées"),
      ].filter(Boolean)
    : [];
  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre={a?.premiere ?? session.statut !== "publiee" ? "Publier l'emploi du temps ?" : "Mettre à jour les séances ?"}
      description={a?.premiere ? "Voici ce qui va se passer. Rien n'est encore envoyé." : "Voici ce qui va changer dans les séances du direct. Rien n'est encore appliqué."}
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={confirmer} chargement={envoi} disabled={!a} icone={a?.premiere ? <Send className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}>
            {a?.premiere ? "Publier maintenant" : rien ? "Confirmer" : "Appliquer les changements"}
          </Bouton>
        </>
      }
    >
      {isLoading ? (
        <Chargement lignes={2} />
      ) : error ? (
        <Erreur message={(error as Error).message} />
      ) : a ? (
        <div className="flex flex-col gap-4 pb-2">
          {rien ? (
            <p className="rounded-2xl bg-creme px-4 py-3 text-[15px] text-texte-doux">Aucune séance ne change : elles correspondent déjà à l'emploi du temps. Confirmez pour le marquer comme à jour.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-[15px]">
              {lignes.map((l) => (
                <li key={String(l)} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" /> {l}
                </li>
              ))}
              {(a.etudiants > 0 || a.intervenants > 0) && (
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" />
                  Une notification pour {[a.etudiants && pluriel(a.etudiants, "étudiant"), a.intervenants && pluriel(a.intervenants, "intervenant")].filter(Boolean).join(" et ")}.
                </li>
              )}
              {a.premiere && (
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" />
                  L'emploi du temps apparaît sur le site public, dans l'espace des étudiants et des formateurs, et sur 2iae.com.
                </li>
              )}
            </ul>
          )}
          {!a.premiere && a.changements.length > 0 && (
            <ul className="flex flex-col divide-y divide-ligne-douce rounded-2xl border border-ligne text-[14.5px]">
              {a.changements.slice(0, 12).map((c, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-2">
                  <span>
                    <strong>{c.libelle}</strong> · {libelleJour(c.date)}
                  </span>
                  <span className={cn("font-mono text-xs", c.nature === "annulee" ? "text-danger" : "text-texte-pale")}>
                    {NATURES[c.nature]}
                    {c.motif ? ` · ${c.motif}` : ""}
                  </span>
                </li>
              ))}
              {a.changements.length > 12 && <li className="px-4 py-2 text-texte-pale">et {a.changements.length - 12} autres</li>}
            </ul>
          )}
          {a.avertissements.length > 0 && (
            <div className="rounded-2xl border border-alerte/40 bg-alerte-clair p-4">
              <p className="mb-1 flex items-center gap-2 font-extrabold text-alerte">
                <TriangleAlert className="h-4 w-4" /> À vérifier
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-6 text-[14.5px] text-texte-doux">
                {a.avertissements.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </Fenetre>
  );
}

// ── Bilan de publication ───────────────────────────────────────────────────

function FenetreBilan({ bilan, session, onFermer }: { bilan: BilanPublication; session: SessionEditionDto; onFermer: () => void }) {
  const rien = !bilan.seancesCreees && !bilan.seancesMisesAJour && !bilan.seancesAnnulees;
  const chiffres = [
    { n: bilan.seancesCreees, l: pluriel(bilan.seancesCreees, "séance créée", "séances créées") },
    { n: bilan.seancesMisesAJour, l: bilan.seancesMisesAJour > 1 ? "modifiées" : "modifiée" },
    { n: bilan.seancesAnnulees, l: bilan.seancesAnnulees > 1 ? "annulées" : "annulée" },
    { n: bilan.seancesInchangees, l: "déjà à jour" },
  ];
  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre={bilan.premiere ? "Emploi du temps publié" : rien ? "Tout était déjà à jour" : "Séances mises à jour"}
      description={
        bilan.premiere
          ? `« ${session.titre} » est en ligne sur le site public et dans l'espace de chacun.`
          : rien
            ? "Les séances du direct correspondaient déjà à l'emploi du temps : rien n'a changé."
            : "Les séances du direct correspondent maintenant à l'emploi du temps."
      }
      pied={
        <>
          <LienBouton href={`/programme/${session.id}`} variante="contour">
            Voir la page publique
          </LienBouton>
          <Bouton onClick={onFermer}>Fermer</Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {chiffres.map((c) => (
            <div key={c.l} className={cn("rounded-2xl px-3 py-3 text-center", c.n ? "bg-orange-clair" : "bg-creme")}>
              <div className="text-3xl font-black tabular-nums">{c.n}</div>
              <div className="text-[13px] font-semibold text-texte-doux">{c.l}</div>
            </div>
          ))}
        </div>
        {(bilan.etudiantsPrevenus > 0 || bilan.intervenantsPrevenus > 0) && (
          <p className="flex items-start gap-2 text-[15px] text-texte-doux">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-succes" />
            {[bilan.etudiantsPrevenus && pluriel(bilan.etudiantsPrevenus, "étudiant prévenu", "étudiants prévenus"), bilan.intervenantsPrevenus && pluriel(bilan.intervenantsPrevenus, "intervenant prévenu", "intervenants prévenus")]
              .filter(Boolean)
              .join(" et ")}{" "}
            (une notification chacun).
          </p>
        )}
        {bilan.creneauxIgnores > 0 && <p className="text-[15px] text-texte-doux">{pluriel(bilan.creneauxIgnores, "créneau sans cours ignoré", "créneaux sans cours ignorés")} : aucune séance pour eux.</p>}
        {bilan.avertissements.length > 0 && (
          <div className="rounded-2xl border border-alerte/40 bg-alerte-clair p-4">
            <p className="mb-1 flex items-center gap-2 font-extrabold text-alerte">
              <TriangleAlert className="h-4 w-4" /> À vérifier
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-6 text-[14.5px] text-texte-doux">
              {bilan.avertissements.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Fenetre>
  );
}

// ── Semaines : occurrences datées et jours sans cours ──────────────────────

function VueSemaines({ session, modifiable, surChange }: { session: SessionEditionDto; modifiable: boolean; surChange: () => void }) {
  const url = `/api/pilotage/programme/sessions/${session.id}/occurrences`;
  const { data, isLoading, error, refetch } = useQuery<OccurrenceDto[]>({ queryKey: [url] });
  const [exception, setException] = useState<OccurrenceDto | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);

  const retablir = async (o: OccurrenceDto) => {
    const e = session.exceptions.find((x) => x.date === o.date && (x.creneauId === o.creneauId || x.creneauId === null));
    if (!e) return;
    setEnvoi(`${o.creneauId}-${o.date}`);
    try {
      const r = await suppr<{ seancesRetablies: number; seancesCreees: number }>(`/api/pilotage/programme/exceptions/${e.id}`);
      toast(r.seancesRetablies || r.seancesCreees ? "Cours rétabli : les étudiants sont prévenus." : "Jour rétabli.");
      await Promise.all([refetch(), surChange()]);
      void rafraichir("/api/programme", "/api/public/programme", "/api/seances");
    } catch (err) {
      toastErreur(err);
    } finally {
      setEnvoi(null);
    }
  };

  if (isLoading) return <Chargement lignes={3} />;
  if (error) return <Erreur message={(error as Error).message} reessayer={() => refetch()} />;
  if (!data?.length) {
    return <EtatVide icone={<CalendarRange className="h-6 w-6" />} titre="Aucune date pour l'instant." texte="Ajoutez des créneaux dans la grille : chaque date de la session apparaîtra ici, semaine par semaine." />;
  }
  return (
    <div className="flex flex-col gap-6">
      {session.statut !== "publiee" && modifiable && (
        <p className="text-[15px] text-texte-pale">Vous pouvez déjà marquer les jours sans cours (férié, empêchement) : aucune séance ne sera créée ces jours-là à la publication.</p>
      )}
      {parSemaine(data).map((sem, i) => (
        <section key={sem.lundi} className="flex flex-col gap-3">
          <h3 className="text-lg font-extrabold">
            Semaine {i + 1} · du {jourMois(sem.lundi)}
          </h3>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {parJour(sem.occurrences).map((j) => (
              <article key={j.date} className="flex flex-col gap-2 rounded-2xl border border-ligne bg-white p-3.5">
                <h4 className="text-[15px] font-extrabold">{libelleJour(j.date, { majuscule: true })}</h4>
                {j.occurrences.map((o) => {
                  const cle = `${o.creneauId}-${o.date}`;
                  const parException = o.statut === "annulee" && session.exceptions.some((x) => x.date === o.date && (x.creneauId === o.creneauId || x.creneauId === null));
                  return (
                    <div key={cle} className={cn("flex flex-col gap-1.5 rounded-xl border-l-4 px-3 py-2.5", o.statut === "annulee" ? "bg-danger-clair/50" : "bg-creme/70")} style={{ borderLeftColor: o.statut === "annulee" ? "#C2410C" : (o.couleur ?? "#8A7F76") }}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[13px] font-semibold text-texte-doux">
                          {heureAbidjan(o.debut)}–{heureAbidjan(o.fin)}
                        </span>
                        {o.statut === "en_direct" ? (
                          <BadgeDirect className="px-2 py-1 text-[10px]" />
                        ) : o.statut === "annulee" ? (
                          <Badge ton="danger">Annulé</Badge>
                        ) : o.statut === "terminee" ? (
                          <Badge ton="gris">Terminé</Badge>
                        ) : o.seanceId ? (
                          <Badge ton="succes">Séance créée</Badge>
                        ) : o.type === "cours" && session.statut === "publiee" ? (
                          <Badge ton="alerte">À créer</Badge>
                        ) : (
                          <Badge ton="gris">Prévu</Badge>
                        )}
                      </div>
                      <span className={cn("font-extrabold leading-snug", o.statut === "annulee" && "text-texte-pale line-through")}>{o.libelle}</span>
                      {o.intervenant && <span className="text-[13px] text-texte-pale">{o.intervenant}</span>}
                      {o.statut === "annulee" && o.motif && <span className="text-[13px] font-semibold text-danger">{o.motif}</span>}
                      <div className="mt-1 flex flex-wrap gap-2">
                        {o.seanceId && o.statut !== "annulee" && (
                          <Link href={`/enseigner/seances/${o.seanceId}`} className="inline-flex min-h-[40px] items-center rounded-[10px] bg-white px-3 text-[13px] font-bold text-encre no-underline ring-1 ring-ligne hover:ring-orange">
                            Voir la séance
                          </Link>
                        )}
                        {modifiable && o.statut === "prevue" && (
                          <button type="button" onClick={() => setException(o)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-bold text-danger hover:bg-danger-clair">
                            <CalendarOff className="h-4 w-4" /> Pas de cours ce jour-là
                          </button>
                        )}
                        {modifiable && parException && (
                          <Bouton variante="contour" taille="sm" chargement={envoi === cle} onClick={() => retablir(o)} icone={<Undo2 className="h-4 w-4" />} className="min-h-[40px]">
                            Rétablir
                          </Bouton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
        </section>
      ))}
      {exception && (
        <FenetreException
          session={session}
          o={exception}
          onFermer={() => setException(null)}
          surFait={async () => {
            setException(null);
            await Promise.all([refetch(), surChange()]);
            void rafraichir("/api/programme", "/api/public/programme", "/api/seances");
          }}
        />
      )}
    </div>
  );
}

const MOTIFS = ["Jour férié", "Empêchement du formateur", "Examens", "Coupure prévue (électricité, réseau)"];

function FenetreException({ session, o, onFermer, surFait }: { session: SessionEditionDto; o: OccurrenceDto; onFermer: () => void; surFait: () => void }) {
  const [motif, setMotif] = useState("");
  const [journee, setJournee] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const autres = session.creneaux.filter((c) => c.jour === o.jour && c.id !== o.creneauId);
  const valider = async () => {
    setEnvoi(true);
    try {
      const r = await post<{ seancesAnnulees: number }>(`/api/pilotage/programme/sessions/${session.id}/exceptions`, { date: o.date, creneauId: journee ? null : o.creneauId, motif: motif.trim() });
      toast(r.seancesAnnulees ? `${pluriel(r.seancesAnnulees, "séance annulée", "séances annulées")} : les étudiants sont prévenus.` : "Jour marqué sans cours.");
      surFait();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre="Pas de cours ce jour-là"
      description={`${o.libelle} · ${libelleJour(o.date)} de ${heureAbidjan(o.debut)} à ${heureAbidjan(o.fin)}.`}
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton variante="danger" onClick={valider} chargement={envoi} disabled={motif.trim().length < 3}>
            Confirmer
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex flex-wrap gap-2">
          {MOTIFS.map((m) => (
            <button key={m} type="button" onClick={() => setMotif(m)} className={cn("min-h-[40px] rounded-full border px-3 text-[13px] font-semibold", motif === m ? "border-encre bg-encre text-white" : "border-ligne bg-white text-texte-doux hover:border-orange")}>
              {m}
            </button>
          ))}
        </div>
        <Champ libelle="Motif (affiché aux étudiants)" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200} placeholder="Jour férié : fête nationale" />
        {autres.length > 0 && (
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#E4793A]" checked={journee} onChange={(e) => setJournee(e.target.checked)} />
            <span className="text-[15px]">
              <span className="font-semibold">Toute la journée du {JOURS[o.jour].toLowerCase()}</span>
              <span className="block text-[13px] text-texte-gris">Aussi : {autres.map((c) => c.libelle).join(", ")}.</span>
            </span>
          </label>
        )}
        {session.statut === "publiee" && o.seanceId && (
          <p className="rounded-xl bg-creme px-3 py-2 text-[14px] text-texte-doux">La séance prévue est annulée tout de suite, avec ce motif, et les étudiants et l'intervenant sont prévenus. Vous pourrez la rétablir.</p>
        )}
      </div>
    </Fenetre>
  );
}
