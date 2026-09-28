# Application Android du campus

Une Trusted Web Activity : l'application ouvre https://campus.2iae.com en plein
écran dans Chrome, sans barre d'adresse. Le contenu vient du site : une
modification du campus se voit aussitôt dans l'application, sans nouvelle
version à installer. Il ne faut reconstruire l'APK que pour changer le nom,
l'icône, les couleurs ou les raccourcis.

- Paquet : `com.groupe2iae.campus`
- Lancement : `/accueil?source=android` (le campus reconnaît l'application,
  voir `client/src/modules/pwa/outils.ts`)
- Lien de confiance : `/.well-known/assetlinks.json` (`server/routes/android.ts`)
- Projet généré avec `@bubblewrap/core` 1.25 à partir de `twa-manifest.json`

## Clé de signature

La clé (`campus-2iae.jks`, alias `campus-2iae`) et son mot de passe ne sont
**jamais** dans le dépôt. La direction en garde une copie. Sans elle, on ne
peut plus publier de mise à jour de l'APK direct : la conserver précieusement.

Empreinte SHA-256 (publique) :
`19:D5:19:3E:08:3C:64:57:83:21:B7:B2:46:79:98:CE:36:74:19:C7:F6:D3:4F:64:4C:08:D7:CA:D2:84:B2:E4`

## Reconstruire

Il faut Java 17 ou plus et le SDK Android (plateforme 36).

```sh
export ANDROID_HOME=/chemin/vers/android-sdk
export CAMPUS_ANDROID_KEYSTORE=/chemin/vers/campus-2iae.jks
export CAMPUS_ANDROID_MDP='…'
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleRelease bundleRelease
```

Avant une nouvelle version : augmenter `versionCode` et `versionName` dans
`app/build.gradle` (et `appVersionCode` / `appVersion` dans
`twa-manifest.json`).

Ensuite :

1. copier `app/build/outputs/apk/release/app-release.apk` vers
   `client/public/android/campus-2iae.apk` ;
2. mettre à jour `client/src/modules/pwa/android.ts` (version, taille) ;
3. déployer le campus.

`app/build/outputs/bundle/release/app-release.aab` est le fichier à envoyer
au Play Store.

## Play Store

Le Play Store re-signe l'application avec sa propre clé (Play App Signing).
Une fois l'application envoyée, copier l'empreinte SHA-256 de la « clé de
signature de l'application » (Play Console → Test et publication → Intégrité
de l'application) dans la variable Railway `ANDROID_EMPREINTES` du service
campus (plusieurs empreintes : séparées par des virgules). Sans elle, la
version du Play Store afficherait une barre d'adresse.
