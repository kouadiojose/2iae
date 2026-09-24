// Visite guidée en trois écrans illustrés, adaptée au rôle :
// étudiant (prochain cours, rendre un devoir, écrire à un formateur),
// formateur (studio, corrections, questions) et équipe (pilotage, fiches,
// présences et annonces). Les illustrations sont dessinées en HTML : aucune
// image à télécharger.
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCheck, ClipboardList, Hand, MessageCircle, QrCode, Radio, Sparkles, Users, Camera, Megaphone, Home, BookOpen } from "lucide-react";
import { DecompteCourt } from "@/components/ui/compte-a-rebours";
import { heure, heureDouble, jourLong } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Role } from "@shared/schema";
import type { EnCours } from "@shared/api";

export type EcranVisite = { cle: string; etiquette: string; titre: string; texte: string; illustration: ReactNode };

const CAMPUS = ["Riviera", "Yopougon", "Yamoussoukro", "Azaguié", "M'Batto"];

/** Écrans de la visite pour ce rôle. */
export function useEcransVisite(role: Role): EcranVisite[] {
  // Le vrai prochain cours quand il existe (module live) ; sinon un exemple.
  const { data } = useQuery<EnCours>({ queryKey: ["/api/live/en-cours"], retry: false, staleTime: 60_000 });
  const seance = data?.enDirect ?? data?.prochaine ?? null;

  if (role === "etudiant") {
    return [
      {
        cle: "cours",
        etiquette: "1 · Aujourd'hui et Live",
        titre: "Voici ton prochain cours",
        texte: "Quand un cours commence, l'onglet Live devient rouge. Un toucher et tu es dans la classe, avec les cinq campus en même temps.",
        illustration: (
          <IllustrationProchainCours
            titre={seance?.coursTitre ?? "Initiation à l'intelligence artificielle"}
            quand={seance ? `${jourLong(seance.debut)} · ${heure(seance.debut)}` : "mardi · 10h00"}
            debut={seance?.debut ?? null}
            exemple={!seance}
            formateur={seance?.formateur ? `${seance.formateur.prenom} ${seance.formateur.nom}` : null}
          />
        ),
      },
      {
        cle: "devoir",
        etiquette: "2 · Devoirs",
        titre: "Rends tes devoirs en photo",
        texte: "Photographie ta copie, même sur un cahier. Tu reçois un reçu numéroté. Pas de réseau ? Ton devoir part tout seul dès que la connexion revient.",
        illustration: <IllustrationDevoir />,
      },
      {
        cle: "messages",
        etiquette: "3 · Messages",
        titre: "Écris à tes formateurs",
        texte: "Une question sur une leçon ? Écris à ton formateur ou à la vie scolaire, comme sur WhatsApp. ✓ envoyé, ✓✓ lu.",
        illustration: <IllustrationMessages />,
      },
    ];
  }

  if (role === "formateur") {
    return [
      {
        cle: "studio",
        etiquette: "1 · Studio",
        titre: "Vos cinq salles, en direct",
        texte: "Depuis le studio, vous voyez les campus connectés, les mains levées et les questions votées. Vous donnez la parole à une salle en un clic.",
        illustration: (
          <IllustrationStudio
            titre={seance?.coursTitre ?? "Initiation à l'intelligence artificielle"}
            quand={seance ? heureDouble(seance.debut) : "10h00 Abidjan · 12h00 Paris"}
          />
        ),
      },
      {
        cle: "corrections",
        etiquette: "2 · Corrections",
        titre: "Les copies arrivent ici",
        texte: "Les copies rendues sont rangées par devoir. L'IA peut proposer une correction : elle reste un brouillon tant que vous ne l'avez pas validée.",
        illustration: <IllustrationCorrections />,
      },
      {
        cle: "questions",
        etiquette: "3 · Messages",
        titre: "Les questions de vos étudiants",
        texte: "Chaque cours a son salon de questions, que vous modérez. Les étudiants peuvent aussi vous écrire directement.",
        illustration: <IllustrationMessages formateur />,
      },
    ];
  }

  return [
    {
      cle: "pilotage",
      etiquette: "1 · Pilotage",
      titre: "Votre campus d'un coup d'œil",
      texte: "Comptes activés, présence aux lives, devoirs rendus et « Qui décroche ? » : vous voyez tout de suite qui a besoin d'un appel.",
      illustration: <IllustrationPilotage />,
    },
    {
      cle: "fiches",
      etiquette: "2 · Comptes",
      titre: "Des fiches de connexion à imprimer",
      texte: "Chaque étudiant reçoit une fiche avec un QR code : il entre sans rien taper. Un code oublié ? Un nouveau code en un clic, à envoyer sur WhatsApp.",
      illustration: <IllustrationFiche />,
    },
    {
      cle: "annonces",
      etiquette: "3 · Présences et annonces",
      titre: "Présences et annonces ciblées",
      texte: "Justifiez une absence, suivez les présences par séance et envoyez une annonce à un campus, une classe ou un cours, avec les accusés de lecture.",
      illustration: <IllustrationAnnonces />,
    },
  ];
}

