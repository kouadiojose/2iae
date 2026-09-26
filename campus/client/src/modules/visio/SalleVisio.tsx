// Une salle Daily qu'on rejoint en dehors d'un cours : la salle d'essai
// permanente, ou la salle d'une séance pour une répétition. Même cadre et
// même thème que la classe réelle ; on voit qui est déjà là, et on invite
// quelqu'un (écran d'une salle de campus, collègue, direction) par WhatsApp
// ou en copiant le lien.
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, LogIn, LogOut, MessageCircle, Mic, MicOff, Video, VideoOff, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { relatif } from "@/lib/dates";
import { Bouton } from "@/components/ui/bouton";
import { toast } from "@/components/ui/toast";
import type { AccesDaily, PresenceSalleVisio, RejoindreVisioDto } from "@shared/schema";
import { CadreDaily, type ParticipantCadre, type RoleCadre } from "./CadreDaily";
import { Pastille } from "./composants";
import type { EtatVisio } from "./SceneVisioCampus";

export type PropsSalleVisio = {
  obtenirAcces: () => Promise<AccesDaily | RejoindreVisioDto>;
  /** GET qui dit qui est dans la salle (null : pas le droit de le savoir). */
  urlPresence: string | null;
  lienPartage: string;
  messagePartage: string;
  titreBouton: string;
  nomSalle: string;
  tu: boolean;
  role: RoleCadre;
  /** Texte au-dessus de l'image quand on est dans la salle (« Répétition… »). */
  bandeau?: ReactNode;
  aideInvitation?: ReactNode;
  onRejoint?: () => void;
  /** Actions de secours après deux échecs de connexion. */
  secours?: ReactNode;
  /** Désactive l'entrée (ex. Daily non configuré) avec la raison. */
  indisponible?: string | null;
  /** Bloc « Tester avec quelqu'un » (masqué pour les étudiants : Daily se paie à la minute). */
  invitation?: boolean;
};

