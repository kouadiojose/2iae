// Pilotage · Comptes (direction) : le lien d'inscription de l'équipe
// administrative et les demandes d'accès à valider. La personne choisit son
// mot de passe en faisant sa demande ; la direction décide de son accès :
// un profil de l'équipe (ext-profils.ts) pour un campus ou pour tous, ou la
// direction.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Link2, MessageCircle, Plus, ShieldCheck, Trash2, UserRoundPlus, X } from "lucide-react";
import { post, suppr } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { dateEtHeure } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import { Badge } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { PROFILS_EQUIPE, DROITS_PROFILS, LIBELLES_PROFILS, profilSuggere, type DemandeAccesDto, type EquipeInscriptionDto, type ProfilEquipe } from "@shared/schema";

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
            choisissez son profil (scolarité, vie scolaire, secrétariat / accueil ou responsable pédagogique) et son campus, ou la direction. Le profil se change ensuite
            depuis la fiche du compte.
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
                  {d.statut === "acceptee" && (d.role === "admin" || d.profil) && (
                    <span className="text-texte-doux">{d.role === "admin" ? "Direction" : LIBELLES_PROFILS[d.profil!]}</span>
                  )}
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

/** Accès choisi à la validation : un profil de l'équipe (ext-profils.ts) ou la direction. */
type ChoixAcces = "" | ProfilEquipe | "admin";

function Demande({ d, sites, onAgir, occupe }: { d: DemandeAccesDto; sites: { id: number; nomCourt: string }[]; onAgir: (fn: () => Promise<EquipeInscriptionDto>, message?: string) => Promise<void>; occupe: boolean }) {
  // Profil proposé d'après la fonction saisie (« Secrétaire » : secrétariat / accueil) ; la direction décide.
  const propose = profilSuggere(d.fonction);
  const [acces, setAcces] = useState<ChoixAcces>(propose ?? "");
  // Campus de la personne : celui de sa demande ; vide = tous les campus.
  const [siteId, setSiteId] = useState(d.siteId ? String(d.siteId) : "");
  const nomSite = siteId ? sites.find((s) => String(s.id) === siteId)?.nomCourt : null;

  const valider = () => {
    if (!acces) return;
    const corps = acces === "admin" ? { role: "admin", siteId: null } : { role: "vie_scolaire", profil: acces, siteId: siteId ? Number(siteId) : null };
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
  const libelleValider = !acces
    ? "Choisissez un profil"
    : acces === "admin"
      ? "Valider comme direction"
      : `Valider : ${DROITS_PROFILS[acces].libelle}, ${nomSite ? `campus ${nomSite}` : "tous les campus"}`;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-ligne p-4">
      <div className="min-w-0">
        <p className="text-[16px] font-extrabold">
          {d.prenom} {d.nom} <span className="font-semibold text-texte-doux">· {d.fonction}</span>
        </p>
        <p className="text-[13.5px] text-texte-doux">
          {d.email}
          {d.telephone ? ` · ${d.telephone}` : ""} · {d.site ? `campus ${d.site}` : "siège / tous les campus"}
        </p>
        <p className="font-mono text-[12px] text-texte-gris">Demande du {dateEtHeure(d.creeLe)}</p>
      </div>

      <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 text-sm font-bold text-encre">
          Profil : ce que {d.prenom} pourra voir et faire
          {propose && <span className="ml-1 font-semibold text-texte-gris">(proposé d'après sa fonction : {DROITS_PROFILS[propose].libelle})</span>}
        </legend>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {PROFILS_EQUIPE.map((p) => (
            <ChoixProfil key={p} nom={`acces-${d.id}`} choisi={acces === p} onChoisir={() => setAcces(p)} titre={DROITS_PROFILS[p].libelle} texte={DROITS_PROFILS[p].description} />
          ))}
          <ChoixProfil
            nom={`acces-${d.id}`}
            choisi={acces === "admin"}
            onChoisir={() => setAcces("admin")}
            titre="Direction"
            texte="Tous les droits sur tous les campus, y compris valider les accès de l'équipe et changer les profils."
          />
        </div>
      </fieldset>

      {acces !== "admin" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-encre">Campus</span>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="min-h-11 rounded-lg border border-ligne bg-white px-3 text-[14px] font-semibold md:max-w-sm"
            aria-label={`Campus de ${d.prenom} ${d.nom}`}
          >
            <option value="">Tous les campus (tout le groupe)</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nomCourt} seulement
              </option>
            ))}
          </select>
          <span className="text-[13px] text-texte-gris">Avec un campus, la personne ne voit que les étudiants, les classes et les présences de ce campus.</span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Bouton
          taille="sm"
          variante={acces === "admin" ? "encre" : "principal"}
          icone={acces === "admin" ? <ShieldCheck className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          disabled={occupe || !acces}
          onClick={() => void valider()}
        >
          {libelleValider}
        </Bouton>
        <Bouton taille="sm" variante="fantome" icone={<X className="h-4 w-4" />} disabled={occupe} onClick={refuser}>
          Refuser
        </Bouton>
      </div>
    </div>
  );
}

function ChoixProfil({ nom, choisi, onChoisir, titre, texte }: { nom: string; choisi: boolean; onChoisir: () => void; titre: string; texte: string }) {
  return (
    <label className={cn("flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors", choisi ? "border-orange bg-orange-pale" : "border-ligne bg-white hover:border-orange")}>
      <input type="radio" name={nom} className="mt-1 h-4 w-4 shrink-0 accent-[#E4793A]" checked={choisi} onChange={onChoisir} />
      <span className="min-w-0">
        <span className="block font-bold text-encre">{titre}</span>
        <span className="block text-[13px] leading-snug text-texte-pale">{texte}</span>
      </span>
    </label>
  );
}
