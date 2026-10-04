// Fiche d'un compte : création ou modification, nouveau code, désactivation.
// Les champs changent selon le rôle : un étudiant a un matricule et une
// classe ; le personnel se connecte avec son e-mail ; la vie scolaire et les
// salles ont un campus ; les formateurs travaillent pour tout le groupe.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { KeyRound, FolderOpen, Power, Send, MonitorSmartphone, Repeat } from "lucide-react";
import type { CompteLigne, CompteCree, CodeRemis, Role, ProfilEquipe } from "@shared/schema";
import { LIBELLES_ROLES, PROFILS_EQUIPE, DROITS_PROFILS, libelleProfil } from "@shared/schema";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Selection } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, patch, suppr, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useMoiConnecte, profilPermet } from "@/lib/auth";
import { dateCourte } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useReferences, telephoneLisible, etatCompte } from "../outils";
import { Badge } from "@/components/ui/divers";

type Formulaire = {
  role: Role;
  prenom: string;
  nom: string;
  matricule: string;
  email: string;
  telephone: string;
  classeId: string;
  /** Identifiant du campus, « tous » (équipe de tout le groupe, choix de la direction) ou vide. */
  siteId: string;
  titre: string;
  localisation: string;
  /** Équipe : profil (ext-profils.ts) ; vide = vie scolaire par défaut (comptes d'avant les profils). */
  profil: "" | ProfilEquipe;
};

const TOUS_LES_CAMPUS = "tous";

const vide = (role: Role = "etudiant"): Formulaire => ({
  role,
  prenom: "",
  nom: "",
  matricule: "",
  email: "",
  telephone: "",
  classeId: "",
  siteId: "",
  titre: "",
  localisation: "",
  profil: "",
});

const depuisCompte = (c: CompteLigne): Formulaire => ({
  role: c.role,
  prenom: c.prenom,
  nom: c.nom,
  matricule: c.matricule ?? "",
  email: c.email ?? "",
  telephone: telephoneLisible(c.telephone),
  classeId: c.classeId ? String(c.classeId) : "",
  siteId: c.siteId ? String(c.siteId) : c.role === "vie_scolaire" ? TOUS_LES_CAMPUS : "",
  titre: c.titre ?? "",
  localisation: c.localisation ?? "",
  profil: c.profil ?? "",
});

/** « M. Konaté » → prénom « M. », nom « Konaté » ; « Claude Trépanier » → « Claude » / « Trépanier ». */
export function separerNom(complet: string): { prenom: string; nom: string } {
  const mots = complet.replace(/\s+/g, " ").trim().split(" ");
  if (mots.length < 2) return { prenom: "", nom: mots[0] ?? "" };
  return { prenom: mots[0], nom: mots.slice(1).join(" ") };
}

