// Panneau de la cloche : les dernières notifications, un clic ouvre la page concernée.
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Radio, ClipboardList, GraduationCap, MessageCircle, Megaphone, BookOpen, Info, UserCheck } from "lucide-react";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Chargement, EtatVide } from "@/components/ui/divers";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { relatif } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { NotificationDto } from "@shared/api";

const ICONES: Record<string, typeof Radio> = {
  live: Radio,
  devoir: ClipboardList,
  note: GraduationCap,
  message: MessageCircle,
  annonce: Megaphone,
  cours: BookOpen,
  presence: UserCheck,
};

export function PanneauNotifications({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  const [, naviguer] = useLocation();
  const { data, isLoading } = useQuery<NotificationDto[]>({ queryKey: ["/api/notifications"], enabled: ouvert });
  const toutLu = useMutation({
    mutationFn: () => post("/api/notifications/tout-lu"),
    onSuccess: () => rafraichir("/api/notifications"),
  });

  const ouvrir = async (n: NotificationDto) => {
    if (!n.luLe) await post(`/api/notifications/${n.id}/lu`).catch(() => undefined);
    void rafraichir("/api/notifications");
    onFermer();
    if (n.lien) naviguer(n.lien);
  };

  const nonLues = (data ?? []).filter((n) => !n.luLe).length;

  return (
    <Fenetre
      ouverte={ouvert}
      onFermer={onFermer}
      titre="Notifications"
      pied={
        nonLues > 0 ? (
          <Bouton variante="doux" taille="sm" chargement={toutLu.isPending} onClick={() => toutLu.mutate()}>
            Tout marquer comme lu
          </Bouton>
        ) : undefined
      }
    >
      {isLoading ? (
        <Chargement lignes={4} />
      ) : !data?.length ? (
        <EtatVide icone={<Info className="h-5 w-5" />} titre="Rien de nouveau" texte="Les rappels de cours en direct, les devoirs et les messages apparaîtront ici." />
      ) : (
        <ul className="-mx-2 flex flex-col pb-2">
          {data.map((n) => {
            const Icone = ICONES[n.type] ?? Info;
            return (
              <li key={n.id}>
                <button onClick={() => void ouvrir(n)} className={cn("flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left hover:bg-creme", !n.luLe && "bg-orange-pale")}>
                  <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full", n.type === "live" ? "bg-[#2A1510] text-[#FF8A6B]" : "bg-orange-clair text-orange-fonce")}>
                    <Icone className="h-4 w-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-bold leading-snug text-encre">{n.titre}</span>
                    {n.corps && <span className="line-clamp-2 text-sm text-texte-pale">{n.corps}</span>}
                    <span className="font-mono text-[11px] text-texte-gris">{relatif(n.creeLe)}</span>
                  </span>
                  {!n.luLe && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-orange" aria-label="Non lue" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Fenetre>
  );
}
