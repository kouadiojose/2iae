// Pilotage · Comptes (direction) : le lien d'inscription de l'équipe
// administrative et les demandes d'accès à valider. La personne choisit son
// mot de passe en faisant sa demande ; la direction décide de son accès.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Link2, MessageCircle, Plus, ShieldCheck, Trash2, UserRoundPlus, X } from "lucide-react";
import { post, suppr } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { dateEtHeure } from "@/lib/dates";
import { Bouton } from "@/components/ui/bouton";
import { Badge } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import type { DemandeAccesDto, EquipeInscriptionDto } from "@shared/schema";

const CLE = ["/api/pilotage/equipe"];

export function PanneauEquipe({ sites }: { sites: { id: number; nomCourt: string }[] }) {
  const { data } = useQuery<EquipeInscriptionDto>({ queryKey: CLE, refetchInterval: 60_000 });
  const [envoi, setEnvoi] = useState(false);
  const [voirTraitees, setVoirTraitees] = useState(false);
  const lien = data?.liens[0] ?? null;
  const enAttente = (data?.demandes ?? []).filter((d) => d.statut === "en_attente");
  const traitees = (data?.demandes ?? []).filter((d) => d.statut !== "en_attente");

  const agir = async (fn: () => Promise<EquipeInscriptionDto>, message?: string) => {
    setEnvoi(true);
    try {
      queryClient.setQueryData(CLE, await fn());
      if (message) toast(message);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const copier = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Lien copié.");
    } catch {
      toast("Copie impossible : sélectionnez le lien à la main.", "erreur");
    }
  };
  const message = (url: string) =>
    `Bonjour, voici le lien pour créer votre accès au campus numérique 2IAE (équipe administrative) : ${url}\nRemplissez le formulaire ; la direction validera votre accès et vous recevrez un e-mail.`;

  return (
    <section id="equipe" className="scroll-mt-24 rounded-2xl border border-ligne bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <UserRoundPlus className="h-5 w-5 text-orange-fonce" /> Équipe administrative
            {enAttente.length > 0 && <Badge ton="orange">{enAttente.length} à valider</Badge>}
          </h2>
          <p className="text-[14px] leading-relaxed text-texte-doux">
            Partagez ce lien aux membres de l'administration : chacun crée son accès (nom, e-mail, fonction, mot de passe). Rien n'est ouvert avant votre validation, où vous
            choisissez l'accès : vie scolaire d'un campus, de tous les campus, ou direction.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-creme p-4">
        {lien ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-orange-fonce" />
              <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-[13px]">{lien.url}</code>
            </div>
            <p className="text-[13px] text-texte-gris">
              Valable jusqu'au {dateEtHeure(lien.expireLe)} · {lien.demandes} demande{lien.demandes > 1 ? "s" : ""} reçue{lien.demandes > 1 ? "s" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Bouton taille="sm" icone={<Copy className="h-4 w-4" />} onClick={() => void copier(lien.url)}>
                Copier le lien
              </Bouton>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message(lien.url))}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#25D366] px-3 py-2 text-[13px] font-bold text-white no-underline hover:bg-[#1EBE5A]"
              >
                <MessageCircle className="h-4 w-4" /> Envoyer sur WhatsApp
              </a>
              <Bouton
                taille="sm"
                variante="fantome"
                icone={<Trash2 className="h-4 w-4" />}
                disabled={envoi}
                onClick={() => void agir(() => suppr<EquipeInscriptionDto>(`/api/pilotage/equipe/liens/${lien.id}`), "Lien désactivé : il ne marche plus.")}
              >
                Désactiver
              </Bouton>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-texte-doux">Aucun lien actif pour l'instant.</p>
            <Bouton
              taille="sm"
              icone={<Plus className="h-4 w-4" />}
              chargement={envoi}
              onClick={() => void agir(() => post<EquipeInscriptionDto>("/api/pilotage/equipe/liens", { joursValidite: 30 }), "Lien créé, valable 30 jours.")}
            >
              Créer le lien d'inscription
            </Bouton>
          </div>
        )}
      </div>

      {enAttente.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          <h3 className="text-[15px] font-extrabold">Demandes à valider</h3>
          {enAttente.map((d) => (
            <Demande key={d.id} d={d} sites={sites} onAgir={agir} occupe={envoi} />
          ))}
        </div>
      )}

      {traitees.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setVoirTraitees((v) => !v)} className="text-[13px] font-bold text-orange-fonce">
            {voirTraitees ? "Masquer" : "Voir"} les demandes déjà traitées ({traitees.length})
          </button>
          {voirTraitees && (
            <ul className="mt-2 divide-y divide-ligne-douce text-[14px]">
              {traitees.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="font-bold">
                    {d.prenom} {d.nom}
                  </span>
                  <span className="text-texte-gris">{d.fonction}</span>
                  <Badge ton={d.statut === "acceptee" ? "succes" : "gris"}>{d.statut === "acceptee" ? "Accès validé" : "Refusée"}</Badge>
                  <span className="ml-auto font-mono text-[12px] text-texte-gris">
                    {d.traitePar ? `${d.traitePar} · ` : ""}
                    {d.traiteLe ? dateEtHeure(d.traiteLe) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

type Acces = string; // "vs:" (tous les campus) · "vs:<siteId>" · "admin"

function Demande({ d, sites, onAgir, occupe }: { d: DemandeAccesDto; sites: { id: number; nomCourt: string }[]; onAgir: (fn: () => Promise<EquipeInscriptionDto>, message?: string) => Promise<void>; occupe: boolean }) {
  const [acces, setAcces] = useState<Acces>(d.siteId ? `vs:${d.siteId}` : "vs:");
  const valider = () => {
    const corps = acces === "admin" ? { role: "admin", siteId: null } : { role: "vie_scolaire", siteId: acces.slice(3) ? Number(acces.slice(3)) : null };
    return onAgir(async () => {
      const r = await post<EquipeInscriptionDto & { emailEnvoye: boolean; acces: string }>(`/api/pilotage/equipe/demandes/${d.id}/accepter`, corps);
      toast(r.emailEnvoye ? `Accès validé (${r.acces}). ${d.prenom} est prévenu par e-mail.` : `Accès validé (${r.acces}). Prévenez ${d.prenom} : il peut se connecter avec ${d.email}.`);
      return r;
    });
  };
  const refuser = () => {
    if (!window.confirm(`Refuser la demande de ${d.prenom} ${d.nom} ?`)) return;
    void onAgir(() => post<EquipeInscriptionDto>(`/api/pilotage/equipe/demandes/${d.id}/refuser`, {}), "Demande refusée.");
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ligne p-4 md:flex-row md:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-extrabold">
          {d.prenom} {d.nom} <span className="font-semibold text-texte-doux">· {d.fonction}</span>
        </p>
        <p className="text-[13.5px] text-texte-doux">
          {d.email}
          {d.telephone ? ` · ${d.telephone}` : ""} · {d.site ? `campus ${d.site}` : "siège / tous les campus"}
        </p>
        <p className="font-mono text-[12px] text-texte-gris">Demande du {dateEtHeure(d.creeLe)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={acces}
          onChange={(e) => setAcces(e.target.value)}
          className="min-h-10 rounded-lg border border-ligne bg-white px-2 text-[14px] font-semibold"
          aria-label={`Accès de ${d.prenom} ${d.nom}`}
        >
          <option value="vs:">Vie scolaire · tous les campus</option>
          {sites.map((s) => (
            <option key={s.id} value={`vs:${s.id}`}>
              Vie scolaire · {s.nomCourt}
            </option>
          ))}
          <option value="admin">Direction (tous les droits)</option>
        </select>
        <Bouton
          taille="sm"
          variante={acces === "admin" ? "encre" : "principal"}
          icone={acces === "admin" ? <ShieldCheck className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          disabled={occupe}
          onClick={() => void valider()}
        >
          {acces === "admin" ? "Valider comme direction" : "Valider l'accès"}
        </Bouton>
        <Bouton taille="sm" variante="fantome" icone={<X className="h-4 w-4" />} disabled={occupe} onClick={refuser}>
          Refuser
        </Bouton>
      </div>
    </div>
  );
}
