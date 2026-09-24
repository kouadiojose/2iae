import { createRoot } from "react-dom/client";
// Archivo en police variable (une seule police pour toutes les graisses) et
// IBM Plex Mono en une graisse : le moins d'octets possible en 4G.
import "@fontsource-variable/archivo/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./index.css";
import App from "./App";
import { enregistrerServiceWorker } from "@/modules/pwa/service-worker";

createRoot(document.getElementById("root")!).render(<App />);
enregistrerServiceWorker();
