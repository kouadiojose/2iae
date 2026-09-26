// Section « 3. La visio de la classe » de /visio/essai : vérifications
// automatiques du réseau, puis la salle d'essai Daily permanente du campus,
// ouverte à tout moment à tout compte connecté, où l'on peut inviter l'écran
// d'une salle de campus, un collègue ou la direction.
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, Wifi } from "lucide-react";
import { post } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useMoiConnecte } from "@/lib/auth";
import { Bouton } from "@/components/ui/bouton";
import { toast } from "@/components/ui/toast";
import type { AccesDaily, Moi, OptionsVisio, ResultatEssaiVisio } from "@shared/schema";
import { PreTestsDaily } from "./PreTestsDaily";
import { SalleVisio } from "./SalleVisio";
import type { RoleCadre } from "./CadreDaily";

export function roleCadreDuCompte(role: Moi["role"]): RoleCadre {
  if (role === "formateur" || role === "admin") return "formateur";
  if (role === "salle" || role === "vie_scolaire") return "salle";
  return "etudiant";
}

export function SectionVisioClasse() {
  const moi = useMoiConnecte();
  const tu = moi.role === "etudiant";
  const t = (a: string, b: string) => (tu ? a : b);
  const camera = moi.role !== "etudiant";
  const { data: options } = useQuery<OptionsVisio>({ queryKey: ["/api/visio/options"] });
  const [resultat, setResultat] = useState<ResultatEssaiVisio | null>(null);
  const dernier = useRef<ResultatEssaiVisio | null>(null);

  const noterEntree = () => {
    const r: ResultatEssaiVisio = { ...(dernier.current ?? { connexion: "ok", qualite: null, camera: null, micro: null }), salle: true };
    void post<Moi>("/api/visio/essai/resultat", r)
      .then((m) => queryClient.setQueryData(["/api/auth/moi"], m))
      .catch(() => undefined);
    toast(t("Bravo : la visio passe sur ton appareil.", "La visio passe : cet essai est noté pour votre prochaine classe."));
  };

  const lien = `${window.location.origin}/visio/essai?avec=1#salle-essai`;
  const bloque = resultat?.connexion === "echec";

  return (
    <section id="salle-essai" className="flex scroll-mt-24 flex-col gap-4" aria-labelledby="titre-visio-classe">
      <h2 id="titre-visio-classe" className="text-xl font-extrabold">
        3. La visio de la classe
      </h2>
      <p className="text-base text-texte-pale">
        {t(
          "La vraie visio du cours. On vérifie d'abord que ton réseau la laisse passer, puis tu peux entrer dans la salle d'essai, ouverte à tout moment.",
          "La vraie visio du cours, celle des cinq salles de conférence. Vérifiez d'abord que votre réseau la laisse passer, puis entrez dans la salle d'essai, ouverte à tout moment, seul ou avec l'écran d'une salle de campus.",
        )}
      </p>

      <h3 className="text-[17px] font-extrabold">Vérifications automatiques</h3>
      {options ? (
        <PreTestsDaily
          tu={tu}
          camera={camera}
          daily={options.daily}
          onResultat={(r) => {
            dernier.current = r;
            setResultat(r);
          }}
        />
      ) : (
        <div className="h-40 animate-pulse rounded-2xl bg-creme" aria-busy="true" />
      )}

      {bloque && (
        <div className="flex flex-col gap-3 rounded-2xl border border-alerte/40 bg-alerte-clair p-4 sm:p-5" role="alert">
          <p className="flex items-start gap-2 text-[15px] font-bold text-encre">
            <Wifi className="mt-0.5 h-5 w-5 shrink-0 text-alerte" aria-hidden />
            {t("Depuis ce réseau, la visio ne passe pas. Le jour du cours :", "Depuis ce réseau, la visio ne passe pas. Le jour du cours :")}
          </p>
          <ul className="flex list-disc flex-col gap-1 pl-10 text-[15px] text-texte-doux">
            {tu ? (
              <>
                <li>Suis le cours en « son + diapos » (radio) : c'est prévu pour ça.</li>
                <li>Ou active un partage de connexion 4G, puis refais la vérification.</li>
              </>
            ) : (
              <>
                <li>Branchez-vous sur un autre réseau ou un partage de connexion 4G, puis relancez la vérification.</li>
                <li>À défaut, passez la classe sur la visio du campus : la radio, les diapos et les questions continuent.</li>
              </>
            )}
          </ul>
          <Bouton variante="contour" icone={<Radio className="h-4 w-4" />} className="min-h-[48px] self-start" onClick={() => document.getElementById("essai-radio")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Essayer la radio du cours
          </Bouton>
        </div>
      )}

      <h3 className="text-[17px] font-extrabold">La salle d'essai</h3>
      <SalleVisio
        nomSalle="Salle d'essai"
        titreBouton="Entrer dans la salle d'essai"
        tu={tu}
        role={roleCadreDuCompte(moi.role)}
        indisponible={options && !options.daily ? t("La visio Daily n'est pas encore reliée au campus : la salle d'essai ouvrira dès qu'elle le sera.", "La visio Daily n'est pas encore reliée au campus : la salle d'essai ouvrira dès qu'elle le sera. En attendant, les cours passent par la visio du campus.") : null}
        obtenirAcces={() => post<AccesDaily>("/api/visio/essai/rejoindre")}
        urlPresence="/api/visio/essai/presence"
        lienPartage={lien}
        messagePartage={tu ? "Rejoins-moi dans la salle d'essai visio du campus 2IAE :" : "Rejoignez-moi dans la salle d'essai visio du campus 2IAE (connectez-vous avec votre compte du campus) :"}
        bandeau={t("Salle d'essai : rien n'est enregistré, et tu en sors tout seul au bout d'une heure.", "Salle d'essai : rien n'est enregistré, et la visite s'arrête seule au bout d'une heure.")}
        aideInvitation={
          tu
            ? undefined
            : "Pour tester avec une salle de conférence, ouvrez ce lien sur l'ordinateur de la salle, connecté avec le compte de l'écran de salle. Un collègue ou la direction peuvent aussi vous rejoindre."
        }
        onRejoint={noterEntree}
        invitation={!tu}
        secours={
          <>
            <p className="text-[14px] text-nuit-doux">{t("Deux essais sans succès. Tu peux :", "Deux essais sans succès. Vous pouvez :")}</p>
            <Bouton variante="nuit-actif" icone={<Radio className="h-4 w-4" />} onClick={() => document.getElementById("essai-radio")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              Essayer la radio du cours
            </Bouton>
          </>
        }
      />
    </section>
  );
}
