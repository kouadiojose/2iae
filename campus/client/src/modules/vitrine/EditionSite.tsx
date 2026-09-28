// Édition des contenus du site public, dans le back-office « Site public »
// (/pilotage/site) : textes de l'accueil, page À propos, questions
// fréquentes, contacts, confidentialité, et chaque campus (adresse, photo,
// salle de conférence, WhatsApp de la vie scolaire, filières, résultat…).
//
// Chaque bloc a son bouton « Enregistrer » et « Voir la page » (nouvel
// onglet). Une modification vide le cache public : elle se voit aussitôt.
// La vie scolaire lit ; seule la direction modifie. Vouvoiement.
import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, ImagePlus, Plus, RotateCcw, Trash2, ExternalLink } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { CaseACocher, Champ, Selection, ZoneTexte } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { alleger, api, put, suppr, type FichierTeleverse } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { dateEtHeure } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  FILIERES_BTS,
  LIBELLES_THEMES,
  SALLES_INVENTEES,
  THEMES_QUESTIONS,
  type CampusPilotage,
  type CleContenu,
  type ContenuAccueil,
  type ContenuAPropos,
  type ContenuCampus,
  type ContenuConfidentialite,
  type ContenuContacts,
  type ContenusPilotage,
  type QuestionFrequente,
  type ThemeQuestion,
} from "@shared/schema";
import { numeroLisible } from "./outils";

const CLE_REQUETE = ["/api/pilotage/site/contenus"];

/** Enregistre, met à jour l'écran et les pages publiques ouvertes dans ce navigateur. */
function useEnvoi() {
  const [envoi, setEnvoi] = useState(false);
  const envoyer = async (action: () => Promise<ContenusPilotage>, message: string) => {
    setEnvoi(true);
    try {
      const r = await action();
      queryClient.setQueryData(CLE_REQUETE, r);
      await rafraichir("/api/public");
      toast(message);
      return true;
    } catch (e) {
      toastErreur(e);
      return false;
    } finally {
      setEnvoi(false);
    }
  };
  return { envoi, envoyer };
}

const egaux = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Lien « Voir la page » : nouvel onglet, le formulaire reste ouvert. */
function VoirPage({ href, libelle = "Voir la page" }: { href: string; libelle?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-orange-fonce no-underline hover:bg-creme hover:text-encre"
    >
      <ExternalLink className="h-4 w-4" /> {libelle}
    </a>
  );
}

/** Cadre d'un bloc éditable : titre, pages concernées, état, boutons. */
function Bloc({
  id,
  titre,
  description,
  pages,
  modification,
  parDefaut,
  modifie,
  peutModifier,
  envoi,
  onEnregistrer,
  onRetablir,
  onAnnuler,
  children,
}: {
  id: string;
  titre: string;
  description: ReactNode;
  pages: { href: string; libelle?: string }[];
  modification?: { le: string; par: string | null } | null;
  parDefaut: boolean;
  modifie: boolean;
  peutModifier: boolean;
  envoi: boolean;
  onEnregistrer: () => void;
  onRetablir: () => void;
  onAnnuler: () => void;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col overflow-hidden rounded-3xl border border-ligne bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ligne-douce px-5 py-4 sm:px-6">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-extrabold">{titre}</h2>
          <p className="max-w-2xl text-[14px] leading-relaxed text-texte-pale">{description}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {pages.map((p) => (
            <VoirPage key={p.href} href={p.href} libelle={p.libelle} />
          ))}
        </div>
      </div>
      <fieldset disabled={!peutModifier || envoi} className="flex min-w-0 flex-col gap-4 px-5 py-5 disabled:opacity-100 sm:px-6">
        {children}
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ligne-douce bg-creme/60 px-5 py-3 sm:px-6">
        <span className="text-[13px] text-texte-pale">
          {modifie ? (
            <span className="font-semibold text-alerte">Modifications non enregistrées</span>
          ) : parDefaut ? (
            "Texte d'origine (faits réels du Groupe 2IAE)"
          ) : modification ? (
            `Modifié ${dateEtHeure(modification.le).replace(/^./, (c) => c.toLowerCase())}${modification.par ? ` par ${modification.par}` : ""}`
          ) : (
            "Modifié"
          )}
        </span>
        {peutModifier && (
          <div className="flex flex-wrap gap-2">
            {modifie && (
              <Bouton variante="fantome" taille="sm" onClick={onAnnuler} disabled={envoi} className="min-h-[44px]">
                Annuler
              </Bouton>
            )}
            {!parDefaut && !modifie && (
              <Bouton variante="fantome" taille="sm" icone={<RotateCcw className="h-4 w-4" />} onClick={onRetablir} disabled={envoi} className="min-h-[44px]">
                Rétablir le texte d'origine
              </Bouton>
            )}
            <Bouton taille="sm" onClick={onEnregistrer} chargement={envoi} disabled={!modifie} className="min-h-[44px] px-5">
              Enregistrer
            </Bouton>
          </div>
        )}
      </div>
    </section>
  );
}

