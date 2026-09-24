// Fiche publique du formateur sur www.2iae.com : titre, ville, présentation,
// et le consentement explicite (révocable) avec l'aperçu de la carte telle
// que le site l'affichera. Cocher propose la fiche ; la direction valide la
// publication. Décocher la retire du site aussitôt (CONCEPTION.md §9.10).
import { useEffect, useState, type FormEvent } from "react";
import { Globe, MapPin } from "lucide-react";
import { patch, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Champ, ZoneTexte, CaseACocher } from "@/components/ui/champs";
import { Avatar, Badge, Erreur } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import { nomComplet } from "@/lib/utils";
import type { Moi } from "@shared/schema";
import { majMoi } from "../../outils";
import { Section } from "./Section";

const MAX_BIO = 600;

function EtatPublication({ moi }: { moi: Moi }) {
  if (moi.publierSurSite) return <Badge ton="succes">● En ligne sur 2iae.com</Badge>;
  if (moi.proposeSurSite) return <Badge ton="alerte">Proposée · en attente de la direction</Badge>;
  return <Badge ton="gris">Non publiée</Badge>;
}

/** Aperçu fidèle de la carte « formateur » du site vitrine. */
function ApercuCarte({ moi, titre, localisation, bio }: { moi: Moi; titre: string; localisation: string; bio: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-texte-gris">Aperçu sur 2iae.com</span>
      <article className="overflow-hidden rounded-[22px] border border-ligne bg-white shadow-carte">
        <div className="relative h-20 bg-encre">
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full border-[18px] border-orange" />
          <span className="absolute left-4 top-3 font-mono text-[10px] uppercase tracking-[0.12em] text-orange-peche">Formateur · Campus numérique</span>
        </div>
        <div className="relative -mt-9 flex flex-col gap-2 px-5 pb-5">
          <Avatar prenom={moi.prenom} nom={moi.nom} photo={moi.photoUrl} taille={72} className="ring-4 ring-white" />
          <p className="text-[20px] font-black leading-tight tracking-serre">{nomComplet(moi)}</p>
          {titre ? <p className="text-[15px] font-semibold text-texte-doux">{titre}</p> : <p className="text-[15px] italic text-texte-gris">Votre titre</p>}
          {localisation && (
            <p className="flex items-center gap-1.5 font-mono text-xs text-texte-gris">
              <MapPin className="h-3.5 w-3.5" /> {localisation}
            </p>
          )}
          <p className="line-clamp-4 text-[14px] leading-relaxed text-texte-pale">{bio || "Votre présentation en trois ou quatre lignes."}</p>
        </div>
      </article>
      {!moi.photoUrl && <p className="text-[13px] text-texte-gris">Ajoutez une photo : les fiches avec un visage sont bien plus consultées.</p>}
    </div>
  );
}

export function FicheSite({ moi }: { moi: Moi }) {
  const [titre, setTitre] = useState(moi.titre ?? "");
  const [localisation, setLocalisation] = useState(moi.localisation ?? "");
  const [bio, setBio] = useState(moi.bio ?? "");
  const [consentement, setConsentement] = useState(moi.consentementSite);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    setTitre(moi.titre ?? "");
    setLocalisation(moi.localisation ?? "");
    setBio(moi.bio ?? "");
    setConsentement(moi.consentementSite);
  }, [moi.titre, moi.localisation, moi.bio, moi.consentementSite]);

  const modifie = titre.trim() !== (moi.titre ?? "") || localisation.trim() !== (moi.localisation ?? "") || bio.trim() !== (moi.bio ?? "") || consentement !== moi.consentementSite;

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    if (consentement && !titre.trim()) return setErreur("Indiquez votre titre avant de proposer votre fiche.");
    setErreur(null);
    setEnvoi(true);
    try {
      const avant = moi.consentementSite;
      const m = await patch<Moi>("/api/compte/profil", { titre: titre.trim() || null, localisation: localisation.trim() || null, bio: bio.trim() || null, consentementSite: consentement });
      majMoi(m);
      if (!avant && m.consentementSite) toast("Fiche proposée : la direction va la relire avant publication.");
      else if (avant && !m.consentementSite) toast("Accord retiré : votre fiche n'apparaît plus sur 2iae.com.");
      else toast("Fiche enregistrée.");
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : "Une erreur est survenue. Réessayez dans un instant.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Section
      id="fiche"
      titre="Ma fiche sur 2iae.com"
      icone={<Globe className="h-5 w-5" />}
      description="Les étudiants et les familles découvrent les formateurs sur le site du groupe."
      action={<EtatPublication moi={moi} />}
    >
      <form onSubmit={enregistrer} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]" noValidate>
        <div className="flex flex-col gap-4">
          <Champ libelle="Titre" placeholder="Consultant en intelligence artificielle" maxLength={120} value={titre} onChange={(e) => setTitre(e.target.value)} className="[&_input]:min-h-[52px] [&_input]:text-[16px]" />
          <Champ libelle="Ville et pays" placeholder="Lyon, France" maxLength={80} value={localisation} onChange={(e) => setLocalisation(e.target.value)} className="[&_input]:min-h-[52px] [&_input]:text-[16px]" />
          <ZoneTexte
            libelle="Présentation"
            placeholder="Votre parcours et ce que vous apportez aux étudiants, en trois ou quatre lignes."
            maxLength={MAX_BIO}
            rows={5}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            aide={`${bio.length} / ${MAX_BIO} caractères`}
            className="[&_textarea]:text-[16px]"
          />
          <div className="rounded-2xl bg-creme p-4">
            <CaseACocher
              checked={consentement}
              onChange={setConsentement}
              libelle="Ma fiche peut être publiée sur 2iae.com"
              aide="Nom, photo, titre, ville et présentation. Vous pouvez retirer votre accord à tout moment : la fiche disparaît aussitôt du site."
            />
          </div>
          {erreur && <Erreur message={erreur} />}
          <div>
            <Bouton type="submit" taille="lg" variante={modifie ? "principal" : "contour"} disabled={!modifie} chargement={envoi} className="min-h-[52px] w-full sm:w-auto">
              {consentement && !moi.consentementSite ? "Enregistrer et proposer ma fiche" : "Enregistrer ma fiche"}
            </Bouton>
          </div>
        </div>
        <ApercuCarte moi={moi} titre={titre.trim()} localisation={localisation.trim()} bio={bio.trim()} />
      </form>
    </Section>
  );
}
