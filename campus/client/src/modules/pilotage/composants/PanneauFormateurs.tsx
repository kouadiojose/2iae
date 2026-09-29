// Pilotage · Comptes (direction) : les liens personnels d'inscription des
// formateurs. On crée un lien pour un formateur (nouveau, ou dont la fiche
// existe déjà dans l'emploi du temps), on l'envoie par WhatsApp ou par
// e-mail ; il y crée son compte lui-même, il est connecté aussitôt et reçoit
// son guide pas à pas par e-mail. Chaque lien ne sert qu'une fois.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, GraduationCap, Link2, Mail, MessageCircle, Plus, Trash2 } from "lucide-react";
import { post, suppr } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { dateEtHeure } from "@/lib/dates";
import { Bouton } from "@/components/ui/bouton";
import { Badge } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import type { LienFormateurDto, LiensFormateursDto } from "@shared/schema";

const CLE = ["/api/pilotage/formateurs/liens"];
const CHAMP = "min-h-11 w-full rounded-lg border border-ligne bg-white px-3 text-[14px] outline-none focus:border-orange focus:ring-2 focus:ring-orange/20";

export function PanneauFormateurs() {
  const { data } = useQuery<LiensFormateursDto>({ queryKey: CLE, refetchInterval: 60_000 });
  const [fiche, setFiche] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [dernier, setDernier] = useState<number | null>(null);
  const [voirHistorique, setVoirHistorique] = useState(false);

  const actifs = (data?.liens ?? []).filter((l) => l.statut === "actif");
  const historique = (data?.liens ?? []).filter((l) => l.statut !== "actif");
  const fiches = data?.fichesAActiver ?? [];

  const creer = async () => {
    setEnvoi(true);
    try {
      const corps = fiche ? { compteId: Number(fiche), joursValidite: 30 } : { prenom: prenom.trim(), nom: nom.trim(), joursValidite: 30 };
      const r = await post<LiensFormateursDto & { cree: LienFormateurDto | null }>("/api/pilotage/formateurs/liens", corps);
      queryClient.setQueryData(CLE, r);
      setDernier(r.cree?.id ?? null);
      setFiche("");
      setPrenom("");
      setNom("");
      toast("Lien créé, valable 30 jours. Envoyez-le au formateur.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <section id="formateurs" className="scroll-mt-24 rounded-2xl border border-ligne bg-white p-5" data-testid="panneau-formateurs">
      <div className="flex max-w-2xl flex-col gap-1">
        <h2 className="flex items-center gap-2 text-xl font-extrabold">
          <GraduationCap className="h-5 w-5 text-orange-fonce" /> Formateurs · liens d'inscription
          {actifs.length > 0 && <Badge ton="orange">{actifs.length} en attente</Badge>}
        </h2>
        <p className="text-[14px] leading-relaxed text-texte-doux">
          Un lien par formateur, qui ne sert qu'une fois. Il y entre son nom, son e-mail, son téléphone et son mot de passe : son compte est prêt aussitôt, et son guide pas à pas
          part par e-mail. Si sa fiche existe déjà dans l'emploi du temps, choisissez-la : le lien la complète, ses cours restent les siens.
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-xl bg-creme p-4">
        <label className="flex flex-col gap-1 text-[13px] font-bold text-texte-doux">
          Pour qui ?
          <select value={fiche} onChange={(e) => setFiche(e.target.value)} className={CHAMP} aria-label="Formateur à inviter">
            <option value="">Un nouveau formateur</option>
            {fiches.length > 0 && (
              <optgroup label="Fiches de l'emploi du temps, pas encore activées">
                {fiches.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nom}
                    {f.titre ? ` · ${f.titre}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        {!fiche && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[13px] font-bold text-texte-doux">
              Prénom (facultatif)
              <input value={prenom} onChange={(e) => setPrenom(e.target.value)} className={CHAMP} maxLength={80} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-bold text-texte-doux">
              Nom (facultatif)
              <input value={nom} onChange={(e) => setNom(e.target.value)} className={CHAMP} maxLength={80} />
            </label>
          </div>
        )}
        <div>
          <Bouton taille="sm" icone={<Plus className="h-4 w-4" />} chargement={envoi} onClick={() => void creer()} data-testid="bouton-creer-lien-formateur">
            Créer le lien d'inscription
          </Bouton>
        </div>
      </div>

      {actifs.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          <h3 className="text-[15px] font-extrabold">Liens à utiliser</h3>
          {actifs.map((l) => (
            <CarteLien key={l.id} l={l} miseEnAvant={l.id === dernier} emailDisponible={data?.emailDisponible ?? false} />
          ))}
        </div>
      )}

      {historique.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setVoirHistorique((v) => !v)} className="text-[13px] font-bold text-orange-fonce">
            {voirHistorique ? "Masquer" : "Voir"} les liens déjà utilisés ou fermés ({historique.length})
          </button>
          {voirHistorique && (
            <ul className="mt-2 divide-y divide-ligne-douce text-[14px]">
              {historique.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="font-bold">{l.compteCree?.nom ?? (l.pour || "Formateur sans nom")}</span>
                  {l.compteCree?.email && <span className="text-texte-gris">{l.compteCree.email}</span>}
                  <Badge ton={l.statut === "utilise" ? "succes" : "gris"}>
                    {l.statut === "utilise" ? "Compte créé" : l.statut === "expire" ? "Expiré" : "Désactivé"}
                  </Badge>
                  <span className="ml-auto font-mono text-[12px] text-texte-gris">{dateEtHeure(l.utiliseLe ?? l.expireLe)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function CarteLien({ l, miseEnAvant, emailDisponible }: { l: LienFormateurDto; miseEnAvant: boolean; emailDisponible: boolean }) {
  const [adresse, setAdresse] = useState("");
  const [occupe, setOccupe] = useState(false);

  const copier = async (texte: string, quoi: string) => {
    try {
      await navigator.clipboard.writeText(texte);
      toast(`${quoi} copié.`);
    } catch {
      toast("Copie impossible : sélectionnez le texte à la main.", "erreur");
    }
  };
  const desactiver = async () => {
    if (!window.confirm(`Désactiver le lien${l.pour ? ` de ${l.pour}` : ""} ? Il ne marchera plus.`)) return;
    setOccupe(true);
    try {
      queryClient.setQueryData(CLE, await suppr<LiensFormateursDto>(`/api/pilotage/formateurs/liens/${l.id}`));
      toast("Lien désactivé : il ne marche plus.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setOccupe(false);
    }
  };
  const envoyerEmail = async () => {
    setOccupe(true);
    try {
      const r = await post<{ envoye: boolean; message: string }>(`/api/pilotage/formateurs/liens/${l.id}/email`, { adresse });
      toast(r.message);
      setAdresse("");
    } catch (e) {
      toastErreur(e);
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-4 ${miseEnAvant ? "border-orange bg-orange-pale" : "border-ligne"}`} data-testid="carte-lien-formateur">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[16px] font-extrabold">
          {l.pour || "Nouveau formateur"}
          {l.compteId && <span className="ml-2 text-[13px] font-semibold text-texte-doux">· fiche de l'emploi du temps</span>}
        </p>
        <span className="font-mono text-[12px] text-texte-gris">Valable jusqu'au {dateEtHeure(l.expireLe)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 shrink-0 text-orange-fonce" />
        <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-[13px]" data-testid="url-lien-formateur">
          {l.url}
        </code>
      </div>
      <div className="flex flex-wrap gap-2">
        <Bouton taille="sm" icone={<Copy className="h-4 w-4" />} onClick={() => void copier(l.url, "Lien")}>
          Copier le lien
        </Bouton>
        <Bouton taille="sm" variante="doux" icone={<Copy className="h-4 w-4" />} onClick={() => void copier(l.message, "Message")}>
          Copier le message
        </Bouton>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(l.message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#25D366] px-3 py-2 text-[13px] font-bold text-white no-underline hover:bg-[#1EBE5A]"
        >
          <MessageCircle className="h-4 w-4" /> Envoyer sur WhatsApp
        </a>
        <Bouton taille="sm" variante="fantome" icone={<Trash2 className="h-4 w-4" />} disabled={occupe} onClick={() => void desactiver()}>
          Désactiver
        </Bouton>
      </div>
      {emailDisponible && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void envoyerEmail();
          }}
        >
          <input
            type="email"
            required
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="Son adresse e-mail"
            aria-label={`Adresse e-mail${l.pour ? ` de ${l.pour}` : ""}`}
            className={`${CHAMP} max-w-xs flex-1`}
          />
          <Bouton type="submit" taille="sm" variante="contour" icone={<Mail className="h-4 w-4" />} chargement={occupe}>
            Envoyer par e-mail
          </Bouton>
        </form>
      )}
    </div>
  );
}