// ── Illustrations ──────────────────────────────────────────────────────────

/** Petit écran de téléphone stylisé. */
function Ecran({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[300px] overflow-hidden rounded-[28px] border-[6px] border-encre bg-white shadow-telephone", className)} aria-hidden>
      <div className="flex justify-center bg-encre pb-1">
        <span className="h-1.5 w-14 rounded-full bg-nuit-ligne" />
      </div>
      {children}
    </div>
  );
}

function BarreOnglets({ actif }: { actif: "accueil" | "live" | "devoirs" | "messages" }) {
  const onglets = [
    { cle: "accueil", icone: <Home className="h-4 w-4" />, l: "Aujourd'hui" },
    { cle: "cours", icone: <BookOpen className="h-4 w-4" />, l: "Cours" },
    { cle: "live", icone: <Radio className="h-4 w-4" />, l: "Live" },
    { cle: "devoirs", icone: <ClipboardList className="h-4 w-4" />, l: "Devoirs" },
    { cle: "messages", icone: <MessageCircle className="h-4 w-4" />, l: "Messages" },
  ];
  return (
    <div className="flex items-end justify-around border-t border-ligne-douce px-1 pb-2 pt-1.5">
      {onglets.map((o) =>
        o.cle === "live" ? (
          <span key={o.cle} className="-mt-4 flex flex-col items-center gap-0.5">
            <span className={cn("grid h-9 w-9 place-items-center rounded-full ring-2 ring-white", actif === "live" ? "bg-direct text-white" : "bg-encre text-white")}>{o.icone}</span>
            <span className={cn("text-[8px] font-bold", actif === "live" ? "text-direct" : "text-texte-gris")}>{actif === "live" ? "En direct" : o.l}</span>
          </span>
        ) : (
          <span key={o.cle} className={cn("flex flex-col items-center gap-0.5", actif === o.cle ? "text-orange-fonce" : "text-texte-gris")}>
            {o.icone}
            <span className="text-[8px] font-bold">{o.l}</span>
          </span>
        ),
      )}
    </div>
  );
}

