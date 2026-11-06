# Plan de réalisation — Atelier des IA

État : prototype du socle réalisé le 6 novembre 2026 ; qualification du parc apprenant et distribution publique encore ouvertes. Voir VALIDATION.md pour les preuves et limites.
Révision : revue contradictoire du 6 novembre 2026 intégrée ; choix des moteurs et performances encore à qualifier.
Nom de travail : Atelier des IA.

## 1. Décisions validées

- Application Electron autonome, distincte du Harnais, du plugin Labo UX et du site Le Labo.
- Public débutant : aucune commande à saisir, aucun Python, Node.js ou Docker à installer soi-même.
- Cible minimale : portable i3/i5, 8 Go de RAM, sans carte graphique dédiée. Profil étendu : 16 Go.
- Calculs locaux ; pas de serveur d’inférence à financer ou à administrer par le formateur.
- Exemples intégrés et présélectionnés. Ils devront être testés avec les modèles et versions réellement distribués.
- Diagnostic du matériel et tests réels avant de proposer les ateliers adaptés.
- Téléchargement progressif des modèles ; nettoyage explicite et désinstallation prévus dès le début.
- Génération d’image : expérimentation locale à mesurer. Génération vidéo : explication et exemples préparés, sans exécution locale prévue sur ce parc.

La facilité visée est une installation et un lancement sans intervention technique. Le premier téléchargement de l’application et des modèles ne peut pas être promis en deux secondes.

« Windows, macOS et Linux » désigne un objectif de distribution, pas une compatibilité déjà acquise. Les versions des systèmes, architectures et processeurs réellement pris en charge seront publiés après tests. Un ordinateur i3/i5 de 8 Go n’est pas à lui seul une configuration précise.

La première version essayable comprend trois ateliers : classification, OCR et synthèse vocale. Les autres restent dans la feuille de route ; leur nombre ne conditionne pas la première séance pilote.

## 2. Place des trois supports

- Les diapos expliquent les capacités et leurs différences ; leur amélioration graphique reste un chantier distinct.
- L’Atelier des IA fait essayer chaque capacité séparément, en quelques gestes.
- Le Harnais montre comment assembler plusieurs outils autour d’une IA.

Un petit site Next.js sur Vercel pourra présenter l’atelier, proposer les téléchargements et les instructions. L’application embarquera sa propre interface React/TypeScript et fonctionnera indépendamment de ce site, après récupération des ressources nécessaires.

## 3. Parcours débutant

1. Télécharger l’installateur correspondant à son système.
2. Ouvrir l’application et consulter le diagnostic léger du système, sans téléchargement obligatoire de tous les modèles.
3. Choisir un atelier proposé pour sa machine.
4. Si nécessaire, télécharger le modèle : taille et progression visibles, annulation et reprise possibles.
5. Choisir un exemple intégré, lancer l’expérience, observer le résultat.
6. Lire une courte explication : entrée, sortie, ce que le modèle sait faire et sa limite principale.
7. Recommencer, passer à l’atelier suivant ou supprimer les ressources téléchargées.

Les autorisations caméra et microphone seront demandées au moment de l’expérience correspondante. Des médias intégrés permettront aussi de découvrir les ateliers sans caméra ou microphone.

Avant le cours, proposer « Préparer ma séance » : sélectionner les ateliers, annoncer la taille totale et télécharger puis tester leurs ressources. Fournir aussi un pack de ressources importable hors ligne, vérifié et versionné, pour éviter que toute la classe dépende du Wi-Fi le jour même. Après préparation, aucune police, bibliothèque, voix ou donnée d’inférence ne doit être récupérée silencieusement sur Internet. Un exemple préenregistré sera explicitement distingué d’un résultat calculé sur la machine.

## 4. Diagnostic de configuration

### Au premier lancement

