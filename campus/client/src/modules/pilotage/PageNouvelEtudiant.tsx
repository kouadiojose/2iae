// /pilotage/etudiants/nouveau : l'inscription complète d'un étudiant, sur une
// seule page (identité, classe, contacts, famille, pièces remises, frais et
// premier versement). Préremplie depuis un préinscrit du site 2iae.com
// (?lead=&nom=&telephone=&email=&campus=&filiere=). À la fin : le code
// provisoire à remettre, et le reçu du premier versement.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, UserPlus, Plus, Trash2, Globe, CircleCheck, Printer, FolderOpen, Info } from "lucide-react";
import type { NouvelEtudiant, EtudiantCree, MatriculePropose, ListeFraisClasses, LienResponsable, TypePiece, MoyenPaiement, SiteLigne } from "@shared/schema";
import { LIENS_RESPONSABLE, LIBELLES_LIENS_RESPONSABLE, PIECES_REQUISES, LIBELLES_PIECES } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Squelette } from "@/components/ui/divers";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Champ, Selection, ZoneTexte } from "@/components/ui/champs";
import { toast } from "@/components/ui/toast";
import { post, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { FenetreCode } from "./composants/FenetreCode";
import { useReferences } from "./outils";
import { fcfa, lireMontant, jourCourt, aujourdhui, MOYENS_ORDONNES, libelleMoyen } from "./outils-crm";

type Resp = { cle: number; nom: string; lien: LienResponsable; telephone: string; email: string; profession: string; principal: boolean };

type Formulaire = {
  prenom: string;
  nom: string;
  sexe: "" | "F" | "M";
  dateNaissance: string;
  lieuNaissance: string;
  nationalite: string;
  classeId: string;
  matricule: string;
  dateInscription: string;
  telephone: string;
  whatsapp: string;
  email: string;
  adresse: string;
  responsables: Resp[];
  pieces: TypePiece[];
  appliquerFrais: boolean;
  montant: string;
  moyen: MoyenPaiement;
  reference: string;
  dateVersement: string;
  remarques: string;
};

/** Pièces proposées au guichet : les requises, puis le certificat médical. */
const PIECES_GUICHET: TypePiece[] = [...PIECES_REQUISES, "certificat_medical"];
const MOBILE_MONEY: MoyenPaiement[] = ["wave", "orange_money", "mtn_money", "moov_money"];

let cleSuivante = 1;
const responsableVide = (principal: boolean): Resp => ({ cle: cleSuivante++, nom: "", lien: "pere", telephone: "", email: "", profession: "", principal });

const formulaireVide = (): Formulaire => ({
  prenom: "",
  nom: "",
  sexe: "",
  dateNaissance: "",
  lieuNaissance: "",
  nationalite: "",
  classeId: "",
  matricule: "",
  dateInscription: aujourdhui(),
  telephone: "",
  whatsapp: "",
  email: "",
  adresse: "",
  responsables: [responsableVide(true)],
  pieces: [],
  appliquerFrais: true,
  montant: "",
  moyen: "especes",
  reference: "",
  dateVersement: aujourdhui(),
  remarques: "",
});

/** Mot tout en capitales (« KONÉ »), comme on écrit souvent le nom de famille en Côte d'Ivoire. */
const enCapitales = (m: string) => /\p{L}/u.test(m) && m === m.toLocaleUpperCase("fr-FR") && m !== m.toLocaleLowerCase("fr-FR");

/** « KONÉ Awa Marie » → nom « KONÉ », prénoms « Awa Marie » ; « Awa Koné » → « Awa » / « Koné ». */
function separerNomPreinscrit(complet: string): { prenom: string; nom: string } {
  const mots = complet.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!mots.length) return { prenom: "", nom: "" };
  if (mots.length === 1) return enCapitales(mots[0]) ? { prenom: "", nom: mots[0] } : { prenom: mots[0], nom: "" };
  if (enCapitales(mots[0])) {
    // Plusieurs noms en capitales en tête (« KOUASSI KONAN Jean ») ; tout en capitales : le premier mot seul.
    let n = 1;
    while (n < mots.length - 1 && enCapitales(mots[n])) n++;
    if (mots.every(enCapitales)) n = 1;
    return { nom: mots.slice(0, n).join(" "), prenom: mots.slice(n).join(" ") };
  }
  return { prenom: mots[0], nom: mots.slice(1).join(" ") };
}

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Campus écrit sur le site (« Riviera », « yopougon ») → le campus correspondant, s'il n'y en a qu'un. */
function siteCorrespondant(sites: SiteLigne[], texte: string): SiteLigne | null {
  const t = normaliser(texte);
  if (!t) return null;
  const exacts = sites.filter((s) => normaliser(s.nomCourt) === t);
  if (exacts.length === 1) return exacts[0];
  const proches = sites.filter((s) => t.includes(normaliser(s.nomCourt)) || normaliser(s.nomCourt).includes(t));
  return proches.length === 1 ? proches[0] : null;
}

