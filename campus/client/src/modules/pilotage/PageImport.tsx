// /pilotage/comptes/import : coller la liste de la scolarité depuis Excel
// (ou un CSV), voir l'aperçu avec les erreurs en rouge, créer les comptes,
// puis imprimer les fiches de connexion.
//
// Un import de 1 500 étudiants prend une à deux minutes : la progression
// s'affiche, et le lot porte un identifiant. Si la connexion se coupe, le
// serveur continue et la page récupère les fiches toute seule ; si la page a
// été fermée, « Refaire les fiches » les redonne (jamais de doublon).
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ClipboardPaste, CheckCircle2, Printer, RotateCcw, TriangleAlert, CircleX, ArrowLeft, History } from "lucide-react";
import type { ApercuImport, LigneImport, LotFiches, LotImportEnAttente } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Selection } from "@/components/ui/champs";
import { Badge } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import { post, ErreurApi } from "@/lib/api";
import { dateEtHeure } from "@/lib/dates";
import { rafraichir } from "@/lib/queryClient";
import { cn, pluriel } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { SuiviTravail } from "./composants/SuiviTravail";
import { useReferences, telephoneLisible, memoriserFiches, lienFiches, nouvelIdentifiant, travailLong, type EtatTravail } from "./outils";

const EXEMPLE = "Matricule\tNom\tPrénoms\tTéléphone\tClasse\n24GC0123\tKOUASSI\tAya Grâce\t07 07 12 34 56\tBTS Gestion commerciale · 1re année";

