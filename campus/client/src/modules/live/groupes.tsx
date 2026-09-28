// Groupes de travail du live (les « salles séparées » de Zoom et de Meet) :
//  - le formateur compose les groupes (au hasard, par campus, à la main, ou au
//    choix des étudiants), donne une consigne et un minuteur, suit les groupes,
//    les visite (sa voix est coupée dans la classe pendant la visite), écrit à
//    tous et rappelle la classe (compte à rebours de 60 s) ;
//  - l'étudiant retrouve son groupe : visio du groupe, discussion, consigne,
//    « Appeler le formateur » ; il suit l'écran de sa salle s'il y est émargé ;
//  - l'écran d'une salle montre la visio de son groupe en grand.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BellRing, Clock, DoorOpen, Megaphone, MessageSquareText, Plus, RefreshCw, Send, Shuffle, Trash2, UserRoundCheck, UsersRound, Video, School, Hand } from "lucide-react";
import { post, put } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useCanal, useFluxConnecte } from "@/lib/flux";
import { cn } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import { Fenetre } from "@/components/ui/fenetre";
import { ZoneTexte, Selection, CaseACocher } from "@/components/ui/champs";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { toast, toastErreur } from "@/components/ui/toast";
import { CadreDaily } from "@/modules/visio";
import { PanneauDiscussion } from "./discussion";
import type { AccesDaily, GroupesDto, GroupeTravailDto, ModeSuivi, ParticipantGroupeDto, RoleSeance, SeanceDetailDto } from "@shared/schema";

export const cleGroupes = (seanceId: number) => [`/api/seances/${seanceId}/groupes`];
type SessionGroupes = NonNullable<GroupesDto["session"]>;

/**
 * État des groupes : un appel, puis relu à chaque événement « groupes » du canal de la
 * séance (ouverture, déplacement, minuteur, fermeture). L'annonce du formateur arrive entière.
 */
export function useGroupes(seanceId: number, surEvenement?: (type: string, data: any) => void) {
  const cle = cleGroupes(seanceId);
  const requete = useQuery<GroupesDto>({ queryKey: cle, staleTime: 5_000, refetchInterval: (q) => (q.state.data?.session ? 20_000 : 60_000) });
  const relire = useRef<ReturnType<typeof setTimeout> | null>(null);
  useCanal(`seance:${seanceId}`, (e) => {
    if (e.type === "groupes") {
      if (!relire.current) {
        relire.current = setTimeout(() => {
          relire.current = null;
          void queryClient.invalidateQueries({ queryKey: cle });
        }, 250);
      }
      surEvenement?.(e.type, e.data);
    } else if (e.type === "groupes:annonce") {
      queryClient.setQueryData<GroupesDto>(cle, (g) => (g?.session ? { ...g, session: { ...g.session, annonce: e.data.texte, annonceLe: e.data.le } } : g));
      surEvenement?.(e.type, e.data);
    } else if (e.type === "statut") void queryClient.invalidateQueries({ queryKey: cle });
  });
  const connecte = useFluxConnecte();
  const etaitConnecte = useRef(connecte);
  useEffect(() => {
    if (connecte && !etaitConnecte.current) void queryClient.invalidateQueries({ queryKey: cle });
    etaitConnecte.current = connecte;
  }, [connecte]);
  useEffect(
    () => () => {
      if (relire.current) clearTimeout(relire.current);
    },
    [],
  );
  return requete;
}

/** Le groupe de la personne, si des groupes sont ouverts. */
export const monGroupe = (g: GroupesDto | undefined) => (g?.session && g.monGroupeId ? (g.groupes.find((x) => x.id === g.monGroupeId) ?? null) : null);

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** « 12:05 restantes », « Retour en classe dans 42 s » ou « Sans limite de temps ». */
export function MinuteurGroupes({ session, className }: { session: SessionGroupes; className?: string }) {
  const maintenant = useMaintenant(1000);
  if (session.fermetureLe) {
    const s = Math.max(0, Math.ceil((new Date(session.fermetureLe).getTime() - maintenant) / 1000));
    return <span className={cn("font-bold text-orange", className)}>Retour en classe dans {s} s</span>;
  }
  if (session.finPrevueLe) return <span className={className}>{mmss(new Date(session.finPrevueLe).getTime() - maintenant)} restantes</span>;
  return <span className={className}>Sans limite de temps</span>;
}

