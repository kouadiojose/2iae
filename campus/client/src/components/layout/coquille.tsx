// Coquille de l'application connectée : en-tête (ordinateur), barre
// d'onglets (téléphone), cloche de notifications, bouton « Rejoindre le live ».
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bell, LogOut, User, WifiOff, Settings2, HelpCircle, MessageCircleQuestion, CloudUpload } from "lucide-react";
import { useMoiConnecte, seDeconnecter } from "@/lib/auth";
import { useTousEvenements } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { navigationDuRole, estActif } from "@/navigation";
import { cn, nomComplet } from "@/lib/utils";
import { Avatar } from "@/components/ui/divers";
import { Menu, ElementMenu, SeparateurMenu } from "@/components/ui/menu";
import { PanneauNotifications } from "./notifications";
import { useFileEnvoi } from "@/lib/file-envoi";
import { toast } from "@/components/ui/toast";
import { LIBELLES_ROLES } from "@shared/schema";
import type { EnCours, CompteurNotifications } from "@shared/api";

export function Marque({ sousTitre = true, sombre = false }: { sousTitre?: boolean; sombre?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 no-underline" aria-label="Campus numérique 2IAE, accueil">
      <img src="/marque-2iae.svg" alt="" className="h-9 w-auto sm:h-10" />
      <span className={cn("flex flex-col border-l pl-3", sombre ? "border-nuit-ligne" : "border-ligne-forte")}>
        <span className={cn("text-[15px] font-extrabold leading-tight tracking-[-0.01em]", sombre ? "text-white" : "text-encre")}>Campus numérique</span>
        {sousTitre && <span className={cn("font-mono text-[11px]", sombre ? "text-nuit-gris" : "text-texte-gris")}>Groupe 2IAE International</span>}
      </span>
    </Link>
  );
}

function useEnCours() {
  return useQuery<EnCours>({ queryKey: ["/api/live/en-cours"], refetchInterval: 60_000, staleTime: 20_000 });
}

function useCompteur() {
  return useQuery<CompteurNotifications>({ queryKey: ["/api/notifications/compteur"], refetchInterval: 120_000 });
}

function BoutonDirect({ compact }: { compact?: boolean }) {
  const { data } = useEnCours();
  if (!data?.enDirect) return null;
  return (
    <Link
      href={`/live/${data.enDirect.id}`}
      className={cn(
        "flex items-center gap-2 rounded-full bg-encre font-bold text-white no-underline transition-colors hover:bg-orange hover:text-encre",
        compact ? "px-3 py-2 text-[13px]" : "px-[18px] py-2.5 text-sm",
      )}
    >
      <span className="point-direct" />
      {compact ? "Live" : "Rejoindre le live"}
    </Link>
  );
}

function Cloche() {
  const [ouvert, setOuvert] = useState(false);
  const { data } = useCompteur();
  const n = data?.nonLues ?? 0;
  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className="relative rounded-full p-2.5 text-texte-doux hover:bg-creme hover:text-encre"
        aria-label={n ? `Notifications : ${n} non lue${n > 1 ? "s" : ""}` : "Notifications"}
      >
        <Bell className="h-[22px] w-[22px]" />
        {n > 0 && (
          <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-direct px-1 font-mono text-[10px] font-bold text-white">
            {n > 99 ? "99+" : n}
          </span>
        )}
      </button>
      <PanneauNotifications ouvert={ouvert} onFermer={() => setOuvert(false)} />
    </>
  );
}

