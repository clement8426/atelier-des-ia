# État des vérifications

Date de cette version : 6 novembre 2026. Prototype 0.1.0. Ne pas confondre un test sur le poste de développement avec une qualification du parc des apprenants.

## Fonctionnement réalisé

- Interface française : accueil, trois ateliers, préparation, diagnostic et aide.
- Modèles locaux CPU, registre épinglé et empreintes SHA-256.
- Téléchargement progressif, reprise, annulation, un atelier actif à la fois.
- Test de référence par atelier, mesures de chargement/inférence et mémoire de l’app.
- Packs hors ligne, suppression ciblée et nettoyage natif.
- Configurations d’installateurs Windows, Mac et Linux.

## Résultats sur le poste de développement

Windows 11 x64, AMD Ryzen 7 5700X, environ 32 Go de RAM installée : ce poste n’est pas représentatif d’un portable i3/i5 de 8 Go.

| Vérification                                    | Résultat                                                                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript strict, y compris imports inutilisés | Réussi                                                                                                                                      |
| Tests de stockage                               | 11 réussis : stockage et qualification, dont invalidation sur une autre machine et rejet des mesures altérées                               |
| Parcours Electron complet avec modèles réels    | Réussi, profil de test neuf                                                                                                                 |
| Application Windows empaquetée                  | Versions intermédiaires testées avec trois références hors ligne ; dernier paquet refusé par Device Guard, validation finale bloquée        |
| Installateur Windows                            | NSIS x64 généré, environ 148 Mo, par utilisateur ; installation/désinstallation réelles sur poste propre non testées                        |
| Exemples supplémentaires                        | Chat classé comme chat ; total du ticket retrouvé par OCR                                                                                   |
| Fonctionnement hors ligne                       | Calculs avec HTTP bloqué dans les renderers et fetch réseau désactivé dans le processus principal                                           |
| Annulation                                      | Calcul vocal réellement interrompu ; autres ateliers utilisables ensuite                                                                    |
| Cycle de vie                                    | 10 calculs successifs ; retour à un seul renderer d’interface, aucune accumulation de fenêtres de calcul                                    |
| Pack de séance                                  | Export, suppression, erreur de téléchargement hors ligne, réimport réel et absence de transfert du test local                               |
| Accessibilité automatique                       | Aucune violation axe sur l’accueil, les trois ateliers, la préparation, le diagnostic et l’aide (règles WCAG A/AA sélectionnées)            |
| Affichage                                       | Captures inspectées à 1440×900, 900×720 et 600×800 ; absence de débordement horizontal vérifiée aux deux petites tailles                    |
| Clavier et mouvement                            | Focus visible, navigation Tab ; préférence de réduction des animations vérifiée                                                             |
| Dépendances npm                                 | Aucun avis de vulnérabilité dans le dernier npm audit ; ce résultat ne couvre pas toutes les bibliothèques compilées dans les fichiers WASM |

Les mesures du dernier test de référence sont dans [evidence/measurements.json](evidence/measurements.json). Valeurs observées, hors téléchargement :

| Atelier                             | Préparation du moteur et du modèle | Inférence      | Pic des processus de l’app |
| ----------------------------------- | ---------------------------------- | -------------- | -------------------------- |
| Classification                      | environ 0,45 s                     | environ 0,03 s | environ 690 Mio            |
| OCR                                 | environ 2 s                        | environ 0,72 s | environ 1 090 Mio          |
| Voix française, phrase de référence | environ 2,6 s                      | environ 0,85 s | environ 1 000 Mio          |

Ces chiffres ne sont pas des promesses sur un autre poste. Un essai OCR antérieur a pris environ 33 secondes de préparation et a été refusé par le budget ; les essais suivants étaient plus rapides. Le premier démarrage, les caches et la charge système restent à examiner sur le parc réel. Le test vocal automatique ne remplace pas une écoute humaine.

Les boîtes de choix de dossier natives sont simulées dans le test automatisé des packs ; l’IPC et les copies/vérifications sont réels. La sélection native d’un dossier et l’installation sur un Windows propre restent à vérifier manuellement. L’analyse automatique et l’inspection des captures ne constituent pas un audit complet avec lecteur d’écran.

Captures, erreurs provoquées et contrôles détaillés : [dossier evidence](evidence/).

Une version intermédiaire a exécuté les trois ateliers empaquetés. La dernière tentative a été refusée explicitement par Device Guard ; elle ne doit pas être déclarée validée. [État du paquet final](evidence/package-smoke.json) et [mesures intermédiaires conservées](evidence/package-smoke-intermediaire.json). Il faut signer le programme ou obtenir son autorisation informatique, puis refaire cet essai. Aucune modification des protections Windows n’a été effectuée.

## Ce qui reste à qualifier avant diffusion aux apprenants

- Vrais portables de 8 et 16 Go, processeurs d’entrée de gamme et applications de cours ouvertes.
- Installation sur un Windows propre sans outils de développement ni ressources de test.
- macOS Intel / Apple Silicon et distributions Linux retenues, versions et architectures explicites.
- Signatures Windows, notarisation Mac, comportement des postes scolaires administrés.
- Écoute de la voix française et validation pédagogique avec quelques apprenants.
- Chaîne de licences de la voix et sources correspondantes du phonémiseur compilé.
- Mise à jour manuelle entre versions : compatibilité de packs, requalification et récupération après échec.

Aucune génération d’image/vidéo, transcription, webcam ou autre extension n’est présentée comme réalisée.
