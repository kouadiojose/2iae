// /pilotage/etudiants/:id : tout sur un étudiant, sur une seule page. C'est
// la page qu'on ouvre quand un parent appelle. En-tête (identité, statut,
// contacts rapides) puis des onglets : aperçu (assiduité, notes, devoirs,
// relevé pour les parents), identité et famille, pièces, scolarité, suivi.
// L'onglet ouvert est dans l'adresse (?onglet=suivi) ; seuls les onglets
// ouverts sont chargés.
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, KeyRound, Pencil, Link2, Link2Off, Copy, ExternalLink, ArrowLeft, Share2, ChevronRight, Send, Phone } from "lucide-react";
import type { DossierEtudiant, CompteLigne, CodeRemis, ReleveCree, LignePresenceEtudiant, DevoirDossier, DossierCrm } from "@shared/schema";
import { LIBELLES_PRESENCE_PILOTAGE, LIBELLES_STATUTS_SCOLARITE, comptePresent } from "@shared/schema";
import { Page } from "@/components/layout/coquille";
import { Avatar, Badge, Chargement, Erreur, EtatVide, Squelette, type Ton } from "@/components/ui/divers";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Onglets } from "@/components/ui/onglets";
import { toast, toastErreur } from "@/components/ui/toast";
import { get, post, suppr } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { dateCourte, jourLong, heure } from "@/lib/dates";
import { cn, note, pluriel } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { FenetreCompte } from "./composants/FenetreCompte";
import { FenetreCode } from "./composants/FenetreCode";
import { FenetreJustifier, type CibleJustification } from "./composants/FenetreJustifier";
import { urlCrm } from "./composants/DossierOutils";
import { TON_PRESENCE, FOND_PRESENCE, vuLe, telephoneLisible, pourcent, copier } from "./outils";
import { TONS_STATUT, fcfa, jourCourt, aujourdhui } from "./outils-crm";

// Les onglets du dossier ne sont téléchargés qu'à leur première ouverture.
const DossierIdentite = lazy(() => import("./composants/DossierIdentite").then((m) => ({ default: m.DossierIdentite })));
const DossierPieces = lazy(() => import("./composants/DossierPieces").then((m) => ({ default: m.DossierPieces })));
const DossierScolarite = lazy(() => import("./composants/DossierScolarite").then((m) => ({ default: m.DossierScolarite })));
const DossierSuivi = lazy(() => import("./composants/DossierSuivi").then((m) => ({ default: m.DossierSuivi })));

const ONGLETS = ["apercu", "identite", "pieces", "scolarite", "suivi"] as const;
type Onglet = (typeof ONGLETS)[number];

const ETATS_DEVOIR: Record<DevoirDossier["etat"], { texte: string; ton: Ton }> = {
  a_venir: { texte: "À venir", ton: "gris" },
  rendu: { texte: "Rendu", ton: "succes" },
  en_retard: { texte: "Rendu en retard", ton: "alerte" },
  non_rendu: { texte: "Non rendu", ton: "danger" },
  corrige: { texte: "Noté", ton: "encre" },
};