/** Lien WhatsApp vers la vie scolaire du site, message pré-rempli (nom, matricule, page). */
export function lienAide(moi: { prenom: string; nom: string; matricule: string | null; site: { whatsappVieScolaire: string | null } | null }) {
  const numero = moi.site?.whatsappVieScolaire?.replace(/\D/g, "");
  const texte = `Bonjour, je suis ${moi.prenom} ${moi.nom}${moi.matricule ? ` (matricule ${moi.matricule})` : ""}. J'ai besoin d'aide sur le campus numérique, page : ${window.location.pathname}`;
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texte)}` : null;
}

function MenuProfil() {
  const moi = useMoiConnecte();
  const [, naviguer] = useLocation();
  return (
    <Menu
      declencheur={
        <button className="rounded-full ring-offset-2 hover:ring-2 hover:ring-orange" aria-label="Mon compte">
          <Avatar prenom={moi.prenom} nom={moi.nom} photo={moi.photoUrl} taille={38} />
        </button>
      }
    >
      <div className="px-3 pb-2 pt-2">
        <div className="font-extrabold">{nomComplet(moi)}</div>
        <div className="font-mono text-xs text-texte-gris">
          {LIBELLES_ROLES[moi.role]}
          {moi.site ? ` · ${moi.site.nomCourt}` : ""}
        </div>
      </div>
      <SeparateurMenu />
      <ElementMenu icone={<User className="h-4 w-4" />} onSelect={() => naviguer("/profil")}>
        Mon profil
      </ElementMenu>
      <ElementMenu icone={<Settings2 className="h-4 w-4" />} onSelect={() => naviguer("/profil#preferences")}>
        Préférences et données
      </ElementMenu>
      <ElementMenu icone={<HelpCircle className="h-4 w-4" />} onSelect={() => naviguer("/bienvenue?visite=1")}>
        Revoir la visite guidée
      </ElementMenu>
      {lienAide(moi) && (
        <ElementMenu icone={<MessageCircleQuestion className="h-4 w-4" />} onSelect={() => window.open(lienAide(moi)!, "_blank", "noopener")}>
          Besoin d'aide ? (WhatsApp)
        </ElementMenu>
      )}
      <SeparateurMenu />
      <ElementMenu icone={<LogOut className="h-4 w-4" />} danger onSelect={() => void seDeconnecter()}>
        Se déconnecter
      </ElementMenu>
    </Menu>
  );
}

function BandeauHorsLigne() {
  const [horsLigne, setHorsLigne] = useState(typeof navigator !== "undefined" && !navigator.onLine);
  useEffect(() => {
    const on = () => setHorsLigne(false);
    const off = () => setHorsLigne(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (!horsLigne) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-encre px-4 py-2 text-center text-[13px] font-semibold text-white">
      <WifiOff className="h-4 w-4 text-orange" />
      Pas de réseau : tu consultes la dernière version enregistrée. Tout se remettra à jour au retour de la connexion.
    </div>
  );
}

/** « 2 envois en attente de réseau » et confirmation quand ils partent. */
function BandeauEnvois() {
  const elements = useFileEnvoi();
  useEffect(() => {
    const ok = (e: Event) => toast(`Envoyé automatiquement : ${(e as CustomEvent).detail.description}`);
    const ko = (e: Event) => toast(`Envoi refusé : ${(e as CustomEvent).detail.description}. ${(e as CustomEvent).detail.message}`, "erreur");
    window.addEventListener("campus:envoi-reussi", ok);
    window.addEventListener("campus:envoi-refuse", ko);
    return () => {
      window.removeEventListener("campus:envoi-reussi", ok);
      window.removeEventListener("campus:envoi-refuse", ko);
    };
  }, []);
  if (!elements.length) return null;
  return (
    <div className="flex items-center justify-center gap-2 bg-orange px-4 py-2 text-center text-[13px] font-bold text-encre">
      <CloudUpload className="h-4 w-4" />
      {elements.length === 1 ? `1 envoi en attente de réseau : ${elements[0].description}` : `${elements.length} envois en attente de réseau`}. Ils partiront tout seuls.
    </div>
  );
}

/** Rafraîchit les compteurs quand une notification ou un message arrive. */
function EcouteGlobale() {
  useTousEvenements((e) => {
    if (e.type === "notification") void rafraichir("/api/notifications");
    if (e.type === "message") void rafraichir("/api/notifications/compteur");
    if (e.type === "live") void rafraichir("/api/live/en-cours");
  });
  return null;
}

export function Coquille({ children, pleinEcran = false }: { children: ReactNode; pleinEcran?: boolean }) {
  const moi = useMoiConnecte();
  const [chemin] = useLocation();
  const nav = navigationDuRole(moi.role);
  const { data: enCours } = useEnCours();
  const { data: compteur } = useCompteur();

  useEffect(() => {
    document.documentElement.classList.toggle("donnees-reduites", Boolean(moi.preferences?.donneesReduites));
  }, [moi.preferences?.donneesReduites]);

  return (
    <div className="min-h-dvh bg-white">
      <EcouteGlobale />
      <BandeauHorsLigne />
      <BandeauEnvois />
      <header className="sticky top-0 z-30 border-b border-ligne-douce bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1320px] items-center gap-4 px-4 py-2.5 sm:px-7 sm:py-3">
          <Marque sousTitre={false} />
          <nav className="hidden flex-1 flex-wrap justify-center gap-1 lg:flex" aria-label="Navigation principale">
            {nav.map((el) => {
              const actif = estActif(el, chemin);
              return (
                <Link
                  key={el.href}
                  href={el.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-semibold no-underline transition-colors",
                    actif ? "bg-encre text-white hover:text-white" : "text-texte-doux hover:bg-creme hover:text-encre",
                  )}
                  aria-current={actif ? "page" : undefined}
                >
                  {el.libelle}
                  {el.href === "/messages" && compteur?.messagesNonLus ? (
                    <span className="ml-1.5 rounded-full bg-orange px-1.5 font-mono text-[11px] text-encre">{compteur.messagesNonLus}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 lg:ml-0">
            <div className="hidden sm:block">
              <BoutonDirect />
            </div>
            <div className="sm:hidden">
              <BoutonDirect compact />
            </div>
            <Cloche />
            <MenuProfil />
          </div>
        </div>
      </header>

      <main className={cn(!pleinEcran && "pb-28 lg:pb-16")}>{children}</main>

      {/* Barre d'onglets du téléphone */}
      {nav.some((n) => n.mobile) && (
        <nav className="bas-sur fixed inset-x-0 bottom-0 z-30 border-t border-ligne-douce bg-white/95 backdrop-blur-md lg:hidden" aria-label="Navigation">
          <div className="mx-auto flex max-w-lg items-end justify-around px-2 pt-1.5">
            {nav
              .filter((n) => n.mobile)
              .map((el) => {
                const actif = estActif(el, chemin);
                const Icone = el.icone;
                const direct = el.central && enCours?.enDirect;
                if (el.central) {
                  return (
                    <Link key={el.href} href={direct ? `/live/${enCours!.enDirect!.id}` : el.href} className="-mt-5 flex flex-col items-center gap-1 no-underline" aria-current={actif ? "page" : undefined}>
                      <span
                        className={cn(
                          "grid h-14 w-14 place-items-center rounded-full shadow-carte ring-4 ring-white",
                          direct ? "bg-direct text-white" : actif ? "bg-orange text-encre" : "bg-encre text-white",
                        )}
                      >
                        <Icone className="h-6 w-6" />
                      </span>
                      <span className={cn("pb-2 text-[11px] font-bold", direct ? "text-direct" : actif ? "text-orange-fonce" : "text-texte-gris")}>
                        {direct ? "En direct" : el.libelle}
                      </span>
                    </Link>
                  );
                }
                const badge = el.href === "/messages" ? compteur?.messagesNonLus : 0;
                return (
                  <Link
                    key={el.href}
                    href={el.href}
                    className={cn("relative flex min-w-[60px] flex-col items-center gap-1 px-2 pb-2 pt-1 no-underline", actif ? "text-orange-fonce" : "text-texte-gris")}
                    aria-current={actif ? "page" : undefined}
                  >
                    <Icone className="h-[22px] w-[22px]" strokeWidth={actif ? 2.4 : 1.8} />
                    <span className="text-[11px] font-bold">{el.libelle}</span>
                    {badge ? (
                      <span className="absolute right-2 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-orange px-1 font-mono text-[10px] font-bold text-encre">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
          </div>
        </nav>
      )}
    </div>
  );
}

/** En-tête de page standard : étiquette mono, grand titre, actions. */
export function EnTetePage({
  etiquette,
  titre,
  sousTitre,
  actions,
  className,
}: {
  etiquette?: ReactNode;
  titre: ReactNode;
  sousTitre?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-5", className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        {etiquette && <span className="font-mono text-xs text-texte-gris">{etiquette}</span>}
        <h1 className="titre-page">{titre}</h1>
        {sousTitre && <p className="max-w-2xl text-base text-texte-pale">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Conteneur standard des pages connectées. */
export function Page({ children, className, large }: { children: ReactNode; className?: string; large?: boolean }) {
  return <div className={cn("mx-auto flex w-full flex-col gap-6 px-4 pb-10 pt-6 sm:px-7 sm:pt-9", large ? "max-w-[1400px]" : "max-w-[1320px]", className)}>{children}</div>;
}