- Identifier système, architecture, CPU, RAM totale et disponible, espace disque disponible.
- Vérifier que le moteur de base fourni pour cette plateforme démarre correctement ; relever les capacités CPU nécessaires au binaire retenu.
- Exécuter un autotest court du moteur, sans charger les modèles optionnels.
- Présenter trois états simples par atelier : « prêt », « non testé », « indisponible », avec une raison courte. Distinguer ressources absentes, incompatibilité technique, mémoire insuffisante et échec du test.

La fiche matérielle donne une première estimation. Elle ne suffit pas à annoncer qu’un modèle fonctionne : chaque moteur et chaque atelier devront passer leur propre test de référence.

### Lors de l’activation d’un atelier

- Vérifier mémoire et disque disponibles avant téléchargement et chargement.
- Tester le modèle sur un média intégré connu.
- Mesurer temps de chargement, temps d’inférence et pic de mémoire des processus concernés.
- Ne proposer le module dans le parcours conseillé qu’après réussite du test.
- Permettre un nouveau diagnostic après une mise à jour ou un changement de configuration.

Ne pas lancer d’inférence avant disponibilité des fichiers vérifiés. Associer chaque résultat de test à la version de l’application, du moteur, du modèle et à la configuration observée. Le statut « prêt » signifie que le test a réussi à cet instant ; vérifier de nouveau les ressources disponibles avant chaque traitement. Un échec reste limité à l’atelier concerné.

Les profils 8 et 16 Go sont des cibles de validation, pas des performances déjà mesurées.

## 5. Architecture retenue pour le prototype

- Electron pour l’installation, la fenêtre et le cycle de vie de l’application.
- Interface React/TypeScript avec une seule fenêtre principale.
- Inférence dans des workers ou processus séparés de l’interface. Moteurs natifs embarqués lorsque nécessaire.
- Viser un moteur CPU commun pour les premiers ateliers, par exemple ONNX Runtime, sans imposer de GPU ou de WebGPU. Valider chaque graphe et son pré/post-traitement ; partager un format ne garantit pas une intégration interchangeable. Justifier tout moteur supplémentaire par un besoin mesuré.
- Définir les binaires par couple système/architecture et tester le paquet Electron, pas seulement un script de développement. Les dépendances natives peuvent demander reconstruction ou packaging particulier.
- Communications locales par IPC ; pas de serveur Next.js à installer chez l’apprenant.
- Registre des modèles : tâche, version exacte, fichiers, taille, empreinte, provenance, licence et résultats des tests.
- Un seul atelier de calcul actif à la fois ; il peut comporter plusieurs modèles, par exemple détection puis lecture des zones de texte en OCR. Arrêter et décharger toute sa chaîne avant le suivant.
- Nombre de threads borné, entrées limitées, durée maximale et annulation contrôlée.
- Surveillance de la mémoire et interruption avant saturation lorsque possible ; l’isolation seule ne protège pas d’un épuisement global de la RAM.
- Interface toujours utilisable : annuler, revenir, lire une erreur et réessayer sans redémarrer toute l’app.
- Téléchargements et traitements interrompus proprement à la fermeture ; aucun service permanent au démarrage de l’ordinateur.

Une annulation doit pouvoir arrêter le processus de calcul, même si la bibliothèque ne fournit pas d’annulation coopérative. Le pilote teste aussi chargement bloqué, fermeture pendant calcul et redémarrage après échec. La surveillance mémoire réduit les risques ; elle ne garantit pas l’absence de saturation du système.

### Contrat minimal des ressources et de l’interface

