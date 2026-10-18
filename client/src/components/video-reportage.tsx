// Une vidéo de reportage avec sa légende, pour les pages de travaux
// pratiques (Azaguié, Sinfra). « format » remplace le rapport 16/9 ou 9/16.
export function VideoReportage({ src, poster, titre, vertical = false, format }: { src: string; poster: string; titre: string; vertical?: boolean; format?: string }) {
  return (
    <figure className={vertical ? "mx-auto w-full max-w-[300px]" : ""}>
      <div className="rounded-xl overflow-hidden shadow-xl ring-4 ring-[#E8720C]/50 bg-black">
        <video
          className={`w-full h-auto block bg-black ${format ?? (vertical ? "aspect-[9/16]" : "aspect-video")}`}
          src={src}
          poster={poster}
          controls
          playsInline
          preload="none"
        >
          Votre navigateur ne prend pas en charge la lecture vidéo.
        </video>
      </div>
      <figcaption className="text-sm text-muted-foreground mt-2">{titre}</figcaption>
    </figure>
  );
}
