// Briques de la page « Professeurs » du pilotage (José, 15 octobre 2026 : « depuis la direction, créer des professeurs
// et les attacher à une classe ; un cours peut avoir plusieurs professeurs »). Carte d'un professeur, création en trois
// écrans (qui, ses cours, son lien), feuille « Attacher à un cours » (deux touchers), fiche, et la section
// « Professeurs du cours » de la fenêtre d'un cours. API : server/routes/professeurs.ts ; contrats : shared/professeurs.ts.
import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, CheckCircle2, Copy, Link2, MessageCircle, Plus, Search, TriangleAlert, UserPlus } from "lucide-react";
import { Fenetre } from "@/components/ui/fenetre";
import { Avatar } from "@/components/ui/divers";
import { GrosBouton } from "@/components/ui/gros-blocs";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, put, suppr } from "@/lib/api";
import { dateCourte, relatif } from "@/lib/dates";
import { rafraichir } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { t as tProfs } from "@shared/textes/professeurs";
import type {
  CoursAAttacherDto,
  CoursDuProfesseurDto,
  EtatProfesseur,
  ProfesseurCreeDto,
  ProfesseurDto,
  ProfesseurDuCoursDto,
  ReponseProfesseursCours,
} from "@shared/professeurs";
import type { InvitationRemise } from "@shared/lancement";
import { copier } from "../outils";
import { Qr } from "./Qr";

export const CLE_PROFESSEURS = "/api/pilotage/professeurs";
const CLE_COURS_A_ATTACHER = "/api/pilotage/professeurs/cours";
const nomDe = (p: { prenom: string; nom: string }) => `${p.prenom} ${p.nom}`.trim();
const sansAccents = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Tout ce qui dépend des professeurs et de leurs cours est relu. */
const toutRelire = (coursId?: number) =>
  rafraichir(CLE_PROFESSEURS, "/api/cours", ...(coursId ? [`/api/pilotage/cours/${coursId}/professeurs`] : []));

const ETAT_COURT: Record<EtatProfesseur, string> = { a_inviter: "lien à envoyer", invite: "pas encore connecté", connecte: "connecté", desactive: "désactivé" };

const COULEURS_ETAT: Record<EtatProfesseur, string> = {
  a_inviter: "bg-[#FFF1E6] text-[#A34C17]",
  invite: "bg-[#FDF3E1] text-[#8A5A12]",
  connecte: "bg-[#E7F5EE] text-[#145F3F]",
  desactive: "bg-[#EEEAE6] text-[#5E554F]",
};

export function PastilleEtat({ p }: { p: Pick<ProfesseurDto, "etat" | "inviteLe" | "vuLe"> }) {
  const tx = useTextes(tProfs);
  const texte =
    p.etat === "invite"
      ? tx("etat.invite", { v: { date: p.inviteLe ? dateCourte(p.inviteLe) : "" } })
      : p.etat === "connecte"
        ? p.vuLe
          ? tx("etat.connecte", { v: { quand: relatif(p.vuLe) } })
          : tx("etat.connecte.jamais")
        : tx(p.etat === "a_inviter" ? "etat.a_inviter" : "etat.desactive");
  return <span className={cn("inline-flex rounded-full px-4 py-1.5 text-[16px] font-bold", COULEURS_ETAT[p.etat])}>{texte}</span>;
}

/** Une ligne de cours d'un professeur (couleur, titre, PRINCIPAL, classes). */
function LigneCours({ c, actions }: { c: CoursDuProfesseurDto; actions?: ReactNode }) {
  const tx = useTextes(tProfs);
  return (
    <li className="flex min-h-[56px] flex-wrap items-center gap-3 py-2" data-cours-prof={c.coursId}>
      <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: c.couleur }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[18px] font-bold leading-snug">{c.titre}</span>
          {c.principal && <span className="rounded-md bg-encre px-2 py-0.5 font-mono text-[12px] font-semibold uppercase tracking-wider text-white">{tx("carte.principal")}</span>}
        </span>
        <span className="block text-[15px] text-texte-doux">
          {[c.code, c.sansClasse ? null : c.classesDetail].filter(Boolean).join(" · ")}
          {c.statut === "brouillon" && <span className="ml-2 font-bold text-[#8A5A12]">· {tx("carte.brouillon")}</span>}
          {c.sansClasse && <span className="ml-2 font-bold text-[#8A5A12]">· {tx("carte.sansClasse")}</span>}
        </span>
      </span>
      {actions}
    </li>
  );
}

