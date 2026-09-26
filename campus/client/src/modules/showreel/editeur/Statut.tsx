// Où en est la présentation, et l'action qui suit : le formateur valide (il
// consent à la publication), la direction envoie pour validation ou publie
// (en confirmant avoir l'accord du formateur s'il n'a pas validé lui-même).
import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Circle, ExternalLink, EyeOff, Send, Share2, ShieldCheck } from "lucide-react";
import { post, ErreurApi } from "@/lib/api";
import { Bouton } from "@/components/ui/bouton";
import { Badge, Erreur } from "@/components/ui/divers";
import { CaseACocher } from "@/components/ui/champs";
import { Fenetre } from "@/components/ui/fenetre";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ShowreelEditionDto } from "@shared/schema";
import { dateHeure, dateJour, textes } from "./communs";

function Etape({ fait, children }: { fait: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-snug">
      {fait ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-succes" aria-hidden /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-texte-gris" aria-hidden />}
      <span className={fait ? "text-encre" : "text-texte-pale"}>{children}</span>
    </li>
  );
}

export function BadgeStatut({ d }: { d: Pick<ShowreelEditionDto, "statut" | "enLigne" | "modificationsNonPubliees" | "valideLe"> }) {
  if (d.enLigne && !d.modificationsNonPubliees) return <Badge ton="succes">● En ligne</Badge>;
  if (d.enLigne) return <Badge ton="alerte">En ligne · modifications non publiées</Badge>;
  if (d.statut === "a_valider") return <Badge ton="alerte">{d.valideLe ? "Validée · à publier" : "À valider"}</Badge>;
  return <Badge ton="gris">Brouillon</Badge>;
}