export default function PageEtudiant({ id }: { id: string }) {
  const url = `/api/pilotage/etudiants/${id}`;
  const { data: d, isLoading, error, refetch } = useQuery<DossierEtudiant>({ queryKey: [url] });
  // Le dossier CRM (identité, pièces, scolarité, suivi) est lu en parallèle.
  const crmQ = useQuery<DossierCrm>({ queryKey: [urlCrm(id)] });
  const crm = crmQ.data;
  const [, naviguer] = useLocation();
  const demande = new URLSearchParams(useSearch()).get("onglet");
  const onglet: Onglet = ONGLETS.includes(demande as Onglet) ? (demande as Onglet) : "apercu";
  const [modifier, setModifier] = useState<CompteLigne | null>(null);
  const [code, setCode] = useState<CodeRemis | null>(null);
  const [justifier, setJustifier] = useState<CibleJustification | null>(null);

  if (isLoading)
    return (
      <Page>
        <Chargement lignes={4} />
      </Page>
    );
  if (error || !d)
    return (
      <Page>
        <SousNav />
        <Erreur message={(error as Error)?.message ?? "Dossier introuvable."} reessayer={() => refetch()} />
      </Page>
    );

  const e = d.etudiant;
  const ouvrirModification = async () => {
    try {
      setModifier(await get<CompteLigne>(`/api/pilotage/comptes/${e.id}`));
    } catch (err) {
      toastErreur(err);
    }
  };
  const changerOnglet = (o: Onglet) => naviguer(o === "apercu" ? `/pilotage/etudiants/${id}` : `/pilotage/etudiants/${id}?onglet=${o}`, { replace: true });
  const piecesATraiter = crm ? crm.pieces.filter((p) => p.statut === "a_verifier" || (p.requise && p.statut !== "recue")).length : 0;
  const relancesOuvertes = crm ? crm.taches.filter((t) => !t.faiteLe).length : 0;

  return (
    <Page>
      <SousNav />
      <Link href="/pilotage/etudiants" className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm font-bold text-texte-pale no-underline hover:text-encre print:hidden">
        <ArrowLeft className="h-4 w-4" /> Étudiants
      </Link>

      {/* En-tête : qui, où, dans quel état, et comment le joindre. */}
      <header className="flex flex-col gap-5 rounded-[28px] bg-creme p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar prenom={e.prenom} nom={e.nom} photo={e.photoUrl} taille={72} />
          <div className="min-w-0 flex-1">
            <span className="font-mono text-xs text-texte-gris">Dossier étudiant · {e.matricule}</span>
            <h1 className="titre-page mt-1 break-words">
              {e.prenom} {e.nom}
            </h1>
            <p className="mt-1 text-base text-texte-doux">{[e.classe, e.site && !(e.classe ?? "").includes(e.site) ? `Campus ${e.site}` : null].filter(Boolean).join(" · ")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {crm && (
                <Badge ton={TONS_STATUT[crm.identite.statut]}>
                  {LIBELLES_STATUTS_SCOLARITE[crm.identite.statut]}
                  {crm.identite.statut !== "inscrit" && crm.identite.statutLe ? ` depuis le ${jourCourt(crm.identite.statutLe)}` : ""}
                </Badge>
              )}
              {!e.actif && <Badge ton="gris">Compte désactivé</Badge>}
              {d.activation.active ? (
                <Badge ton="succes">Compte activé</Badge>
              ) : (
                <Badge ton="alerte">{d.activation.codeExpireLe ? `Code provisoire jusqu'au ${dateCourte(d.activation.codeExpireLe)}` : "Pas encore activé"}</Badge>
              )}
              <Badge ton="gris">Vu sur le campus : {vuLe(d.derniereActivite)}</Badge>
              {e.telephone && <Badge ton="gris">{telephoneLisible(e.telephone)}</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col">
            {d.whatsapp ? (
              <a
                href={d.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-orange px-5 font-bold text-encre no-underline hover:bg-encre hover:text-white"
              >
                <MessageCircle className="h-4 w-4" /> Écrire sur WhatsApp
              </a>
            ) : (
              <span className="col-span-2 text-center text-sm text-texte-gris">Pas de téléphone enregistré</span>
            )}
            {e.actif && (
              <LienBouton href={`/messages/nouveau?a=${e.id}`} variante="contour" icone={<Send className="h-4 w-4" />} className="col-span-2 min-h-[48px] px-3">
                Écrire sur le campus
              </LienBouton>
            )}
            <Bouton variante="contour" icone={<Pencil className="h-4 w-4" />} onClick={ouvrirModification} className="min-h-[48px] px-3">
              Modifier
            </Bouton>
            <Bouton
              variante="contour"
              icone={<KeyRound className="h-4 w-4" />}
              className="min-h-[48px] whitespace-nowrap px-3"
              disabled={!e.actif}
              onClick={async () => {
                if (!window.confirm(`Créer un nouveau code pour ${e.prenom} ? L'ancien ne marchera plus.`)) return;
                try {
                  setCode(await post<CodeRemis>(`/api/pilotage/comptes/${e.id}/nouveau-code`));
                  await rafraichir(url);
                } catch (err) {
                  toastErreur(err);
                }
              }}
            >
              Nouveau code
            </Bouton>
          </div>
        </div>
        {crm && crm.contacts.length > 0 && <Contacts contacts={crm.contacts} />}
      </header>

      <BarreOnglets onglet={onglet} onChange={changerOnglet} pieces={piecesATraiter} relances={relancesOuvertes} />

      <div role="tabpanel" className="flex min-w-0 flex-col gap-6">
        {onglet === "apercu" ? (
          <>
            <ResumeCrm crm={crm} chargement={crmQ.isLoading} onOnglet={changerOnglet} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-6">
                <Assiduite d={d} onJustifier={(s) => setJustifier({ seanceId: s.seanceId, seanceTitre: s.titre, etudiantId: e.id, nom: `${e.prenom} ${e.nom}`, justification: s.justification })} />
                <Devoirs d={d} />
              </div>
              <div className="flex min-w-0 flex-col gap-6">
                <Notes d={d} />
                <Releve d={d} />
              </div>
            </div>
          </>
        ) : crmQ.isLoading ? (
          <Chargement lignes={3} />
        ) : crmQ.error || !crm ? (
          <Erreur message={(crmQ.error as Error)?.message ?? "Dossier introuvable."} reessayer={() => crmQ.refetch()} />
        ) : (
          <Suspense fallback={<Chargement lignes={3} />}>
            {onglet === "identite" && <DossierIdentite etudiantId={e.id} prenom={e.prenom} identite={crm.identite} onModifierCompte={ouvrirModification} />}
            {onglet === "pieces" && <DossierPieces etudiantId={e.id} pieces={crm.pieces} />}
            {onglet === "scolarite" && <DossierScolarite etudiantId={e.id} prenom={e.prenom} scolarite={crm.scolarite} />}
            {onglet === "suivi" && <DossierSuivi etudiantId={e.id} crm={crm} />}
          </Suspense>
        )}
      </div>

      <FenetreCompte ouverte={modifier !== null} compte={modifier} onFermer={() => setModifier(null)} onCode={(r) => setCode(r)} />
      <FenetreCode
        remis={code}
        personne={{ id: e.id, prenom: e.prenom, nom: e.nom, role: "etudiant", identifiant: e.matricule ?? "", classe: e.classe, site: e.site }}
        onFermer={() => setCode(null)}
      />
      <FenetreJustifier cible={justifier} onFermer={() => setJustifier(null)} />
    </Page>
  );
}

/** Les onglets du dossier ; sur téléphone, l'onglet ouvert reste visible dans la barre qui défile. */
function BarreOnglets({ onglet, onChange, pieces, relances }: { onglet: Onglet; onChange: (o: Onglet) => void; pieces: number; relances: number }) {
  const cadre = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const liste = cadre.current?.querySelector<HTMLElement>('[role="tablist"]');
    const actif = liste?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!liste || !actif) return;
    const gauche = actif.getBoundingClientRect().left - liste.getBoundingClientRect().left + liste.scrollLeft;
    liste.scrollLeft = Math.max(0, gauche - liste.clientWidth / 2 + actif.clientWidth / 2);
  }, [onglet]);
  return (
    <div ref={cadre} className="min-w-0 print:hidden">
      <Onglets<Onglet>
        valeur={onglet}
        onChange={onChange}
        className="[&>button]:min-h-[44px]"
        options={[
          { valeur: "apercu", libelle: "Aperçu" },
          { valeur: "identite", libelle: "Identité et famille" },
          { valeur: "pieces", libelle: "Pièces", compteur: pieces },
          { valeur: "scolarite", libelle: "Scolarité" },
          { valeur: "suivi", libelle: "Suivi", compteur: relances },
        ]}
      />
    </div>
  );
}

