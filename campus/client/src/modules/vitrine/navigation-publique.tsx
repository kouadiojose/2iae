// En-tête et pied de page du site public du campus.
//
// En-tête : le vrai logo 2IAE et « Campus numérique », la navigation
// (Programme · Cours · Formateurs · Campus · Le direct · Plus), l'indicateur
// « EN DIRECT » quand un cours public est en cours, et « Se connecter » (ou
// « Mon campus » pour une personne déjà connectée). Sur téléphone, un menu
// plein écran (fenêtre modale : le focus y reste enfermé, Échap la ferme).
//
// Pied de page : le logo complet, toutes les pages, les campus, les contacts
// réels, les mentions légales, 2iae.com et la préinscription.
import { useState } from "react";
import { Link, useLocation } from "wouter";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowUpRight, ChevronDown, Mail, Menu as IconeMenu, MessageCircle, Phone, X } from "lucide-react";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { useMoi, accueilDuRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { SitePublicDto } from "@shared/schema";
import { useEnDirect, useSitePublicOuSecours } from "./donnees";
import { lienPreinscription, lienTelephone, lienWhatsappVers, pageActive, PAGES_PRINCIPALES, PAGES_SECONDAIRES, URL_SITE } from "./outils";

// ── Marque ─────────────────────────────────────────────────────────────────

/** Le vrai logo 2IAE (ovale) et « Campus numérique ». */
export function MarquePublique({ compacte = false, onClick }: { compacte?: boolean; onClick?: () => void }) {
  return (
    <Link href="/" onClick={onClick} className="flex shrink-0 items-center gap-2.5 no-underline sm:gap-3" aria-label="Campus numérique 2IAE, accueil du site">
      <img src="/marque-2iae.png" alt="" width={72} height={36} className="h-7 w-auto min-[400px]:h-8 sm:h-10" />
      <span className="flex flex-col border-l border-ligne-forte pl-2.5 sm:pl-3">
        <span className="whitespace-nowrap text-[13px] font-extrabold leading-tight tracking-[-0.01em] text-encre min-[400px]:text-[14px] sm:text-[15px]">Campus numérique</span>
        {!compacte && <span className="whitespace-nowrap font-mono text-[10.5px] text-texte-gris sm:text-[11px]">Groupe 2IAE International</span>}
      </span>
    </Link>
  );
}

// ── Indicateur du direct ───────────────────────────────────────────────────

function PastilleDirect({ className, onClick }: { className?: string; onClick?: () => void }) {
  const live = useEnDirect();
  if (!live) return null;
  return (
    <Link
      href={`/live/${live.id}`}
      onClick={onClick}
      title={`${live.coursTitre} : en direct maintenant. Les étudiants rejoignent le cours ici.`}
      className={cn(
        "inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-full bg-[#2A1510] px-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-[#FF8A6B] no-underline hover:bg-encre hover:text-white",
        className,
      )}
    >
      <span className="point-direct" />
      En direct<span className="sr-only"> : {live.coursTitre}, rejoindre le cours</span>
    </Link>
  );
}

/** « Se connecter », ou « Mon campus » quand la personne est déjà connectée. */
function BoutonCompte({ className, onClick, grand = false }: { className?: string; onClick?: () => void; grand?: boolean }) {
  const { moi } = useMoi();
  return (
    <Link
      href={moi ? accueilDuRole(moi.role) : "/connexion"}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-bold no-underline transition-colors",
        grand
          ? "min-h-[56px] bg-orange px-6 text-base text-encre hover:bg-encre hover:text-white"
          : "min-h-[44px] border-[1.5px] border-encre bg-white px-3 text-[13px] text-encre hover:bg-orange-pale hover:text-encre sm:px-4 sm:text-sm",
        className,
      )}
    >
      {moi ? (
        "Mon campus"
      ) : grand ? (
        "Se connecter"
      ) : (
        <>
          <span className="min-[400px]:hidden">Connexion</span>
          <span className="hidden min-[400px]:inline">Se connecter</span>
        </>
      )}
    </Link>
  );
}

// ── En-tête ────────────────────────────────────────────────────────────────