export function Statut({ d, modifie, surMaj }: { d: ShowreelEditionDto; modifie: boolean; surMaj: (x: ShowreelEditionDto) => void }) {
  const { t, nom } = textes(d);
  const cible = d.estMoi ? "moi" : String(d.formateur.id);
  const [dialogue, setDialogue] = useState<"valider" | "publier" | "retirer" | null>(null);
  const [accord, setAccord] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const bloquants = d.verification.bloquants;

  async function agir(action: "valider" | "publier" | "retirer" | "soumettre") {
    setErreur(null);
    setEnvoi(true);
    try {
      const x = await post<ShowreelEditionDto>(`/api/showreels/${cible}/${action}`, action === "publier" ? { accordConfirme: accord } : {});
      surMaj(x);
      setDialogue(null);
      setAccord(false);
      toast(
        action === "valider"
          ? "Présentation validée : la direction va la publier."
          : action === "publier"
            ? "Présentation publiée : elle se voit sur la page du formateur."
            : action === "soumettre"
              ? `Envoyée à ${nom} pour validation.`
              : "Présentation retirée du site.",
      );
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "L'action n'a pas abouti. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  const valideCetteVersion = Boolean(d.valideLe && d.statut !== "brouillon");
  return (
    <div className="flex flex-col gap-4 rounded-[22px] border border-ligne bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">Où en est-elle ?</p>
        <BadgeStatut d={d} />
      </div>
      <ol className="flex flex-col gap-2">
        <Etape fait={Boolean(d.composeLe)}>{d.composeLe ? `Composée le ${dateJour(d.composeLe)}${d.retouche ? ", retouchée à la main" : ""}` : "Composer la présentation"}</Etape>
        <Etape fait={valideCetteVersion || d.accordDirection}>
          {valideCetteVersion ? `Validée par ${t("vous", nom)} le ${dateJour(d.valideLe!)}` : d.accordDirection && d.enLigne ? "Accord du formateur confirmé par la direction" : t("Votre validation (vous consentez à la publication)", `Validation par ${nom}${d.soumisLe ? ` (envoyée le ${dateJour(d.soumisLe)})` : ""}`)}
        </Etape>
        <Etape fait={d.enLigne}>{d.enLigne && d.publieLe ? `Publiée le ${dateHeure(d.publieLe)}${d.publiePar && !d.estMoi ? ` par ${d.publiePar}` : ""}` : "Publication par la direction"}</Etape>
      </ol>

      {d.modificationsNonPubliees && <p className="rounded-xl bg-alerte-clair px-3 py-2 text-[14px] text-alerte">La version en ligne reste celle publiée le {d.publieLe ? dateJour(d.publieLe) : "…"} tant que ces modifications ne sont pas validées et publiées.</p>}
      {d.enLigne && !d.urlPublique && (
        <p className="rounded-xl bg-alerte-clair px-3 py-2 text-[14px] text-alerte">
          {t("Votre fiche", "Sa fiche")} n'est pas publiée sur le site en ce moment (accord retiré ou fiche retirée) : la présentation ne se voit pas.
        </p>
      )}
      {bloquants.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl bg-danger-clair px-3 py-2 text-[14px] text-danger">
          {bloquants.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {d.verification.conseils.length > 0 && (
        <ul className="flex flex-col gap-1 text-[13px] text-texte-pale">
          {d.verification.conseils.map((c) => (
            <li key={c}>· {c}</li>
          ))}
        </ul>
      )}
      {modifie && <p className="text-[14px] font-semibold text-alerte">Enregistrez d'abord vos modifications.</p>}

      <div className="flex flex-col gap-2">
        {d.estMoi && !valideCetteVersion && !(d.enLigne && !d.modificationsNonPubliees) && (
          <Bouton taille="lg" icone={<ShieldCheck className="h-5 w-5" />} disabled={modifie || bloquants.length > 0} onClick={() => setDialogue("valider")} className="min-h-[52px]">
            Valider ma présentation
          </Bouton>
        )}
        {d.estMoi && valideCetteVersion && !d.enLigne && <p className="rounded-xl bg-succes-clair px-3 py-2 text-[14px] text-succes">Merci ! La direction publie votre présentation dès qu'elle l'a relue.</p>}
        {d.peut.soumettre && (
          <Bouton variante={d.peut.publier ? "contour" : "principal"} icone={<Send className="h-4 w-4" />} disabled={modifie || bloquants.length > 0} chargement={envoi && dialogue === null} onClick={() => void agir("soumettre")}>
            Envoyer à {nom} pour validation
          </Bouton>
        )}
        {d.peut.publier && (
          <Bouton taille="lg" icone={<Share2 className="h-5 w-5" />} disabled={modifie || bloquants.length > 0} onClick={() => setDialogue("publier")} className="min-h-[52px]">
            {d.enLigne ? "Publier les modifications" : "Publier la présentation"}
          </Bouton>
        )}
        {d.urlPublique && (
          <Link href={new URL(d.urlPublique).pathname} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-creme px-4 text-[15px] font-bold text-encre no-underline hover:bg-orange-clair hover:text-encre">
            <ExternalLink className="h-4 w-4" /> Voir la page publique
          </Link>
        )}
        {d.peut.retirer && (
          <Bouton variante="fantome" icone={<EyeOff className="h-4 w-4" />} onClick={() => setDialogue("retirer")} className="text-danger hover:text-danger">
            Retirer du site
          </Bouton>
        )}
      </div>
      {erreur && dialogue === null && <Erreur message={erreur} />}

      <Fenetre
        ouverte={dialogue === "valider"}
        onFermer={() => setDialogue(null)}
        titre="Valider ma présentation"
        description="En validant, vous acceptez que cette présentation soit publiée."
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setDialogue(null)}>
              Pas encore
            </Bouton>
            <Bouton chargement={envoi} onClick={() => void agir("valider")}>
              Je valide
            </Bouton>
          </>
        }
      >
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] text-texte-doux">
          <li>Elle pourra être publiée sur votre page du site du campus et sur 2iae.com, avec votre nom, votre photo et ces textes, et partagée sur WhatsApp.</li>
          <li>Votre fiche de formateur est proposée à la publication en même temps.</li>
          <li>Vous pouvez la retirer à tout moment depuis cette page : elle disparaît aussitôt du site.</li>
        </ul>
        {erreur && <Erreur className="mt-3" message={erreur} />}
      </Fenetre>

      <Fenetre
        ouverte={dialogue === "publier"}
        onFermer={() => setDialogue(null)}
        titre={d.enLigne ? "Publier les modifications" : `Publier la présentation de ${nom}`}
        description="Elle se verra sur sa page du site du campus, et pourra être partagée."
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setDialogue(null)}>
              Annuler
            </Bouton>
            <Bouton chargement={envoi} disabled={!valideCetteVersion && !accord} onClick={() => void agir("publier")}>
              Publier
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-[15px] text-texte-doux">
          {valideCetteVersion ? (
            <p className="flex items-start gap-2 rounded-xl bg-succes-clair px-3 py-2 text-succes">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {nom} a validé cette version le {dateJour(d.valideLe!)}.
            </p>
          ) : (
            <>
              <p>{nom} n'a pas validé cette version dans le campus. Une présentation n'est publiée qu'avec l'accord du formateur.</p>
              <div className={cn("rounded-xl border p-3", accord ? "border-orange bg-orange-pale" : "border-ligne")}>
                <CaseACocher checked={accord} onChange={setAccord} libelle={`J'ai l'accord de ${nom} pour publier cette présentation`} aide="Son nom, sa photo et ces textes. Cette confirmation est notée au journal." />
              </div>
            </>
          )}
          <p>Sa fiche de formateur sera aussi publiée sur le site du campus et sur 2iae.com.</p>
          {erreur && <Erreur message={erreur} />}
        </div>
      </Fenetre>

      <Fenetre
        ouverte={dialogue === "retirer"}
        onFermer={() => setDialogue(null)}
        titre="Retirer la présentation du site ?"
        description="Elle disparaît aussitôt de la page publique. Le brouillon reste ici, prêt à être republié."
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setDialogue(null)}>
              Annuler
            </Bouton>
            <Bouton variante="danger" chargement={envoi} onClick={() => void agir("retirer")}>
              Retirer
            </Bouton>
          </>
        }
      >
        {erreur && <Erreur message={erreur} />}
      </Fenetre>
    </div>
  );
}
