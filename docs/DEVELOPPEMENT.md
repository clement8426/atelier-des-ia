# Maintenance de l’Atelier des IA

Ce document s’adresse à la personne qui développe l’application. Les apprenants utilisent le README et l’aide intégrée.

## Outils et commandes

Node 24 LTS et npm. Les versions exactes sont dans package-lock.json. Aucun Python n’est requis pour ce socle.

```powershell
npm ci
npm run assets
npm run dev
```

- `npm run build` : ressources locales, vérification TypeScript et compilation des trois contextes Electron.
- `npm test` : intégrité, téléchargements et packs hors ligne dans des dossiers temporaires.
- `npm run models:fixtures`, puis `npm run test:e2e` : vrai Electron et vraies inférences ; récupère d’abord les artefacts exacts du registre existant sans changer les versions.
- `npm run package:win` : installateur NSIS par utilisateur, sans droits administrateur demandés par l’installateur. Le poste peut néanmoins imposer ses propres restrictions.
- `npm run package:dir` : application non compressée pour essais de packaging.
- `npm run package:mac` / `npm run package:linux` : configurations prévues, à exécuter et qualifier sur les plateformes cibles.

## Ressources et reproductibilité

`resources/models.lock.json` est le registre de confiance livré avec l’application : URLs Hugging Face épinglées sur des commits, tailles et SHA-256. Le renderer ne fournit ni chemin libre ni URL de téléchargement.

`node scripts/update-registry.mjs` est une opération de maintenance volontaire : télécharge les candidats, recalcule leurs empreintes et change le registre. Relire le diff, les licences et refaire les tests avant de livrer. Le script garde des copies de test dans resources/registry-downloads, ignorées par Git et exclues du paquet.

`node scripts/prepare-samples.mjs` recrée les médias depuis leurs sources et les SVG du projet. Les images produites sont conservées dans Git : aucune génération ni connexion n’est nécessaire chez l’apprenant.

`npm run assets` copie les moteurs WASM depuis les paquets npm verrouillés. Les moteurs font partie de l’application ; seuls les poids et configurations des ateliers sont téléchargés à la demande.

## Architecture

- `src/main` : fenêtre, diagnostic OS, contrôle d’une opération à la fois, téléchargement, intégrité, packs et nettoyage.
- `src/preload` : pont IPC limité à des fonctions nommées. Aucun accès générique à IPC, Node ou au système de fichiers dans l’interface.
- `src/renderer/src/main.tsx` : parcours utilisateur et états de l’interface.
- `src/renderer/src/engine.ts` : moteurs de calcul dans une fenêtre Electron invisible, isolée du rendu de l’interface et détruite après chaque opération.
- `src/shared` : types, catalogue d’ateliers et métadonnées.

Les trois ateliers utilisent le CPU via ONNX Runtime Web (un thread). OCR utilise PaddleOCR.js et OpenCV.js ; la voix utilise les poids Siwis et le phonémiseur Piper/eSpeak compilé en WASM. Aucun moteur natif Python n’est installé. Le coût de ce choix est un rechargement à chaque calcul ; l’interface distingue préparation et inférence.

Le processus principal peut interrompre la fenêtre de calcul. Un délai de 90 secondes borne les opérations ; une surveillance interrompt si la mémoire libre tombe sous 192 Mio. Avant calcul, les minima provisoires de mémoire libre sont 384 / 640 / 896 Mio pour vision / OCR / voix. Ces seuils évitent des essais manifestement risqués, mais ne garantissent pas l’absence de saturation. Les qualifier sur les portables cibles ; ne pas les présenter comme des minima matériels validés.

Les pics reportés additionnent les working sets des processus Electron. Ils ne représentent ni la mémoire totale du système ni une mesure parfaite de mémoire physique unique. Le test vocal automatique vérifie un signal non vide et fini ; il ne prouve pas l’intelligibilité de la voix.

## Données et nettoyage

Un test est associé à une empreinte locale SHA-256 du poste (nom de machine non conservé en clair, CPU, RAM totale, système et architecture), à la version de l’app, du moteur et des poids. Un dossier de données copié ou itinérant ne doit pas transférer un statut « prêt » à un autre ordinateur. Les enregistrements anciens sans empreinte ou avec mesures invalides sont ignorés. Cette empreinte ne quitte pas l’ordinateur.