async function agirGroupes(seanceId: number, chemin: string, corps?: unknown, message?: string): Promise<boolean> {
  try {
    const r = await post<GroupesDto | { ok: true }>(`/api/seances/${seanceId}/groupes${chemin ? `/${chemin}` : ""}`, corps);
    if (r && "groupes" in r) queryClient.setQueryData(cleGroupes(seanceId), r);
    else void queryClient.invalidateQueries({ queryKey: cleGroupes(seanceId) });
    if (message) toast(message);
    return true;
  } catch (e) {
    toastErreur(e);
    return false;
  }
}

const accesVisio = (seanceId: number, groupeId: number) => () => post<AccesDaily>(`/api/seances/${seanceId}/groupes/${groupeId}/visio`);

// ── Composer les groupes (formateur) ───────────────────────────────────────

type Repartition = "hasard" | "campus" | "main" | "choix";
type Brouillon = { nom: string; membres: number[] }[];

const REPARTITIONS: { r: Repartition; titre: string; detail: string; icone: ReactNode }[] = [
  { r: "hasard", titre: "Au hasard", detail: "Les étudiants en ligne sont mélangés.", icone: <Shuffle className="h-5 w-5" /> },
  { r: "campus", titre: "Par campus", detail: "Chaque salle avec les étudiants de son campus.", icone: <School className="h-5 w-5" /> },
  { r: "main", titre: "À la main", detail: "Vous placez chacun.", icone: <UserRoundCheck className="h-5 w-5" /> },
  { r: "choix", titre: "Au choix", detail: "Les étudiants choisissent leur groupe.", icone: <Hand className="h-5 w-5" /> },
];

const DUREES = [5, 10, 15, 20, 30, 45, 60];

