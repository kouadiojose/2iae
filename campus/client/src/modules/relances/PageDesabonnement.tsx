// /desabonnement (publique, sans connexion) : où mène le lien « Ne plus
// recevoir ces e-mails ». Le désabonnement est déjà fait côté serveur (un seul
// geste depuis l'e-mail) ; la page le confirme et permet de revenir sur ce choix.
import { useState } from "react";
import { useSearch } from "wouter";
import { MailCheck, MailX, MailWarning } from "lucide-react";
import { t } from "@shared/textes/relances";
import { post, ErreurApi } from "@/lib/api";
import { Marque } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { toast } from "@/components/ui/toast";

type Etat = "fait" | "reabonne" | "invalide";
const tu = { registre: "tu" as const };

export default function PageDesabonnement() {
  const recherche = new URLSearchParams(useSearch());
  const jeton = recherche.get("j") ?? "";
  const [etat, setEtat] = useState<Etat>(recherche.get("etat") === "fait" && jeton ? "fait" : "invalide");
  const [envoi, setEnvoi] = useState(false);

  async function choisir(action: "reabonner" | "desabonner") {
    setEnvoi(true);
    try {
      const r = await post<{ etat: Etat }>(`/api/emails/desabonner/${encodeURIComponent(jeton)}`, { action });
      setEtat(r.etat);
    } catch (e) {
      toast(e instanceof ErreurApi ? e.message : "Une erreur est survenue.", "erreur");
    } finally {
      setEnvoi(false);
    }
  }

  const icone = etat === "fait" ? <MailX className="h-7 w-7" /> : etat === "reabonne" ? <MailCheck className="h-7 w-7" /> : <MailWarning className="h-7 w-7" />;
  return (
    <main className="flex min-h-[100dvh] flex-col items-center bg-creme px-4 py-8">
      <div className="w-full max-w-[460px]">
        <Marque />
        <section className="mt-8 rounded-[22px] border border-ligne bg-white p-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-clair text-orange-fonce">{icone}</span>
          <h1 className="mt-4 text-[26px] font-black leading-tight">{t(`desabonnement.titre.${etat}`, tu)}</h1>
          <p className="mt-2 text-[16px] leading-relaxed text-texte-doux">{t(`desabonnement.texte.${etat}`, tu)}</p>
          <div className="mt-6 flex flex-col gap-2">
            {etat === "fait" && (
              <Bouton variante="contour" className="min-h-[48px]" chargement={envoi} onClick={() => void choisir("reabonner")}>
                {t("desabonnement.reabonner", tu)}
              </Bouton>
            )}
            <LienBouton href="/" className="min-h-[48px]">
              {t("desabonnement.campus", tu)}
            </LienBouton>
          </div>
        </section>
      </div>
    </main>
  );
}