export function EnTetePublic() {
  const [chemin] = useLocation();
  const live = useEnDirect();
  const secondaireActive = PAGES_SECONDAIRES.some((p) => pageActive(p.href, chemin));
  return (
    <header className="sticky top-0 z-40 border-b border-ligne-douce bg-white/95 backdrop-blur-md">
      <div className="conteneur flex h-16 items-center gap-3 sm:h-[72px]">
        {/* Le sous-titre de la marque cède la place à la navigation entre 1024 et 1280 px. */}
        <span className="sm:hidden lg:block xl:hidden">
          <MarquePublique compacte />
        </span>
        <span className="hidden sm:block lg:hidden xl:block">
          <MarquePublique />
        </span>

        <nav className="ml-auto hidden items-center gap-0.5 lg:flex" aria-label="Navigation principale">
          {PAGES_PRINCIPALES.map((p) => {
            const actif = pageActive(p.href, chemin);
            return (
              <Link
                key={p.href}
                href={p.href}
                aria-current={actif ? "page" : undefined}
                className={cn(
                  "relative whitespace-nowrap rounded-full px-3 py-2 text-[15px] font-semibold no-underline transition-colors xl:px-4",
                  actif ? "bg-creme text-encre" : "text-texte-doux hover:bg-creme hover:text-encre",
                )}
              >
                {p.libelle}
              </Link>
            );
          })}
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-[15px] font-semibold outline-none transition-colors data-[state=open]:bg-creme xl:px-4",
                secondaireActive ? "bg-creme text-encre" : "text-texte-doux hover:bg-creme hover:text-encre",
              )}
            >
              Plus <ChevronDown className="h-4 w-4" aria-hidden />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={10} className="z-50 w-[300px] rounded-2xl border border-ligne bg-white p-2 shadow-carte animate-apparait">
                {PAGES_SECONDAIRES.map((p) => (
                  <DropdownMenu.Item key={p.href} asChild>
                    <Link
                      href={p.href}
                      aria-current={pageActive(p.href, chemin) ? "page" : undefined}
                      className="flex flex-col gap-0.5 rounded-xl px-3.5 py-3 text-encre no-underline outline-none hover:text-encre data-[highlighted]:bg-creme"
                    >
                      <span className="text-[15px] font-bold">{p.libelle}</span>
                      <span className="text-[13px] text-texte-pale">{p.description}</span>
                    </Link>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 lg:ml-3">
          <PastilleDirect />
          {/* Sur un petit téléphone, pendant un direct, la pastille remplace le bouton (la connexion reste dans le menu). */}
          <BoutonCompte className={live ? "hidden sm:inline-flex" : "inline-flex"} />
          <MenuMobile />
        </div>
      </div>
    </header>
  );
}

/** Menu plein écran du téléphone et de la tablette. */
function MenuMobile() {
  const [ouvert, setOuvert] = useState(false);
  const [chemin] = useLocation();
  const site = useSitePublicOuSecours();
  const fermer = () => setOuvert(false);
  const toutes = [{ href: "/", libelle: "Accueil", description: "Un cours, cinq campus, en direct" }, ...PAGES_PRINCIPALES, ...PAGES_SECONDAIRES];
  return (
    <Dialog.Root open={ouvert} onOpenChange={setOuvert}>
      <Dialog.Trigger
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ligne text-encre transition-colors hover:bg-creme lg:hidden"
        aria-label="Ouvrir le menu du site"
      >
        <IconeMenu className="h-5 w-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-encre/40 animate-apparait" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white animate-apparait focus:outline-none">
          <Dialog.Title className="sr-only">Menu du site</Dialog.Title>
          <Dialog.Description className="sr-only">Toutes les pages du campus numérique, la connexion et les contacts.</Dialog.Description>
          <div className="conteneur flex h-16 shrink-0 items-center justify-between gap-3 border-b border-ligne-douce sm:h-[72px]">
            <MarquePublique onClick={fermer} />
            <Dialog.Close className="grid h-11 w-11 place-items-center rounded-xl border border-ligne text-encre hover:bg-creme" aria-label="Fermer le menu">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="conteneur flex flex-1 flex-col gap-6 py-5">
            <div className="flex flex-col gap-2">
              <BoutonCompte grand onClick={fermer} className="w-full" />
              <PastilleDirect onClick={fermer} className="min-h-[48px] justify-center" />
            </div>
            <nav aria-label="Pages du site">
              <ul className="flex flex-col">
                {toutes.map((p) => {
                  const actif = p.href === "/" ? chemin === "/" : pageActive(p.href, chemin);
                  return (
                    <li key={p.href} className="border-b border-ligne-douce last:border-b-0">
                      <Link
                        href={p.href}
                        onClick={fermer}
                        aria-current={actif ? "page" : undefined}
                        className="flex min-h-[60px] items-center justify-between gap-4 py-2.5 text-encre no-underline hover:text-orange-fonce"
                      >
                        <span className="flex flex-col">
                          <span className={cn("text-[22px] font-extrabold tracking-[-0.02em]", actif && "text-orange-fonce")}>{p.libelle}</span>
                          <span className="text-[14px] text-texte-pale">{p.description}</span>
                        </span>
                        {actif && <span className="h-2 w-2 shrink-0 rounded-full bg-orange" aria-hidden />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="mt-auto flex flex-col gap-3 rounded-3xl bg-creme p-5">
              <span className="etiquette">Une question ?</span>
              <a
                href={lienWhatsappVers(site.contacts.whatsapp, "Bonjour, j'ai une question sur le campus numérique 2IAE.")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-base font-bold text-encre no-underline hover:bg-encre hover:text-white"
              >
                <MessageCircle className="h-5 w-5" /> Écrire sur WhatsApp
              </a>
              <a
                href={lienPreinscription(undefined, site.contacts.preinscription)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-[1.5px] border-encre bg-white px-5 text-[15px] font-bold text-encre no-underline hover:bg-orange-pale hover:text-encre"
              >
                Préinscription sur 2iae.com <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Pied de page ───────────────────────────────────────────────────────────

const LIEN_PIED = "inline-flex min-h-[36px] items-center py-1 text-[15px] text-white no-underline hover:text-orange";

/** Appel à la préinscription (bandeau orange du pied de page). */
function AppelPreinscription({ site }: { site: SitePublicDto }) {
  return (
    <div className="relative flex flex-col gap-6 overflow-hidden rounded-[28px] bg-orange p-6 text-encre sm:p-10 lg:flex-row lg:items-end lg:justify-between">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border-[36px] border-encre/10" />
      <div className="relative flex max-w-xl flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.12em]">Préinscription en ligne</span>
        <h2 className="text-[28px] font-black leading-[1.02] tracking-serre sm:text-[40px]">Pas encore étudiant à 2IAE ?</h2>
        <p className="text-base leading-relaxed text-[#2B211B] sm:text-[17px]">
          La préinscription se fait en quelques minutes sur le site du groupe. Vous suivrez ensuite vos cours ici, dans votre campus ou sur votre téléphone.
        </p>
      </div>
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
        <a
          href={lienPreinscription(undefined, site.contacts.preinscription)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-[14px] bg-encre px-6 text-base font-bold text-white no-underline hover:bg-white hover:text-encre"
        >
          Faire ma préinscription <ArrowUpRight className="h-5 w-5" />
        </a>
        <Link href="/campus" className="px-2 py-2 text-center text-[15px] font-semibold text-encre underline-offset-4 hover:text-encre hover:underline">
          Découvrir les cinq campus
        </Link>
      </div>
    </div>
  );
}

export function PiedPublic({ sansAppel = false }: { sansAppel?: boolean }) {
  const site = useSitePublicOuSecours();
  const c = site.contacts;
  const annee = new Date(useMaintenant(3_600_000)).getUTCFullYear();
  const pages = [{ href: "/", libelle: "Accueil" }, ...PAGES_PRINCIPALES, ...PAGES_SECONDAIRES, { href: "/confidentialite", libelle: "Confidentialité" }];
  return (
    <footer className="bg-encre text-white">
      <div className="conteneur flex flex-col gap-12 py-14 sm:py-16">
        {!sansAppel && <AppelPreinscription site={site} />}

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr]">
          <div className="flex flex-col gap-5">
            <Link href="/" className="self-start rounded-2xl bg-white px-4 py-3 no-underline" aria-label="Groupe Écoles 2IAE International, accueil du campus numérique">
              {/* Version allégée du logo complet (14 Ko au lieu de 71 Ko) : il paraît sur chaque page. */}
              <img src="/images/logo-2iae-pied.png" alt="Groupe Écoles 2IAE International" width={138} height={72} loading="lazy" decoding="async" className="h-[72px] w-auto" />
            </Link>
            <p className="max-w-xs text-[15px] leading-relaxed text-nuit-doux">
              Le campus numérique du Groupe Écoles 2IAE International : un cours, cinq campus, en direct.
            </p>
            <p className="max-w-xs font-mono text-xs leading-relaxed text-orange-peche">« 2IAE, entreprendre pour devenir l'élite de demain. »</p>
          </div>

          <nav aria-label="Pages du site" className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">Le site</span>
            <ul className="grid grid-cols-2 gap-x-4 sm:grid-cols-1">
              {pages.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className={LIEN_PIED}>
                    {p.libelle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Les campus" className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">Les campus</span>
            <ul className="flex flex-col">
              {site.campus.map((s) => (
                <li key={s.slug}>
                  <Link href={`/campus/${s.slug}`} className={LIEN_PIED}>
                    {s.nom}
                  </Link>
                </li>
              ))}
              <li className="pt-2 text-[14px] leading-snug text-nuit-gris">
                Bureau au Canada
                <br />
                {c.bureauCanada}
              </li>
            </ul>
          </nav>

          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-peche">Nous joindre</span>
            <ul className="flex flex-col">
              {c.telephones.map((t) => (
                <li key={t}>
                  <a href={lienTelephone(t)} className={cn(LIEN_PIED, "gap-2")}>
                    <Phone className="h-4 w-4 text-nuit-gris" aria-hidden /> {t}
                  </a>
                </li>
              ))}
              {c.whatsapp && (
                <li>
                  <a href={lienWhatsappVers(c.whatsapp)} target="_blank" rel="noopener noreferrer" className={cn(LIEN_PIED, "gap-2")}>
                    <MessageCircle className="h-4 w-4 text-[#25D366]" aria-hidden /> WhatsApp {c.whatsapp}
                  </a>
                </li>
              )}
              {c.email && (
                <li>
                  <a href={`mailto:${c.email}`} className={cn(LIEN_PIED, "gap-2")}>
                    <Mail className="h-4 w-4 text-nuit-gris" aria-hidden /> {c.email}
                  </a>
                </li>
              )}
              <li className="mt-3 flex flex-wrap gap-2">
                <a
                  href={lienPreinscription(undefined, c.preinscription)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-orange px-4 text-sm font-bold text-encre no-underline hover:bg-white hover:text-encre"
                >
                  Préinscription <ArrowUpRight className="h-4 w-4" />
                </a>
                <a
                  href={c.siteWeb || URL_SITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-nuit-bord px-4 text-sm font-bold text-white no-underline hover:border-orange hover:text-orange"
                >
                  www.2iae.com <ArrowUpRight className="h-4 w-4" />
                </a>
              </li>
              {c.facebook && (
                <li className="pt-1">
                  <a href={c.facebook} target="_blank" rel="noopener noreferrer" className={LIEN_PIED}>
                    Le groupe sur Facebook
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-nuit-ligne pt-6 font-mono text-xs leading-relaxed text-nuit-gris lg:flex-row lg:items-center lg:justify-between">
          <span>
            © {annee} Groupe Écoles 2IAE International · Institut International des Affaires en Entrepreneuriat
          </span>
          <span>
            {[c.rc && `RC ${c.rc}`, c.agrement && `Agrément n° ${c.agrement}`].filter(Boolean).join(" · ")}
            {" · "}
            <Link href="/confidentialite" className="text-nuit-doux underline-offset-2 hover:text-orange hover:underline">
              Confidentialité
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
