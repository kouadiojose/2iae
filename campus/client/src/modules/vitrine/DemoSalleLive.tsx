// Démonstration de la salle live (écran « 03 Salle live » de la maquette),
// avec le contenu fictif de la maquette :
// scène du formateur, les cinq salles, questions votées, panneau des campus
// et résumé de l'assistant. Tout est local : rien n'est envoyé, aucune
// donnée réelle, aucun nom d'étudiant (les questions sont signées par campus).
import { useState, type FormEvent, type ReactNode } from "react";
import { Hand, Mic, MicOff, Turtle, LogOut, ChevronUp } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { duree } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { cn } from "@/lib/utils";

const SALLES = [
  { nom: "Riviera", salle: "Salle Palmeraie", effectif: 38 },
  { nom: "Yopougon", salle: "Salle Kédjénou", effectif: 64 },
  { nom: "Yamoussoukro", salle: "Salle Baoulé", effectif: 41 },
  { nom: "M'Batto", salle: "Salle Akwaba", effectif: 22 },
  { nom: "Azaguié", salle: "Salle Agro-pastorale", effectif: 17 },
];
const EN_LIGNE = 57;

type Question = { id: number; qui: string; texte: string; votes: number; moi: boolean };

const QUESTIONS: Question[] = [
  { id: 1, qui: "M'Batto · Salle Akwaba", texte: "L'IA peut-elle aider un agriculteur à prévoir sa récolte ?", votes: 12, moi: false },
  { id: 2, qui: "Yopougon · en ligne", texte: "Quelle différence entre l'IA et un simple programme informatique ?", votes: 9, moi: false },
  { id: 3, qui: "Yamoussoukro · Salle Baoulé", texte: "Faut-il savoir coder pour utiliser un modèle de langage ?", votes: 6, moi: false },
  { id: 4, qui: "Azaguié · en ligne", texte: "Comment vérifier si une réponse de l'IA est juste ?", votes: 4, moi: false },
];

const NOTES = [
  { t: "00:04", texte: "Présentation du formateur et tour des cinq salles de campus." },
  { t: "00:11", texte: "Définition : l'IA désigne des systèmes qui apprennent à partir de données." },
  { t: "00:18", texte: "Exemples locaux : prévision de récoltes de cacao, service client, gestion de stock." },
  { t: "00:22", texte: "Introduction aux modèles de langage et à leurs limites." },
];

type Panneau = "questions" | "campus" | "assistant";

