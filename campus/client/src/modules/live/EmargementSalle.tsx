// Émargement sur l'écran de la salle de conférence (chantier C6) : l'écran
// prend l'émargement en charge TOUT SEUL, sans geste du chargé de cours.
//   - QR en grand, plein écran, au démarrage du direct, puis vers +15 et
//     +45 min, une minute à chaque fois (decisionEmargement, partagé) ;
//   - de nouveau à la demande du Studio (« Afficher l'émargement ») ;
//   - jamais pendant un sondage, ni quand la salle a la parole ou travaille en
//     groupes : le moment attend (10 min au plus) ;
//   - avec le compteur « 34 émargés à Riviera » et le classement des campus en
//     direct, pour l'émulation : en taux (part des attendus), sans numéro de
//     rang ni campus à 0 (décision D5 : jamais de dernier). Aucun nom d'étudiant.
// La visio et le son continuent dessous : la scène n'est jamais démontée.
// Aussi : le code d'émargement renouvelé chaque minute (useCodeSalle) et le
// mini-guide du chargé de cours affiché avant le cours.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, QrCode, Smartphone, Timer } from "lucide-react";
import { get } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCanal } from "@/lib/flux";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { t } from "@shared/textes/direct";
import {
  classementEmargement,
  decisionEmargement,
  PAUSE_APRES_SONDAGE_MS,
  type AfficherEmargementDto,
  type EmargementSalleDto,
  type MemoireEmargement,
} from "@shared/engagement/direct";
import type { CodeSalleDto, EtatDirectDto, SeanceDetailDto } from "@shared/schema";

// ── Code d'émargement renouvelé chaque minute ──────────────────────────────

export function useCodeSalle(seanceId: number, siteId: number | null, actif: boolean) {
  const [code, setCode] = useState<CodeSalleDto | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (!actif || !siteId) return;
    let minuterie: ReturnType<typeof setTimeout>;
    let fini = false;
    const charger = async () => {
      try {
        const c = await get<CodeSalleDto>(`/api/seances/${seanceId}/code-salle?site=${siteId}`);
        if (fini) return;
        setCode(c);
        setErreur(null);
        minuterie = setTimeout(charger, c.expireDansMs + 400);
      } catch (e) {
        if (fini) return;
        setErreur((e as Error).message);
        minuterie = setTimeout(charger, 20_000);
      }
    };
    void charger();
    return () => {
      fini = true;
      clearTimeout(minuterie);
    };
  }, [seanceId, siteId, actif]);
  return { code, erreur };
}

/** « campus.2iae.com/emargement » : l'adresse à taper, sans le code (il change chaque minute). */
export const cheminEmargement = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/emargement\/\d+$/, "/emargement");

// ── Mémoire de l'écran (survit au rechargement de la page) ──────────────────

const cleMemoire = (seanceId: number) => `campus:salle:emargement:${seanceId}`;

function lireMemoire(seanceId: number): MemoireEmargement {
  try {
    const brut = sessionStorage.getItem(cleMemoire(seanceId));
    const m = brut ? (JSON.parse(brut) as MemoireEmargement) : null;
    if (m && Array.isArray(m.servis)) return { servis: m.servis.filter((x) => typeof x === "string"), courant: m.courant && typeof m.courant.fin === "number" ? m.courant : null };
  } catch {
    /* stockage indisponible ou abîmé : on repart de zéro */
  }
  return { servis: [], courant: null };
}

function ecrireMemoire(seanceId: number, m: MemoireEmargement) {
  try {
    sessionStorage.setItem(cleMemoire(seanceId), JSON.stringify(m));
  } catch {
    /* navigateur sans stockage : la mémoire vaut pour la page ouverte */
  }
}

/**
 * Le QR doit-il être en grand maintenant ? Mémoire des moments servis, demande
 * du Studio (temps réel, ou relue au chargement), empêchements (sondage,
 * parole, groupes). Rappelé chaque seconde, à l'heure du serveur.
 */
