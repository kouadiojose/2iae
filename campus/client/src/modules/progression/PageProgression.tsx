// /progression — « Ma progression » de l'étudiant (chantier C5), visible de lui
// seul : l'objectif de la semaine (2, 3 ou 5 jours) et ses 7 pastilles, les
// semaines réussies d'affilée et le joker du mois, les points de la semaine
// et ce qui les a rapportés, les badges et le prochain, sa contribution à sa
// classe dans la Coupe. Jamais de classement d'étudiants.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { CalendarCheck, ChevronRight, Shield, ShieldCheck, Trophy } from "lucide-react";
import { put } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { Page } from "@/components/layout/coquille";
import { Carte } from "@/components/ui/carte";
import { BarreProgression, Erreur, Squelette } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { t } from "@shared/textes/progression";
import { BADGES, OBJECTIFS_SEMAINE, type CompteurBadge, type ObjectifSemaine, type ProgressionMoi } from "@shared/engagement/progression";
import { CLE_PROGRESSION, useProgression } from "./donnees";
import { Anneau, IconeBadge, JoursSemaine } from "./Pastilles";
import { NouveauBadge } from "./NouveauBadge";

type Tx = typeof t;

export default function PageProgression() {
  const tx = useTextes(t);
  const { data, error, refetch } = useProgression({ toujours: true });
  if (error && !data) {
    return (
      <Page>
        <Erreur message={tx("prog.erreur")} reessayer={() => void refetch()} />
      </Page>
    );
  }
  if (!data) {
    return (
      <Page>
        <Squelette className="h-10 w-2/3" />
        <Squelette className="h-48" />
        <Squelette className="h-40" />
      </Page>
    );
  }
  return (
    <Page className="max-w-[1100px] gap-6">
      <header className="flex flex-col gap-1.5">
        <span className="etiquette">{tx("coupe.semaine", { v: { n: data.semaine.numero } })}</span>
        <h1 className="titre-page">{tx("prog.titre")}</h1>
        <p className="text-[15px] text-texte-pale">{tx("prog.intro")}</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <MaSemaine data={data} tx={tx} />
          <MaSerie data={data} tx={tx} />
          <MaContribution data={data} tx={tx} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <MesPoints data={data} tx={tx} />
          <MesBadges data={data} tx={tx} />
          <Bareme data={data} tx={tx} />
        </div>
      </div>
      <NouveauBadge badges={data.badges.obtenus} />
    </Page>
  );
}

function MaSemaine({ data, tx }: { data: ProgressionMoi; tx: Tx }) {
  const n = data.semaine.joursActifs.length;
  const objectif = data.semaine.objectif;
  const reste = Math.max(0, objectif - n);
  const [choisi, setChoisi] = useState<ObjectifSemaine>(objectif);
  const changer = useMutation({
    mutationFn: (jours: ObjectifSemaine) => put<{ jours: number }>("/api/progression/objectif", { jours }),
    onSuccess: (r) => {
      queryClient.setQueryData<ProgressionMoi>([CLE_PROGRESSION], (d) => d && { ...d, semaine: { ...d.semaine, objectif: r.jours as ObjectifSemaine } });
      toast(tx("prog.objectif.enregistre", { v: { n: r.jours } }));
    },
    onError: (e) => {
      setChoisi(objectif);
      toastErreur(e);
    },
  });
  return (
    <Carte className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="relative grid place-items-center">
          <Anneau valeur={n} total={objectif} taille={76} epaisseur={8} />
          <span className="absolute font-mono text-lg font-bold tabular-nums">
            {n}/{objectif}
          </span>
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-extrabold">{tx("prog.semaine.titre")}</h2>
          <p className="font-bold">{tx("prog.semaine.compte", { v: { n, objectif } })}</p>
          <p className="text-[15px] text-texte-pale">
            {reste === 0 ? tx("prog.semaine.atteint") : reste === 1 ? tx("prog.semaine.reste1") : tx("prog.semaine.reste", { v: { n: reste } })}
          </p>
        </div>
      </div>
      <JoursSemaine
        lundi={data.semaine.lundi}
        joursActifs={data.semaine.joursActifs}
        aujourdhui={data.semaine.aujourdhui}
        initiales={tx("prog.jours")}
        libelleAujourdhui={tx("prog.semaine.aujourdhui")}
      />
      <p className="text-sm text-texte-pale">{tx("prog.semaine.aide")}</p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-mono text-xs uppercase tracking-wider text-texte-gris">{tx("prog.objectif.titre")}</legend>
        <div className="grid grid-cols-3 gap-1.5 rounded-[14px] bg-creme p-1.5">
          {OBJECTIFS_SEMAINE.map((j) => (
            <button
              key={j}
              type="button"
              aria-pressed={choisi === j}
              disabled={changer.isPending}
              onClick={() => {
                if (j === choisi) return;
                setChoisi(j);
                changer.mutate(j);
              }}
              className={cn("min-h-11 rounded-[10px] px-2 text-[15px] font-bold transition-colors", choisi === j ? "bg-encre text-white" : "text-texte-doux hover:bg-white")}
            >
              {tx("prog.objectif.option", { v: { n: j } })}
            </button>
          ))}
        </div>
      </fieldset>
    </Carte>
  );
}

