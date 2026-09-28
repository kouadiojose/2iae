// /annonces/:id — une annonce en entier. L'ouvrir la marque comme lue (et la
// notification qui y menait aussi). Partage WhatsApp prêt à envoyer. L'auteur
// et l'équipe voient qui a lu, peuvent relancer, modifier ou retirer ; la
// direction valide ici une annonce proposée pour 2iae.com.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Globe, Megaphone, PenLine, Share2, Trash2 } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { post, suppr, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { dateEtHeure, jourLong, heure, relatif } from "@/lib/dates";
import { Page } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Avatar, EtatVide, Erreur, Squelette } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { Markdown } from "@/components/ui/markdown";
import { toast, toastErreur } from "@/components/ui/toast";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { LIBELLES_ROLES, type AnnonceDto } from "@shared/schema";
import { BadgesAnnonce, PanneauLectures } from "./composants";
import { FenetreAnnonce } from "./FenetreAnnonce";
import { adresseCampus, extrait, lienWhatsApp, majuscule, tutoie } from "../accueil/outils";

export default function PageAnnonce({ id }: { id: string }) {
  const moi = useMoiConnecte();
  const tu = tutoie(moi);
  const equipe = moi.role === "admin" || moi.role === "vie_scolaire";
  const [, naviguer] = useLocation();
  const maintenant = useMaintenant(60_000);
  const cle = `/api/annonces/${id}`;
  const { data: a, isLoading, error, refetch } = useQuery<AnnonceDto>({ queryKey: [cle] });
  const [edition, setEdition] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [validation, setValidation] = useState(false);

  // Ouvrir l'annonce = l'avoir lue (une seule fois par affichage).
  const marquee = useRef<number | null>(null);
  useEffect(() => {
    if (!a || a.lue || marquee.current === a.id) return;
    marquee.current = a.id;
    post(`/api/annonces/${a.id}/lue`)
      .then(() => rafraichir("/api/annonces", "/api/notifications", "/api/accueil"))
      .catch(() => undefined);
  }, [a]);

  if (error && !a) {
    const introuvable = error instanceof ErreurApi && (error.statut === 404 || error.statut === 403);
    return (
      <Page>
        {introuvable ? (
          <EtatVide
            icone={<Megaphone className="h-5 w-5" />}
            titre={(error as Error).message}
            texte={tu ? "Elle a peut-être été retirée, ou elle ne concerne pas ton campus ou tes cours." : "Elle a peut-être été retirée, ou elle ne concerne pas vos campus ou vos cours."}
            action={<LienBouton href="/annonces">Voir toutes les annonces</LienBouton>}
          />
        ) : (
          <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
        )}
      </Page>
    );
  }
  if (isLoading || !a) {
    return (
      <Page className="max-w-3xl">
        <Squelette className="h-5 w-40" />
        <Squelette className="h-12 w-3/4" />
        <Squelette className="h-48" />
      </Page>
    );
  }

  const texteWhatsApp = `${a.importante ? "Important : " : ""}${a.titre}\n\n${extrait(a.corps, 400)}\n\nÀ lire sur le campus numérique 2IAE : ${adresseCampus(`/annonces/${a.id}`)}`;
  const expiree = Boolean(a.expireLe && new Date(a.expireLe).getTime() <= maintenant);

  async function supprimer() {
    setSuppression(true);
    try {
      await suppr(`/api/annonces/${a!.id}`);
      toast("Annonce retirée.");
      await rafraichir("/api/annonces", "/api/accueil");
      naviguer(equipe ? "/pilotage/annonces" : "/annonces", { replace: true });
    } catch (e) {
      toastErreur(e);
      setSuppression(false);
    }
  }

  async function validerSite(publier: boolean) {
    setValidation(true);
    try {
      await post(`/api/annonces/${a!.id}/site`, { publier });
      toast(publier ? "Annonce publiée sur 2iae.com." : "Proposition refusée : l'annonce reste sur le campus.");
      await rafraichir(cle, "/api/annonces");
    } catch (e) {
      toastErreur(e);
    } finally {
      setValidation(false);
    }
  }

  return (
    <Page className="max-w-5xl">
      <Link href={equipe ? "/pilotage/annonces" : "/annonces"} className="flex min-h-[44px] items-center gap-2 self-start text-[15px] font-bold">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Toutes les annonces
      </Link>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <article className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3">
            <BadgesAnnonce annonce={{ ...a, lue: true }} gestion={a.gerable} />
            <span className="font-mono text-xs text-texte-gris">{a.cibleLibelle}</span>
            <h1 className="text-[30px] font-black leading-[1.05] tracking-serre sm:text-[38px]">{a.titre}</h1>
            <div className="flex items-center gap-3">
              <Avatar prenom={a.auteur.prenom} nom={a.auteur.nom} photo={a.auteur.photoUrl} taille={40} />
              <div className="flex flex-col">
                <span className="text-[15px] font-bold">
                  {a.auteur.prenom} {a.auteur.nom}
                </span>
                <span className="font-mono text-xs text-texte-gris">
                  {LIBELLES_ROLES[a.auteur.role as keyof typeof LIBELLES_ROLES] ?? ""} · {relatif(a.publieeLe, maintenant)}
                </span>
              </div>
            </div>
          </div>
          <Markdown source={a.corps} className="text-base" />
          <p className="font-mono text-xs text-texte-gris">
            Publiée le {jourLong(a.publieeLe)} à {heure(a.publieeLe)}
            {a.expireLe && (expiree ? ` · retirée le ${jourLong(a.expireLe)}` : ` · visible jusqu'au ${jourLong(a.expireLe)} à ${heure(a.expireLe)}`)}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <LienBouton href={lienWhatsApp(texteWhatsApp)} externe variante={a.gerable ? "contour" : "principal"} className="min-h-[48px]" icone={<Share2 className="h-4 w-4" />}>
              Partager sur WhatsApp
            </LienBouton>
            {a.gerable && (
              <>
                <Bouton variante="doux" onClick={() => setEdition(true)} className="min-h-[48px]" icone={<PenLine className="h-4 w-4" />}>
                  Modifier
                </Bouton>
                <Bouton variante="fantome" onClick={() => setConfirmation(true)} className="min-h-[48px] text-danger hover:text-danger" icone={<Trash2 className="h-4 w-4" />}>
                  Retirer
                </Bouton>
              </>
            )}
          </div>
        </article>

        {a.gerable && (
          <aside className="flex flex-col gap-5">
            {moi.role === "admin" && a.proposeSurSite && (
              <Carte className="flex flex-col gap-3 border-alerte bg-alerte-clair">
                <span className="flex items-center gap-2 text-[15px] font-extrabold">
                  <Globe className="h-4 w-4" aria-hidden /> Proposée pour 2iae.com
                </span>
                <p className="text-sm text-texte-doux">L'auteur souhaite la voir aussi sur le site du groupe. Relisez-la avant de la publier.</p>
                <div className="flex flex-wrap gap-2">
                  <Bouton onClick={() => void validerSite(true)} chargement={validation} className="min-h-[48px]">
                    Publier sur 2iae.com
                  </Bouton>
                  <Bouton variante="fantome" onClick={() => void validerSite(false)} disabled={validation} className="min-h-[48px]">
                    Refuser
                  </Bouton>
                </div>
              </Carte>
            )}
            {moi.role === "admin" && a.publierSurSite && (
              <Carte className="flex flex-col gap-3">
                <span className="flex items-center gap-2 text-[15px] font-extrabold">
                  <Globe className="h-4 w-4 text-succes" aria-hidden /> En ligne sur 2iae.com
                </span>
                <Bouton variante="doux" taille="sm" onClick={() => void validerSite(false)} chargement={validation} className="min-h-[44px] self-start">
                  Retirer du site
                </Bouton>
              </Carte>
            )}
            <Carte className="flex flex-col gap-4">
              <h2 className="text-lg font-extrabold">Qui a lu ?</h2>
              <PanneauLectures annonceId={a.id} expiree={expiree} />
            </Carte>
          </aside>
        )}
      </div>

      {a.gerable && (
        <>
          <FenetreAnnonce ouverte={edition} onFermer={() => setEdition(false)} annonce={a} onEnregistree={() => void rafraichir(cle)} />
          <Fenetre
            ouverte={confirmation}
            onFermer={() => setConfirmation(false)}
            titre="Retirer cette annonce ?"
            description="Elle disparaît du campus pour tout le monde, ainsi que ses accusés de lecture. Cette action est définitive."
            pied={
              <>
                <Bouton variante="fantome" onClick={() => setConfirmation(false)} className="min-h-[48px]">
                  Garder
                </Bouton>
                <Bouton variante="danger" onClick={() => void supprimer()} chargement={suppression} className="min-h-[48px]">
                  Retirer l'annonce
                </Bouton>
              </>
            }
          >
            <p className="pb-2 text-[15px] text-texte-pale">
              « {a.titre} » · {majuscule(dateEtHeure(a.publieeLe))}
            </p>
          </Fenetre>
        </>
      )}
    </Page>
  );
}
