// /inscription/:jeton : le lien que la vie scolaire partage aux étudiants
// (groupes WhatsApp des classes). L'étudiant crée son compte lui-même : nom,
// campus, classe, téléphone, e-mail (obligatoires) et code secret. Son
// matricule est tiré tout seul ; sa session s'ouvre et il passe par le
// parcours de bienvenue (charte, alertes des cours en direct). Tutoiement.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CheckCircle2, Eye, EyeOff, FileDown, Link2Off, MailCheck } from "lucide-react";
import { post } from "@/lib/api";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Champ, Selection } from "@/components/ui/champs";
import type { InfoInscriptionEtudiantDto, InscriptionEtudiantFaite } from "@shared/schema";
import { CadrePublic } from "./composants/CadrePublic";
import { installerMoi } from "./outils";

type ClasseInscription = InfoInscriptionEtudiantDto["classes"][number];

/** Famille d'une classe, pour ranger les filières : BTS, licences, certificats, autres (tronc commun). */
const famille = (c: ClasseInscription) =>
  /BTS/i.test(c.niveau) && c.filiere !== "Tronc commun" ? "BTS" : /^licence/i.test(c.niveau) ? "Licences" : /^certificat/i.test(c.niveau) ? "Certificats" : "Autres";
const FAMILLES = ["BTS", "Licences", "Certificats", "Autres"] as const;

/** « 1BTS » → « 1re année (BTS 1) », « Licence 2 » → « 2e année (Licence 2) ». */
function libelleAnnee(niveau: string): string {
  const n = niveau.trim();
  const bts = /^(\d)\s*BTS$/i.exec(n) ?? /^BTS\s*(\d)$/i.exec(n);
  if (bts) return `${bts[1] === "1" ? "1re" : `${bts[1]}e`} année (BTS ${bts[1]})`;
  const licence = /^Licence\s*(\d)$/i.exec(n);
  if (licence) return `${licence[1] === "1" ? "1re" : `${licence[1]}e`} année (Licence ${licence[1]})`;
  return n;
}

export default function PageInscription({ jeton }: { jeton: string }) {
  const { data, error, isLoading } = useQuery<InfoInscriptionEtudiantDto>({ queryKey: [`/api/inscription/${encodeURIComponent(jeton)}`], retry: false, staleTime: Infinity });
  const [fait, setFait] = useState<InscriptionEtudiantFaite | null>(null);

  if (isLoading) return <CadrePublic>{<p className="text-texte-gris">Chargement…</p>}</CadrePublic>;
  if (fait) return <CompteCree resultat={fait} />;
  if (error || !data)
    return (
      <CadrePublic>
        <div className="flex flex-col gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-clair text-orange-fonce">
            <Link2Off className="h-7 w-7" />
          </span>
          <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Ce lien ne marche plus.</h1>
          <p className="text-base leading-relaxed text-texte-pale">{(error as Error | null)?.message ?? "Demande le nouveau lien à la vie scolaire de ton campus."}</p>
          <LienBouton href="/connexion" taille="lg" className="mt-2 min-h-[56px] w-full text-[17px]">
            J'ai déjà un compte : me connecter
          </LienBouton>
        </div>
      </CadrePublic>
    );
  return (
    <CadrePublic>
      <Formulaire jeton={jeton} info={data} onFait={setFait} />
    </CadrePublic>
  );
}

