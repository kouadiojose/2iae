// Vignette YouTube à chargement différé : l'iframe n'est créée qu'au clic,
// pour que les pages illustrées de plusieurs vidéos restent légères.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";

export function VideoYoutube({ id, titre }: { id: string; titre: string }) {
  const [lecture, setLecture] = useState(false);
  return (
    <Card className="overflow-hidden professional-shadow border-0">
      <div className="relative aspect-video bg-black">
        {lecture ? (
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${id}?autoplay=1`}
            title={titre}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setLecture(true)}
            className="absolute inset-0 w-full h-full group"
            aria-label={`Lire : ${titre}`}
            data-testid={`video-${id}`}
          >
            <img
              src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
              alt={titre}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
              <span className="bg-primary rounded-full p-4">
                <Play className="h-8 w-8 text-white fill-white" />
              </span>
            </span>
          </button>
        )}
      </div>
      <p className="p-4 font-medium text-gray-900 text-sm leading-snug">
        {titre}
      </p>
    </Card>
  );
}

/** Section « En vidéo » homogène pour les pages de contenu. */
export function SectionVideos({
  titre,
  videos,
}: {
  titre: string;
  videos: { id: string; titre: string }[];
}) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4 max-w-5xl">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          {titre}
        </h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <VideoYoutube key={v.id} {...v} />
          ))}
        </div>
      </div>
    </section>
  );
}
