// Ajouter ou modifier un créneau : type, jour et heures, cours (ou « Nouveau
// cours » en ligne), intervenant (ou « Nouveau formateur » en ligne, avec son
// code provisoire à transmettre), nom et mention imprimés, visio. Un aperçu
// montre la case telle qu'elle s'imprimera.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, MessageCircle, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import type { ChevauchementDto, CompteCree, CoursDetail, CreneauEditionDto, OptionsProgrammeDto, SessionEditionDto, TypeCreneau } from "@shared/schema";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Selection } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { ErreurApi, patch, post, suppr } from "@/lib/api";
import { rafraichir, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { JOURS, hh, minutes } from "./outils";

const TYPES: { valeur: TypeCreneau; libelle: string; aide: string }[] = [
  { valeur: "cours", libelle: "Cours", aide: "Crée une séance en direct chaque semaine." },
  { valeur: "seminaire", libelle: "Séminaire", aide: "S'affiche dans la grille ; séance en direct seulement si vous choisissez un cours." },
  { valeur: "evenement", libelle: "Événement", aide: "Sortie, examen, cérémonie : s'affiche dans la grille." },
];
const VISIOS: Record<string, string> = { daily: "Daily", campus: "Visio intégrée du campus", jitsi: "Jitsi" };
const COULEURS = ["#E4793A", "#2563EB", "#1F8A5B", "#7C3AED", "#C2410C", "#0E7490", "#B7791F", "#141414"];

type Prerempli = { jour: number; heureDebut: string; heureFin: string };

export function FenetreCreneau({
  session,
  creneau,
  prerempli,
  onFermer,
  surEnregistre,
}: {
  session: SessionEditionDto;
  creneau?: CreneauEditionDto;
  prerempli?: Prerempli;
  onFermer: () => void;
  surEnregistre: (s: SessionEditionDto) => void;
}) {
  const { data: options } = useQuery<OptionsProgrammeDto>({ queryKey: ["/api/pilotage/programme/options"] });
  const [type, setType] = useState<TypeCreneau>(creneau?.type ?? "cours");
  const [jour, setJour] = useState(creneau?.jour ?? prerempli?.jour ?? 1);
  const [heureDebut, setHeureDebut] = useState(creneau?.heureDebut ?? prerempli?.heureDebut ?? "08:30");
  const [heureFin, setHeureFin] = useState(creneau?.heureFin ?? prerempli?.heureFin ?? "12:30");
  const [coursId, setCoursId] = useState<number | null>(creneau?.cours?.id ?? null);
  const [titre, setTitre] = useState(creneau?.titreSaisi ?? "");
  const [intervenantId, setIntervenantId] = useState<number | null>(creneau?.intervenant?.id ?? null);
  const [intervenantNom, setIntervenantNom] = useState(creneau?.intervenantNomSaisi ?? "");
  const [mention, setMention] = useState(creneau?.mentionSaisie ?? "");
  const [fournisseur, setFournisseur] = useState<string>(creneau?.fournisseur ?? "");
  const [envoi, setEnvoi] = useState(false);
  const [chevauchements, setChevauchements] = useState<{ message: string; liste: ChevauchementDto[] } | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [nouveauCours, setNouveauCours] = useState(false);
  const [nouveauFormateur, setNouveauFormateur] = useState(false);
  const [codeRemis, setCodeRemis] = useState<CompteCree | null>(null);

  const coursChoisi = options?.cours.find((c) => c.id === coursId) ?? (creneau?.cours && creneau.cours.id === coursId ? { ...creneau.cours, statut: "", formateurId: null, formateur: null } : undefined);
  const personne = options?.formateurs.find((f) => f.id === intervenantId);
  const erreurHeures = heureDebut && heureFin && minutes(heureFin) <= minutes(heureDebut) ? "La fin doit venir après le début." : undefined;
  const libelle = coursChoisi?.titre || titre || (type === "seminaire" ? "Séminaire" : type === "evenement" ? "Événement" : "");
  const nomImprime = intervenantNom.trim() || (personne ? `${personne.prenom} ${personne.nom}` : "");
  const mentionImprimee = mention.trim() || personne?.titre || "";
  const pret = !erreurHeures && (type === "cours" || coursId || titre.trim());
  const publiee = session.statut === "publiee";
  const visios = (options?.fournisseurs ?? []).filter((f) => f in VISIOS);

  const corps = (confirmer?: boolean) => ({
    jour,
    heureDebut,
    heureFin,
    type,
    coursId,
    titre: titre.trim(),
    intervenantId,
    intervenantNom: intervenantNom.trim(),
    mention: mention.trim(),
    fournisseur: fournisseur || null,
    ...(confirmer ? { confirmer: true } : {}),
  });

  const enregistrer = async (confirmer?: boolean) => {
    setEnvoi(true);
    try {
      const s = creneau
        ? await patch<SessionEditionDto>(`/api/pilotage/programme/creneaux/${creneau.id}`, corps(confirmer))
        : await post<SessionEditionDto>(`/api/pilotage/programme/sessions/${session.id}/creneaux`, corps(confirmer));
      toast(creneau ? "Créneau modifié." : "Créneau ajouté.");
      surEnregistre(s);
    } catch (e) {
      const details = e instanceof ErreurApi && e.statut === 409 ? (e.details as { chevauchements?: ChevauchementDto[] } | undefined) : undefined;
      if (details?.chevauchements) setChevauchements({ message: (e as Error).message, liste: details.chevauchements });
      else toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async () => {
    if (!creneau) return;
    setEnvoi(true);
    try {
      const s = await suppr<SessionEditionDto>(`/api/pilotage/programme/creneaux/${creneau.id}`);
      toast("Créneau retiré.");
      surEnregistre(s);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      ouverte
      large
      onFermer={onFermer}
      titre={creneau ? "Modifier le créneau" : "Nouveau créneau"}
      description={`${session.titre} · chaque semaine, du ${session.debut.split("-").reverse().join("/")} au ${session.fin.split("-").reverse().join("/")}. Heures d'Abidjan.`}
      pied={
        confirmerSuppression ? (
          <>
            <Bouton variante="fantome" onClick={() => setConfirmerSuppression(false)}>
              Garder le créneau
            </Bouton>
            <Bouton variante="danger" onClick={retirer} chargement={envoi} icone={<Trash2 className="h-4 w-4" />}>
              Retirer définitivement
            </Bouton>
          </>
        ) : chevauchements ? (
          <>
            <Bouton variante="fantome" onClick={() => setChevauchements(null)}>
              Corriger les heures
            </Bouton>
            <Bouton onClick={() => enregistrer(true)} chargement={envoi}>
              Enregistrer quand même
            </Bouton>
          </>
        ) : (
          <>
            {creneau && (
              <Bouton variante="fantome" className="mr-auto text-danger hover:text-danger" icone={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmerSuppression(true)}>
                Retirer
              </Bouton>
            )}
            <Bouton variante="fantome" onClick={onFermer}>
              Annuler
            </Bouton>
            <Bouton onClick={() => enregistrer()} chargement={envoi} disabled={!pret}>
              {creneau ? "Enregistrer" : "Ajouter le créneau"}
            </Bouton>
          </>
        )
      }
    >
      {confirmerSuppression && creneau ? (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border-2 border-danger bg-danger-clair p-4 text-danger">
          <p className="font-extrabold">Retirer « {creneau.libelle} » du {JOURS[creneau.jour].toLowerCase()} ?</p>
          <p className="text-[15px]">
            {publiee && creneau.nbSeances
              ? "Ses séances à venir seront annulées tout de suite, et les étudiants et l'intervenant prévenus. Les séances déjà passées restent dans l'historique."
              : "Il disparaît de la grille. Aucune séance n'a encore été créée pour lui."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          {chevauchements && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-alerte bg-alerte-clair p-4 text-alerte">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-[15px] font-semibold">{chevauchements.message}</p>
            </div>
          )}

          <div role="radiogroup" aria-label="Type de créneau" className="grid gap-2 sm:grid-cols-3">
            {TYPES.map((t) => (
              <button
                key={t.valeur}
                type="button"
                role="radio"
                aria-checked={type === t.valeur}
                onClick={() => {
                  setType(t.valeur);
                  if (t.valeur === "seminaire" && !titre) setTitre("Séminaire");
                }}
                className={cn("flex flex-col gap-0.5 rounded-2xl border-2 px-4 py-3 text-left", type === t.valeur ? "border-encre bg-creme" : "border-ligne hover:border-orange")}
              >
                <span className="font-extrabold">{t.libelle}</span>
                <span className="text-[12.5px] leading-snug text-texte-pale">{t.aide}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Selection libelle="Jour" value={jour} onChange={(e) => setJour(Number(e.target.value))}>
              {JOURS.slice(1).map((j, i) => (
                <option key={j} value={i + 1}>
                  {j}
                </option>
              ))}
            </Selection>
            <Champ libelle="Début" type="time" step={300} value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />
            <Champ libelle="Fin" type="time" step={300} value={heureFin} onChange={(e) => setHeureFin(e.target.value)} erreur={erreurHeures} />
          </div>
          {type !== "cours" && (
            <div className="-mt-2 flex flex-wrap gap-2">
              <button type="button" className="min-h-[36px] rounded-full border border-ligne px-3 text-[13px] font-semibold text-texte-doux hover:border-orange" onClick={() => { setHeureDebut("08:30"); setHeureFin("17:00"); }}>
                Toute la journée (08h30–17h00)
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <Selection
                className="flex-1"
                libelle={type === "cours" ? "Cours" : "Cours diffusé en direct (facultatif)"}
                value={coursId ?? ""}
                onChange={(e) => setCoursId(e.target.value ? Number(e.target.value) : null)}
                aide={type === "cours" && !coursId ? "Sans cours, aucune séance en direct n'est créée." : undefined}
              >
                <option value="">{type === "cours" ? "Choisir un cours…" : "Aucun"}</option>
                {/* Cours déjà choisi mais absent des options (partagé depuis avec un autre campus) : il reste affiché. */}
                {creneau?.cours && options && !options.cours.some((c) => c.id === creneau.cours!.id) && (
                  <option value={creneau.cours.id}>
                    {creneau.cours.titre} · {creneau.cours.code}
                  </option>
                )}
                {(options?.cours ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titre} · {c.code}
                    {c.statut === "brouillon" ? " (brouillon)" : ""}
                  </option>
                ))}
              </Selection>
              {!nouveauCours && (
                <Bouton variante="doux" icone={<Plus className="h-4 w-4" />} onClick={() => setNouveauCours(true)} className="mb-[1px] min-h-[50px] shrink-0">
                  Nouveau cours
                </Bouton>
              )}
            </div>
            {nouveauCours && (
              <NouveauCours
                formateurId={personne ? intervenantId : null}
                onFermer={() => setNouveauCours(false)}
                surCree={(id) => {
                  setCoursId(id);
                  setNouveauCours(false);
                }}
              />
            )}
          </div>

          <Champ
            libelle={type === "cours" ? "Précision (facultative)" : "Titre affiché"}
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            maxLength={120}
            placeholder={type === "cours" ? "Par exemple : atelier pratique" : "Séminaire"}
            aide={type === "cours" ? "Le titre du cours s'affiche ; la précision reste pour l'équipe." : undefined}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <Selection
                className="flex-1"
                libelle="Intervenant"
                value={intervenantId ?? ""}
                onChange={(e) => setIntervenantId(e.target.value ? Number(e.target.value) : null)}
                aide={!intervenantId && intervenantNom ? "Sans compte, l'intervenant est imprimé mais ne pourra pas ouvrir sa classe en direct." : undefined}
              >
                <option value="">{intervenantNom ? "Pas encore de compte" : "Choisir un formateur…"}</option>
                {(options?.formateurs ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.prenom} {f.nom}
                    {f.titre ? ` · ${f.titre}` : ""}
                    {f.active ? "" : " (pas encore activé)"}
                  </option>
                ))}
              </Selection>
              {!nouveauFormateur && options?.peutCreerFormateur && (
                <Bouton variante="doux" icone={<Plus className="h-4 w-4" />} onClick={() => setNouveauFormateur(true)} className="mb-[1px] min-h-[50px] shrink-0">
                  Nouveau formateur
                </Bouton>
              )}
            </div>
            {nouveauFormateur && (
              <NouveauFormateur
                mention={mention}
                onFermer={() => setNouveauFormateur(false)}
                surCree={(c) => {
                  setIntervenantId(c.compte.id);
                  if (!mention && c.compte.titre) setMention(c.compte.titre);
                  setNouveauFormateur(false);
                  setCodeRemis(c);
                }}
              />
            )}
            {codeRemis && <CodeRemis c={codeRemis} onFermer={() => setCodeRemis(null)} />}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Champ
              libelle="Nom imprimé"
              value={intervenantNom}
              onChange={(e) => setIntervenantNom(e.target.value)}
              maxLength={120}
              placeholder={personne ? `${personne.prenom} ${personne.nom}` : "M. Kouadio José"}
              aide="Tel qu'il s'imprime (« M. Konaté ») ; vide : le nom du compte."
            />
            <Champ
              libelle="Mention imprimée"
              value={mention}
              onChange={(e) => setMention(e.target.value)}
              maxLength={120}
              placeholder={personne?.titre || "Consultant canadien"}
              aide="Sous le nom ; vide : le titre du profil."
            />
          </div>

          {(coursId || type === "cours") && (
            <Selection libelle="Visio des séances" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} aide="Le formateur pourra encore basculer sur le Plan B pendant la classe.">
              <option value="">Par défaut du campus ({VISIOS[options?.fournisseurParDefaut ?? "daily"] ?? options?.fournisseurParDefaut ?? "Daily"})</option>
              {visios.map((f) => (
                <option key={f} value={f}>
                  {VISIOS[f]}
                </option>
              ))}
            </Selection>
          )}

          <ApercuPapier libelle={libelle} nom={nomImprime} mention={mentionImprimee} heures={erreurHeures ? "" : `${JOURS[jour]} · ${hh(heureDebut)}–${hh(heureFin)}`} />
        </div>
      )}
    </Fenetre>
  );
}

/** La case telle qu'elle s'imprimera sur le document du service des études. */
function ApercuPapier({ libelle, nom, mention, heures }: { libelle: string; nom: string; mention: string; heures: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-creme p-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex flex-col gap-0.5 sm:w-44">
        <span className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">Aperçu à l'impression</span>
        <span className="text-sm text-texte-pale">{heures}</span>
      </div>
      <div className="flex min-h-[112px] flex-1 flex-col items-center justify-center gap-2.5 border-[1.5px] border-black bg-white px-3 py-3 text-center font-bold uppercase leading-tight text-black" style={{ fontFamily: "'Times New Roman', Times, 'Liberation Serif', serif" }}>
        <span>{libelle || "…"}</span>
        {nom && <span>{nom}</span>}
        {mention && <span>{mention}</span>}
      </div>
    </div>
  );
}

function NouveauCours({ formateurId, onFermer, surCree }: { formateurId: number | null; onFermer: () => void; surCree: (id: number) => void }) {
  const [titre, setTitre] = useState("");
  const [code, setCode] = useState("");
  const [couleur, setCouleur] = useState(COULEURS[0]);
  const [envoi, setEnvoi] = useState(false);
  const codePropose = useMemo(() => {
    const mots = titre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter((m) => m && !["A", "L", "LA", "LE", "LES", "DE", "DU", "DES", "ET", "EN", "D"].includes(m));
    const sigle = mots.length > 1 ? mots.map((m) => m[0]).join("").slice(0, 4) : (mots[0] ?? "").slice(0, 4);
    return sigle ? `${sigle}-101` : "";
  }, [titre]);
  const creer = async () => {
    setEnvoi(true);
    try {
      const c = await post<CoursDetail>("/api/cours", { code: (code || codePropose).trim(), titre: titre.trim(), formateurId });
      if (couleur !== "#E4793A") await patch(`/api/cours/${c.id}`, { couleur });
      await queryClient.invalidateQueries({ queryKey: ["/api/pilotage/programme/options"] });
      void rafraichir("/api/cours");
      toast(`Cours ${c.code} créé. Il sera ouvert aux étudiants à la publication.`);
      surCree(c.id);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-orange/40 bg-orange-pale p-4">
      <div className="flex items-center justify-between">
        <span className="font-extrabold">Nouveau cours</span>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="rounded-full p-2 text-texte-pale hover:bg-white hover:text-encre">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
        <Champ libelle="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Initiation à l'IA" maxLength={140} />
        <Champ libelle="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={codePropose || "IA-101"} maxLength={20} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">Couleur</span>
        <div className="flex flex-wrap gap-2">
          {COULEURS.map((c) => (
            <button key={c} type="button" onClick={() => setCouleur(c)} aria-label={`Couleur ${c}`} aria-pressed={couleur === c} className={cn("h-9 w-9 rounded-full ring-offset-2", couleur === c && "ring-2 ring-encre")} style={{ background: c }} />
          ))}
        </div>
      </div>
      <p className="text-[13px] text-texte-pale">Le cours est créé en brouillon ; la publication de l'emploi du temps l'ouvre aux classes destinataires. Son contenu se prépare ensuite dans « Cours ».</p>
      <Bouton onClick={creer} chargement={envoi} disabled={titre.trim().length < 3 || !(code || codePropose)} className="self-start">
        Créer le cours
      </Bouton>
    </div>
  );
}

function NouveauFormateur({ mention, onFermer, surCree }: { mention: string; onFermer: () => void; surCree: (c: CompteCree) => void }) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [titre, setTitre] = useState(mention);
  const [localisation, setLocalisation] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const creer = async () => {
    setEnvoi(true);
    try {
      const c = await post<CompteCree>("/api/pilotage/comptes", {
        role: "formateur",
        prenom: prenom.trim(),
        nom: nom.trim(),
        email: email.trim(),
        telephone: telephone.trim() || null,
        titre: titre.trim() || null,
        localisation: localisation.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/pilotage/programme/options"] });
      void rafraichir("/api/pilotage/comptes");
      surCree(c);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-orange/40 bg-orange-pale p-4">
      <div className="flex items-center justify-between">
        <span className="font-extrabold">Nouveau formateur</span>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="rounded-full p-2 text-texte-pale hover:bg-white hover:text-encre">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Champ libelle="Prénom" value={prenom} onChange={(e) => setPrenom(e.target.value)} maxLength={80} />
        <Champ libelle="Nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={80} />
        <Champ libelle="E-mail (identifiant)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} />
        <Champ libelle="Téléphone ou WhatsApp (facultatif)" value={telephone} onChange={(e) => setTelephone(e.target.value)} maxLength={30} />
        <Champ libelle="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Consultant canadien" maxLength={120} />
        <Champ libelle="Pays ou ville (facultatif)" value={localisation} onChange={(e) => setLocalisation(e.target.value)} placeholder="Montréal, Canada" maxLength={120} />
      </div>
      <p className="text-[13px] text-texte-pale">Un code provisoire s'affichera une seule fois : transmettez-le au formateur (WhatsApp ou e-mail). Il choisira son code secret à la première connexion.</p>
      <Bouton onClick={creer} chargement={envoi} disabled={!prenom.trim() || !nom.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())} className="self-start">
        Créer le compte
      </Bouton>
    </div>
  );
}

function CodeRemis({ c, onFermer }: { c: CompteCree; onFermer: () => void }) {
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(`Campus numérique 2IAE\nIdentifiant : ${c.compte.email}\nCode provisoire : ${c.code}\nPremière connexion : ${c.lien}`);
      toast("Copié.");
    } catch {
      toast("Copie impossible : notez le code.", "erreur");
    }
  };
  return (
    <div role="status" className="flex flex-col gap-3 rounded-2xl border-2 border-succes bg-succes-clair p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-extrabold text-succes">
            Compte créé pour {c.compte.prenom} {c.compte.nom}
          </p>
          <p className="text-[13px] text-texte-pale">Ce code ne sera plus affiché. Transmettez-le maintenant.</p>
        </div>
        <button type="button" onClick={onFermer} aria-label="Fermer" className="rounded-full p-2 text-texte-pale hover:bg-white hover:text-encre">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-white px-4 py-3">
          <div className="etiquette">Identifiant</div>
          <div className="break-all font-mono text-[15px] font-semibold">{c.compte.email}</div>
        </div>
        <div className="rounded-xl bg-white px-4 py-3">
          <div className="etiquette">Code provisoire</div>
          <div className="font-mono text-xl font-semibold tracking-wide">{c.code}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={c.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-orange px-4 text-sm font-bold text-encre no-underline hover:bg-encre hover:text-white">
          <MessageCircle className="h-4 w-4" /> Envoyer sur WhatsApp
        </a>
        <Bouton variante="contour" taille="sm" icone={<Copy className="h-4 w-4" />} onClick={copier} className="min-h-[44px]">
          Copier
        </Bouton>
      </div>
    </div>
  );
}
