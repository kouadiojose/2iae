// Onglet « Identité et famille » du dossier étudiant : état civil, statut de
// scolarité, remarques et responsables (parents, tuteurs). Lecture par
// défaut ; « Modifier » passe en saisie. Le compte de connexion (nom,
// matricule, téléphone, e-mail, classe) se modifie depuis l'en-tête.
import { useId, useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2, Phone, Mail, UserRound, Save, Info } from "lucide-react";
import type { IdentiteCrm, LienResponsable, StatutScolarite } from "@shared/schema";
import { STATUTS_SCOLARITE, LIBELLES_STATUTS_SCOLARITE, LIENS_RESPONSABLE, LIBELLES_LIENS_RESPONSABLE } from "@shared/schema";
import { Badge } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Champ, Selection, ZoneTexte } from "@/components/ui/champs";
import { toast } from "@/components/ui/toast";
import { patch } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { telephoneLisible } from "../outils";
import { TONS_STATUT, jourCourt, aujourdhui } from "../outils-crm";
import { urlCrm, perimerListes } from "./DossierOutils";

type FormResponsable = { nom: string; lien: LienResponsable; telephone: string; email: string; profession: string; principal: boolean };
type Formulaire = {
  sexe: "" | "F" | "M";
  dateNaissance: string;
  lieuNaissance: string;
  nationalite: string;
  adresse: string;
  whatsapp: string;
  dateInscription: string;
  statut: StatutScolarite;
  remarques: string;
  responsables: FormResponsable[];
};

const MAX_RESPONSABLES = 4;
/** Ces statuts sortent l'étudiant des inscrits : on demande confirmation. */
const STATUTS_A_CONFIRMER: StatutScolarite[] = ["abandon", "transfere", "diplome"];
const LIBELLES_ORIGINE: Record<IdentiteCrm["origine"], string> = {
  saisie: "Saisi au campus",
  import: "Importé depuis Excel",
  site: "Préinscription sur 2iae.com",
};
const LIBELLES_CHAMPS: Record<string, string> = {
  sexe: "Sexe",
  dateNaissance: "Date de naissance",
  lieuNaissance: "Lieu de naissance",
  nationalite: "Nationalité",
  adresse: "Adresse",
  whatsapp: "WhatsApp",
  dateInscription: "Date d'inscription",
  remarques: "Remarques",
  statut: "Statut",
  nom: "nom",
  lien: "lien",
  telephone: "téléphone",
  email: "e-mail",
  profession: "profession",
};

const responsableVide = (principal: boolean): FormResponsable => ({ nom: "", lien: "pere", telephone: "", email: "", profession: "", principal });

const depuisIdentite = (i: IdentiteCrm): Formulaire => ({
  sexe: i.sexe ?? "",
  dateNaissance: i.dateNaissance ?? "",
  lieuNaissance: i.lieuNaissance ?? "",
  nationalite: i.nationalite ?? "",
  adresse: i.adresse ?? "",
  whatsapp: telephoneLisible(i.whatsapp),
  dateInscription: i.dateInscription ?? "",
  statut: i.statut,
  remarques: i.remarques ?? "",
  responsables: i.responsables.map((r) => ({
    nom: r.nom,
    lien: r.lien,
    telephone: telephoneLisible(r.telephone),
    email: r.email ?? "",
    profession: r.profession ?? "",
    principal: r.principal,
  })),
});

/** « responsables.0.email : adresse e-mail invalide » → « Responsable 1, e-mail : adresse e-mail invalide ». */
function messageLisible(message: string): string {
  const m = /^([\w.]+) : (.*)$/.exec(message);
  if (!m) return message;
  const morceaux = m[1].split(".");
  if (morceaux[0] === "responsables" && morceaux.length >= 3) {
    return `Responsable ${Number(morceaux[1]) + 1}, ${LIBELLES_CHAMPS[morceaux[2]] ?? morceaux[2]} : ${m[2]}`;
  }
  return `${LIBELLES_CHAMPS[morceaux[0]] ?? morceaux[0]} : ${m[2]}`;
}

/** Âge en années à partir d'une date AAAA-MM-JJ. */
function age(jour: string): number | null {
  const [a, m, j] = jour.split("-").map(Number);
  if (!a || !m || !j) return null;
  const [ah, mh, jh] = aujourdhui().split("-").map(Number);
  const n = ah - a - (mh < m || (mh === m && jh < j) ? 1 : 0);
  return n >= 0 && n < 120 ? n : null;
}

const vide = (r: FormResponsable) => !r.nom.trim() && !r.telephone.trim() && !r.email.trim() && !r.profession.trim();