function useFenetreEmargement(seance: SeanceDetailDto, etat: EtatDirectDto, siteId: number | null, enGroupe: boolean) {
  const enDirect = etat.statut === "en_direct";
  const { data: infos } = useQuery<EmargementSalleDto>({ queryKey: [`/api/seances/${seance.id}/emargement-salle`], enabled: enDirect, staleTime: 10 * 60_000 });
  const [demande, setDemande] = useState<number | null>(null);
  useEffect(() => {
    if (infos?.afficheJusqua) setDemande(new Date(infos.afficheJusqua).getTime());
  }, [infos?.afficheJusqua]);
  useCanal(`seance:${seance.id}`, (e) => {
    if (e.type !== "emargement:afficher") return;
    const d = e.data as AfficherEmargementDto;
    if (d?.seanceId === seance.id) setDemande(new Date(d.afficheJusqua).getTime());
  });
  const maintenant = useMaintenant(1000);
  const [memoire, setMemoire] = useState<MemoireEmargement>(() => lireMemoire(seance.id));
  const sondage = etat.sondage;
  const resultatsCommentes = Boolean(sondage && !sondage.ouvert && sondage.fermeLe && maintenant - new Date(sondage.fermeLe).getTime() < PAUSE_APRES_SONDAGE_MS);
  const aLaParole = etat.parole?.type === "salle" && etat.parole.siteId === siteId;
  const occupe = Boolean(sondage?.ouvert) || resultatsCommentes || aLaParole || enGroupe;
  const demarreeLe = etat.demarreeLe ?? seance.demarreeLe;
  useEffect(() => {
    if (!enDirect) return;
    const suivante = decisionEmargement(memoire, { maintenant, demarreeLe: demarreeLe ? new Date(demarreeLe).getTime() : null, occupe, demande });
    if (JSON.stringify(suivante) === JSON.stringify(memoire)) return;
    setMemoire(suivante);
    ecrireMemoire(seance.id, suivante);
  }, [enDirect, maintenant, demarreeLe, occupe, demande, memoire, seance.id]);
  return { fenetre: enDirect ? memoire.courant : null, maintenant, sitesDuCours: infos?.sitesDuCours ?? null, attendus: infos?.attendus ?? null };
}

// ── Le QR en grand ─────────────────────────────────────────────────────────