export function SalleVisio(p: PropsSalleVisio) {
  const t = (a: string, b: string) => (p.tu ? a : b);
  const [dedans, setDedans] = useState(false);
  const [participants, setParticipants] = useState<ParticipantCadre[]>([]);
  const [etatVisio, setEtatVisio] = useState<EtatVisio>("connexion");
  const connecte = etatVisio === "connecte" || etatVisio === "reconnexion";
  const { data: presence } = useQuery<PresenceSalleVisio>({
    queryKey: [p.urlPresence ?? "aucune"],
    enabled: Boolean(p.urlPresence) && !dedans && !p.indisponible,
    refetchInterval: 10_000,
    retry: false,
  });
  const presents = presence?.presents ?? [];

  const partagerWhatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${p.messagePartage} ${p.lienPartage}`)}`, "_blank", "noopener");
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(p.lienPartage);
      toast("Lien copié.");
    } catch {
      window.prompt(t("Copie ce lien :", "Copiez ce lien :"), p.lienPartage);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!dedans ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-ligne bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-clair text-orange-fonce">
              <Users className="h-5 w-5" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[17px] font-extrabold">{p.nomSalle}</span>
              {p.indisponible ? (
                <span className="text-[15px] text-texte-pale">{p.indisponible}</span>
              ) : !p.urlPresence ? (
                <span className="text-[15px] text-texte-pale">{t("Tu verras qui est là en entrant.", "Vous verrez qui est là en entrant.")}</span>
              ) : !presence ? (
                <span className="text-[15px] text-texte-gris">Qui est dans la salle ?…</span>
              ) : !presence.disponible ? (
                <span className="text-[15px] text-texte-pale">{t("Impossible de savoir qui est là pour l'instant.", "Impossible de savoir qui est là pour l'instant.")}</span>
              ) : presents.length === 0 ? (
                <span className="text-[15px] text-texte-pale">{t("Personne dans la salle pour l'instant.", "Personne dans la salle pour l'instant.")}</span>
              ) : (
                <span className="text-[15px] text-texte-doux">
                  {presents.length === 1 ? "Une personne est déjà là :" : `${presents.length} personnes sont déjà là :`}
                </span>
              )}
              {presents.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-2" aria-label="Personnes présentes">
                  {presents.map((x, i) => (
                    <li key={`${x.nom}-${i}`} className="inline-flex items-center gap-2 rounded-full bg-creme px-3 py-1.5 text-[14px] font-semibold">
                      <span className="point-direct" aria-hidden />
                      {x.nom}
                      <span className="font-mono text-[11px] font-normal text-texte-gris">{relatif(x.depuis)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <Bouton taille="lg" pleineLargeur icone={<LogIn className="h-5 w-5" />} disabled={Boolean(p.indisponible)} onClick={() => setDedans(true)} className="min-h-[56px]">
            {p.titreBouton}
          </Bouton>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-[24px] bg-nuit p-3 text-white sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Pastille ton={connecte ? "direct" : etatVisio === "echec" ? "alerte" : "attente"}>
              {connecte ? `En ligne · ${participants.length} présent${participants.length > 1 ? "s" : ""}` : etatVisio === "echec" ? "Hors ligne" : "Connexion…"}
            </Pastille>
            <Bouton
              variante="nuit"
              icone={<LogOut className="h-4 w-4" />}
              onClick={() => {
                setDedans(false);
                setParticipants([]);
                setEtatVisio("connexion");
              }}
            >
              {t("Quitter la salle", "Quitter la salle")}
            </Bouton>
          </div>
          {p.bandeau && <div className="rounded-xl bg-nuit-carte px-3 py-2 text-[14px] text-nuit-doux">{p.bandeau}</div>}
          <div className="h-[68dvh] max-h-[640px] min-h-[420px] overflow-hidden rounded-[22px] border-2 border-nuit-ligne bg-nuit-carte lg:h-auto lg:max-h-none lg:min-h-0 lg:aspect-video">
            <CadreDaily
              obtenirAcces={p.obtenirAcces}
              role={p.role}
              tu={p.tu}
              cameraAuDepart={p.role === "formateur" || p.role === "salle"}
              microAuDepart={false}
              onParticipants={setParticipants}
              onEtat={setEtatVisio}
              onRejoint={p.onRejoint}
              secours={p.secours}
            />
          </div>
          {connecte && participants.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Dans la salle">
              {participants.map((x) => (
                <li key={x.id} className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold", x.local ? "bg-orange text-encre" : "bg-nuit-carte text-white")}>
                  {x.micro ? <Mic className="h-3.5 w-3.5" aria-label="micro ouvert" /> : <MicOff className="h-3.5 w-3.5 opacity-60" aria-label="micro coupé" />}
                  {x.camera ? <Video className="h-3.5 w-3.5" aria-label="caméra ouverte" /> : <VideoOff className="h-3.5 w-3.5 opacity-60" aria-label="caméra coupée" />}
                  {x.local ? `${x.nom} (${t("toi", "vous")})` : x.nom}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {p.invitation !== false && (
      <div className="flex flex-col gap-3 rounded-2xl border border-ligne bg-creme p-4 sm:p-5">
        <div className="flex flex-col gap-1">
          <span className="text-[17px] font-extrabold">{t("Tester avec quelqu'un", "Tester avec quelqu'un")}</span>
          <span className="text-[15px] leading-snug text-texte-pale">
            {p.aideInvitation ??
              t(
                "Envoie ce lien à un camarade ou à la vie scolaire : il se connecte avec son compte du campus et vous vous retrouvez dans la même salle.",
                "Envoyez ce lien à l'écran d'une salle de campus, à un collègue ou à la direction : chacun se connecte avec son compte du campus et vous vous retrouvez dans la même salle.",
              )}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Bouton variante="encre" icone={<MessageCircle className="h-4 w-4" />} onClick={partagerWhatsapp} className="min-h-[48px]">
            Envoyer par WhatsApp
          </Bouton>
          <Bouton variante="contour" icone={<Copy className="h-4 w-4" />} onClick={() => void copier()} className="min-h-[48px]">
            Copier le lien
          </Bouton>
        </div>
        <p className="break-all font-mono text-[12px] text-texte-gris">{p.lienPartage}</p>
      </div>
      )}
    </div>
  );
}