export function DossierIdentite({ etudiantId, prenom, identite, onModifierCompte }: { etudiantId: number; prenom: string; identite: IdentiteCrm; onModifierCompte: () => void }) {
  const [f, setF] = useState<Formulaire | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tentative, setTentative] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const commencer = () => {
    setF(depuisIdentite(identite));
    setErreur(null);
    setTentative(false);
  };
  const annuler = () => {
    setF(null);
    setErreur(null);
  };

  const enregistrer = async () => {
    if (!f) return;
    setTentative(true);
    const responsables = f.responsables.filter((r) => !vide(r));
    if (responsables.some((r) => !r.nom.trim())) {
      setErreur("Chaque parent ou tuteur a besoin d'un nom (ou retirez le bloc vide).");
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      await patch(urlCrm(etudiantId), {
        sexe: f.sexe || null,
        dateNaissance: f.dateNaissance || null,
        lieuNaissance: f.lieuNaissance.trim() || null,
        nationalite: f.nationalite.trim() || null,
        adresse: f.adresse.trim() || null,
        whatsapp: f.whatsapp.trim() || null,
        dateInscription: f.dateInscription || null,
        statut: f.statut,
        remarques: f.remarques.trim() || null,
        responsables: responsables.map((r) => ({
          nom: r.nom.trim(),
          lien: r.lien,
          telephone: r.telephone.trim() || null,
          email: r.email.trim() || null,
          profession: r.profession.trim() || null,
          principal: r.principal,
        })),
      });
      toast("Dossier enregistré");
      await Promise.all([rafraichir(urlCrm(etudiantId)), perimerListes(etudiantId)]);
      setF(null);
    } catch (e) {
      setErreur(messageLisible((e as Error).message));
    } finally {
      setEnvoi(false);
    }
  };

  const note = (
    <p className="flex items-start gap-2 rounded-xl bg-creme px-4 py-3 text-sm text-texte-pale">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-texte-gris" aria-hidden="true" />
      <span>
        Nom, prénom, matricule, téléphone, e-mail et classe font partie du compte de connexion : ils se modifient avec{" "}
        <button type="button" onClick={onModifierCompte} className="font-bold text-orange-fonce underline-offset-2 hover:text-encre hover:underline">
          « Modifier » en haut de la page
        </button>
        .
      </span>
    </p>
  );

  if (!f) return <Lecture identite={identite} onModifier={commencer} note={note} />;

  const maj = (champ: Exclude<keyof Formulaire, "responsables" | "statut" | "sexe">) => (e: { target: { value: string } }) => setF((x) => (x ? { ...x, [champ]: e.target.value } : x));
  const majResponsable = (i: number, champs: Partial<FormResponsable>) =>
    setF((x) => (x ? { ...x, responsables: x.responsables.map((r, j) => (j === i ? { ...r, ...champs } : champs.principal ? { ...r, principal: false } : r)) } : x));
  const changerStatut = (s: StatutScolarite) => {
    if (STATUTS_A_CONFIRMER.includes(s) && s !== identite.statut) {
      const ok = window.confirm(`Passer le statut de ${prenom} à « ${LIBELLES_STATUTS_SCOLARITE[s]} » ? Le changement sera daté et noté au journal. Il prend effet à l'enregistrement.`);
      if (!ok) return;
    }
    setF((x) => (x ? { ...x, statut: s } : x));
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <TitreSection titre="État civil et scolarité" />
        <Carte className="flex flex-col gap-4">
          {note}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-encre">Sexe</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Sexe">
              {(
                [
                  ["F", "Féminin"],
                  ["M", "Masculin"],
                  ["", "Non renseigné"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v || "vide"}
                  type="button"
                  role="radio"
                  aria-checked={f.sexe === v}
                  onClick={() => setF((x) => (x ? { ...x, sexe: v } : x))}
                  className={cn(
                    "min-h-[48px] rounded-xl border px-2 text-sm font-bold transition-colors",
                    f.sexe === v ? "border-encre bg-encre text-white" : "border-ligne bg-white text-texte-doux hover:border-orange hover:text-encre",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ libelle="Date de naissance" type="date" max={aujourdhui()} value={f.dateNaissance} onChange={maj("dateNaissance")} />
            <Champ libelle="Lieu de naissance" value={f.lieuNaissance} onChange={maj("lieuNaissance")} maxLength={120} placeholder="Ex. : Bouaké" />
            <Champ libelle="Nationalité" value={f.nationalite} onChange={maj("nationalite")} maxLength={80} placeholder="Ex. : ivoirienne" />
            <Champ libelle="Adresse" value={f.adresse} onChange={maj("adresse")} maxLength={200} placeholder="Commune, quartier" />
            <Champ
              libelle="WhatsApp"
              type="tel"
              inputMode="tel"
              value={f.whatsapp}
              onChange={maj("whatsapp")}
              maxLength={30}
              placeholder="07 07 12 34 56"
              aide="Seulement s'il diffère du téléphone du compte."
            />
            <Champ libelle="Date d'inscription" type="date" value={f.dateInscription} onChange={maj("dateInscription")} />
            <Selection libelle="Statut de scolarité" value={f.statut} onChange={(e) => changerStatut(e.target.value as StatutScolarite)} className="sm:col-span-2">
              {STATUTS_SCOLARITE.map((s) => (
                <option key={s} value={s}>
                  {LIBELLES_STATUTS_SCOLARITE[s]}
                </option>
              ))}
            </Selection>
          </div>
          <ZoneTexte
            libelle="Remarques"
            value={f.remarques}
            onChange={maj("remarques")}
            rows={3}
            maxLength={3000}
            placeholder="Santé, situation particulière, arrangement avec la famille… (jamais visible par l'étudiant)"
          />
        </Carte>
      </section>

      <section>
        <TitreSection titre="Parents et tuteurs" />
        <div className="flex flex-col gap-3">
          {!f.responsables.length && <p className="text-[15px] text-texte-pale">Aucun parent ni tuteur enregistré. Ajoutez au moins la personne à prévenir.</p>}
          {f.responsables.map((r, i) => (
            <BlocResponsable
              key={i}
              index={i}
              r={r}
              erreurNom={tentative && !vide(r) && !r.nom.trim()}
              onChange={(champs) => majResponsable(i, champs)}
              onRetirer={() =>
                setF((x) => {
                  if (!x) return x;
                  const reste = x.responsables.filter((_, j) => j !== i);
                  // Le contact principal retiré : le premier restant le devient.
                  if (reste.length && !reste.some((y) => y.principal)) reste[0] = { ...reste[0], principal: true };
                  return { ...x, responsables: reste };
                })
              }
            />
          ))}
          {f.responsables.length < MAX_RESPONSABLES && (
            <Bouton
              variante="doux"
              icone={<Plus className="h-4 w-4" />}
              className="min-h-[48px] self-start"
              onClick={() => setF((x) => (x ? { ...x, responsables: [...x.responsables, responsableVide(!x.responsables.length)] } : x))}
            >
              Ajouter un parent ou tuteur
            </Bouton>
          )}
        </div>
      </section>

      {erreur && (
        <p className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger" role="alert">
          {erreur}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Bouton variante="fantome" onClick={annuler} disabled={envoi} className="min-h-[48px]">
          Annuler
        </Bouton>
        <Bouton icone={<Save className="h-4 w-4" />} onClick={enregistrer} chargement={envoi} className="min-h-[48px]">
          Enregistrer
        </Bouton>
      </div>
    </div>
  );
}

function BlocResponsable({
  index,
  r,
  erreurNom,
  onChange,
  onRetirer,
}: {
  index: number;
  r: FormResponsable;
  erreurNom: boolean;
  onChange: (champs: Partial<FormResponsable>) => void;
  onRetirer: () => void;
}) {
  const id = useId();
  return (
    <Carte className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-texte-gris">Parent ou tuteur {index + 1}</span>
        <button
          type="button"
          onClick={onRetirer}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-danger hover:bg-danger-clair"
          aria-label={`Retirer le parent ou tuteur ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" /> Retirer
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ libelle="Nom et prénom *" value={r.nom} onChange={(e) => onChange({ nom: e.target.value })} maxLength={120} erreur={erreurNom ? "Le nom est obligatoire." : undefined} />
        <Selection libelle="Lien" value={r.lien} onChange={(e) => onChange({ lien: e.target.value as LienResponsable })}>
          {LIENS_RESPONSABLE.map((l) => (
            <option key={l} value={l}>
              {LIBELLES_LIENS_RESPONSABLE[l]}
            </option>
          ))}
        </Selection>
        <Champ libelle="Téléphone" type="tel" inputMode="tel" value={r.telephone} onChange={(e) => onChange({ telephone: e.target.value })} maxLength={30} placeholder="05 05 11 22 33" />
        <Champ libelle="E-mail" type="email" inputMode="email" value={r.email} onChange={(e) => onChange({ email: e.target.value })} maxLength={160} />
        <Champ libelle="Profession" value={r.profession} onChange={(e) => onChange({ profession: e.target.value })} maxLength={120} className="sm:col-span-2" />
      </div>
      <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-center gap-3">
        <input id={id} type="radio" name="responsable-principal" className="h-5 w-5 shrink-0 accent-[#E4793A]" checked={r.principal} onChange={() => onChange({ principal: true })} />
        <span className="flex flex-col">
          <span className="text-[15px] font-semibold text-encre">Contact principal</span>
          <span className="text-[13px] text-texte-gris">La personne appelée en premier (relances, paiements).</span>
        </span>
      </label>
    </Carte>
  );
}

function Lecture({ identite: i, onModifier, note }: { identite: IdentiteCrm; onModifier: () => void; note: ReactNode }) {
  const a = i.dateNaissance ? age(i.dateNaissance) : null;
  const lignes: [string, ReactNode][] = [
    ["Sexe", i.sexe === "F" ? "Féminin" : i.sexe === "M" ? "Masculin" : null],
    ["Date de naissance", i.dateNaissance ? `${jourCourt(i.dateNaissance)}${a !== null ? ` (${a} ans)` : ""}` : null],
    ["Lieu de naissance", i.lieuNaissance],
    ["Nationalité", i.nationalite],
    ["Adresse", i.adresse],
    ["WhatsApp", i.whatsapp ? telephoneLisible(i.whatsapp) : null],
    ["Date d'inscription", i.dateInscription ? jourCourt(i.dateInscription) : null],
    [
      "Statut",
      <span key="statut" className="inline-flex flex-wrap items-center gap-2">
        <Badge ton={TONS_STATUT[i.statut]}>{LIBELLES_STATUTS_SCOLARITE[i.statut]}</Badge>
        {i.statutLe && <span className="text-sm text-texte-gris">depuis le {jourCourt(i.statutLe)}</span>}
      </span>,
    ],
    ["Origine du dossier", LIBELLES_ORIGINE[i.origine]],
  ];
  return (
    <div className="flex flex-col gap-6">
      <section>
        <TitreSection
          titre="État civil et scolarité"
          action={
            <Bouton variante="contour" taille="sm" icone={<Pencil className="h-4 w-4" />} onClick={onModifier} className="min-h-[44px]">
              Modifier
            </Bouton>
          }
        />
        <Carte className="flex flex-col gap-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {lignes.map(([libelle, valeur]) => (
              <div key={libelle} className="flex flex-col gap-0.5">
                <dt className="font-mono text-xs text-texte-gris">{libelle}</dt>
                <dd className={cn("text-[15px]", valeur ? "font-semibold text-encre" : "text-texte-gris")}>{valeur ?? "Non renseigné"}</dd>
              </div>
            ))}
          </dl>
          {i.remarques && (
            <div className="rounded-xl bg-creme px-4 py-3">
              <div className="font-mono text-xs text-texte-gris">Remarques</div>
              <p className="mt-1 whitespace-pre-line text-[15px] text-texte-doux">{i.remarques}</p>
            </div>
          )}
          {note}
        </Carte>
      </section>

      <section>
        <TitreSection titre="Parents et tuteurs" />
        {!i.responsables.length ? (
          <Carte className="flex flex-col items-start gap-3">
            <p className="text-[15px] text-texte-pale">Aucun parent ni tuteur enregistré. Ajoutez au moins la personne à prévenir : son numéro apparaîtra dans les contacts rapides.</p>
            <Bouton variante="doux" icone={<Plus className="h-4 w-4" />} onClick={onModifier} className="min-h-[48px]">
              Ajouter un parent ou tuteur
            </Bouton>
          </Carte>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {i.responsables.map((r, k) => (
              <Carte key={k} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <UserRound className="h-5 w-5 text-texte-gris" aria-hidden="true" />
                  <span className="text-lg font-extrabold">{r.nom}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge ton="gris">{LIBELLES_LIENS_RESPONSABLE[r.lien]}</Badge>
                  {r.principal && <Badge ton="orange">Contact principal</Badge>}
                </div>
                {r.profession && <p className="text-sm text-texte-pale">{r.profession}</p>}
                <div className="flex flex-col">
                  {r.telephone && (
                    <a href={`tel:${r.telephone}`} className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-encre no-underline hover:text-orange-fonce">
                      <Phone className="h-4 w-4 text-texte-gris" /> {telephoneLisible(r.telephone)}
                    </a>
                  )}
                  {r.email && (
                    <a href={`mailto:${r.email}`} className="inline-flex min-h-[44px] items-center gap-2 break-all font-semibold text-encre no-underline hover:text-orange-fonce">
                      <Mail className="h-4 w-4 shrink-0 text-texte-gris" /> {r.email}
                    </a>
                  )}
                  {!r.telephone && !r.email && <p className="text-sm text-texte-gris">Pas de téléphone ni d'e-mail.</p>}
                </div>
              </Carte>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