- Registre livré avec l’application ou authentifié, versions épinglées et téléchargements HTTPS autorisés. Une empreinte venant du même manifeste distant non authentifié ne suffit pas à établir sa provenance.
- Vérification des empreintes avant activation ; fichiers partiels isolés, installation atomique, pas d’écrasement d’une version utilisable après coupure. La reprise vérifie que le fichier distant n’a pas changé.
- Calculer le besoin disque complet : téléchargement, fichiers extraits/convertis et espace temporaire ; ne pas afficher uniquement la taille des poids.
- Interface locale isolée : Node désactivé dans le rendu, sandbox et contextIsolation actifs, politique de contenu restrictive, API preload et IPC limitées et validées. Ne pas exécuter du code de modèle téléchargé.
- Résultats OCR/LLM affichés comme contenu non fiable ; aucun HTML actif ni commande système issue d’une sortie de modèle.
- Caméra et microphone arrêtés à la sortie de l’atelier. Pas d’enregistrement durable des prises personnelles par défaut, pas de télémétrie ou d’envoi des entrées sans décision explicite ultérieure. Les journaux techniques évitent leur contenu.

Electron embarque Chromium : son coût de base en mémoire et sur disque sera inclus dans les mesures, pas seulement celui des poids des modèles.

## 6. Exemples intégrés et tests de référence

Pour chaque atelier :

- Prévoir un petit lot de médias autorisés et crédités : images, scans, sons, textes.
- Définir le résultat attendu : texte extrait, objet présent, catégorie dans les premiers résultats, etc.
- Garder des assertions adaptées : pas de dépendance à un score flottant exact ou à une génération parfaitement identique.
- Vérifier d’abord les exemples avant de les présenter comme « validés ».
- Conserver ensemble version du modèle, moteur, paramètres, plateforme et résultat du test.
- Embarquer les exemples pour éviter les dépendances à un site tiers pendant le cours.
- Séparer les exemples qui illustrent un résultat réussi des cas limites qui montrent une erreur ; quelques médias distincts servent aux tests de non-régression. Un succès sur des images choisies ne prouve pas la précision générale du modèle.
- Pour les tâches en français, valider accents, ponctuation et exemples réellement francophones. Fournir les libellés français pour la classification et distinguer score du modèle et certitude sur le monde réel.

L’import de médias personnels pourra venir ensuite. Les exemples intégrés seront le parcours principal et le moyen de reproduire un problème.

## 7. Lots de réalisation

### Lot 1 — Prototype technique et mesures

- [x] Créer un projet Electron autonome avec son propre dossier et sa propre configuration.
- [x] Construire l’accueil, le diagnostic et les pages d’atelier.
- [x] Classification MobileNetV3 Small avec poids flottants validés sur les exemples. L’export quantifié a été écarté après échec ; voir DECISIONS.md.
- [x] OCR : chaîne complète PP-OCRv6 Tiny détection + reconnaissance, dictionnaire et pré/post-traitement ; note et ticket français testés.
- [x] Voix : modèle Siwis ONNX et phonémiseur Piper/eSpeak WASM, sans moteur Python à installer. Signal généré testé automatiquement.
- [ ] Clôturer la provenance et les obligations de redistribution des poids vocaux et du phonémiseur compilé ; vérifier l’intelligibilité à l’écoute.
- [x] Intégrer des exemples et des cas limites.
- [x] Tester le téléchargement, le chargement, l’annulation et le cycle de vie des processus sur le poste Windows de développement.
- [x] Produire un installateur Windows et vérifier le démarrage et les trois chaînes dans l’application empaquetée. Essai sur Windows vierge toujours à faire.
- [ ] Mesurer sur un portable de 8 Go ; vérifier tôt les moteurs et formats sur macOS et Linux.
- [ ] Définir la matrice minimale système/version/architecture et l’accès aux machines de test ; vérifier tôt les signatures, les permissions et l’installation sur un poste sans droits administrateur.
- [x] Fixer les budgets provisoires : référence refusée au-delà de trente secondes de préparation ou dix secondes d’inférence ; arrêt forcé du contexte de calcul en cas d’annulation. Qualification sur les machines apprenantes toujours nécessaire.
- [ ] Mesurer RAM de toute l’application, pic au chargement, disque, démarrage à froid et répétitions ; vérifier l’absence de croissance continue après dix changements d’atelier. Choisir et consigner une réserve de mémoire disponible avant d’activer les calculs ; refuser l’essai si elle n’est pas tenable.

