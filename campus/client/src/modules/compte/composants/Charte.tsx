// Charte d'utilisation du campus, en trois blocs courts (IA, enregistrement
// des lives, données). Montrée à la première connexion (« J'accepte ») et
// relisible à tout moment depuis le profil. Tutoiement pour les étudiants,
// vouvoiement pour les formateurs et l'équipe.
import type { ReactNode } from "react";
import { ShieldCheck, Sparkles, Video } from "lucide-react";
import type { Role } from "@shared/schema";

type Bloc = { icone: ReactNode; titre: string; points: string[] };

function blocs(role: Role): Bloc[] {
  if (role === "etudiant") {
    return [
      {
        icone: <Sparkles className="h-5 w-5" />,
        titre: "L'assistant IA t'aide à comprendre",
        points: [
          "Il explique autrement et te fait réviser, mais il ne fait pas tes devoirs.",
          "Il se met en pause pendant les interrogations.",
          "Il peut se tromper : vérifie toujours ce qu'il dit. Ton nom ne lui est jamais envoyé.",
        ],
      },
      {
        icone: <Video className="h-5 w-5" />,
        titre: "Les cours en direct sont enregistrés",
        points: [
          "Le replay permet à tous de revoir le cours.",
          "Si tu prends la parole, ta voix est enregistrée. Il n'y a jamais de caméra étudiante.",
          "Les cours et les replays restent sur le campus : ne les diffuse pas ailleurs.",
        ],
      },
      {
        icone: <ShieldCheck className="h-5 w-5" />,
        titre: "Tes données restent à l'école",
        points: [
          "Tes devoirs, tes notes et tes présences ne sont vus que par toi, tes formateurs et la vie scolaire.",
          "Rien de personnel ne part sur le site 2iae.com.",
          "Dans les messages et les questions du cours, on reste poli et bienveillant.",
          "Tu as moins de 18 ans ? Montre cette charte à tes parents.",
        ],
      },
    ];
  }
  const equipe = role === "admin" || role === "vie_scolaire";
  return [
    {
      icone: <Sparkles className="h-5 w-5" />,
      titre: "L'IA propose, vous décidez",
      points: [
        "Aucune note, publication ou annonce produite par l'IA ne part sans votre validation : elle reste marquée « Proposé par l'IA ».",
        "Les noms des étudiants ne sont jamais envoyés à l'IA.",
      ],
    },
    {
      icone: <Video className="h-5 w-5" />,
      titre: "Les séances en direct sont enregistrées",
      points: [
        "Le replay sert aux étudiants des cinq campus. La mention d'enregistrement est affichée en salle.",
        equipe ? "Les écrans de salle n'affichent jamais de nom d'étudiant." : "Votre fiche n'apparaît sur 2iae.com qu'avec votre accord, révocable depuis votre profil.",
      ],
    },
    {
      icone: <ShieldCheck className="h-5 w-5" />,
      titre: "Les données des étudiants sont confidentielles",
      points: [
        equipe
          ? "Vous voyez les dossiers de votre périmètre : chaque action sensible (nouveau code, présences, relevés partagés) est tracée."
          : "Copies, notes et présences ne se partagent pas hors du campus.",
        "Seuls des chiffres d'ensemble et des contenus validés partent vers le site 2iae.com.",
      ],
    },
  ];
}

export function ContenuCharte({ role }: { role: Role }) {
  return (
    <div className="flex flex-col gap-3">
      {blocs(role).map((b) => (
        <section key={b.titre} className="rounded-2xl bg-creme p-4 sm:p-5">
          <h3 className="flex items-center gap-3 text-[17px] font-extrabold leading-tight">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-orange-fonce">{b.icone}</span>
            {b.titre}
          </h3>
          <ul className="mt-3 flex flex-col gap-2 pl-1">
            {b.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-base leading-snug text-texte-doux">
                <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
                {p}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
