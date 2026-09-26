// Réglages d'une session (création ou modification) : année, titre, public
// imprimé, dates, pause commune, classes destinataires (groupées par campus,
// avec « tout le tronc commun »), note et signataire.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import type { OptionsProgrammeDto, SessionEditionDto } from "@shared/schema";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Champ, CaseACocher, ZoneTexte } from "@/components/ui/champs";
import { Chargement } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { patch, post } from "@/lib/api";
import { maintenantServeur } from "@/lib/horloge";
import { cn, pluriel } from "@/lib/utils";
import { anneeAcademiqueCourante, isoJour, periode } from "./outils";

const PUBLICS_SUGGERES = ["Tronc commun · 1BTS / 2BTS", "Tronc commun · 1BTS", "Tronc commun · 2BTS"];

export function FenetreReglages({ session, onFermer, surEnregistre }: { session?: SessionEditionDto; onFermer: () => void; surEnregistre: (s: SessionEditionDto) => void }) {
  const { data: options, isLoading } = useQuery<OptionsProgrammeDto>({ queryKey: ["/api/pilotage/programme/options"] });
  const aujourdhui = isoJour(new Date(maintenantServeur()));
  const [annee, setAnnee] = useState(session?.anneeAcademique ?? anneeAcademiqueCourante(aujourdhui));
  const [titre, setTitre] = useState(session?.titre ?? "");
  const [publicVise, setPublicVise] = useState(session?.public ?? "");
  const [debut, setDebut] = useState(session?.debut ?? "");
  const [fin, setFin] = useState(session?.fin ?? "");
  const [avecPause, setAvecPause] = useState(session ? Boolean(session.pause) : true);
  const [pauseDebut, setPauseDebut] = useState(session?.pause?.debut ?? "12:30");
  const [pauseFin, setPauseFin] = useState(session?.pause?.fin ?? "13:00");
  const [classes, setClasses] = useState<Set<number>>(new Set(session?.classes.map((c) => c.id) ?? []));
  const [note, setNote] = useState(session?.note ?? "");
  const [signataire, setSignataire] = useState(session?.signataire ?? "Le service des études");
  const [envoi, setEnvoi] = useState(false);

  const toutesClasses = useMemo(() => (options?.sites ?? []).flatMap((s) => s.classes.map((c) => ({ ...c, siteId: s.id, modifiable: s.modifiable }))), [options]);
  const tronc = useMemo(() => {
    const deLAnnee = toutesClasses.filter((c) => c.troncCommun && c.anneeScolaire === annee && c.modifiable);
    return deLAnnee.length ? deLAnnee : toutesClasses.filter((c) => c.troncCommun && c.modifiable);
  }, [toutesClasses, annee]);

  const erreurDates = debut && fin && fin < debut ? "Le dernier jour doit venir après le premier." : undefined;
  const erreurPause = avecPause && pauseDebut && pauseFin && pauseFin <= pauseDebut ? "La pause doit finir après avoir commencé." : undefined;
  const erreurAnnee = /^\d{4}-\d{4}$/.test(annee) && Number(annee.slice(5)) === Number(annee.slice(0, 4)) + 1 ? undefined : "Écrivez l'année comme « 2026-2027 ».";
  // La vie scolaire d'un campus choisit au moins une de ses classes : une session sans classe est réservée à la direction.
  const classeExigee = Boolean(options && !options.toutLeGroupe);
  const pret = titre.trim().length >= 2 && debut && fin && !erreurDates && !erreurPause && !erreurAnnee && signataire.trim().length >= 2 && (!classeExigee || classes.size > 0);

  const basculer = (id: number, oui: boolean) =>
    setClasses((avant) => {
      const s = new Set(avant);
      if (oui) s.add(id);
      else s.delete(id);
      return s;
    });

  const enregistrer = async () => {
    setEnvoi(true);
    const corps = {
      anneeAcademique: annee.trim(),
      titre: titre.trim(),
      public: publicVise.trim(),
      debut,
      fin,
      pauseDebut: avecPause ? pauseDebut : null,
      pauseFin: avecPause ? pauseFin : null,
      note: note.trim(),
      signataire: signataire.trim(),
      classeIds: [...classes],
    };
    try {
      const s = session ? await patch<SessionEditionDto>(`/api/pilotage/programme/sessions/${session.id}`, corps) : await post<SessionEditionDto>("/api/pilotage/programme/sessions", corps);
      toast(session ? "Réglages enregistrés." : `« ${s.titre} » est créée : ajoutez ses créneaux.`);
      surEnregistre(s);
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      ouverte
      large
      onFermer={onFermer}
      titre={session ? "Réglages de la session" : "Nouvelle session"}
      description={session ? "Ce qui s'imprime en tête et en pied du document, et les classes qui reçoivent l'emploi du temps." : "Une session, c'est une période de cours (deux semaines, par exemple) pour des classes. Vous ajouterez ses créneaux juste après."}
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={enregistrer} chargement={envoi} disabled={!pret}>
            {session ? "Enregistrer" : "Créer la session"}
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <Champ libelle="Année académique" value={annee} onChange={(e) => setAnnee(e.target.value)} placeholder="2026-2027" inputMode="numeric" erreur={annee ? erreurAnnee : undefined} />
          <Champ libelle="Titre de la session" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Première session" maxLength={120} />
        </div>
        <div className="flex flex-col gap-2">
          <Champ
            libelle="Public (imprimé en tête)"
            value={publicVise}
            onChange={(e) => setPublicVise(e.target.value)}
            placeholder="Tronc commun · 1BTS / 2BTS"
            maxLength={160}
            aide="S'imprime « EMPLOI DU TEMPS TRONC COMMUN : 1BTS / 2BTS » : le point médian devient deux-points."
          />
          <div className="flex flex-wrap gap-2">
            {PUBLICS_SUGGERES.map((p) => (
              <button key={p} type="button" onClick={() => setPublicVise(p)} className={cn("min-h-[36px] rounded-full border px-3 text-[13px] font-semibold", publicVise === p ? "border-encre bg-encre text-white" : "border-ligne bg-white text-texte-doux hover:border-orange")}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ libelle="Premier jour" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
          <Champ libelle="Dernier jour" type="date" value={fin} min={debut || undefined} onChange={(e) => setFin(e.target.value)} erreur={erreurDates} />
        </div>
        {debut && fin && !erreurDates && <p className="-mt-2 text-sm text-texte-pale">{periode(debut, fin)}.</p>}

        <div className="flex flex-col gap-3 rounded-2xl bg-creme p-4">
          <CaseACocher checked={avecPause} onChange={setAvecPause} libelle="Pause commune" aide="Tracée sur toute la largeur de la grille (« P A U S E »)." />
          {avecPause && (
            <div className="grid grid-cols-2 gap-3">
              <Champ libelle="Début" type="time" step={300} value={pauseDebut} onChange={(e) => setPauseDebut(e.target.value)} />
              <Champ libelle="Fin" type="time" step={300} value={pauseFin} onChange={(e) => setPauseFin(e.target.value)} erreur={erreurPause} />
            </div>
          )}
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 flex w-full flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold">Classes destinataires</span>
            <span className="font-mono text-xs text-texte-gris">{pluriel(classes.size, "classe choisie", "classes choisies")}</span>
          </legend>
          <p className="-mt-2 text-[13px] text-texte-gris">
            Leurs étudiants voient l'emploi du temps et sont prévenus à la publication. Les cours des créneaux leur sont rattachés.
            {classeExigee && " Choisissez au moins une classe de votre campus."}
          </p>
          {isLoading ? (
            <Chargement lignes={2} />
          ) : !toutesClasses.length ? (
            <p className="rounded-xl border border-dashed border-ligne px-4 py-3 text-sm text-texte-pale">
              Aucune classe n'existe encore. Créez-les dans <strong>Classes et campus</strong> (par exemple « Tronc commun 1BTS » et « Tronc commun 2BTS » dans chaque campus).
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Bouton variante="doux" taille="sm" icone={<Users className="h-4 w-4" />} disabled={!tronc.length} onClick={() => setClasses(new Set([...classes, ...tronc.map((c) => c.id)]))}>
                  Tout le tronc commun ({tronc.length})
                </Bouton>
                <Bouton variante="fantome" taille="sm" disabled={!classes.size} onClick={() => setClasses(new Set())}>
                  Aucune
                </Bouton>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {options!.sites.map((s) => {
                  const toutes = s.classes.length > 0 && s.classes.every((c) => classes.has(c.id));
                  return (
                    <div key={s.id} className="rounded-2xl border border-ligne p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-extrabold">{s.nomCourt}</span>
                        {s.classes.length > 0 && s.modifiable && (
                          <button type="button" className="min-h-[32px] text-[13px] font-bold text-orange-fonce hover:text-encre" onClick={() => s.classes.forEach((c) => basculer(c.id, !toutes))}>
                            {toutes ? "Tout décocher" : "Tout cocher"}
                          </button>
                        )}
                      </div>
                      {s.classes.length ? (
                        <div className="flex flex-col gap-2">
                          {s.classes.map((c) => (
                            <CaseACocher
                              key={c.id}
                              checked={classes.has(c.id)}
                              onChange={(v) => basculer(c.id, v)}
                              disabled={!s.modifiable}
                              libelle={c.nom}
                              aide={`${c.niveau} · ${c.anneeScolaire} · ${pluriel(c.effectif, "étudiant")}`}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-texte-gris">Aucune classe dans ce campus.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </fieldset>

        <ZoneTexte libelle="Note sous la grille (facultative)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="Par exemple : les séminaires ont lieu au campus d'Azaguié." />
        <Champ libelle="Signature imprimée" value={signataire} onChange={(e) => setSignataire(e.target.value)} maxLength={120} />
      </div>
    </Fenetre>
  );
}
