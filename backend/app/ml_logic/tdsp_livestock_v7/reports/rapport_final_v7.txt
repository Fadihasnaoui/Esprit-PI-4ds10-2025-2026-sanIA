==============================================================================
RAPPORT FINAL — TDSP YOLOv8 Livestock Classification | Version 7
==============================================================================
Date d'exécution : 2026-04-20 17:15
Environnement    : CPU
Dataset source   : g:\HP\Nouveaudd\data
Modèle retenu    : g:\HP\Nouveaudd\tdsp_livestock_v7\runs\finetune_cls_v6\weights\best.pt
Export ONNX      : g:\HP\Nouveaudd\tdsp_livestock_v7\exports\best.onnx

──────────────────────────────────────────────────────────────────────────────
1. DATASET
──────────────────────────────────────────────────────────────────────────────
   Total images : 7999
   cow         : 2000 images
   goat        : 2000 images
   horse       : 2000 images
   sheep       : 1999 images

──────────────────────────────────────────────────────────────────────────────
2. PARTITIONNEMENT (70 / 15 / 15)
──────────────────────────────────────────────────────────────────────────────
   cow         : train=1400 | val=300 | test=300
   goat        : train=1400 | val=300 | test=300
   horse       : train=1400 | val=300 | test=300
   sheep       : train=1399 | val=299 | test=299

──────────────────────────────────────────────────────────────────────────────
3. PERFORMANCES DES MODÈLES
──────────────────────────────────────────────────────────────────────────────
   Baseline  (YOLOv8n) : (non disponible)
   Fine-tune (YOLOv8s) : (non disponible)
   Test final          : (non disponible)

──────────────────────────────────────────────────────────────────────────────
4. BENCHMARK COMPARATIF
──────────────────────────────────────────────────────────────────────────────

| Modèle                    | Accuracy Top-1   | Top-5    | Temps moyen (ms)   | FPS              |   Params (M) |   GFLOPs | Statut                                                          |
|:--------------------------|:-----------------|:---------|:-------------------|:-----------------|-------------:|---------:|:----------------------------------------------------------------|
| YOLOv8n-cls (Baseline)    | 95.08 %          | 100.00 % | (non disponible)   | (non disponible) |         1.44 |      3.3 | Modèle introuvable                                              |
| YOLOv8s-cls (Fine-tune)   | 96.42 %          | 100.00 % | 97.24              | 10.28            |         5.08 |     12.5 | OK (24 inférences)                                              |
| YOLOv8s-cls (ONNX export) | 96.42 %          | 100.00 % | (non disponible)   | (non disponible) |         5.08 |     12.5 | Erreur: amax(): Expected reduction dim 1 to have non-zero size. |

──────────────────────────────────────────────────────────────────────────────
5. RÉSUMÉ DU MEILLEUR MODÈLE
──────────────────────────────────────────────────────────────────────────────
   Nom                : YOLOv8s-cls fine-tuned
   Format de déploiement : ONNX
   Chemin             : g:\HP\Nouveaudd\tdsp_livestock_v7\exports\best.onnx
   Accuracy Top-1     : 96.42 %
   Top-5              : 100.00 %
   Temps moyen (ms)   : nan
   FPS                : nan
   Paramètres (M)     : 5.080324
   GFLOPs             : 12.5

──────────────────────────────────────────────────────────────────────────────
6. ARCHITECTURE DU MEILLEUR MODÈLE
──────────────────────────────────────────────────────────────────────────────

|   Index | Type     |   Paramètres |   Paramètres entraînables | Rôle                                   |
|--------:|:---------|-------------:|--------------------------:|:---------------------------------------|
|       0 | Conv     |          464 |                         0 | Extraction de caractéristiques locales |
|       1 | Conv     |         4672 |                         0 | Extraction de caractéristiques locales |
|       2 | C2f      |         7360 |                         0 | Fusion / apprentissage hiérarchique    |
|       3 | Conv     |        18560 |                         0 | Extraction de caractéristiques locales |
|       4 | C2f      |        49664 |                         0 | Fusion / apprentissage hiérarchique    |
|       5 | Conv     |        73984 |                         0 | Extraction de caractéristiques locales |
|       6 | C2f      |       197632 |                         0 | Fusion / apprentissage hiérarchique    |
|       7 | Conv     |       295424 |                         0 | Extraction de caractéristiques locales |
|       8 | C2f      |       460288 |                         0 | Fusion / apprentissage hiérarchique    |
|       9 | Classify |       335364 |                         0 | Tête de classification                 |

Explication :
Le réseau commence par un backbone convolutionnel qui extrait les caractéristiques visuelles des animaux.
Les blocs intermédiaires apprennent des représentations plus riches et plus discriminantes.
La tête de classification transforme ces représentations en probabilités par classe.
Le fichier PT est utilisé pour l’analyse de l’architecture, tandis que le fichier ONNX sert au déploiement.

──────────────────────────────────────────────────────────────────────────────
7. EXPORTS
──────────────────────────────────────────────────────────────────────────────
   (aucun export détecté)

──────────────────────────────────────────────────────────────────────────────
8. EXPLICABILITÉ (XAI)
──────────────────────────────────────────────────────────────────────────────
   GradCAM : g:\HP\Nouveaudd\tdsp_livestock_v7\reports\xai_gradcam.png

==============================================================================