Les fichiers gérés sont dans `app.getPath('userData')/atelier-resources`, en sous-dossiers classification, ocr et speech. Chaque module conserve uniquement ses fichiers du registre et son test de référence. Les `.part` permettent la reprise ; l’activation suit une vérification complète et un renommage.

En développement uniquement, `ATELIER_DATA_DIR` permet un dossier dédié aux tests. Il est ignoré dans l’application installée. Les fichiers audio restent en mémoire jusqu’à export explicite. Aucun journal ne doit stocker les phrases saisies.

`ATELIER_TEST_PROFILE` isole aussi le profil Chromium lors des tests de développement ; ce réglage est également ignoré dans les builds installés. Le test principal utilise un profil neuf pour ne pas dépendre de données du profil utilisateur.

Le nettoyage depuis l’interface supprime uniquement une liste connue de fichiers. Il ne fait aucune suppression récursive et ne touche pas aux caches partagés d’autres logiciels. L’option de lancement `--clean-data` permet un nettoyage avec dialogue natif si l’interface ne se charge plus ; fermer toute instance auparavant. La désinstallation standard peut conserver le dossier de données : nettoyer avant désinstallation si souhaité.

Le nettoyage natif complet efface aussi le cache réseau et le stockage web de la session Electron. Le script « Nettoyer les donnees.cmd », placé à côté de l’exécutable Windows, ouvre ce dialogue ; il ne supprime aucun fichier par une commande shell.

Les packs sont des dossiers avec un marqueur atelier-pack.json. Le pack ne choisit jamais les noms de fichiers ou leurs empreintes : le registre embarqué les impose. Tous les fichiers sont vérifiés avant import ; des sous-dossiers symboliques sont refusés.

Réimporter un pack ne réécrit pas les fichiers déjà valides. Les lectures d’empreintes ferment leur fichier avant activation ; le renommage atomique est réessayé brièvement en cas de verrouillage temporaire Windows. L’ancienne version utilisable n’est jamais supprimée pour forcer un remplacement.

## Frontières de sécurité

Sandbox et isolation de contexte actives. Node désactivé dans le renderer, origine locale dédiée, navigation et nouvelles fenêtres bloquées. Permissions caméra/microphone et contenus distants refusés. Sorties des modèles affichées comme texte. Les envois IPC sont limités à la fenêtre principale et à son frame supérieur ; les messages moteur sont acceptés seulement depuis la fenêtre de calcul courante.

Les téléchargements passent par le processus principal et ses URLs fixes. Les requêtes HTTP des renderers sont bloquées en production. Les hashes viennent du registre compilé, pas d’un manifeste téléchargé avec les poids.

L’interface est sur atelier://ui ; le calcul sur atelier://engine. OpenCV.js utilise des bindings Emscripten qui demandent l’évaluation dynamique de fonctions : unsafe-eval est permis uniquement dans l’origine de calcul, avec scripts locaux, sandbox, pont moteur limité et aucun contenu HTML utilisateur. L’interface conserve sa politique sans unsafe-eval. Ce compromis est explicite ; un remplacement d’OpenCV doit réexaminer cette exception.

## Distribution

L’installateur est strictement par utilisateur, sans mise à jour automatique ni installation pour tous les comptes : le helper d’élévation NSIS n’est pas embarqué. Cela évite une étape inutile de modification de l’archive et n’ajoute aucune demande de droits administrateur.

Le prototype Windows utilise un installateur par utilisateur non signé. La signature est désactivée pour ce prototype local ; l’icône et les métadonnées restent appliquées. Qualifier certificats, réputation Windows, notarisation Mac et architectures avant une publication. Aucune mise à jour automatique ni télémétrie n’est installée. Les mises à jour restent manuelles dans ce prototype.

Un changement doit mettre à jour le README si l’usage change, VALIDATION.md si une capacité est ajoutée ou testée, DECISIONS.md pour un choix structurel, et le plan si le périmètre change. Aucun atelier ne devient « prêt » grâce à une capture d’écran ou un simple test de démarrage.
