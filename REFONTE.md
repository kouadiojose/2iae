# Refonte visuelle — août 2026

Le site a reçu la nouvelle identité issue de la maquette « Site 2IAE
Standalone » : palette crème/encre/orange (`#f0ede8` / `#1a1815` /
`#E8720C`), titres Cormorant Garamond, texte Archivo, accueil éditorial
(« L'exigence forme les cadres. L'audace forme les entrepreneurs. »),
parcours d'admission en quatre étapes, sections internat et partenaires.

Choix éditoriaux assumés par rapport à la maquette :
- les **témoignages fictifs** de la maquette ne sont pas repris — ils sont
  remplacés par les témoignages vidéo réels des étudiants ;
- la **liste des filières** reste celle du catalogue réel en base (la
  maquette citait des filières inexistantes) ;
- le moteur dynamique (actualités, galerie, synchronisation Facebook,
  administration) est conservé intégralement : la refonte est une peau.

## Retour en arrière (si le client préfère l'ancienne version)

L'état exact du site avant la refonte est figé sur la branche distante
**`version-stable-avant-refonte`** (commit `faf6239`).

```bash
git fetch origin version-stable-avant-refonte
git checkout main
git revert --no-edit <premier-commit-refonte>..HEAD   # option douce (garde l'historique)
# — ou, retour sec :
git reset --hard origin/version-stable-avant-refonte
git push --force-with-lease origin main
```

Railway redéploie automatiquement `main` : le site revient à l'ancienne
version en quelques minutes. Aucune donnée n'est concernée — la refonte
ne touche pas à la base.