function melanger<T>(liste: T[]): T[] {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function composer(r: Repartition, n: number, sallesAPart: boolean, unites: ParticipantGroupeDto[]): Brouillon {
  const salles = unites.filter((p) => p.role === "salle");
  const enLigne = unites.filter((p) => p.role === "etudiant");
  const vides = (k: number) => Array.from({ length: k }, (_, i) => ({ nom: `Groupe ${i + 1}`, membres: [] as number[] }));
  if (r === "campus") {
    const parSite = new Map<string, { nom: string; membres: number[] }>();
    for (const p of [...salles, ...enLigne]) {
      const cle = String(p.siteId ?? 0);
      const g = parSite.get(cle) ?? { nom: p.site ?? "En ligne", membres: [] };
      g.membres.push(p.id);
      parSite.set(cle, g);
    }
    return [...parSite.values()];
  }
  if (r === "main" || r === "choix") return vides(n);
  // Au hasard : les salles forment chacune leur groupe (ou sont réparties), puis les étudiants en ligne sont mélangés.
  const base = enLigne.length || !sallesAPart ? vides(n) : [];
  if (!sallesAPart) salles.forEach((s, i) => base[i % n].membres.push(s.id));
  const depart = sallesAPart ? 0 : salles.length;
  melanger(enLigne).forEach((p, i) => base[(i + depart) % n].membres.push(p.id));
  const aPart = sallesAPart ? salles.map((s) => ({ nom: s.site ?? s.nom, membres: [s.id] })) : [];
  return [...base, ...aPart];
}

export function CompositeurGroupes({ seance, ouverte, onFermer }: { seance: SeanceDetailDto; ouverte: boolean; onFermer: () => void }) {
  const { data: presents, refetch, isFetching } = useQuery<ParticipantGroupeDto[]>({ queryKey: [`/api/seances/${seance.id}/participants`], enabled: ouverte, staleTime: 0 });
  const [repartition, setRepartition] = useState<Repartition>("hasard");
  const [nombre, setNombre] = useState(0);
  const [sallesAPart, setSallesAPart] = useState(true);
  const [groupes, setGroupes] = useState<Brouillon>([]);
  const [consigne, setConsigne] = useState("");
  const [duree, setDuree] = useState<number | null>(15);
  const [retourLibre, setRetourLibre] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  // À répartir : les salles et les étudiants en ligne ; un étudiant émargé dans une salle suit sa salle.
  const unites = useMemo(() => (presents ?? []).filter((p) => p.role === "salle" || p.mode !== "salle"), [presents]);
  const enSalle = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of presents ?? []) if (p.role === "etudiant" && p.mode === "salle" && p.siteId) m.set(p.siteId, (m.get(p.siteId) ?? 0) + 1);
    return m;
  }, [presents]);
  const parId = useMemo(() => new Map(unites.map((p) => [p.id, p])), [unites]);
  const nbEnLigne = unites.filter((p) => p.role === "etudiant").length;
  const nAuto = Math.max(2, Math.min(20, Math.round(nbEnLigne / 4) || 2));
  const n = nombre || nAuto;

  useEffect(() => {
    if (ouverte && presents) setGroupes(composer(repartition, n, sallesAPart, unites));
  }, [ouverte, presents, repartition, n, sallesAPart]);

  const places = new Set(groupes.flatMap((g) => g.membres));
  const restants = unites.filter((p) => !places.has(p.id));
  const deplacer = (id: number, vers: number | null) =>
    setGroupes((gs) => gs.map((g, i) => ({ ...g, membres: i === vers ? [...g.membres.filter((x) => x !== id), id] : g.membres.filter((x) => x !== id) })));
  const renommer = (i: number, nom: string) => setGroupes((gs) => gs.map((g, j) => (j === i ? { ...g, nom: nom.slice(0, 60) } : g)));
  const retirerGroupe = (i: number) => setGroupes((gs) => gs.filter((_, j) => j !== i));
  const ajouterGroupe = () => setGroupes((gs) => [...gs, { nom: `Groupe ${gs.length + 1}`, membres: [] }]);

  const choixLibre = repartition === "choix";
  const envoyes = choixLibre ? groupes : groupes.filter((g) => g.membres.length > 0);
  const pret = envoyes.length > 0 && (choixLibre || envoyes.some((g) => g.membres.length > 0));

  const ouvrir = async () => {
    setEnvoi(true);
    const ok = await agirGroupes(
      seance.id,
      "",
      { groupes: envoyes.map((g) => ({ nom: g.nom.trim() || undefined, membres: g.membres })), consigne: consigne.trim(), dureeMinutes: duree, retourLibre, choixLibre },
      choixLibre ? "Les groupes sont ouverts : les étudiants choisissent le leur." : "Les groupes sont ouverts : chacun rejoint le sien.",
    );
    setEnvoi(false);
    if (ok) onFermer();
  };

  const ligne = (p: ParticipantGroupeDto, groupe: number | null) => (
    <li key={p.id} className="flex items-center gap-2 py-1">
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
        {p.nom}
        {p.role === "etudiant" && p.site && <span className="ml-1 font-normal text-texte-gris">· {p.site}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-creme px-2 py-0.5 font-mono text-[11px] text-texte-doux">
        {p.role === "salle" ? `salle${enSalle.get(p.siteId ?? 0) ? ` +${enSalle.get(p.siteId ?? 0)}` : ""}` : p.mode === "video" ? "visio" : p.mode === "radio" ? "son" : "en ligne"}
      </span>
      <select
        value={groupe ?? ""}
        onChange={(e) => deplacer(p.id, e.target.value === "" ? null : Number(e.target.value))}
        className="max-w-[140px] shrink-0 rounded-lg border border-ligne bg-white px-2 py-1 text-[13px]"
        aria-label={`Groupe de ${p.nom}`}
      >
        <option value="">{choixLibre ? "Choisira" : "Reste en classe"}</option>
        {groupes.map((g, i) => (
          <option key={i} value={i}>
            {g.nom || `Groupe ${i + 1}`}
          </option>
        ))}
      </select>
    </li>
  );

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      large
      titre="Groupes de travail"
      description="Chaque groupe a sa visio, sa discussion et votre consigne. Vous passez d'un groupe à l'autre, puis vous rappelez la classe."
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={() => void ouvrir()} chargement={envoi} disabled={!pret} icone={<DoorOpen className="h-4 w-4" />}>
            Ouvrir les groupes
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Répartition">
          {REPARTITIONS.map((o) => (
            <button
              key={o.r}
              role="radio"
              aria-checked={repartition === o.r}
              onClick={() => setRepartition(o.r)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-colors",
                repartition === o.r ? "border-orange bg-orange-pale" : "border-ligne hover:border-texte-gris",
              )}
            >
              <span className="text-orange">{o.icone}</span>
              <span className="text-[15px] font-extrabold">{o.titre}</span>
              <span className="text-[12.5px] leading-snug text-texte-doux">{o.detail}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {repartition !== "campus" && (
            <label className="flex flex-col gap-1.5 text-sm font-bold">
              Nombre de groupes
              <input
                type="number"
                min={1}
                max={30}
                value={n}
                onChange={(e) => setNombre(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                className="w-24 rounded-xl border border-ligne px-3 py-2.5 text-[15px] font-semibold outline-none focus:border-orange"
              />
            </label>
          )}
          {repartition === "hasard" && (
            <div className="pb-2">
              <CaseACocher checked={sallesAPart} onChange={setSallesAPart} libelle="Chaque salle de campus forme son groupe" />
            </div>
          )}
          <Bouton variante="contour" taille="sm" onClick={() => void refetch()} chargement={isFetching} icone={<RefreshCw className="h-4 w-4" />} className="mb-1">
            Actualiser les présents
          </Bouton>
          {repartition === "hasard" && (
            <Bouton variante="contour" taille="sm" onClick={() => setGroupes(composer("hasard", n, sallesAPart, unites))} icone={<Shuffle className="h-4 w-4" />} className="mb-1">
              Mélanger
            </Bouton>
          )}
        </div>

        {!presents ? (
          <p className="text-[14px] text-texte-gris">Chargement des présents…</p>
        ) : !unites.length ? (
          <p className="rounded-2xl bg-creme p-4 text-[14px] text-texte-doux">
            Personne n'est encore connecté au direct. {choixLibre ? "Les étudiants choisiront leur groupe en arrivant." : "Actualisez quand les étudiants et les salles sont là."}
          </p>
        ) : (
          <p className="text-[13px] text-texte-gris">
            {nbEnLigne} étudiant{nbEnLigne > 1 ? "s" : ""} en ligne · {unites.length - nbEnLigne} salle{unites.length - nbEnLigne > 1 ? "s" : ""}
            {[...enSalle.values()].reduce((a, b) => a + b, 0) > 0 && ` · ${[...enSalle.values()].reduce((a, b) => a + b, 0)} étudiants dans les salles (ils suivent leur salle)`}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {groupes.map((g, i) => (
            <div key={i} className="rounded-2xl border border-ligne p-3">
              <div className="flex items-center gap-2">
                <input
                  value={g.nom}
                  onChange={(e) => renommer(i, e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-transparent px-1.5 py-1 text-[15px] font-extrabold outline-none hover:border-ligne focus:border-orange"
                  aria-label={`Nom du groupe ${i + 1}`}
                />
                <span className="font-mono text-[12px] text-texte-gris">{g.membres.length}</span>
                <button onClick={() => retirerGroupe(i)} className="rounded-lg p-1.5 text-texte-gris hover:bg-creme hover:text-encre" aria-label={`Supprimer ${g.nom}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {g.membres.length ? (
                <ul className="mt-1 divide-y divide-ligne-douce">{g.membres.map((id) => (parId.get(id) ? ligne(parId.get(id)!, i) : null))}</ul>
              ) : (
                <p className="mt-1 px-1.5 text-[13px] text-texte-gris">{choixLibre ? "Les étudiants le rejoindront eux-mêmes." : "Personne pour l'instant."}</p>
              )}
            </div>
          ))}
          <button onClick={ajouterGroupe} className="flex min-h-[88px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ligne text-[14px] font-bold text-texte-doux hover:border-orange hover:text-encre">
            <Plus className="h-4 w-4" /> Ajouter un groupe
          </button>
        </div>

        {restants.length > 0 && (
          <div className="rounded-2xl bg-creme p-3">
            <p className="text-[14px] font-extrabold">{choixLibre ? "Choisiront leur groupe" : "Restent en classe avec vous"} ({restants.length})</p>
            <ul className="mt-1">{restants.map((p) => ligne(p, null))}</ul>
          </div>
        )}

        <ZoneTexte libelle="Consigne" rows={3} value={consigne} onChange={(e) => setConsigne(e.target.value.slice(0, 1000))} placeholder="Ex. : en 15 minutes, listez trois usages de l'IA dans votre futur métier et choisissez un porte-parole." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Selection libelle="Durée" value={duree ?? ""} onChange={(e) => setDuree(e.target.value ? Number(e.target.value) : null)}>
            {DUREES.map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
            <option value="">Sans limite (vous rappelez la classe)</option>
          </Selection>
          <div className="flex items-end pb-2">
            <CaseACocher checked={retourLibre} onChange={setRetourLibre} libelle="Chacun peut revenir en classe" aide="Sinon, tout le monde revient à la fin." />
          </div>
        </div>
      </div>
    </Fenetre>
  );
}

// ── Suivre les groupes (formateur, équipe) ─────────────────────────────────

export function SuiviGroupes({ seance, groupes, lectureSeule, onVisiter }: { seance: SeanceDetailDto; groupes: GroupesDto; lectureSeule: boolean; onVisiter: (g: GroupeTravailDto) => void }) {
  const session = groupes.session!;
  const [annonce, setAnnonce] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const annoncer = async () => {
    if (!annonce.trim()) return;
    setEnvoi(true);
    if (await agirGroupes(seance.id, "annonce", { texte: annonce.trim() }, "Message envoyé à tous les groupes.")) setAnnonce("");
    setEnvoi(false);
  };
  const deplacer = async (utilisateurId: number, groupeId: number | null) => {
    try {
      const r = await put<GroupesDto>(`/api/seances/${seance.id}/groupes/membres`, { utilisateurId, groupeId });
      queryClient.setQueryData(cleGroupes(seance.id), r);
    } catch (e) {
      toastErreur(e);
    }
  };
  const nbPersonnes = groupes.groupes.reduce((t, g) => t + g.nbMembres, 0);

  return (
    <section className="rounded-[22px] bg-nuit-panneau p-4 ring-2 ring-orange/50" aria-label="Groupes de travail en cours">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-2 text-lg font-black">
          <UsersRound className="h-5 w-5 text-orange" /> Groupes de travail
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[13px] text-orange-peche">
          <Clock className="h-3.5 w-3.5" /> <MinuteurGroupes session={session} />
        </span>
        <span className="font-mono text-[12px] text-nuit-gris">
          {groupes.groupes.length} groupes · {nbPersonnes} participants{session.choixLibre ? " · au choix" : ""}
        </span>
        {!lectureSeule && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Bouton taille="sm" variante="nuit" onClick={() => void agirGroupes(seance.id, "prolonger", { minutes: 5 }, "5 minutes de plus pour les groupes.")}>
              +5 min
            </Bouton>
            {!session.fermetureLe && (
              <Bouton taille="sm" variante="nuit-actif" icone={<BellRing className="h-4 w-4" />} onClick={() => void agirGroupes(seance.id, "fermer", { delaiSecondes: 60 }, "Retour en classe dans 60 secondes.")}>
                Rappeler la classe
              </Bouton>
            )}
            <Bouton taille="sm" variante="danger" onClick={() => void agirGroupes(seance.id, "fermer", { delaiSecondes: 0 }, "Tout le monde revient en classe.")}>
              Fermer maintenant
            </Bouton>
          </div>
        )}
      </div>
      {session.consigne && (
        <p className="mt-2 whitespace-pre-wrap text-[14px] leading-snug text-nuit-doux">
          <span className="font-bold text-white">Consigne · </span>
          {session.consigne}
        </p>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
        {groupes.groupes.map((g) => (
          <CarteGroupe key={g.id} seanceId={seance.id} g={g} groupes={groupes.groupes} lectureSeule={lectureSeule} onVisiter={() => onVisiter(g)} onDeplacer={deplacer} />
        ))}
      </div>
      {!lectureSeule && (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void annoncer();
          }}
        >
          <Megaphone className="h-5 w-5 shrink-0 text-orange" />
          <input
            value={annonce}
            onChange={(e) => setAnnonce(e.target.value.slice(0, 300))}
            placeholder="Message à tous les groupes (ex. : plus que 2 minutes !)"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-nuit-bord bg-nuit-bulle px-3 text-[14px] text-white outline-none placeholder:text-nuit-gris focus:border-orange"
            aria-label="Message à tous les groupes"
          />
          <Bouton type="submit" taille="sm" variante="nuit-actif" chargement={envoi} disabled={!annonce.trim()} icone={<Send className="h-4 w-4" />} aria-label="Envoyer à tous les groupes">
            Envoyer
          </Bouton>
        </form>
      )}
      {session.annonce && <p className="mt-2 text-[12px] text-nuit-gris">Dernier message aux groupes : « {session.annonce} »</p>}
    </section>
  );
}

function CarteGroupe({
  seanceId,
  g,
  groupes,
  lectureSeule,
  onVisiter,
  onDeplacer,
}: {
  seanceId: number;
  g: GroupeTravailDto;
  groupes: GroupeTravailDto[];
  lectureSeule: boolean;
  onVisiter: () => void;
  onDeplacer: (utilisateurId: number, groupeId: number | null) => void;
}) {
  const aide = Boolean(g.aideDemandeeLe);
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl bg-nuit-carte p-3", aide && "ring-2 ring-[#FF8A6B]")}>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{g.nom}</span>
        <span className="font-mono text-[12px] text-nuit-gris">{g.nbMembres}</span>
      </div>
      {aide && (
        <p className="flex items-center gap-1.5 rounded-lg bg-[#FF8A6B]/15 px-2 py-1 text-[13px] font-bold text-[#FF8A6B]">
          <BellRing className="h-4 w-4" /> Vous appelle
        </p>
      )}
      <ul className="flex flex-col gap-0.5 text-[13px]">
        {g.membres.length === 0 && <li className="text-nuit-gris">Personne pour l'instant.</li>}
        {g.membres.map((m) => (
          <li key={m.id} className="flex items-center gap-1.5">
            <span className={cn("min-w-0 flex-1 truncate", m.role === "salle" ? "font-bold text-orange-peche" : "text-nuit-texte")}>{m.nom}</span>
            {!lectureSeule && (
              <select
                value={g.id}
                onChange={(e) => onDeplacer(m.id, e.target.value === "" ? null : Number(e.target.value))}
                className="max-w-[112px] shrink-0 rounded-md border border-nuit-bord bg-nuit-bulle px-1 py-0.5 text-[12px] text-nuit-doux"
                aria-label={`Déplacer ${m.nom}`}
              >
                {groupes.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nom}
                  </option>
                ))}
                <option value="">En classe</option>
              </select>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex gap-2">
        <Bouton
          taille="sm"
          variante={aide ? "nuit-actif" : "nuit"}
          icone={<Video className="h-4 w-4" />}
          onClick={() => {
            onVisiter();
            if (aide && !lectureSeule) void post(`/api/seances/${seanceId}/groupes/${g.id}/aide-traitee`).catch(() => undefined);
          }}
          className="flex-1"
        >
          {aide ? "J'y vais" : "Rejoindre en visite"}
        </Bouton>
      </div>
    </div>
  );
}

/** Visite d'un groupe par le formateur : visio du groupe et sa discussion, par-dessus le Studio. */
export function VisiteGroupe({ seance, groupes, groupe, role, moiId, onFermer }: { seance: SeanceDetailDto; groupes: GroupesDto; groupe: GroupeTravailDto; role: RoleSeance; moiId: number; onFermer: () => void }) {
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [onFermer]);
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-nuit text-white" role="dialog" aria-modal="true" aria-label={`Visite du ${groupe.nom}`}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-nuit-ligne px-4 py-3">
        <span className="text-lg font-black">Visite · {groupe.nom}</span>
        <span className="min-w-0 max-w-full truncate text-[13px] text-nuit-doux">{groupe.membres.map((m) => m.nom).join(", ") || "Personne pour l'instant"}</span>
        {groupes.session && <MinuteurGroupes session={groupes.session} className="font-mono text-[13px] text-orange-peche" />}
        <span className="text-[12px] text-nuit-gris">Votre micro est coupé dans la classe pendant la visite.</span>
        <Bouton className="ml-auto" variante="nuit-actif" taille="sm" onClick={onFermer} icone={<ArrowLeft className="h-4 w-4" />}>
          Revenir au studio
        </Bouton>
      </header>
      <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,1fr)_380px] lg:overflow-hidden">
        <div className="min-h-[50vh] overflow-hidden rounded-[18px] bg-black lg:min-h-0">
          {groupes.visioDisponible ? (
            <CadreDaily key={groupe.id} obtenirAcces={accesVisio(seance.id, groupe.id)} role="formateur" tu={false} microAuDepart cameraAuDepart />
          ) : (
            <SansVisio texte="La visio des groupes n'est pas disponible : échangez avec le groupe dans sa discussion." />
          )}
        </div>
        <aside className="flex min-h-[380px] flex-col overflow-hidden rounded-[18px] bg-nuit-panneau lg:min-h-0">
          <p className="flex items-center gap-2 border-b border-nuit-ligne px-4 py-3 text-[14px] font-extrabold">
            <MessageSquareText className="h-4 w-4 text-orange" /> Discussion du groupe
          </p>
          <PanneauDiscussion seanceId={seance.id} role={role} moiId={moiId} ouverte groupeId={groupe.id} />
        </aside>
      </div>
    </div>,
    document.body,
  );
}

function SansVisio({ texte, grand }: { texte: string; grand?: boolean }) {
  return (
    <div className="grid h-full min-h-[240px] place-items-center p-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-nuit-ligne text-orange">
          <UsersRound className="h-7 w-7" />
        </span>
        <p className={cn("font-semibold text-nuit-texte", grand ? "text-[clamp(20px,2vw,32px)]" : "text-[15px]")}>{texte}</p>
      </div>
    </div>
  );
}

// ── Côté étudiant et salle ─────────────────────────────────────────────────

/** Bandeau du groupe : nom, membres, minuteur, consigne, message du formateur, actions. */
function EnTeteGroupe({ seanceId, groupes, groupe, moiId, tu, grand }: { seanceId: number; groupes: GroupesDto; groupe: GroupeTravailDto; moiId: number; tu: boolean; grand?: boolean }) {
  const session = groupes.session!;
  const autres = groupe.membres.filter((m) => m.id !== moiId);
  const [appel, setAppel] = useState(false);
  const appeler = async () => {
    setAppel(true);
    await agirGroupes(seanceId, "aide", {}, tu ? "Le formateur est prévenu : il passe dans ton groupe." : "Le formateur est prévenu.");
    setAppel(false);
  };
  const quitter = () => void agirGroupes(seanceId, "quitter", {}, tu ? "Tu es de retour en classe." : "Retour en classe.");
  const annonceRecente = session.annonce && session.annonceLe && new Date(session.annonceLe).getTime() >= new Date(session.ouverteLe).getTime();
  return (
    <div className="flex flex-col gap-3">
      {session.fermetureLe && (
        <div className="flex items-center justify-center gap-2 rounded-[18px] bg-orange px-4 py-3 text-center text-encre" role="alert">
          <BellRing className="h-5 w-5" />
          <MinuteurGroupes session={session} className={cn("font-black text-encre", grand ? "text-[clamp(22px,2.4vw,40px)]" : "text-lg")} />
        </div>
      )}
      {annonceRecente && (
        <div className="flex items-start gap-2 rounded-[18px] bg-creme px-4 py-3 text-encre" role="status">
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" />
          <p className={cn("font-bold leading-snug", grand ? "text-[clamp(18px,1.8vw,30px)]" : "text-[15px]")}>
            <span className="font-mono text-[12px] uppercase tracking-wider text-orange-fonce">Message du formateur · </span>
            {session.annonce}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2 rounded-[22px] bg-nuit-panneau p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className={cn("flex items-center gap-2 font-black tracking-serre", grand ? "text-[clamp(26px,2.6vw,44px)]" : "text-2xl")}>
            <UsersRound className="h-6 w-6 text-orange" /> {groupe.nom}
          </span>
          {!session.fermetureLe && <MinuteurGroupes session={session} className={cn("font-mono text-orange-peche", grand ? "text-[clamp(16px,1.4vw,24px)]" : "text-[14px]")} />}
        </div>
        <p className={cn("text-nuit-doux", grand ? "text-[clamp(15px,1.3vw,22px)]" : "text-[14px]")}>
          {autres.length ? `Avec ${autres.map((m) => m.nom).join(", ")}` : "Personne d'autre pour l'instant."}
        </p>
        {session.consigne && (
          <p className={cn("whitespace-pre-wrap rounded-xl bg-nuit-carte px-3 py-2 leading-snug text-white", grand ? "text-[clamp(17px,1.6vw,28px)]" : "text-[15px]")}>
            <span className="font-mono text-[12px] uppercase tracking-wider text-orange-peche">Consigne · </span>
            {session.consigne}
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Bouton variante={groupe.aideDemandeeLe ? "nuit" : "nuit-actif"} icone={<BellRing className="h-4 w-4" />} onClick={() => void appeler()} chargement={appel} disabled={Boolean(groupe.aideDemandeeLe)}>
            {groupe.aideDemandeeLe ? "Le formateur est prévenu" : "Appeler le formateur"}
          </Bouton>
          {(session.retourLibre || session.choixLibre) && (
            <Bouton variante="nuit" icone={<DoorOpen className="h-4 w-4" />} onClick={quitter}>
              Revenir en classe
            </Bouton>
          )}
        </div>
      </div>
    </div>
  );
}

/** L'étudiant dans son groupe : visio du groupe (ou l'écran de sa salle), consigne et discussion. */
export function VueGroupeEtudiant({ seance, groupes, groupe, moiId, mode }: { seance: SeanceDetailDto; groupes: GroupesDto; groupe: GroupeTravailDto; moiId: number; mode: ModeSuivi }) {
  const enSalle = mode === "compagnon";
  // Arrivée dans le groupe : on remonte en haut (consigne et visio), même si l'on lisait la discussion.
  useEffect(() => window.scrollTo({ top: 0, behavior: "smooth" }), [groupe.id]);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
      <div className="flex min-w-0 flex-col gap-3">
        <EnTeteGroupe seanceId={seance.id} groupes={groupes} groupe={groupe} moiId={moiId} tu />
        {enSalle ? (
          <div className="rounded-[22px] bg-nuit-panneau">
            <SansVisio texte="Tu es dans la salle de conférence : ton groupe se retrouve sur l'écran de la salle. Écris ici pour partager des idées ou des documents." />
          </div>
        ) : groupes.visioDisponible ? (
          <div className="flex flex-col gap-1.5">
            <div className="aspect-video min-h-[260px] overflow-hidden rounded-[22px] bg-black">
              <CadreDaily key={groupe.id} obtenirAcces={accesVisio(seance.id, groupe.id)} role="etudiant" tu microAuDepart={false} cameraAuDepart={false} />
            </div>
            <p className="text-center text-[12.5px] text-nuit-gris">Micro et caméra coupés à l'arrivée : ouvre-les avec les boutons de la visio. La caméra consomme beaucoup de données.</p>
          </div>
        ) : (
          <div className="rounded-[22px] bg-nuit-panneau">
            <SansVisio texte="Pas de visio pour les groupes aujourd'hui : échangez par écrit dans la discussion du groupe." />
          </div>
        )}
      </div>
      <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-[22px] bg-nuit-panneau lg:min-h-[560px]">
        <p className="flex items-center gap-2 border-b border-nuit-ligne px-4 py-3 text-[14px] font-extrabold">
          <MessageSquareText className="h-4 w-4 text-orange" /> Discussion du groupe
        </p>
        <PanneauDiscussion seanceId={seance.id} role="etudiant" moiId={moiId} ouverte groupeId={groupe.id} />
      </aside>
    </div>
  );
}

/** Répartition « au choix » : l'étudiant choisit son groupe. */
export function ChoixGroupe({ seanceId, groupes }: { seanceId: number; groupes: GroupesDto }) {
  const [envoi, setEnvoi] = useState<number | null>(null);
  const rejoindre = async (g: GroupeTravailDto) => {
    setEnvoi(g.id);
    await agirGroupes(seanceId, `${g.id}/rejoindre`, {}, `Tu rejoins ${g.nom}.`);
    setEnvoi(null);
  };
  return (
    <section className="flex flex-col gap-3 rounded-[22px] bg-nuit-panneau p-5 ring-2 ring-orange/50">
      <p className="flex items-center gap-2 text-lg font-extrabold">
        <UsersRound className="h-5 w-5 text-orange" /> Travail en groupes : choisis ton groupe
      </p>
      {groupes.session?.consigne && <p className="whitespace-pre-wrap text-[14px] text-nuit-doux">{groupes.session.consigne}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {groupes.groupes.map((g) => (
          <button
            key={g.id}
            onClick={() => void rejoindre(g)}
            disabled={envoi !== null}
            className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-nuit-carte px-4 py-3 text-left hover:bg-nuit-ligne disabled:opacity-60"
          >
            <span className="text-[15px] font-extrabold">{g.nom}</span>
            <span className="font-mono text-[12px] text-nuit-gris">
              {g.nbMembres === 0 ? "vide" : `${g.nbMembres} ${g.nbMembres > 1 ? "personnes" : "personne"}`} · {envoi === g.id ? "…" : "rejoindre"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** L'écran d'une salle dans son groupe : la visio du groupe en grand, la consigne et la discussion. */
export function VueGroupeSalle({ seance, groupes, groupe, moiId }: { seance: SeanceDetailDto; groupes: GroupesDto; groupe: GroupeTravailDto; moiId: number }) {
  return (
    <main className="grid flex-1 gap-5 bg-nuit px-4 py-4 text-white sm:px-6 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(340px,30%)] lg:px-10">
      <div className="flex min-w-0 flex-col gap-4 lg:min-h-0">
        <div className="min-h-[45vh] flex-1 overflow-hidden rounded-[22px] bg-black lg:min-h-0">
          {!groupes.visioDisponible ? (
            <SansVisio grand texte="Travail en groupe dans la salle : suivez la consigne, le formateur passera vous voir." />
          ) : (
            <CadreDaily key={groupe.id} obtenirAcces={accesVisio(seance.id, groupe.id)} role="salle" tu={false} micro camera microAuDepart cameraAuDepart relanceAuto />
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-4">
        <EnTeteGroupe seanceId={seance.id} groupes={groupes} groupe={groupe} moiId={moiId} tu={false} grand />
        <aside className="flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-[22px] bg-nuit-panneau lg:min-h-0">
          <p className="flex items-center gap-2 border-b border-nuit-ligne px-4 py-3 text-[15px] font-extrabold">
            <MessageSquareText className="h-4 w-4 text-orange" /> Discussion du groupe
          </p>
          <PanneauDiscussion seanceId={seance.id} role="salle" moiId={moiId} ouverte groupeId={groupe.id} />
        </aside>
      </div>
    </main>
  );
}

/** Bouton du Studio : ouvre la composition des groupes (pendant le direct). */
export function BoutonGroupes({ onClick }: { onClick: () => void }) {
  return (
    <Bouton variante="nuit" icone={<UsersRound className="h-4 w-4" />} onClick={onClick}>
      Groupes
    </Bouton>
  );
}
