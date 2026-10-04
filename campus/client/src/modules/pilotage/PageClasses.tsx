// /pilotage/classes : les classes de chaque campus (effectif, activation,
// cours suivis), leur création et les fiches des non-activés ; puis les
// campus eux-mêmes (salle de conférence, WhatsApp de la vie scolaire).
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Printer, Users, School, MessageCircle, MonitorSmartphone, Layers } from "lucide-react";
import type { BilanClassesFilieres, ClasseLigne, PageComptes, SiteLigne } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { BarreProgression, Chargement, Erreur, EtatVide, Badge } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { TitreSection } from "@/components/ui/carte";
import { Fenetre } from "@/components/ui/fenetre";
import { Champ, Selection } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import { get, post, patch, suppr, ErreurApi } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { pluriel } from "@/lib/utils";
import { useMoiConnecte, profilPermet } from "@/lib/auth";
import { SousNav } from "./composants/SousNav";
import { FenetreEcran } from "./composants/FenetreEcran";
import { useReferences, telephoneLisible, lienFiches, pourcent } from "./outils";

type Formulaire = { nom: string; siteId: string; filiere: string; niveau: string; anneeScolaire: string };

function anneeCourante() {
  const d = new Date();
  const a = d.getUTCMonth() >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${a}-${a + 1}`;
}

export default function PageClasses() {
  const refs = useReferences();
  // Ce que le profil permet (ext-profils.ts) : les autres profils consultent les classes.
  const moi = useMoiConnecte();
  const peutClasses = profilPermet(moi, "classes");
  const peutEcran = profilPermet(moi, "outils_campus");
  const { data, isLoading, error, refetch } = useQuery<ClasseLigne[]>({ queryKey: ["/api/pilotage/classes"] });
  const [edition, setEdition] = useState<ClasseLigne | "nouvelle" | null>(null);
  const [site, setSite] = useState<SiteLigne | null>(null);
  const [ecran, setEcran] = useState<{ id: number; nom: string } | null>(null);
  const sites = refs.data?.sites ?? [];
  const [filieresEnCours, setFilieresEnCours] = useState(false);

  // Les classes des filières de 2iae.com : on montre d'abord ce qui sera créé, puis on crée.
  const creerFilieres = async () => {
    setFilieresEnCours(true);
    try {
      const sim = await post<BilanClassesFilieres>("/api/pilotage/classes/filieres", { simulation: true });
      if (!sim.creees.length) return toast("Toutes les classes des filières existent déjà.", "info");
      const parCampus = [...new Set(sim.creees.map((c) => c.campus))].map((campus) => `${campus} : ${sim.creees.filter((c) => c.campus === campus).length}`).join(", ");
      const confirme = window.confirm(
        `Créer ${sim.creees.length} classes pour ${sim.anneeScolaire} (${parCampus}) ?\n\nUne classe par BTS de chaque campus et par année, plus les licences (L1 à L3) et les certificats. Chaque classe BTS reçoit les cours et l'emploi du temps du tronc commun de son année.`,
      );
      if (!confirme) return;
      const r = await post<BilanClassesFilieres>("/api/pilotage/classes/filieres", { simulation: false });
      toast(`${pluriel(r.creees.length, "classe créée", "classes créées")} · ${pluriel(r.liensCours, "cours rattaché", "cours rattachés")} depuis le tronc commun.`);
      void rafraichir("/api/pilotage/classes");
    } catch (e) {
      toastErreur(e);
    } finally {
      setFilieresEnCours(false);
    }
  };

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Classes et campus"
        titre="Classes et campus"
        sousTitre="Une classe regroupe les étudiants d'un campus, d'une filière et d'un niveau. Les cours sont suivis par des classes."
        actions={
          <>
            {peutClasses && (
              <Bouton taille="lg" icone={<Plus className="h-5 w-5" />} onClick={() => setEdition("nouvelle")} className="min-h-[52px]">
                Nouvelle classe
              </Bouton>
            )}
            {refs.data?.estDirection && (
              <Bouton taille="lg" variante="contour" icone={<Layers className="h-5 w-5" />} onClick={() => void creerFilieres()} chargement={filieresEnCours} className="min-h-[52px]">
                Classes des filières
              </Bouton>
            )}
          </>
        }
      />

      {isLoading ? (
        <Chargement lignes={3} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : !data?.length ? (
        <EtatVide
          icone={<School className="h-6 w-6" />}
          titre="Aucune classe pour l'instant."
          texte="Créez les classes de la rentrée (ex. « BTS 1re année · tronc commun »), puis importez les étudiants depuis Excel."
          action={peutClasses ? <Bouton onClick={() => setEdition("nouvelle")}>Créer une classe</Bouton> : undefined}
        />
      ) : (
        sites.map((s) => {
          const liste = data.filter((c) => c.siteId === s.id);
          if (!liste.length) return null;
          return (
            <section key={s.id}>
              <TitreSection titre={`Campus ${s.nomCourt}`} action={<span className="font-mono text-xs text-texte-gris">{pluriel(liste.length, "classe")}</span>} />
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {liste.map((c) => (
                  <CarteClasse key={c.id} c={c} onModifier={() => setEdition(c)} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      <section>
        <TitreSection titre="Les campus" />
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 rounded-2xl border border-ligne bg-white p-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-extrabold">{s.nomCourt}</h3>
                <span className="text-sm text-texte-gris">{s.ville}</span>
              </div>
              <div className="text-[15px]">
                Salle de conférence :{" "}
                {s.salleConference === "Salle de conférence" ? <span className="text-texte-pale">nom à saisir</span> : <strong>{s.salleConference}</strong>}
              </div>
              <div className="flex items-center gap-2 text-[15px]">
                <MessageCircle className="h-4 w-4 text-orange-fonce" />
                {s.whatsappVieScolaire ? (
                  <span>
                    WhatsApp vie scolaire : <strong>{telephoneLisible(s.whatsappVieScolaire.replace(/^225/, ""))}</strong>
                  </span>
                ) : (
                  <span className="text-danger">Pas de numéro WhatsApp : le bouton « Besoin d'aide ? » est masqué pour ce campus.</span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {peutEcran && (
                  <Bouton variante="encre" taille="sm" icone={<MonitorSmartphone className="h-4 w-4" />} onClick={() => setEcran({ id: s.id, nom: s.nomCourt })} className="min-h-[48px]">
                    Installer l'écran de la salle
                  </Bouton>
                )}
                {refs.data?.estDirection && (
                  <Bouton variante="contour" taille="sm" icone={<Pencil className="h-4 w-4" />} onClick={() => setSite(s)} className="min-h-[48px]">
                    Modifier
                  </Bouton>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {edition && <FenetreClasse key={edition === "nouvelle" ? "nouvelle" : edition.id} edition={edition} sites={sites} onFermer={() => setEdition(null)} />}
      {site && <FenetreSite key={site.id} site={site} onFermer={() => setSite(null)} />}
      <FenetreEcran site={ecran} onFermer={() => setEcran(null)} />
    </Page>
  );
}

function CarteClasse({ c, onModifier }: { c: ClasseLigne; onModifier: () => void }) {
  const moi = useMoiConnecte();
  const peutClasses = profilPermet(moi, "classes");
  const peutFiches = profilPermet(moi, "nouveau_code");
  const voitComptes = profilPermet(moi, "comptes_voir");
  const [, naviguer] = useLocation();
  const [envoi, setEnvoi] = useState(false);
  const nonActives = c.etudiants - c.actives;
  const fichesNonActives = async () => {
    setEnvoi(true);
    try {
      const r = await get<PageComptes>(`/api/pilotage/comptes?classe=${c.id}&role=etudiant&etat=non_actives&parPage=400`);
      naviguer(lienFiches(r.lignes.map((l) => l.id)));
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };
  const supprimer = async () => {
    if (!window.confirm(`Supprimer la classe « ${c.nom} » ?`)) return;
    try {
      await suppr(`/api/pilotage/classes/${c.id}`);
      toast("Classe supprimée");
      await rafraichir("/api/pilotage/classes", "/api/pilotage/references");
    } catch (e) {
      toastErreur(e);
    }
  };
  const taux = c.etudiants ? Math.round((c.actives / c.etudiants) * 100) : null;
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-5">
      <div>
        <h3 className="text-[17px] font-extrabold leading-snug">{c.nom}</h3>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge ton="gris">{c.niveau}</Badge>
          <Badge ton="gris">{c.filiere}</Badge>
          <Badge ton="gris">{c.anneeScolaire}</Badge>
        </div>
      </div>
      {c.etudiants ? (
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-texte-pale">
              {pluriel(c.etudiants, "étudiant")} · {c.actives} activés
            </span>
            <span className="font-bold">{pourcent(taux)}</span>
          </div>
          <BarreProgression valeur={taux ?? 0} className="mt-1.5" ton={taux === 100 ? "succes" : "orange"} />
        </div>
      ) : (
        <p className="text-sm text-texte-pale">Aucun étudiant : importez la liste depuis Excel.</p>
      )}
      <div className="text-sm text-texte-pale">{c.cours ? `Suit ${pluriel(c.cours, "cours", "cours")}` : "Ne suit encore aucun cours"}</div>
      <div className="mt-auto flex flex-wrap gap-2 border-t border-ligne-douce pt-3">
        {voitComptes && (
          <Link href={`/pilotage/comptes?classe=${c.id}`} className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl bg-creme px-3 text-sm font-bold text-encre no-underline hover:bg-orange-clair hover:text-encre">
            <Users className="h-4 w-4" /> Étudiants
          </Link>
        )}
        {peutFiches && nonActives > 0 && (
          <Bouton variante="doux" taille="sm" className="min-h-[48px]" icone={<Printer className="h-4 w-4" />} onClick={fichesNonActives} chargement={envoi}>
            {nonActives} fiche{nonActives > 1 ? "s" : ""} à remettre
          </Bouton>
        )}
        {peutClasses && (
          <Bouton variante="fantome" taille="sm" className="min-h-[48px]" icone={<Pencil className="h-4 w-4" />} onClick={onModifier} aria-label={`Modifier ${c.nom}`}>
            Modifier
          </Bouton>
        )}
        {peutClasses && c.etudiants === 0 && (
          <Bouton variante="fantome" taille="sm" className="min-h-[48px] text-danger" icone={<Trash2 className="h-4 w-4" />} onClick={supprimer} aria-label={`Supprimer ${c.nom}`}>
            Supprimer
          </Bouton>
        )}
      </div>
    </li>
  );
}

function FenetreClasse({ edition, sites, onFermer }: { edition: ClasseLigne | "nouvelle"; sites: SiteLigne[]; onFermer: () => void }) {
  const [f, setF] = useState<Formulaire>(() =>
    edition !== "nouvelle"
      ? { nom: edition.nom, siteId: String(edition.siteId), filiere: edition.filiere, niveau: edition.niveau, anneeScolaire: edition.anneeScolaire }
      : { nom: "", siteId: sites.length === 1 ? String(sites[0].id) : "", filiere: "", niveau: "", anneeScolaire: anneeCourante() },
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const creation = edition === "nouvelle";
  const maj = (champ: keyof Formulaire) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [champ]: e.target.value }));
  const enregistrer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const corps = { ...f, siteId: Number(f.siteId) };
      if (creation) await post("/api/pilotage/classes", corps);
      else await patch(`/api/pilotage/classes/${edition.id}`, corps);
      toast(creation ? "Classe créée" : "Classe modifiée");
      await rafraichir("/api/pilotage/classes", "/api/pilotage/references", "/api/cours/options");
      onFermer();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Une erreur est survenue.");
    } finally {
      setEnvoi(false);
    }
  };
  const site = sites.find((s) => String(s.id) === f.siteId);
  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre={creation ? "Nouvelle classe" : "Modifier la classe"}
      description="Le nom s'affiche aux étudiants et sur les fiches de connexion."
      pied={
        <Bouton onClick={enregistrer} chargement={envoi} disabled={!f.nom.trim() || !f.siteId || !f.filiere.trim() || !f.niveau.trim()}>
          {creation ? "Créer la classe" : "Enregistrer"}
        </Bouton>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Selection libelle="Campus" value={f.siteId} onChange={maj("siteId")} disabled={!creation && edition.etudiants > 0} aide={!creation && edition.etudiants > 0 ? "Une classe qui a des étudiants ne change plus de campus." : undefined}>
          <option value="">Choisir le campus…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nomCourt}
            </option>
          ))}
        </Selection>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Champ libelle="Filière" value={f.filiere} onChange={maj("filiere")} placeholder="Tronc commun" />
          <Champ libelle="Niveau" value={f.niveau} onChange={maj("niveau")} placeholder="BTS 1, BTS 2…" />
        </div>
        <Champ
          libelle="Nom de la classe"
          value={f.nom}
          onChange={maj("nom")}
          placeholder={`BTS 1re année · tronc commun${site ? ` · ${site.nomCourt}` : ""}`}
          aide="Astuce : terminez par le campus, c'est plus clair dans les listes."
        />
        <Champ libelle="Année scolaire" value={f.anneeScolaire} onChange={maj("anneeScolaire")} placeholder="2026-2027" inputMode="numeric" />
        {erreur && (
          <p role="alert" className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">
            {erreur}
          </p>
        )}
      </div>
    </Fenetre>
  );
}

function FenetreSite({ site, onFermer }: { site: SiteLigne; onFermer: () => void }) {
  const [salle, setSalle] = useState(site.salleConference);
  const [whatsapp, setWhatsapp] = useState(site.whatsappVieScolaire ? telephoneLisible(site.whatsappVieScolaire.replace(/^225/, "")) : "");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enregistrer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      await patch(`/api/pilotage/sites/${site.id}`, { salleConference: salle, whatsappVieScolaire: whatsapp || null });
      toast(`Campus ${site.nomCourt} mis à jour`);
      await rafraichir("/api/pilotage/references", "/api/compte/contacts-sites", "/api/auth/moi");
      onFermer();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : "Une erreur est survenue.");
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Fenetre
      ouverte
      onFermer={onFermer}
      titre={`Campus ${site.nomCourt}`}
      description="Réservé à la direction."
      pied={
        <Bouton onClick={enregistrer} chargement={envoi} disabled={salle.trim().length < 2}>
          Enregistrer
        </Bouton>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <Champ
          libelle="Nom de la salle de conférence"
          value={salle}
          onChange={(e) => setSalle(e.target.value)}
          placeholder="Salle de conférence"
          aide="Le nom affiché sur l'écran de la salle et aux étudiants. Laissez « Salle de conférence » s'il n'y en a pas."
        />
        <Champ
          libelle="WhatsApp de la vie scolaire"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          inputMode="tel"
          placeholder="07 47 72 67 29"
          aide="Le bouton « Besoin d'aide ? » des étudiants de ce campus ouvre WhatsApp vers ce numéro."
        />
        {erreur && (
          <p role="alert" className="rounded-xl bg-danger-clair px-4 py-3 text-[15px] font-semibold text-danger">
            {erreur}
          </p>
        )}
      </div>
    </Fenetre>
  );
}