export function EmargementPleinEcran({ seance, etat, siteId, enGroupe }: { seance: SeanceDetailDto; etat: EtatDirectDto; siteId: number | null; enGroupe: boolean }) {
  const { fenetre, maintenant, sitesDuCours, attendus } = useFenetreEmargement(seance, etat, siteId, enGroupe);
  const visible = Boolean(fenetre && siteId);
  const { code } = useCodeSalle(seance.id, siteId, visible);
  // Le code d'une autre séance (minute précédente, rechargement) ne s'affiche jamais.
  const pret = visible && code !== null && code.siteId === siteId;
  const restantCode = 60 - Math.floor((maintenant / 1000) % 60);
  const restant = fenetre ? Math.max(0, Math.ceil((fenetre.fin - maintenant) / 1000)) : 0;
  const duree = useRef(60);
  useEffect(() => {
    // La durée totale se lit à l'ouverture de la fenêtre seulement (barre de retrait).
    if (fenetre) duree.current = Math.max(restant, 1);
  }, [fenetre?.cle]);
  // En taux, sans rang ni campus à 0 (shared/engagement/direct.ts).
  const liste = useMemo(() => classementEmargement(etat.campus, sitesDuCours, attendus), [etat.campus, sitesDuCours, attendus]);
  if (!pret || !fenetre || !code) return null;
  const ici = etat.campus.find((c) => c.siteId === siteId);
  const n = ici?.emarges ?? 0;
  return (
    <div
      className="animate-monte fixed inset-0 z-[70] flex flex-col gap-[2.2vh] overflow-y-auto bg-nuit px-5 py-5 text-white lg:overflow-hidden lg:px-[3.5vw] lg:py-[3.5vh]"
      role="dialog"
      aria-modal="false"
      aria-label={t("salle.qr.titre")}
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-3 font-mono text-[clamp(14px,1.25vw,24px)] uppercase tracking-[0.14em] text-orange-peche">
          <QrCode className="h-[1.4em] w-[1.4em]" /> {t("salle.qr.etiquette", { v: { salle: code.salle, site: code.site } })}
        </p>
        <p className="flex items-center gap-2 rounded-full bg-nuit-carte px-4 py-2 font-mono text-[clamp(13px,1.05vw,20px)] text-nuit-doux">
          <Timer className="h-[1.2em] w-[1.2em]" /> {t("salle.qr.retrait", { v: { n: restant } })}
        </p>
      </header>
      <main className="flex min-h-0 flex-1 flex-col items-center gap-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-[4vw]">
        <div
          className="aspect-square w-full max-w-[520px] shrink-0 rounded-[24px] bg-white p-3 lg:h-[min(68vh,44vw)] lg:w-auto lg:max-w-none lg:rounded-[3vh] lg:p-[1.6vh] [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: code.qrSvg }}
          aria-label={`QR d'émargement, code ${code.code}`}
          role="img"
        />
        <div className="flex w-full min-w-0 flex-col gap-[2.6vh]">
          <h1 className="flex items-start gap-[0.4em] text-[clamp(34px,4.3vw,92px)] font-black leading-[0.95] tracking-serre">
            <Smartphone className="mt-[0.08em] h-[0.9em] w-[0.9em] shrink-0 text-orange" /> {t("salle.qr.titre")}
          </h1>
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[clamp(14px,1.3vw,26px)] text-nuit-doux">
              {t("salle.qr.code")} · <span className="text-white">{cheminEmargement(code.url)}</span>
            </p>
            <p className="font-black leading-none tabular-nums tracking-[0.1em] text-[clamp(64px,8.2vw,176px)]" aria-live="polite" aria-label={`Code ${code.code.split("").join(" ")}`}>
              {code.code}
            </p>
            <div className="h-[0.9vh] min-h-1.5 max-w-[34vw] overflow-hidden rounded-full bg-nuit-ligne" aria-hidden>
              <div className="h-full rounded-full bg-orange transition-[width] duration-1000 ease-linear" style={{ width: `${(restantCode / 60) * 100}%` }} />
            </div>
            <p className="text-[clamp(14px,1.2vw,24px)] text-nuit-gris">{t("salle.qr.change")}</p>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-[0.5em] rounded-[2.4vh] bg-nuit-panneau px-[1.6vw] py-[1.6vh]" aria-live="polite">
            {n > 0 ? (
              <>
                <span className="flex items-center gap-[0.25em] text-[clamp(56px,6.2vw,132px)] font-black leading-none tabular-nums text-orange">
                  <CheckCircle2 className="h-[0.6em] w-[0.6em]" /> {n}
                </span>
                <span className="text-[clamp(24px,2.5vw,52px)] font-extrabold leading-tight">{t(n > 1 ? "salle.qr.emarges" : "salle.qr.emarges.un", { v: { site: code.site } })}</span>
              </>
            ) : (
              <span className="text-[clamp(24px,2.5vw,52px)] font-extrabold leading-tight">{t("salle.qr.emarges.zero", { v: { site: code.site } })}</span>
            )}
          </div>
          {liste.length > 1 && (
            <div className="flex flex-col gap-[1.2vh]">
              <p className="font-mono text-[clamp(12px,1.05vw,20px)] uppercase tracking-[0.14em] text-nuit-gris">{t("salle.qr.classement")}</p>
              <ul className="flex flex-wrap gap-[0.8vw]">
                {liste.map((c) => (
                  <li
                    key={c.siteId}
                    className={cn(
                      "flex items-baseline gap-[0.45em] rounded-full px-[1.1vw] py-[0.7vh] text-[clamp(18px,1.75vw,36px)] font-extrabold",
                      c.siteId === siteId ? "bg-orange text-encre" : "bg-nuit-carte text-white",
                    )}
                  >
                    {c.nomCourt}
                    <span className="tabular-nums">{c.taux === null ? c.emarges : t("salle.qr.taux", { v: { n: c.taux } })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
      <div className="h-1.5 overflow-hidden rounded-full bg-nuit-ligne" aria-hidden>
        <div className="h-full rounded-full bg-orange-peche transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (restant / duree.current) * 100)}%` }} />
      </div>
    </div>
  );
}

// ── Mini-guide du chargé de cours (écran de salle, avant le cours) ──────────

export function GuideChargeDeCours({ className }: { className?: string }) {
  const etapes = [t("guide.ouvert"), t("guide.scanner"), t("guide.moments")];
  return (
    <section className={cn("rounded-[24px] border border-nuit-ligne bg-nuit-panneau px-5 py-4", className)} aria-label={`${t("guide.etiquette")} : ${t("guide.titre")}`}>
      <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-orange-peche">{t("guide.etiquette")}</p>
      <p className="mt-1 text-[clamp(18px,1.4vw,26px)] font-black leading-tight">{t("guide.titre")}</p>
      <ol className="mt-2 flex flex-col gap-1.5">
        {etapes.map((e, i) => (
          <li key={i} className="flex items-baseline gap-2.5 text-[clamp(14px,1vw,19px)] leading-snug text-nuit-doux">
            <span className="font-mono text-orange-peche">{i + 1}</span>
            {e}
          </li>
        ))}
      </ol>
    </section>
  );
}
