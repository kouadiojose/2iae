// Rendu Markdown sûr et léger (leçons, consignes, résumés IA) : le HTML est
// toujours échappé ; seuls titres, listes, gras, italique, code, citations,
// liens http(s) et séparateurs sont reconnus. Pas de dépendance à charger en 4G.
import { useMemo } from "react";
import { cn } from "@/lib/utils";

const echapper = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function enLigne(t: string): string {
  let s = echapper(t);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (_m, texte, url) => {
    const externe = url.startsWith("http");
    return `<a href="${url}"${externe ? ' target="_blank" rel="noopener noreferrer"' : ""}>${texte}</a>`;
  });
  s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  return s;
}

export function markdownVersHtml(source: string): string {
  const lignes = source.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let liste: "ul" | "ol" | null = null;
  let paragraphe: string[] = [];
  let code: string[] | null = null;

  const fermerParagraphe = () => {
    if (paragraphe.length) html.push(`<p>${paragraphe.map(enLigne).join("<br/>")}</p>`);
    paragraphe = [];
  };
  const fermerListe = () => {
    if (liste) html.push(`</${liste}>`);
    liste = null;
  };

  for (const brute of lignes) {
    if (code) {
      if (/^```/.test(brute)) {
        html.push(`<pre><code>${echapper(code.join("\n"))}</code></pre>`);
        code = null;
      } else code.push(brute);
      continue;
    }
    const ligne = brute.trimEnd();
    if (/^```/.test(ligne)) {
      fermerParagraphe();
      fermerListe();
      code = [];
      continue;
    }
    const titre = /^(#{1,3})\s+(.*)$/.exec(ligne);
    const puce = /^\s*[-*•]\s+(.*)$/.exec(ligne);
    const numero = /^\s*\d+[.)]\s+(.*)$/.exec(ligne);
    if (!ligne.trim()) {
      fermerParagraphe();
      fermerListe();
    } else if (titre) {
      fermerParagraphe();
      fermerListe();
      const n = titre[1].length;
      html.push(`<h${n}>${enLigne(titre[2])}</h${n}>`);
    } else if (/^(-{3,}|\*{3,})$/.test(ligne.trim())) {
      fermerParagraphe();
      fermerListe();
      html.push("<hr/>");
    } else if (puce || numero) {
      fermerParagraphe();
      const type = puce ? "ul" : "ol";
      if (liste !== type) {
        fermerListe();
        html.push(`<${type}>`);
        liste = type;
      }
      html.push(`<li>${enLigne((puce ?? numero)![1])}</li>`);
    } else if (/^>\s?/.test(ligne)) {
      fermerParagraphe();
      fermerListe();
      html.push(`<blockquote>${enLigne(ligne.replace(/^>\s?/, ""))}</blockquote>`);
    } else {
      fermerListe();
      paragraphe.push(ligne);
    }
  }
  if (code) html.push(`<pre><code>${echapper(code.join("\n"))}</code></pre>`);
  fermerParagraphe();
  fermerListe();
  return html.join("\n");
}

export function Markdown({ source, className, nuit }: { source: string | null | undefined; className?: string; nuit?: boolean }) {
  const html = useMemo(() => markdownVersHtml(source ?? ""), [source]);
  return <div className={cn("prose-campus", nuit && "prose-nuit", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
