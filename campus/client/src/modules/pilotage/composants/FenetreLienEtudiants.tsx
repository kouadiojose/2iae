// « Lien d'inscription » des étudiants (Pilotage, Étudiants) : un lien pour
// tous les campus, ou un par campus, à partager dans les groupes WhatsApp des
// classes. L'étudiant y crée son compte lui-même ; la vie scolaire de son
// campus est prévenue et vérifie son dossier. « Remplacer » crée un lien neuf :
// l'ancien ne marche plus.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Link2, MessageCircle, RefreshCw, Trash2, Users } from "lucide-react";
import type { InscriptionEtudiantsDto, LienEtudiantsDto } from "@shared/schema";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Selection } from "@/components/ui/champs";
import { Erreur, Squelette } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { post, suppr } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { dateCourte } from "@/lib/dates";
import { pluriel } from "@/lib/utils";
import { Qr } from "./Qr";
import { copier } from "../outils";

const CLE = ["/api/pilotage/inscription-etudiants"];

export function FenetreLienEtudiants({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  const { data, error, isLoading } = useQuery<InscriptionEtudiantsDto>({ queryKey: CLE, enabled: ouverte });
  const [site, setSite] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const creer = async (siteId: number | null) => {
    setEnvoi(true);
    try {
      queryClient.setQueryData(CLE, await post<InscriptionEtudiantsDto>(`${CLE[0]}/liens`, { siteId }));
      toast("Lien prêt, valable 60 jours. Partagez-le aux étudiants.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const desactiver = async (l: LienEtudiantsDto) => {
    if (!window.confirm(`Désactiver ce lien (${l.libelle}) ? Les comptes déjà créés restent ouverts.`)) return;
    try {
      queryClient.setQueryData(CLE, await suppr<InscriptionEtudiantsDto>(`${CLE[0]}/liens/${l.id}`));
      toast("Lien désactivé.");
    } catch (e) {
      toastErreur(e);
    }
  };

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      large
      titre="Lien d'inscription des étudiants"
      description="À partager dans les groupes WhatsApp des classes. L'étudiant crée son compte lui-même (classe, téléphone, code secret) : il est connecté aussitôt, reçoit son guide et les alertes des cours en direct. La vie scolaire de son campus est prévenue."
    >
      {error ? (
        <Erreur message={(error as Error).message} />
      ) : isLoading || !data ? (
        <div className="flex flex-col gap-3 pb-2" aria-busy="true">
          <Squelette className="h-24" />
          <Squelette className="h-16" />
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          {data.liens.map((l) => (
            <section key={l.id} className="rounded-2xl border border-ligne p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-extrabold">{l.site ? `Campus ${l.site}` : "Tous les campus"}</h3>
                <span className="flex items-center gap-1.5 text-sm text-texte-gris">
                  <Users className="h-4 w-4" /> {pluriel(l.inscrits, "inscrit")} · jusqu'au {dateCourte(l.expireLe)}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="break-all rounded-xl border border-ligne bg-white px-3 py-2.5 font-mono text-[13px] leading-snug text-encre">{l.url}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Bouton variante="contour" taille="sm" icone={<Link2 className="h-4 w-4" />} onClick={async () => toast((await copier(l.url)) ? "Lien copié" : "Copie impossible : sélectionnez le lien à la main.", "info")}>
                      Copier le lien
                    </Bouton>
                    <Bouton variante="contour" taille="sm" icone={<Copy className="h-4 w-4" />} onClick={async () => toast((await copier(l.message)) ? "Message copié" : "Copie impossible.", "info")}>
                      Copier le message
                    </Bouton>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(l.message)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-orange px-3 text-[14px] font-bold text-encre no-underline hover:bg-encre hover:text-white"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                    <button type="button" onClick={() => void creer(l.siteId)} disabled={envoi} className="flex min-h-[40px] items-center gap-1.5 text-[14px] font-bold text-orange-fonce hover:text-encre">
                      <RefreshCw className="h-4 w-4" /> Remplacer par un lien neuf
                    </button>
                    <button type="button" onClick={() => void desactiver(l)} className="flex min-h-[40px] items-center gap-1.5 text-[14px] font-bold text-texte-gris hover:text-danger">
                      <Trash2 className="h-4 w-4" /> Désactiver
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5 self-center sm:self-start">
                  <Qr texte={l.url} className="w-32 rounded-xl border border-ligne bg-white p-2.5" titre={`QR du lien d'inscription (${l.libelle})`} />
                  <span className="text-center text-[13px] text-texte-gris">À projeter en classe</span>
                </div>
              </div>
            </section>
          ))}

          <section className="flex flex-col gap-2 rounded-2xl bg-creme p-4 sm:flex-row sm:items-end">
            <Selection libelle={data.liens.length ? "Créer un autre lien" : "Créer le lien"} className="flex-1" value={site} onChange={(e) => setSite(e.target.value)}>
              {data.sites.length > 1 && <option value="">Tous les campus (l'étudiant choisit le sien)</option>}
              {data.sites.map((s) => (
                <option key={s.id} value={s.id}>
                  Campus {s.nomCourt} seulement
                </option>
              ))}
            </Selection>
            <Bouton onClick={() => void creer(site ? Number(site) : data.sites.length === 1 ? data.sites[0].id : null)} chargement={envoi} className="sm:mb-[2px]">
              Créer le lien
            </Bouton>
          </section>
        </div>
      )}
    </Fenetre>
  );
}
