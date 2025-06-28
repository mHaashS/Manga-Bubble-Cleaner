# Manga-Bubble-Cleaner
### Objectif global
Créer un pipeline automatisé pour :

- Détecter les bulles dans des pages de manga (bubbles, narration, floating text)
- Nettoyer ces bulles (effacement ou inpainting)
- Extraire le texte original (OCR)
- Le traduire automatiquement
- Générer des fichiers .txt qui contient le texte original et traduit (au cas où la traduction automatique est incorrecte ou incomplète)
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


## Étape 3 — Nettoyage visuel des bulles
Une fois que j’étais satisfait de la détection des bulles, j’ai voulu effacer le texte qu’elles contiennent.
L’objectif ici n’était pas encore d’extraire le texte, mais simplement de vider les bulles pour pouvoir y insérer du texte plus tard.

Plutôt que de supprimer toutes les zones détectées de la même manière, j’ai choisi une approche adaptée au type de bulle :
- Pour les bulles classiques et les boîtes de narration, j’ai simplement rempli la zone avec une couleur blanche.
- Pour les floating text (souvent du texte sans contour net), j’ai utilisé une technique qui essaie de reconstruire le fond de l’image en supprimant le texte (inpainting) mais qui n'est pas au point.

Cette étape m’a permis de visualiser une page nettoyée de tout son texte, tout en gardant la structure des bulles intacte
Cela a été essentiel pour préparer l’insertion future du texte traduit.
J’ai aussi fixé un seuil de confiance à 75% pour ne nettoyer que les bulles dont le modèle était suffisamment sûr, afin d’éviter d’effacer des parties incorrectes.

![image3](https://github.com/user-attachments/assets/693c22b3-4398-4798-8222-fa7ae7d91cb5)
![image4](https://github.com/user-attachments/assets/c04343a7-7479-4693-8a9e-76a2465fc467)
