// Création d'un cours : un code et un titre suffisent ; tout le reste se
// règle ensuite dans l'éditeur. Le cours naît en brouillon.
import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Champ, Selection } from "@/components/ui/champs";
import { toast } from "@/components/ui/toast";
import { useMoiConnecte, estEquipe } from "@/lib/auth";
import { post, ErreurApi } from "@/lib/api";
import { rafraichir, queryClient } from "@/lib/queryClient";
import type { CoursDetail, OptionsEditionCours } from "@shared/schema";

export default function PageNouveauCours() {
  const moi = useMoiConnecte();
  const equipe = estEquipe(moi.role);
  const [, naviguer] = useLocation();
  const { data: options } = useQuery<OptionsEditionCours>({ queryKey: ["/api/cours/options"], enabled: equipe });
  const [code, setCode] = useState("");
  const [titre, setTitre] = useState("");
  const [formateurId, setFormateurId] = useState("");
  const [erreurs, setErreurs] = useState<{ code?: string; titre?: string; general?: string }>({});
  const [envoi, setEnvoi] = useState(false);

  async function creer(e: FormEvent) {
    e.preventDefault();
    const codePropre = code.trim().toUpperCase();
    const locales: typeof erreurs = {};
    if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(codePropre)) locales.code = "Un code court, en lettres, chiffres et tirets : « IA-101 », « ENT-210 ».";
    if (titre.trim().length < 3) locales.titre = "Donnez un titre d'au moins 3 lettres.";
    setErreurs(locales);
    if (Object.keys(locales).length) return;
    setEnvoi(true);
    try {
      const c = await post<CoursDetail>("/api/cours", {
        code: codePropre,
        titre: titre.trim(),
        ...(equipe && formateurId ? { formateurId: Number(formateurId) } : {}),
      });
      queryClient.setQueryData(["/api/cours", c.id], c);
      void rafraichir("/api/cours");
      toast("Cours créé. Ajoutez maintenant la description et les leçons.");
      naviguer(`/enseigner/cours/${c.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof ErreurApi && err.statut === 409) setErreurs({ code: message });
      else setErreurs({ general: message });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Page className="max-w-[720px]">
      <LienBouton href="/cours" variante="fantome" taille="sm" icone={<ArrowLeft className="h-4 w-4" />} className="-mb-3 -ml-2 self-start">
        Mes cours
      </LienBouton>
      <EnTetePage
        etiquette="Nouveau cours"
        titre="Créer un cours"
        sousTitre="Un code et un titre suffisent pour commencer. Vous ajouterez ensuite la description, les classes et les leçons ; le cours reste en brouillon tant que vous ne le publiez pas."
      />
      <Carte className="p-5 sm:p-7">
        <form onSubmit={(e) => void creer(e)} className="flex flex-col gap-5" noValidate>
          <Champ
            libelle="Code du cours"
            placeholder="MKT-150"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            erreur={erreurs.code}
            aide="Il apparaît sur les cartes, le planning et les notifications."
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={20}
            className="[&_input]:font-mono [&_input]:text-base"
          />
          <Champ
            libelle="Titre du cours"
            placeholder="Marketing digital pour les PME"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            erreur={erreurs.titre}
            maxLength={140}
            className="[&_input]:text-base"
          />
          {equipe && (
            <Selection libelle="Formateur" value={formateurId} onChange={(e) => setFormateurId(e.target.value)} aide="Il sera prévenu et pourra préparer ses leçons." className="[&_select]:text-base">
              <option value="">À choisir plus tard</option>
              {options?.formateurs?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.prenom} {f.nom}
                  {f.localisation ? ` · ${f.localisation}` : ""}
                </option>
              ))}
            </Selection>
          )}
          {erreurs.general && <p className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">{erreurs.general}</p>}
          <Bouton type="submit" taille="lg" chargement={envoi} icone={<Plus className="h-5 w-5" />} className="min-h-[52px] sm:self-start">
            Créer le cours
          </Bouton>
        </form>
      </Carte>
    </Page>
  );
}