function IllustrationProchainCours({ titre, quand, debut, exemple, formateur }: { titre: string; quand: string; debut: string | null; exemple: boolean; formateur: string | null }) {
  return (
    <Ecran>
      <div className="flex flex-col gap-2.5 p-3">
        <span className="font-mono text-[9px] uppercase tracking-wider text-texte-gris">Aujourd'hui</span>
        <div className="relative overflow-hidden rounded-2xl bg-encre p-3.5 text-white">
          <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full border-[14px] border-orange opacity-90" />
          <span className="relative flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-orange-peche">
            <span className="point-direct" /> Prochain cours{exemple ? " · exemple" : ""}
          </span>
          <p className="relative mt-2 max-w-[190px] text-[15px] font-extrabold leading-tight">{titre}</p>
          <p className="relative mt-1 text-[10px] text-nuit-doux">
            {quand}
            {formateur ? ` · ${formateur}` : ""}
          </p>
          <div className="relative mt-3 flex items-center justify-between gap-2">
            <span className="rounded-lg bg-[#242120] px-2 py-1 font-mono text-[10px] tabular-nums">
              {debut ? (
                <>
                  dans <DecompteCourt cible={debut} />
                </>
              ) : (
                "dans 1 j 2 h 05 min"
              )}
            </span>
            <span className="rounded-lg bg-orange px-2.5 py-1 text-[10px] font-extrabold text-encre">Rejoindre</span>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {CAMPUS.map((c) => (
            <span key={c} className="flex flex-col items-center gap-1 rounded-lg bg-creme px-0.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange" />
              <span className="w-full truncate text-center text-[7px] font-bold">{c}</span>
            </span>
          ))}
        </div>
      </div>
      <BarreOnglets actif="live" />
    </Ecran>
  );
}

function IllustrationDevoir() {
  return (
    <Ecran>
      <div className="flex flex-col gap-2.5 p-3">
        <span className="font-mono text-[9px] uppercase tracking-wider text-texte-gris">Devoirs · À rendre</span>
        <div className="rounded-2xl border border-ligne p-3">
          <p className="text-[13px] font-extrabold leading-tight">Business plan d'un maquis</p>
          <p className="mt-0.5 text-[10px] text-texte-pale">À rendre jeudi avant 23h59</p>
          <div className="mt-2.5 grid h-16 place-items-center rounded-xl bg-creme">
            <span className="flex h-11 w-9 -rotate-6 flex-col gap-1 rounded-sm bg-white p-1.5 shadow">
              <span className="h-0.5 w-full bg-ligne-forte" />
              <span className="h-0.5 w-4/5 bg-ligne-forte" />
              <span className="h-0.5 w-full bg-ligne-forte" />
              <span className="h-0.5 w-3/5 bg-ligne-forte" />
            </span>
          </div>
          <span className="mt-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-orange py-2 text-[11px] font-extrabold text-encre">
            <Camera className="h-3.5 w-3.5" /> Rendre en photo
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-succes-clair px-2.5 py-2 text-succes">
          <CheckCheck className="h-4 w-4 shrink-0" />
          <span className="font-mono text-[9.5px] font-semibold">Rendu · reçu n° 2IAE-4F7K · 22h41</span>
        </div>
      </div>
      <BarreOnglets actif="devoirs" />
    </Ecran>
  );
}

function IllustrationMessages({ formateur }: { formateur?: boolean }) {
  const bulles = formateur
    ? [
        { moi: false, texte: "Monsieur, je n'ai pas compris l'exemple du maquis dans la leçon 2.", qui: "Étudiante · Yopougon" },
        { moi: true, texte: "Bonne question ! On le reprend en début de live mardi.", qui: "" },
      ]
    : [
        { moi: true, texte: "Bonjour, je n'ai pas compris l'exemple du maquis dans la leçon 2.", qui: "" },
        { moi: false, texte: "Bonne question ! On le reprend en début de live mardi.", qui: "Ton formateur" },
      ];
  return (
    <Ecran>
      <div className="flex items-center gap-2 border-b border-ligne-douce px-3 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-orange text-[10px] font-extrabold text-encre">IA</span>
        <span className="flex flex-col">
          <span className="text-[11px] font-extrabold leading-tight">Initiation à l'IA</span>
          <span className="font-mono text-[8px] text-texte-gris">Questions du cours</span>
        </span>
      </div>
      <div className="flex min-h-[176px] flex-col gap-2 bg-creme/60 p-3">
        {bulles.map((b, i) => (
          <div key={i} className={cn("flex max-w-[85%] flex-col gap-0.5", b.moi ? "self-end items-end" : "self-start")}>
            {b.qui && <span className="px-1 font-mono text-[8px] text-texte-gris">{b.qui}</span>}
            <span className={cn("rounded-2xl px-3 py-2 text-[11px] leading-snug", b.moi ? "rounded-br-md bg-orange text-encre" : "rounded-bl-md bg-white text-encre shadow-sm")}>{b.texte}</span>
            {b.moi && (
              <span className="flex items-center gap-1 px-1 font-mono text-[8px] text-texte-gris">
                10h42 <CheckCheck className="h-3 w-3 text-orange-fonce" />
              </span>
            )}
          </div>
        ))}
      </div>
      {!formateur && <BarreOnglets actif="messages" />}
    </Ecran>
  );
}

