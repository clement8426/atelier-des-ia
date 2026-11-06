# Décisions techniques

## 6 novembre 2026 — Socle indépendant

Application Electron + React/TypeScript dans son propre dossier et dépôt local. Le projet de cours et les dépôts Labo UX restent indépendants. Aucun service distant d’inférence.

## 6 novembre 2026 — CPU WebAssembly

Le plan proposait d’examiner les moteurs natifs. Pour ce premier socle, ONNX Runtime Web, PaddleOCR.js et un phonémiseur Piper WASM évitent trois chaînes de binaires natifs différentes. Les moteurs sont embarqués et les modèles sont locaux après téléchargement. Pas de GPU obligatoire. Un seul thread est utilisé pour simplifier les contraintes d’exécution et préserver la réactivité du poste.

Le calcul est dans une fenêtre Electron invisible dédiée, pas dans celle de l’interface. La destruction du contexte donne une annulation effective et libère sa chaîne de modèles. Coûts acceptés à mesurer : mémoire de Chromium et chargement à chaque opération.

## 6 novembre 2026 — Packs de séance

Un dossier transférable plutôt qu’une archive à extraire : moins de dépendances, vérification contre un registre connu et import depuis une clé USB. Le test local n’est pas transféré : les performances d’un autre poste ne qualifient pas celui de l’apprenant.

## 6 novembre 2026 — Modèles figés, mises à jour volontaires

Le registre est compilé avec l’application. Une modification nécessite une nouvelle compilation et une vérification des exemples. Aucune exécution de code distant de modèle, aucun installateur Python et aucun téléchargement silencieux au lancement.

## 6 novembre 2026 — Première version et limites

Trois ateliers réels. Le reste du catalogue est une feuille de route ; pas de boutons de démonstration qui simulent des fonctionnalités absentes. Les cas limites intégrés évitent de confondre « exemple qui fonctionne » et garantie générale. Aucune caméra requise dans ce socle.

## 6 novembre 2026 — Export de classification écarté par les essais

L’export model_quantized.onnx (2,7 Mo) du dépôt candidat ne reconnaît pas le labrador de référence lors de nos essais CPU, dans Electron comme dans une vérification WASM indépendante. L’export model.onnx (10,2 Mo) du même commit le classe correctement. Le registre retient donc les poids flottants, malgré un téléchargement plus grand. Cette observation ne mesure pas la précision générale des deux exports ; elle suffit à rejeter le premier pour notre parcours et notre moteur. Le script check-classifier.mjs permet de reproduire la comparaison.
