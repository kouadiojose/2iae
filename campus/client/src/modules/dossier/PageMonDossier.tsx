// /mon-dossier (étudiant) : sa scolarité (ce qui reste à payer, l'échéancier,
// ses paiements et leurs reçus) et les pièces de son dossier, qu'il peut
// envoyer en photo depuis son téléphone. Beaucoup d'étudiants découvrent
// l'ordinateur : de grands blocs, peu de mots, un seul geste par pièce.
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Camera, CheckCircle2, ChevronRight, CircleDashed, Clock, Loader2, ReceiptText, TriangleAlert } from "lucide-react";
import type { EcheanceEtat, MonDossier, PieceDossier, ScolariteEtudiant, SituationFinanciere, VersementCrm } from "@shared/schema";
import { api, alleger, post, type FichierTeleverse } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Page } from "@/components/layout/coquille";
import { TitreSection } from "@/components/ui/carte";
import { Badge, BarreProgression, Chargement, Erreur } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { ETATS_ECHEANCE, ETATS_PIECE, fcfa, jourCourt, libelleMoyen } from "@/modules/pilotage/outils-crm";
import { LienWhatsApp, classeEtCampus } from "@/modules/pilotage/composants/ScolariteElements";

const CLE = ["/api/mon-dossier"];

export default function PageMonDossier() {
  const { data, isLoading, error, refetch } = useQuery<MonDossier>({ queryKey: CLE });

  if (error && !data) {
    return (
      <Page className="max-w-3xl">
        <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
      </Page>
    );
  }
  if (isLoading || !data) {
    return (
      <Page className="max-w-3xl">
        <Chargement lignes={4} />
      </Page>
    );
  }

  const { identite, scolarite, pieces } = data;
  const lieu = classeEtCampus(identite.classe, identite.site);
  return (
    <Page className="max-w-3xl gap-9">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-xs text-texte-gris">
          {identite.prenom} {identite.nom}
        </span>
        <h1 className="titre-page">Mon dossier</h1>
        {lieu && <p className="text-[15px] text-texte-pale">{lieu}</p>}
        {identite.matricule && (
          <p className="self-start rounded-full bg-creme px-3.5 py-1.5 text-sm text-texte-doux">
            Matricule <span className="font-mono font-semibold text-encre">{identite.matricule}</span>
          </p>
        )}
      </header>

      <MaScolarite scolarite={scolarite} />
      {(scolarite.situation || scolarite.versements.length > 0) && <MesPaiements versements={scolarite.versements} />}
      <MesPieces pieces={pieces} />
      <Aide lien={data.whatsappVieScolaire} />
    </Page>
  );
}

// ── Ma scolarité ───────────────────────────────────────────────────────────