const LIBELLES_CHAMPS: Record<string, string> = {
  prenom: "Prénom",
  nom: "Nom",
  matricule: "Matricule",
  classeId: "Classe",
  telephone: "Téléphone",
  email: "E-mail",
  sexe: "Sexe",
  dateNaissance: "Date de naissance",
  lieuNaissance: "Lieu de naissance",
  nationalite: "Nationalité",
  adresse: "Adresse",
  whatsapp: "WhatsApp",
  dateInscription: "Date d'inscription",
  remarques: "Remarques",
  "premierVersement.montant": "Montant du versement",
  "premierVersement.reference": "Référence du versement",
  "premierVersement.dateVersement": "Date du versement",
};
const LIBELLES_CHAMPS_RESPONSABLE: Record<string, string> = { nom: "Nom", lien: "Lien", telephone: "Téléphone", email: "E-mail", profession: "Profession" };

/** « responsables.0.email : adresse e-mail invalide » → « E-mail du responsable 2 : adresse e-mail invalide. » */
function messageLisible(message: string, blocs: number[]): string {
  const m = /^([\w.]+) : (.+)$/.exec(message);
  if (!m) return message;
  const [, champ, texte] = m;
  const r = /^responsables\.(\d+)\.(\w+)$/.exec(champ);
  const libelle = r ? `${LIBELLES_CHAMPS_RESPONSABLE[r[2]] ?? r[2]} du responsable ${(blocs[Number(r[1])] ?? Number(r[1])) + 1}` : LIBELLES_CHAMPS[champ];
  return libelle ? `${libelle} : ${texte}.` : message;
}

function libelleReference(m: MoyenPaiement): string {
  if (MOBILE_MONEY.includes(m)) return "Référence de la transaction";
  if (m === "cheque") return "Numéro du chèque";
  if (m === "virement") return "Référence du virement";
  return "Référence (facultatif)";
}