/** Brouillon d'un bloc : repart de la valeur du serveur quand elle change. */
function useBrouillon<T>(valeur: T) {
  const [brouillon, setBrouillon] = useState<T>(valeur);
  const [base, setBase] = useState<T>(valeur);
  if (!egaux(base, valeur)) {
    setBase(valeur);
    setBrouillon(valeur);
  }
  return { brouillon, setBrouillon, modifie: !egaux(brouillon, valeur), annuler: () => setBrouillon(valeur) };
}

/** Bloc de contenu (clé → JSON) : enregistrer, rétablir. */
function useBlocContenu<K extends CleContenu>(etat: ContenusPilotage, cle: K) {
  const valeur = etat.contenus[cle];
  const b = useBrouillon(valeur);
  const { envoi, envoyer } = useEnvoi();
  return {
    ...b,
    envoi,
    parDefaut: !etat.modifications[cle],
    modification: etat.modifications[cle] ?? null,
    enregistrer: () => void envoyer(() => put<ContenusPilotage>(`/api/pilotage/site/contenus/${cle}`, b.brouillon), "Enregistré : la page publique est à jour."),
    retablir: () => {
      if (!window.confirm("Rétablir le texte d'origine ? Vos modifications de ce bloc seront perdues.")) return;
      void envoyer(() => suppr<ContenusPilotage>(`/api/pilotage/site/contenus/${cle}`), "Texte d'origine rétabli.");
    },
  };
}

// ── Accueil ────────────────────────────────────────────────────────────────