/** Carte d'un professeur : nom, état, ses cours, « Attacher à un cours », « Envoyer le lien ». */
export function CarteProfesseur({
  p,
  peutAttacher,
  peutInviter,
  onAttacher,
  onInviter,
  onOuvrir,
}: {
  p: ProfesseurDto;
  peutAttacher: boolean;
  peutInviter: boolean;
  onAttacher: () => void;
  onInviter: () => void;
  onOuvrir: () => void;
}) {
  const tx = useTextes(tProfs);
  const adresse = () => {
    const identifiant = p.email ?? p.telephone ?? "";
    const message = tx("adresse.message", { v: { prenom: p.prenom, adresse: `${window.location.origin}/connexion`, identifiant } });
    // Même règle que les invitations : un numéro à 10 chiffres est ivoirien (indicatif 225).
    const chiffres = (p.telephone ?? "").replace(/\D/g, "");
    const numero = chiffres.length === 10 ? `225${chiffres}` : chiffres;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  };
  return (
    <article className="flex flex-col gap-4 rounded-[28px] border-2 border-ligne bg-white p-5 shadow-carte transition-colors hover:border-orange sm:p-6" data-professeur={p.id}>
      <button type="button" onClick={onOuvrir} className="flex items-start gap-4 text-left" aria-label={`${tx("carte.ouvrir")} : ${nomDe(p)}`}>
        <Avatar prenom={p.prenom} nom={p.nom} photo={p.photoUrl} taille={64} />
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[24px] font-black leading-tight sm:text-[26px]">{nomDe(p)}</span>
          {p.titre && <span className="block text-[17px] text-texte-doux">{p.titre}</span>}
          <span className="mt-2 block">
            <PastilleEtat p={p} />
          </span>
        </span>
      </button>
      <div>
        <p className="font-mono text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-profond">{tx("carte.cours")}</p>
        {p.cours.length ? (
          <ul className="mt-1 divide-y divide-ligne-douce">
            {p.cours.map((c) => (
              <LigneCours key={c.coursId} c={c} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-[16px] border-2 border-dashed border-ligne bg-creme px-4 py-3 text-[17px] font-semibold text-texte-doux">{tx("carte.aucunCours")}</p>
        )}
      </div>
      <div className="mt-auto flex flex-wrap gap-3">
        {peutAttacher && p.etat !== "desactive" && (
          <button type="button" onClick={onAttacher} className="inline-flex min-h-[56px] flex-1 basis-[260px] items-center justify-center gap-2 rounded-[18px] bg-orange px-5 text-[18px] font-black text-encre hover:bg-encre hover:text-white" data-action="attacher">
            <Plus className="h-5 w-5" aria-hidden /> {tx("carte.attacher")}
          </button>
        )}
        {p.etat !== "connecte" && p.etat !== "desactive" && peutInviter ? (
          <button type="button" onClick={onInviter} className="inline-flex min-h-[56px] flex-1 basis-[260px] items-center justify-center gap-2 rounded-[18px] border-2 border-encre bg-white px-5 text-[18px] font-bold text-encre hover:bg-orange-pale" data-action="lien">
            <MessageCircle className="h-5 w-5" aria-hidden /> {tx("carte.lien")}
          </button>
        ) : p.etat === "connecte" ? (
          <button type="button" onClick={adresse} className="inline-flex min-h-[56px] flex-1 basis-[260px] items-center text-center justify-center gap-2 rounded-[18px] border-2 border-encre bg-white px-5 text-[18px] font-bold text-encre hover:bg-orange-pale">
            <Link2 className="h-5 w-5" aria-hidden /> {tx("carte.adresse")}
          </button>
        ) : null}
      </div>
    </article>
  );
}

/** Le lien d'invitation, prêt à partir : gros bouton WhatsApp, copier le message ou le lien, QR. */
export function EtapeLien({ invitation, nom }: { invitation: InvitationRemise; nom: string }) {
  const tx = useTextes(tProfs);
  const copierTexte = async (t: string) => toast((await copier(t)) ? tx("nouveau.copie") : tx("nouveau.copie.impossible"), "info");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[19px]">{tx("nouveau.lien.texte")}</p>
      <GrosBouton href={invitation.whatsapp} externe className="sm:w-full" icone={<MessageCircle className="h-6 w-6" aria-hidden />}>
        {tx("nouveau.whatsapp")}
      </GrosBouton>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => void copierTexte(invitation.message)} className="inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[18px] border-2 border-encre bg-white px-4 text-[18px] font-bold">
          <Copy className="h-5 w-5" aria-hidden /> {tx("nouveau.copierMessage")}
        </button>
        <button type="button" onClick={() => void copierTexte(invitation.lien)} className="inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[18px] border-2 border-encre bg-white px-4 text-[18px] font-bold" data-copier-lien>
          <Link2 className="h-5 w-5" aria-hidden /> {tx("nouveau.copierLien")}
        </button>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Qr texte={invitation.lien} className="w-32 rounded-xl border border-ligne bg-white p-2.5" titre={`QR du lien d'invitation de ${nom}`} />
        <span className="text-[15px] text-texte-doux">{tx("nouveau.qr")}</span>
      </div>
      <p className="text-center text-[15px] text-texte-doux">{tx("nouveau.valable", { v: { date: dateCourte(invitation.expireLe) } })}</p>
    </div>
  );
}

/** Les cours qu'on peut attacher, filtrés par niveau de classe (« attacher à une classe ») et par recherche. */
function ListeCours({
  cours,
  dejaIds,
  principalIds,
  mode,
  coches,
  onToucher,
  enCours,
}: {
  cours: CoursAAttacherDto[];
  dejaIds: Set<number>;
  principalIds: Set<number>;
  mode: "attacher" | "cocher";
  coches?: Set<number>;
  onToucher: (c: CoursAAttacherDto) => void;
  enCours?: number | null;
}) {
  const tx = useTextes(tProfs);
  const [filtre, setFiltre] = useState<string>("tous");
  const [q, setQ] = useState("");
  const niveaux = useMemo(() => [...new Set(cours.flatMap((c) => c.niveaux))].sort((a, b) => a.localeCompare(b, "fr")), [cours]);
  const visibles = cours.filter((c) => {
    if (filtre === "sans" && !c.sansClasse) return false;
    if (filtre !== "tous" && filtre !== "sans" && !c.niveaux.includes(filtre)) return false;
    const n = sansAccents(q);
    return !n || sansAccents(`${c.code} ${c.titre}`).includes(n);
  });
  const pastille = (valeur: string, libelle: string) => (
    <button
      key={valeur}
      type="button"
      onClick={() => setFiltre(valeur)}
      className={cn("min-h-[48px] rounded-full border-2 px-4 text-[16px] font-bold", filtre === valeur ? "border-encre bg-encre text-white" : "border-ligne bg-white text-encre hover:border-orange")}
      aria-pressed={filtre === valeur}
    >
      {libelle}
    </button>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {pastille("tous", tx("attacher.tous"))}
        {niveaux.map((n) => pastille(n, n))}
        {cours.some((c) => c.sansClasse) && pastille("sans", tx("attacher.sansClasse"))}
      </div>
      {cours.length > 12 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tx("attacher.chercher")}
            aria-label={tx("attacher.chercher")}
            className="min-h-[56px] w-full rounded-[16px] border-2 border-ligne bg-white pl-12 pr-4 text-[18px] outline-none focus:border-orange"
          />
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {!visibles.length && <li className="text-[17px] text-texte-doux">{tx("attacher.aucun")}</li>}
        {visibles.map((c) => {
          const deja = dejaIds.has(c.id);
          const coche = coches?.has(c.id) ?? false;
          const autres = c.professeurs.map((p) => p.nom).filter(Boolean);
          return (
            <li key={c.id} className="relative flex min-h-[72px] items-center gap-3 overflow-hidden rounded-[18px] border-2 border-ligne bg-white py-2 pl-5 pr-3" data-cours-attacher={c.code}>
              <span className="absolute inset-y-0 left-0 w-2" style={{ background: c.couleur }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[14px] text-texte-doux">{c.code}</span>
                <span className="block text-[19px] font-bold leading-snug">{c.titre}</span>
                <span className="block text-[15px] text-texte-doux">
                  {c.sansClasse ? tx("attacher.sansClasse.ligne") : c.classes}
                  {c.statut === "brouillon" ? ` · ${tx("carte.brouillon")}` : ""}
                  {autres.length ? ` · ${tx("attacher.avec", { v: { noms: autres.join(", ") } })}` : ""}
                </span>
              </span>
              {mode === "attacher" ? (
                deja ? (
                  <span className="flex items-center gap-1 px-2 text-[17px] font-bold text-[#145F3F]">
                    <Check className="h-5 w-5" aria-hidden /> {principalIds.has(c.id) ? tx("attacher.faitPrincipal") : tx("attacher.fait")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToucher(c)}
                    disabled={enCours === c.id}
                    className="min-h-[48px] shrink-0 rounded-[14px] bg-orange px-5 text-[17px] font-black text-encre hover:bg-encre hover:text-white disabled:opacity-60"
                    data-attacher={c.code}
                  >
                    {tx("attacher.bouton")}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={coche}
                  aria-label={c.titre}
                  onClick={() => onToucher(c)}
                  className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border-2", coche ? "border-[#16774C] bg-[#16774C] text-white" : "border-encre bg-white")}
                  data-cocher={c.code}
                >
                  {coche && <Check className="h-6 w-6" aria-hidden />}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Feuille « Attacher {nom} à un cours » : toucher « Attacher » sur le cours (deux touchers en tout). */
export function FeuilleAttacher({ p, onFermer }: { p: ProfesseurDto | null; onFermer: () => void }) {
  const tx = useTextes(tProfs);
  const { data: cours } = useQuery<CoursAAttacherDto[]>({ queryKey: [CLE_COURS_A_ATTACHER], enabled: Boolean(p) });
  const [faits, setFaits] = useState<Map<number, boolean>>(new Map());
  const [enCours, setEnCours] = useState<number | null>(null);
  if (!p) return null;
  const deja = new Set([...p.cours.map((c) => c.coursId), ...faits.keys()]);
  const principaux = new Set([...p.cours.filter((c) => c.principal).map((c) => c.coursId), ...[...faits].filter(([, pr]) => pr).map(([id]) => id)]);
  const attacher = async (c: CoursAAttacherDto) => {
    setEnCours(c.id);
    try {
      const r = await post<ReponseProfesseursCours>(`/api/pilotage/cours/${c.id}/professeurs`, { formateurId: p.id });
      setFaits(new Map([...faits, [c.id, Boolean(r.principal)]]));
      toast(r.principal ? tx("attacher.toast.principal", { v: { nom: nomDe(p), titre: c.titre } }) : tx("attacher.toast", { v: { nom: nomDe(p), titre: c.titre } }));
      await rafraichir(CLE_COURS_A_ATTACHER);
      await toutRelire(c.id);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnCours(null);
    }
  };
  return (
    <Fenetre ouverte large onFermer={onFermer} titre={tx("attacher.titre", { v: { nom: nomDe(p) } })} description={tx("attacher.texte")}>
      <div className="flex flex-col gap-4 pb-4">
        {cours ? <ListeCours cours={cours} dejaIds={deja} principalIds={principaux} mode="attacher" onToucher={(c) => void attacher(c)} enCours={enCours} /> : <p className="text-[18px]">…</p>}
        <a href="/pilotage/cours" className="text-[16px] font-bold text-orange-profond underline underline-offset-4">
          {tx("attacher.creerCours")}
        </a>
      </div>
    </Fenetre>
  );
}

/** « Nouveau professeur » en trois écrans : qui (doublon signalé), ses cours (cochés), son lien. */
export function FenetreNouveauProfesseur({
  ouverte,
  onFermer,
  existants,
  peutAttacher,
  coursPreCoche,
  onOuvrirFiche,
}: {
  ouverte: boolean;
  onFermer: () => void;
  existants: ProfesseurDto[];
  peutAttacher: boolean;
  coursPreCoche?: number | null;
  onOuvrirFiche?: (id: number) => void;
}) {
  const tx = useTextes(tProfs);
  const [etape, setEtape] = useState(1);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [malgre, setMalgre] = useState(false);
  const [coches, setCoches] = useState<Set<number>>(new Set(coursPreCoche ? [coursPreCoche] : []));
  const [envoi, setEnvoi] = useState(false);
  const [cree, setCree] = useState<ProfesseurCreeDto | null>(null);
  const { data: cours } = useQuery<CoursAAttacherDto[]>({ queryKey: [CLE_COURS_A_ATTACHER], enabled: ouverte && peutAttacher });
  const fermer = () => {
    setEtape(1);
    setPrenom("");
    setNom("");
    setTelephone("");
    setEmail("");
    setMalgre(false);
    setCoches(new Set(coursPreCoche ? [coursPreCoche] : []));
    setCree(null);
    onFermer();
  };
  const doublon = existants.find((p) => sansAccents(nomDe(p)) === sansAccents(`${prenom} ${nom}`));
  const creer = async () => {
    setEnvoi(true);
    try {
      const r = await post<ProfesseurCreeDto>(CLE_PROFESSEURS, { prenom, nom, telephone: telephone || undefined, email: email || undefined, coursIds: [...coches] });
      setCree(r);
      setEtape(3);
      await toutRelire();
      await rafraichir(CLE_COURS_A_ATTACHER);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const champ = "min-h-[56px] w-full rounded-[16px] border-2 border-ligne bg-white px-4 text-[18px] outline-none focus:border-orange focus:ring-4 focus:ring-orange/20";
  const etapes = peutAttacher ? 3 : 2;
  const numero = !peutAttacher && etape === 3 ? 2 : etape;
  return (
    <Fenetre ouverte={ouverte} large onFermer={fermer} titre={tx("nouveau.titre")} description={tx("nouveau.etape", { v: { n: numero, total: etapes } })}>
      <div className="flex flex-col gap-5 pb-5" data-nouveau-etape={etape}>
        <div className="flex gap-2" aria-hidden>
          {Array.from({ length: etapes }, (_, i) => (
            <span key={i} className={cn("h-2 flex-1 rounded-full", i < numero ? "bg-orange" : "bg-ligne")} />
          ))}
        </div>
        {etape === 1 && (
          <>
            <h3 className="text-[24px] font-black">{tx("nouveau.qui")}</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[17px] font-bold">
                {tx("nouveau.prenom")}
                <input className={champ} value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="off" data-champ="prenom" />
              </label>
              <label className="flex flex-col gap-1.5 text-[17px] font-bold">
                {tx("nouveau.nom")}
                <input className={champ} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" data-champ="nom" />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-[17px] font-bold">
              {tx("nouveau.telephone")}
              <input className={champ} type="tel" inputMode="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} data-champ="telephone" />
              <span className="text-[15px] font-normal text-texte-doux">{tx("nouveau.telephone.aide")}</span>
            </label>
            <label className="flex flex-col gap-1.5 text-[17px] font-bold">
              {tx("nouveau.email")}
              <input className={champ} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} data-champ="email" />
              <span className="text-[15px] font-normal text-texte-doux">{tx("nouveau.email.aide")}</span>
            </label>
            {doublon && !malgre && (
              <div className="flex flex-col gap-3 rounded-[18px] bg-[#FDF3E1] p-4" role="alert">
                <p className="flex items-start gap-2 text-[17px] font-bold text-[#7A4B0C]">
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  {tx("nouveau.doublon", { v: { nom: nomDe(doublon), etat: ETAT_COURT[doublon.etat] } })}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {onOuvrirFiche && (
                    <button type="button" onClick={() => onOuvrirFiche(doublon.id)} className="min-h-[48px] rounded-[14px] border-2 border-encre bg-white px-4 text-[16px] font-bold">
                      {tx("nouveau.doublon.ouvrir")}
                    </button>
                  )}
                  <button type="button" onClick={() => setMalgre(true)} className="min-h-[48px] rounded-[14px] px-4 text-[16px] font-bold underline">
                    {tx("nouveau.doublon.creer")}
                  </button>
                </div>
              </div>
            )}
            <GrosBouton
              onClick={() => (peutAttacher ? setEtape(2) : void creer())}
              disabled={!prenom.trim() || !nom.trim() || (Boolean(doublon) && !malgre)}
              chargement={envoi}
              className="sm:self-start"
            >
              {peutAttacher ? tx("nouveau.suivant") : tx("nouveau.creer")}
            </GrosBouton>
          </>
        )}
        {etape === 2 && (
          <>
            <h3 className="text-[24px] font-black">{tx("nouveau.cours.titre")}</h3>
            <p className="text-[18px] text-texte-doux">{tx("nouveau.cours.texte")}</p>
            {cours ? (
              <ListeCours
                cours={cours}
                dejaIds={new Set()}
                principalIds={new Set()}
                mode="cocher"
                coches={coches}
                onToucher={(c) => {
                  const n = new Set(coches);
                  if (n.has(c.id)) n.delete(c.id);
                  else n.add(c.id);
                  setCoches(n);
                }}
              />
            ) : (
              <p>…</p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <GrosBouton onClick={() => void creer()} chargement={envoi} icone={<UserPlus className="h-6 w-6" aria-hidden />}>
                {coches.size ? tx("nouveau.creer.n", { v: { n: coches.size } }) : tx("nouveau.creer")}
              </GrosBouton>
              <button type="button" onClick={() => setEtape(1)} className="min-h-[48px] px-3 text-[17px] font-bold underline underline-offset-4">
                {tx("nouveau.retour")}
              </button>
            </div>
          </>
        )}
        {etape === 3 && cree && (
          <>
            <div className="flex items-start gap-3 rounded-[18px] bg-creme p-4" data-professeur-cree={cree.professeur.id}>
              <CheckCircle2 className="h-7 w-7 shrink-0 text-[#16774C]" aria-hidden />
              <div>
                <p className="text-[20px] font-black">{tx("nouveau.cree", { v: { nom: nomDe(cree.professeur) } })}</p>
                {cree.professeur.cours.length > 0 && <p className="text-[17px]">{tx("nouveau.cree.cours", { v: { liste: cree.professeur.cours.map((c) => c.titre).join(", ") } })}</p>}
              </div>
            </div>
            <h3 className="text-[24px] font-black">{tx("nouveau.lien.titre")}</h3>
            {cree.invitation ? <EtapeLien invitation={cree.invitation} nom={nomDe(cree.professeur)} /> : <p className="text-[18px] font-bold text-[#8A5A12]">{tx("nouveau.sansLien")}</p>}
            <GrosBouton ton="contour" onClick={fermer} className="sm:self-start">
              {tx("nouveau.fini")}
            </GrosBouton>
          </>
        )}
      </div>
    </Fenetre>
  );
}

/** Fiche d'un professeur : coordonnées, ses cours (mettre en principal, retirer, changer les classes). */
export function FenetreProfesseur({
  p,
  peutAttacher,
  peutInviter,
  onFermer,
  onAttacher,
  onInviter,
  onClasses,
}: {
  p: ProfesseurDto | null;
  peutAttacher: boolean;
  peutInviter: boolean;
  onFermer: () => void;
  onAttacher: () => void;
  onInviter: () => void;
  onClasses: (coursId: number) => void;
}) {
  const tx = useTextes(tProfs);
  const [aRetirer, setARetirer] = useState<CoursDuProfesseurDto | null>(null);
  const [envoi, setEnvoi] = useState(false);
  if (!p) return null;
  const principal = async (c: CoursDuProfesseurDto) => {
    try {
      await put<ReponseProfesseursCours>(`/api/pilotage/cours/${c.coursId}/professeurs/principal`, { formateurId: p.id });
      toast(tx("principal.toast", { v: { nom: nomDe(p) } }));
      await toutRelire(c.coursId);
    } catch (e) {
      toastErreur(e);
    }
  };
  const retirer = async (c: CoursDuProfesseurDto) => {
    setEnvoi(true);
    try {
      const r = await suppr<ReponseProfesseursCours>(`/api/pilotage/cours/${c.coursId}/professeurs/${p.id}`);
      toast(tx("retirer.toast", { v: { nom: nomDe(p), titre: c.titre } }));
      if (r.avertissement) toast(r.avertissement, "info");
      setARetirer(null);
      await toutRelire(c.coursId);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Fenetre ouverte large onFermer={onFermer} titre={nomDe(p)} description={p.titre ?? undefined}>
      <div className="flex flex-col gap-5 pb-5" data-fiche-professeur={p.id}>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar prenom={p.prenom} nom={p.nom} photo={p.photoUrl} taille={72} />
          <div className="flex min-w-0 flex-col gap-1">
            <PastilleEtat p={p} />
            <p className="text-[18px] text-texte-doux">{[p.telephone, p.email].filter(Boolean).join(" · ") || tx("fiche.coordonnees.sansIdentifiant")}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {peutAttacher && p.etat !== "desactive" && (
            <GrosBouton onClick={onAttacher} icone={<Plus className="h-6 w-6" aria-hidden />}>
              {tx("carte.attacher")}
            </GrosBouton>
          )}
          {peutInviter && p.etat !== "connecte" && p.etat !== "desactive" && (
            <GrosBouton ton="contour" onClick={onInviter} icone={<MessageCircle className="h-6 w-6" aria-hidden />}>
              {tx("carte.lien")}
            </GrosBouton>
          )}
        </div>
        <div>
          <p className="font-mono text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-profond">{tx("carte.cours")}</p>
          {!p.cours.length && <p className="mt-2 text-[17px] text-texte-doux">{tx("carte.aucunCours")}</p>}
          <ul className="mt-1 divide-y divide-ligne-douce">
            {p.cours.map((c) => (
              <div key={c.coursId}>
                <LigneCours
                  c={c}
                  actions={
                    c.gerable ? (
                      <span className="flex flex-wrap gap-1">
                        <button type="button" onClick={() => onClasses(c.coursId)} className="min-h-[48px] rounded-[12px] px-3 text-[16px] font-bold text-encre underline underline-offset-4">
                          {tx("fiche.classes")}
                        </button>
                        {!c.principal && (
                          <button type="button" onClick={() => void principal(c)} className="min-h-[48px] rounded-[12px] px-3 text-[16px] font-bold text-encre underline underline-offset-4" data-principal={c.code}>
                            {tx("fiche.principal")}
                          </button>
                        )}
                        <button type="button" onClick={() => setARetirer(c)} className="min-h-[48px] rounded-[12px] px-3 text-[16px] font-bold text-[#B42318]" data-retirer={c.code}>
                          {tx("fiche.retirer")}
                        </button>
                      </span>
                    ) : (
                      <span className="text-[15px] text-texte-doux">{tx("fiche.partage")}</span>
                    )
                  }
                />
                {aRetirer?.coursId === c.coursId && (
                  <div className="mb-3 flex flex-col gap-3 rounded-[18px] bg-danger-clair p-4" role="alertdialog" aria-label={tx("retirer.titre", { v: { nom: nomDe(p), titre: c.titre } })}>
                    <p className="text-[18px] font-black text-[#7A2E0E]">{tx("retirer.titre", { v: { nom: nomDe(p), titre: c.titre } })}</p>
                    <p className="text-[16px] text-[#7A2E0E]">{tx("retirer.texte")}</p>
                    {c.programme && <p className="rounded-[12px] bg-[#FDF3E1] p-3 text-[16px] font-bold text-[#7A4B0C]">{tx("retirer.programme", { v: { nom: nomDe(p), quand: c.programme } })}</p>}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" onClick={() => void retirer(c)} disabled={envoi} className="min-h-[52px] rounded-[14px] bg-[#B42318] px-5 text-[17px] font-black text-white" data-confirmer-retrait>
                        {tx("retirer.oui")}
                      </button>
                      <button type="button" onClick={() => setARetirer(null)} className="min-h-[52px] rounded-[14px] border-2 border-encre bg-white px-5 text-[17px] font-bold">
                        {tx("retirer.non")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </ul>
        </div>
      </div>
    </Fenetre>
  );
}

/** « Professeurs du cours » dans la fenêtre d'un cours (Pilotage · Cours) : liste, principal, retirer, ajouter. */
export function ProfesseursDuCours({ coursId, titreCours }: { coursId: number; titreCours: string }) {
  const tx = useTextes(tProfs);
  const cle = `/api/pilotage/cours/${coursId}/professeurs`;
  const { data } = useQuery<ProfesseurDuCoursDto[]>({ queryKey: [cle] });
  const tous = useQuery<{ professeurs: ProfesseurDto[] }>({ queryKey: [CLE_PROFESSEURS] });
  const [ajout, setAjout] = useState(false);
  const [q, setQ] = useState("");
  const liste = data ?? [];
  const ids = new Set(liste.map((p) => p.id));
  const ajouter = async (id: number) => {
    try {
      await post(cle, { formateurId: id });
      await toutRelire(coursId);
    } catch (e) {
      toastErreur(e);
    }
  };
  const principal = async (id: number) => {
    try {
      await put(`${cle}/principal`, { formateurId: id });
      await toutRelire(coursId);
    } catch (e) {
      toastErreur(e);
    }
  };
  const retirer = async (p: ProfesseurDuCoursDto) => {
    try {
      const r = await suppr<ReponseProfesseursCours>(`${cle}/${p.id}`);
      toast(tx("retirer.toast", { v: { nom: nomDe(p), titre: titreCours } }));
      if (r.avertissement) toast(r.avertissement, "info");
      await toutRelire(coursId);
    } catch (e) {
      toastErreur(e);
    }
  };
  const candidats = (tous.data?.professeurs ?? []).filter((p) => p.etat !== "desactive" && !ids.has(p.id) && (!q.trim() || sansAccents(nomDe(p)).includes(sansAccents(q))));
  return (
    <section className="flex flex-col gap-2" data-professeurs-du-cours={coursId}>
      <h3 className="text-[18px] font-extrabold">{tx("cours.professeurs")}</h3>
      {!liste.length && <p className="text-[16px] text-texte-doux">{tx("cours.aucun")}</p>}
      <ul className="flex flex-col divide-y divide-ligne-douce">
        {liste.map((p) => (
          <li key={p.id} className="flex min-h-[64px] flex-wrap items-center gap-3 py-2">
            <Avatar prenom={p.prenom} nom={p.nom} photo={p.photoUrl} taille={40} />
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold">{nomDe(p)}</span>
              <span className="font-mono text-[12px] font-semibold uppercase tracking-wider text-orange-profond">{p.principal ? tx("carte.principal") : tx("carte.professeur")}</span>
            </span>
            {!p.principal && (
              <button type="button" onClick={() => void principal(p.id)} className="min-h-[44px] rounded-[12px] border-2 border-encre px-3 text-[15px] font-bold">
                {tx("carte.principal")}
              </button>
            )}
            <button type="button" onClick={() => void retirer(p)} className="min-h-[44px] px-2 text-[15px] font-bold text-[#B42318]">
              {tx("fiche.retirer")}
            </button>
          </li>
        ))}
      </ul>
      {ajout ? (
        <div className="flex flex-col gap-2 rounded-[16px] border-2 border-ligne p-3">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tx("cours.ajouter.chercher")}
            aria-label={tx("cours.ajouter.chercher")}
            className="min-h-[52px] w-full rounded-[14px] border-2 border-ligne px-4 text-[17px] outline-none focus:border-orange"
          />
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {candidats.map((p) => (
              <li key={p.id} className="flex min-h-[56px] items-center gap-3">
                <Avatar prenom={p.prenom} nom={p.nom} photo={p.photoUrl} taille={36} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold">{nomDe(p)}</span>
                  <span className="block truncate text-[14px] text-texte-doux">{p.cours.map((c) => c.code).join(" · ")}</span>
                </span>
                <button type="button" onClick={() => void ajouter(p.id)} className="min-h-[44px] rounded-[12px] bg-orange px-4 text-[15px] font-black text-encre">
                  {tx("cours.ajouter.bouton")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <button type="button" onClick={() => setAjout(true)} className="inline-flex min-h-[52px] items-center gap-2 self-start rounded-[14px] border-2 border-orange px-4 text-[16px] font-bold text-encre">
          <Plus className="h-5 w-5" aria-hidden /> {tx("cours.ajouter")}
        </button>
      )}
    </section>
  );
}