export function DemoSalleLive() {
  // La démo « tourne » depuis 23 minutes quand on arrive.
  const [debut] = useState(() => maintenantServeur() - 1394_000);
  const maintenant = useMaintenant(1000);
  const [panneau, setPanneau] = useState<Panneau>("questions");
  const [questions, setQuestions] = useState(QUESTIONS);
  const [brouillon, setBrouillon] = useState("");
  const [micro, setMicro] = useState(false);
  const [main, setMain] = useState(false);
  const [lent, setLent] = useState(false);
  const [quitte, setQuitte] = useState(false);

  // Contenu fictif de la maquette : la démo ne se confond jamais avec un vrai cours.
  const lieu = "Paris";
  const titre = "Initiation à l'intelligence artificielle";
  const code = "IA-101";
  const ecoule = Math.max(0, Math.floor((maintenant - debut) / 1000));
  const connectes = SALLES.reduce((s, x) => s + x.effectif, 0) + EN_LIGNE + (main ? 1 : 0);

  const voter = (id: number) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, votes: q.votes + (q.moi ? -1 : 1), moi: !q.moi } : q)));
  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    const t = brouillon.trim();
    if (!t) return;
    setQuestions((qs) => [...qs, { id: Date.now(), qui: "Yopougon · vous", texte: t.slice(0, 200), votes: 1, moi: true }]);
    setBrouillon("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-mono text-xs text-nuit-gris">
            {code} · Séance 1 · Formateur à {lieu}
          </span>
          <h3 className="text-[22px] font-extrabold tracking-[-0.02em] text-white sm:text-[26px]">{titre}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-2 rounded-full bg-[#2A1510] px-3 py-2 font-mono text-xs text-[#FF8A6B]">
            <span className="point-direct" />
            EN DIRECT · {duree(ecoule)}
          </span>
          <span className="rounded-full bg-nuit-carte px-3 py-2 font-mono text-xs text-nuit-doux">{connectes} connectés · 5 campus</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="flex min-w-0 flex-col gap-3">
          {/* Scène du formateur */}
          <div className="relative flex aspect-video flex-col gap-2 overflow-hidden rounded-[22px] border-2 border-orange bg-nuit-carte p-3 sm:p-4">
            <div className="grid min-h-0 flex-1 place-items-center">
              <span className="grid aspect-square w-[clamp(56px,14%,120px)] place-items-center rounded-full bg-orange text-[clamp(20px,3vw,40px)] font-black text-encre">
                FR
              </span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap rounded-[10px] bg-black/65 px-3 py-2 text-[13px] font-bold text-white sm:text-sm">Formateur · {lieu}</span>
                <span className="whitespace-nowrap rounded-[10px] bg-orange px-2.5 py-2 text-xs font-bold text-encre">Présente</span>
              </div>
              <div className="hidden max-w-[280px] flex-col gap-1 rounded-xl bg-black/65 px-3.5 py-2.5 sm:flex">
                <span className="font-mono text-[11px] text-orange-peche">Diapo 7 / 24</span>
                <span className="text-sm font-semibold text-white">Qu'est-ce qu'un modèle de langage ?</span>
              </div>
            </div>
            {quitte && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-nuit/90 p-6 text-center">
                <p className="text-lg font-extrabold text-white">Fin de la démonstration.</p>
                <p className="max-w-sm text-[15px] text-nuit-doux">Les étudiants 2IAE rejoignent le vrai live depuis leur campus, en un toucher.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <LienBouton href="/connexion" variante="nuit-actif">
                    Accéder à mon campus
                  </LienBouton>
                  <button type="button" onClick={() => setQuitte(false)} className="min-h-[48px] rounded-xl px-4 text-[15px] font-bold text-nuit-doux hover:text-white">
                    Revenir à la démo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Les cinq salles */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            {SALLES.map((s, i) => {
              const levee = i === 3 || (i === 1 && main);
              return (
                <div
                  key={s.nom}
                  className={cn("relative aspect-[16/10] overflow-hidden rounded-[14px] border-2 bg-nuit-carte", i === 3 ? "border-orange" : "border-nuit-ligne", i === 4 && "col-span-2 aspect-[32/10] sm:col-span-1 sm:aspect-[16/10]")}
                >
                  <span className="absolute right-2 top-2 font-mono text-[11px] text-texte-gris">{s.effectif} en salle</span>
                  <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1.5">
                    <span className="truncate rounded-[7px] bg-black/70 px-2 py-1 text-xs font-bold text-white">{s.nom}</span>
                    {levee && <span className="whitespace-nowrap rounded-[7px] bg-orange px-1.5 py-1 text-[11px] font-extrabold text-encre">Main</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contrôles de l'étudiant (audio seulement : pas de caméra étudiante) */}
          <div className="flex flex-wrap justify-center gap-2.5 pt-1">
            <Controle actif={micro} onClick={() => setMicro(!micro)} icone={micro ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}>
              {micro ? "Micro activé" : "Micro coupé"}
            </Controle>
            <Controle actif={main} onClick={() => setMain(!main)} icone={<Hand className="h-4 w-4" />}>
              {main ? "Main levée" : "Lever la main"}
            </Controle>
            <Controle actif={lent} onClick={() => setLent(!lent)} icone={<Turtle className="h-4 w-4" />}>
              Plus lentement
            </Controle>
            <Controle danger onClick={() => setQuitte(true)} icone={<LogOut className="h-4 w-4" />}>
              Quitter
            </Controle>
          </div>
        </div>

        {/* Panneaux : questions votées, campus, assistant */}
        <aside className="flex min-h-[420px] flex-col overflow-hidden rounded-[22px] bg-nuit-panneau lg:min-h-[520px]">
          <div className="flex gap-1 border-b border-nuit-ligne p-2.5" role="tablist" aria-label="Panneaux de la salle live">
            {(
              [
                ["questions", "Questions"],
                ["campus", "Campus"],
                ["assistant", "Assistant IA"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={panneau === k}
                onClick={() => setPanneau(k)}
                className={cn("min-h-[44px] flex-1 rounded-[10px] px-2 text-[13px] font-bold transition-colors", panneau === k ? "bg-orange text-encre" : "text-nuit-doux hover:text-white")}
              >
                {l}
              </button>
            ))}
          </div>

          {panneau === "questions" && (
            <>
              <div className="flex flex-1 flex-col gap-2.5 overflow-auto p-3.5">
                {[...questions]
                  .sort((a, b) => b.votes - a.votes)
                  .map((q) => (
                    <div key={q.id} className="grid grid-cols-[1fr_auto] items-start gap-2.5 rounded-[14px] bg-nuit-bulle px-3.5 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[11px] text-orange">{q.qui}</span>
                        <span className="text-sm leading-snug text-nuit-texte">{q.texte}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => voter(q.id)}
                        aria-pressed={q.moi}
                        aria-label={`Voter pour cette question (${q.votes} votes)`}
                        className={cn(
                          "flex min-h-[44px] min-w-[48px] flex-col items-center justify-center rounded-[10px] border border-nuit-bord px-2 font-mono text-xs font-semibold",
                          q.moi ? "bg-orange text-encre" : "text-nuit-doux hover:text-white",
                        )}
                      >
                        <ChevronUp className="h-4 w-4" />
                        {q.votes}
                      </button>
                    </div>
                  ))}
              </div>
              <form onSubmit={envoyer} className="flex gap-2 border-t border-nuit-ligne p-3">
                <label htmlFor="demo-question" className="sr-only">
                  Poser une question au formateur
                </label>
                <input
                  id="demo-question"
                  value={brouillon}
                  onChange={(e) => setBrouillon(e.target.value)}
                  maxLength={200}
                  placeholder="Poser une question au formateur…"
                  className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-nuit-bord bg-nuit-bulle px-3 text-base text-white placeholder:text-nuit-gris focus:border-orange focus:outline-none"
                />
                <button type="submit" className="min-h-[48px] rounded-xl bg-orange px-4 font-extrabold text-encre">
                  Envoyer
                </button>
              </form>
            </>
          )}

          {panneau === "campus" && (
            <div className="flex flex-1 flex-col gap-1 overflow-auto p-3.5">
              {SALLES.map((s, i) => (
                <div key={s.nom} className="flex items-center justify-between border-b border-nuit-ligne px-1.5 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-white">{s.nom}</span>
                    <span className="text-xs text-texte-gris">{s.salle}</span>
                  </div>
                  <span className="font-mono text-xs text-nuit-doux">{s.effectif + (i === 1 && main ? 1 : 0)} en salle</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-1.5 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-white">En ligne</span>
                  <span className="text-xs text-texte-gris">Téléphone et ordinateur</span>
                </div>
                <span className="font-mono text-xs text-nuit-doux">{EN_LIGNE} connectés</span>
              </div>
            </div>
          )}

          {panneau === "assistant" && (
            <div className="flex flex-1 flex-col gap-3.5 overflow-auto p-4">
              <span className="font-mono text-[11px] text-orange-peche">Assistant IA · résumé en direct</span>
              {NOTES.map((n) => (
                <div key={n.t} className="grid grid-cols-[48px_1fr] gap-2.5 text-sm leading-snug">
                  <span className="font-mono text-xs text-texte-gris">{n.t}</span>
                  <span className="text-nuit-texte">{n.texte}</span>
                </div>
              ))}
              <span className="text-xs leading-relaxed text-texte-gris">
                Le résumé complet et la transcription sont joints au replay, dans le cours {code}, après relecture par le formateur.
              </span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Controle({
  actif,
  danger,
  onClick,
  icone,
  children,
}: {
  actif?: boolean;
  danger?: boolean;
  onClick: () => void;
  icone: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={danger ? undefined : Boolean(actif)}
      className={cn(
        "inline-flex min-h-[48px] items-center gap-2 rounded-[14px] px-4 text-sm font-bold transition-colors",
        danger ? "bg-direct text-white hover:bg-danger" : actif ? "bg-orange text-encre" : "bg-nuit-carte text-white hover:bg-nuit-ligne",
      )}
    >
      {icone}
      {children}
    </button>
  );
}