export function FenetreCompte({
  ouverte,
  compte,
  roleParDefaut,
  nomParDefaut,
  onFermer,
  onCode,
  onInviter,
  onEcran,
}: {
  ouverte: boolean;
  /** null : création d'un compte. */
  compte: CompteLigne | null;
  roleParDefaut?: Role;
  /** Création : nom complet à préremplir (« M. Konaté », depuis l'emploi du temps). */
  nomParDefaut?: string;
  onFermer: () => void;
  /** Un code vient d'être remis (création ou nouveau code) : à montrer une seule fois. */
  onCode: (remis: CodeRemis, compte: CompteLigne, nouveauCompte: boolean) => void;
  /** Formateur ou équipe pas encore activé : ouvrir la fenêtre « Inviter ». */
  onInviter?: (compte: CompteLigne) => void;
  /** Écran de salle : ouvrir la fenêtre « Installer l'écran ». */
  onEcran?: (site: { id: number; nom: string }) => void;
}) {
  const moi = useMoiConnecte();
  const refs = useReferences();
  const [f, setF] = useState<Formulaire>(vide(roleParDefaut));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<null | "enregistrer" | "code" | "actif">(null);
  const [confirmerCode, setConfirmerCode] = useState(false);

  useEffect(() => {
    if (!ouverte) return;
    setF(compte ? depuisCompte(compte) : { ...vide(roleParDefaut), ...(nomParDefaut ? separerNom(nomParDefaut) : {}) });
    setErreur(null);
    setConfirmerCode(false);
  }, [ouverte, compte, roleParDefaut, nomParDefaut]);

  const maj = (champ: keyof Formulaire) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [champ]: e.target.value }));
  const creation = !compte;
  const direction = moi.role === "admin";
  const rolesPossibles: Role[] = direction ? ["etudiant", "formateur", "vie_scolaire", "salle", "admin"] : ["etudiant", "formateur", "vie_scolaire", "salle"];
  const estEtudiant = f.role === "etudiant";
  const avecSite = f.role === "vie_scolaire" || f.role === "salle";
  /** Formateur et écran de salle peuvent se passer d'e-mail (invitation par lien, installation par code). */
  const emailFacultatif = estEtudiant || f.role === "formateur" || f.role === "salle";
  const invitable =
    compte && compte.actif && !compte.active && compte.id !== moi.id && (compte.role === "formateur" || compte.role === "vie_scolaire" || compte.role === "admin") && profilPermet(moi, "comptes_personnel");
  // Ce que le profil de la personne permet sur ce compte (ext-profils.ts ; le serveur fait foi).
  const etudiantVise = (compte?.role ?? f.role) === "etudiant";
  const peutModifier = profilPermet(moi, "comptes_gerer") && (etudiantVise || profilPermet(moi, "comptes_personnel"));
  const peutDonnerCode = profilPermet(moi, "nouveau_code") && (etudiantVise || profilPermet(moi, "comptes_personnel"));
  /** La direction choisit le profil et peut ouvrir tout le groupe à un membre de l'équipe. */
  const choixProfil = direction && f.role === "vie_scolaire";

  const corps = () => {
    const base: Record<string, unknown> = {
      prenom: f.prenom,
      nom: f.nom,
      telephone: f.telephone || null,
      email: f.email || null,
    };
    if (creation || (direction && compte && f.role !== compte.role)) base.role = f.role;
    if (estEtudiant) {
      base.matricule = f.matricule || null;
      base.classeId = f.classeId ? Number(f.classeId) : null;
    }
    // « Tous les campus » : null ; campus pas encore choisi : rien (le serveur le demande).
    if (avecSite && f.siteId) base.siteId = f.siteId === TOUS_LES_CAMPUS ? null : Number(f.siteId);
    if (choixProfil) base.profil = f.profil || null;
    if (f.role === "formateur") {
      base.titre = f.titre || null;
      base.localisation = f.localisation || null;
    }
    return base;
  };

  const enregistrer = async () => {
    if (choixProfil && creation && !f.profil) {
      setErreur("Choisissez le profil de ce membre de l'équipe : ce qu'il pourra voir et faire.");
      return;
    }
    setEnvoi("enregistrer");
    setErreur(null);
    try {
      if (creation) {
        const r = await post<CompteCree>("/api/pilotage/comptes", corps());
        toast(`Compte de ${r.compte.prenom} créé`);
        await rafraichir("/api/pilotage/comptes", "/api/pilotage/tableau", "/api/pilotage/classes");
        onFermer();
        onCode(r, r.compte, true);
      } else {
        await patch<CompteLigne>(`/api/pilotage/comptes/${compte.id}`, corps());
        toast("Modifications enregistrées");
        await rafraichir("/api/pilotage/comptes", "/api/pilotage/etudiants", "/api/pilotage/classes");
        onFermer();
      }
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Une erreur est survenue.");
    } finally {
      setEnvoi(null);
    }
  };

  const nouveauCode = async () => {
    if (!compte) return;
    setEnvoi("code");
    try {
      const r = await post<CodeRemis>(`/api/pilotage/comptes/${compte.id}/nouveau-code`);
      await rafraichir("/api/pilotage/comptes", "/api/pilotage/etudiants", "/api/pilotage/a-contacter");
      onFermer();
      onCode(r, compte, false);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  };

  const basculerActif = async () => {
    if (!compte) return;
    setEnvoi("actif");
    try {
      await patch(`/api/pilotage/comptes/${compte.id}`, { actif: !compte.actif });
      toast(compte.actif ? `Compte de ${compte.prenom} désactivé : il ne peut plus se connecter.` : `Compte de ${compte.prenom} réactivé`);
      await rafraichir("/api/pilotage/comptes", "/api/pilotage/etudiants", "/api/pilotage/tableau");
      onFermer();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  };

  const etat = compte ? etatCompte(compte) : null;
  const classesParSite = (refs.data?.sites ?? []).map((s) => ({ site: s, classes: (refs.data?.classes ?? []).filter((c) => c.siteId === s.id) }));

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      large
      titre={creation ? "Nouveau compte" : `${compte.prenom} ${compte.nom}`}
      description={
        creation
          ? f.role === "formateur"
            ? "Vous l'inviterez ensuite par un lien : il vérifiera son nom, choisira son identifiant et son mot de passe."
            : f.role === "salle"
              ? "Vous installerez ensuite l'écran avec un code à taper sur l'ordinateur de la salle."
              : "Un code provisoire à 6 chiffres (ou une phrase de passe pour le personnel) sera créé et montré une seule fois."
          : `${compte.role === "vie_scolaire" ? libelleProfil(compte) : LIBELLES_ROLES[compte.role]}${
              compte.site ? ` · Campus ${compte.site}` : compte.role === "vie_scolaire" ? " · Tous les campus" : ""
            } · créé le ${dateCourte(compte.creeLe)}`
      }
      pied={
        peutModifier ? (
          <>
            {!creation && compte.id !== moi.id && (
              <Bouton variante="fantome" icone={<Power className="h-4 w-4" />} onClick={basculerActif} chargement={envoi === "actif"}>
                {compte.actif ? "Désactiver" : "Réactiver"}
              </Bouton>
            )}
            <Bouton onClick={enregistrer} chargement={envoi === "enregistrer"}>
              {creation ? "Créer le compte" : "Enregistrer"}
            </Bouton>
          </>
        ) : (
          <Bouton variante="contour" onClick={onFermer}>
            Fermer
          </Bouton>
        )
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {!creation && etat && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-creme p-4">
            <Badge ton={etat.ton}>{etat.texte}</Badge>
            <span className="text-sm text-texte-pale">
              {compte.derniereConnexion ? `Dernière connexion le ${dateCourte(compte.derniereConnexion)}` : "Jamais connecté"}
            </span>
            <div className="flex w-full flex-wrap gap-2 pt-1 sm:ml-auto sm:w-auto sm:pt-0">
              {compte.role === "etudiant" && (
                <Link
                  href={`/pilotage/etudiants/${compte.id}`}
                  className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl border-[1.5px] border-encre bg-white px-4 text-sm font-bold text-encre no-underline hover:bg-orange-pale hover:text-encre"
                >
                  <FolderOpen className="h-4 w-4" /> Dossier
                </Link>
              )}
              {invitable && onInviter && (
                <Bouton taille="sm" className="min-h-[48px]" icone={<Send className="h-4 w-4" />} onClick={() => (onFermer(), onInviter(compte))}>
                  Inviter
                </Bouton>
              )}
              {compte.role === "salle" && compte.actif && compte.siteId && onEcran && (
                <Bouton taille="sm" className="min-h-[48px]" icone={<MonitorSmartphone className="h-4 w-4" />} onClick={() => (onFermer(), onEcran({ id: compte.siteId!, nom: compte.site ?? "Campus" }))}>
                  {compte.active ? "Réinstaller l'écran" : "Installer l'écran"}
                </Bouton>
              )}
              {peutDonnerCode && compte.actif && compte.id !== moi.id && !confirmerCode && compte.role !== "salle" && (
                <Bouton variante="encre" taille="sm" className="min-h-[48px]" icone={<KeyRound className="h-4 w-4" />} onClick={() => setConfirmerCode(true)}>
                  Nouveau code
                </Bouton>
              )}
            </div>
            {confirmerCode && (
              <div className="w-full rounded-xl border border-orange bg-white p-3 text-sm">
                <p className="font-semibold">Créer un nouveau code pour {compte.prenom} ?</p>
                <p className="mt-1 text-texte-pale">L'ancien code et l'ancienne fiche ne marcheront plus, et ses appareils seront déconnectés.</p>
                <div className="mt-3 flex gap-2">
                  <Bouton taille="sm" onClick={nouveauCode} chargement={envoi === "code"}>
                    Oui, créer le code
                  </Bouton>
                  <Bouton taille="sm" variante="fantome" onClick={() => setConfirmerCode(false)}>
                    Annuler
                  </Bouton>
                </div>
              </div>
            )}
          </div>
        )}

        {!peutModifier && (
          <p className="rounded-xl bg-creme px-4 py-3 text-sm text-texte-doux">
            Fiche en lecture : votre profil ({libelleProfil(moi)}) ne permet pas de modifier ce compte.
            {peutDonnerCode && compte?.role === "etudiant" ? " Vous pouvez lui donner un nouveau code." : ""}
          </p>
        )}

        {/* Fiche en lecture seule quand le profil ne permet pas de la modifier : tous les champs sont désactivés. */}
        <fieldset disabled={!peutModifier} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        {(creation || direction) && (
          <Selection libelle="Rôle" value={f.role} onChange={maj("role")} disabled={!creation && compte?.id === moi.id}>
            {rolesPossibles.map((r) => (
              <option key={r} value={r}>
                {LIBELLES_ROLES[r]}
              </option>
            ))}
          </Selection>
        )}

        {choixProfil && (
          <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
            <legend className="mb-1.5 text-sm font-bold text-encre">Profil : ce que cette personne peut voir et faire</legend>
            {!f.profil && !creation && (
              <p className="text-[13px] text-texte-gris">Aucun profil choisi pour l'instant : ce compte a les droits de la vie scolaire.</p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PROFILS_EQUIPE.map((p) => (
                <label
                  key={p}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                    f.profil === p ? "border-orange bg-orange-pale" : "border-ligne bg-white hover:border-orange",
                  )}
                >
                  <input type="radio" name="profil" className="mt-1 h-4 w-4 shrink-0 accent-[#E4793A]" checked={f.profil === p} onChange={() => setF((x) => ({ ...x, profil: p }))} />
                  <span className="min-w-0">
                    <span className="block font-bold text-encre">{DROITS_PROFILS[p].libelle}</span>
                    <span className="block text-[13px] leading-snug text-texte-pale">{DROITS_PROFILS[p].description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ libelle="Prénom(s)" value={f.prenom} onChange={maj("prenom")} autoComplete="off" required />
          <Champ libelle="Nom" value={f.nom} onChange={maj("nom")} autoComplete="off" required />
        </div>

        {estEtudiant && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ libelle="Matricule" value={f.matricule} onChange={maj("matricule")} placeholder="24GC0123" aide="C'est son identifiant de connexion." className="font-mono" autoCapitalize="characters" />
            <Selection libelle="Classe" value={f.classeId} onChange={maj("classeId")}>
              <option value="">Choisir la classe…</option>
              {classesParSite.map(({ site, classes }) =>
                classes.length ? (
                  <optgroup key={site.id} label={site.nomCourt}>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </Selection>
          </div>
        )}

        {avecSite && (
          <Selection
            libelle="Campus"
            value={f.siteId}
            onChange={maj("siteId")}
            aide={choixProfil ? "Un campus : la personne ne voit que ce campus. Tous les campus : tout le groupe." : undefined}
          >
            <option value="">Choisir le campus…</option>
            {choixProfil && <option value={TOUS_LES_CAMPUS}>Tous les campus (tout le groupe)</option>}
            {(refs.data?.sites ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nomCourt}
              </option>
            ))}
          </Selection>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ libelle="Téléphone" value={f.telephone} onChange={maj("telephone")} inputMode="tel" placeholder="07 07 12 34 56" aide="Pour les messages WhatsApp de la vie scolaire." />
          <Champ
            libelle={emailFacultatif ? "E-mail (facultatif)" : "E-mail"}
            value={f.email}
            onChange={maj("email")}
            type="email"
            inputMode="email"
            placeholder={estEtudiant ? "si l'étudiant en a un" : f.role === "salle" ? "inutile pour un écran" : f.role === "formateur" ? "son adresse, si vous la connaissez" : "prenom.nom@2iae.com"}
            aide={
              estEtudiant
                ? "Sert à recevoir un lien en cas de code oublié."
                : f.role === "formateur"
                  ? "Inconnu ? Laissez vide : il choisira son identifiant en ouvrant son invitation."
                  : f.role === "salle"
                    ? "L'écran s'installe avec un code, sans e-mail."
                    : "C'est son identifiant de connexion."
            }
          />
        </div>

        {f.role === "formateur" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ libelle="Titre (facultatif)" value={f.titre} onChange={maj("titre")} placeholder="Consultant canadien" aide="Imprimé sous son nom dans l'emploi du temps." />
            <Champ libelle="Ville (facultatif)" value={f.localisation} onChange={maj("localisation")} placeholder="Montréal, Canada" />
          </div>
        )}
        </fieldset>

        {!creation && direction && (compte.casquette || (compte.role === "formateur" && compte.actif)) && (
          <DoubleCasquette compte={compte} moiId={moi.id} sites={refs.data?.sites ?? []} onFait={onFermer} />
        )}

        {erreur && (
          <p role="alert" className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">
            {erreur}
          </p>
        )}
      </div>
    </Fenetre>
  );
}

/**
 * Double casquette (direction seulement) : un formateur qui est aussi de la
 * direction ou de la vie scolaire reçoit un second compte, lié, sans code. Il
 * passe de l'un à l'autre depuis son menu, sans se reconnecter.
 */
function DoubleCasquette({ compte, moiId, sites, onFait }: { compte: CompteLigne; moiId: number; sites: { id: number; nomCourt: string }[]; onFait: () => void }) {
  const [role, setRole] = useState<"admin" | "vie_scolaire">("admin");
  const [siteId, setSiteId] = useState("");
  const [profil, setProfil] = useState<ProfilEquipe>("vie_scolaire");
  const [envoi, setEnvoi] = useState(false);
  const porteeParMoi = compte.id === moiId || compte.casquette?.id === moiId;

  const donner = async () => {
    setEnvoi(true);
    try {
      await post(`/api/pilotage/comptes/${compte.id}/casquette`, {
        role,
        siteId: role === "vie_scolaire" && siteId ? Number(siteId) : null,
        profil: role === "vie_scolaire" ? profil : null,
      });
      toast(`${compte.prenom} a maintenant la double casquette : « Passer en ${role === "admin" ? "Direction" : "Vie scolaire"} » dans son menu.`);
      await rafraichir("/api/pilotage/comptes");
      onFait();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const retirer = async () => {
    if (!window.confirm(`Retirer la double casquette de ${compte.prenom} ${compte.nom} ? Son second compte sera désactivé.`)) return;
    setEnvoi(true);
    try {
      await suppr(`/api/pilotage/comptes/${compte.id}/casquette`);
      toast("Double casquette retirée");
      await rafraichir("/api/pilotage/comptes");
      onFait();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ligne p-4">
      <p className="flex items-center gap-2 text-[15px] font-extrabold">
        <Repeat className="h-4 w-4 text-orange-fonce" /> Double casquette
      </p>
      {compte.casquette ? (
        <>
          <p className="text-sm text-texte-doux">
            {compte.prenom} est aussi <strong>{LIBELLES_ROLES[compte.casquette.role]}</strong>. Il passe d'un compte à l'autre depuis son menu, sans se reconnecter.
          </p>
          {!porteeParMoi && (
            <Bouton variante="contour" taille="sm" className="self-start" onClick={retirer} chargement={envoi}>
              Retirer la double casquette
            </Bouton>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-texte-doux">
            Ce formateur fait aussi partie de l'équipe ? Donnez-lui un accès à la gestion : il passera de « Formateur » à cette casquette d'un clic, depuis son menu.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Selection libelle="Casquette" value={role} onChange={(e) => setRole(e.target.value as "admin" | "vie_scolaire")}>
              <option value="admin">Direction (tout le groupe)</option>
              <option value="vie_scolaire">Vie scolaire d'un campus</option>
            </Selection>
            {role === "vie_scolaire" && (
              <Selection libelle="Campus" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                <option value="">Choisir le campus…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nomCourt}
                  </option>
                ))}
              </Selection>
            )}
            {role === "vie_scolaire" && (
              <Selection libelle="Profil" value={profil} onChange={(e) => setProfil(e.target.value as ProfilEquipe)} className="sm:col-span-2" aide={DROITS_PROFILS[profil].description}>
                {PROFILS_EQUIPE.map((p) => (
                  <option key={p} value={p}>
                    {DROITS_PROFILS[p].libelle}
                  </option>
                ))}
              </Selection>
            )}
          </div>
          <Bouton variante="encre" taille="sm" className="self-start" icone={<Repeat className="h-4 w-4" />} onClick={donner} chargement={envoi} disabled={role === "vie_scolaire" && !siteId}>
            Donner la double casquette
          </Bouton>
        </>
      )}
    </div>
  );
}
