// /pilotage/site : ce que le site www.2iae.com montre du campus, et ce qui
// attend la validation de la direction. Chaque carte a l'allure de celle du
// site ; l'interrupteur publie ou retire aussitôt, et le site est prévenu.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, RefreshCw, Lock, CheckCircle2, CircleDashed, Radio, Megaphone, BookOpen, UserRound } from "lucide-react";
import type { EtatSite, ElementSite, TypePublication } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Badge, Chargement, Erreur, EtatVide, Avatar } from "@/components/ui/divers";
import { Bouton } from "@/components/ui/bouton";
import { Interrupteur } from "@/components/ui/champs";
import { Onglets } from "@/components/ui/onglets";
import { TitreSection } from "@/components/ui/carte";
import { toast, toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { dateCourte, dateEtHeure, heure } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";

type Filtre = "a_valider" | "en_ligne" | "tout";
const TYPES: Record<TypePublication, { libelle: string; icone: typeof Globe }> = {
  cours: { libelle: "Cours", icone: BookOpen },
  formateur: { libelle: "Formateur", icone: UserRound },
  seance: { libelle: "Live", icone: Radio },
  annonce: { libelle: "Annonce", icone: Megaphone },
};

export default function PageSite() {
  const { data, isLoading, error, refetch } = useQuery<EtatSite>({ queryKey: ["/api/pilotage/site"] });
  const [filtre, setFiltre] = useState<Filtre>("a_valider");
  const [envoi, setEnvoi] = useState(false);
  const elements = data?.elements ?? [];
  const aValider = elements.filter((e) => e.propose && !e.publie && !e.bloque);
  const enLigne = elements.filter((e) => e.publie);
  const visibles = filtre === "a_valider" ? aValider : filtre === "en_ligne" ? enLigne : elements;

  const prevenir = async () => {
    setEnvoi(true);
    try {
      const r = await post<{ configure: boolean }>("/api/pilotage/site/prevenir");
      toast(r.configure ? "Le site va se mettre à jour dans quelques secondes." : "Liaison non configurée : le site relira le campus de lui-même d'ici 5 minutes.", r.configure ? "succes" : "info");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Page>
      <SousNav />
      <EnTetePage
        etiquette="Pilotage · Site 2iae.com"
        titre="Le campus sur 2iae.com"
        sousTitre="Les formateurs proposent, la direction valide en un clic. Un formateur n'est présenté qu'avec son accord ; les lives passés disparaissent seuls."
        actions={
          data?.peutPublier ? (
            <Bouton taille="lg" icone={<RefreshCw className="h-5 w-5" />} onClick={prevenir} chargement={envoi} className="min-h-[52px]">
              Prévenir le site maintenant
            </Bouton>
          ) : undefined
        }
      />
      {data && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge ton={data.webhookConfigure ? "succes" : "alerte"}>{data.webhookConfigure ? "Liaison avec le site active" : "Liaison avec le site non configurée"}</Badge>
          <span className="text-texte-pale">
            {data.webhookConfigure ? "Chaque changement prévient le site aussitôt." : "Le site relit le campus toutes les 5 minutes (variable SITE_WEBHOOK_URL absente)."}
          </span>
          {!data.peutPublier && <Badge ton="gris">Lecture seule : la publication est réservée à la direction</Badge>}
        </div>
      )}

      {isLoading ? (
        <Chargement lignes={3} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : data ? (
        <>
          <Onglets<Filtre>
            valeur={filtre}
            onChange={setFiltre}
            options={[
              { valeur: "a_valider", libelle: "À valider", compteur: aValider.length },
              { valeur: "en_ligne", libelle: "En ligne", compteur: enLigne.length },
              { valeur: "tout", libelle: "Tout", compteur: elements.length },
            ]}
            className="self-start"
          />
          {!visibles.length ? (
            <EtatVide
              icone={<Globe className="h-6 w-6" />}
              titre={filtre === "a_valider" ? "Rien à valider." : filtre === "en_ligne" ? "Rien n'est publié pour l'instant." : "Rien à publier."}
              texte={
                filtre === "a_valider"
                  ? "Quand un formateur coche « Proposer sur 2iae.com » sur un cours, un live ou sa fiche, la proposition apparaît ici."
                  : "Ouvrez l'onglet « Tout » pour publier un cours ouvert, un formateur qui a donné son accord ou un live à venir."
              }
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibles.map((e) => (
                <CarteElement key={`${e.type}-${e.id}`} e={e} peutPublier={data.peutPublier} />
              ))}
            </ul>
          )}
          <Apercu data={data} />
        </>
      ) : null}
    </Page>
  );
}

function CarteElement({ e, peutPublier }: { e: ElementSite; peutPublier: boolean }) {
  const [envoi, setEnvoi] = useState(false);
  const Icone = TYPES[e.type].icone;
  const basculer = async (publier: boolean) => {
    setEnvoi(true);
    try {
      await post("/api/pilotage/site/publier", { type: e.type, id: e.id, publier });
      toast(publier ? `« ${e.titre} » est en ligne sur 2iae.com` : `« ${e.titre} » est retiré du site`);
      await rafraichir("/api/pilotage/site", "/api/cours", "/api/public");
    } catch (err) {
      toastErreur(err);
    } finally {
      setEnvoi(false);
    }
  };
  const bloquePourPublier = Boolean(e.bloque) && !e.publie;
  return (
    <li className={cn("flex flex-col overflow-hidden rounded-2xl border bg-white", e.publie ? "border-orange" : "border-ligne")}>
      <div className="h-2" style={{ background: e.couleur ?? (e.type === "formateur" ? "#141414" : "#E4793A") }} aria-hidden />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-texte-gris">
            <Icone className="h-3.5 w-3.5" /> {TYPES[e.type].libelle}
          </span>
          {e.publie ? (
            <Badge ton="succes">
              <CheckCircle2 className="h-3 w-3" /> En ligne
            </Badge>
          ) : e.propose ? (
            <Badge ton="alerte">
              <CircleDashed className="h-3 w-3" /> Proposé
            </Badge>
          ) : (
            <Badge ton="gris">Non publié</Badge>
          )}
        </div>
        <div className="flex items-start gap-3">
          {e.type === "formateur" && <Avatar prenom={e.titre.split(" ")[0]} nom={e.titre.split(" ").slice(1).join(" ")} photo={e.imageUrl} taille={44} />}
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold leading-snug">{e.titre}</h3>
            {e.sousTitre && <p className="text-sm text-texte-pale">{e.sousTitre}</p>}
          </div>
        </div>
        {e.texte && <p className="line-clamp-3 text-[15px] leading-relaxed text-texte-doux">{e.texte}</p>}
        {e.date && <p className="font-mono text-xs text-texte-gris">{e.type === "seance" ? dateEtHeure(e.date) : e.type === "formateur" ? `Présenté depuis le ${dateCourte(e.date)}` : dateCourte(e.date)}</p>}
        {e.bloque && (
          <p className="flex items-start gap-1.5 rounded-xl bg-alerte-clair px-3 py-2 text-sm text-alerte">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {e.bloque}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-ligne-douce pt-3">
          <span className="text-[15px] font-semibold">{e.publie ? "Affiché sur 2iae.com" : "Afficher sur 2iae.com"}</span>
          {peutPublier ? (
            <span className={cn(envoi && "opacity-50", bloquePourPublier && "opacity-40")}>
              <Interrupteur actif={e.publie} libelle={`Afficher « ${e.titre} » sur 2iae.com`} onChange={(v) => !envoi && !(v && bloquePourPublier) && basculer(v)} />
            </span>
          ) : (
            <span className="text-sm text-texte-gris">Direction</span>
          )}
        </div>
      </div>
    </li>
  );
}

/** Ce que le site reçoit en ce moment (GET /api/public/vitrine), à l'allure de 2iae.com. */
function Apercu({ data }: { data: EtatSite }) {
  const v = data.apercu;
  const direct = v.lives.find((l) => l.enDirect);
  const prochain = direct ?? v.lives[0];
  return (
    <section>
      <TitreSection titre="Aperçu : ce que voit le site" action={<span className="font-mono text-xs text-texte-gris">mis à jour {heure(v.genereLe)}</span>} />
      <div className="flex flex-col gap-5 rounded-[28px] bg-creme p-5 sm:p-8">
        <div className={cn("flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3", direct ? "bg-encre text-white" : "bg-white")}>
          <span className={cn("inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider", direct ? "text-orange-peche" : "text-orange-fonce")}>
            {direct && <span className="point-direct" />}
            {direct ? "En direct sur le campus numérique" : prochain ? "Bientôt sur le campus numérique" : "Bandeau masqué"}
          </span>
          <span className="text-[15px] font-bold">{prochain ? `${prochain.coursCode} · ${prochain.titre}` : "Aucun live public dans les 14 jours."}</span>
          {prochain && !direct && <span className="text-sm text-texte-pale">{dateEtHeure(prochain.debut)}</span>}
        </div>
        <div>
          <span className="etiquette">Au campus numérique</span>
          <h3 className="mt-1 text-2xl font-black tracking-serre">{v.cours.length ? "Nos cours en direct" : "Aucun cours annoncé"}</h3>
          {v.cours.length > 0 && (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {v.cours.map((c) => (
                <li key={c.slug} className="overflow-hidden rounded-2xl bg-white">
                  <div className="h-16" style={{ background: c.couleur }} />
                  <div className="flex flex-col gap-1 p-4">
                    <span className="font-mono text-xs text-texte-gris">
                      {c.code} · {c.nbCampus} campus
                    </span>
                    <span className="font-extrabold leading-snug">{c.titre}</span>
                    <span className="line-clamp-2 text-sm text-texte-pale">{c.accroche}</span>
                    {c.formateur && <span className="text-sm font-semibold">avec {c.formateur.prenom} {c.formateur.nom}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {v.formateurs.length > 0 && (
          <div>
            <h3 className="text-xl font-black tracking-serre">Nos formateurs</h3>
            <ul className="mt-3 flex flex-wrap gap-3">
              {v.formateurs.map((f) => (
                <li key={f.slug} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3">
                  <Avatar prenom={f.prenom} nom={f.nom} photo={f.photoUrl} taille={40} />
                  <span>
                    <span className="block font-bold">
                      {f.prenom} {f.nom}
                    </span>
                    <span className="block text-sm text-texte-pale">{[f.titre, f.localisation].filter(Boolean).join(" · ")}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { v: v.chiffres.etudiants, l: "étudiants" },
            { v: v.chiffres.formateurs, l: "formateurs" },
            { v: v.chiffres.cours, l: "cours" },
            { v: v.chiffres.heuresDeDirect, l: "heures de direct" },
          ].map((c) => (
            <div key={c.l} className="rounded-2xl bg-white p-4">
              <dt className="font-mono text-xs uppercase tracking-wider text-texte-gris">{c.l}</dt>
              <dd className="text-3xl font-black">{c.v}</dd>
            </div>
          ))}
        </dl>
        {v.annonces.length > 0 && (
          <div className="rounded-2xl bg-white p-4">
            <span className="etiquette">Annonces relayées</span>
            <ul className="mt-2 flex flex-col gap-1">
              {v.annonces.map((a) => (
                <li key={a.id} className="text-[15px]">
                  <strong>{a.titre}</strong> <span className="text-texte-gris">· {dateCourte(a.publieeLe)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
