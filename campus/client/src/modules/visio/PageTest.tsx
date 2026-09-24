// Page /visio/test/:seanceId : banc d'essai de la visio intégrée et de la radio,
// en attendant (puis à côté de) la salle live du module live.
//
// En développement : tout compte connecté (tests automatisés avec un
// formateur, une salle et des étudiants). En production : réservée à
// l'équipe (voir routes.tsx), pour vérifier une séance avant le cours.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, CameraOff, Mic, MicOff, Radio, Hand } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { cn, taille } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import type { PairsVisio } from "@shared/schema";
import { SceneVisioCampus, type EtatVisio } from "./SceneVisioCampus";
import { EmetteurRadio } from "./EmetteurRadio";
import { LecteurRadio } from "./LecteurRadio";

type RoleEssai = "formateur" | "salle" | "etudiant";

const LIBELLES_ETAT: Record<EtatVisio, string> = {
  connexion: "connexion",
  connecte: "connecté",
  reconnexion: "reconnexion",
  echec: "échec",
  ferme: "fermé",
};

export default function PageTest({ seanceId }: { seanceId: string }) {
  const moi = useMoiConnecte();
  const id = Number(seanceId);
  const roleDuCompte: RoleEssai = moi.role === "formateur" || moi.role === "admin" ? "formateur" : moi.role === "salle" ? "salle" : "etudiant";
  const [role, setRole] = useState<RoleEssai>(roleDuCompte);
  const [micro, setMicro] = useState(roleDuCompte !== "etudiant");
  const [camera, setCamera] = useState(roleDuCompte !== "etudiant");
  const [audioSeul, setAudioSeul] = useState(false);
  const [siteParole, setSiteParole] = useState<number | null>(null);
  const [etudiantParole, setEtudiantParole] = useState<number | null>(null);
  const [jaiLaParole, setJaiLaParole] = useState(false);
  const [etat, setEtat] = useState<EtatVisio>("connexion");
  const [flux, setFlux] = useState<MediaStream | null>(null);
  const [radio, setRadio] = useState(false);
  const [consommation, setConsommation] = useState(0);

  const { data: pairs } = useQuery<PairsVisio>({
    queryKey: ["/api/visio", id, "pairs"],
    enabled: role === "formateur",
    refetchInterval: 4000,
  });

  if (!Number.isInteger(id) || id <= 0) return <p className="p-6">Séance invalide.</p>;
  const etudiants = (pairs?.participants ?? []).filter((p) => p.role === "etudiant");

  return (
    <div className="min-h-[calc(100dvh-64px)] bg-nuit px-3 py-4 text-white sm:px-6 sm:py-6">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-nuit-gris">Banc d'essai · visio intégrée · séance {id}</span>
            <h1 className="text-2xl font-extrabold sm:text-[28px]">Classe en visio (essai)</h1>
          </div>
          <span className="rounded-full bg-nuit-carte px-3 py-1.5 font-mono text-xs text-nuit-doux" data-testid="etat-visio" data-etat={etat}>
            {role} · {LIBELLES_ETAT[etat]}
          </span>
        </div>

        {(moi.role === "admin" || moi.role === "vie_scolaire") && (
          <div className="flex flex-wrap gap-2">
            {(["formateur", "etudiant"] as const)
              .filter((r) => r !== "formateur" || moi.role === "admin")
              .map((r) => (
                <Bouton key={r} taille="sm" variante={role === r ? "nuit-actif" : "nuit"} onClick={() => setRole(r)} className="min-h-[44px]">
                  Rôle : {r}
                </Bouton>
              ))}
          </div>
        )}

        <SceneVisioCampus
          key={role}
          seanceId={id}
          role={role}
          siteId={moi.siteId}
          nomAffiche={`${moi.prenom} ${moi.nom}`}
          micro={role === "etudiant" ? micro && jaiLaParole : micro}
          camera={camera}
          audioSeul={audioSeul}
          siteALaParole={siteParole}
          utilisateurALaParole={role === "etudiant" ? (jaiLaParole ? moi.id : null) : etudiantParole}
          onEtat={setEtat}
          onFluxLocal={setFlux}
          className={role === "formateur" ? "" : "max-h-[70dvh]"}
        />

        <div className="flex flex-wrap gap-2">
          {role !== "etudiant" && (
            <>
              <Bouton variante={micro ? "nuit-actif" : "nuit"} icone={micro ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />} onClick={() => setMicro(!micro)} data-testid="bouton-micro" className="min-h-[48px]">
                {micro ? "Micro ouvert" : "Micro coupé"}
              </Bouton>
              <Bouton variante={camera ? "nuit-actif" : "nuit"} icone={camera ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />} onClick={() => setCamera(!camera)} data-testid="bouton-camera" className="min-h-[48px]">
                {camera ? "Caméra allumée" : "Caméra coupée"}
              </Bouton>
            </>
          )}
          {role === "etudiant" && (
            <>
              <Bouton
                variante={jaiLaParole ? "nuit-actif" : "nuit"}
                icone={<Hand className="h-4 w-4" />}
                onClick={() => {
                  setJaiLaParole(!jaiLaParole);
                  setMicro(!jaiLaParole);
                }}
                data-testid="bouton-parole"
                className="min-h-[48px]"
              >
                {jaiLaParole ? "J'ai la parole (micro ouvert)" : "Simuler : on me donne la parole"}
              </Bouton>
              <Bouton variante={audioSeul ? "nuit-actif" : "nuit"} onClick={() => setAudioSeul(!audioSeul)} data-testid="bouton-audio-seul" className="min-h-[48px]">
                {audioSeul ? "Son seul" : "Vidéo et son"}
              </Bouton>
            </>
          )}
        </div>

        {role === "formateur" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-2xl bg-nuit-panneau p-4">
              <span className="font-mono text-xs text-nuit-gris">Donner la parole à une salle</span>
              <div className="flex flex-wrap gap-2">
                <Bouton taille="sm" variante={siteParole === null ? "nuit-actif" : "nuit"} onClick={() => setSiteParole(null)} data-testid="parole-salle-aucune" className="min-h-[44px]">
                  Personne
                </Bouton>
                {(pairs?.sites ?? []).map((s) => (
                  <Bouton key={s.id} taille="sm" variante={siteParole === s.id ? "nuit-actif" : "nuit"} onClick={() => setSiteParole(s.id)} data-testid={`parole-salle-${s.id}`} className="min-h-[44px]">
                    {s.nomCourt}
                  </Bouton>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl bg-nuit-panneau p-4">
              <span className="font-mono text-xs text-nuit-gris">Donner la parole à un étudiant en ligne</span>
              <div className="flex flex-wrap gap-2">
                <Bouton taille="sm" variante={etudiantParole === null ? "nuit-actif" : "nuit"} onClick={() => setEtudiantParole(null)} data-testid="parole-etudiant-aucun" className="min-h-[44px]">
                  Personne
                </Bouton>
                {etudiants.map((p) => (
                  <Bouton
                    key={p.pairId}
                    taille="sm"
                    variante={etudiantParole === p.utilisateurId ? "nuit-actif" : "nuit"}
                    onClick={() => setEtudiantParole(p.utilisateurId)}
                    data-testid={`parole-etudiant-${p.utilisateurId}`}
                    className="min-h-[44px]"
                  >
                    {p.nom}
                  </Bouton>
                ))}
                {!etudiants.length && <span className="text-sm text-nuit-doux">Aucun étudiant en ligne pour l'instant.</span>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-nuit-panneau p-4 sm:col-span-2">
              <Bouton variante={radio ? "nuit-actif" : "nuit"} icone={<Radio className="h-4 w-4" />} onClick={() => setRadio(!radio)} data-testid="bouton-radio" className="min-h-[48px]">
                {radio ? "Arrêter la radio" : "Émettre la radio"}
              </Bouton>
              <EmetteurRadio seanceId={id} flux={flux} actif={radio} />
              {pairs && (
                <span className="font-mono text-xs text-nuit-gris">
                  Places vidéo : {pairs.places.videoPrises}/{pairs.places.video} · en ligne : {pairs.places.prises}/{pairs.places.total}
                </span>
              )}
            </div>
          </div>
        )}

        {role !== "formateur" && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs text-nuit-gris">Radio du cours</span>
            <LecteurRadio seanceId={id} nuit onConsommation={setConsommation} />
            <span className={cn("font-mono text-xs text-nuit-gris", !consommation && "hidden")} data-testid="consommation" data-octets={consommation}>
              Consommation estimée : {taille(consommation)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
