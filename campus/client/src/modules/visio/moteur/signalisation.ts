// Envoi des messages de négociation WebRTC par l'API du campus.
//
// Les offres, réponses et candidats d'une même connexion doivent arriver
// DANS L'ORDRE : une file par destinataire, un envoi à la fois. Les
// candidats ICE sont regroupés (un envoi toutes les 80 ms au plus) pour
// épargner le réseau et le serveur.
import { ErreurApi, post } from "@/lib/api";
import type { TypeSignalVisio } from "@shared/schema";

export type DonneesSignal = {
  /** Identifiant de la connexion (change quand le formateur la recrée de zéro). */
  connexion: string;
  description?: RTCSessionDescriptionInit;
  /** Offre du formateur : rôle de chaque piste, par identifiant de ligne SDP (mid). */
  pistes?: Record<string, string>;
  candidats?: RTCIceCandidateInit[];
};

type Options = {
  seanceId: number;
  pairId: string;
  /** Le serveur ne nous connaît plus (redémarrage, longue coupure) : il faut rejoindre à nouveau. */
  surOublie: () => void;
  /** Le destinataire a quitté la visio. */
  surParti: (vers: string) => void;
};

const attendre = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export class Signalisation {
  private files = new Map<string, Promise<void>>();
  private candidats = new Map<string, { connexion: string; liste: RTCIceCandidateInit[]; minuteur: ReturnType<typeof setTimeout> }>();
  private ferme = false;

  constructor(private o: Options) {}

  envoyer(vers: string, type: TypeSignalVisio, donnees: DonneesSignal) {
    if (this.ferme) return;
    // Les candidats en attente pour ce destinataire partent avant le message suivant.
    this.viderCandidats(vers);
    this.enFile(vers, () => this.poster(vers, type, donnees));
  }

  candidat(vers: string, connexion: string, c: RTCIceCandidateInit) {
    if (this.ferme) return;
    const lot = this.candidats.get(vers);
    if (lot && lot.connexion === connexion) {
      lot.liste.push(c);
      return;
    }
    if (lot) this.viderCandidats(vers);
    this.candidats.set(vers, { connexion, liste: [c], minuteur: setTimeout(() => this.viderCandidats(vers), 80) });
  }

  fermer() {
    this.ferme = true;
    for (const lot of this.candidats.values()) clearTimeout(lot.minuteur);
    this.candidats.clear();
  }

  private viderCandidats(vers: string) {
    const lot = this.candidats.get(vers);
    if (!lot) return;
    clearTimeout(lot.minuteur);
    this.candidats.delete(vers);
    const donnees: DonneesSignal = { connexion: lot.connexion, candidats: lot.liste };
    this.enFile(vers, () => this.poster(vers, "ice", donnees));
  }

  private enFile(vers: string, tache: () => Promise<void>) {
    const precedente = this.files.get(vers) ?? Promise.resolve();
    const suivante = precedente.then(tache).catch(() => undefined);
    this.files.set(vers, suivante);
    // Libère la mémoire quand la file est vide.
    void suivante.then(() => {
      if (this.files.get(vers) === suivante) this.files.delete(vers);
    });
  }

  private async poster(vers: string, type: TypeSignalVisio, donnees: DonneesSignal) {
    // Réseau capricieux : quelques essais rapprochés, puis on abandonne (la reconnexion prendra le relais).
    for (let essai = 0; essai < 4 && !this.ferme; essai++) {
      try {
        await post(`/api/visio/${this.o.seanceId}/signal`, { de: this.o.pairId, vers, type, donnees });
        return;
      } catch (e) {
        if (e instanceof ErreurApi && e.statut === 404) return this.o.surOublie();
        if (e instanceof ErreurApi && e.statut === 410) return this.o.surParti(vers);
        if (e instanceof ErreurApi && e.statut >= 400 && e.statut < 500 && e.statut !== 429) return;
        await attendre(400 * 2 ** essai);
      }
    }
  }
}
