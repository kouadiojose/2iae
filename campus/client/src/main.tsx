import { createRoot } from "react-dom/client";
// Manrope en police variable pour tout le texte (fine et lisible au téléphone),
// Cormorant Garamond pour les grands titres (celle des titres de 2iae.com), en
// un style droit et un italique, IBM Plex Mono en une graisse : environ 100 Ko
// en tout, mis en cache après la première visite.
import "@fontsource-variable/manrope/wght.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource/cormorant-garamond/latin-600-italic.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./index.css";
import App from "./App";
import { enregistrerServiceWorker } from "@/modules/pwa/service-worker";

createRoot(document.getElementById("root")!).render(<App />);
enregistrerServiceWorker();
