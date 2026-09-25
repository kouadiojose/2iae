// /pilotage/etudiants/:id : tout sur un étudiant, sur une seule page. C'est
// la page qu'on ouvre quand un parent appelle : identité, assiduité, notes,
// devoirs, suivis, et le relevé à partager aux parents.
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, KeyRound, NotebookPen, Pencil, Link2, Link2Off, Copy, ExternalLink, ArrowLeft, Share2 } from "lucide-react";
import type { DossierEtudiant, CompteLigne, CodeRemis, ReleveCree, LignePresenceEtudiant, DevoirDossier } from "@shared/schema";
import { LIBELLES_PRESENCE_PILOTAGE, comptePresent } from "@shared/schema";
import { Page } from "@/components/layout/coquille";
import { Avatar, Badge, Chargement, Erreur, EtatVide, type Ton } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { ZoneTexte } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { get, post, suppr } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { dateCourte, jourLong, heure } from "@/lib/dates";
import { cn, note, pluriel } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { FenetreCompte } from "./composants/FenetreCompte";
import { FenetreCode } from "./composants/FenetreCode";
import { FenetreJustifier, type CibleJustification } from "./composants/FenetreJustifier";
import { TON_PRESENCE, FOND_PRESENCE, vuLe, telephoneLisible, pourcent, copier } from "./outils";

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

  return (
    <Page>
      <SousNav />
      <Link href="/pilotage/comptes" className="-mb-2 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-bold text-texte-pale no-underline hover:text-encre print:hidden">
        <ArrowLeft className="h-4 w-4" /> Comptes
      </Link>

      {/* En-tête : qui, où, dans quel état. */}
      <header className="flex flex-col gap-5 rounded-[28px] bg-creme p-5 sm:flex-row sm:items-center sm:p-7">
        <Avatar prenom={e.prenom} nom={e.nom} photo={e.photoUrl} taille={72} />
        <div className="min-w-0 flex-1">
          <span className="font-mono text-xs text-texte-gris">Dossier étudiant · {e.matricule}</span>
          <h1 className="titre-page mt-1">
            {e.prenom} {e.nom}
          </h1>
          <p className="mt-1 text-base text-texte-doux">{[e.classe, e.site && !(e.classe ?? "").includes(e.site) ? `Campus ${e.site}` : null].filter(Boolean).join(" · ")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
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
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Assiduite d={d} onJustifier={(s) => setJustifier({ seanceId: s.seanceId, seanceTitre: s.titre, etudiantId: e.id, nom: `${e.prenom} ${e.nom}`, justification: s.justification })} />
          <Notes d={d} />
          <Devoirs d={d} />
        </div>
        <div className="flex flex-col gap-6">
          <Suivis d={d} />
          <Releve d={d} />
        </div>
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
                  <div className="min-w-0 flex-1">
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
                    <button type="button" onClick={() => onJustifier(s)} className="min-h-[40px] px-1 text-sm font-bold text-orange-fonce hover:text-encre">
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
                <li key={c.coursId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{c.titre}</div>
                    <div className="font-mono text-xs text-texte-gris">
                      {c.code} · {pluriel(c.notes, "note")}
                    </div>
                  </div>
                  <div className="text-xl font-black tabular-nums">{note(c.moyenne)}</div>
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
              <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{v.titre}</div>
                  <div className="text-[13px] text-texte-gris">
                    {v.coursCode} · {v.type === "quiz" ? "interrogation" : "devoir"} · pour le {dateCourte(v.dateLimite)}
                  </div>
                </div>
                {v.note !== null ? <span className="font-black tabular-nums">{note(v.note, v.bareme)}</span> : <Badge ton={ETATS_DEVOIR[v.etat].ton}>{ETATS_DEVOIR[v.etat].texte}</Badge>}
              </li>
            ))}
          </ul>
        </Carte>
      )}
    </section>
  );
}

function Suivis({ d }: { d: DossierEtudiant }) {
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const ajouter = async () => {
    setEnvoi(true);
    try {
      await post(`/api/pilotage/etudiants/${d.etudiant.id}/suivis`, { texte });
      setTexte("");
      toast("Suivi enregistré");
      await rafraichir(`/api/pilotage/etudiants/${d.etudiant.id}`, "/api/pilotage/a-contacter");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <section>
      <TitreSection titre="Suivi" />
      <Carte className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <ZoneTexte aria-label="Nouvelle note de suivi" value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} maxLength={2000} placeholder="Appel, entretien, parent prévenu… (jamais visible par l'étudiant)" />
          <Bouton variante="encre" icone={<NotebookPen className="h-4 w-4" />} onClick={ajouter} chargement={envoi} disabled={texte.trim().length < 2} className="self-start">
            Ajouter au suivi
          </Bouton>
        </div>
        {!d.suivis.length ? (
          <p className="text-[15px] text-texte-pale">Aucune note pour l'instant. Notez chaque échange : la personne suivante saura où on en est.</p>
        ) : (
          <ol className="flex flex-col gap-3 border-l-2 border-orange-peche pl-4">
            {d.suivis.map((s) => (
              <li key={s.id}>
                <div className="font-mono text-xs text-texte-gris">
                  {dateCourte(s.creeLe)} · {heure(s.creeLe)} · {s.auteur}
                </div>
                <p className="mt-0.5 whitespace-pre-line text-[15px] text-texte-doux">{s.texte}</p>
              </li>
            ))}
          </ol>
        )}
      </Carte>
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
