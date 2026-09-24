// /assistant/charte — la charte de l'assistant, en mots simples : ce qu'il
// fait, ce qu'il ne fait pas, la confidentialité, la pause pendant les
// interrogations. Le personnel voit la même page que les étudiants.
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, X, Lock, PauseCircle, Gauge, Sparkles } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { useEtatIa } from "./api-ia";

function Bloc({ icone, titre, children, ton = "creme" }: { icone: ReactNode; titre: string; children: ReactNode; ton?: "creme" | "encre" | "blanc" }) {
  const classes =
    ton === "encre" ? "bg-encre text-white" : ton === "blanc" ? "border border-ligne bg-white" : "bg-creme";
  return (
    <section className={`flex flex-col gap-4 rounded-[24px] p-5 sm:p-7 ${classes}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${ton === "encre" ? "bg-orange text-encre" : "bg-orange-clair text-orange-fonce"}`}>{icone}</span>
        <h2 className="text-[22px] font-black leading-tight tracking-serre">{titre}</h2>
      </div>
      {children}
    </section>
  );
}

function Ligne({ oui, children, nuit }: { oui: boolean; children: ReactNode; nuit?: boolean }) {
  return (
    <li className="flex items-start gap-3 text-base leading-relaxed">
      {oui ? <Check className="mt-1 h-5 w-5 shrink-0 text-succes" aria-label="Oui" /> : <X className="mt-1 h-5 w-5 shrink-0 text-danger" aria-label="Non" />}
      <span className={nuit ? "text-nuit-doux" : "text-texte-doux"}>{children}</span>
    </li>
  );
}

export default function PageCharte() {
  const moi = useMoiConnecte();
  const enseignant = moi.role !== "etudiant";
  const { data: etat } = useEtatIa();
  const quota = etat?.quotaEtudiants ?? 40;

  return (
    <Page className="max-w-3xl">
      <Link href="/assistant" className="-ml-2 inline-flex min-h-12 w-fit items-center gap-2 rounded-xl px-2 text-[15px] font-bold text-texte-doux no-underline hover:bg-creme hover:text-encre">
        <ArrowLeft className="h-5 w-5" /> L'assistant
      </Link>
      <EnTetePage
        etiquette="Charte de l'assistant IA"
        titre="L'IA t'aide à apprendre. Elle ne travaille pas à ta place."
        sousTitre="L'assistant du campus s'appuie sur Claude, une intelligence artificielle. Voici, en clair, ce qu'il fait et ce qu'il ne fait pas."
      />
      {enseignant && (
        <p className="rounded-2xl border border-ligne bg-white px-4 py-3 text-[15px] text-texte-pale">
          <strong className="text-encre">Vous êtes formateur ou membre de l'équipe :</strong> voici la charte telle que la lisent vos étudiants.
        </p>
      )}

      <Bloc icone={<Sparkles className="h-5 w-5" />} titre="Ce que fait l'assistant">
        <ul className="flex flex-col gap-3">
          <Ligne oui>Il explique tes leçons avec des mots simples et des exemples d'ici : FCFA, maquis, PME d'Adjamé, cacao, Mobile Money.</Ligne>
          <Ligne oui>Il dit d'où vient sa réponse : « (Leçon 2.3) », « (Séance du 12 oct.) ». Et il te prévient quand il sort de ton cours.</Ligne>
          <Ligne oui>Sur une leçon : « L'essentiel en 5 points », « Explique autrement » et « Me faire réviser » (5 questions pour t'entraîner, jamais notées).</Ligne>
          <Ligne oui>Sur un devoir, il devient ton tuteur : il te pose des questions et te donne des indices pour que tu trouves toi-même.</Ligne>
          <Ligne oui>Tu peux lui parler (dictée) et écouter ses réponses, si ton téléphone le permet.</Ligne>
        </ul>
      </Bloc>

      <Bloc icone={<X className="h-5 w-5" />} titre="Ce qu'il ne fait pas" ton="blanc">
        <ul className="flex flex-col gap-3">
          <Ligne oui={false}>Il ne fait pas tes devoirs et ne donne pas la réponse d'un exercice noté, même si tu insistes.</Ligne>
          <Ligne oui={false}>Il ne met jamais de note. Seul ton formateur note ton travail.</Ligne>
          <Ligne oui={false}>Il ne connaît pas les corrigés des interrogations.</Ligne>
          <Ligne oui={false}>Il ne remplace pas ton formateur : il peut se tromper. En cas de doute, c'est ton formateur qui a le dernier mot.</Ligne>
        </ul>
        <p className="text-[15px] leading-relaxed text-texte-pale">
          Ce que l'IA prépare pour être publié (fiches de révision, accroches, préparations de séance) reste marqué « Proposé par l'IA » tant qu'un humain ne l'a pas relu et validé.
        </p>
      </Bloc>

      <Bloc icone={<Lock className="h-5 w-5" />} titre="Tes données">
        <ul className="flex flex-col gap-3">
          <Ligne oui>Tes conversations sont privées : ni tes camarades ni ton formateur ne les lisent. Tu peux les supprimer quand tu veux.</Ligne>
          <Ligne oui>Ton nom, ton matricule et ton téléphone ne sont jamais envoyés à l'IA : pour elle, tu es « l'étudiant ».</Ligne>
          <Ligne oui>L'IA reçoit seulement ta question et le contenu de ton cours (leçons publiées, fiches et résumés validés par ton formateur).</Ligne>
          <Ligne oui={false}>N'écris pas d'informations personnelles (numéro, adresse, mot de passe) dans tes questions.</Ligne>
        </ul>
      </Bloc>

      <Bloc icone={<PauseCircle className="h-5 w-5" />} titre="Pendant une interrogation" ton="encre">
        <p className="text-base leading-relaxed text-nuit-doux">
          Dès que tu commences une interrogation, l'assistant se met en pause, sur tous tes cours, jusqu'à la fin de ton temps. C'est vérifié par le serveur du campus. Il revient tout seul
          après. Bon courage !
        </p>
      </Bloc>

      <Bloc icone={<Gauge className="h-5 w-5" />} titre="Une limite par jour" ton="blanc">
        <p className="text-base leading-relaxed text-texte-doux">
          Chaque étudiant peut poser {quota} questions par jour à l'assistant. Le compteur repart à zéro chaque matin. Si l'assistant est en pause pour le moment, pose ta question à ton
          formateur dans la messagerie du cours.
        </p>
      </Bloc>

      <LienBouton href="/assistant" taille="lg" className="self-start">
        {enseignant ? "Revenir à l'assistant" : "J'ai compris, je pose ma question"}
      </LienBouton>
    </Page>
  );
}
