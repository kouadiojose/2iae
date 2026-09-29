// /invite/:jeton : suivre UNE séance sans compte ni identifiant (lien invité
// partagé par le formateur ou l'équipe). L'invité donne son nom, puis suit en
// son + diapos (léger, ≈ 12 à 15 Mo/h) ou en vidéo. Il ne pose pas de question
// et n'émarge pas : pour cela, il faut se connecter avec son compte. La diapo
// suit par une relecture toutes les 2 secondes (pas de temps réel sans compte).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2Off, MonitorPlay, Radio, UserRound } from "lucide-react";
import type { AccesDaily, InfoInviteDto } from "@shared/schema";
import { post, ErreurApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { heure, jourLong } from "@/lib/dates";
import { Bouton } from "@/components/ui/bouton";
import { CadreDaily, LecteurRadio } from "@/modules/visio";

type Mode = "radio" | "video";
const CLE_NOM = "campus:invite-nom";

const lireNom = () => {
  try {
    return window.localStorage.getItem(CLE_NOM) ?? "";
  } catch {
    return "";
  }
};

export default function PageInvite({ jeton }: { jeton: string }) {
  const racine = `/api/invite/${encodeURIComponent(jeton)}`;
  const { data: info, error, isLoading } = useQuery<InfoInviteDto>({ queryKey: [racine], refetchInterval: 2000, retry: 1 });
  const [nom, setNom] = useState(lireNom);
  const [mode, setMode] = useState<Mode>("radio");
  const [entre, setEntre] = useState<Mode | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const entrer = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const n = nom.trim();
    if (n.length < 2) return setErreur("Indiquez votre nom : le formateur saura qui suit le cours.");
    setEnvoi(true);
    setErreur(null);
    try {
      await post(`${racine}/entrer`, { nom: n, mode });
      try {
        window.localStorage.setItem(CLE_NOM, n);
      } catch {
        /* stockage indisponible */
      }
      setEntre(mode);
    } catch (x) {
      setErreur(x instanceof ErreurApi ? x.message : "Le campus ne répond pas. Vérifiez la connexion internet, puis réessayez.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-nuit text-white">
      <header className="flex items-center justify-between gap-3 border-b border-nuit-ligne px-4 py-3 sm:px-6">
        <img src="/marque-2iae-detouree.png" alt="Groupe Écoles 2IAE International" className="h-10 w-auto" />
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-orange-peche">Campus numérique · lien invité</span>
      </header>

      <main className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
        {isLoading ? (
          <p className="text-nuit-doux">Chargement du cours…</p>
        ) : error || !info ? (
          <Fin titre="Ce lien n'existe pas." texte="Vérifiez qu'il est complet, ou demandez le bon lien à votre formateur ou à la vie scolaire." />
        ) : (
          <>
            <EnTete info={info} />
            {!info.valide ? (
              <Fin
                titre={info.statut === "annulee" ? "Ce cours a été annulé." : "Ce cours est terminé."}
                texte="Ce lien ne valait que pour ce cours. Le replay est dans votre espace, avec votre compte."
              />
            ) : !entre ? (
              <form onSubmit={entrer} className="flex flex-col gap-4 rounded-3xl bg-nuit-carte p-5 sm:p-6">
                <label className="flex flex-col gap-2">
                  <span className="text-[15px] font-bold">Votre nom</span>
                  <input
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    autoComplete="name"
                    maxLength={60}
                    placeholder="Prénom et nom"
                    className="min-h-[52px] rounded-xl border border-nuit-ligne bg-nuit px-4 text-lg text-white placeholder:text-nuit-gris focus:border-orange focus:outline-none"
                  />
                  <span className="text-[13px] text-nuit-doux">Pas de compte ni de mot de passe : votre nom suffit, pour que le formateur sache qui suit.</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChoixMode actif={mode === "radio"} onClick={() => setMode("radio")} icone={<Radio className="h-5 w-5" />} titre="Son + diapos" detail="≈ 12 à 15 Mo par heure · recommandé en 3G/4G" />
                  {info.video && (
                    <ChoixMode actif={mode === "video"} onClick={() => setMode("video")} icone={<MonitorPlay className="h-5 w-5" />} titre="Vidéo" detail="150 à 250 Mo par heure · au Wi-Fi" />
                  )}
                </div>
                {erreur && (
                  <p className="rounded-xl bg-danger/20 px-4 py-3 text-[15px] font-semibold text-white" role="alert">
                    {erreur}
                  </p>
                )}
                <Bouton type="submit" taille="lg" pleineLargeur chargement={envoi} className="min-h-[56px] text-[17px]">
                  Entrer dans le cours
                </Bouton>
              </form>
            ) : (
              <Suivi info={info} racine={racine} mode={entre} nom={nom.trim()} onChanger={() => setEntre(null)} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function EnTete({ info }: { info: InfoInviteDto }) {
  const enDirect = info.statut === "en_direct";
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs text-nuit-doux">
        {info.cours}
        {info.formateur ? ` · ${info.formateur}` : ""}
      </p>
      <h1 className="font-titre text-[32px] font-semibold leading-tight sm:text-[40px]">{info.titre}</h1>
      <span
        className={cn(
          "self-start rounded-full px-3 py-1 font-mono text-xs",
          enDirect ? "bg-direct text-white" : "bg-nuit-carte text-orange-peche",
        )}
      >
        {enDirect ? "● EN DIRECT" : info.statut === "planifiee" ? `${jourLong(info.debut)} · ${heure(info.debut)} (heure d'Abidjan)` : "Terminé"}
      </span>
    </div>
  );
}

function ChoixMode({ actif, onClick, icone, titre, detail }: { actif: boolean; onClick: () => void; icone: React.ReactNode; titre: string; detail: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
        actif ? "border-orange bg-orange/10" : "border-nuit-ligne hover:border-nuit-gris",
      )}
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", actif ? "bg-orange text-encre" : "bg-nuit-ligne text-orange-peche")}>{icone}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[16px] font-bold">{titre}</span>
        <span className="font-mono text-[12px] text-nuit-doux">{detail}</span>
      </span>
    </button>
  );
}

function Suivi({ info, racine, mode, nom, onChanger }: { info: InfoInviteDto; racine: string; mode: Mode; nom: string; onChanger: () => void }) {
  const avant = info.statut === "planifiee";
  return (
    <div className="flex flex-col gap-4">
      {avant && (
        <p className="rounded-2xl bg-nuit-carte px-4 py-3 text-[15px] text-nuit-doux">
          Le cours commence à <strong className="text-white">{heure(info.debut)}</strong> (heure d'Abidjan). Restez sur cette page : il s'affichera tout seul.
        </p>
      )}
      {mode === "video" && !avant && (
        <div className="aspect-video overflow-hidden rounded-[22px] border-2 border-nuit-ligne bg-nuit-carte">
          <CadreDaily
            obtenirAcces={() => post<AccesDaily>(`${racine}/visio`, { nom })}
            role="etudiant"
            tu={false}
            cameraAuDepart={false}
            microAuDepart={false}
            relanceAuto
            className="h-full w-full"
          />
        </div>
      )}
      <div className="overflow-hidden rounded-[22px] border-2 border-nuit-ligne bg-nuit-carte">
        {mode === "video" && <p className="border-b border-nuit-ligne px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-nuit-doux">La diapo en cours</p>}
        <div className="relative aspect-video">
          {info.diapo.url ? (
            <img src={info.diapo.url} alt={`Diapo ${info.diapo.index + 1} sur ${info.diapo.total}`} className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full place-items-center px-6 text-center text-nuit-doux">
              <span className="flex flex-col items-center gap-2">
                <UserRound className="h-10 w-10 text-orange-peche" />
                {info.formateur ?? "Le formateur"}
                <span className="font-mono text-xs">Les diapos s'afficheront ici</span>
              </span>
            </div>
          )}
          {info.diapo.url && info.diapo.total > 0 && (
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[11px]">
              {info.diapo.index + 1} / {info.diapo.total}
            </span>
          )}
        </div>
        {info.sousTitre && <p className="border-t border-nuit-ligne px-4 py-3 text-center text-[15px] font-semibold leading-snug">{info.sousTitre}</p>}
        {mode === "radio" && (
          <div className="border-t border-nuit-ligne bg-nuit-panneau px-3 py-2">
            <LecteurRadio seanceId={info.seanceId} base={`${racine}/radio`} nuit />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-[14px] text-nuit-doux">
        <span>
          Vous suivez en invité, sous le nom <strong className="text-white">{nom}</strong>. Pour poser vos questions et être compté présent, connectez-vous avec votre compte.
        </span>
        <div className="flex gap-2">
          <Bouton variante="nuit" taille="sm" onClick={onChanger}>
            Changer de mode
          </Bouton>
          <a href="/connexion" className="inline-flex items-center rounded-[10px] bg-orange px-3 py-2 text-[13px] font-bold text-encre no-underline hover:bg-orange-peche">
            Me connecter
          </a>
        </div>
      </div>
    </div>
  );
}

function Fin({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-3xl bg-nuit-carte p-6">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-nuit-ligne text-orange-peche">
        <Link2Off className="h-6 w-6" />
      </span>
      <h1 className="text-[28px] font-black leading-tight">{titre}</h1>
      <p className="text-[15px] leading-relaxed text-nuit-doux">{texte}</p>
    </div>
  );
}
