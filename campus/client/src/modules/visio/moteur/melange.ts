// Mélange audio de la radio du cours : le micro du formateur et le son de
// chaque participant de la visio (salles, intervenants, étudiant qui a la
// parole) réunis en UNE piste, que MediaRecorder encode comme avant.
//
// Rien n'est joué dans le navigateur du formateur (il entend déjà la classe
// dans la visio) : les éléments <audio> créés ici restent muets. Chrome ne
// laisse passer le son d'une piste WebRTC distante dans Web Audio que si elle
// est aussi lue par un élément média : d'où ces lecteurs silencieux.

type Source = { piste: MediaStreamTrack; noeud: MediaStreamAudioSourceNode; lecteur: HTMLAudioElement };

export class MelangeurClasse {
  private ctx = new AudioContext();
  private sortie = this.ctx.createMediaStreamDestination();
  private micro: { piste: MediaStreamTrack; noeud: MediaStreamAudioSourceNode } | null = null;
  private sources = new Map<string, Source>();

  /** La piste mélangée, stable du début à la fin (les sources vont et viennent derrière elle). */
  readonly flux: MediaStream = this.sortie.stream;

  get enMarche() {
    return this.ctx.state === "running";
  }

  /** Le navigateur ne fait tourner le son qu'après un geste de la personne : à rappeler au premier clic. */
  async reprendre(): Promise<boolean> {
    if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => undefined);
    return this.enMarche;
  }

  surChangement(rappel: () => void) {
    this.ctx.onstatechange = rappel;
  }

  /** Micro du formateur (piste coupée par « Micro coupé » : il se tait, la classe continue). */
  brancherMicro(piste: MediaStreamTrack | null) {
    if (this.micro?.piste === piste) return;
    this.micro?.noeud.disconnect();
    this.micro = null;
    if (!piste || piste.readyState === "ended") return;
    const noeud = this.ctx.createMediaStreamSource(new MediaStream([piste]));
    noeud.connect(this.sortie);
    this.micro = { piste, noeud };
  }

  /** Son d'un participant de la visio (clé : son identifiant de session Daily). */
  ajouter(cle: string, piste: MediaStreamTrack) {
    if (this.sources.get(cle)?.piste === piste) return;
    this.retirer(cle);
    if (piste.readyState === "ended") return;
    const flux = new MediaStream([piste]);
    const lecteur = new Audio();
    lecteur.muted = true;
    lecteur.srcObject = flux;
    void lecteur.play().catch(() => undefined);
    const noeud = this.ctx.createMediaStreamSource(flux);
    noeud.connect(this.sortie);
    this.sources.set(cle, { piste, noeud, lecteur });
  }

  retirer(cle: string) {
    const s = this.sources.get(cle);
    if (!s) return;
    s.noeud.disconnect();
    s.lecteur.pause();
    s.lecteur.srcObject = null;
    this.sources.delete(cle);
  }

  /** Nombre de participants dont le son est mélangé (le micro du formateur en plus). */
  get participants() {
    return this.sources.size;
  }

  fermer() {
    for (const cle of [...this.sources.keys()]) this.retirer(cle);
    this.micro?.noeud.disconnect();
    this.micro = null;
    this.ctx.onstatechange = null;
    void this.ctx.close().catch(() => undefined);
  }
}
