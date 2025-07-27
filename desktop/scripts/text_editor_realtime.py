#!/usr/bin/env python3
"""
Éditeur de texte en temps réel pour Bubble Cleaner
Supporte le mode image unique et multi-images
"""

import os
import sys
import json
import logging
import cv2
import numpy as np
from pathlib import Path
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QLabel, QTextEdit, QPushButton, 
                             QFrame, QSplitter, QMessageBox, QGroupBox, QSpinBox)
from PyQt5.QtCore import Qt, QTimer
from PyQt5.QtGui import QPixmap, QImage, QPainter, QPen, QColor, QFont

logger = logging.getLogger(__name__)

class RealtimeTextEditor(QMainWindow):
    def __init__(self, image_path=None, json_path=None, output_path=None, folder_path=None, output_dir=None):
        super().__init__()
        
        # Mode multi-images ou image unique
        self.multi_image_mode = folder_path is not None
        
        if self.multi_image_mode:
            # Mode multi-images
            self.folder_path = Path(folder_path)
            self.output_dir = Path(output_dir)
            self.image_files = self.get_image_files()
            self.current_image_index = 0
            
            # Chemins actuels
            self.current_image_path = None
            self.current_json_path = None
            self.current_output_path = None
        else:
            # Mode image unique
            self.image_path = image_path
            self.json_path = json_path
            self.output_path = output_path
        
        # Initialiser les variables
        self.current_bubble_index = 0
        self.current_font_size = 16
        self.last_preview_hash = None
        self.font_cache = {}
        
        # Configurer l'interface utilisateur
        self.setup_ui()
        
        # Charger les données après avoir configuré l'interface
        if self.multi_image_mode:
            # Mode multi-images
            self.get_image_files()
            if self.image_files:
                self.load_current_image()
        else:
            # Mode image unique
            self.load_image()
            self.load_translations()
            if self.translations_data:
                self.update_display()
        
        # Configurer le timer pour les mises à jour en temps réel
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self.update_preview)
        self.update_timer.start(1000)  # Mise à jour toutes les secondes
    
    def get_image_files(self):
        """Récupère la liste des fichiers d'images dans le dossier (mode multi-images)"""
        if not self.multi_image_mode:
            return []
        
        image_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif'}
        image_files = []
        
        for file_path in self.folder_path.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in image_extensions:
                image_files.append(file_path)
        
        # Trier par nom de fichier
        image_files.sort(key=lambda x: x.name)
        return image_files
    
    def load_current_image(self):
        """Charge l'image actuelle (mode multi-images)"""
        if not self.multi_image_mode or not self.image_files:
            return
        
        try:
            # Mettre à jour les chemins
            image_file = self.image_files[self.current_image_index]
            base_name = image_file.stem
            
            self.current_image_path = image_file
            self.current_json_path = self.output_dir / "translations" / f"{base_name}.json"
            self.current_output_path = self.output_dir / "final" / f"{base_name}_translated.png"
            
            # Charger l'image
            self.load_image()
            
            # Charger les traductions
            self.load_translations()
            
            # Réinitialiser l'index de bulle
            self.current_bubble_index = 0
            
            # Mettre à jour l'affichage
            self.update_display()
            
            logger.info(f"✅ Image chargée: {self.current_image_path}")
            
        except Exception as e:
            logger.error(f"ERREUR: Erreur lors du chargement de l'image: {e}")
            raise
    
    def load_translations(self):
        """Charge les données de traduction depuis le fichier JSON"""
        try:
            json_path = self.current_json_path if self.multi_image_mode else self.json_path
            
            # Convertir en Path si c'est une chaîne
            if isinstance(json_path, str):
                json_path = Path(json_path)
            
            if not json_path.exists():
                self.translations_data = []
                logger.warning(f"⚠️ Fichier de traductions non trouvé: {json_path}")
                return
            
            with open(json_path, 'r', encoding='utf-8') as f:
                self.translations_data = json.load(f)
            logger.info(f"✅ {len(self.translations_data)} bulles chargées")
        except Exception as e:
            logger.error(f"ERREUR: Erreur lors du chargement des traductions: {e}")
            self.translations_data = []
    
    def load_image(self):
        """Charge l'image nettoyée"""
        try:
            if self.multi_image_mode:
                # Mode multi-images : chercher l'image nettoyée
                base_name = self.current_image_path.stem
                image_name = self.current_image_path.name
                
                # Essayer plusieurs stratégies pour trouver l'image nettoyée
                search_strategies = [
                    # Stratégie 1: Chercher dans le dossier de sortie configuré
                    lambda: self.output_dir,
                    # Stratégie 2: Chercher dans le dossier parent de l'image originale
                    lambda: self.current_image_path.parent.parent / "images_cleaned" if "Pictures" in str(self.current_image_path) else None,
                    # Stratégie 3: Chercher dans le dossier de l'image originale
                    lambda: self.current_image_path.parent,
                    # Stratégie 4: Chercher dans le dossier de travail actuel
                    lambda: Path.cwd() / "output",
                    # Stratégie 5: Chercher dans le dossier parent du dossier de sortie
                    lambda: self.output_dir.parent if self.output_dir.parent.exists() else None,
                    # Stratégie 6: Chercher dans le dossier de sortie avec "cleaned" comme sous-dossier
                    lambda: self.output_dir / "cleaned" if (self.output_dir / "cleaned").exists() else None
                ]
                
                cleaned_image_path = None
                for strategy in search_strategies:
                    search_dir = strategy()
                    if search_dir and search_dir.exists():
                        logger.info(f"🔍 Recherche de l'image nettoyée dans: {search_dir}")
                        
                        # Essayer plusieurs chemins possibles avec différentes extensions
                        possible_paths = [
                            # Chemins directs dans le dossier de sortie
                            search_dir / f"cleaned_{base_name}.png",
                            search_dir / f"cleaned_{base_name}.jpg",
                            search_dir / f"cleaned_{base_name}.jpeg",
                            # Chemins dans le sous-dossier cleaned
                            search_dir / "cleaned" / f"cleaned_{base_name}.png",
                            search_dir / "cleaned" / f"cleaned_{base_name}.jpg",
                            search_dir / "cleaned" / f"cleaned_{base_name}.jpeg",
                            # Essayer aussi avec le nom complet du fichier original
                            search_dir / f"cleaned_{image_name}",
                            search_dir / "cleaned" / f"cleaned_{image_name}",
                            # Essayer avec différentes variations du nom
                            search_dir / f"cleaned_{base_name}_cleaned.png",
                            search_dir / f"cleaned_{base_name}_cleaned.jpg",
                            search_dir / "cleaned" / f"cleaned_{base_name}_cleaned.png",
                            search_dir / "cleaned" / f"cleaned_{base_name}_cleaned.jpg",
                            # Essayer avec le nom exact du fichier original (sans extension)
                            search_dir / f"cleaned_{os.path.splitext(image_name)[0]}.png",
                            search_dir / f"cleaned_{os.path.splitext(image_name)[0]}.jpg",
                            search_dir / "cleaned" / f"cleaned_{os.path.splitext(image_name)[0]}.png",
                            search_dir / "cleaned" / f"cleaned_{os.path.splitext(image_name)[0]}.jpg"
                        ]
                        
                        for path in possible_paths:
                            if path.exists():
                                cleaned_image_path = path
                                logger.info(f"✅ Image nettoyée trouvée: {path}")
                                break
                            else:
                                logger.debug(f"❌ Non trouvé: {path}")
                        
                        if cleaned_image_path:
                            break
                
                if cleaned_image_path:
                    self.original_image = cv2.imread(str(cleaned_image_path))
                    logger.info(f"✅ Image nettoyée chargée: {cleaned_image_path}")
                else:
                    # Utiliser l'image originale
                    self.original_image = cv2.imread(str(self.current_image_path))
                    logger.warning(f"⚠️ Image nettoyée non trouvée pour: {self.current_image_path}")
                    logger.warning(f"⚠️ Utilisation de l'image originale. Assurez-vous d'avoir exécuté le pipeline de traitement.")
                    logger.info(f"✅ Image originale chargée: {self.current_image_path}")
            else:
                # Mode image unique
                # L'interface GUI passe déjà le bon chemin de l'image nettoyée
                # Vérifier si le fichier existe
                if os.path.exists(self.image_path):
                    self.original_image = cv2.imread(self.image_path)
                    logger.info(f"✅ Image chargée: {self.image_path}")
                else:
                    # Fallback : essayer de trouver l'image nettoyée dans le dossier de sortie
                    output_dir = os.path.dirname(self.image_path)
                    if 'data' in output_dir:
                        # Remplacer le chemin data par le chemin de sortie
                        output_path = output_dir.replace('data', 'output')
                        
                        # Essayer plusieurs chemins possibles pour l'image nettoyée
                        possible_paths = [
                            os.path.join(output_path, f"cleaned_{os.path.basename(self.image_path)}"),
                            os.path.join(output_path, "cleaned", f"cleaned_{os.path.basename(self.image_path)}"),
                            os.path.join(output_path, "cleaned", os.path.basename(self.image_path).replace('.png', '_cleaned.png')),
                            # Chercher directement à la racine du dossier de sortie
                            os.path.join(output_path, f"cleaned_{os.path.basename(self.image_path).replace('.png', '')}.png"),
                            os.path.join(output_path, f"cleaned_{os.path.basename(self.image_path)}")
                        ]
                        
                        cleaned_image_path = None
                        for path in possible_paths:
                            if os.path.exists(path):
                                cleaned_image_path = path
                                break
                        
                        if cleaned_image_path:
                            self.original_image = cv2.imread(cleaned_image_path)
                            logger.info(f"✅ Image nettoyée chargée depuis sortie: {cleaned_image_path}")
                        else:
                            # Fallback vers l'image originale
                            original_path = self.image_path.replace('output', 'data').replace('cleaned_', '')
                            self.original_image = cv2.imread(original_path)
                            logger.info(f"✅ Image originale chargée: {original_path}")
                            logger.warning(f"⚠️ Image nettoyée non trouvée. Chemins testés: {possible_paths}")
                    else:
                        # Fallback vers l'image originale
                        self.original_image = cv2.imread(self.image_path)
                        logger.info(f"✅ Image originale chargée: {self.image_path}")
            
            if self.original_image is None:
                raise ValueError(f"Impossible de charger l'image: {self.image_path}")
            
            self.display_image = self.original_image.copy()
        except Exception as e:
            logger.error(f"ERREUR: Erreur lors du chargement de l'image: {e}")
            self.original_image = None
            self.display_image = None
    
    def cv2_to_qpixmap(self, cv_image):
        """Convertit une image OpenCV en QPixmap"""
        if cv_image is None:
            return None
        
        # Convertir BGR vers RGB
        rgb_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
        
        # Redimensionner si nécessaire (taille plus grande)
        height, width = rgb_image.shape[:2]
        max_width, max_height = 1000, 800
        
        if width > max_width or height > max_height:
            scale = min(max_width / width, max_height / height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            rgb_image = cv2.resize(rgb_image, (new_width, new_height))
        
        # Convertir vers QImage puis QPixmap
        height, width, channel = rgb_image.shape
        bytes_per_line = 3 * width
        q_image = QImage(rgb_image.data, width, height, bytes_per_line, QImage.Format_RGB888)
        return QPixmap.fromImage(q_image)
    
    def draw_text_on_image(self, image, bubble_data, text):
        """Dessine le texte sur l'image à la position de la bulle avec support des caractères accentués"""
        if image is None or bubble_data is None:
            return image
        
        try:
            from PIL import Image, ImageDraw, ImageFont
            import numpy as np
            
            x_min = int(bubble_data.get('x_min', 0))
            y_min = int(bubble_data.get('y_min', 0))
            x_max = int(bubble_data.get('x_max', 0))
            y_max = int(bubble_data.get('y_max', 0))
            
            # Convertir l'image OpenCV en PIL (optimisé)
            temp_image = image.copy()
            temp_image_rgb = cv2.cvtColor(temp_image, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(temp_image_rgb)
            draw = ImageDraw.Draw(pil_image)
            
            text_width = x_max - x_min
            text_height = y_max - y_min
            # Augmenter les marges pour un meilleur espacement
            margin_x = int(text_width * 0.15)  # 15% au lieu de 10%
            margin_y = int(text_height * 0.15)  # 15% au lieu de 10%
            available_width = text_width - 2 * margin_x
            available_height = text_height - 2 * margin_y
            
            if available_width <= 0 or available_height <= 0:
                return temp_image
            
            # Taille de police personnalisée si présente
            font_size = bubble_data.get('font_size', 16)
            font_size = max(8, min(72, font_size))
            
            # Utiliser le cache pour éviter de recharger la police à chaque fois
            font_key = f"animeace2_{font_size}"
            if font_key not in self.font_cache:
                try:
                    # Essayer plusieurs polices système (Anime Ace en priorité)
                    font_paths = [
                        "fonts/animeace2_bld.ttf",  # Anime Ace Bold
                        "fonts/animeace2_reg.ttf",  # Anime Ace Regular
                        "fonts/animeace2_ital.ttf", # Anime Ace Italic
                        "fonts/animeace.ttf",
                        "fonts/AnimeAce.ttf",
                        "fonts/anime_ace.ttf",
                        "fonts/ANIMEACE.TTF",
                        "animeace.ttf",
                        "C:/Windows/Fonts/animeace.ttf",
                        # Polices alternatives pour mangas
                        "C:/Windows/Fonts/comic.ttf",
                        "C:/Windows/Fonts/comicbd.ttf",
                        "C:/Windows/Fonts/arial.ttf",
                        "C:/Windows/Fonts/calibri.ttf",
                        "C:/Windows/Fonts/verdana.ttf"
                    ]
                    
                    font = None
                    for font_path in font_paths:
                        try:
                            font = ImageFont.truetype(font_path, font_size)
                            # Log seulement lors du premier chargement
                            if len(self.font_cache) < 10:  # Log seulement les 10 premières polices
                                logger.info(f"✅ Police chargée: {font_path} (taille {font_size})")
                            break
                        except:
                            continue
                    
                    if font is None:
                        # Essayer de trouver Anime Ace dans le dossier fonts
                        try:
                            import os
                            
                            # Chercher dans le dossier fonts
                            font_paths_anime = [
                                "fonts/animeace.ttf",
                                "fonts/AnimeAce.ttf",
                                "fonts/anime_ace.ttf",
                                "fonts/ANIMEACE.TTF"
                            ]
                            
                            for anime_path in font_paths_anime:
                                if os.path.exists(anime_path):
                                    font = ImageFont.truetype(anime_path, font_size)
                                    logger.info(f"✅ Police Anime Ace chargée: {anime_path} (taille {font_size})")
                                    break
                            
                            if font is None:
                                # Essayer d'utiliser Comic Sans MS (plus appropriée pour les mangas)
                                try:
                                    # Utiliser Comic Sans MS comme fallback
                                    font = ImageFont.truetype("C:/Windows/Fonts/comic.ttf", font_size)
                                    logger.info(f"✅ Police Comic Sans MS utilisée (taille {font_size})")
                                except:
                                    try:
                                        # Utiliser Arial comme fallback
                                        font = ImageFont.truetype("arial.ttf", font_size)
                                        logger.warning("⚠️ Police Anime Ace non trouvée, utilisation d'Arial")
                                        logger.info("💡 Pour utiliser Anime Ace, téléchargez animeace.ttf et placez-le dans le dossier 'fonts/'")
                                    except:
                                        # Utiliser la police par défaut
                                        font = ImageFont.load_default()
                                        logger.warning("⚠️ Police par défaut utilisée")
                                
                        except Exception as e:
                            logger.warning(f"⚠️ Erreur lors du chargement d'Anime Ace: {e}")
                            # Utiliser la police par défaut
                            font = ImageFont.load_default()
                            logger.warning("⚠️ Utilisation de la police par défaut")
                    
                    # Mettre en cache
                    self.font_cache[font_key] = font
                    
                except Exception as e:
                    logger.error(f"❌ Erreur lors du chargement de la police: {e}")
                    font = ImageFont.load_default()
                    self.font_cache[font_key] = font
            else:
                font = self.font_cache[font_key]
            
            def split_text_to_lines(text, max_width):
                words = text.split()
                lines = []
                current_line = ""
                
                for word in words:
                    test_line = current_line + " " + word if current_line else word
                    # Estimer la largeur avec PIL
                    bbox = draw.textbbox((0, 0), test_line, font=font)
                    estimated_width = bbox[2] - bbox[0]
                    
                    if estimated_width <= max_width:
                        current_line = test_line
                    else:
                        if current_line:
                            lines.append(current_line)
                        current_line = word
                
                if current_line:
                    lines.append(current_line)
                
                if not lines:
                    lines = [text]
                
                return lines
            
            translated_lines = split_text_to_lines(text, available_width)
            
            # Calculer la hauteur totale du texte avec espacement
            line_spacing = int(font_size * 0.2)  # Espacement entre les lignes
            total_height = 0
            line_heights = []
            for line in translated_lines:
                bbox = draw.textbbox((0, 0), line, font=font)
                line_height = bbox[3] - bbox[1]
                line_heights.append(line_height)
                total_height += line_height
            
            # Ajouter l'espacement entre les lignes
            if len(translated_lines) > 1:
                total_height += line_spacing * (len(translated_lines) - 1)
            
            # Centrer verticalement
            start_y = y_min + margin_y + (available_height - total_height) // 2
            current_y = start_y
            
            for i, line in enumerate(translated_lines):
                # Calculer la position centrée horizontalement
                bbox = draw.textbbox((0, 0), line, font=font)
                line_width = bbox[2] - bbox[0]
                x_pos = x_min + margin_x + (available_width - line_width) // 2
                
                # Dessiner le texte en noir simple
                text_color = (0, 0, 0)
                draw.text((x_pos, current_y), line, font=font, fill=text_color)
                
                current_y += line_heights[i]
                if i < len(translated_lines) - 1:
                    current_y += line_spacing
            
            # Convertir PIL vers OpenCV
            result_array = np.array(pil_image)
            result_bgr = cv2.cvtColor(result_array, cv2.COLOR_RGB2BGR)
            
            return result_bgr
            
        except Exception as e:
            logger.error(f"❌ Erreur lors du dessin du texte: {e}")
            return image
    
    def update_preview(self):
        """Met à jour la prévisualisation de l'image"""
        try:
            # Vérifier que l'interface est initialisée
            if not hasattr(self, 'text_editor') or not self.is_widget_valid(self.text_editor):
                return
                
            # Vérifier que l'image label existe
            if not hasattr(self, 'image_label') or not self.is_widget_valid(self.image_label):
                return
                
            # Vérifier que les données existent
            if not self.translations_data or self.current_bubble_index >= len(self.translations_data):
                return
            
            # Calculer un hash des données actuelles pour éviter les redessins inutiles
            current_data = {
                'translations': self.translations_data,
                'current_bubble': self.current_bubble_index
            }
            current_hash = hash(str(current_data))
            
            # Si rien n'a changé, ne pas redessiner
            if self.last_preview_hash == current_hash:
                return
            
            self.last_preview_hash = current_hash
            
            # Créer une copie de l'image originale
            preview_image = self.original_image.copy()
            
            # Dessiner tous les textes sur l'image
            for i, bubble_data in enumerate(self.translations_data):
                translated_text = bubble_data.get('translated_text', '')
                if translated_text:
                    # Mettre en surbrillance la bulle actuelle
                    if i == self.current_bubble_index:
                        # Dessiner un rectangle bleu épais autour de la bulle actuelle
                        x_min, y_min = bubble_data.get('x_min', 0), bubble_data.get('y_min', 0)
                        x_max, y_max = bubble_data.get('x_max', 0), bubble_data.get('y_max', 0)
                        cv2.rectangle(preview_image, (x_min, y_min), (x_max, y_max), (255, 0, 0), 4)
                        # Ajouter un numéro de bulle
                        cv2.putText(preview_image, f"B{i+1}", (x_min+5, y_min+20), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
                        # Ajouter une zone de clic étendue (pour debug) - plus grande
                        cv2.rectangle(preview_image, (x_min-15, y_min-15), (x_max+15, y_max+15), (0, 255, 0), 1)
                    else:
                        # Dessiner un rectangle gris fin pour les autres bulles
                        x_min, y_min = bubble_data.get('x_min', 0), bubble_data.get('y_min', 0)
                        x_max, y_max = bubble_data.get('x_max', 0), bubble_data.get('y_max', 0)
                        cv2.rectangle(preview_image, (x_min, y_min), (x_max, y_max), (128, 128, 128), 1)
                        # Ajouter un numéro de bulle
                        cv2.putText(preview_image, f"B{i+1}", (x_min+5, y_min+20), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (128, 128, 128), 1)
                        # Ajouter une zone de clic étendue (pour debug) - plus grande
                        cv2.rectangle(preview_image, (x_min-15, y_min-15), (x_max+15, y_max+15), (0, 128, 0), 1)
                    
                    preview_image = self.draw_text_on_image(preview_image, bubble_data, translated_text)
            
            # Convertir en QPixmap et afficher
            pixmap = self.cv2_to_qpixmap(preview_image)
            if pixmap and hasattr(self, 'image_label') and self.is_widget_valid(self.image_label):
                self.image_label.setPixmap(pixmap)
            
        except Exception as e:
            logger.error(f"ERREUR: Erreur lors de la mise à jour de la prévisualisation: {e}")
    
    def setup_ui(self):
        """Configure l'interface utilisateur"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Layout principal
        main_layout = QVBoxLayout(central_widget)
        
        # Barre de navigation des images (mode multi-images seulement)
        if self.multi_image_mode:
            nav_image_group = QGroupBox("🖼️ Navigation des images")
            nav_image_layout = QHBoxLayout(nav_image_group)
            
            self.prev_image_button = QPushButton("◀ Image précédente")
            self.prev_image_button.clicked.connect(self.prev_image)
            nav_image_layout.addWidget(self.prev_image_button)
            
            self.image_info_label = QLabel("Image 0/0")
            self.image_info_label.setAlignment(Qt.AlignCenter)
            self.image_info_label.setStyleSheet("font-weight: bold; padding: 5px;")
            nav_image_layout.addWidget(self.image_info_label)
            
            self.next_image_button = QPushButton("Image suivante ▶")
            self.next_image_button.clicked.connect(self.next_image)
            nav_image_layout.addWidget(self.next_image_button)
            
            main_layout.addWidget(nav_image_group)
        
        # Layout horizontal pour l'image et les contrôles
        content_layout = QHBoxLayout()
        main_layout.addLayout(content_layout)
        
        # Splitter pour redimensionner les sections
        splitter = QSplitter(Qt.Horizontal)
        content_layout.addWidget(splitter)
        
        # Section gauche (image)
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        
        # Label pour l'image (titre réduit et zone agrandie)
        image_title = QLabel("🖼️ Prévisualisation (Cliquez sur une bulle pour la sélectionner)")
        image_title.setAlignment(Qt.AlignCenter)
        image_title.setStyleSheet("font-size: 12px; font-weight: bold; margin: 2px; color: #666;")
        left_layout.addWidget(image_title)
        
        # Label pour l'image (zone agrandie)
        self.image_label = QLabel()
        self.image_label.setAlignment(Qt.AlignCenter)
        self.image_label.setMinimumSize(900, 700)
        self.image_label.setStyleSheet("border: 2px solid #ccc; background-color: #f0f0f0;")
        self.image_label.setCursor(Qt.PointingHandCursor)  # Curseur de main pour indiquer que c'est cliquable
        self.image_label.mousePressEvent = self.on_image_click  # Gestionnaire de clic
        left_layout.addWidget(self.image_label)
        
        splitter.addWidget(left_widget)
        
        # Section droite (contrôles)
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)
        
        # Groupe de navigation des bulles
        nav_group = QGroupBox("🔍 Navigation des bulles")
        nav_layout = QHBoxLayout(nav_group)
        
        self.prev_button = QPushButton("◀ Précédente")
        self.prev_button.clicked.connect(self.prev_bubble)
        nav_layout.addWidget(self.prev_button)
        
        self.next_button = QPushButton("Suivante ▶")
        self.next_button.clicked.connect(self.next_bubble)
        nav_layout.addWidget(self.next_button)
        
        right_layout.addWidget(nav_group)
        
        # Groupe d'édition
        edit_group = QGroupBox("✏️ Édition du texte")
        edit_layout = QVBoxLayout(edit_group)
        
        # Informations sur la bulle
        info_layout = QHBoxLayout()
        self.bubble_info_label = QLabel("Bulle 0/0")
        self.bubble_info_label.setStyleSheet("font-size: 12px; padding: 5px;")
        info_layout.addWidget(self.bubble_info_label)
        
        edit_layout.addLayout(info_layout)
        
        # Texte original
        edit_layout.addWidget(QLabel("Texte original:"))
        self.original_text_label = QLabel("")
        self.original_text_label.setStyleSheet("background-color: #f0f0f0; padding: 5px; border: 1px solid #ccc;")
        self.original_text_label.setWordWrap(True)
        edit_layout.addWidget(self.original_text_label)
        
        # Éditeur de texte
        edit_layout.addWidget(QLabel("Texte traduit:"))
        self.text_editor = QTextEdit()
        self.text_editor.setMaximumHeight(100)
        edit_layout.addWidget(self.text_editor)
        
        # Contrôle de la taille de police (juste en dessous du texte traduit)
        font_layout = QHBoxLayout()
        font_layout.addWidget(QLabel("Taille police:"))
        self.font_size_spinbox = QSpinBox()
        self.font_size_spinbox.setRange(8, 72)
        self.font_size_spinbox.setValue(self.current_font_size)
        self.font_size_spinbox.valueChanged.connect(self.on_font_size_changed)
        font_layout.addWidget(self.font_size_spinbox)
        edit_layout.addLayout(font_layout)
        
        right_layout.addWidget(edit_group)
        
        # Boutons d'action
        action_layout = QVBoxLayout()
        
        # Bouton de sauvegarde
        self.save_button = QPushButton("💾 Sauvegarder")
        self.save_button.clicked.connect(self.save_changes)
        action_layout.addWidget(self.save_button)
        
        # Bouton pour générer l'image finale (supprimé - sauvegarder fait déjà le travail)
        # self.generate_button = QPushButton("🎯 Générer finale")
        # self.generate_button.clicked.connect(self.generate_final_image)
        # action_layout.addWidget(self.generate_button)
        
        # Bouton de fermeture
        self.close_button = QPushButton("❌ Fermer")
        self.close_button.clicked.connect(self.close_editor)
        action_layout.addWidget(self.close_button)
        
        right_layout.addLayout(action_layout)
        
        # Ajouter de l'espace flexible
        right_layout.addStretch()
        
        splitter.addWidget(right_widget)
        
        # Répartir l'espace (70% image, 30% contrôles)
        splitter.setSizes([980, 420])
    
    def on_image_click(self, event):
        """Gère les clics sur l'image pour sélectionner une bulle"""
        try:
            if not self.translations_data or self.original_image is None:
                return
            
            # Obtenir les coordonnées du clic
            click_x = event.x()
            click_y = event.y()
            
            # Obtenir la taille du widget d'image
            widget_size = self.image_label.size()
            if widget_size.width() == 0 or widget_size.height() == 0:
                return
            
            # Obtenir les dimensions de l'image originale
            if hasattr(self.original_image, 'shape'):
                image_height, image_width = self.original_image.shape[:2]
            else:
                return
            
            # Calculer les dimensions de l'image redimensionnée (comme dans cv2_to_qpixmap)
            max_width, max_height = 1000, 800
            
            if image_width > max_width or image_height > max_height:
                scale = min(max_width / image_width, max_height / image_height)
                display_width = int(image_width * scale)
                display_height = int(image_height * scale)
            else:
                display_width = image_width
                display_height = image_height
                scale = 1.0
            
            # Calculer les marges pour centrer l'image dans le widget
            margin_x = (widget_size.width() - display_width) // 2
            margin_y = (widget_size.height() - display_height) // 2
            
            # Ajuster les coordonnées du clic en tenant compte des marges
            adjusted_x = click_x - margin_x
            adjusted_y = click_y - margin_y
            
            # Convertir les coordonnées ajustées vers les coordonnées de l'image originale
            if adjusted_x >= 0 and adjusted_x < display_width and adjusted_y >= 0 and adjusted_y < display_height:
                image_x = int(adjusted_x / scale)
                image_y = int(adjusted_y / scale)
            else:
                # Le clic est en dehors de l'image
                return
            
            # Debug: afficher les coordonnées
            logger.info(f"DEBUG: Clic à ({click_x}, {click_y}) -> Ajusté ({adjusted_x}, {adjusted_y}) -> Image ({image_x}, {image_y})")
            logger.info(f"DEBUG: Widget: {widget_size.width()}x{widget_size.height()}, Display: {display_width}x{display_height}, Image: {image_width}x{image_height}, Scale: {scale:.2f}")
            logger.info(f"DEBUG: Marges: ({margin_x}, {margin_y})")
            
            # Chercher la bulle la plus proche du point de clic
            closest_bubble = None
            min_distance = float('inf')
            
            for i, bubble_data in enumerate(self.translations_data):
                x_min = int(bubble_data.get('x_min', 0))
                y_min = int(bubble_data.get('y_min', 0))
                x_max = int(bubble_data.get('x_max', 0))
                y_max = int(bubble_data.get('y_max', 0))
                
                # Calculer le centre de la bulle
                center_x = (x_min + x_max) // 2
                center_y = (y_min + y_max) // 2
                
                # Calculer la distance au centre de la bulle
                distance = ((image_x - center_x) ** 2 + (image_y - center_y) ** 2) ** 0.5
                
                # Debug: afficher les coordonnées de la bulle
                logger.info(f"DEBUG: Bulle {i+1}: ({x_min}, {y_min}) -> ({x_max}, {y_max}), Centre: ({center_x}, {center_y}), Distance: {distance:.1f}")
                
                # Vérifier si le clic est dans la zone verte (bulle + marge de 15 pixels)
                green_margin = 15  # Marge augmentée de 5 à 15 pixels pour plus de précision
                green_x_min = x_min - green_margin
                green_y_min = y_min - green_margin
                green_x_max = x_max + green_margin
                green_y_max = y_max + green_margin
                
                if ((green_x_min <= image_x <= green_x_max) and (green_y_min <= image_y <= green_y_max)):
                    # Si le clic est dans la zone verte, la sélectionner immédiatement
                    self.current_bubble_index = i
                    self.update_display()
                    logger.info(f"✅ Bulle {i+1} sélectionnée par clic (dans la zone verte)")
                    return
                
                # Sinon, garder la bulle la plus proche
                if distance < min_distance:
                    min_distance = distance
                    closest_bubble = i
            
            # Si aucune bulle n'est directement cliquée, sélectionner la plus proche avec une tolérance très large
            if closest_bubble is not None and min_distance < 150:  # 150 pixels de tolérance (augmenté de 80 à 150)
                self.current_bubble_index = closest_bubble
                self.update_display()
                logger.info(f"✅ Bulle {closest_bubble+1} sélectionnée par clic (plus proche, distance: {min_distance:.1f})")
                return
            
            logger.info("ℹ️ Aucune bulle trouvée à cette position")
            
        except Exception as e:
            logger.error(f"ERREUR: Erreur lors du clic sur l'image: {e}")

    def is_widget_valid(self, widget):
        """Vérifie si un widget PyQt5 est toujours valide"""
        try:
            if widget is None:
                return False
            # Essayer d'accéder à une propriété pour vérifier si l'objet existe encore
            widget.objectName()
            return True
        except RuntimeError:
            return False
        except Exception:
            return False

    def update_display(self):
        """Met à jour l'affichage avec la bulle actuelle"""
        try:
            # Vérifier que l'interface est initialisée
            if not hasattr(self, 'bubble_info_label') or not self.is_widget_valid(self.bubble_info_label):
                return
                
            if not self.translations_data:
                return
            
            if 0 <= self.current_bubble_index < len(self.translations_data):
                bubble = self.translations_data[self.current_bubble_index]
                
                # Mettre à jour les informations
                if self.is_widget_valid(self.bubble_info_label):
                    self.bubble_info_label.setText(
                        f"Bulle {self.current_bubble_index + 1}/{len(self.translations_data)}\n"
                        f"Confiance: {bubble.get('confidence', 0):.2f}\n"
                        f"Position: ({bubble.get('x_min', 0)}, {bubble.get('y_min', 0)}) -> "
                        f"({bubble.get('x_max', 0)}, {bubble.get('y_max', 0)})"
                    )
                
                # Mettre à jour le texte original
                original_text = bubble.get('ocr_text', '')
                if hasattr(self, 'original_text_label') and self.is_widget_valid(self.original_text_label):
                    self.original_text_label.setText(original_text)
                
                # Mettre à jour le texte traduit
                if hasattr(self, 'text_editor') and self.is_widget_valid(self.text_editor):
                    self.text_editor.setPlainText(bubble.get('translated_text', ''))
                
                # Mettre à jour la prévisualisation
                self.update_preview()
                
                # Mettre à jour la taille de police
                font_size = bubble.get('font_size', 16)
                if hasattr(self, 'font_size_spinbox') and self.is_widget_valid(self.font_size_spinbox):
                    self.font_size_spinbox.setValue(font_size)
                    self.current_font_size = font_size
            
            # Mettre à jour l'info d'image (mode multi-images)
            if self.multi_image_mode and hasattr(self, 'image_info_label') and self.is_widget_valid(self.image_info_label):
                if self.image_files:
                    image_file = self.image_files[self.current_image_index]
                    self.image_info_label.setText(f"Image {self.current_image_index + 1}/{len(self.image_files)}: {image_file.name}")
                    
        except Exception as e:
            logger.error(f"ERREUR: Erreur lors de la mise à jour de l'affichage: {e}")
    
    def prev_bubble(self):
        """Passe à la bulle précédente"""
        if self.current_bubble_index > 0:
            self.current_bubble_index -= 1
            self.update_display()
    
    def next_bubble(self):
        """Passe à la bulle suivante"""
        if self.current_bubble_index < len(self.translations_data) - 1:
            self.current_bubble_index += 1
            self.update_display()
    
    def prev_image(self):
        """Passe à l'image précédente (mode multi-images)"""
        if self.multi_image_mode and self.current_image_index > 0:
            self.current_image_index -= 1
            self.load_current_image()
    
    def next_image(self):
        """Passe à l'image suivante (mode multi-images)"""
        if self.multi_image_mode and self.current_image_index < len(self.image_files) - 1:
            self.current_image_index += 1
            self.load_current_image()
    
    def save_changes(self):
        """Sauvegarde les modifications dans le fichier JSON et génère l'image finale"""
        if not self.translations_data or self.current_bubble_index >= len(self.translations_data):
            return
        
        # Récupérer le nouveau texte
        new_text = self.text_editor.toPlainText()
        
        # Mettre à jour les données
        self.translations_data[self.current_bubble_index]['translated_text'] = new_text
        
        # Déterminer le chemin JSON à utiliser
        json_path = self.current_json_path if self.multi_image_mode else self.json_path
        
        # Convertir en Path si c'est une chaîne
        if isinstance(json_path, str):
            json_path = Path(json_path)
        
        # Sauvegarder dans le fichier JSON
        try:
            # Créer le dossier si nécessaire
            json_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(self.translations_data, f, ensure_ascii=False, indent=2)
            
            logger.info(f"✅ Modifications sauvegardées pour la bulle {self.current_bubble_index + 1}")
            
            # Générer automatiquement l'image finale
            self.generate_final_image_auto()
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de la sauvegarde: {e}")
            QMessageBox.critical(self, "Erreur", f"Erreur lors de la sauvegarde: {e}")
    
    def generate_final_image_auto(self):
        """Génère automatiquement l'image finale avec toutes les modifications (sans message)"""
        try:
            # Utiliser la même logique que l'éditeur pour générer l'image finale
            final_image = self.original_image.copy()
            
            # Dessiner tous les textes sur l'image
            for bubble_data in self.translations_data:
                translated_text = bubble_data.get('translated_text', '')
                if translated_text:
                    final_image = self.draw_text_on_image(final_image, bubble_data, translated_text)
            
            
            # Déterminer le chemin de sortie à utiliser
            output_path = self.current_output_path if self.multi_image_mode else self.output_path
            
            # Convertir en Path si c'est une chaîne
            if isinstance(output_path, str):
                output_path = Path(output_path)
            
            # Créer le dossier si nécessaire
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Sauvegarder l'image finale (écrase l'image existante)
            cv2.imwrite(str(output_path), final_image)
            
            logger.info(f"✅ Image finale mise à jour: {output_path}")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de la génération automatique: {e}")
    
    def generate_final_image(self):
        """Génère l'image finale avec toutes les modifications (méthode manuelle)"""
        self.save_changes()
        
        try:
            # Utiliser la même logique que l'éditeur pour générer l'image finale
            final_image = self.original_image.copy()
            
            # Dessiner tous les textes sur l'image
            for bubble_data in self.translations_data:
                translated_text = bubble_data.get('translated_text', '')
                if translated_text:
                    final_image = self.draw_text_on_image(final_image, bubble_data, translated_text)
            
            # Déterminer le chemin de sortie à utiliser
            output_path = self.current_output_path if self.multi_image_mode else self.output_path
            
            # Convertir en Path si c'est une chaîne
            if isinstance(output_path, str):
                output_path = Path(output_path)
            
            # Créer le dossier si nécessaire
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Sauvegarder l'image finale
            cv2.imwrite(str(output_path), final_image)
            
            QMessageBox.information(self, "Succès", f"Image finale générée:\n{output_path}")
            logger.info(f"✅ Image finale générée: {output_path}")
            
        except Exception as e:
            logger.error(f"❌ Erreur lors de la génération: {e}")
            QMessageBox.critical(self, "Erreur", f"Erreur lors de la génération: {e}")
    
    def on_font_size_changed(self, value):
        """Appelé quand la taille de police change - mise à jour en temps réel"""
        self.current_font_size = value
        
        # Mettre à jour la taille de police pour la bulle actuelle
        if self.translations_data and self.current_bubble_index < len(self.translations_data):
            self.translations_data[self.current_bubble_index]['font_size'] = self.current_font_size
            
            # Déterminer le chemin JSON à utiliser
            json_path = self.current_json_path if self.multi_image_mode else self.json_path
            
            # Convertir en Path si c'est une chaîne
            if isinstance(json_path, str):
                json_path = Path(json_path)
            
            # Sauvegarder automatiquement
            try:
                # Créer le dossier si nécessaire
                json_path.parent.mkdir(parents=True, exist_ok=True)
                
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(self.translations_data, f, ensure_ascii=False, indent=2)
                logger.info(f"✅ Taille de police mise à jour: {self.current_font_size}pt pour la bulle {self.current_bubble_index + 1}")
                
                # Générer automatiquement l'image finale
                self.generate_final_image_auto()
                
            except Exception as e:
                logger.error(f"❌ Erreur lors de la sauvegarde de la taille de police: {e}")
            
            # Mettre à jour la prévisualisation immédiatement
            self.update_preview()
    
    def close_editor(self):
        """Ferme l'éditeur proprement sans fermer l'application principale"""
        try:
            # Sauvegarder les modifications avant de fermer
            self.save_changes()
            logger.info("✅ Éditeur fermé proprement")
        except Exception as e:
            logger.error(f"❌ Erreur lors de la fermeture: {e}")
        
        # Fermer seulement cette fenêtre
        self.close()

def launch_realtime_text_editor(image_path, json_path, output_path):
    """Lance l'éditeur de texte en temps réel (mode image unique)"""
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)
    
    editor = RealtimeTextEditor(image_path=image_path, json_path=json_path, output_path=output_path)
    editor.show()
    
    # Ne pas utiliser sys.exit() pour éviter de fermer l'application principale
    return app.exec_()

def launch_multi_image_text_editor(folder_path, output_dir):
    """Lance l'éditeur de texte multi-images"""
    app = QApplication.instance()
    if app is None:
        app = QApplication(sys.argv)
    
    editor = RealtimeTextEditor(folder_path=folder_path, output_dir=output_dir)
    editor.show()
    
    # Ne pas utiliser sys.exit() pour éviter de fermer l'application principale
    return app.exec_()

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python text_editor_realtime.py image_path json_path output_path")
        sys.exit(1)
    
    image_path = sys.argv[1]
    json_path = sys.argv[2]
    output_path = sys.argv[3]
    
    launch_realtime_text_editor(image_path, json_path, output_path) 