// QR code en SVG (net à l'impression, aucun appel réseau).
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

export function Qr({ texte, className, titre }: { texte: string; className?: string; titre?: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let actif = true;
    QRCode.toString(texte, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#141414", light: "#FFFFFF" } })
      .then((s) => actif && setSvg(s))
      .catch(() => actif && setSvg(null));
    return () => {
      actif = false;
    };
  }, [texte]);
  return (
    <div
      role="img"
      aria-label={titre ?? "QR code"}
      className={cn("aspect-square [&>svg]:h-full [&>svg]:w-full", !svg && "animate-pulse bg-creme", className)}
      // SVG produit localement par la bibliothèque qrcode à partir de notre propre lien.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
}
