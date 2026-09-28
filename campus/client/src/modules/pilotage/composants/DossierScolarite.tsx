// Onglet « Scolarité » du dossier étudiant : où il en est de ses paiements,
// son échéancier (frais et remises), ses versements avec reçu numéroté, et
// l'encaissement au guichet. Un versement ne s'efface jamais : il s'annule
// avec un motif et reste visible, barré.
import { useEffect, useState, type ReactNode } from "react";
import { Wallet, Receipt, MoreVertical, Pencil, Trash2, Plus, Percent, RotateCcw, Ban, CircleCheck, ExternalLink, CalendarRange } from "lucide-react";
import type { ScolariteEtudiant, EcheanceEtat, VersementCrm, SituationFinanciere, MoyenPaiement } from "@shared/schema";
import { Badge, Chiffre, EtatVide } from "@/components/ui/divers";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Champ, ZoneTexte } from "@/components/ui/champs";
import { Fenetre } from "@/components/ui/fenetre";
import { Menu, ElementMenu } from "@/components/ui/menu";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, patch, suppr } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fcfa, montant, lireMontant, aujourdhui, jourCourt, ETATS_ECHEANCE, MOYENS_ORDONNES, libelleMoyen } from "../outils-crm";
import { majScolarite, MOYENS_MOBILES } from "./DossierOutils";

type Encaisse = { versementId: number; numero: string; scolarite: ScolariteEtudiant };
type CibleEcheance = { mode: "frais" | "remise" } | { mode: "modifier"; e: EcheanceEtat };