export default function PageImport() {
  const [, naviguer] = useLocation();
  const refs = useReferences();
  const [texte, setTexte] = useState("");
  const [classeId, setClasseId] = useState("");
  const [apercu, setApercu] = useState<ApercuImport | null>(null);
  const [resultat, setResultat] = useState<LotFiches | null>(null);
  const [refaite, setRefaite] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [etat, setEtat] = useState<EtatTravail | null>(null);
  // Identifiant du lot : gardé tant qu'on n'a pas reçu ses fiches (relancer ne crée aucun doublon).
  const [lotId, setLotId] = useState(nouvelIdentifiant);
  const [lotRepris, setLotRepris] = useState<string | null>(null);
  const enAttente = useQuery<LotImportEnAttente[]>({ queryKey: ["/api/pilotage/import/lots"] });

  const voirApercu = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      setApercu(await post<ApercuImport>("/api/pilotage/import/apercu", { texte, classeId: classeId ? Number(classeId) : null, lotId }));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Une erreur est survenue.");
    } finally {
      setEnvoi(false);
    }
  };

  /** Fiches reçues : on le dit au serveur (le lot ne sera plus proposé à « Refaire les fiches »). */
  const recu = async (lot: LotFiches, estRefaite: boolean) => {
    memoriserFiches(lot.fiches);
    setResultat(lot);
    setRefaite(estRefaite);
    if (lot.lotId) await post(`/api/pilotage/import/lots/${lot.lotId}/remis`).catch(() => undefined);
    const crees = lot.fiches.length - (lot.repris ?? 0);
    toast(estRefaite || !crees ? pluriel(lot.fiches.length, "fiche prête", "fiches prêtes") : pluriel(crees, "compte créé", "comptes créés"));
    await rafraichir("/api/pilotage");
    window.scrollTo({ top: 0 });
  };

  const creer = async () => {
    if (!apercu) return;
    const valides = apercu.lignes.filter((l) => !l.erreurs.length);
    setEnvoi(true);
    setErreur(null);
    setEtat(null);
    try {
      const lot = await travailLong<LotFiches>(
        "/api/pilotage/import/valider",
        { lotId, lignes: valides.map(({ numero, matricule, nom, prenom, telephone, email, classeId: c }) => ({ numero, matricule, nom, prenom, telephone, email, classeId: c })) },
        lotId,
        setEtat,
      );
      await recu(lot, false);
    } catch (e) {
      setErreur(
        e instanceof ErreurApi && e.statut > 0
          ? e.message
          : "La connexion ne revient pas. Les comptes déjà créés ne sont pas perdus : touchez « Créer » à nouveau dès le retour du réseau (sans doublon), ou rouvrez cette page plus tard pour « Refaire les fiches ».",
      );
    } finally {
      setEnvoi(false);
      setEtat(null);
    }
  };

  /** Import dont les fiches ne sont jamais arrivées : les mêmes (import récent) ou de nouveaux codes. */
  const refaire = async (l: LotImportEnAttente) => {
    setEnvoi(true);
    setLotRepris(l.id);
    setErreur(null);
    setEtat(null);
    try {
      await recu(await travailLong<LotFiches>(`/api/pilotage/import/lots/${l.id}/fiches`, {}, l.id, setEtat), true);
    } catch (e) {
      setErreur(e instanceof ErreurApi && e.statut > 0 ? e.message : "La connexion ne revient pas : réessayez dans un instant.");
    } finally {
      setEnvoi(false);
      setLotRepris(null);
      setEtat(null);
    }
  };

  const oublierLot = async (l: LotImportEnAttente) => {
    await post(`/api/pilotage/import/lots/${l.id}/remis`).catch(() => undefined);
    await enAttente.refetch();
  };

  const recommencer = () => {
    setTexte("");
    setApercu(null);
    setResultat(null);
    setRefaite(false);
    setErreur(null);
    setLotId(nouvelIdentifiant());
  };

  // ── Étape 3 : c'est fait ────────────────────────────────────────────────
  if (resultat) {
    const ids = resultat.fiches.map((f) => f.id);
    const crees = resultat.fiches.length - (resultat.repris ?? 0);
    const titre = refaite
      ? pluriel(resultat.fiches.length, "fiche prête", "fiches prêtes")
      : crees > 0
        ? pluriel(crees, "compte créé", "comptes créés")
        : pluriel(resultat.repris ?? 0, "fiche refaite", "fiches refaites");
    return (
      <Page>
        <SousNav />
        <div className="flex flex-col items-start gap-4 rounded-[28px] bg-creme p-6 sm:p-10">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-succes-clair text-succes">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h1 className="titre-page">{titre}.</h1>
          <p className="max-w-2xl text-base text-texte-doux">
            {refaite
              ? "Nouveaux codes pour les comptes de cet import qui n'ont pas encore choisi leur code secret : les fiches perdues ne marchent plus. "
              : ""}
            Chaque étudiant a un code provisoire à 6 chiffres, valable 30 jours, et un QR qui l'emmène choisir son propre code. Imprimez les fiches maintenant : les codes ne seront plus affichés ensuite (il faudrait en créer de nouveaux).
          </p>
          {!refaite && (resultat.repris ?? 0) > 0 && (
            <p className="max-w-2xl text-[15px] text-texte-doux">
              {pluriel(resultat.repris!, "compte était déjà créé", "comptes étaient déjà créés")} par ce même import (réponse perdue en route) : {resultat.repris! > 1 ? "leurs fiches sont refaites" : "sa fiche est refaite"}, sans doublon.
            </p>
          )}
          {resultat.ignores > 0 && (
            <p className="max-w-2xl text-[15px] text-texte-doux">
              {pluriel(resultat.ignores, "compte a", "comptes ont")} déjà choisi leur code secret : pas de nouvelle fiche pour eux.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {resultat.fiches.length > 0 && (
              <Bouton taille="lg" icone={<Printer className="h-5 w-5" />} onClick={() => naviguer(lienFiches(ids))}>
                Imprimer les {resultat.fiches.length} fiches
              </Bouton>
            )}
            <Bouton taille="lg" variante="contour" icone={<RotateCcw className="h-5 w-5" />} onClick={recommencer}>
              Importer un autre lot
            </Bouton>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {resultat.fiches.map((f) => (
            <li key={f.id} className="rounded-xl border border-ligne px-4 py-3">
              <div className="font-bold">
                {f.prenom} {f.nom}
              </div>
              <div className="text-sm text-texte-pale">
                <span className="font-mono">{f.identifiant}</span> · {f.classe}
              </div>
            </li>
          ))}
        </ul>
      </Page>
    );
  }

  // ── Étape 2 : l'aperçu ──────────────────────────────────────────────────
  if (apercu) {
    const valides = apercu.lignes.filter((l) => !l.erreurs.length);
    const avertis = apercu.lignes.filter((l) => l.avertissements.length && !l.erreurs.length).length;
    return (
      <Page>
        <SousNav />
        <EnTetePage
          etiquette="Import · étape 2 sur 2"
          titre="Vérifiez l'aperçu"
          sousTitre="Rien n'est encore créé. Les lignes en rouge seront laissées de côté : corrigez-les dans Excel puis recollez-les plus tard."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Resume valeur={valides.length} libelle="prêtes à créer" ton="succes" />
          <Resume valeur={apercu.enErreur} libelle="à corriger" ton={apercu.enErreur ? "danger" : "gris"} />
          <Resume valeur={avertis} libelle="avec une remarque" ton={avertis ? "alerte" : "gris"} />
          <Resume valeur={apercu.lignes.length} libelle="lignes lues" ton="gris" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-texte-pale">
          <span>Colonnes reconnues ({apercu.separateur}) :</span>
          {apercu.colonnes.map((c, i) => (
            <Badge key={i} ton={c.champ ? "orange" : "gris"}>
              {c.entete || "(vide)"} {c.champ ? `→ ${c.champ}` : "· ignorée"}
            </Badge>
          ))}
        </div>

        <TableauApercu lignes={apercu.lignes} />

        {erreur && (
          <p role="alert" className="rounded-xl bg-danger-clair px-4 py-3 font-semibold text-danger">
            {erreur}
          </p>
        )}
        <div className="bas-sur sticky bottom-[72px] z-10 -mx-4 flex flex-wrap gap-3 border-t border-ligne-douce bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0">
          {envoi && <SuiviTravail etat={etat} attente={`Envoi des ${valides.length} lignes…`} />}
          <Bouton variante="contour" icone={<ArrowLeft className="h-4 w-4" />} onClick={() => setApercu(null)} className="px-4" disabled={envoi}>
            Modifier
          </Bouton>
          <Bouton taille="lg" className="flex-1 whitespace-nowrap sm:flex-none" onClick={creer} chargement={envoi} disabled={!valides.length}>
            {envoi ? `Création de ${valides.length} comptes…` : valides.length ? `Créer ${pluriel(valides.length, "compte")}` : "Aucune ligne à créer"}
          </Bouton>
        </div>
      </Page>
    );
  }

  // ── Étape 1 : coller ────────────────────────────────────────────────────
  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Import · étape 1 sur 2"
        titre="Importer des étudiants"
        sousTitre="Dans Excel, sélectionnez le tableau AVEC sa ligne d'en-têtes, copiez (Ctrl+C), puis collez-le ci-dessous (Ctrl+V). Un fichier CSV ouvert dans le Bloc-notes marche aussi."
      />
      {(enAttente.data ?? []).map((l) => (
        <section key={l.id} className="flex flex-col gap-3 rounded-2xl border border-alerte bg-alerte-clair p-5 text-alerte" aria-label="Import dont les fiches ne sont pas arrivées">
          <div className="flex items-start gap-3">
            <History className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-[15px]">
              <strong>Import du {dateEtHeure(l.creeLe)}</strong> : {pluriel(l.comptes, "compte créé", "comptes créés")}, mais leurs fiches ne sont jamais arrivées (connexion coupée ou page fermée).{" "}
              {l.nonActives < l.comptes ? `${pluriel(l.nonActives, "compte n'est", "comptes ne sont")} pas encore activé${l.nonActives > 1 ? "s" : ""}.` : ""} Refaites les fiches : de nouveaux codes, et aucun compte en double.
            </p>
          </div>
          {envoi && lotRepris === l.id ? (
            <SuiviTravail etat={etat} attente="Préparation des fiches…" />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Bouton icone={<Printer className="h-4 w-4" />} onClick={() => refaire(l)} disabled={envoi}>
                {l.nonActives > 1 ? `Refaire les ${l.nonActives} fiches` : "Refaire la fiche"}
              </Bouton>
              <Bouton variante="contour" onClick={() => oublierLot(l)} disabled={envoi}>
                Les fiches sont déjà imprimées
              </Bouton>
            </div>
          )}
        </section>
      ))}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <label htmlFor="texte-import" className="text-sm font-bold">
            Le tableau copié depuis Excel
          </label>
          <textarea
            id="texte-import"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={12}
            wrap="off"
            spellCheck={false}
            placeholder={EXEMPLE}
            className="min-h-[260px] w-full rounded-2xl border border-ligne bg-white p-4 font-mono text-[13px] leading-relaxed outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />
          <Selection
            libelle="Classe pour tout le lot (si le tableau n'a pas de colonne Classe)"
            value={classeId}
            onChange={(e) => setClasseId(e.target.value)}
            aide="Laissez vide si chaque ligne indique sa classe."
          >
            <option value="">Chaque ligne indique sa classe</option>
            {(refs.data?.sites ?? []).map((s) => {
              const liste = (refs.data?.classes ?? []).filter((c) => c.siteId === s.id);
              return liste.length ? (
                <optgroup key={s.id} label={s.nomCourt}>
                  {liste.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </Selection>
          {erreur && (
            <p role="alert" className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">
              {erreur}
            </p>
          )}
          <Bouton taille="lg" icone={<ClipboardPaste className="h-5 w-5" />} onClick={voirApercu} chargement={envoi} disabled={!texte.trim()} className="min-h-[56px] sm:self-start">
            Voir l'aperçu
          </Bouton>
        </div>
        <aside className="flex flex-col gap-3 rounded-2xl bg-creme p-5 text-[15px] leading-relaxed text-texte-doux">
          <h2 className="text-lg font-extrabold text-encre">Colonnes reconnues</h2>
          <ul className="flex flex-col gap-1.5">
            <li><strong className="text-encre">Matricule</strong> · obligatoire, c'est l'identifiant</li>
            <li><strong className="text-encre">Nom</strong> et <strong className="text-encre">Prénom(s)</strong>, ou une seule colonne « Nom et prénoms »</li>
            <li><strong className="text-encre">Téléphone</strong> · les numéros sont remis au format 07 07 12 34 56</li>
            <li><strong className="text-encre">E-mail</strong> · facultatif</li>
            <li><strong className="text-encre">Classe</strong> et <strong className="text-encre">Campus</strong> · la classe doit déjà exister</li>
          </ul>
          <p className="text-sm text-texte-pale">Les colonnes inconnues sont ignorées. Un matricule déjà inscrit n'est jamais recréé.</p>
          <LienBouton href="/pilotage/classes" variante="contour" taille="sm" className="self-start">
            Voir les classes
          </LienBouton>
        </aside>
      </div>
    </Page>
  );
}

function Resume({ valeur, libelle, ton }: { valeur: number; libelle: string; ton: "succes" | "danger" | "alerte" | "gris" }) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4",
        ton === "succes" && "bg-succes-clair text-succes",
        ton === "danger" && "bg-danger-clair text-danger",
        ton === "alerte" && "bg-alerte-clair text-alerte",
        ton === "gris" && "bg-creme text-texte-doux",
      )}
    >
      <div className="text-3xl font-black">{valeur}</div>
      <div className="text-sm font-semibold">{libelle}</div>
    </div>
  );
}

function Problemes({ l }: { l: LigneImport }) {
  if (!l.erreurs.length && !l.avertissements.length) return <span className="text-succes">Prête</span>;
  return (
    <ul className="flex flex-col gap-1">
      {l.erreurs.map((e) => (
        <li key={e} className="flex items-start gap-1.5 font-semibold text-danger">
          <CircleX className="mt-0.5 h-4 w-4 shrink-0" /> {e}
        </li>
      ))}
      {l.avertissements.map((a) => (
        <li key={a} className="flex items-start gap-1.5 text-alerte">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {a}
        </li>
      ))}
    </ul>
  );
}

function TableauApercu({ lignes }: { lignes: LigneImport[] }) {
  return (
    <>
      {/* Téléphone : une carte par ligne. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {lignes.map((l) => (
          <li key={l.numero} className={cn("rounded-2xl border p-4", l.erreurs.length ? "border-danger bg-danger-clair" : "border-ligne bg-white")}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold">
                {l.prenom || "?"} {l.nom || "?"}
              </span>
              <span className="font-mono text-xs text-texte-gris">ligne {l.numero}</span>
            </div>
            <div className="mt-0.5 text-sm text-texte-pale">
              <span className="font-mono">{l.matricule || "sans matricule"}</span>
              {l.telephone ? ` · ${telephoneLisible(l.telephone)}` : ""}
            </div>
            {l.classe && <div className="text-sm text-texte-pale">{l.classe}</div>}
            <div className="mt-2 text-sm">
              <Problemes l={l} />
            </div>
          </li>
        ))}
      </ul>
      {/* Ordinateur : un vrai tableau. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-ligne md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-creme font-mono text-xs uppercase tracking-wider text-texte-gris">
            <tr>
              <th className="px-3 py-3">Ligne</th>
              <th className="px-3 py-3">Matricule</th>
              <th className="px-3 py-3">Nom</th>
              <th className="px-3 py-3">Prénom(s)</th>
              <th className="px-3 py-3">Téléphone</th>
              <th className="px-3 py-3">Classe</th>
              <th className="px-3 py-3">État</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ligne-douce">
            {lignes.map((l) => (
              <tr key={l.numero} className={cn(l.erreurs.length ? "bg-danger-clair" : "bg-white")}>
                <td className="px-3 py-2.5 font-mono text-texte-gris">{l.numero}</td>
                <td className="px-3 py-2.5 font-mono font-semibold">{l.matricule || "–"}</td>
                <td className="px-3 py-2.5 font-semibold">{l.nom || "–"}</td>
                <td className="px-3 py-2.5">{l.prenom || "–"}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{telephoneLisible(l.telephone) || "–"}</td>
                <td className="px-3 py-2.5">{l.classe ?? "–"}</td>
                <td className="px-3 py-2.5">
                  <Problemes l={l} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
