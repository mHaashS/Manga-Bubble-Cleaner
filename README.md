# Manga-Bubble-Cleaner
Objectif global
Créer un pipeline automatisé pour :

- Détecter les bulles dans des pages de manga (bubbles, narration, floating text)
- Nettoyer ces bulles (effacement ou inpainting)
- Extraire le texte original (OCR)
- Le traduire automatiquement
- Générer des fichiers .txt qui contient le texte original et traduit (au cas où la traduction automatique est incorrecte)
- Réinsérer le texte dans l’image

## Étape 1 — Entraînement du modèle
Objectif
Détecter automatiquement les bulles dans les pages de manga avec un modèle Mask R-CNN personnalisé.

🧪 Mise en œuvre
Annotations faites via CVAT, exportées au format COCO JSON

Les classes sont :
- bubble (attributs : normal, cri, malade)
- floating_text (attributs : titre, cri, narration)
- narration_box (sans attribut)

Lors de l'annotation des données sur CVAT, j'avais initialement ajouté des attributs personnalisés à certaines classes, comme :
bubble → {normal, cri, malade}
floating_text → {titre, narration, cri}
Cependant, je me suis rendu compte trop tard que Detectron2 ne prend pas en compte les attributs COCO dans son format d'entraînement.
Seuls les labels (classes) sont utilisés, ce qui signifie que ces attributs ont été ignorés lors de l'entraînement.

Le script enregistre deux datasets :
register_coco_instances("manga_train", {}, annotations_train.json, images/)
register_coco_instances("manga_val", {}, annotations_val.json, images/)
Le modèle Mask R-CNN est entraîné avec les 3 classes.

Le modèle est sauvegardé dans : output/model_final.pth

## Étape 2 — Observation des prédictions du modèle
Après avoir entraîné mon modèle, j’ai voulu m’assurer qu’il était capable de reconnaître visuellement les bulles dans une page de manga.
Pour cela, j’ai préparé quelques images de test, puis j’ai lancé le modèle pour voir où et comment il détectait les objets.

L’objectif n’était pas encore de nettoyer ou traduire quoi que ce soit, mais simplement de :
- Valider que les bulles étaient bien reconnues
- Voir si les masques collaient bien aux contours réels
- Et vérifier si le modèle faisait des erreurs (oubli, confusion...)

J’ai visualisé les prédictions sur les images avec des couleurs différentes pour chaque type de bulle (bulles classiques, floating text, narration).
Cela m’a permis de juger rapidement :
- Si la qualité de l'entraînement était suffisante
- Si les annotations initiales étaient cohérentes
- Et si je pouvais passer à l’étape suivante

Pour les pages avec des bulles simples, le modèle arrive facilement à reconnaitre les bulles.
![image1](https://github.com/user-attachments/assets/121673fe-a03b-4f78-9d34-e18871854b21)

La tâche se complique un peu quand il s'attaque à des floating_text.
Surement du au fait qu'il y avait moins de data avec des floating_text.
![image2](https://github.com/user-attachments/assets/30997745-2115-4465-b0b0-148027ca5779)