export function DossierScolarite({ etudiantId, prenom, scolarite: s }: { etudiantId: number; prenom: string; scolarite: ScolariteEtudiant }) {
  const [encaisser, setEncaisser] = useState(false);
  const [cible, setCible] = useState<CibleEcheance | null>(null);
  const [annuler, setAnnuler] = useState<VersementCrm | null>(null);
  const [dernier, setDernier] = useState<{ id: number; numero: string } | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const base = `/api/pilotage/etudiants/${etudiantId}`;
  const sit = s.situation;
  const frais = s.echeances.filter((e) => e.type === "frais");
  const remises = s.echeances.filter((e) => e.type === "remise");
  const totalClasse = (s.fraisClasse ?? []).reduce((t, l) => t + l.montant, 0);
  const totalRemises = remises.reduce((t, r) => t + r.montant, 0);

  const agir = async (cle: string, action: () => Promise<ScolariteEtudiant>, message: string) => {
    setEnvoi(cle);
    try {
      await majScolarite(etudiantId, await action());
      toast(message);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  };

  const appliquerClasse = (remplacer: boolean) => {
    if (
      remplacer &&
      !window.confirm(`Remplacer l'échéancier de ${prenom} par les frais de sa classe (${fcfa(totalClasse)}) ? Les échéances actuelles sont retirées ; les remises et les versements sont gardés.`)
    )
      return;
    void agir("classe", () => post<ScolariteEtudiant>(`${base}/echeances/classe`, { remplacer }), remplacer ? "Échéancier remplacé par celui de la classe" : "Frais de la classe appliqués");
  };

  const retirer = (e: EcheanceEtat) => {
    const quoi = e.type === "remise" ? "cette remise" : "cette échéance";
    if (!window.confirm(`Retirer ${quoi} : « ${e.libelle} » (${fcfa(e.montant)}) ?`)) return;
    void agir(`e-${e.id}`, () => suppr<ScolariteEtudiant>(`/api/pilotage/echeances/${e.id}`), e.type === "remise" ? "Remise retirée" : "Échéance retirée");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="font-mono text-xs text-texte-gris">Scolarité</span>
          <h2 className="text-2xl font-extrabold">{s.anneeScolaire ? `Année ${s.anneeScolaire}` : "Frais et paiements"}</h2>
        </div>
        <Bouton taille="lg" icone={<Wallet className="h-5 w-5" />} onClick={() => setEncaisser(true)} className="w-full sm:w-auto">
          Encaisser un versement
        </Bouton>
      </div>

      {dernier && (
        <div className="flex flex-col gap-2 rounded-2xl bg-succes-clair px-5 py-4 text-succes sm:flex-row sm:items-center sm:justify-between" role="status">
          <span className="flex items-center gap-2 font-bold">
            <CircleCheck className="h-5 w-5 shrink-0" /> Reçu {dernier.numero} enregistré.
          </span>
          <a
            href={`/pilotage/recus/${dernier.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 font-bold text-succes underline-offset-2 hover:text-encre hover:underline"
          >
            <ExternalLink className="h-4 w-4" /> Ouvrir le reçu à imprimer
          </a>
        </div>
      )}

      {sit && (
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Chiffre libelle="Dû" valeur={<Grand n={sit.du} />} detail={totalRemises ? `F CFA, après ${montant(totalRemises)} de remise` : "F CFA"} />
            <Chiffre libelle="Payé" valeur={<Grand n={sit.paye} />} detail="F CFA" ton="succes" />
            <Chiffre libelle="Reste" valeur={<Grand n={sit.reste} />} detail="F CFA" ton={sit.reste > 0 ? "orange" : "succes"} />
            <Chiffre libelle="En retard" valeur={<Grand n={sit.retard} />} detail={sit.retard > 0 ? "F CFA, échéances passées" : "Aucun retard"} ton={sit.retard > 0 ? "danger" : "encre"} />
          </div>
          <LigneProchaine sit={sit} />
        </section>
      )}

      <section>
        <TitreSection titre="Échéancier" />
        {!frais.length ? (
          <EtatVide
            icone={<CalendarRange className="h-6 w-6" />}
            titre="Pas encore d'échéancier"
            texte={
              s.fraisClasse
                ? `Sans échéancier, impossible de calculer le reste à payer et les retards. Appliquez les frais de sa classe (${fcfa(totalClasse)}), ou ajoutez les échéances une par une.`
                : "Sans échéancier, impossible de calculer le reste à payer et les retards. Les frais de sa classe ne sont pas encore saisis : entrez-les d'abord sur la page Scolarité, puis revenez ici."
            }
            action={
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                {s.fraisClasse ? (
                  <Bouton icone={<CalendarRange className="h-4 w-4" />} onClick={() => appliquerClasse(false)} chargement={envoi === "classe"} className="min-h-[48px]">
                    Appliquer les frais de sa classe
                  </Bouton>
                ) : (
                  <LienBouton href="/pilotage/scolarite" className="min-h-[48px]">
                    Saisir les frais des classes
                  </LienBouton>
                )}
                <Bouton variante="contour" icone={<Plus className="h-4 w-4" />} onClick={() => setCible({ mode: "frais" })} className="min-h-[48px]">
                  Ajouter une échéance
                </Bouton>
              </div>
            }
          />
        ) : (
          <>
            <Carte className="overflow-hidden p-0">
              {/* Ordinateur : un tableau. */}
              <table className="hidden w-full text-left text-[15px] md:table">
                <thead className="bg-creme font-mono text-xs uppercase tracking-wider text-texte-gris">
                  <tr>
                    <th className="px-5 py-3 font-normal">Échéance</th>
                    <th className="px-3 py-3 font-normal">Date limite</th>
                    <th className="px-3 py-3 text-right font-normal">Montant</th>
                    <th className="px-3 py-3 text-right font-normal">Couvert</th>
                    <th className="px-3 py-3 font-normal">État</th>
                    <th className="w-14 px-3 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ligne-douce">
                  {s.echeances.map((e) => (
                    <tr key={e.id} className={cn(envoi === `e-${e.id}` && "opacity-60")}>
                      <td className="px-5 py-3 font-semibold">{e.libelle}</td>
                      <td className="px-3 py-3 text-texte-doux">{e.type === "remise" ? "–" : jourCourt(e.dateLimite)}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <MontantEcheance e={e} />
                      </td>
                      <td className={cn("px-3 py-3 text-right tabular-nums", e.couvert ? "text-encre" : "text-texte-gris")}>{e.type === "remise" ? "–" : montant(e.couvert)}</td>
                      <td className="px-3 py-3">
                        <Badge ton={ETATS_ECHEANCE[e.etat].ton}>{ETATS_ECHEANCE[e.etat].texte}</Badge>
                      </td>
                      <td className="px-3 py-1.5">
                        <MenuEcheance e={e} onModifier={() => setCible({ mode: "modifier", e })} onRetirer={() => retirer(e)} bloque={envoi !== null} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                {sit && (
                  <tfoot className="border-t border-ligne bg-creme">
                    <tr>
                      <td className="px-5 py-3 font-bold" colSpan={2}>
                        Total dû
                      </td>
                      <td className="px-3 py-3 text-right font-black tabular-nums">{montant(sit.du)}</td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums">{montant(sit.paye)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
              {/* Téléphone : des cartes empilées. */}
              <ul className="flex flex-col divide-y divide-ligne-douce md:hidden">
                {s.echeances.map((e) => (
                  <li key={e.id} className={cn("flex items-start gap-2 py-3 pl-4 pr-1", envoi === `e-${e.id}` && "opacity-60")}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{e.libelle}</span>
                        <Badge ton={ETATS_ECHEANCE[e.etat].ton}>{ETATS_ECHEANCE[e.etat].texte}</Badge>
                      </div>
                      {e.type === "frais" && <div className="text-[13px] text-texte-gris">Avant le {jourCourt(e.dateLimite)}</div>}
                      <div className="mt-1 font-bold tabular-nums">
                        <MontantEcheance e={e} />
                      </div>
                      {e.type === "frais" && <div className="text-[13px] text-texte-gris">Couvert : {montant(e.couvert)}</div>}
                    </div>
                    <MenuEcheance e={e} onModifier={() => setCible({ mode: "modifier", e })} onRetirer={() => retirer(e)} bloque={envoi !== null} />
                  </li>
                ))}
                {sit && (
                  <li className="flex items-center justify-between bg-creme px-4 py-3">
                    <span className="font-bold">Total dû</span>
                    <span className="font-black tabular-nums">{fcfa(sit.du)}</span>
                  </li>
                )}
              </ul>
            </Carte>
            <div className="mt-3 flex flex-wrap gap-2">
              <Bouton variante="contour" taille="sm" icone={<Plus className="h-4 w-4" />} onClick={() => setCible({ mode: "frais" })} className="min-h-[44px]">
                Ajouter une échéance
              </Bouton>
              <Bouton variante="contour" taille="sm" icone={<Percent className="h-4 w-4" />} onClick={() => setCible({ mode: "remise" })} className="min-h-[44px]">
                Accorder une remise
              </Bouton>
              {s.fraisClasse && (
                <Bouton variante="fantome" taille="sm" icone={<RotateCcw className="h-4 w-4" />} onClick={() => appliquerClasse(true)} chargement={envoi === "classe"} className="min-h-[44px]">
                  Remplacer par les frais de la classe
                </Bouton>
              )}
            </div>
          </>
        )}
      </section>

      <section>
        <TitreSection titre={s.versements.length ? `Versements (${s.versements.length})` : "Versements"} />
        {!s.versements.length ? (
          <Carte>
            <p className="text-[15px] text-texte-pale">Aucun versement pour l'instant. Chaque encaissement donne un reçu numéroté, à imprimer ou à envoyer sur WhatsApp.</p>
          </Carte>
        ) : (
          <Carte className="p-0">
            <ul className="flex flex-col divide-y divide-ligne-douce">
              {s.versements.map((v) => (
                <LigneVersement key={v.id} v={v} onAnnuler={() => setAnnuler(v)} />
              ))}
            </ul>
          </Carte>
        )}
      </section>

      <FenetreEncaisser
        ouverte={encaisser}
        onFermer={() => setEncaisser(false)}
        url={`${base}/versements`}
        prenom={prenom}
        situation={sit}
        onEncaisse={async (r) => {
          setEncaisser(false);
          setDernier({ id: r.versementId, numero: r.numero });
          toast(`Reçu ${r.numero} enregistré`);
          window.open(`/pilotage/recus/${r.versementId}`, "_blank");
          await majScolarite(etudiantId, r.scolarite);
        }}
      />
      <FenetreEcheance
        cible={cible}
        onFermer={() => setCible(null)}
        onEnregistre={async (sc, message) => {
          setCible(null);
          toast(message);
          await majScolarite(etudiantId, sc);
        }}
        base={base}
      />
      <FenetreAnnulation
        versement={annuler}
        onFermer={() => setAnnuler(null)}
        onAnnule={async (sc) => {
          setAnnuler(null);
          toast("Versement annulé");
          await majScolarite(etudiantId, sc);
        }}
      />
    </div>
  );
}

/** Montant d'une tuile : plus petit sur téléphone pour tenir dans deux colonnes. */
function Grand({ n }: { n: number }) {
  return <span className="break-words text-2xl sm:text-4xl">{montant(n)}</span>;
}

function LigneProchaine({ sit }: { sit: SituationFinanciere }) {
  if (sit.prochaine) {
    return (
      <p className="rounded-xl bg-creme px-4 py-3 text-[15px] text-texte-doux">
        <span className="font-bold text-encre">Prochaine échéance :</span> {sit.prochaine.libelle}, {sit.prochaine.date ? `avant le ${jourCourt(sit.prochaine.date)}` : "sans date"}.{" "}
        <span className="font-bold text-encre">{fcfa(sit.prochaine.reste)}</span> à payer.
      </p>
    );
  }
  if (sit.reste <= 0) return <p className="rounded-xl bg-succes-clair px-4 py-3 text-[15px] font-semibold text-succes">Tout est payé pour l'année {sit.anneeScolaire}.</p>;
  return null;
}

function MontantEcheance({ e }: { e: EcheanceEtat }) {
  if (e.type === "remise") return <span className="text-orange-profond">− {montant(e.montant)}</span>;
  if (e.net !== e.montant)
    return (
      <span>
        {montant(e.montant)} → {montant(e.net)} <span className="text-xs font-normal text-texte-gris">après remise</span>
      </span>
    );
  return <>{montant(e.montant)}</>;
}

function MenuEcheance({ e, onModifier, onRetirer, bloque }: { e: EcheanceEtat; onModifier: () => void; onRetirer: () => void; bloque: boolean }) {
  return (
    <Menu
      declencheur={
        <button type="button" disabled={bloque} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-texte-pale hover:bg-creme hover:text-encre disabled:opacity-50" aria-label={`Actions : ${e.libelle}`}>
          <MoreVertical className="h-5 w-5" />
        </button>
      }
    >
      <ElementMenu icone={<Pencil className="h-4 w-4" />} onSelect={onModifier}>
        Modifier
      </ElementMenu>
      <ElementMenu danger icone={<Trash2 className="h-4 w-4" />} onSelect={onRetirer}>
        Retirer
      </ElementMenu>
    </Menu>
  );
}

function LigneVersement({ v, onAnnuler }: { v: VersementCrm; onAnnuler: () => void }) {
  const annule = v.annule !== null;
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={cn("text-xl font-black tabular-nums", annule && "text-texte-gris line-through")}>{fcfa(v.montant)}</span>
          <span className="font-mono text-xs text-texte-gris">{v.numero}</span>
          {annule && <Badge ton="danger">Annulé</Badge>}
        </div>
        <div className={cn("mt-0.5 text-[13px] text-texte-gris", annule && "line-through")}>
          {[jourCourt(v.dateVersement), libelleMoyen(v.moyen), v.reference ? `réf. ${v.reference}` : null, v.encaissePar ? `encaissé par ${v.encaissePar}` : null].filter(Boolean).join(" · ")}
        </div>
        {v.note && !annule && <p className="mt-0.5 text-sm text-texte-doux">« {v.note} »</p>}
        {v.annule && (
          <p className="mt-1 text-sm font-semibold text-danger">
            Annulé : {v.annule.motif ?? "sans motif"}
            <span className="font-normal text-texte-gris">
              {" "}
              ({jourCourt(v.annule.le)}
              {v.annule.par ? `, par ${v.annule.par}` : ""})
            </span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <LienBouton href={`/pilotage/recus/${v.id}`} externe variante="contour" taille="sm" icone={<Receipt className="h-4 w-4" />} className="min-h-[44px]">
          Reçu
        </LienBouton>
        {!annule && (
          <Bouton variante="fantome" taille="sm" icone={<Ban className="h-4 w-4" />} onClick={onAnnuler} className="min-h-[44px] text-danger hover:text-danger">
            Annuler
          </Bouton>
        )}
      </div>
    </li>
  );
}

// ── Fenêtres ───────────────────────────────────────────────────────────────

/** Montant saisi librement (« 150 000 », « 150.000 »), relu en clair dessous. */
function ChampMontant({ saisie, onChange, libelle, aide }: { saisie: string; onChange: (v: string) => void; libelle: string; aide?: ReactNode }) {
  const n = lireMontant(saisie);
  return (
    <div className="flex flex-col gap-1.5">
      <Champ
        libelle={libelle}
        inputMode="numeric"
        autoComplete="off"
        value={saisie}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => n !== null && onChange(montant(n))}
        placeholder="Ex. : 150 000"
        className="[&_input]:text-xl [&_input]:font-bold [&_input]:tabular-nums"
      />
      <p className="text-[13px] text-texte-gris">
        {n ? <span className="font-bold text-encre">{fcfa(n)}</span> : saisie.trim() ? <span className="font-semibold text-danger">Montant illisible : chiffres seulement.</span> : null}
        {n && aide ? " · " : null}
        {aide}
      </p>
    </div>
  );
}

function BlocErreur({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger" role="alert">
      {message}
    </p>
  );
}

function Pastille({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-[44px] rounded-full border border-ligne px-3 py-1.5 text-left text-sm font-semibold text-texte-doux hover:border-orange hover:text-encre">
      {children}
    </button>
  );
}

function FenetreEncaisser({
  ouverte,
  onFermer,
  url,
  prenom,
  situation,
  onEncaisse,
}: {
  ouverte: boolean;
  onFermer: () => void;
  url: string;
  prenom: string;
  situation: SituationFinanciere | null;
  onEncaisse: (r: Encaisse) => void;
}) {
  const [saisie, setSaisie] = useState("");
  const [moyen, setMoyen] = useState<MoyenPaiement>("especes");
  const [reference, setReference] = useState("");
  const [jour, setJour] = useState(aujourdhui());
  const [note, setNote] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    if (!ouverte) return;
    setSaisie("");
    setMoyen("especes");
    setReference("");
    setJour(aujourdhui());
    setNote("");
    setErreur(null);
  }, [ouverte]);

  const n = lireMontant(saisie);
  const mobile = (MOYENS_MOBILES as readonly MoyenPaiement[]).includes(moyen);
  const libelleReference = mobile ? `Référence ${libelleMoyen(moyen)}` : moyen === "cheque" ? "Numéro du chèque" : moyen === "virement" ? "Référence du virement" : "Référence (facultatif)";
  const raccourcis: { libelle: string; valeur: number }[] = [];
  if (situation?.prochaine) raccourcis.push({ libelle: `Prochaine échéance : ${montant(situation.prochaine.reste)}`, valeur: situation.prochaine.reste });
  if (situation && situation.retard > 0) raccourcis.push({ libelle: `Retard : ${montant(situation.retard)}`, valeur: situation.retard });
  if (situation && situation.reste > 0 && !raccourcis.some((r) => r.valeur === situation.reste)) raccourcis.push({ libelle: `Tout le reste : ${montant(situation.reste)}`, valeur: situation.reste });

  const envoyer = async () => {
    if (!n) return setErreur("Indiquez le montant reçu.");
    if (jour > aujourdhui()) return setErreur("La date du versement ne peut pas être dans le futur.");
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await post<Encaisse>(url, { montant: n, moyen, reference: moyen === "especes" ? null : reference.trim() || null, dateVersement: jour || undefined, note: note.trim() || null });
      onEncaisse(r);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Encaisser un versement"
      description={`Paiement de ${prenom}. Un reçu numéroté s'ouvre ensuite, à imprimer ou à envoyer.`}
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer} disabled={envoi}>
            Annuler
          </Bouton>
          <Bouton icone={<Wallet className="h-4 w-4" />} onClick={envoyer} chargement={envoi} disabled={!n}>
            {n ? `Encaisser ${fcfa(n)}` : "Encaisser"}
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <ChampMontant
            libelle="Montant reçu"
            saisie={saisie}
            onChange={setSaisie}
            aide={situation ? `Reste à payer : ${fcfa(situation.reste)}` : "Pas encore d'échéancier : le reste à payer n'est pas calculé."}
          />
          {n && situation && n > situation.reste && situation.reste > 0 && (
            <p className="text-[13px] font-semibold text-alerte">Ce montant dépasse le reste à payer ({fcfa(situation.reste)}). Vérifiez avant d'encaisser.</p>
          )}
          {raccourcis.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {raccourcis.map((r) => (
                <Pastille key={r.libelle} onClick={() => setSaisie(montant(r.valeur))}>
                  {r.libelle}
                </Pastille>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-encre" id="moyen-paiement">
            Moyen de paiement
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-labelledby="moyen-paiement">
            {MOYENS_ORDONNES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={moyen === m}
                onClick={() => setMoyen(m)}
                className={cn(
                  "min-h-[52px] rounded-xl border px-2 py-2 text-sm font-bold leading-tight transition-colors",
                  moyen === m ? "border-encre bg-encre text-white" : "border-ligne bg-white text-texte-doux hover:border-orange hover:text-encre",
                )}
              >
                {libelleMoyen(m)}
              </button>
            ))}
          </div>
        </div>

        {moyen !== "especes" && (
          <Champ
            libelle={
              mobile ? (
                <>
                  {libelleReference} <span className="font-normal text-orange-fonce">(conseillée)</span>
                </>
              ) : (
                libelleReference
              )
            }
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            maxLength={80}
            autoComplete="off"
            placeholder={mobile ? "Le code de la transaction reçu par SMS" : undefined}
            aide={mobile ? "Elle évite d'enregistrer deux fois le même paiement." : undefined}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ libelle="Date du versement" type="date" max={aujourdhui()} value={jour} onChange={(e) => setJour(e.target.value)} />
          <Champ libelle="Note (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ex. : payé par le père" />
        </div>
        <BlocErreur message={erreur} />
      </div>
    </Fenetre>
  );
}

const SUGGESTIONS_FRAIS = ["Frais d'examen", "Tenue", "Frais de stage"];
const SUGGESTIONS_REMISE = ["Bourse", "Réduction fratrie", "Remise exceptionnelle"];

function FenetreEcheance({
  cible,
  onFermer,
  onEnregistre,
  base,
}: {
  cible: CibleEcheance | null;
  onFermer: () => void;
  onEnregistre: (s: ScolariteEtudiant, message: string) => void;
  base: string;
}) {
  const [libelle, setLibelle] = useState("");
  const [saisie, setSaisie] = useState("");
  const [date, setDate] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    if (!cible) return;
    const e = cible.mode === "modifier" ? cible.e : null;
    setLibelle(e?.libelle ?? "");
    setSaisie(e ? montant(e.montant) : "");
    setDate(e?.dateLimite ?? "");
    setErreur(null);
  }, [cible]);
  if (!cible) return null;

  const remise = cible.mode === "remise" || (cible.mode === "modifier" && cible.e.type === "remise");
  const n = lireMontant(saisie);
  const titre = cible.mode === "modifier" ? (remise ? "Modifier la remise" : "Modifier l'échéance") : remise ? "Accorder une remise" : "Ajouter une échéance";
  const description = remise
    ? "Bourse, fratrie, geste commercial… La remise se déduit des dernières échéances."
    : cible.mode === "modifier"
      ? "Les versements déjà reçus sont réimputés automatiquement."
      : "Une ligne de plus dans son échéancier (frais d'examen, tenue…).";

  const envoyer = async () => {
    if (!libelle.trim()) return setErreur("Donnez un nom à cette ligne.");
    if (!n) return setErreur("Indiquez un montant.");
    setEnvoi(true);
    setErreur(null);
    try {
      if (cible.mode === "modifier") {
        const corps: Record<string, unknown> = { libelle: libelle.trim(), montant: n };
        if (!remise) corps.dateLimite = date || null;
        onEnregistre(await patch<ScolariteEtudiant>(`/api/pilotage/echeances/${cible.e.id}`, corps), remise ? "Remise modifiée" : "Échéance modifiée");
      } else {
        onEnregistre(
          await post<ScolariteEtudiant>(`${base}/echeances`, { type: remise ? "remise" : "frais", libelle: libelle.trim(), montant: n, dateLimite: remise ? null : date || null }),
          remise ? "Remise accordée" : "Échéance ajoutée",
        );
      }
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre={titre}
      description={description}
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer} disabled={envoi}>
            Annuler
          </Bouton>
          <Bouton onClick={envoyer} chargement={envoi} disabled={!libelle.trim() || !n}>
            Enregistrer
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Champ libelle="Libellé" value={libelle} onChange={(e) => setLibelle(e.target.value)} maxLength={80} placeholder={remise ? "Ex. : bourse d'excellence" : "Ex. : 3e tranche"} />
          {cible.mode !== "modifier" && (
            <div className="flex flex-wrap gap-2">
              {(remise ? SUGGESTIONS_REMISE : SUGGESTIONS_FRAIS).map((x) => (
                <Pastille key={x} onClick={() => setLibelle(x)}>
                  {x}
                </Pastille>
              ))}
            </div>
          )}
        </div>
        <ChampMontant libelle={remise ? "Montant de la remise" : "Montant"} saisie={saisie} onChange={setSaisie} />
        {!remise && <Champ libelle="Date limite" type="date" value={date} onChange={(e) => setDate(e.target.value)} aide="Passé cette date, la part non payée compte en retard." />}
        <BlocErreur message={erreur} />
      </div>
    </Fenetre>
  );
}

const MOTIFS_ANNULATION = ["Erreur de montant", "Mauvais étudiant", "Paiement enregistré deux fois", "Chèque rejeté"];

function FenetreAnnulation({ versement: v, onFermer, onAnnule }: { versement: VersementCrm | null; onFermer: () => void; onAnnule: (s: ScolariteEtudiant) => void }) {
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    setMotif("");
    setErreur(null);
  }, [v]);
  if (!v) return null;

  const envoyer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      onAnnule(await post<ScolariteEtudiant>(`/api/pilotage/versements/${v.id}/annuler`, { motif: motif.trim() }));
    } catch (e) {
      // 403 : la vie scolaire n'annule que ses encaissements du jour ; le message du serveur le dit.
      setErreur((e as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre="Annuler ce versement"
      description={`Reçu ${v.numero} : ${fcfa(v.montant)} du ${jourCourt(v.dateVersement)}. Le versement reste visible, barré, avec le motif ; le reçu garde son numéro.`}
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer} disabled={envoi}>
            Garder le versement
          </Bouton>
          <Bouton variante="danger" icone={<Ban className="h-4 w-4" />} onClick={envoyer} chargement={envoi} disabled={motif.trim().length < 2}>
            Annuler le versement
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {MOTIFS_ANNULATION.map((m) => (
            <Pastille key={m} onClick={() => setMotif(m)}>
              {m}
            </Pastille>
          ))}
        </div>
        <ZoneTexte libelle="Motif (obligatoire)" value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} maxLength={300} placeholder="Ex. : montant saisi 150 000 au lieu de 15 000." />
        <BlocErreur message={erreur} />
      </div>
    </Fenetre>
  );
}
