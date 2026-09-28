// Éditeur · Programme : chapitres et leçons. Ajouter, renommer, remonter ou
// descendre, publier, supprimer ; chaque geste part aussitôt au serveur.
import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, MoreHorizontal, PenLine, Plus, Trash2, X, BookOpen } from "lucide-react";
import { Carte } from "@/components/ui/carte";
import { Bouton } from "@/components/ui/bouton";
import { Champ } from "@/components/ui/champs";
import { Badge, EtatVide } from "@/components/ui/divers";
import { Menu, ElementMenu, SeparateurMenu } from "@/components/ui/menu";
import { toast, toastErreur } from "@/components/ui/toast";
import { patch, post, put, suppr } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { cn, pluriel } from "@/lib/utils";
import { TYPES_LECON_INFOS, dureeLecon } from "../../outils";
import { TitreSectionEditeur } from "./SectionInformations";
import { FenetreLecon, type ModeFenetreLecon } from "./FenetreLecon";
import { Confirmation } from "./Confirmation";
import type { CoursDetail, ChapitreDuCours, LeconDuProgramme } from "@shared/schema";

function BoutonIcone({ libelle, onClick, disabled, children }: { libelle: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={libelle}
      title={libelle}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-texte-doux hover:bg-creme hover:text-encre disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Échange deux éléments d'une liste d'identifiants. */
function echanger(ids: number[], i: number, j: number) {
  const copie = [...ids];
  [copie[i], copie[j]] = [copie[j], copie[i]];
  return copie;
}

export function SectionProgramme({ cours, leconAOuvrir }: { cours: CoursDetail; leconAOuvrir: number | null }) {
  const cle = ["/api/cours", cours.id];
  const [fenetre, setFenetre] = useState<ModeFenetreLecon | null>(leconAOuvrir ? { type: "edition", leconId: leconAOuvrir } : null);
  const [nouveauChapitre, setNouveauChapitre] = useState("");
  const [renommage, setRenommage] = useState<{ id: number; titre: string } | null>(null);
  const [aSupprimer, setASupprimer] = useState<ChapitreDuCours | null>(null);
  const [occupe, setOccupe] = useState(false);

  /** Met à jour la page tout de suite, puis relit le serveur. */
  function appliquerLocalement(transformer: (c: CoursDetail) => CoursDetail) {
    queryClient.setQueryData<CoursDetail>(cle, (c) => (c ? transformer(c) : c));
  }

  async function action<T>(fn: () => Promise<T>, message?: string) {
    setOccupe(true);
    try {
      await fn();
      if (message) toast(message);
    } catch (e) {
      toastErreur(e);
    } finally {
      await rafraichir("/api/cours");
      setOccupe(false);
    }
  }

  async function ajouterChapitre(e: FormEvent) {
    e.preventDefault();
    const titre = nouveauChapitre.trim();
    if (!titre) return;
    await action(async () => {
      await post(`/api/cours/${cours.id}/chapitres`, { titre });
      setNouveauChapitre("");
    }, "Chapitre ajouté.");
  }

  function deplacerChapitre(i: number, sens: -1 | 1) {
    const ids = echanger(
      cours.chapitres.map((c) => c.id),
      i,
      i + sens,
    );
    appliquerLocalement((c) => ({ ...c, chapitres: ids.map((id) => c.chapitres.find((ch) => ch.id === id)!) }));
    void action(() => put(`/api/cours/${cours.id}/chapitres/ordre`, { ids }));
  }

  function deplacerLecon(ch: ChapitreDuCours, i: number, sens: -1 | 1) {
    const ids = echanger(
      ch.lecons.map((l) => l.id),
      i,
      i + sens,
    );
    appliquerLocalement((c) => ({
      ...c,
      chapitres: c.chapitres.map((x) => (x.id === ch.id ? { ...x, lecons: ids.map((id) => x.lecons.find((l) => l.id === id)!) } : x)),
    }));
    void action(() => put(`/api/chapitres/${ch.id}/lecons/ordre`, { ids }));
  }

  function basculerPublication(l: LeconDuProgramme) {
    void action(
      () => patch(`/api/lecons/${l.id}`, { publiee: !l.publiee }),
      l.publiee ? "Leçon repassée en brouillon." : cours.statut === "publie" ? "Leçon publiée : les étudiants sont prévenus." : "Leçon publiée. Les étudiants la verront quand le cours sera publié.",
    );
  }

  async function renommer(e: FormEvent) {
    e.preventDefault();
    if (!renommage?.titre.trim()) return;
    const { id, titre } = renommage;
    setRenommage(null);
    appliquerLocalement((c) => ({ ...c, chapitres: c.chapitres.map((ch) => (ch.id === id ? { ...ch, titre: titre.trim() } : ch)) }));
    await action(() => patch(`/api/chapitres/${id}`, { titre: titre.trim() }));
  }

  async function supprimerChapitre() {
    if (!aSupprimer) return;
    const id = aSupprimer.id;
    await action(() => suppr(`/api/chapitres/${id}`), "Chapitre supprimé.");
    setASupprimer(null);
  }

  const nbPubliees = cours.chapitres.reduce((n, ch) => n + ch.lecons.filter((l) => l.publiee).length, 0);
  const nbBrouillons = cours.chapitres.reduce((n, ch) => n + ch.lecons.filter((l) => !l.publiee).length, 0);

  return (
    <Carte id="programme" className="scroll-mt-24 p-5 sm:p-7">
      <TitreSectionEditeur
        numero="03"
        titre="Programme"
        texte={
          cours.chapitres.length
            ? `${pluriel(cours.chapitres.length, "chapitre")} · ${pluriel(nbPubliees, "leçon publiée", "leçons publiées")} · ${pluriel(nbBrouillons, "brouillon")}`
            : "Organisez le cours en chapitres, puis écrivez les leçons."
        }
      />

      {!cours.chapitres.length && (
        <EtatVide
          icone={<BookOpen className="h-6 w-6" />}
          titre="Commencez par un premier chapitre"
          texte="Un chapitre regroupe quelques leçons (texte, vidéo, PDF, lien). Exemple : « Découvrir l'IA », puis « Parler à l'IA »."
          className="mb-5"
        />
      )}

      <div className={cn("flex flex-col gap-5", occupe && "opacity-80")}>
        {cours.chapitres.map((ch, i) => (
          <section key={ch.id} className="overflow-hidden rounded-2xl border border-ligne" aria-label={`Chapitre ${ch.numero}`}>
            <div className="flex items-center gap-1 bg-creme px-3 py-2 sm:px-4">
              {renommage?.id === ch.id ? (
                <form onSubmit={(e) => void renommer(e)} className="flex flex-1 items-center gap-1 py-1">
                  <Champ
                    aria-label="Titre du chapitre"
                    value={renommage.titre}
                    onChange={(e) => setRenommage({ id: ch.id, titre: e.target.value })}
                    autoFocus
                    maxLength={140}
                    className="flex-1 [&_input]:py-2.5 [&_input]:text-base"
                  />
                  <button
                    type="submit"
                    aria-label="Valider le titre"
                    title="Valider le titre"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-succes hover:bg-white"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <BoutonIcone libelle="Annuler" onClick={() => setRenommage(null)}>
                    <X className="h-5 w-5" />
                  </BoutonIcone>
                </form>
              ) : (
                <>
                  <div className="flex min-w-0 flex-1 flex-col py-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-orange-fonce">Chapitre {ch.numero}</span>
                    <span className="text-lg font-extrabold leading-tight">{ch.titre}</span>
                  </div>
                  <BoutonIcone libelle="Monter le chapitre" onClick={() => deplacerChapitre(i, -1)} disabled={i === 0 || occupe}>
                    <ArrowUp className="h-5 w-5" />
                  </BoutonIcone>
                  <BoutonIcone libelle="Descendre le chapitre" onClick={() => deplacerChapitre(i, 1)} disabled={i === cours.chapitres.length - 1 || occupe}>
                    <ArrowDown className="h-5 w-5" />
                  </BoutonIcone>
                  <Menu
                    declencheur={
                      <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-texte-doux hover:bg-white hover:text-encre" aria-label={`Actions du chapitre ${ch.numero}`}>
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    }
                  >
                    <ElementMenu icone={<PenLine className="h-4 w-4" />} onSelect={() => setRenommage({ id: ch.id, titre: ch.titre })}>
                      Renommer
                    </ElementMenu>
                    <ElementMenu icone={<Plus className="h-4 w-4" />} onSelect={() => setFenetre({ type: "creation", chapitreId: ch.id })}>
                      Ajouter une leçon
                    </ElementMenu>
                    <SeparateurMenu />
                    <ElementMenu icone={<Trash2 className="h-4 w-4" />} danger onSelect={() => setASupprimer(ch)}>
                      Supprimer le chapitre
                    </ElementMenu>
                  </Menu>
                </>
              )}
            </div>

            <ol>
              {ch.lecons.map((l, j) => {
                const I = TYPES_LECON_INFOS[l.type].icone;
                const duree = dureeLecon(l.dureeMinutes);
                return (
                  <li key={l.id} className="flex items-center gap-1 border-t border-ligne-douce px-2 py-1.5 sm:px-3">
                    <button
                      type="button"
                      onClick={() => setFenetre({ type: "edition", leconId: l.id })}
                      className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-creme"
                    >
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", l.publiee ? "bg-orange-clair text-orange-fonce" : "border border-dashed border-ligne-forte text-texte-gris")}>
                        <I className="h-[18px] w-[18px]" />
                      </span>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{l.titre}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-texte-gris">
                          {l.publiee ? <span className="font-mono">Leçon {l.numero}</span> : <Badge ton="alerte">Brouillon</Badge>}
                          <span>{TYPES_LECON_INFOS[l.type].libelle}</span>
                          {duree && <span>· {duree}</span>}
                          {l.aFichier && <span>· fichier joint</span>}
                        </span>
                      </span>
                    </button>
                    <span className="hidden sm:contents">
                      <BoutonIcone libelle="Monter la leçon" onClick={() => deplacerLecon(ch, j, -1)} disabled={j === 0 || occupe}>
                        <ArrowUp className="h-[18px] w-[18px]" />
                      </BoutonIcone>
                      <BoutonIcone libelle="Descendre la leçon" onClick={() => deplacerLecon(ch, j, 1)} disabled={j === ch.lecons.length - 1 || occupe}>
                        <ArrowDown className="h-[18px] w-[18px]" />
                      </BoutonIcone>
                    </span>
                    <Menu
                      declencheur={
                        <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-texte-doux hover:bg-creme hover:text-encre" aria-label={`Actions de la leçon ${l.titre}`}>
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      }
                    >
                      <ElementMenu icone={<PenLine className="h-4 w-4" />} onSelect={() => setFenetre({ type: "edition", leconId: l.id })}>
                        Modifier
                      </ElementMenu>
                      <ElementMenu icone={l.publiee ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} onSelect={() => basculerPublication(l)}>
                        {l.publiee ? "Repasser en brouillon" : "Publier"}
                      </ElementMenu>
                      <SeparateurMenu />
                      <ElementMenu icone={<ArrowUp className="h-4 w-4" />} onSelect={() => j > 0 && deplacerLecon(ch, j, -1)}>
                        Monter
                      </ElementMenu>
                      <ElementMenu icone={<ArrowDown className="h-4 w-4" />} onSelect={() => j < ch.lecons.length - 1 && deplacerLecon(ch, j, 1)}>
                        Descendre
                      </ElementMenu>
                    </Menu>
                  </li>
                );
              })}
              <li className="border-t border-ligne-douce p-2 sm:p-3">
                <Bouton variante="doux" icone={<Plus className="h-4 w-4" />} onClick={() => setFenetre({ type: "creation", chapitreId: ch.id })} className="min-h-[48px] w-full sm:w-auto">
                  Ajouter une leçon
                </Bouton>
              </li>
            </ol>
          </section>
        ))}

        <form onSubmit={(e) => void ajouterChapitre(e)} className="flex flex-col gap-2 rounded-2xl border border-dashed border-ligne-forte p-4 sm:flex-row sm:items-end">
          <Champ
            libelle={cours.chapitres.length ? "Nouveau chapitre" : "Titre du premier chapitre"}
            placeholder="Ex. : Parler à l'IA"
            value={nouveauChapitre}
            onChange={(e) => setNouveauChapitre(e.target.value)}
            maxLength={140}
            className="flex-1 [&_input]:text-base"
          />
          <Bouton type="submit" variante={cours.chapitres.length ? "contour" : "principal"} icone={<Plus className="h-4 w-4" />} disabled={!nouveauChapitre.trim() || occupe} className="min-h-[50px]">
            Ajouter le chapitre
          </Bouton>
        </form>
      </div>

      <FenetreLecon coursId={cours.id} chapitres={cours.chapitres} mode={fenetre} onFermer={() => setFenetre(null)} coursPublie={cours.statut === "publie"} />

      <Confirmation
        ouverte={Boolean(aSupprimer)}
        onFermer={() => setASupprimer(null)}
        titre="Supprimer le chapitre ?"
        texte={
          aSupprimer?.lecons.length
            ? `« ${aSupprimer.titre} » et ses ${pluriel(aSupprimer.lecons.length, "leçon")} seront effacés, avec la progression des étudiants. Cette action est définitive.`
            : `« ${aSupprimer?.titre ?? ""} » sera effacé.`
        }
        libelle="Supprimer"
        variante="danger"
        chargement={occupe}
        onConfirmer={() => void supprimerChapitre()}
      />
    </Carte>
  );
}
