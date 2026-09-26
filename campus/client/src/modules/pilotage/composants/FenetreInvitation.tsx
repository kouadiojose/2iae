// « Inviter » un formateur (ou un membre de l'équipe) : un lien d'activation
// à usage unique, à envoyer par WhatsApp, par e-mail ou à copier. En
// l'ouvrant, la personne vérifie son nom, choisit son identifiant (e-mail ou
// téléphone) et son mot de passe. Chaque ouverture de la fenêtre crée un
// nouveau lien : le précédent ne marche plus.
import { useEffect, useRef, useState } from "react";
import { Copy, Mail, MessageCircle, Link2, TriangleAlert, CalendarClock, CheckCircle2 } from "lucide-react";
import type { InvitationRemise, EnvoiInvitation } from "@shared/lancement";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champs";
import { Erreur, Squelette } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import { post, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { dateCourte } from "@/lib/dates";
import { Qr } from "./Qr";
import { copier } from "../outils";

export type PersonneAInviter = { id: number; prenom: string; nom: string; email: string | null; telephone: string | null };

export function FenetreInvitation({ personne, onFermer }: { personne: PersonneAInviter | null; onFermer: () => void }) {
  const [invitation, setInvitation] = useState<InvitationRemise | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [adresse, setAdresse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoyeA, setEnvoyeA] = useState<string | null>(null);
  const demande = useRef<number | null>(null);

  useEffect(() => {
    if (!personne) {
      demande.current = null;
      return;
    }
    if (demande.current === personne.id) return; // une seule invitation par ouverture
    demande.current = personne.id;
    setInvitation(null);
    setErreur(null);
    setEnvoyeA(null);
    setAdresse(personne.email ?? "");
    post<InvitationRemise>(`/api/pilotage/comptes/${personne.id}/invitation`)
      .then((r) => {
        setInvitation(r);
        void rafraichir("/api/pilotage/rentree");
      })
      .catch((e) => setErreur(e instanceof ErreurApi ? e.message : "Une erreur est survenue. Réessayez dans un instant."));
  }, [personne]);

  if (!personne) return null;
  const nom = `${personne.prenom} ${personne.nom}`;

  const envoyerEmail = async () => {
    if (!invitation) return;
    setEnvoi(true);
    try {
      const r = await post<EnvoiInvitation>(`/api/pilotage/comptes/${personne.id}/invitation/email`, { jeton: invitation.jeton, adresse: adresse.trim() || undefined });
      setEnvoyeA(r.adresse);
      toast(r.message);
      void rafraichir("/api/pilotage/rentree");
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "L'e-mail n'a pas pu partir.", "erreur");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      large
      titre={`Inviter ${nom}`}
      description="Un lien personnel, valable une seule fois : il vérifie son nom, choisit son identifiant (e-mail ou téléphone) et son mot de passe."
      pied={
        invitation ? (
          <>
            <Bouton variante="contour" icone={<Copy className="h-4 w-4" />} onClick={async () => toast((await copier(invitation.message)) ? "Message copié" : "Copie impossible : sélectionnez le texte à la main.", "info")}>
              Copier le message
            </Bouton>
            <a
              href={invitation.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange px-5 py-3 text-[15px] font-bold text-encre no-underline hover:bg-encre hover:text-white"
            >
              <MessageCircle className="h-4 w-4" />
              Envoyer sur WhatsApp
            </a>
          </>
        ) : undefined
      }
    >
      {erreur ? (
        <Erreur message={erreur} />
      ) : !invitation ? (
        <div className="flex flex-col gap-3 pb-2" aria-busy="true">
          <Squelette className="h-24" />
          <Squelette className="h-16" />
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          {invitation.premierCours && (
            <p className="flex items-start gap-2 rounded-xl bg-creme px-4 py-3 text-[15px]">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" />
              <span>
                Prochain cours : <strong>{invitation.premierCours}</strong>
              </span>
            </p>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <div className="etiquette">Lien d'activation</div>
              <p className="mt-1.5 break-all rounded-xl border border-ligne bg-white px-3 py-2.5 font-mono text-[13px] leading-snug text-encre">{invitation.lien}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <button
                  type="button"
                  onClick={async () => toast((await copier(invitation.lien)) ? "Lien copié" : "Copie impossible : sélectionnez le lien à la main.", "info")}
                  className="flex min-h-[44px] items-center gap-2 text-[15px] font-bold text-orange-fonce hover:text-encre"
                >
                  <Link2 className="h-4 w-4" />
                  Copier le lien
                </button>
                <span className="text-sm text-texte-gris">Valable jusqu'au {dateCourte(invitation.expireLe)}</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5 self-center sm:self-start">
              <Qr texte={invitation.lien} className="w-32 rounded-xl border border-ligne bg-white p-2.5" titre={`QR du lien d'activation de ${nom}`} />
              <span className="text-center text-[13px] text-texte-gris">Ou à scanner avec son téléphone</span>
            </div>
          </div>

          <section className="rounded-2xl border border-ligne p-4">
            <h3 className="flex items-center gap-2 text-base font-extrabold">
              <Mail className="h-4 w-4 text-orange-fonce" /> Par e-mail
            </h3>
            {!invitation.email.disponible ? (
              <p className="mt-1.5 text-[15px] text-texte-pale">Le campus n'envoie pas encore d'e-mails. Envoyez le lien par WhatsApp ou copiez-le dans votre propre messagerie.</p>
            ) : envoyeA ? (
              <p className="mt-2 flex items-center gap-2 text-[15px] font-semibold text-succes">
                <CheckCircle2 className="h-5 w-5" /> Invitation envoyée à {envoyeA}.
              </p>
            ) : (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                <Champ
                  libelle="Adresse e-mail"
                  className="flex-1"
                  type="email"
                  inputMode="email"
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  placeholder="adresse.personnelle@exemple.com"
                  aide={personne.email ? "Celle du compte. Vous pouvez en taper une autre." : "Elle ne sera pas enregistrée : la personne choisira son identifiant en activant son compte."}
                />
                <Bouton variante="encre" onClick={envoyerEmail} chargement={envoi} disabled={!adresse.trim()} className="sm:mb-[26px]">
                  Envoyer
                </Bouton>
              </div>
            )}
          </section>

          {invitation.remplaceUnLien && (
            <p className="flex items-start gap-2 rounded-xl bg-alerte-clair px-4 py-3 text-sm text-alerte">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Le lien envoyé précédemment ne marche plus : seul celui-ci est valable.
            </p>
          )}
        </div>
      )}
    </Fenetre>
  );
}