function MaScolarite({ scolarite }: { scolarite: ScolariteEtudiant }) {
  const s = scolarite.situation;
  const frais = scolarite.echeances.filter((e) => e.type === "frais");
  const remises = scolarite.echeances.filter((e) => e.type === "remise");
  return (
    <section aria-labelledby="titre-scolarite" className="flex flex-col gap-4">
      <TitreSection titre={<span id="titre-scolarite">Ma scolarité</span>} action={s ? <span className="font-mono text-xs text-texte-gris">{s.anneeScolaire}</span> : undefined} className="mb-0" />
      {!s ? (
        <div className="flex items-start gap-4 rounded-[24px] bg-creme p-5 sm:p-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-orange-fonce">
            <Clock className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-base leading-relaxed text-texte-doux">
            Ton échéancier n'est pas encore enregistré. <strong className="text-encre">La vie scolaire s'en occupe.</strong>
          </p>
        </div>
      ) : (
        <>
          <CarteSituation s={s} />
          {(frais.length > 0 || remises.length > 0) && (
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-extrabold">Mon échéancier</h3>
              <ul className="flex flex-col divide-y divide-ligne-douce overflow-hidden rounded-2xl border border-ligne bg-white">
                {frais.map((e) => (
                  <LigneEcheance key={e.id} e={e} />
                ))}
                {remises.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 bg-orange-pale px-4 py-3.5">
                    <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
                      Remise : {r.libelle}, <span className="whitespace-nowrap">−{fcfa(r.montant)}</span>
                    </p>
                    <Badge ton={ETATS_ECHEANCE.remise.ton}>{ETATS_ECHEANCE.remise.texte}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function CarteSituation({ s }: { s: SituationFinanciere }) {
  if (s.reste <= 0) {
    return (
      <div className="flex items-start gap-4 rounded-[24px] bg-succes-clair p-5 sm:p-7">
        <CheckCircle2 className="h-9 w-9 shrink-0 text-succes" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-[26px] font-black leading-tight tracking-serre text-succes">Ta scolarité est à jour</p>
          <p className="text-[15px] text-texte-doux">Tu as payé {fcfa(s.paye)} pour l'année {s.anneeScolaire}. Merci.</p>
        </div>
      </div>
    );
  }
  const taux = s.du > 0 ? Math.round((s.paye / s.du) * 100) : 0;
  return (
    <div className="flex flex-col gap-4 rounded-[24px] bg-creme p-5 sm:p-7">
      <div>
        <p className="text-lg font-bold text-texte-doux">Il te reste à payer</p>
        <p className="mt-1 text-[42px] font-black leading-none tabular-nums tracking-tres-serre sm:text-[52px]">
          {new Intl.NumberFormat("fr-FR").format(s.reste)}
          <span className="ml-2 whitespace-nowrap text-xl font-extrabold tracking-normal">F CFA</span>
        </p>
      </div>
      <BarreProgression valeur={taux} className="h-2.5 bg-white" />
      <p className="text-[15px] text-texte-doux">
        Déjà payé : <strong className="text-encre">{fcfa(s.paye)}</strong> sur {fcfa(s.du)}.
      </p>
      {s.retard > 0 && (
        <p className="flex items-start gap-3 rounded-2xl bg-danger-clair p-4 text-base font-bold text-danger">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          Dont {fcfa(s.retard)} en retard.
        </p>
      )}
      {s.prochaine && (
        <p className="flex items-start gap-3 rounded-2xl bg-white p-4 text-[15px] leading-relaxed">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
          <span>
            Prochaine échéance : <strong>{s.prochaine.libelle}</strong>, <span className="whitespace-nowrap">{fcfa(s.prochaine.reste)}</span>
            {s.prochaine.date ? (
              <>
                {" "}
                avant le <span className="whitespace-nowrap">{jourCourt(s.prochaine.date)}</span>
              </>
            ) : null}
          </span>
        </p>
      )}
    </div>
  );
}

function LigneEcheance({ e }: { e: EcheanceEtat }) {
  const etat = ETATS_ECHEANCE[e.etat];
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold leading-snug">{e.libelle}</p>
        <p className="mt-0.5 text-sm text-texte-pale">
          {e.dateLimite ? `Avant le ${jourCourt(e.dateLimite)}` : "Sans date limite"}
          {e.couvert > 0 && e.etat !== "payee" ? ` · déjà payé ${fcfa(e.couvert)}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="whitespace-nowrap text-[15px] font-extrabold tabular-nums">{fcfa(e.net)}</span>
        {e.net !== e.montant && <s className="whitespace-nowrap text-xs text-texte-gris">{fcfa(e.montant)}</s>}
        <Badge ton={etat.ton}>{etat.texte}</Badge>
      </div>
    </li>
  );
}

// ── Mes paiements ──────────────────────────────────────────────────────────

function MesPaiements({ versements }: { versements: VersementCrm[] }) {
  return (
    <section aria-labelledby="titre-paiements" className="flex flex-col gap-4">
      <TitreSection titre={<span id="titre-paiements">Mes paiements</span>} className="mb-0" />
      {!versements.length ? (
        <p className="rounded-2xl border border-dashed border-ligne px-5 py-6 text-center text-[15px] text-texte-pale">Aucun paiement enregistré pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {versements.map((v) => (
            <li key={v.id}>
              <Link
                href={`/mon-dossier/recus/${v.id}`}
                className={cn(
                  "group flex min-h-[72px] items-center gap-4 rounded-2xl border border-ligne bg-white p-4 text-encre no-underline hover:border-orange hover:text-encre",
                  v.annule && "bg-creme",
                )}
              >
                <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-full bg-orange-clair text-orange-fonce sm:grid">
                  <ReceiptText className="h-5 w-5" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-lg font-black tabular-nums", v.annule && "text-texte-gris line-through")}>{fcfa(v.montant)}</span>
                    {v.annule && <Badge ton="danger">Annulé</Badge>}
                  </span>
                  <span className="text-sm text-texte-pale">
                    {jourCourt(v.dateVersement)} · {libelleMoyen(v.moyen)}
                  </span>
                  <span className="font-mono text-xs text-texte-gris">Reçu {v.numero}</span>
                </span>
                <span className="flex shrink-0 items-center gap-0.5 text-sm font-bold text-orange-fonce group-hover:text-encre">
                  Voir le reçu
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Mes pièces du dossier ──────────────────────────────────────────────────

/** Envoie le fichier d'une pièce (une photo est allégée avant l'envoi, pour la 4G). */
async function televerserPiece(f: File): Promise<FichierTeleverse> {
  const leger = f.type.startsWith("image/") ? await alleger(f) : f;
  const donnees = new FormData();
  donnees.append("usage", "piece");
  donnees.append("fichiers", leger, leger.name);
  const [fichier] = await api<FichierTeleverse[]>("/api/fichiers", { methode: "POST", corps: donnees });
  return fichier;
}

const cleDe = (p: PieceDossier) => (p.id !== null ? `id-${p.id}` : `type-${p.type}`);

function MesPieces({ pieces }: { pieces: PieceDossier[] }) {
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [envoyees, setEnvoyees] = useState<Set<string>>(new Set());
  const requises = pieces.filter((p) => p.requise);
  const recues = requises.filter((p) => p.statut === "recue").length;

  const envoyer = async (p: PieceDossier, f: File) => {
    const cle = cleDe(p);
    setEnvoi(cle);
    try {
      const fichier = await televerserPiece(f);
      const nouvelles = await post<PieceDossier[]>("/api/mon-dossier/pieces", {
        type: p.type,
        fichierId: fichier.id,
        libelle: p.type === "autre" ? p.libelle : undefined,
      });
      queryClient.setQueryData<MonDossier>(CLE, (d) => (d ? { ...d, pieces: nouvelles } : d));
      // La pièce envoyée change d'identifiant (manquante → enregistrée) : on la retrouve par son type.
      const cible = p.type === "autre" ? nouvelles.filter((n) => n.type === "autre" && n.statut === "a_verifier").at(-1) : nouvelles.find((n) => n.type === p.type);
      setEnvoyees((s) => new Set(s).add(cle).add(cible ? cleDe(cible) : cle));
      toast("Envoyée, la vie scolaire va la vérifier");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  };

  return (
    <section aria-labelledby="titre-pieces" className="flex flex-col gap-4">
      <TitreSection
        titre={<span id="titre-pieces">Mes pièces du dossier</span>}
        action={requises.length ? <Badge ton={recues === requises.length ? "succes" : "gris"}>{`${recues} sur ${requises.length} reçues`}</Badge> : undefined}
        className="mb-0"
      />
      <ul className="flex flex-col gap-3">
        {pieces.map((p) => (
          <LignePiece key={cleDe(p)} p={p} enCours={envoi === cleDe(p)} occupe={envoi !== null} envoyee={envoyees.has(cleDe(p))} onFichier={(f) => void envoyer(p, f)} />
        ))}
      </ul>
    </section>
  );
}

function LignePiece({ p, enCours, occupe, envoyee, onFichier }: { p: PieceDossier; enCours: boolean; occupe: boolean; envoyee: boolean; onFichier: (f: File) => void }) {
  const aEnvoyer = p.statut === "manquante" || p.statut === "refusee";
  const etat = ETATS_PIECE[p.statut];
  const Icone = p.statut === "recue" ? CheckCircle2 : p.statut === "a_verifier" ? Clock : p.statut === "refusee" ? TriangleAlert : CircleDashed;
  return (
    <li className={cn("flex flex-col gap-3 rounded-2xl border bg-white p-4", p.statut === "refusee" ? "border-danger/40" : "border-ligne")}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-full",
            p.statut === "recue" && "bg-succes-clair text-succes",
            p.statut === "a_verifier" && "bg-alerte-clair text-alerte",
            p.statut === "refusee" && "bg-danger-clair text-danger",
            p.statut === "manquante" && "bg-creme text-texte-gris",
          )}
        >
          <Icone className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <p className="text-base font-bold leading-snug">{p.libelle}</p>
          <Badge ton={etat.ton}>{p.statut === "a_verifier" ? "En cours de vérification" : etat.texte}</Badge>
          {p.statut === "a_verifier" && envoyee && <p className="text-sm text-texte-pale">Envoyée, la vie scolaire va la vérifier.</p>}
          {p.statut === "recue" && <p className="text-sm text-succes">C'est bon, rien à faire.</p>}
        </div>
      </div>
      {p.statut === "refusee" && (
        <p className="rounded-xl bg-danger-clair px-3.5 py-2.5 text-[15px] text-danger">
          <strong>À refaire</strong>
          {p.note ? ` : ${p.note}` : " : envoie une nouvelle photo, bien lisible."}
        </p>
      )}
      {aEnvoyer && (
        <label
          className={cn(
            "flex min-h-[56px] cursor-pointer items-center justify-center gap-2.5 rounded-[14px] bg-orange px-5 text-base font-bold text-encre transition-colors focus-within:ring-2 focus-within:ring-encre focus-within:ring-offset-2 hover:bg-encre hover:text-white",
            occupe && "pointer-events-none opacity-60",
          )}
        >
          {enCours ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Camera className="h-5 w-5" aria-hidden />}
          {enCours ? "Envoi en cours…" : p.statut === "refusee" ? "Envoyer une nouvelle photo" : "Envoyer une photo"}
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            disabled={occupe}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) onFichier(f);
            }}
          />
        </label>
      )}
    </li>
  );
}

// ── Aide ───────────────────────────────────────────────────────────────────

function Aide({ lien }: { lien: string | null }) {
  return (
    <section className="flex flex-col gap-4 rounded-[24px] bg-encre p-5 text-white sm:p-7">
      <div className="flex flex-col gap-1.5">
        <p className="text-xl font-extrabold leading-snug">Une question sur ton dossier ou un paiement ?</p>
        <p className="text-[15px] text-nuit-doux">{lien ? "Écris à la vie scolaire de ton campus sur WhatsApp." : "Passe au bureau de la vie scolaire de ton campus."}</p>
      </div>
      {lien && (
        <LienWhatsApp href={lien} grand className="w-full sm:w-auto sm:self-start">
          Écrire à la vie scolaire
        </LienWhatsApp>
      )}
    </section>
  );
}