/** Contacts rapides : l'étudiant et ses responsables, un appel ou un WhatsApp d'un geste. */
function Contacts({ contacts }: { contacts: DossierCrm["contacts"] }) {
  return (
    <div className="flex flex-col gap-2 border-t border-ligne pt-4 print:hidden">
      <span className="font-mono text-xs text-texte-gris">Joindre rapidement</span>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {contacts.map((c) => (
          <li key={`${c.libelle}-${c.telephone}`} className="flex items-center gap-1 rounded-2xl bg-white py-1 pl-4 pr-1">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{c.libelle}</div>
              <div className="font-mono text-xs text-texte-gris">{telephoneLisible(c.telephone)}</div>
            </div>
            <a
              href={`tel:${c.telephone}`}
              aria-label={`Appeler ${c.libelle}`}
              title="Appeler"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-encre no-underline hover:bg-creme hover:text-encre"
            >
              <Phone className="h-5 w-5" />
            </a>
            {c.whatsapp && (
              <a
                href={c.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Écrire sur WhatsApp à ${c.libelle}`}
                title="WhatsApp"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange text-encre no-underline hover:bg-encre hover:text-white"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Aperçu : pièces, argent et relances en trois tuiles qui ouvrent l'onglet correspondant. */
function ResumeCrm({ crm, chargement, onOnglet }: { crm: DossierCrm | undefined; chargement: boolean; onOnglet: (o: Onglet) => void }) {
  if (chargement)
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-busy="true" aria-label="Chargement">
        {[0, 1, 2].map((i) => (
          <Squelette key={i} className="h-28" />
        ))}
      </div>
    );
  if (!crm) return null;
  const requises = crm.pieces.filter((p) => p.requise);
  const recues = requises.filter((p) => p.statut === "recue").length;
  const aVerifier = crm.pieces.filter((p) => p.statut === "a_verifier").length;
  const sit = crm.scolarite.situation;
  const jour = aujourdhui();
  const ouvertes = crm.taches.filter((t) => !t.faiteLe).sort((a, b) => a.echeance.localeCompare(b.echeance));
  const enRetard = ouvertes.filter((t) => t.echeance < jour).length;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <TuileResume libelle="Pièces" onClick={() => onOnglet("pieces")} valeur={`${recues}/${requises.length} reçues`}>
        {aVerifier > 0 ? (
          <span className="font-semibold text-alerte">{aVerifier} à vérifier</span>
        ) : recues < requises.length ? (
          <span>{pluriel(requises.length - recues, "pièce manquante", "pièces manquantes")}</span>
        ) : (
          <span className="font-semibold text-succes">Dossier complet</span>
        )}
      </TuileResume>
      <TuileResume libelle="Scolarité" onClick={() => onOnglet("scolarite")} valeur={sit ? `Reste ${fcfa(sit.reste)}` : "Pas d'échéancier"}>
        {!sit ? (
          <span>Frais à mettre en place</span>
        ) : (
          <>
            {sit.retard > 0 && <span className="block font-semibold text-danger">En retard : {fcfa(sit.retard)}</span>}
            {sit.prochaine ? (
              <span className="block">
                Prochaine : {jourCourt(sit.prochaine.date)}, {fcfa(sit.prochaine.reste)}
              </span>
            ) : (
              sit.retard === 0 && <span className="block font-semibold text-succes">{sit.reste > 0 ? "Aucun retard" : "Tout est payé"}</span>
            )}
          </>
        )}
      </TuileResume>
      <TuileResume libelle="Relances" onClick={() => onOnglet("suivi")} valeur={ouvertes.length ? pluriel(ouvertes.length, "ouverte") : "Aucune ouverte"}>
        {enRetard > 0 ? (
          <span className="font-semibold text-danger">{enRetard} en retard</span>
        ) : ouvertes[0] ? (
          <span className="block truncate">
            {jourCourt(ouvertes[0].echeance)} : {ouvertes[0].titre}
          </span>
        ) : (
          <span>Programmer un rappel</span>
        )}
      </TuileResume>
    </div>
  );
}

function TuileResume({ libelle, valeur, onClick, children }: { libelle: string; valeur: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[96px] w-full items-center gap-3 rounded-2xl border border-ligne bg-white p-4 text-left transition-colors hover:border-orange focus-visible:border-orange"
    >
      <div className="min-w-0 flex-1">
        <div className="font-mono text-xs uppercase tracking-wider text-texte-gris">{libelle}</div>
        <div className="mt-1 text-lg font-extrabold tabular-nums">{valeur}</div>
        <div className="mt-0.5 text-[13px] text-texte-pale">{children}</div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden="true" />
    </button>
  );
}

function Assiduite({ d, onJustifier }: { d: DossierEtudiant; onJustifier: (s: LignePresenceEtudiant) => void }) {
  const r = d.presences.resume;
  const frise = [...d.presences.seances].reverse();
  return (
    <section>
      <TitreSection titre="Assiduité aux lives" />
      <Carte className="flex flex-col gap-4">
        {!r.attendus ? (
          <p className="text-[15px] text-texte-pale">Aucun live passé pour l'instant. Les présences apparaîtront après la première séance de ses cours.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <div className="text-5xl font-black tracking-serre">{pourcent(r.taux)}</div>
                <div className="text-sm text-texte-pale">de présence ({r.presents} sur {r.attendus - r.justifie - r.incident} séances comptées)</div>
              </div>
              <div className="flex flex-wrap gap-1.5 pb-1 text-xs">
                {r.absent > 0 && <Badge ton="danger">{pluriel(r.absent, "absence")}</Badge>}
                {r.partiel > 0 && <Badge ton="alerte">{r.partiel} partiel{r.partiel > 1 ? "s" : ""}</Badge>}
                {r.justifie > 0 && <Badge ton="gris">{r.justifie} justifiée{r.justifie > 1 ? "s" : ""}</Badge>}
                {r.incident > 0 && <Badge ton="encre">{pluriel(r.incident, "incident")} de salle</Badge>}
              </div>
            </div>
            {/* Frise : une case par séance, de la plus ancienne à la plus récente. */}
            <div>
              <div className="flex flex-wrap gap-1" role="list" aria-label="Frise d'assiduité">
                {frise.map((s) => (
                  <span
                    key={s.seanceId}
                    role="listitem"
                    title={`${dateCourte(s.debut)} · ${s.coursCode} · ${LIBELLES_PRESENCE_PILOTAGE[s.statut]}`}
                    aria-label={`${dateCourte(s.debut)}, ${s.coursCode} : ${LIBELLES_PRESENCE_PILOTAGE[s.statut]}`}
                    className={cn("h-6 w-6 rounded-md", FOND_PRESENCE[s.statut])}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texte-pale">
                <Legende classe="bg-succes" texte="Présent" />
                <Legende classe="bg-alerte" texte="Partiel" />
                <Legende classe="bg-danger" texte="Absent" />
                <Legende classe="bg-texte-gris" texte="Justifié" />
                <Legende classe="bg-encre" texte="Incident de salle" />
              </div>
            </div>
            <ul className="flex flex-col divide-y divide-ligne-douce">
              {d.presences.seances.slice(0, 12).map((s) => (
                <li key={s.seanceId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <div className="min-w-[10rem] flex-1">
                    <div className="truncate text-[15px] font-semibold">{s.titre}</div>
                    <div className="text-[13px] text-texte-gris">
                      {s.coursCode} · {jourLong(s.debut)} · {heure(s.debut)}
                      {s.statut === "partiel" || s.statut === "en_ligne" ? ` · ${s.minutes} min en ligne` : ""}
                      {s.justification ? ` · « ${s.justification} »` : ""}
                    </div>
                  </div>
                  <Badge ton={TON_PRESENCE[s.statut]}>
                    {LIBELLES_PRESENCE_PILOTAGE[s.statut]}
                    {s.retard ? " · retard" : ""}
                  </Badge>
                  {!comptePresent(s.statut) && s.statut !== "incident" && (
                    <button type="button" onClick={() => onJustifier(s)} className="min-h-[44px] px-1 text-sm font-bold text-orange-fonce hover:text-encre">
                      {s.justification ? "Modifier" : "Justifier"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Carte>
    </section>
  );
}

function Legende({ classe, texte }: { classe: string; texte: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm", classe)} />
      {texte}
    </span>
  );
}

function Notes({ d }: { d: DossierEtudiant }) {
  return (
    <section>
      <TitreSection titre="Moyennes" />
      <Carte className="flex flex-col gap-3">
        {!d.notes.cours.length ? (
          <p className="text-[15px] text-texte-pale">Pas encore de cours avec des notes. Les moyennes apparaîtront dès les premières copies corrigées.</p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-ligne-douce">
              {d.notes.cours.map((c) => (
                <li key={c.coursId}>
                  <Link href={`/enseigner/notes/${c.coursId}`} className="flex min-h-[48px] items-center justify-between gap-3 py-2.5 text-encre no-underline hover:text-orange-fonce">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{c.titre}</div>
                      <div className="font-mono text-xs text-texte-gris">
                        {c.code} · {pluriel(c.notes, "note")} · carnet de notes
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xl font-black tabular-nums">
                      {note(c.moyenne)}
                      <ChevronRight className="h-4 w-4 text-texte-gris" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between rounded-xl bg-creme px-4 py-3">
              <span className="font-bold">Moyenne générale</span>
              <span className="text-2xl font-black tabular-nums">{note(d.notes.generale)}</span>
            </div>
          </>
        )}
      </Carte>
    </section>
  );
}

function Devoirs({ d }: { d: DossierEtudiant }) {
  return (
    <section>
      <TitreSection titre="Devoirs et interrogations" />
      {!d.devoirs.length ? (
        <EtatVide titre="Aucun devoir pour l'instant." texte="Les devoirs de ses cours apparaîtront ici avec leur état : rendu, en retard, non rendu, noté." />
      ) : (
        <Carte className="p-0">
          <ul className="flex flex-col divide-y divide-ligne-douce">
            {d.devoirs.slice(0, 15).map((v) => (
              <li key={v.id}>
                {/* La copie de l'étudiant, dans la page des copies du devoir. */}
                <Link
                  href={`/enseigner/devoirs/${v.id}/copies?etudiant=${d.etudiant.id}`}
                  className="flex min-h-[56px] items-center gap-3 px-5 py-3 text-encre no-underline hover:bg-creme"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{v.titre}</div>
                    <div className="text-[13px] text-texte-gris">
                      {v.coursCode} · {v.type === "quiz" ? "interrogation" : "devoir"} · pour le {dateCourte(v.dateLimite)}
                    </div>
                  </div>
                  {v.note !== null ? <span className="font-black tabular-nums">{note(v.note, v.bareme)}</span> : <Badge ton={ETATS_DEVOIR[v.etat].ton}>{ETATS_DEVOIR[v.etat].texte}</Badge>}
                  <ChevronRight className="h-4 w-4 shrink-0 text-texte-gris" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </section>
  );
}

function Releve({ d }: { d: DossierEtudiant }) {
  const [envoi, setEnvoi] = useState(false);
  const url = `/api/pilotage/etudiants/${d.etudiant.id}`;
  const creer = async () => {
    setEnvoi(true);
    try {
      await post<ReleveCree>(`${url}/releve`);
      toast("Lien du relevé créé");
      await rafraichir(url);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const revoquer = async () => {
    if (!window.confirm("Désactiver ce lien ? Les parents qui l'ont reçu ne pourront plus ouvrir le relevé.")) return;
    setEnvoi(true);
    try {
      await suppr(`${url}/releve`);
      toast("Lien désactivé");
      await rafraichir(url);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const r = d.releve;
  return (
    <section>
      <TitreSection titre="Relevé pour les parents" />
      <Carte className="flex flex-col gap-3">
        <p className="text-[15px] text-texte-pale">
          Un lien à envoyer sur WhatsApp : nom, classe, moyennes par cours et présence aux lives. Rien d'autre. Désactivable à tout moment.
        </p>
        {!r ? (
          <Bouton icone={<Link2 className="h-4 w-4" />} onClick={creer} chargement={envoi} disabled={!d.etudiant.actif} className="self-start">
            Créer le lien du relevé
          </Bouton>
        ) : (
          <>
            <div className="break-all rounded-xl bg-creme px-4 py-3 font-mono text-[13px]">{r.lien}</div>
            <p className="text-sm text-texte-gris">
              {r.partageLe ? `Créé le ${dateCourte(r.partageLe)} · ` : ""}
              {r.consultations ? `ouvert ${pluriel(r.consultations, "fois", "fois")}` : "pas encore ouvert"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={r.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-orange font-bold text-encre no-underline hover:bg-encre hover:text-white"
              >
                <Share2 className="h-4 w-4" /> Envoyer aux parents (WhatsApp)
              </a>
              <Bouton variante="contour" icone={<Copy className="h-4 w-4" />} onClick={async () => toast((await copier(r.lien)) ? "Lien copié" : "Copie impossible", "info")}>
                Copier
              </Bouton>
              <a
                href={r.lien}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-[1.5px] border-encre font-bold text-encre no-underline hover:bg-orange-pale hover:text-encre"
              >
                <ExternalLink className="h-4 w-4" /> Voir
              </a>
            </div>
            <Bouton variante="fantome" icone={<Link2Off className="h-4 w-4" />} onClick={revoquer} disabled={envoi} className="self-start text-danger">
              Désactiver le lien
            </Bouton>
          </>
        )}
      </Carte>
    </section>
  );
}