function Formulaire({ jeton, info, onFait }: { jeton: string; info: InfoInscriptionEtudiantDto; onFait: (r: InscriptionEtudiantFaite) => void }) {
  const campusUnique = info.siteId ?? (info.sites.length === 1 ? info.sites[0].id : null);
  const [f, setF] = useState({ prenom: "", nom: "", site: campusUnique ? String(campusUnique) : "", filiere: "", classe: "", telephone: "", email: "", code: "", confirmation: "" });
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const maj = (cle: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [cle]: e.target.value, ...(cle === "site" ? { filiere: "", classe: "" } : {}) }));
  const classesCampus = useMemo(() => info.classes.filter((c) => String(c.siteId) === f.site), [info.classes, f.site]);
  // Les filières du campus, rangées par famille (BTS, licences, certificats), puis les années de la filière choisie.
  const filieres = useMemo(() => {
    const parFamille = new Map<string, string[]>();
    for (const c of classesCampus) {
      const liste = parFamille.get(famille(c)) ?? [];
      if (!liste.includes(c.filiere)) liste.push(c.filiere);
      parFamille.set(famille(c), liste);
    }
    return FAMILLES.filter((x) => parFamille.has(x)).map((x) => ({ famille: x, filieres: [...(parFamille.get(x) ?? [])].sort((a, b) => a.localeCompare(b, "fr")) }));
  }, [classesCampus]);
  const annees = useMemo(() => classesCampus.filter((c) => c.filiere === f.filiere).sort((a, b) => a.niveau.localeCompare(b.niveau, "fr", { numeric: true })), [classesCampus, f.filiere]);
  const choisirFiliere = (e: { target: { value: string } }) => {
    const filiere = e.target.value;
    const liste = classesCampus.filter((c) => c.filiere === filiere);
    // Une seule classe (un certificat) : elle est choisie d'office.
    setF((x) => ({ ...x, filiere, classe: liste.length === 1 ? String(liste[0].id) : "" }));
  };
  const differents = f.confirmation.length > 0 && f.confirmation !== f.code;
  const tropCourt = f.code.length > 0 && f.code.length < info.longueurMinimale;
  const campus = info.sites.find((s) => String(s.id) === f.site)?.nomCourt;

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    if (!f.filiere) return setErreur("Choisis ta filière.");
    if (!f.classe) return setErreur("Choisis ton année.");
    if (f.code !== f.confirmation) return setErreur("Les deux codes ne sont pas identiques.");
    if (f.code.length < info.longueurMinimale) return setErreur(`Ton code secret doit faire au moins ${info.longueurMinimale} caractères.`);
    setEnvoi(true);
    try {
      const r = await post<InscriptionEtudiantFaite>(`/api/inscription/${encodeURIComponent(jeton)}`, {
        prenom: f.prenom,
        nom: f.nom,
        classeId: Number(f.classe),
        telephone: f.telephone,
        email: f.email.trim(),
        motDePasse: f.code,
      });
      onFait(r);
    } catch (x) {
      setErreur((x as Error).message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-orange-fonce">Étudiants · Campus numérique{info.siteId && campus ? ` · ${campus}` : ""}</span>
        <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Crée ton compte étudiant</h1>
        <p className="text-[15px] leading-relaxed text-texte-pale">
          En deux minutes : tu suis les cours en direct sur ton téléphone, tu reçois une alerte quand un cours commence, tu rends tes devoirs en photo et tu revois les replays.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Champ libelle="Prénom" value={f.prenom} onChange={maj("prenom")} autoComplete="given-name" required />
        <Champ libelle="Nom" value={f.nom} onChange={maj("nom")} autoComplete="family-name" required />
      </div>
      {!info.siteId && info.sites.length > 1 && (
        <Selection libelle="Ton campus" value={f.site} onChange={maj("site")} required>
          <option value="">Choisis ton campus</option>
          {info.sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nomCourt}
            </option>
          ))}
        </Selection>
      )}
      <Selection libelle="Ta filière" value={f.filiere} onChange={choisirFiliere} disabled={!f.site} required aide={!f.site ? "Choisis d'abord ton campus." : undefined}>
        <option value="">{f.site ? "Choisis ta filière" : "…"}</option>
        {filieres.map((g) => (
          <optgroup key={g.famille} label={g.famille}>
            {g.filieres.map((nom) => (
              <option key={nom} value={nom}>
                {nom}
              </option>
            ))}
          </optgroup>
        ))}
      </Selection>
      {f.filiere && annees.length > 1 && (
        <Selection libelle="Ton année" value={f.classe} onChange={maj("classe")} required>
          <option value="">Choisis ton année</option>
          {annees.map((c) => (
            <option key={c.id} value={c.id}>
              {libelleAnnee(c.niveau)}
            </option>
          ))}
        </Selection>
      )}
      <Champ
        libelle="Ton numéro de téléphone"
        type="tel"
        inputMode="tel"
        value={f.telephone}
        onChange={maj("telephone")}
        autoComplete="tel"
        placeholder="07 07 12 34 56"
        aide="Tu pourras aussi te connecter avec lui."
        required
      />
      <Champ
        libelle="Ton adresse e-mail"
        type="email"
        inputMode="email"
        value={f.email}
        onChange={maj("email")}
        autoComplete="email"
        placeholder="prenom.nom@gmail.com"
        aide={info.emailDisponible ? "Tu y reçois ton guide pas à pas, et le lien si tu oublies ton code." : "Pour recevoir le lien si tu oublies ton code."}
        required
      />
      <div className="relative">
        <Champ
          libelle="Ton code secret"
          type={voir ? "text" : "password"}
          value={f.code}
          onChange={maj("code")}
          autoComplete="new-password"
          aide={`${info.longueurMinimale} chiffres ou lettres au moins. Garde-le pour toi.`}
          erreur={tropCourt ? `Encore ${info.longueurMinimale - f.code.length} caractère${info.longueurMinimale - f.code.length > 1 ? "s" : ""} au moins.` : undefined}
          required
        />
        <button
          type="button"
          onClick={() => setVoir((v) => !v)}
          className="absolute right-2 top-[34px] grid h-10 w-10 place-items-center rounded-lg text-texte-gris hover:text-encre"
          aria-label={voir ? "Masquer le code" : "Afficher le code"}
        >
          {voir ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      <Champ
        libelle="Ton code secret, encore une fois"
        type={voir ? "text" : "password"}
        value={f.confirmation}
        onChange={maj("confirmation")}
        autoComplete="new-password"
        erreur={differents ? "Les deux codes ne sont pas identiques." : undefined}
        required
      />
      {erreur && (
        <p className="rounded-xl bg-[#FDECEA] px-4 py-3 text-[15px] font-semibold text-danger" role="alert">
          {erreur}
        </p>
      )}
      <Bouton type="submit" taille="lg" pleineLargeur chargement={envoi} disabled={differents}>
        Créer mon compte
      </Bouton>
      <p className="text-center text-[13px] text-texte-gris">
        Tu as déjà un compte (fiche de connexion, matricule){" "}?{" "}
        <a href="/connexion" className="font-bold text-orange-fonce">
          Connecte-toi
        </a>
      </p>
    </form>
  );
}

