// Fiche d'un compte : création ou modification, nouveau code, désactivation.
// Les champs changent selon le rôle : un étudiant a un matricule et une
// classe ; le personnel se connecte avec son e-mail ; la vie scolaire et les
// salles ont un campus ; les formateurs travaillent pour tout le groupe.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { KeyRound, FolderOpen, Power } from "lucide-react";
import type { CompteLigne, CompteCree, CodeRemis, Role } from "@shared/schema";
import { LIBELLES_ROLES } from "@shared/schema";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Champ, Selection } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, patch, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useMoiConnecte } from "@/lib/auth";
import { dateCourte } from "@/lib/dates";
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
  siteId: string;
  titre: string;
  localisation: string;
};

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
});

const depuisCompte = (c: CompteLigne): Formulaire => ({
  role: c.role,
  prenom: c.prenom,
  nom: c.nom,
  matricule: c.matricule ?? "",
  email: c.email ?? "",
  telephone: telephoneLisible(c.telephone),
  classeId: c.classeId ? String(c.classeId) : "",
  siteId: c.siteId ? String(c.siteId) : "",
  titre: c.titre ?? "",
  localisation: c.localisation ?? "",
});

export function FenetreCompte({
  ouverte,
  compte,
  roleParDefaut,
  onFermer,
  onCode,
}: {
  ouverte: boolean;
  /** null : création d'un compte. */
  compte: CompteLigne | null;
  roleParDefaut?: Role;
  onFermer: () => void;
  /** Un code vient d'être remis (création ou nouveau code) : à montrer une seule fois. */
  onCode: (remis: CodeRemis, compte: CompteLigne, nouveauCompte: boolean) => void;
}) {
  const moi = useMoiConnecte();
  const refs = useReferences();
  const [f, setF] = useState<Formulaire>(vide(roleParDefaut));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<null | "enregistrer" | "code" | "actif">(null);
  const [confirmerCode, setConfirmerCode] = useState(false);

  useEffect(() => {
    if (!ouverte) return;
    setF(compte ? depuisCompte(compte) : vide(roleParDefaut));
    setErreur(null);
    setConfirmerCode(false);
  }, [ouverte, compte, roleParDefaut]);

  const maj = (champ: keyof Formulaire) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [champ]: e.target.value }));
  const creation = !compte;
  const direction = moi.role === "admin";
  const rolesPossibles: Role[] = direction ? ["etudiant", "formateur", "vie_scolaire", "salle", "admin"] : ["etudiant", "formateur", "vie_scolaire", "salle"];
  const estEtudiant = f.role === "etudiant";
  const avecSite = f.role === "vie_scolaire" || f.role === "salle";

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
    if (avecSite) base.siteId = f.siteId ? Number(f.siteId) : null;
    if (f.role === "formateur") {
      base.titre = f.titre || null;
      base.localisation = f.localisation || null;
    }
    return base;
  };

  const enregistrer = async () => {
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
          ? "Un code provisoire à 6 chiffres (ou une phrase de passe pour le personnel) sera créé et montré une seule fois."
          : `${LIBELLES_ROLES[compte.role]}${compte.site ? ` · Campus ${compte.site}` : ""} · créé le ${dateCourte(compte.creeLe)}`
      }
      pied={
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
              {compte.actif && compte.id !== moi.id && !confirmerCode && (
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

        {(creation || direction) && (
          <Selection libelle="Rôle" value={f.role} onChange={maj("role")} disabled={!creation && compte?.id === moi.id}>
            {rolesPossibles.map((r) => (
              <option key={r} value={r}>
                {LIBELLES_ROLES[r]}
              </option>
            ))}
          </Selection>
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
          <Selection libelle="Campus" value={f.siteId} onChange={maj("siteId")}>
            <option value="">Choisir le campus…</option>
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
            libelle={estEtudiant ? "E-mail (facultatif)" : "E-mail"}
            value={f.email}
            onChange={maj("email")}
            type="email"
            inputMode="email"
            placeholder={estEtudiant ? "si l'étudiant en a un" : "prenom.nom@2iae.com"}
            aide={estEtudiant ? "Sert à recevoir un lien en cas de code oublié." : "C'est son identifiant de connexion."}
          />
        </div>

        {f.role === "formateur" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ libelle="Titre (facultatif)" value={f.titre} onChange={maj("titre")} placeholder="Consultant en intelligence artificielle" />
            <Champ libelle="Ville (facultatif)" value={f.localisation} onChange={maj("localisation")} placeholder="Lyon, France" />
          </div>
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