Critère de sortie : au moins une expérience reproductible de bout en bout, installable sans outils de développement, avec interface réactive et suppression des ressources vérifiée. Consigner les mesures et toute dérogation aux budgets ; un test réussi en temps illimité ne qualifie pas un atelier pour le cours. Rejeter ou remplacer les moteurs trop coûteux avant de multiplier les ateliers.

### Lot 2 — Première version pédagogique

#### 2A — Socle à tester en séance pilote

- [x] Classification d’images.
- [x] OCR.
- [x] Synthèse vocale en français, validation automatique du signal ; écoute à compléter.
- [ ] Parcours guidé : une consigne, une action, un résultat ; progression locale et accès libre aux ateliers disponibles.
- [x] Préparation de séance, export/import de packs hors ligne et suppression des ressources des ateliers.
- [ ] Première séance pilote sur la plateforme déjà qualifiée, avant ajout des autres capacités.

Critère de sortie : trois ateliers utilisables par des débutants, exemples validés, temps d’attente acceptés pendant le pilote et usage hors ligne réellement testé.

#### 2B — Extension du socle

- [ ] Détection d’objets.
- [ ] Transcription voix vers texte.
- [ ] Détection et suivi des points du visage.
- [ ] Reconnaissance de gestes.
- [ ] Segmentation de personne / arrière-plan.
- [ ] Pour les ateliers caméra : commencer par un cliché ou une basse résolution avec cadence bornée ; activer le temps réel seulement après mesure. Les points du visage ne sont pas une identification de la personne.
- [ ] Compléter les versions installables Windows, macOS et Linux suivant la matrice qualifiée, avec médias intégrés et nettoyage.

Critère de sortie : exemples validés, tests de configuration reproductibles et fonctionnement hors ligne une fois les modèles téléchargés.

### Lot 3 — Capacités complémentaires

- [ ] Classification de sons : YAMNet.
- [ ] Réduction du bruit : RNNoise.
- [ ] Traduction : Marian / OPUS-MT, anglais vers français.
- [ ] Recherche sémantique et recommandation simple : MiniLM multilingue.
- [ ] Petit LLM : Qwen3.5-0.8B quantifié, avec contexte et réponses courts.
- [ ] Description d’image : SmolVLM-256M, en explicitant les langues réellement validées.
- [ ] Estimation d’âge sur une photo : modèle ONNX, sortie approximative et facultative, sans identification de la personne.
- [ ] Génération musicale : MusicRNN, à partir de quelques notes.

Ces références sont des candidats de départ. Les versions, licences et performances seront vérifiées avant adoption. Aucun atelier n’est imposé aux machines qui échouent à son test.

### Lot 4 — Génération d’image et panorama vidéo

- [ ] Comparer des candidats actuels sur CPU ; SDXS-512-0.9 reste une référence de benchmark, pas un choix arrêté. Sa fiche signale une ancienne version et propose une variante plus récente ; vérifier qualité, compatibilité du décodeur et licence de la chaîne complète.
- [ ] Valider le packaging du moteur d’image séparément. FastSD CPU est une référence d’exécution, pas un composant Electron prêt à embarquer : son installation documentée dépend de Python/uv. Un moteur ou interpréteur nécessaire doit être embarqué et géré par l’application, jamais installé manuellement par l’apprenant.
- [ ] Limiter l’essai à une image de taille bornée, avec annulation et surveillance mémoire.
- [ ] Réserver le module au profil validé par mesure ; 16 Go est la première cible de test, sans garantie anticipée.
- [ ] Présenter la génération vidéo avec des extraits et leurs consignes d’origine, clairement signalés comme préparés.
- [ ] Expliquer pourquoi les modèles vidéo étudiés dépassent le budget de calcul de ces portables.

Critère de sortie : génération d’image locale activée seulement sur configuration qualifiée ; aucune attente bloquante pour les autres apprenants.