export default function PageNouvelEtudiant() {
  const search = useSearch();
  const [, naviguer] = useLocation();
  const refs = useReferences();
  const frais = useQuery<ListeFraisClasses>({ queryKey: ["/api/pilotage/frais-classes"] });
  // Préinscrit du site : lu une fois dans l'adresse.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const depart = useMemo(() => new URLSearchParams(search), []);
  const [preinscrit, setPreinscrit] = useState(() => ({
    leadId: depart.get("lead")?.trim() || null,
    campus: depart.get("campus")?.trim() || null,
    filiere: depart.get("filiere")?.trim() || null,
  }));
  const [f, setF] = useState<Formulaire>(() => ({
    ...formulaireVide(),
    ...separerNomPreinscrit(depart.get("nom") ?? ""),
    telephone: depart.get("telephone") ?? "",
    email: depart.get("email") ?? "",
  }));
  const [siteFiltre, setSiteFiltre] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [cree, setCree] = useState<{ r: EtudiantCree; recuBloque: boolean; sexe: Formulaire["sexe"]; classe: string | null } | null>(null);
  const [codeVisible, setCodeVisible] = useState(false);
  const alerteMobile = useRef<HTMLParagraphElement>(null);
  const alerteBureau = useRef<HTMLParagraphElement>(null);
  const campusApplique = useRef(false);

  // Campus du préinscrit : on choisit la classe s'il n'y en a qu'une, sinon on limite la liste à ce campus.
  useEffect(() => {
    if (campusApplique.current || !refs.data || !preinscrit.campus) return;
    campusApplique.current = true;
    const site = siteCorrespondant(refs.data.sites, preinscrit.campus);
    if (!site) return;
    const siennes = refs.data.classes.filter((c) => c.siteId === site.id);
    if (siennes.length === 1) setF((x) => (x.classeId ? x : { ...x, classeId: String(siennes[0].id) }));
    else if (siennes.length > 1) setSiteFiltre(String(site.id));
  }, [refs.data, preinscrit.campus]);

  // L'alerte d'erreur est montrée là où l'on regarde (bas du formulaire sur téléphone, récapitulatif sur ordinateur).
  useEffect(() => {
    if (!erreur) return;
    const cible = [alerteMobile.current, alerteBureau.current].find((x) => x && x.offsetParent !== null);
    cible?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [erreur]);

  const matricule = useQuery<MatriculePropose>({
    queryKey: [`/api/pilotage/etudiants/matricule?classe=${f.classeId}`],
    enabled: Boolean(f.classeId),
    staleTime: 0,
  });

  const maj = <K extends keyof Formulaire>(champ: K) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [champ]: e.target.value }));
  const majResp = (cle: number, champ: keyof Resp, valeur: string | boolean) =>
    setF((x) => ({
      ...x,
      responsables: x.responsables.map((r) => (r.cle === cle ? { ...r, [champ]: valeur } : champ === "principal" && valeur === true ? { ...r, principal: false } : r)),
    }));
  const retirerResp = (cle: number) =>
    setF((x) => {
      const reste = x.responsables.filter((r) => r.cle !== cle);
      // Le contact principal retiré : le premier restant le devient.
      if (reste.length && !reste.some((r) => r.principal)) reste[0] = { ...reste[0], principal: true };
      return { ...x, responsables: reste };
    });
  const basculerPiece = (p: TypePiece) => setF((x) => ({ ...x, pieces: x.pieces.includes(p) ? x.pieces.filter((y) => y !== p) : [...x.pieces, p] }));

  const sites = refs.data?.sites ?? [];
  const classes = refs.data?.classes ?? [];
  const classesParSite = sites
    .filter((s) => !siteFiltre || String(s.id) === siteFiltre)
    .map((s) => ({ site: s, classes: classes.filter((c) => c.siteId === s.id) }))
    .filter((g) => g.classes.length);
  const classeChoisie = classes.find((c) => String(c.id) === f.classeId) ?? null;
  const siteDuFiltre = sites.find((s) => String(s.id) === siteFiltre) ?? null;
  const fraisClasse = frais.data?.classes.find((c) => String(c.classeId) === f.classeId) ?? null;
  const avecFrais = Boolean(fraisClasse?.echeancier.length);
  const montantLu = lireMontant(f.montant);
  const suggestion = f.classeId ? matricule.data?.matricule ?? null : null;
  const requisesRemises = PIECES_REQUISES.filter((p) => f.pieces.includes(p)).length;

  const inscrire = async () => {
    setErreur(null);
    if (!f.prenom.trim() || !f.nom.trim()) return setErreur("Indiquez le prénom et le nom de l'étudiant (section « Identité »).");
    if (!f.classeId) return setErreur("Choisissez la classe de l'étudiant (section « Scolarité »).");
    const incomplet = f.responsables.findIndex((r) => !r.nom.trim() && (r.telephone.trim() || r.email.trim() || r.profession.trim()));
    if (incomplet >= 0) return setErreur(`Indiquez le nom du responsable ${incomplet + 1}, ou retirez ce bloc.`);
    if (f.montant.trim() && !montantLu) return setErreur("Le montant du premier versement est illisible : tapez un nombre, par exemple 50 000.");

    const vide = (s: string) => s.trim() || null;
    const blocs: number[] = [];
    const responsables = f.responsables.flatMap((r, i) => {
      if (!r.nom.trim()) return [];
      blocs.push(i);
      return [{ nom: r.nom.trim(), lien: r.lien, telephone: vide(r.telephone), email: vide(r.email), profession: vide(r.profession), principal: r.principal }];
    });
    const corps: NouvelEtudiant = {
      prenom: f.prenom.trim(),
      nom: f.nom.trim(),
      matricule: vide(f.matricule),
      classeId: Number(f.classeId),
      telephone: vide(f.telephone),
      email: vide(f.email),
      sexe: f.sexe || null,
      dateNaissance: f.dateNaissance || null,
      lieuNaissance: vide(f.lieuNaissance),
      nationalite: vide(f.nationalite),
      adresse: vide(f.adresse),
      whatsapp: vide(f.whatsapp),
      dateInscription: f.dateInscription || null,
      responsables,
      remarques: vide(f.remarques),
      piecesRecues: f.pieces,
      appliquerFrais: f.appliquerFrais,
      premierVersement: montantLu
        ? { montant: montantLu, moyen: f.moyen, reference: f.moyen === "especes" ? null : vide(f.reference), dateVersement: f.dateVersement || null }
        : null,
      leadId: preinscrit.leadId,
    };

    setEnvoi(true);
    try {
      const r = await post<EtudiantCree>("/api/pilotage/etudiants", corps);
      // Le reçu s'ouvre tout de suite (encore dans le geste du clic, sinon le navigateur bloque l'onglet).
      const recu = r.versementId ? window.open(`/pilotage/recus/${r.versementId}`, "_blank") : null;
      toast(`${r.compte.prenom} ${r.compte.nom} est inscrit${f.sexe === "F" ? "e" : ""} : matricule ${r.matricule}`);
      setCree({ r, recuBloque: Boolean(r.versementId) && !recu, sexe: f.sexe, classe: r.compte.classe ?? classeChoisie?.nom ?? null });
      setCodeVisible(true);
      window.scrollTo({ top: 0 });
      void rafraichir("/api/pilotage/etudiants", "/api/pilotage/comptes", "/api/pilotage/tableau", "/api/pilotage/preinscrits", "/api/pilotage/frais-classes");
    } catch (e) {
      setErreur(e instanceof ErreurApi ? messageLisible(e.message, blocs) : "Une erreur est survenue. Réessayez dans un instant.");
    } finally {
      setEnvoi(false);
    }
  };

  const recommencer = () => {
    setF(formulaireVide());
    setPreinscrit({ leadId: null, campus: null, filiere: null });
    setSiteFiltre("");
    setErreur(null);
    setCree(null);
    naviguer("/pilotage/etudiants/nouveau", { replace: true });
    window.scrollTo({ top: 0 });
  };

  const retour = preinscrit.leadId ? { href: "/pilotage/preinscrits", libelle: "Préinscrits du site" } : { href: "/pilotage/etudiants", libelle: "Étudiants" };

  // ── Après l'inscription ──────────────────────────────────────────────────
  if (cree) {
    const { r } = cree;
    return (
      <Page>
        <SousNav />
        <section className="flex flex-col gap-5 rounded-[28px] bg-succes-clair p-5 sm:p-8" aria-live="polite">
          <CircleCheck className="h-10 w-10 text-succes" aria-hidden="true" />
          <div>
            <h1 className="titre-page">
              {r.compte.prenom} {r.compte.nom} est inscrit{cree.sexe === "F" ? "e" : cree.sexe === "M" ? "" : "(e)"}.
            </h1>
            <p className="mt-2 text-base text-texte-doux">
              Matricule <span className="font-mono font-semibold text-encre">{r.matricule}</span>
              {cree.classe ? ` · ${cree.classe}` : ""}
            </p>
          </div>
          {cree.recuBloque && (
            <p className="flex items-start gap-2 rounded-xl bg-white px-4 py-3 text-[15px] text-texte-doux">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" aria-hidden="true" />
              Le navigateur a bloqué l'ouverture du reçu : ouvrez-le avec le bouton ci-dessous.
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <LienBouton href={`/pilotage/etudiants/${r.etudiantId}`} icone={<FolderOpen className="h-4 w-4" />} className="min-h-[48px]">
              Ouvrir son dossier
            </LienBouton>
            {r.versementId && (
              <LienBouton href={`/pilotage/recus/${r.versementId}`} externe variante="contour" icone={<Printer className="h-4 w-4" />} className="min-h-[48px]">
                Imprimer le reçu
              </LienBouton>
            )}
            <Bouton variante="fantome" icone={<UserPlus className="h-4 w-4" />} onClick={recommencer} className="min-h-[48px]">
              Inscrire un autre étudiant
            </Bouton>
          </div>
        </section>
        <FenetreCode
          nouveauCompte
          remis={codeVisible ? r : null}
          personne={{
            id: r.compte.id,
            prenom: r.compte.prenom,
            nom: r.compte.nom,
            role: r.compte.role,
            identifiant: r.compte.matricule ?? r.matricule ?? r.compte.email ?? r.compte.telephone ?? "",
            classe: r.compte.classe,
            site: r.compte.site,
          }}
          onFermer={() => {
            setCodeVisible(false);
            // Reçu bloqué : on reste ici, où le bouton « Imprimer le reçu » l'attend.
            if (!cree.recuBloque) naviguer(`/pilotage/etudiants/${r.etudiantId}`);
          }}
        />
      </Page>
    );
  }

  // ── Formulaire ───────────────────────────────────────────────────────────
  return (
    <Page>
      <SousNav />
      <Link href={retour.href} className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm font-bold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" /> {retour.libelle}
      </Link>
      <EnTetePage
        etiquette="Pilotage · Étudiants"
        titre="Inscrire un étudiant"
        sousTitre="Tout le dossier en une fois. Seuls le nom, le prénom et la classe sont obligatoires : le reste pourra être complété dans son dossier."
      />

      {preinscrit.leadId && (
        <div className="flex items-start gap-3 rounded-2xl border border-orange-peche bg-orange-pale p-4">
          <Globe className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-bold text-encre">Préinscrit du site 2iae.com</p>
            <p className="mt-0.5 text-[15px] text-texte-doux">
              Ses coordonnées viennent de sa préinscription : vérifiez-les avec lui. Une fois inscrit, il apparaît comme « inscrit » dans le suivi du site.
            </p>
          </div>
        </div>
      )}

      <form
        noValidate
        onSubmit={(e) => (e.preventDefault(), void inscrire())}
        // Entrée dans un champ ne doit pas inscrire l'étudiant avant la fin du formulaire.
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && e.preventDefault()}
        className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="flex min-w-0 flex-col gap-5">
          {/* 1. Identité */}
          <Section numero={1} titre="Identité">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ libelle="Prénom(s) *" value={f.prenom} onChange={maj("prenom")} autoComplete="off" autoCapitalize="words" required />
              <Champ libelle="Nom *" value={f.nom} onChange={maj("nom")} autoComplete="off" autoCapitalize="characters" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <span id="libelle-sexe" className="text-sm font-bold text-encre">
                Sexe
              </span>
              <div role="group" aria-labelledby="libelle-sexe" className="grid grid-cols-2 gap-2 sm:max-w-sm">
                {(
                  [
                    ["F", "Féminin"],
                    ["M", "Masculin"],
                  ] as const
                ).map(([v, libelle]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={f.sexe === v}
                    onClick={() => setF((x) => ({ ...x, sexe: x.sexe === v ? "" : v }))}
                    className={cn(
                      "min-h-[48px] rounded-xl border-[1.5px] px-4 text-[15px] font-bold transition-colors",
                      f.sexe === v ? "border-encre bg-encre text-white" : "border-ligne bg-white text-encre hover:border-orange",
                    )}
                  >
                    {libelle}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Champ libelle="Date de naissance" type="date" value={f.dateNaissance} onChange={maj("dateNaissance")} max={aujourdhui()} />
              <Champ libelle="Lieu de naissance" value={f.lieuNaissance} onChange={maj("lieuNaissance")} placeholder="Bouaké" />
              <Champ libelle="Nationalité" value={f.nationalite} onChange={maj("nationalite")} placeholder="Ivoirienne" />
            </div>
          </Section>

          {/* 2. Scolarité */}
          <Section numero={2} titre="Scolarité">
            <div className="flex flex-col gap-2">
              <Selection libelle="Classe *" value={f.classeId} onChange={(e) => setF((x) => ({ ...x, classeId: e.target.value }))} required>
                <option value="">{refs.isLoading ? "Chargement des classes…" : "Choisir la classe…"}</option>
                {classesParSite.map(({ site, classes }) => (
                  <optgroup key={site.id} label={site.nomCourt}>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Selection>
              {siteDuFiltre && (
                <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-texte-gris">
                  <span>Classes du campus {siteDuFiltre.nomCourt}, choisi sur la préinscription.</span>
                  <button type="button" onClick={() => setSiteFiltre("")} className="min-h-[44px] font-bold text-orange-fonce hover:text-encre">
                    Voir toutes les classes
                  </button>
                </p>
              )}
              {(preinscrit.filiere || (preinscrit.campus && !siteDuFiltre && !classeChoisie)) && (
                <p className="rounded-xl bg-creme px-4 py-3 text-sm text-texte-doux">
                  {preinscrit.filiere && (
                    <>
                      Filière souhaitée sur le site : <strong>{preinscrit.filiere}</strong>
                      {preinscrit.campus ? "." : ""}
                    </>
                  )}
                  {preinscrit.filiere && preinscrit.campus && " "}
                  {preinscrit.campus && (
                    <>
                      Campus souhaité : <strong>{preinscrit.campus}</strong>
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ
                libelle="Matricule"
                value={f.matricule}
                onChange={maj("matricule")}
                placeholder={suggestion ?? (f.classeId ? "Calcul du matricule…" : "Proposé après le choix de la classe")}
                aide={
                  suggestion && !f.matricule.trim() ? (
                    <>
                      Laissez vide pour utiliser ce matricule : <span className="font-mono font-semibold text-encre">{suggestion}</span>
                    </>
                  ) : f.matricule.trim() ? (
                    "C'est son identifiant de connexion."
                  ) : (
                    "Choisissez la classe : un matricule vous sera proposé."
                  )
                }
                className="[&_input]:font-mono"
                autoCapitalize="characters"
                autoComplete="off"
              />
              <Champ libelle="Date d'inscription" type="date" value={f.dateInscription} onChange={maj("dateInscription")} />
            </div>
          </Section>

          {/* 3. Contacts */}
          <Section numero={3} titre="Contacts" description="Pour les messages WhatsApp de la vie scolaire et le code de connexion.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ libelle="Téléphone" type="tel" inputMode="tel" value={f.telephone} onChange={maj("telephone")} placeholder="07 07 12 34 56" autoComplete="off" />
              <Champ libelle="WhatsApp, si différent" type="tel" inputMode="tel" value={f.whatsapp} onChange={maj("whatsapp")} placeholder="05 05 12 34 56" autoComplete="off" />
              <Champ
                libelle="E-mail (facultatif)"
                type="email"
                inputMode="email"
                value={f.email}
                onChange={maj("email")}
                placeholder="si l'étudiant en a un"
                aide="Sert à recevoir un lien en cas de code oublié."
                autoComplete="off"
              />
              <Champ libelle="Adresse" value={f.adresse} onChange={maj("adresse")} placeholder="Commune, quartier" aide="Par exemple : Cocody, Riviera 3." />
            </div>
          </Section>

          {/* 4. Parents ou tuteurs */}
          <Section numero={4} titre="Parents ou tuteurs" description="La personne à appeler pour les relances et les paiements. Un bloc sans nom est ignoré.">
            {f.responsables.length === 0 && <p className="text-[15px] text-texte-pale">Aucun responsable pour l'instant.</p>}
            {f.responsables.map((r, i) => (
              <fieldset key={r.cle} className="flex flex-col gap-4 rounded-2xl border border-ligne-douce bg-creme/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <legend className="text-[15px] font-extrabold">Responsable {i + 1}</legend>
                  <button
                    type="button"
                    onClick={() => retirerResp(r.cle)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-texte-pale hover:bg-white hover:text-danger"
                    aria-label={`Retirer le responsable ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" /> Retirer
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Champ libelle="Nom et prénoms *" value={r.nom} onChange={(e) => majResp(r.cle, "nom", e.target.value)} autoComplete="off" />
                  <Selection libelle="Lien" value={r.lien} onChange={(e) => majResp(r.cle, "lien", e.target.value)}>
                    {LIENS_RESPONSABLE.map((l) => (
                      <option key={l} value={l}>
                        {LIBELLES_LIENS_RESPONSABLE[l]}
                      </option>
                    ))}
                  </Selection>
                  <Champ libelle="Téléphone" type="tel" inputMode="tel" value={r.telephone} onChange={(e) => majResp(r.cle, "telephone", e.target.value)} placeholder="07 07 12 34 56" autoComplete="off" />
                  <Champ libelle="E-mail" type="email" inputMode="email" value={r.email} onChange={(e) => majResp(r.cle, "email", e.target.value)} autoComplete="off" />
                  <Champ libelle="Profession" value={r.profession} onChange={(e) => majResp(r.cle, "profession", e.target.value)} autoComplete="off" />
                  <label className="flex min-h-[48px] cursor-pointer items-center gap-3 self-end rounded-xl border border-ligne bg-white px-4 has-[:checked]:border-orange has-[:checked]:bg-orange-pale">
                    <input type="radio" name="responsable-principal" className="h-5 w-5 accent-[#E4793A]" checked={r.principal} onChange={() => majResp(r.cle, "principal", true)} />
                    <span className="text-[15px] font-semibold">Contact principal</span>
                  </label>
                </div>
              </fieldset>
            ))}
            {f.responsables.length < 4 && (
              <Bouton
                variante="contour"
                icone={<Plus className="h-4 w-4" />}
                className="min-h-[48px] self-start"
                onClick={() => setF((x) => ({ ...x, responsables: [...x.responsables, responsableVide(!x.responsables.some((y) => y.principal))] }))}
              >
                Ajouter un responsable
              </Bouton>
            )}
          </Section>

          {/* 5. Pièces */}
          <Section
            numero={5}
            titre="Pièces remises aujourd'hui"
            description="Cochez les pièces reçues au guichet : elles sont notées comme vérifiées. Les autres restent à fournir."
            action={
              <button
                type="button"
                onClick={() => setF((x) => ({ ...x, pieces: requisesRemises === PIECES_REQUISES.length ? x.pieces.filter((p) => !PIECES_REQUISES.includes(p)) : [...new Set([...x.pieces, ...PIECES_REQUISES])] }))}
                className="min-h-[44px] whitespace-nowrap text-sm font-bold text-orange-fonce hover:text-encre"
              >
                {requisesRemises === PIECES_REQUISES.length ? "Tout décocher" : "Tout cocher"}
              </button>
            }
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PIECES_GUICHET.map((p) => (
                <CaseTuile key={p} coche={f.pieces.includes(p)} onChange={() => basculerPiece(p)} libelle={LIBELLES_PIECES[p]} aide={PIECES_REQUISES.includes(p) ? undefined : "Facultative"} />
              ))}
            </div>
          </Section>

          {/* 6. Frais et premier versement */}
          <Section numero={6} titre="Frais et premier versement">
            {!f.classeId ? (
              <p className="rounded-xl bg-creme px-4 py-3 text-[15px] text-texte-pale">Choisissez d'abord la classe : son échéancier s'affichera ici.</p>
            ) : frais.isLoading ? (
              <Squelette className="h-24" />
            ) : fraisClasse && avecFrais ? (
              <div className="overflow-hidden rounded-xl border border-ligne">
                <div className="bg-creme px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-texte-gris">
                  Échéancier {fraisClasse.classe} · {fraisClasse.anneeScolaire}
                </div>
                <ul className="divide-y divide-ligne-douce">
                  {fraisClasse.echeancier.map((l, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[15px]">
                      <span className="min-w-0">
                        <span className="font-semibold">{l.libelle}</span>
                        <span className="block text-[13px] text-texte-gris">{l.date ? `avant le ${jourCourt(l.date)}` : "sans date"}</span>
                      </span>
                      <span className="whitespace-nowrap font-semibold tabular-nums">{fcfa(l.montant)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-3 border-t border-ligne bg-white px-4 py-3 text-[15px]">
                  <span className="font-extrabold">Total</span>
                  <span className="whitespace-nowrap font-extrabold tabular-nums">{fcfa(fraisClasse.total)}</span>
                </div>
              </div>
            ) : null}
            <CaseTuile
              coche={f.appliquerFrais && avecFrais}
              disabled={!avecFrais}
              onChange={() => setF((x) => ({ ...x, appliquerFrais: !x.appliquerFrais }))}
              libelle="Appliquer l'échéancier de la classe"
              aide={
                !f.classeId
                  ? "Selon la classe choisie."
                  : frais.isLoading
                    ? "Lecture des frais de la classe…"
                    : avecFrais
                      ? "Les montants et les dates ci-dessus sont copiés dans son dossier."
                      : "Les frais de cette classe ne sont pas encore saisis (page Scolarité)."
              }
            />

            <div className="flex flex-col gap-4 rounded-2xl border border-ligne-douce p-4">
              <div>
                <h3 className="text-[15px] font-extrabold">Premier versement (facultatif)</h3>
                <p className="text-[13px] text-texte-gris">Encaissé aujourd'hui : un reçu numéroté est créé et s'ouvre pour l'impression.</p>
              </div>
              {fraisClasse && avecFrais && !f.montant.trim() && (
                <button
                  type="button"
                  onClick={() => setF((x) => ({ ...x, montant: new Intl.NumberFormat("fr-FR").format(fraisClasse.echeancier[0].montant) }))}
                  className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-full border border-ligne bg-creme px-4 text-sm font-bold text-encre hover:border-orange"
                >
                  <Plus className="h-4 w-4" /> {fraisClasse.echeancier[0].libelle} : {fcfa(fraisClasse.echeancier[0].montant)}
                </button>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Champ
                  libelle="Montant (F CFA)"
                  inputMode="numeric"
                  value={f.montant}
                  onChange={maj("montant")}
                  placeholder="50 000"
                  autoComplete="off"
                  aide={montantLu ? `Soit ${fcfa(montantLu)}` : f.montant.trim() ? undefined : "Laissez vide si rien n'est payé aujourd'hui."}
                  erreur={f.montant.trim() && !montantLu ? "Montant illisible" : undefined}
                />
                <Selection libelle="Moyen de paiement" value={f.moyen} onChange={(e) => setF((x) => ({ ...x, moyen: e.target.value as MoyenPaiement }))}>
                  {MOYENS_ORDONNES.map((m) => (
                    <option key={m} value={m}>
                      {libelleMoyen(m)}
                    </option>
                  ))}
                </Selection>
                {f.moyen !== "especes" && (
                  <Champ
                    libelle={libelleReference(f.moyen)}
                    value={f.reference}
                    onChange={maj("reference")}
                    placeholder={MOBILE_MONEY.includes(f.moyen) ? "Reçue par SMS" : undefined}
                    className="[&_input]:font-mono"
                    autoComplete="off"
                  />
                )}
                <Champ libelle="Date du versement" type="date" value={f.dateVersement} onChange={maj("dateVersement")} max={aujourdhui()} />
              </div>
            </div>
          </Section>

          {/* 7. Remarques */}
          <Section numero={7} titre="Remarques">
            <ZoneTexte
              aria-label="Remarques"
              value={f.remarques}
              onChange={maj("remarques")}
              rows={3}
              placeholder="Ce qu'il faut savoir sur ce dossier (bourse promise, pièce à rapporter, situation particulière…)"
            />
          </Section>

          {erreur && (
            <p ref={alerteMobile} role="alert" className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger lg:hidden">
              {erreur}
            </p>
          )}

          {/* Barre d'action collée en bas (téléphone et tablette). */}
          <div className="bas-sur sticky bottom-[72px] z-10 -mx-4 flex gap-3 border-t border-ligne-douce bg-white/95 px-4 py-3 backdrop-blur sm:-mx-7 sm:px-7 lg:hidden">
            <Bouton type="submit" taille="lg" pleineLargeur icone={<UserPlus className="h-5 w-5" />} chargement={envoi} className="min-h-[52px]">
              {envoi ? "Inscription…" : "Inscrire l'étudiant"}
            </Bouton>
          </div>
        </div>

        {/* Récapitulatif (ordinateur) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-4 rounded-2xl border border-ligne bg-white p-5 shadow-carte">
            <div>
              <span className="etiquette">Récapitulatif</span>
              <p className="mt-2 text-xl font-extrabold leading-tight">{f.prenom.trim() || f.nom.trim() ? `${f.prenom.trim()} ${f.nom.trim()}`.trim() : "Nouvel étudiant"}</p>
            </div>
            <dl className="flex flex-col gap-2.5 text-sm">
              <Recap terme="Classe" valeur={classeChoisie?.nom ?? <span className="text-danger">à choisir</span>} />
              <Recap
                terme="Matricule"
                valeur={f.matricule.trim() ? <span className="font-mono">{f.matricule.trim().toUpperCase()}</span> : suggestion ? <span className="font-mono">{suggestion}</span> : "–"}
              />
              <Recap terme="Responsables" valeur={String(f.responsables.filter((r) => r.nom.trim()).length)} />
              <Recap terme="Pièces requises" valeur={`${requisesRemises}/${PIECES_REQUISES.length}`} />
              <Recap terme="Échéancier" valeur={avecFrais && f.appliquerFrais && fraisClasse ? fcfa(fraisClasse.total) : "aucun"} />
              <Recap terme="Versement" valeur={montantLu ? `${fcfa(montantLu)} · ${libelleMoyen(f.moyen)}` : "aucun"} />
            </dl>
            {erreur && (
              <p ref={alerteBureau} role="alert" className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">
                {erreur}
              </p>
            )}
            <Bouton type="submit" taille="lg" pleineLargeur icone={<UserPlus className="h-5 w-5" />} chargement={envoi}>
              {envoi ? "Inscription…" : "Inscrire l'étudiant"}
            </Bouton>
            <p className="text-[13px] leading-snug text-texte-gris">
              Le code provisoire de connexion s'affiche ensuite{montantLu ? ", et le reçu s'ouvre dans un nouvel onglet" : ""}.
            </p>
          </div>
        </aside>
      </form>
    </Page>
  );
}

/** Une section du formulaire, numérotée. */
function Section({ numero, titre, description, action, children }: { numero: number; titre: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Carte className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-clair font-mono text-sm font-bold text-orange-profond" aria-hidden="true">
          {numero}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold leading-tight">{titre}</h2>
          {description && <p className="mt-1 text-sm text-texte-pale">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Carte>
  );
}

/** Case à cocher en tuile : toute la tuile est cliquable (au pouce). */
function CaseTuile({ coche, onChange, libelle, aide, disabled }: { coche: boolean; onChange: () => void; libelle: string; aide?: string; disabled?: boolean }) {
  return (
    <label
      className={cn(
        "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
        coche ? "border-orange bg-orange-pale" : "border-ligne bg-white hover:border-orange",
        disabled && "cursor-not-allowed bg-creme hover:border-ligne",
      )}
    >
      <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#E4793A]" checked={coche} disabled={disabled} onChange={onChange} />
      <span className="flex min-w-0 flex-col">
        <span className={cn("text-[15px] font-semibold", disabled ? "text-texte-gris" : "text-encre")}>{libelle}</span>
        {aide && <span className="text-[13px] text-texte-gris">{aide}</span>}
      </span>
    </label>
  );
}

function Recap({ terme, valeur }: { terme: string; valeur: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-texte-pale">{terme}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-encre">{valeur}</dd>
    </div>
  );
}
