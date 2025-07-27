# Manga-Bubble-Cleaner
### Objectif global
Créer un pipeline automatisé pour :

- Détecter les bulles dans des pages de manga (bubbles, narration, floating text)
- Nettoyer ces bulles (effacement ou inpainting)
- Extraire le texte original (OCR)
- Le traduire automatiquement
- Générer des fichiers .txt + .json qui contiennent le texte original et traduit (au cas où la traduction automatique est incorrecte ou incomplète) et la position des bulles
- Réinsérer le texte dans l'image avec la position dans le json

## 🚀 Installation et Utilisation

### Prérequis
- Python 3.8+
- CUDA (optionnel, pour l'accélération GPU)
- Clé API OpenAI

### Installation

1. **Cloner le repository**
```bash
git clone https://github.com/mHaashS/Manga-Bubble-Cleaner.git
cd Manga-Bubble-Cleaner
```

2. **Créer un environnement virtuel**
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

3. **Installer les dépendances**
```bash
pip install -r requirements.txt
```

4. **Configurer la clé API OpenAI**
```bash
# Windows
set OPENAI_API_KEY=votre_clé_api_ici
# Linux/Mac
export OPENAI_API_KEY=votre_clé_api_ici
```

### 🎯 **Création d'un exécutable autonome**

Pour créer une application que vous pouvez lancer en double-cliquant :

1. **Créer l'exécutable**
```bash
python build_exe.py
```

2. **Lancer l'application**
- Double-cliquez sur `BubbleCleaner.exe` dans le répertoire principal
- Ou utilisez le script simple : `python launch_simple.py`

**Avantages de l'exécutable :**
- ✅ **Lancement en un clic** : Double-clic pour démarrer
- ✅ **Application autonome** : Pas besoin de ligne de commande
- ✅ **Portable** : Peut être copié sur d'autres machines
- ✅ **Interface native** : Intégration parfaite avec Windows
- ✅ **Pas de console** : Interface graphique uniquement

### Utilisation

#### 🖥️ **Interface Graphique (Recommandée)**

Lancez l'application graphique moderne avec interface épurée :

```bash
python launch_gui.py
```

Ou directement :
```bash
python gui_app.py
```

**Fonctionnalités de l'interface graphique :**
- ✅ Interface moderne et épurée
- ✅ **Thème sombre/clair** - Basculement entre modes clair et sombre
- ✅ Sélection de fichiers/dossiers via l'explorateur Windows
- ✅ Logs en temps réel
- ✅ Sauvegarde/chargement de configurations
- ✅ Mode verbeux intégré
- ✅ Gestion des erreurs avec messages informatifs
- ✅ Threading pour éviter le gel de l'interface

#### 🔄 **Interface de Traitement par Lots (Avancée)**

Pour traiter plusieurs images en une fois avec contrôle total :

```bash
python launch_batch.py
```

**Fonctionnalités du traitement par lots :**
- ✅ **Traitement en arrière-plan** : Interface responsive pendant le traitement
- ✅ **Barre de progression** : Suivi en temps réel de l'avancement
- ✅ **Contrôles avancés** : Pause, reprise, arrêt du traitement
- ✅ **Statistiques détaillées** : Temps écoulé, temps restant, taux de réussite
- ✅ **Gestion des erreurs** : Continue même si une image échoue
- ✅ **Sélection multiple** : Images individuelles ou dossiers complets
- ✅ **Logs détaillés** : Historique complet avec sauvegarde
- ✅ **Thème sombre/clair** : Même système que l'interface principale

#### 🎯 **Interface Interactive (Console)**

Lancez l'interface interactive qui vous guide à travers toutes les options :

```bash
python launch.py
```

Ou directement :
```bash
python scripts/interactive_pipeline.py
```

**Fonctionnalités de l'interface :**
- ✅ Sélection automatique d'images dans le projet
- ✅ Menu intuitif avec toutes les options
- ✅ Sauvegarde de la configuration
- ✅ Gestion des erreurs
- ✅ Mode verbeux intégré

### 🎨 **Thème Sombre/Clair**

L'interface graphique propose maintenant un **système de thème** pour améliorer l'expérience utilisateur :

#### **Fonctionnalités du thème :**
- ✅ **Basculement instantané** : Changez de thème en un clic
- ✅ **Sauvegarde automatique** : Votre préférence est mémorisée
- ✅ **Interface adaptée** : Tous les éléments s'adaptent au thème
- ✅ **Icônes intuitives** : 🌙 pour passer en sombre, ☀️ pour passer en clair

#### **Utilisation :**
1. Lancez l'interface graphique : `python launch_gui.py`
2. Cliquez sur le bouton **"🌙 Thème Clair"** ou **"☀️ Thème Sombre"**
3. Le thème change instantanément et est sauvegardé

#### **Avantages :**
- **🌙 Mode sombre** : Idéal pour travailler dans l'obscurité
- **☀️ Mode clair** : Parfait pour la lumière du jour
- **👁️ Réduction de la fatigue oculaire** : Couleurs adaptées
- **🎯 Personnalisation** : Chaque utilisateur peut choisir sa préférence

#### Pipeline en ligne de commande

##### Pipeline complet
```bash
python scripts/main_pipeline.py chemin/vers/image.jpg
```

##### Options disponibles
```bash
# Nettoyer seulement (pas de traduction)
python scripts/main_pipeline.py image.jpg --clean-only

# Traduire seulement (pas de nettoyage)
python scripts/main_pipeline.py image.jpg --translate-only

# Spécifier un répertoire de sortie
python scripts/main_pipeline.py image.jpg --output-dir mon_output

# Mode verbeux
python scripts/main_pipeline.py image.jpg --verbose
```

#### Scripts individuels
```bash
# Nettoyage des bulles
python scripts/clean_bubbles.py image.jpg

# Extraction et traduction
python scripts/translate_bubbles.py image.jpg

# Réinsertion du texte traduit
python scripts/reinsert_translations.py image_clean.png image.json
```

### Structure des sorties
```
output/
├── cleaned/          # Images avec bulles nettoyées
├── translations/     # Fichiers .txt et .json avec traductions
├── final/           # Images finales avec texte traduit
└── logs/            # Fichiers de logs
```

## 📋 Table des matières

- [Étape 1 — Entraînement du modèle](#étape-1--entraînement-du-modèle)  
- [Étape 2 — Observation des prédictions du modèle](#étape-2--observation-des-prédictions-du-modèle)  
- [Étape 3 — Nettoyage visuel des bulles](#étape-3--nettoyage-visuel-des-bulles)  
- [Étape 4 — Extraction du texte + Traduction automatique](#étape-4--extraction-du-texte--traduction-automatique)  
- [Étape 5 — Réinsertion du texte traduit dans les bulles](#étape-5--réinsertion-du-texte-traduit-dans-les-bulles)  
- [Cloner le dépôt](#cloner-le-dépôt)  
- [Technologies utilisées](#technologies-utilisées)

## 📋 Étape 1 — Entraînement du modèle
Objectif :
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

## Étape 4 — Extraction du texte + Traduction automatique
Une fois les bulles détectées sur une page de manga, j’ai automatisé un processus en deux temps :
🔍 lire le texte présent dans chaque bulle, puis 🌍 le traduire automatiquement en français.

J’ai regroupé ces deux étapes dans un seul script, qui prend une image en entrée et produit un fichier .txt et .json comme sortie.

🧪 Étapes du traitement
Pour chaque bulle détectée :
- Extraction de la zone à partir du masque de segmentation
- Découpage de la zone dans l’image (ROI)

Application d’EasyOCR :
- OCR robuste, sans prétraitement nécessaire
- Capable de lire du texte stylisé et irrégulier
- Résultat brut nettoyé (espaces multiples, retours à la ligne, etc.)

Traduction automatique :
- Traduction du texte anglais vers le français
- Réalisée via l’API OpenAI (GPT-3.5)
- Le texte original et sa traduction sont tous deux enregistrés

Export des résultats :
- En .txt lisible pour l’utilisateur
- En .json structuré pour usage automatisé
  
![image5](https://github.com/user-attachments/assets/89ffcd4e-02e1-4dfa-bb3c-f1537178c068)

## 🔄 **Traitement par Lots - Fonctionnalité Avancée**

Le **traitement par lots** permet de traiter plusieurs images simultanément avec un contrôle total sur le processus. Cette fonctionnalité est idéale pour traiter des volumes importants de pages de manga.

### 🎯 **Avantages du traitement par lots :**

- ⚡ **Gain de temps** : Traitement automatique de nombreuses images
- 🎮 **Contrôle total** : Pause, reprise, arrêt selon les besoins
- 📊 **Visibilité** : Suivi précis de l'avancement en temps réel
- 🛡️ **Robustesse** : Continue même en cas d'erreur sur une image
- 📈 **Statistiques** : Temps total, taux de réussite, estimation restante

### 🖥️ **Interface dédiée :**

```bash
python launch_batch.py
```

### 📋 **Fonctionnalités principales :**

#### **Sélection des images :**
- 📸 **Images individuelles** : Sélection multiple via l'explorateur
- 📂 **Dossiers complets** : Traitement récursif de tous les sous-dossiers
- 🗑️ **Gestion de liste** : Ajout/suppression d'images en cours

#### **Contrôles avancés :**
- 🚀 **Démarrer** : Lance le traitement en arrière-plan
- ⏸️ **Pause/Reprendre** : Contrôle précis du processus
- ⏹️ **Arrêter** : Arrêt propre avec sauvegarde de l'état
- 📊 **Progression** : Barre de progression et statistiques temps réel

#### **Monitoring en temps réel :**
- ⏱️ **Temps écoulé** : Durée depuis le début
- ⏳ **Temps restant** : Estimation basée sur la vitesse actuelle
- ✅ **Réussites** : Nombre d'images traitées avec succès
- ❌ **Échecs** : Images ayant échoué avec détails d'erreur

#### **Logs détaillés :**
- 📋 **Historique complet** : Toutes les actions et erreurs
- 💾 **Sauvegarde** : Export des logs en fichier texte
- 🗑️ **Nettoyage** : Effacement des logs si nécessaire

### 🎨 **Interface moderne :**
- 🌙 **Thème sombre/clair** : Même système que l'interface principale
- 📱 **Responsive** : S'adapte à la taille de la fenêtre
- 🎯 **Intuitive** : Interface claire et organisée

### 📁 **Structure de sortie :**
Chaque image traitée génère son propre dossier :
```
batch_output/
├── batch_image1/
│   ├── cleaned/
│   ├── translations/
│   └── final/
├── batch_image2/
│   ├── cleaned/
│   ├── translations/
│   └── final/
└── ...
```

## Étape 5 — Réinsertion du texte traduit dans les bulles

Après avoir détecté, nettoyé et traduit les bulles de texte dans les pages de manga, l’objectif final est de **réinsérer automatiquement le texte traduit dans l’image nettoyée**, à l’endroit exact où se trouvait le texte original.

Cette étape transforme réellement le pipeline : on ne se contente plus d’un fichier `.txt`, mais on recrée une **image complète, lisible et localisée**.

---

🎯 **Objectif**

- Reconstituer visuellement une version "localisée" des pages manga
- Préserver les bulles, le fond, et l'esthétique générale
- Réutiliser les coordonnées des bulles extraites lors de la détection

---

🧪 **Démarche mise en place (script `reinsert_translations.py`)**

1.  **Chargement des données**
   - Image nettoyée (générée à l’étape 3)
   - Fichier `.json` contenant les traductions + coordonnées de chaque bulle

2.  **Utilisation des coordonnées de la bulle**
   - Chaque bulle possède des coordonnées (`x_min`, `y_min`, `x_max`, `y_max`)
   - Ces données sont utilisées pour **positionner** le texte correctement dans la zone correspondante

3.  **Réinsertion du texte avec centrage automatique**
   - Le script mesure la largeur/hauteur disponibles
   - Il ajuste dynamiquement la **taille de la police** pour que le texte tienne dans la bulle
   - Le texte est centré automatiquement dans l’espace prévu

4.  **Typographie adaptable**
   - Par défaut, une police classique (`arial.ttf`) est utilisée
   - Si indisponible, le script bascule sur la police système par défaut
   - À terme, on pourrait ajuster la police selon le type de bulle

5.  **Export automatique**
   - L’image finale est sauvegardée sous un nouveau nom (`image_clean_translated.png`)
   - L’ensemble du processus est automatisé

![image6](https://github.com/user-attachments/assets/a10993b6-b648-46a8-8412-634be79606f5)


### Cloner le dépôt

```bash
# Clonez le repo
git clone https://github.com/mHaashS/Manga-Bubble-Cleaner.git

# Placez-vous dans le dossier
cd Manga-Bubble-Cleaner

python -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Install models
mkdir -p models
curl -L https://github.com/mHaashS/Manga-Bubble-Cleaner/releases/latest/download/model_final.pth \
     -o models/model_final.pth

# Clean Bubbles
python scripts/clean_bubbles.py path/to/image.png

# Translate Bubbles
python scripts/translate_bubble.py path/to/image.png

# Reinsert Translation
python scripts/reinsert_translation.py path/to/image_cleaned.png path/to/.translation.json
```

### Technologies utilisées
- Outil / Librairie	Rôle
- Python 3.10:	 Langage principal du projet
- Detectron2: 	Détection des bulles avec Mask R-CNN (https://github.com/matterport/Mask_RCNN)
- EasyOCR:	Extraction de texte dans les bulles
- OpenCV: 	Traitement d’images, masquage et nettoyage
- Pillow (PIL):	Réinsertion du texte dans l’image
- OpenAI API:	Traduction automatique via GPT-3.5
- CVAT:	Annotation des données au format COCO
- json / txt export:	Format de sauvegarde des résultats

## ️ **Structure des dossiers adaptée**

### **1. Nettoyer seulement (`clean_only=True`) :**
- ✅ **Un seul dossier** : Les images nettoyées vont directement dans le dossier de sortie principal
- ✅ **Structure** : `output/cleaned_image.jpg`
- ✅ **Pas de sous-dossiers** inutiles

### **2. Traduire seulement (`translate_only=True`) :**
- ✅ **Dossier translations** : Pour les fichiers .txt et .json
- ✅ **Structure** : `output/translations/image.txt` et `output/translations/image.json`

### **3. Pipeline complet (ni `clean_only` ni `translate_only`) :**
- ✅ **Tous les dossiers** : `cleaned/`, `translations/`, `final/`
- ✅ **Structure complète** : Comme avant

### **4. Logs informatifs :**
- ✅ **Message clair** : Indique quel(s) dossier(s) a/ont été créé(s)
- ✅ **Feedback utilisateur** : Vous savez exactement où sont vos fichiers

### **5. Exemples d'utilisation :**

**Nettoyer seulement :**
```bash
python scripts/main_pipeline.py image.jpg --clean-only
# Résultat : output/cleaned_image.jpg
```

**Traduire seulement :**
```bash
python scripts/main_pipeline.py image.jpg --translate-only
# Résultat : output/translations/image.txt et output/translations/image.json
```

**Pipeline complet :**
```bash
python scripts/main_pipeline.py image.jpg
# Résultat : output/cleaned/, output/translations/, output/final/
```

Maintenant, quand vous cliquez sur " Nettoyer Seulement" dans l'interface GUI, vous n'aurez qu'un seul dossier de sortie avec vos images nettoyées, exactement comme vous le souhaitiez !