### Lot 5 — Distribution et séance pilote

- [ ] Préparer les installateurs par système et architecture retenus.
- [ ] Préparer signatures et notarisation requises pour une distribution fluide ; tester sur des postes propres.
- [ ] Prévoir comptes/certificats, éventuels frais et accès macOS pour la distribution Mac ; valider aussi la réputation et les avertissements Windows sur une machine fraîche. Une signature ne dispense pas d’un essai réel et n’annule pas les politiques d’un poste administré.
- [ ] Publier l’application et ses versions de modèles via une distribution versionnée.
- [ ] Prévoir une page Next.js/Vercel de présentation, téléchargement et dépannage court.
- [ ] Tester installation, premier téléchargement, reprise après coupure réseau, utilisation hors ligne, mise à jour et désinstallation.
- [ ] Faire une séance pilote sur un petit parc hétérogène avant distribution à toute une classe.

La séance pilote du socle a lieu au lot 2A ; ce lot étend la qualification aux plateformes et ateliers ajoutés. Ne pas attendre que toute la feuille de route soit terminée pour confronter l’app à des apprenants. L’absence de serveur d’inférence ne supprime pas les coûts ou la maintenance de distribution : hébergement des fichiers, bande passante, signatures et mises à jour restent à prévoir. En cas de poste bloqué par une politique informatique, proposer les exemples préparés et la démonstration du formateur plutôt qu’une procédure de contournement.

Critère de sortie : un non-développeur peut installer, faire une expérience et nettoyer les données avec les seules instructions affichées.

## 8. Nettoyage et désinstallation

- Stocker modèles, téléchargements temporaires, caches et résultats internes dans des dossiers propres à l’atelier.
- Éviter d’utiliser des caches partagés avec d’autres applications pour les ressources gérées par l’atelier.
- Afficher la place occupée et proposer la suppression par modèle ou de l’ensemble des données internes.
- Arrêter les traitements et libérer les fichiers avant suppression.
- Protéger les exports enregistrés volontairement hors des dossiers internes.
- Fournir un outil de nettoyage équivalent lorsque l’interface ne démarre plus.
- Vérifier les chemins autorisés et le manifeste des fichiers gérés avant toute suppression.
- Documenter la désinstallation de l’application pour chaque système, y compris les données éventuellement conservées par le désinstalleur natif.

## 9. Vérifications avant diffusion

- [ ] Aucun prérequis de développement demandé aux apprenants.
- [ ] Au moins un portable témoin de 8 Go et un de 16 Go mesurés, en tenant compte du système et des autres apps ouvertes.
- [ ] Installation et lancement vérifiés sur chaque plateforme annoncée comme prise en charge.
- [ ] Les ressources annoncées comme supprimées ne sont plus sur le disque après nettoyage.
- [ ] Tous les processus de calcul sont arrêtés après fermeture.
- [ ] Annulation, mémoire insuffisante, téléchargement incomplet et modèle indisponible sont gérés sans bloquer l’interface.
- [ ] Les ateliers restent lisibles au clavier et avec texte agrandi ; aucune permission caméra/microphone requise pour lire les explications.
- [ ] Les résultats approximatifs et les exemples préparés sont identifiés comme tels.
- [ ] Chaque modèle et chaque média ont une provenance et une licence vérifiées.
- [ ] Chaque chaîne de calcul a ses poids, dictionnaires, tokenizers, phonémiseurs, bibliothèques et notices de redistribution recensés ; aucune licence globale n’est déduite de la seule page d’un dépôt.
- [ ] Un échec d’atelier ou le refus d’une permission laisse les autres ateliers utilisables.
- [ ] Le pack de séance permet une ouverture à froid réseau coupé, sans ressources distantes cachées.

## 10. Prochaine action concrète

Le socle technique existe et les trois chaînes de modèles fonctionnent sur le poste de développement. Terminer l’essai du paquet distribué, clôturer les licences de redistribution, puis mesurer sur les portables cibles avant la séance pilote. La validation de cette base conditionne l’activation des ateliers suivants.