function MaSerie({ data, tx }: { data: ProgressionMoi; tx: Tx }) {
  const s = data.serie;
  return (
    <Carte className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-orange-clair text-orange-profond">
          <CalendarCheck className="h-7 w-7" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-4xl font-black tabular-nums leading-none">{s.actuelle}</span>
          <span className="text-[15px] font-bold">{tx("prog.serie.titre")}</span>
        </div>
        <span className="ml-auto self-start rounded-full bg-creme px-2.5 py-1 font-mono text-xs text-texte-pale">{tx("prog.serie.record", { v: { n: s.record } })}</span>
      </div>
      {s.derniere && <p className="text-[15px] text-texte-doux">{tx(`prog.serie.derniere.${s.derniere}`)}</p>}
      {s.bilanEnAttente && <p className="text-[15px] text-texte-doux">{tx("prog.serie.attente")}</p>}
      <p className="flex items-start gap-2 text-sm text-texte-pale">
        {s.jokerDisponible ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-succes" aria-hidden /> : <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
        {s.jokerDisponible ? tx("prog.serie.joker.libre") : tx("prog.serie.joker.pris")}
      </p>
    </Carte>
  );
}

function MesPoints({ data, tx }: { data: ProgressionMoi; tx: Tx }) {
  const p = data.points;
  return (
    <Carte className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-extrabold">{tx("prog.points.titre")}</h2>
        <span className="font-mono text-xs text-texte-gris">{tx("prog.points.total", { v: { n: p.total } })}</span>
      </div>
      <p className="flex items-baseline gap-2">
        <span className="text-5xl font-black tabular-nums tracking-serre">{p.semaine}</span>
        <span className="text-[15px] text-texte-pale">{tx("prog.points.semaine")}</span>
      </p>
      {p.detail.length ? (
        <ul className="flex flex-col divide-y divide-ligne-douce">
          {p.detail.map((l) => (
            <li key={`${l.famille}|${l.cours ?? ""}`} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="font-bold">{tx(`famille.${l.famille}`)}</span>
                {l.cours && <span className="text-texte-pale"> · {l.cours}</span>}
                {l.actes > 1 && <span className="ml-1.5 font-mono text-xs text-texte-gris">{tx("prog.points.fois", { v: { n: l.actes } })}</span>}
              </span>
              <span className="shrink-0 font-mono font-bold text-succes">+{l.points}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-creme px-4 py-3 text-[15px] text-texte-doux">{tx("prog.points.vide")}</p>
      )}
    </Carte>
  );
}

function MesBadges({ data, tx }: { data: ProgressionMoi; tx: Tx }) {
  const obtenus = new Set(data.badges.obtenus.map((b) => b.code));
  const disponibles = BADGES.filter((b) => data.badges.disponibles.includes(b.code));
  const aVenir = disponibles.filter((b) => !obtenus.has(b.code) && b.code !== data.badges.prochain?.code);
  const prochain = data.badges.prochain;
  const def = prochain && BADGES.find((b) => b.code === prochain.code);
  return (
    <Carte className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-extrabold">{tx("prog.badges.titre")}</h2>
        <span className="font-mono text-xs text-texte-gris">{tx("prog.badges.compte", { v: { n: obtenus.size, total: disponibles.length } })}</span>
      </div>
      {obtenus.size ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {data.badges.obtenus.map((b) => (
            <li key={b.code} className="flex flex-col items-center gap-1.5 text-center">
              <IconeBadge code={b.code} />
              <span className="text-[13px] font-bold leading-tight">{tx(`badge.${b.code}.nom`)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-texte-pale">{tx("prog.badges.vide")}</p>
      )}
      {prochain && def && (
        <div className="flex items-center gap-3 rounded-xl bg-creme p-3">
          <IconeBadge code={prochain.code} obtenu={false} taille={44} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-texte-gris">{tx("prog.badges.prochain")}</span>
            <span className="text-[15px] font-bold leading-snug">
              {tx("badge.reste", { v: { n: prochain.seuil - prochain.compteur, unite: unite(tx, def.compteur, prochain.seuil - prochain.compteur), nom: tx(`badge.${prochain.code}.nom`) } })}
            </span>
            <BarreProgression valeur={(prochain.compteur / prochain.seuil) * 100} />
          </div>
        </div>
      )}
      {aVenir.length > 0 && (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[15px] font-bold text-texte-doux">
            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" aria-hidden />
            {tx("prog.badges.aVenir")} ({aVenir.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2.5">
            {aVenir.map((b) => (
              <li key={b.code} className="flex items-center gap-3">
                <IconeBadge code={b.code} obtenu={false} taille={36} />
                <span className="min-w-0 text-sm">
                  <span className="font-bold">{tx(`badge.${b.code}.nom`)}</span>
                  <span className="text-texte-pale"> · {tx(`badge.${b.code}.desc`)}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Carte>
  );
}

/** « direct » ou « directs », selon le nombre. */
const unite = (tx: Tx, compteur: CompteurBadge, n: number) => tx(`unite.${compteur}.${n > 1 ? "n" : "1"}`);

function MaContribution({ data, tx }: { data: ProgressionMoi; tx: Tx }) {
  const c = data.contribution;
  const texte = c.compte
    ? c.classe
      ? tx("prog.classe.compte", { v: { classe: c.classe } })
      : tx("prog.classe.compteCampus")
    : c.familles === 1
      ? tx("prog.classe.reste1")
      : tx("prog.classe.reste2");
  return (
    <Carte className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", c.compte ? "bg-succes-clair text-succes" : "bg-creme text-texte-pale")}>
          <Trophy className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="text-lg font-extrabold">{tx("prog.classe.titre")}</h2>
      </div>
      <p className="text-[15px] text-texte-doux">{texte}</p>
      <Link href="/coupe" className="flex min-h-11 items-center gap-1.5 self-start font-bold text-orange-fonce">
        {tx("prog.classe.lien")} <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </Carte>
  );
}

function Bareme({ data, tx }: { data: ProgressionMoi; tx: Tx }) {
  const p = data.bareme.points;
  const pl = data.bareme.plafonds;
  const lignes = [
    tx("prog.bareme.presence", { v: { n: p.presence, m: p.presence_seuil } }),
    tx("prog.bareme.devoir", { v: { n: p.devoir, m: p.devoir_retard } }),
    tx("prog.bareme.quiz", { v: { n: p.quiz, m: p.quiz_reussi } }),
    tx("prog.bareme.revision", { v: { n: p.revision, m: p.revision * pl.revisionsParJour } }),
    tx("prog.bareme.entrainement", { v: { n: p.entrainement } }),
    tx("prog.bareme.objectif", { v: { n: p.objectif } }),
    tx("prog.bareme.lecon", { v: { n: p.lecon, m: pl.leconsParJour } }),
    tx("prog.bareme.direct", { v: { q: p.question, v: p.question_votee, s: p.sondage, r: p.ressenti } }),
    tx("prog.bareme.replay", { v: { n: p.replay } }),
  ];
  return (
    <details className="group rounded-2xl border border-ligne bg-white p-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-lg font-extrabold">
        <ChevronRight className="h-5 w-5 transition-transform group-open:rotate-90" aria-hidden />
        {tx("prog.bareme.titre")}
      </summary>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[15px] text-texte-doux">
        {lignes.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p className="mt-3 rounded-xl bg-creme px-4 py-3 text-sm text-texte-doux">{tx("prog.bareme.jamais")}</p>
    </details>
  );
}