function CompteCree({ resultat }: { resultat: InscriptionEtudiantFaite }) {
  const [, naviguer] = useLocation();
  const { moi, matricule, classe, guide } = resultat;
  const entrer = () => {
    installerMoi(moi, true);
    naviguer("/bienvenue", { replace: true });
  };
  return (
    <CadrePublic>
      <div className="flex flex-col gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#E4F5EA] text-[#1F7A45]">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h1 className="text-[34px] font-black leading-[1.02] tracking-tres-serre">Ton compte est prêt, {moi.prenom}.</h1>
        <p className="text-[15px] text-texte-pale">{classe}</p>
        <div className="rounded-2xl border-2 border-orange bg-orange/10 px-4 py-4">
          <div className="etiquette">Ton matricule (ton identifiant)</div>
          <p className="mt-1 font-mono text-[30px] font-bold tracking-wider text-encre">{matricule}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-texte-pale">Note-le. Pour te connecter : ton matricule (ou ton téléphone) et ton code secret, sur campus.2iae.com.</p>
        </div>
        {guide.envoye && guide.adresse && (
          <p className="flex items-start gap-3 rounded-xl bg-creme px-4 py-3 text-[15px] leading-relaxed">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" />
            <span>
              Ton guide pas à pas vient de partir à <strong className="break-all text-encre">{guide.adresse}</strong>. Pas reçu ? Regarde dans les courriers indésirables.
            </span>
          </p>
        )}
        <Bouton taille="lg" pleineLargeur onClick={entrer} className="mt-1 min-h-[56px] text-[17px]">
          Entrer dans mon campus
        </Bouton>
        <p className="text-center text-[13px] text-texte-gris">Tu vas choisir comment suivre les cours et autoriser les alertes : tu en reçois une dès qu'un cours commence.</p>
        <a
          href="/guides/guide-etudiants.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[48px] items-center justify-center gap-2 text-[15px] font-bold text-orange-fonce hover:text-encre"
        >
          <FileDown className="h-5 w-5" />
          Télécharger le guide de l'étudiant (PDF)
        </a>
      </div>
    </CadrePublic>
  );
}