function BlocAccueil({ etat }: { etat: ContenusPilotage }) {
  const b = useBlocContenu(etat, "accueil");
  const v = b.brouillon as ContenuAccueil;
  const maj = (p: Partial<ContenuAccueil>) => b.setBrouillon({ ...v, ...p });
  const lignes = v.titre.split("\n").filter((l) => l.trim());
  return (
    <Bloc
      id="bloc-accueil"
      titre="Accueil"
      description="Le grand titre et le texte du haut de l'accueil public."
      pages={[{ href: "/" }]}
      modification={b.modification}
      parDefaut={b.parDefaut}
      modifie={b.modifie}
      peutModifier={etat.peutModifier}
      envoi={b.envoi}
      onEnregistrer={b.enregistrer}
      onRetablir={b.retablir}
      onAnnuler={b.annuler}
    >
      <Champ libelle="Petite ligne au-dessus du titre" value={v.etiquette} maxLength={120} onChange={(e) => maj({ etiquette: e.target.value })} />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ZoneTexte
          libelle="Grand titre"
          aide="Une ligne par retour à la ligne. La dernière ligne s'affiche en orange."
          rows={4}
          maxLength={160}
          value={v.titre}
          onChange={(e) => maj({ titre: e.target.value })}
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Aperçu</span>
          <div className="flex-1 rounded-xl bg-creme px-4 py-3" aria-hidden>
            {lignes.map((l, i) => (
              <span key={i} className={cn("block text-[26px] font-black leading-[.98] tracking-tres-serre", i === lignes.length - 1 && lignes.length > 1 && "text-orange")}>
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
      <ZoneTexte libelle="Texte sous le titre" rows={3} maxLength={400} value={v.sousTitre} onChange={(e) => maj({ sousTitre: e.target.value })} />
    </Bloc>
  );
}

// ── À propos ───────────────────────────────────────────────────────────────

function BlocAPropos({ etat }: { etat: ContenusPilotage }) {
  const b = useBlocContenu(etat, "apropos");
  const v = b.brouillon as ContenuAPropos;
  const maj = (p: Partial<ContenuAPropos>) => b.setBrouillon({ ...v, ...p });
  const majChiffre = (i: number, p: Partial<ContenuAPropos["chiffres"][number]>) => maj({ chiffres: v.chiffres.map((c, j) => (j === i ? { ...c, ...p } : c)) });
  return (
    <Bloc
      id="bloc-apropos"
      titre="À propos"
      description="La page À propos. Les chiffres s'affichent aussi en haut de la page des campus."
      pages={[{ href: "/a-propos" }, { href: "/campus", libelle: "Page des campus" }]}
      modification={b.modification}
      parDefaut={b.parDefaut}
      modifie={b.modifie}
      peutModifier={etat.peutModifier}
      envoi={b.envoi}
      onEnregistrer={b.enregistrer}
      onRetablir={b.retablir}
      onAnnuler={b.annuler}
    >
      <ZoneTexte libelle="Phrase d'ouverture" rows={2} maxLength={400} value={v.chapeau} onChange={(e) => maj({ chapeau: e.target.value })} />
      <ZoneTexte
        libelle="Le Groupe 2IAE"
        aide="Laissez une ligne vide entre deux paragraphes."
        rows={9}
        maxLength={4000}
        value={v.groupe}
        onChange={(e) => maj({ groupe: e.target.value })}
      />
      <ZoneTexte
        libelle="Le campus numérique"
        aide="Laissez une ligne vide entre deux paragraphes."
        rows={7}
        maxLength={4000}
        value={v.campusNumerique}
        onChange={(e) => maj({ campusNumerique: e.target.value })}
      />
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold">Chiffres mis en avant</span>
        <ul className="flex flex-col gap-2">
          {v.chiffres.map((c, i) => (
            <li key={i} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-end gap-2 sm:grid-cols-[110px_minmax(0,1fr)_auto]">
              <Champ aria-label={`Chiffre ${i + 1}`} value={c.valeur} maxLength={20} onChange={(e) => majChiffre(i, { valeur: e.target.value })} placeholder="2006" />
              <Champ aria-label={`Légende du chiffre ${i + 1}`} value={c.libelle} maxLength={120} onChange={(e) => majChiffre(i, { libelle: e.target.value })} placeholder="année de création" />
              <Bouton variante="fantome" taille="icone" aria-label={`Retirer le chiffre ${i + 1}`} onClick={() => maj({ chiffres: v.chiffres.filter((_, j) => j !== i) })} className="min-h-[48px] min-w-[48px]">
                <Trash2 className="h-4 w-4" />
              </Bouton>
            </li>
          ))}
        </ul>
        {v.chiffres.length < 6 && (
          <Bouton variante="doux" taille="sm" icone={<Plus className="h-4 w-4" />} className="min-h-[44px] self-start" onClick={() => maj({ chiffres: [...v.chiffres, { valeur: "", libelle: "" }] })}>
            Ajouter un chiffre
          </Bouton>
        )}
      </div>
    </Bloc>
  );
}

// ── Questions fréquentes ───────────────────────────────────────────────────

function BlocQuestions({ etat }: { etat: ContenusPilotage }) {
  const b = useBlocContenu(etat, "questions");
  const liste = (b.brouillon as { liste: QuestionFrequente[] }).liste;
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());
  const basculer = (id: string) =>
    setOuvertes((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const fixer = (l: QuestionFrequente[]) => b.setBrouillon({ liste: l });
  const maj = (id: string, p: Partial<QuestionFrequente>) => fixer(liste.map((q) => (q.id === id ? { ...q, ...p } : q)));
  const deplacer = (i: number, sens: -1 | 1) => {
    const l = [...liste];
    const [q] = l.splice(i, 1);
    l.splice(i + sens, 0, q);
    fixer(l);
  };
  const dernier = useRef<HTMLInputElement>(null);
  const ajouter = () => {
    const id = `q-${Date.now().toString(36)}`;
    fixer([...liste, { id, theme: "connexion", question: "", reponse: "", visible: true }]);
    setOuvertes((o) => new Set(o).add(id));
    setTimeout(() => dernier.current?.focus(), 50);
  };
  return (
    <Bloc
      id="bloc-questions"
      titre="Questions fréquentes"
      description="Ajoutez, réordonnez ou masquez les questions. Une question masquée reste ici, prête à revenir."
      pages={[{ href: "/questions" }]}
      modification={b.modification}
      parDefaut={b.parDefaut}
      modifie={b.modifie}
      peutModifier={etat.peutModifier}
      envoi={b.envoi}
      onEnregistrer={b.enregistrer}
      onRetablir={b.retablir}
      onAnnuler={b.annuler}
    >
      <ol className="flex flex-col gap-3">
        {liste.map((q, i) => (
          <li key={q.id} className={cn("flex flex-col gap-3 rounded-2xl border p-3 sm:p-4", q.visible ? "border-ligne" : "border-dashed border-ligne bg-creme/50")}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <button
                type="button"
                onClick={() => basculer(q.id)}
                aria-expanded={ouvertes.has(q.id)}
                className="flex min-h-[44px] w-full min-w-0 items-center gap-3 rounded-xl text-left hover:bg-creme/60 sm:flex-1"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-creme font-mono text-xs">{i + 1}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-orange-fonce">
                    {LIBELLES_THEMES[q.theme]}
                    {!q.visible && " · masquée"}
                  </span>
                  <span className={cn("line-clamp-2 font-bold leading-snug sm:line-clamp-1", !q.question && "text-texte-gris")}>{q.question || "Nouvelle question"}</span>
                </span>
                <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-texte-gris transition-transform", ouvertes.has(q.id) && "rotate-180")} aria-hidden />
              </button>
              <div className="flex items-center gap-1 self-end sm:self-auto">
                <Bouton variante="fantome" taille="icone" aria-label="Monter" disabled={i === 0} onClick={() => deplacer(i, -1)} className="min-h-[44px] min-w-[44px]">
                  <ArrowUp className="h-4 w-4" />
                </Bouton>
                <Bouton variante="fantome" taille="icone" aria-label="Descendre" disabled={i === liste.length - 1} onClick={() => deplacer(i, 1)} className="min-h-[44px] min-w-[44px]">
                  <ArrowDown className="h-4 w-4" />
                </Bouton>
                <Bouton
                  variante="fantome"
                  taille="icone"
                  aria-label={q.visible ? "Masquer la question" : "Afficher la question"}
                  onClick={() => maj(q.id, { visible: !q.visible })}
                  className="min-h-[44px] min-w-[44px]"
                >
                  {q.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Bouton>
                {aSupprimer === q.id ? (
                  <Bouton variante="danger" taille="sm" className="min-h-[44px]" onClick={() => (fixer(liste.filter((x) => x.id !== q.id)), setASupprimer(null))}>
                    Confirmer
                  </Bouton>
                ) : (
                  <Bouton variante="fantome" taille="icone" aria-label="Supprimer la question" onClick={() => setASupprimer(q.id)} className="min-h-[44px] min-w-[44px]">
                    <Trash2 className="h-4 w-4" />
                  </Bouton>
                )}
              </div>
            </div>
            {ouvertes.has(q.id) && (
              <div className="flex flex-col gap-3 border-t border-ligne-douce pt-3">
                <Selection libelle="Thème" value={q.theme} onChange={(e) => maj(q.id, { theme: e.target.value as ThemeQuestion })} className="max-w-[240px]">
                  {THEMES_QUESTIONS.map((t) => (
                    <option key={t} value={t}>
                      {LIBELLES_THEMES[t]}
                    </option>
                  ))}
                </Selection>
                <Champ
                  ref={i === liste.length - 1 ? dernier : undefined}
                  libelle="Question"
                  value={q.question}
                  maxLength={200}
                  onChange={(e) => maj(q.id, { question: e.target.value })}
                  placeholder="Comment je me connecte la première fois ?"
                />
                <ZoneTexte libelle="Réponse" rows={4} maxLength={1500} value={q.reponse} onChange={(e) => maj(q.id, { reponse: e.target.value })} />
              </div>
            )}
          </li>
        ))}
      </ol>
      {liste.length < 40 && (
        <Bouton variante="doux" icone={<Plus className="h-4 w-4" />} className="min-h-[48px] self-start" onClick={ajouter}>
          Ajouter une question
        </Bouton>
      )}
    </Bloc>
  );
}

// ── Contacts ───────────────────────────────────────────────────────────────

function BlocContacts({ etat }: { etat: ContenusPilotage }) {
  const b = useBlocContenu(etat, "contacts");
  const v = b.brouillon as ContenuContacts;
  const maj = (p: Partial<ContenuContacts>) => b.setBrouillon({ ...v, ...p });
  return (
    <Bloc
      id="bloc-contacts"
      titre="Contacts"
      description="Repris dans l'en-tête, le pied de page, les pages Contact, Questions et chaque page de campus."
      pages={[{ href: "/contact" }]}
      modification={b.modification}
      parDefaut={b.parDefaut}
      modifie={b.modifie}
      peutModifier={etat.peutModifier}
      envoi={b.envoi}
      onEnregistrer={b.enregistrer}
      onRetablir={b.retablir}
      onAnnuler={b.annuler}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">Téléphones du standard</span>
          {v.telephones.map((t, i) => (
            <div key={i} className="flex gap-2">
              <Champ
                aria-label={`Téléphone ${i + 1}`}
                value={t}
                inputMode="tel"
                maxLength={30}
                className="flex-1"
                onChange={(e) => maj({ telephones: v.telephones.map((x, j) => (j === i ? e.target.value : x)) })}
              />
              <Bouton variante="fantome" taille="icone" aria-label={`Retirer le téléphone ${i + 1}`} onClick={() => maj({ telephones: v.telephones.filter((_, j) => j !== i) })} className="min-h-[48px] min-w-[48px]">
                <Trash2 className="h-4 w-4" />
              </Bouton>
            </div>
          ))}
          {v.telephones.length < 4 && (
            <Bouton variante="doux" taille="sm" icone={<Plus className="h-4 w-4" />} className="min-h-[44px] self-start" onClick={() => maj({ telephones: [...v.telephones, ""] })}>
              Ajouter un numéro
            </Bouton>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Champ libelle="WhatsApp du groupe" value={v.whatsapp} inputMode="tel" maxLength={30} onChange={(e) => maj({ whatsapp: e.target.value })} aide="Utilisé quand un campus n'a pas encore son propre WhatsApp." />
          <Champ libelle="E-mail" type="email" value={v.email} maxLength={120} onChange={(e) => maj({ email: e.target.value })} />
        </div>
        <Champ libelle="Préinscription (adresse web)" value={v.preinscription} maxLength={500} onChange={(e) => maj({ preinscription: e.target.value })} />
        <Champ libelle="Site du groupe" value={v.siteWeb} maxLength={500} onChange={(e) => maj({ siteWeb: e.target.value })} />
        <Champ libelle="Page Facebook" value={v.facebook} maxLength={500} onChange={(e) => maj({ facebook: e.target.value })} />
        <Champ libelle="Bureau au Canada" value={v.bureauCanada} maxLength={200} onChange={(e) => maj({ bureauCanada: e.target.value })} />
        <Champ libelle="Registre du commerce (RC)" value={v.rc} maxLength={80} onChange={(e) => maj({ rc: e.target.value })} />
        <Champ libelle="Numéro d'agrément" value={v.agrement} maxLength={80} onChange={(e) => maj({ agrement: e.target.value })} />
      </div>
    </Bloc>
  );
}

// ── Confidentialité ────────────────────────────────────────────────────────

function BlocConfidentialite({ etat }: { etat: ContenusPilotage }) {
  const b = useBlocContenu(etat, "confidentialite");
  const v = b.brouillon as ContenuConfidentialite;
  const maj = (p: Partial<ContenuConfidentialite>) => b.setBrouillon({ ...v, ...p });
  return (
    <Bloc
      id="bloc-confidentialite"
      titre="Confidentialité"
      description="Le responsable, le contact et les durées de conservation de la page Confidentialité. Pensez à changer la date de mise à jour."
      pages={[{ href: "/confidentialite" }]}
      modification={b.modification}
      parDefaut={b.parDefaut}
      modifie={b.modifie}
      peutModifier={etat.peutModifier}
      envoi={b.envoi}
      onEnregistrer={b.enregistrer}
      onRetablir={b.retablir}
      onAnnuler={b.annuler}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Champ libelle="Responsable" value={v.responsable} maxLength={160} onChange={(e) => maj({ responsable: e.target.value })} />
        <Champ libelle="Contact pour les données" value={v.contact} maxLength={160} onChange={(e) => maj({ contact: e.target.value })} />
        <Champ libelle="Mise à jour le" type="date" value={v.miseAJour} onChange={(e) => maj({ miseAJour: e.target.value })} />
      </div>
      <ZoneTexte
        libelle="Combien de temps les données sont gardées"
        aide="Laissez une ligne vide entre deux paragraphes."
        rows={7}
        maxLength={3000}
        value={v.conservation}
        onChange={(e) => maj({ conservation: e.target.value })}
      />
    </Bloc>
  );
}

/** Petits raccourcis vers chaque bloc de la page. */
function Raccourcis({ liens }: { liens: { id: string; libelle: string; modifie?: boolean }[] }) {
  return (
    <nav aria-label="Aller à un bloc" className="-mx-1 flex flex-wrap gap-1.5">
      {liens.map((l) => (
        <a
          key={l.id}
          href={`#${l.id}`}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-ligne bg-white px-3.5 text-sm font-semibold text-texte-doux no-underline hover:border-orange hover:text-encre"
        >
          {l.libelle}
          {l.modifie && <span className="h-1.5 w-1.5 rounded-full bg-orange" title="Modifié" aria-label="modifié" />}
        </a>
      ))}
    </nav>
  );
}

/** Tous les blocs de textes du site. */
export function EditionContenus({ etat }: { etat: ContenusPilotage }) {
  const m = etat.modifications;
  return (
    <div className="flex flex-col gap-5">
      <Raccourcis
        liens={[
          { id: "bloc-accueil", libelle: "Accueil", modifie: Boolean(m.accueil) },
          { id: "bloc-questions", libelle: "Questions fréquentes", modifie: Boolean(m.questions) },
          { id: "bloc-apropos", libelle: "À propos", modifie: Boolean(m.apropos) },
          { id: "bloc-contacts", libelle: "Contacts", modifie: Boolean(m.contacts) },
          { id: "bloc-confidentialite", libelle: "Confidentialité", modifie: Boolean(m.confidentialite) },
        ]}
      />
      <BlocAccueil etat={etat} />
      <BlocQuestions etat={etat} />
      <BlocAPropos etat={etat} />
      <BlocContacts etat={etat} />
      <BlocConfidentialite etat={etat} />
    </div>
  );
}

// ── Campus ─────────────────────────────────────────────────────────────────

type FormCampus = ContenuCampus & { salleConference: string; whatsappVieScolaire: string; taux: string };

const versForm = (c: CampusPilotage): FormCampus => ({
  ...c.contenu,
  salleConference: c.salleConference,
  whatsappVieScolaire: c.whatsappVieScolaire ? numeroLisible(c.whatsappVieScolaire) : "",
  taux: c.contenu.resultat ? c.contenu.resultat.taux.toFixed(2).replace(".", ",") : "",
});

function EditionCampus({ campus: c, peutModifier }: { campus: CampusPilotage; peutModifier: boolean }) {
  const b = useBrouillon<FormCampus>(versForm(c));
  const v = b.brouillon;
  const maj = (p: Partial<FormCampus>) => b.setBrouillon({ ...v, ...p });
  const { envoi, envoyer } = useEnvoi();
  const [photoEnvoi, setPhotoEnvoi] = useState(false);
  const fichier = useRef<HTMLInputElement>(null);
  const inventee = SALLES_INVENTEES.includes(v.salleConference.trim());
  const parDefaut = !c.majLe;
  const photoParDefaut = c.defaut.photoUrl;

  const enregistrer = () => {
    const taux = v.taux.trim() ? Number(v.taux.replace(",", ".").replace(/\s|%/g, "")) : null;
    if (v.resultat && (taux === null || Number.isNaN(taux))) return toast("Indiquez le taux d'admis (par exemple 58,40), ou décochez « Résultat publié ».", "erreur");
    const { salleConference, whatsappVieScolaire, taux: _t, ...contenu } = v;
    const corps = {
      ...contenu,
      resultat: v.resultat && taux !== null ? { libelle: v.resultat.libelle.trim() || "BTS", taux } : null,
      salleConference,
      whatsappVieScolaire: whatsappVieScolaire.trim() || null,
    };
    void envoyer(() => put<ContenusPilotage>(`/api/pilotage/site/campus/${c.slug}`, corps), `Campus ${c.nomCourt} enregistré : sa page publique est à jour.`);
  };

  const envoyerPhoto = async (f: File | undefined) => {
    if (!f) return;
    setPhotoEnvoi(true);
    try {
      // Allégée sur le téléphone ou l'ordinateur avant l'envoi : environ 100 Ko pour la 3G.
      const leger = await alleger(f, 1200, 0.7);
      const donnees = new FormData();
      donnees.append("usage", "site");
      donnees.append("fichiers", leger, leger.name);
      const [r] = await api<FichierTeleverse[]>("/api/fichiers", { methode: "POST", corps: donnees });
      maj({ photoUrl: r.url });
      toast("Photo prête : enregistrez le campus pour la publier.", "info");
    } catch (e) {
      toastErreur(e);
    } finally {
      setPhotoEnvoi(false);
      if (fichier.current) fichier.current.value = "";
    }
  };

  const basculerFiliere = (code: string) => maj({ filieres: v.filieres.includes(code) ? v.filieres.filter((x) => x !== code) : [...v.filieres, code] });

  return (
    <Bloc
      id={`bloc-campus-${c.slug}`}
      titre={c.nom}
      description="Ce qui s'affiche sur la page du campus, la page des campus, le contact et le pied de page."
      pages={[{ href: `/campus/${c.slug}` }]}
      modification={c.majLe ? { le: c.majLe, par: c.majPar } : null}
      parDefaut={parDefaut}
      modifie={b.modifie}
      peutModifier={peutModifier}
      envoi={envoi || photoEnvoi}
      onEnregistrer={enregistrer}
      onRetablir={() => {
        if (!window.confirm(`Rétablir les informations d'origine du campus ${c.nomCourt} (adresse, photo, filières, résultat) ? La salle et le WhatsApp ne changent pas.`)) return;
        void envoyer(() => suppr<ContenusPilotage>(`/api/pilotage/site/campus/${c.slug}`), "Informations d'origine rétablies.");
      }}
      onAnnuler={b.annuler}
    >
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold">Photo</span>
          {v.photoUrl ? (
            <img src={v.photoUrl} alt={`Photo actuelle du campus ${c.nomCourt}`} className="aspect-[4/3] w-full rounded-2xl bg-creme object-cover" />
          ) : (
            <div className="grid aspect-[4/3] w-full place-items-center rounded-2xl border border-dashed border-ligne bg-creme px-4 text-center text-sm text-texte-pale">
              Pas de photo : la page affiche le nom du campus.
            </div>
          )}
          {peutModifier && (
            <div className="flex flex-wrap gap-2">
              <input ref={fichier} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id={`photo-${c.slug}`} onChange={(e) => void envoyerPhoto(e.target.files?.[0])} />
              <Bouton variante="doux" taille="sm" icone={<ImagePlus className="h-4 w-4" />} chargement={photoEnvoi} onClick={() => fichier.current?.click()} className="min-h-[44px]">
                Changer la photo
              </Bouton>
              {v.photoUrl && (
                <Bouton variante="fantome" taille="sm" onClick={() => maj({ photoUrl: null })} className="min-h-[44px]">
                  Retirer
                </Bouton>
              )}
              {photoParDefaut && v.photoUrl !== photoParDefaut && (
                <Bouton variante="fantome" taille="sm" onClick={() => maj({ photoUrl: photoParDefaut })} className="min-h-[44px]">
                  Photo d'origine
                </Bouton>
              )}
            </div>
          )}
          <p className="text-[13px] text-texte-gris">Une façade ou la salle de conférence, en largeur. La photo est allégée avant l'envoi.</p>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Champ
              libelle="Nom de la salle de conférence"
              value={v.salleConference}
              maxLength={80}
              onChange={(e) => maj({ salleConference: e.target.value })}
              erreur={inventee ? "Ce nom avait été inventé pour la démonstration : le site affiche « Salle de conférence ». Saisissez le vrai nom." : undefined}
              aide="Tant qu'il n'est pas saisi, le site affiche « Salle de conférence »."
            />
            <Champ
              libelle="WhatsApp de la vie scolaire"
              value={v.whatsappVieScolaire}
              inputMode="tel"
              maxLength={30}
              placeholder="07 47 72 67 29"
              onChange={(e) => maj({ whatsappVieScolaire: e.target.value })}
              aide="Vide : le WhatsApp du groupe. Sert aussi au bouton « Besoin d'aide ? » des étudiants."
            />
          </div>
          <ZoneTexte libelle="Adresse" rows={2} maxLength={300} value={v.adresse} onChange={(e) => maj({ adresse: e.target.value })} aide="Telle que publiée sur 2iae.com." />
          <div className="grid gap-4 md:grid-cols-2">
            <Champ libelle="Quartier, commune, ville" value={v.localite} maxLength={120} onChange={(e) => maj({ localite: e.target.value })} />
            <Champ libelle="Téléphone du campus" value={v.telephone} inputMode="tel" maxLength={30} onChange={(e) => maj({ telephone: e.target.value })} aide="Vide : les numéros du standard du groupe." />
          </div>
          <Champ
            libelle="Lien de carte (facultatif)"
            value={v.lienCarte}
            maxLength={500}
            placeholder="https://maps.app.goo.gl/…"
            onChange={(e) => maj({ lienCarte: e.target.value })}
            aide="Collez le lien « Partager » de Google Maps. Vide : l'itinéraire se construit depuis l'adresse."
          />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">Filières présentées</span>
            <div className="flex flex-wrap gap-2">
              {FILIERES_BTS.map((f) => {
                const choisie = v.filieres.includes(f.code);
                return (
                  <button
                    key={f.code}
                    type="button"
                    aria-pressed={choisie}
                    title={f.nom}
                    onClick={() => basculerFiliere(f.code)}
                    className={cn(
                      "min-h-[40px] rounded-full border px-3 font-mono text-xs font-semibold transition-colors disabled:cursor-default",
                      choisie ? "border-orange bg-orange text-encre" : "border-ligne bg-white text-texte-doux hover:border-orange",
                    )}
                  >
                    {f.code}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl bg-creme p-4">
            <CaseACocher
              checked={Boolean(v.resultat)}
              onChange={(ok) => maj({ resultat: ok ? { libelle: v.resultat?.libelle ?? "BTS 2026", taux: v.resultat?.taux ?? 0 } : null })}
              libelle="Résultat publié"
              aide="Le taux d'admis officiel le plus récent. Décochez s'il n'est pas publié."
              disabled={!peutModifier}
            />
            {v.resultat && (
              <div className="grid grid-cols-2 gap-3">
                <Champ libelle="Examen" value={v.resultat.libelle} maxLength={40} onChange={(e) => maj({ resultat: { ...v.resultat!, libelle: e.target.value } })} />
                <Champ libelle="Taux d'admis (%)" value={v.taux} inputMode="decimal" maxLength={8} placeholder="58,40" onChange={(e) => maj({ taux: e.target.value })} />
              </div>
            )}
          </div>
          <ZoneTexte libelle="Présentation (facultatif)" rows={3} maxLength={1500} value={v.presentation} onChange={(e) => maj({ presentation: e.target.value })} />
        </div>
      </div>
    </Bloc>
  );
}

/** Les cinq campus. */
export function EditionCampusListe({ etat }: { etat: ContenusPilotage }) {
  return (
    <div className="flex flex-col gap-5">
      <Raccourcis liens={etat.campus.map((c) => ({ id: `bloc-campus-${c.slug}`, libelle: c.nomCourt, modifie: Boolean(c.majLe) }))} />
      {etat.campus.map((c) => (
        <EditionCampus key={c.slug} campus={c} peutModifier={etat.peutModifier} />
      ))}
    </div>
  );
}

