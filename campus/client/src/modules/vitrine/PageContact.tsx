// /contact : les téléphones, le WhatsApp, l'e-mail et les réseaux du Groupe
// 2IAE, l'adresse de chaque campus avec son itinéraire et sa vie scolaire,
// le bureau au Canada, la préinscription et les mentions légales.
import { Link } from "wouter";
import { ArrowUpRight, Globe, Mail, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { EnTetePagePublique } from "./composants";
import { useSitePublicOuSecours } from "./donnees";
import { MiseEnPagePublique } from "./MiseEnPagePublique";
import { lienPreinscription, lienTelephone, lienWhatsappVers, numeroLisible, useTitreDocument } from "./outils";

export default function PageContact() {
  useTitreDocument("Contact · Groupe Écoles 2IAE International");
  const site = useSitePublicOuSecours();
  const c = site.contacts;

  return (
    <MiseEnPagePublique>
      <EnTetePagePublique
        fil={[{ libelle: "Contact" }]}
        etiquette="Nous joindre"
        titre="Une question ? Parlons-en."
        texte="Le standard du Groupe 2IAE, WhatsApp et l'e-mail, pour une inscription, une question sur le campus numérique ou sur un campus."
      />

      <section className="conteneur grid gap-4 pb-12 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-3 rounded-[28px] bg-encre p-6 text-white">
          <Phone className="h-6 w-6 text-orange" aria-hidden />
          <h2 className="text-xl font-extrabold">Téléphone</h2>
          <ul className="flex flex-col">
            {c.telephones.map((t) => (
              <li key={t}>
                <a href={lienTelephone(t)} className="inline-flex min-h-[44px] items-center text-lg font-bold text-white no-underline hover:text-orange">
                  {t}
                </a>
              </li>
            ))}
          </ul>
        </div>
        {c.whatsapp && (
          <div className="flex flex-col gap-3 rounded-[28px] bg-[#E7F8EE] p-6">
            <MessageCircle className="h-6 w-6 text-[#128C7E]" aria-hidden />
            <h2 className="text-xl font-extrabold">WhatsApp</h2>
            <p className="text-lg font-bold">{c.whatsapp}</p>
            <a
              href={lienWhatsappVers(c.whatsapp, "Bonjour, je vous écris depuis le site du campus numérique 2IAE.")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-[15px] font-bold text-encre no-underline hover:bg-encre hover:text-white"
            >
              Écrire sur WhatsApp
            </a>
          </div>
        )}
        {c.email && (
          <div className="flex flex-col gap-3 rounded-[28px] bg-creme p-6">
            <Mail className="h-6 w-6 text-orange-fonce" aria-hidden />
            <h2 className="text-xl font-extrabold">E-mail</h2>
            <a href={`mailto:${c.email}`} className="break-all text-lg font-bold">
              {c.email}
            </a>
          </div>
        )}
        <div className="flex flex-col gap-3 rounded-[28px] bg-orange p-6 text-encre">
          <Globe className="h-6 w-6" aria-hidden />
          <h2 className="text-xl font-extrabold">S'inscrire</h2>
          <p className="text-[15px] leading-snug">La préinscription se fait en ligne, en quelques minutes.</p>
          <a
            href={lienPreinscription(undefined, c.preinscription)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-encre px-5 text-[15px] font-bold text-white no-underline hover:bg-white hover:text-encre"
          >
            Préinscription <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section className="conteneur pb-12">
        <h2 className="mb-5 text-[30px] font-black leading-none tracking-serre sm:text-[40px]">Les campus.</h2>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {site.campus.map((s) => (
            <li key={s.slug} className="flex flex-col gap-3 rounded-3xl border border-ligne p-5 sm:p-6">
              <h3 className="text-xl font-extrabold leading-tight">
                <Link href={`/campus/${s.slug}`} className="text-encre no-underline hover:text-orange-fonce">
                  {s.nom}
                </Link>
              </h3>
              <p className="flex items-start gap-2.5 text-[15px] leading-snug text-texte-doux">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
                <span>{[s.adresse, s.localite].filter(Boolean).join(", ") || "Adresse bientôt précisée"}</span>
              </p>
              {s.telephone && (
                <a href={lienTelephone(s.telephone)} className="inline-flex items-center gap-2.5 text-[15px] font-semibold text-encre no-underline hover:text-orange-fonce">
                  <Phone className="h-4 w-4 text-orange-fonce" aria-hidden /> {s.telephone}
                </a>
              )}
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <a
                  href={s.itineraire}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-ligne px-4 text-sm font-bold text-encre no-underline hover:border-orange hover:text-encre"
                >
                  <Navigation className="h-4 w-4" /> Itinéraire
                </a>
                {s.whatsappCampus && (
                  <a
                    href={lienWhatsappVers(s.whatsapp, `Bonjour, je vous écris depuis le site du campus numérique 2IAE (campus ${s.nomCourt}).`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#25D366] px-4 text-sm font-bold text-encre no-underline hover:bg-encre hover:text-white"
                    title={numeroLisible(s.whatsapp)}
                  >
                    <MessageCircle className="h-4 w-4" /> Vie scolaire
                  </a>
                )}
              </div>
            </li>
          ))}
          <li className="flex flex-col gap-3 rounded-3xl bg-creme p-5 sm:p-6">
            <h3 className="text-xl font-extrabold leading-tight">Bureau au Canada</h3>
            <p className="flex items-start gap-2.5 text-[15px] leading-snug text-texte-doux">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-fonce" aria-hidden />
              <span>{c.bureauCanada}</span>
            </p>
          </li>
        </ul>
      </section>

      <section className="conteneur pb-16">
        <div className="flex flex-col gap-2 rounded-3xl border border-ligne p-5 font-mono text-xs leading-relaxed text-texte-pale sm:flex-row sm:flex-wrap sm:gap-x-6 sm:p-6">
          <span className="font-semibold text-encre">Groupe Écoles 2IAE International</span>
          {c.rc && <span>RC {c.rc}</span>}
          {c.agrement && <span>Agrément n° {c.agrement}</span>}
          {c.facebook && (
            <a href={c.facebook} target="_blank" rel="noopener noreferrer">
              Facebook
            </a>
          )}
          <a href={c.siteWeb} target="_blank" rel="noopener noreferrer">
            www.2iae.com
          </a>
        </div>
      </section>
    </MiseEnPagePublique>
  );
}