Le registre, les versions des dépendances, les sources et les limites de redistribution sont consignés. Les mesures et captures du poste de développement sont dans docs/evidence. Ne pas annoncer les portables de 8/16 Go, Mac ou Linux comme validés par ces seuls essais Windows.

## 11. Résultat de la revue contradictoire

| Priorité                     | Faiblesse du premier plan                                                              | Correction retenue / point restant ouvert                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Avant intégration            | OCR réduit au seul modèle de reconnaissance                                            | Définir la chaîne détection/lecture et valider le français.                                                    |
| Avant redistribution         | Licence du moteur vocal confondable avec celle de la voix ou du dépôt                  | Vérifier moteur, phonémiseur, poids et données ; choisir des obligations compatibles avec la diffusion prévue. |
| Avant promesse de support    | Trois OS annoncés sans matrice de versions, architectures ou accès aux tests           | Qualifier les couples réellement testés ; intégrer signatures et postes administrés tôt.                       |
| Avant validation pédagogique | Un test réussi sans budget pouvait activer un module inutilisable en cours             | Mesures à froid/chaud, budgets provisoires, annulation forcée et pilote du socle avant extension.              |
| Avant une séance             | Téléchargements à la demande insuffisants avec un Wi-Fi de classe saturé               | Préparation anticipée et pack hors ligne vérifié.                                                              |
| Architecture                 | Trop de moteurs possibles et « un modèle » incompatible avec les chaînes multi-modèles | Réduire les moteurs ; un atelier de calcul actif, toute sa chaîne déchargée.                                   |
| Périmètre                    | Huit ateliers et trois OS trop tôt pour une première version                           | Premier socle de trois ateliers, puis pilote et extension.                                                     |
| Pédagogie                    | Exemples présélectionnés susceptibles de donner une illusion de fiabilité générale     | Ajouter des cas limites, distinguer calcul réel/exemple préparé et détection/identification.                   |
| Exploration                  | Ancien modèle d’image choisi sans comparaison ni preuve de packaging                   | Comparer les candidats, conserver ce module expérimental et facultatif.                                        |

Conclusion de revue : pas de raison documentaire identifiée d’abandonner Electron. Cela ne prouve ni les performances sur 8 Go ni la faisabilité de tous les ateliers sur les trois OS. Les engagements techniques se décident à partir du prototype distribué et mesuré.

## Références techniques

- Electron, processus : https://www.electronjs.org/docs/latest/tutorial/process-model
- Electron, processus de calcul : https://www.electronjs.org/docs/latest/api/utility-process
- Electron, distribution : https://www.electronjs.org/docs/latest/tutorial/application-distribution
- Electron, sécurité et IPC : https://www.electronjs.org/docs/latest/tutorial/security
- Electron, modules natifs : https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules
- Electron, signatures et notarisation : https://www.electronjs.org/docs/latest/tutorial/code-signing
- ONNX Runtime, support Node par plateforme : https://onnxruntime.ai/docs/get-started/with-javascript/node.html
- OCR candidat : https://huggingface.co/PaddlePaddle/PP-OCRv6_tiny_rec_onnx
- OCR, chaîne complète : https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/OCR.html
- Classification : https://docs.pytorch.org/vision/main/models/generated/torchvision.models.mobilenet_v3_small.html
- Voix française : https://huggingface.co/rhasspy/piper-voices/tree/main/fr/fr_FR/siwis/medium
- Piper, moteur actuel : https://github.com/OHF-Voice/piper1-gpl
- Voix siwis, carte spécifique : https://huggingface.co/rhasspy/piper-voices/blob/main/fr/fr_FR/siwis/medium/MODEL_CARD
- Génération d’image candidate : https://huggingface.co/IDKiro/sdxs-512-0.9
- Exécution d’image sur CPU : https://github.com/rupeshs/fastsdcpu