function IllustrationStudio({ titre, quand }: { titre: string; quand: string }) {
  return (
    <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-[24px] bg-nuit p-3.5 text-white shadow-telephone" aria-hidden>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 rounded-full bg-[#2A1510] px-2 py-1 font-mono text-[9px] uppercase text-[#FF8A6B]">
          <span className="point-direct" /> En direct
        </span>
        <span className="font-mono text-[9px] text-nuit-gris">{quand}</span>
      </div>
      <p className="mt-2.5 text-[14px] font-extrabold leading-tight">{titre}</p>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {CAMPUS.map((c, i) => (
          <span key={c} className={cn("flex flex-col items-center gap-1 rounded-lg px-0.5 py-2", i === 4 ? "bg-orange text-encre" : "bg-nuit-carte")}>
            {i === 4 ? <Hand className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-succes" />}
            <span className="w-full truncate text-center text-[7px] font-bold">{c}</span>
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <span className="rounded-lg bg-nuit-carte px-2.5 py-2 text-[10px]">
          <span className="font-mono text-orange-peche">▲ 14 · Yopougon</span> — Peut-on utiliser l'IA pour la comptabilité ?
        </span>
        <span className="rounded-lg bg-nuit-carte px-2.5 py-2 text-[10px]">
          <span className="font-mono text-orange-peche">▲ 9 · M'Batto</span> — Main levée de la salle
        </span>
      </div>
    </div>
  );
}

function IllustrationCorrections() {
  return (
    <div className="mx-auto flex w-full max-w-[320px] flex-col gap-2 rounded-[24px] border border-ligne bg-white p-3.5 shadow-carte" aria-hidden>
      <span className="font-mono text-[9px] uppercase tracking-wider text-texte-gris">Corrections</span>
      {[
        { t: "Business plan d'un maquis", n: "12 copies à corriger", ton: "bg-orange-clair text-orange-profond" },
        { t: "Quiz · Les modèles de langage", n: "Corrigé automatiquement", ton: "bg-succes-clair text-succes" },
      ].map((l) => (
        <div key={l.t} className="flex items-center justify-between gap-2 rounded-xl bg-creme px-3 py-2.5">
          <span className="text-[11px] font-extrabold leading-tight">{l.t}</span>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-mono text-[8px]", l.ton)}>{l.n}</span>
        </div>
      ))}
      <div className="rounded-xl border border-dashed border-orange p-2.5">
        <span className="flex items-center gap-1 font-mono text-[8px] uppercase text-orange-fonce">
          <Sparkles className="h-3 w-3" /> Proposé par l'IA
        </span>
        <p className="mt-1 text-[10px] leading-snug text-texte-doux">Plan clair, chiffrage des ventes à revoir. Note suggérée : 13/20.</p>
        <div className="mt-2 flex gap-1.5">
          <span className="rounded-lg bg-orange px-2 py-1 text-[9px] font-extrabold text-encre">Valider</span>
          <span className="rounded-lg border border-encre px-2 py-1 text-[9px] font-bold">Modifier</span>
        </div>
      </div>
    </div>
  );
}

function IllustrationPilotage() {
  return (
    <div className="mx-auto flex w-full max-w-[320px] flex-col gap-2 rounded-[24px] border border-ligne bg-white p-3.5 shadow-carte" aria-hidden>
      <div className="grid grid-cols-2 gap-2">
        {[
          { l: "Comptes activés", v: "84 %" },
          { l: "Présence au live", v: "76 %" },
        ].map((c) => (
          <div key={c.l} className="rounded-xl border border-ligne p-2.5">
            <span className="font-mono text-[8px] uppercase text-texte-gris">{c.l}</span>
            <p className="text-[22px] font-black tracking-serre">{c.v}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-creme p-2.5">
        <span className="font-mono text-[8px] uppercase text-orange-fonce">Qui décroche ?</span>
        {["Aucune connexion depuis 7 jours", "3 absences de suite", "2 devoirs non rendus"].map((t) => (
          <div key={t} className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5">
            <span className="flex items-center gap-1.5 text-[10px]">
              <Users className="h-3 w-3 text-texte-gris" />
              {t}
            </span>
            <span className="rounded-md bg-[#25D366] px-1.5 py-0.5 text-[8px] font-bold text-white">WhatsApp</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IllustrationFiche() {
  // Un faux QR (motif fixe) : juste pour montrer à quoi ressemble la fiche.
  const motif = "1110111010110101101001110111000101011101001011101110101101";
  return (
    <div className="mx-auto w-full max-w-[300px] rotate-[-2deg] rounded-2xl border border-dashed border-ligne-forte bg-white p-4 shadow-carte" aria-hidden>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-wider text-orange-fonce">Fiche de connexion</span>
        <QrCode className="h-4 w-4 text-texte-gris" />
      </div>
      <div className="mt-3 flex gap-3">
        <div className="grid h-24 w-24 shrink-0 grid-cols-8 gap-[2px] rounded-lg bg-white p-1.5 ring-1 ring-ligne">
          {Array.from({ length: 64 }, (_, i) => (
            <span key={i} className={motif[i % motif.length] === "1" ? "bg-encre" : "bg-transparent"} />
          ))}
        </div>
        <div className="flex flex-col justify-center gap-1">
          <span className="text-[13px] font-extrabold leading-tight">Yao Kouassi</span>
          <span className="font-mono text-[10px] text-texte-pale">Matricule 26GC0142</span>
          <span className="mt-1 font-mono text-[9px] uppercase text-texte-gris">Code provisoire</span>
          <span className="font-mono text-[18px] font-bold tracking-[0.2em]">71 58 20</span>
        </div>
      </div>
    </div>
  );
}

function IllustrationAnnonces() {
  return (
    <div className="mx-auto flex w-full max-w-[320px] flex-col gap-2 rounded-[24px] border border-ligne bg-white p-3.5 shadow-carte" aria-hidden>
      <span className="font-mono text-[9px] uppercase tracking-wider text-texte-gris">Présences · mardi</span>
      <div className="flex flex-col gap-1">
        {[
          { c: "Yopougon", v: 92 },
          { c: "Azaguié", v: 81 },
          { c: "M'Batto", v: 64 },
        ].map((l) => (
          <div key={l.c} className="flex items-center gap-2">
            <span className="w-16 text-[10px] font-bold">{l.c}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F3EAE2]">
              <span className="block h-full rounded-full bg-orange" style={{ width: `${l.v}%` }} />
            </span>
            <span className="w-7 text-right font-mono text-[9px]">{l.v} %</span>
          </div>
        ))}
      </div>
      <div className="mt-1 rounded-xl bg-creme p-2.5">
        <span className="flex items-center gap-1 font-mono text-[8px] uppercase text-orange-fonce">
          <Megaphone className="h-3 w-3" /> Annonce · Campus Yopougon
        </span>
        <p className="mt-1 text-[10px] leading-snug">Examen blanc samedi 9h en salle Kédjénou.</p>
        <span className="mt-1.5 block font-mono text-[8px] text-texte-gris">Lu par 212 étudiants sur 240</span>
      </div>
    </div>
  );
}
