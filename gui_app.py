# Patch de compatibilité pour Pillow >= 10.0 (DOIT être au tout début)
import pil_patch

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from tkinterdnd2 import DND_FILES, TkinterDnD
import threading
import os
import sys
from pathlib import Path
import json
import queue
import time
import logging
import io
import shutil
import tempfile
import cv2
import numpy as np

# Ajouter le répertoire scripts au path pour les imports
sys.path.append(str(Path(__file__).parent / "scripts"))

# Éditeur de bulles temporairement désactivé
EDITEUR_BULLES_AVAILABLE = False

class BubbleCleanerGUI:
    def __init__(self, root):
        print("🔧 Initialisation de BubbleCleanerGUI...")
        self.root = root
        self.root.title("🎨 Bubble Cleaner - Interface Graphique")
        self.root.geometry("800x820")
        self.root.resizable(True, True)
        
        print("🔧 Configuration de base...")
        # Configuration
        self.config_file = Path("config_gui.json")
        self.current_image = None
        self.current_folder = None
        self.output_dir = Path("output")
        self.verbose = False
        self.current_theme = "light"
        # self.edited_bulles = None  # Stockage des bulles modifiées par l'éditeur (désactivé)
        
        print("🔧 Définition des thèmes...")
        # Définition des thèmes
        self.themes = {
            "light": {
                "bg": "#f0f0f0",
                "fg": "#2c2c2c",
                "button_bg": "#e1e1e1",
                "button_fg": "#2c2c2c",
                "entry_bg": "#ffffff",
                "entry_fg": "#2c2c2c",
                "text_bg": "#ffffff",
                "text_fg": "#2c2c2c",
                "frame_bg": "#f8f8f8",
                "accent": "#0078d4"
            },
            "dark": {
                "bg": "#2d2d30",
                "fg": "#ffffff",
                "button_bg": "#3e3e42",
                "button_fg": "#ffffff",
                "entry_bg": "#1e1e1e",
                "entry_fg": "#ffffff",
                "text_bg": "#1e1e1e",
                "text_fg": "#ffffff",
                "frame_bg": "#252526",
                "accent": "#0078d4"
            }
        }
        
        print("🔧 Configuration du logging...")
        # Queue pour la communication entre threads
        self.log_queue = queue.Queue()
        
        # Configuration du logging pour rediriger vers l'interface
        self.setup_logging()
        
        print("🔧 Chargement de la configuration...")
        # Charger la configuration
        self.load_config()
        
        print("🔧 Application du thème...")
        # Appliquer le thème
        self.apply_theme()
        
        print("🔧 Création des widgets...")
        # Créer l'interface
        self.create_widgets()
        
        print("🔧 Démarrage du thread de log...")
        # Démarrer le thread de log
        self.start_log_thread()
        
        print("🔧 Chargement des variables d'environnement...")
        # Charger les variables d'environnement
        self.load_env_file()
        
        print("🔧 Initialisation du processeur par lots...")
        # Initialiser le processeur par lots
        self.init_batch_processor()
        
        print("🔧 Configuration du drag and drop...")
        # Configurer le drag and drop (après création des widgets)
        self.setup_drag_drop()
    
    def setup_drag_drop(self):
        """Configure le drag and drop pour l'interface"""
        # Bind les événements de drag and drop sur la fenêtre principale
        self.root.drop_target_register(DND_FILES)
        self.root.dnd_bind('<<Drop>>', self.handle_drop)
        
        # Bind sur les champs de saisie
        self.image_entry.drop_target_register(DND_FILES)
        self.image_entry.dnd_bind('<<Drop>>', self.handle_image_drop)
        
        self.folder_entry.drop_target_register(DND_FILES)
        self.folder_entry.dnd_bind('<<Drop>>', self.handle_folder_drop)
    
    def handle_drop(self, event):
        """Gère le drop de fichiers sur la fenêtre principale"""
        files = event.data.split()
        if not files:
            return
        
        # Traiter chaque fichier
        for file_path in files:
            file_path = file_path.strip('{}')  # Enlever les accolades Windows
            path = Path(file_path)
            
            if path.is_file():
                self.handle_single_file_drop(path)
            elif path.is_dir():
                self.handle_folder_path_drop(path)
    
    def handle_single_file_drop(self, file_path):
        """Gère le drop d'un fichier unique"""
        if self.is_valid_image(file_path):
            self.current_image = file_path
            self.current_folder = None
            self.image_var.set(str(file_path))
            self.folder_var.set("")
            self.log_message(f"✅ Image déposée: {file_path.name}")
            self.save_config()
        else:
            self.log_message(f"❌ Format non supporté: {file_path.name}")
    
    def handle_folder_path_drop(self, folder_path):
        """Gère le drop d'un dossier (appelé avec un chemin Path)"""
        # Vérifier s'il contient des images
        image_files = self.get_image_files_from_folder(folder_path)
        if image_files:
            self.current_folder = folder_path
            self.current_image = None
            self.folder_var.set(str(folder_path))
            self.image_var.set("")
            self.log_message(f"✅ Dossier déposé: {folder_path.name} ({len(image_files)} images)")
            self.save_config()
        else:
            self.log_message(f"❌ Aucune image trouvée dans: {folder_path.name}")
    
    def handle_image_drop(self, event):
        """Gère le drop sur le champ Image"""
        files = event.data.split()
        if files:
            file_path = Path(files[0].strip('{}'))
            if self.is_valid_image(file_path):
                self.current_image = file_path
                self.current_folder = None
                self.image_var.set(str(file_path))
                self.folder_var.set("")
                self.log_message(f"✅ Image déposée: {file_path.name}")
                self.save_config()
            else:
                self.log_message(f"❌ Format non supporté: {file_path.name}")
    
    def handle_folder_drop(self, event):
        """Gère le drop sur le champ Dossier"""
        files = event.data.split()
        if files:
            folder_path = Path(files[0].strip('{}'))
            if folder_path.is_dir():
                image_files = self.get_image_files_from_folder(folder_path)
                if image_files:
                    self.current_folder = folder_path
                    self.current_image = None
                    self.folder_var.set(str(folder_path))
                    self.image_var.set("")
                    self.log_message(f"✅ Dossier déposé: {folder_path.name} ({len(image_files)} images)")
                    self.save_config()
                else:
                    self.log_message(f"❌ Aucune image trouvée dans: {folder_path.name}")
            else:
                self.log_message(f"❌ Ce n'est pas un dossier valide: {folder_path.name}")
    
    def is_valid_image(self, file_path):
        """Vérifie si le fichier est une image valide"""
        valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.gif'}
        return file_path.suffix.lower() in valid_extensions
    
    def get_image_files_from_folder(self, folder_path):
        """Récupère la liste des fichiers d'images dans un dossier"""
        if not folder_path or not folder_path.exists():
            return []
        image_extensions = {'.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.tif'}
        image_files = []
        for file_path in folder_path.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in image_extensions:
                image_files.append(file_path)
        return image_files
    
    def init_batch_processor(self):
        """Initialise le processeur par lots"""
        try:
            self.log_message("Initialisation du processeur par lots...")
            from scripts.batch_processor import BatchProcessor
            
            self.batch_processor = BatchProcessor(
                progress_callback=self.update_batch_progress,
                status_callback=self.update_batch_status,
                error_callback=self.handle_batch_error
            )
            self.batch_mode = True
            self.log_message("Processeur par lots initialise avec succes")
        except ImportError as e:
            self.log_message(f"Mode traitement par lots non disponible: {e}")
            self.batch_mode = False
        except Exception as e:
            self.log_message(f"Erreur lors de l'initialisation du processeur par lots: {e}")
            self.batch_mode = False
    
    def setup_logging(self):
        """Configure le logging pour rediriger vers l'interface GUI"""
        try:
            # Créer un handler personnalisé pour rediriger vers l'interface
            class GUILogHandler(logging.Handler):
                def __init__(self, gui_instance):
                    super().__init__()
                    self.gui = gui_instance
                def emit(self, record):
                    try:
                        msg = self.format(record)
                        self.gui.log_queue.put(msg)
                    except Exception as e:
                        print(f"Erreur dans GUILogHandler: {e}")
            # Configurer le logging
            logging.basicConfig(
                level=logging.INFO,
                format='[%(asctime)s] %(levelname)s: %(message)s',
                datefmt='%H:%M:%S'
            )
            # Ajouter notre handler personnalisé
            gui_handler = GUILogHandler(self)
            gui_handler.setFormatter(logging.Formatter('[%(asctime)s] %(levelname)s: %(message)s', '%H:%M:%S'))
            logging.getLogger().addHandler(gui_handler)
            print("✅ Logging configuré avec succès")
        except Exception as e:
            print(f"❌ Erreur lors de la configuration du logging: {e}")
            # Continuer sans redirection si ça échoue
    
    def write(self, text):
        """Redirige stdout/stderr vers l'interface GUI"""
        if text.strip():  # Ignorer les lignes vides
            self.log_queue.put(text.rstrip())
    
    def flush(self):
        """Méthode flush pour la redirection stdout/stderr"""
        pass
    
    def restore_stdout(self):
        """Restaure stdout et stderr"""
        sys.stdout = self.original_stdout
        sys.stderr = self.original_stderr
    
    def load_env_file(self):
        """Charge les variables d'environnement depuis le fichier .env"""
        env_file = Path(".env")
        if env_file.exists():
            try:
                with open(env_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            os.environ[key.strip()] = value.strip()
                self.log_message("✅ Variables d'environnement chargées depuis .env")
            except Exception as e:
                self.log_message(f"⚠️ Erreur lors du chargement de .env: {e}")
    
    def load_config(self):
        """Charge la configuration depuis le fichier JSON"""
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.output_dir = Path(config.get('output_dir', 'output'))
                    self.verbose = config.get('verbose', False)
                    self.current_theme = config.get('theme', 'light')
                    if config.get('current_image'):
                        self.current_image = Path(config['current_image'])
                    if config.get('current_folder'):
                        self.current_folder = Path(config['current_folder'])
            except Exception as e:
                self.log_message(f"⚠️ Erreur lors du chargement de la configuration: {e}")
    
    def save_config(self):
        """Sauvegarde la configuration dans le fichier JSON"""
        config = {
            'output_dir': str(self.output_dir),
            'verbose': self.verbose,
            'theme': self.current_theme,
            'current_image': str(self.current_image) if self.current_image else None,
            'current_folder': str(self.current_folder) if self.current_folder else None
        }
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            self.log_message(f"⚠️ Erreur lors de la sauvegarde de la configuration: {e}")
    
    def apply_theme(self):
        """Applique le thème actuel à l'interface"""
        theme = self.themes[self.current_theme]
        
        # Configuration du style ttk
        style = ttk.Style()
        style.theme_use('clam')
        
        # Configuration des couleurs pour ttk
        style.configure("TFrame", background=theme["frame_bg"])
        style.configure("TLabel", background=theme["frame_bg"], foreground=theme["fg"])
        style.configure("TButton", 
                      background=theme["button_bg"], 
                      foreground=theme["button_fg"],
                      borderwidth=1,
                      focuscolor=theme["accent"])
        style.configure("TEntry", 
                      fieldbackground=theme["entry_bg"],
                      foreground=theme["entry_fg"],
                      borderwidth=1)
        style.configure("TCheckbutton", 
                      background=theme["frame_bg"],
                      foreground=theme["fg"])
        style.configure("TLabelframe", 
                      background=theme["frame_bg"],
                      foreground=theme["fg"])
        style.configure("TLabelframe.Label", 
                      background=theme["frame_bg"],
                      foreground=theme["fg"])
        
        # Configuration de la fenêtre principale
        self.root.configure(bg=theme["bg"])
        
        # Configuration de la zone de texte
        if hasattr(self, 'log_text'):
            self.log_text.configure(
                bg=theme["text_bg"],
                fg=theme["text_fg"],
                insertbackground=theme["fg"],
                selectbackground=theme["accent"],
                selectforeground=theme["text_bg"]
            )
    
    def toggle_theme(self):
        """Bascule entre le thème clair et sombre"""
        self.current_theme = "dark" if self.current_theme == "light" else "light"
        self.apply_theme()
        self.save_config()
        
        # Mettre à jour l'affichage du bouton
        if hasattr(self, 'theme_button'):
            theme_icon = "🌙" if self.current_theme == "light" else "☀️"
            self.theme_button.configure(text=f"{theme_icon}")
        
        logging.info(f"🎨 Thème changé vers: {self.current_theme}")
    
    def create_widgets(self):
        """Crée l'interface graphique"""
        # Appliquer les styles personnalisés avant toute création de widget
        self.setup_styles()
        # Style
        style = ttk.Style()
        style.theme_use('clam')
        
        # Frame principal
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.grid(row=0, column=0, sticky=(tk.N, tk.S, tk.E, tk.W))
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        
        # Header en haut (titre parfaitement centré + bouton thème à droite)
        header_frame = ttk.Frame(main_frame)
        header_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 30))
        header_frame.columnconfigure(0, weight=0)
        header_frame.columnconfigure(1, weight=1)
        header_frame.columnconfigure(2, weight=0)
        
        # Titre centré
        title_label = ttk.Label(header_frame, text="🎨 Bubble Cleaner", font=('Arial', 18, 'bold'))
        title_label.grid(row=0, column=1, sticky='ew', padx=(0, 0))
        
        # Bouton thème à droite
        theme_icon = "🌙" if self.current_theme == "light" else "☀️"
        self.theme_button = ttk.Button(header_frame, text=theme_icon, width=4, command=self.toggle_theme)
        self.theme_button.grid(row=0, column=2, sticky=tk.E, padx=(20, 0))
        
        # Section Sélection
        selection_frame = ttk.LabelFrame(main_frame, text="📁 Sélection des fichiers", padding="15")
        selection_frame.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 20))
        selection_frame.columnconfigure(1, weight=1)
        
        # Zone de drop visuelle
        drop_zone_frame = ttk.Frame(selection_frame)
        drop_zone_frame.grid(row=0, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 15))
        drop_zone_frame.columnconfigure(0, weight=1)
        
        drop_label = ttk.Label(drop_zone_frame, 
                              text="🖱️ Glissez-déposez vos images ou dossiers ici", 
                              font=('Arial', 10, 'italic'), foreground='#666666')
        drop_label.grid(row=0, column=0, pady=5)
        
        # Configurer le drag and drop sur la zone
        drop_zone_frame.drop_target_register(DND_FILES)
        drop_zone_frame.dnd_bind('<<Drop>>', self.handle_drop)
        
        # Séparateur
        separator = ttk.Separator(selection_frame, orient='horizontal')
        separator.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=10)
        
        # Sélection d'image
        ttk.Label(selection_frame, text="Image:", font=('Arial', 10, 'bold')).grid(row=2, column=0, sticky=tk.W, padx=(0, 15), pady=(0, 10))
        self.image_var = tk.StringVar()
        self.image_entry = ttk.Entry(selection_frame, textvariable=self.image_var, state='readonly')
        self.image_entry.grid(row=2, column=1, sticky=(tk.W, tk.E), padx=(0, 15), pady=(0, 10))
        select_image_btn = ttk.Button(selection_frame, text="📸 Sélectionner", command=self.select_image, width=15)
        select_image_btn.grid(row=2, column=2, pady=(0, 10))
        
        # Sélection de dossier
        ttk.Label(selection_frame, text="Dossier:", font=('Arial', 10, 'bold')).grid(row=3, column=0, sticky=tk.W, padx=(0, 15), pady=(0, 10))
        self.folder_var = tk.StringVar()
        self.folder_entry = ttk.Entry(selection_frame, textvariable=self.folder_var, state='readonly')
        self.folder_entry.grid(row=3, column=1, sticky=(tk.W, tk.E), padx=(0, 15), pady=(0, 10))
        select_folder_btn = ttk.Button(selection_frame, text="📂 Sélectionner", command=self.select_folder, width=15)
        select_folder_btn.grid(row=3, column=2, pady=(0, 10))
        
        # Dossier de sortie
        ttk.Label(selection_frame, text="Sortie:", font=('Arial', 10, 'bold')).grid(row=4, column=0, sticky=tk.W, padx=(0, 15), pady=(0, 10))
        self.output_var = tk.StringVar(value=str(self.output_dir))
        self.output_entry = ttk.Entry(selection_frame, textvariable=self.output_var)
        self.output_entry.grid(row=4, column=1, sticky=(tk.W, tk.E), padx=(0, 15), pady=(0, 10))
        select_output_btn = ttk.Button(selection_frame, text="📁 Choisir", command=self.select_output_folder, width=15)
        select_output_btn.grid(row=4, column=2, pady=(0, 10))
        
        # Bouton Éditer les bulles (temporairement désactivé)
        # if EDITEUR_BULLES_AVAILABLE:
        #     edit_bulles_btn = ttk.Button(selection_frame, text="✏️ Éditer les bulles", 
        #                                command=self.edit_bulles, width=15)
        #     edit_bulles_btn.grid(row=5, column=2, pady=(0, 10))
        
        # SECTION TRAITEMENT (fusionnée)
        processing_frame = ttk.LabelFrame(main_frame, text="⚙️ Traitement", padding="15")
        processing_frame.grid(row=2, column=0, sticky=(tk.W, tk.E), pady=(0, 20))
        processing_frame.columnconfigure(0, weight=1)
        
        # Info utilisateur
        info_label = ttk.Label(processing_frame, text="Sélectionnez une image OU un dossier, puis lancez le traitement :", font=('Arial', 9, 'italic'))
        info_label.grid(row=0, column=0, sticky=tk.W, pady=(0, 10))
        
        # Boutons d'action
        action_buttons_frame = ttk.Frame(processing_frame)
        action_buttons_frame.grid(row=1, column=0, sticky=(tk.W, tk.E))
        action_buttons_frame.columnconfigure(0, weight=1)
        action_buttons_frame.columnconfigure(1, weight=1)
        action_buttons_frame.columnconfigure(2, weight=1)
        
        # Bouton Pipeline Complet
        complete_btn = ttk.Button(action_buttons_frame, text="🔄 Pipeline Complet", 
                                 command=self.run_batch_pipeline, width=20)
        complete_btn.grid(row=0, column=0, padx=(0, 10))
        
        # Bouton Nettoyage Seulement
        clean_btn = ttk.Button(action_buttons_frame, text="🧹 Nettoyage Seulement", 
                              command=lambda: self.run_batch_pipeline(clean_only=True), width=20)
        clean_btn.grid(row=0, column=1, padx=(0, 10))
        
        # Bouton Traduction Seulement
        translate_btn = ttk.Button(action_buttons_frame, text="🌐 Traduction Seulement", 
                                 command=lambda: self.run_batch_pipeline(translate_only=True), width=20)
        translate_btn.grid(row=0, column=2, padx=(0, 10))

        # Boutons d'action supplémentaires
        action_buttons_frame2 = ttk.Frame(processing_frame)
        action_buttons_frame2.grid(row=2, column=0, sticky=(tk.W, tk.E), pady=(10, 0))
        action_buttons_frame2.columnconfigure(0, weight=1)
        
        # Bouton unique pour éditer le texte (gère image unique et multi-images)
        edit_text_btn = ttk.Button(action_buttons_frame2, text="✏️ Éditer le texte",
                                      command=self.launch_text_editor, width=20)
        edit_text_btn.grid(row=0, column=0)
        
        # SECTION PROGRESSION (pour le mode batch)
        progress_frame = ttk.LabelFrame(main_frame, text="📊 Progression", padding="15")
        progress_frame.grid(row=3, column=0, sticky=(tk.W, tk.E), pady=(0, 20))
        progress_frame.columnconfigure(0, weight=1)
        
        # Barre de progression
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100, style="Green.Horizontal.TProgressbar")
        self.progress_bar.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # Informations de progression
        progress_info_frame = ttk.Frame(progress_frame)
        progress_info_frame.grid(row=1, column=0, sticky=(tk.W, tk.E))
        progress_info_frame.columnconfigure(1, weight=1)
        progress_info_frame.columnconfigure(3, weight=1)
        
        ttk.Label(progress_info_frame, text="Image actuelle:").grid(row=0, column=0, sticky=tk.W)
        self.current_image_var = tk.StringVar(value="Aucune")
        ttk.Label(progress_info_frame, textvariable=self.current_image_var, 
                 font=('Arial', 9, 'italic')).grid(row=0, column=1, sticky=tk.W, padx=(5, 0))
        
        ttk.Label(progress_info_frame, text="Temps écoulé:").grid(row=0, column=2, sticky=tk.W, padx=(20, 0))
        self.elapsed_time_var = tk.StringVar(value="0m 0s")
        ttk.Label(progress_info_frame, textvariable=self.elapsed_time_var).grid(row=0, column=3, sticky=tk.W, padx=(5, 0))
        
        ttk.Label(progress_info_frame, text="Temps restant:").grid(row=1, column=0, sticky=tk.W, pady=(5, 0))
        self.remaining_time_var = tk.StringVar(value="Calcul...")
        ttk.Label(progress_info_frame, textvariable=self.remaining_time_var).grid(row=1, column=1, sticky=tk.W, pady=(5, 0), padx=(5, 0))
        
        ttk.Label(progress_info_frame, text="Statut:").grid(row=1, column=2, sticky=tk.W, pady=(5, 0), padx=(20, 0))
        self.status_var = tk.StringVar(value="Prêt")
        ttk.Label(progress_info_frame, textvariable=self.status_var, 
                 font=('Arial', 9, 'bold')).grid(row=1, column=3, sticky=tk.W, pady=(5, 0), padx=(5, 0))
        
        # Statistiques
        stats_frame = ttk.Frame(progress_frame)
        stats_frame.grid(row=2, column=0, sticky=(tk.W, tk.E), pady=(10, 0))
        
        ttk.Label(stats_frame, text="✅ Réussites:").grid(row=0, column=0, sticky=tk.W)
        self.success_count_var = tk.StringVar(value="0")
        ttk.Label(stats_frame, textvariable=self.success_count_var, 
                 font=('Arial', 10, 'bold')).grid(row=0, column=1, sticky=tk.W, padx=(5, 0))
        
        ttk.Label(stats_frame, text="❌ Échecs:").grid(row=0, column=2, sticky=tk.W, padx=(20, 0))
        self.failed_count_var = tk.StringVar(value="0")
        ttk.Label(stats_frame, textvariable=self.failed_count_var, 
                 font=('Arial', 10, 'bold')).grid(row=0, column=3, sticky=tk.W, padx=(5, 0))
        
        # Contrôles du traitement par lots
        batch_controls_frame = ttk.Frame(progress_frame)
        batch_controls_frame.grid(row=3, column=0, sticky=(tk.W, tk.E), pady=(10, 0))
        batch_controls_frame.columnconfigure(0, weight=1)
        batch_controls_frame.columnconfigure(1, weight=1)
        batch_controls_frame.columnconfigure(2, weight=1)
        batch_controls_frame.columnconfigure(3, weight=1)

        self.start_batch_button = tk.Button(batch_controls_frame, text="🚀 Démarrer",
                                            command=self.start_batch_processing, width=15,
                                            bg='#4caf50', fg='white', activebackground='#388e3c', activeforeground='white')
        self.start_batch_button.grid(row=0, column=0, padx=(0, 10))

        self.pause_batch_button = tk.Button(batch_controls_frame, text="⏸️ Pause",
                                            command=self.pause_batch_processing, width=15,
                                            bg='#ff9800', fg='white', activebackground='#f57c00', activeforeground='white', state=tk.DISABLED)
        self.pause_batch_button.grid(row=0, column=1, padx=(0, 10))

        self.stop_batch_button = tk.Button(batch_controls_frame, text="⏹️ Arrêter",
                                           command=self.stop_batch_processing, width=15,
                                           bg='#f44336', fg='white', activebackground='#b71c1c', activeforeground='white', state=tk.DISABLED)
        self.stop_batch_button.grid(row=0, column=2, padx=(0, 10))

        # Nouvelle gestion des boutons batch
        def set_batch_buttons_state(running):
            if running:
                self.start_batch_button.config(state=tk.DISABLED)
                self.pause_batch_button.config(state=tk.NORMAL)
                self.stop_batch_button.config(state=tk.NORMAL)
            else:
                self.start_batch_button.config(state=tk.NORMAL)
                self.pause_batch_button.config(state=tk.DISABLED)
                self.stop_batch_button.config(state=tk.DISABLED)
        self.set_batch_buttons_state = set_batch_buttons_state

        # Remplacer les anciens enable/disable_batch_buttons par la nouvelle fonction
        self.enable_batch_buttons = lambda: self.set_batch_buttons_state(False)
        self.disable_batch_buttons = lambda: self.set_batch_buttons_state(True)
        
        # Section Logs
        log_frame = ttk.LabelFrame(main_frame, text="📋 Logs", padding="15")
        log_frame.grid(row=4, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        main_frame.rowconfigure(4, weight=1)
        
        # Zone de logs
        self.log_text = scrolledtext.ScrolledText(log_frame, height=12, width=80, font=('Consolas', 9))
        self.log_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        # Boutons de log centrés
        log_buttons_frame = ttk.Frame(log_frame)
        log_buttons_frame.grid(row=1, column=0, pady=(0, 0))
        log_buttons_frame.columnconfigure(0, weight=1)
        log_buttons_frame.columnconfigure(1, weight=1)
        log_buttons_frame.columnconfigure(2, weight=1)
        log_buttons_frame.columnconfigure(3, weight=1)
        
        clear_logs_btn = ttk.Button(log_buttons_frame, text="🗑️ Effacer logs", 
                                   command=self.clear_logs, width=15)
        clear_logs_btn.grid(row=0, column=0, padx=(0, 10))
        
        # Mettre à jour l'affichage
        self.update_display()
    
    def setup_styles(self):
        style = ttk.Style()
        # Forcer le thème clam (plus compatible avec les couleurs personnalisées)
        style.theme_use('clam')
        # Style barre de progression verte
        style.configure("Green.Horizontal.TProgressbar", troughcolor='#e0e0e0', background='#4caf50', thickness=20)
        # Styles boutons colorés
        style.configure("Green.TButton", foreground='white', background='#4caf50')
        style.map("Green.TButton",
                  background=[('active', '#388e3c'), ('disabled', '#a5d6a7')])
        style.configure("Orange.TButton", foreground='white', background='#ff9800')
        style.map("Orange.TButton",
                  background=[('active', '#f57c00'), ('disabled', '#ffe0b2')])
        style.configure("Red.TButton", foreground='white', background='#f44336')
        style.map("Red.TButton",
                  background=[('active', '#b71c1c'), ('disabled', '#ffcdd2')])

    def select_image(self):
        """Ouvre le dialogue de sélection d'image"""
        filetypes = [
            ("Images", "*.jpg *.jpeg *.png *.bmp *.tiff"),
            ("Tous les fichiers", "*.*")
        ]
        filename = filedialog.askopenfilename(
            title="Sélectionner une image",
            filetypes=filetypes
        )
        if filename:
            self.current_image = Path(filename)
            self.current_folder = None
            self.image_var.set(str(self.current_image))
            self.folder_var.set("")
            self.log_message(f"✅ Image sélectionnée: {self.current_image}")
            self.save_config()
    
    def select_folder(self):
        """Ouvre le dialogue de sélection de dossier"""
        folder = filedialog.askdirectory(title="Sélectionner un dossier d'images")
        if folder:
            self.current_folder = Path(folder)
            self.current_image = None
            self.folder_var.set(str(self.current_folder))
            self.image_var.set("")
            self.log_message(f"✅ Dossier sélectionné: {self.current_folder}")
            self.save_config()
    
    def select_output_folder(self):
        """Ouvre le dialogue de sélection du dossier de sortie"""
        folder = filedialog.askdirectory(title="Sélectionner le dossier de sortie")
        if folder:
            self.output_dir = Path(folder)
            self.output_var.set(str(self.output_dir))
            self.log_message(f"✅ Dossier de sortie: {self.output_dir}")
            self.save_config()
    
    def toggle_verbose(self):
        """Bascule le mode verbeux"""
        self.verbose = not self.verbose
        status = "activé" if self.verbose else "désactivé"
        self.log_message(f"✅ Mode verbeux {status}")
        
        # Mettre à jour le texte du bouton
        if hasattr(self, 'verbose_btn'):
            verbose_status = "ON" if self.verbose else "OFF"
            self.verbose_btn.configure(text=f"🔍 Verbeux: {verbose_status}")
        
        self.save_config()
    
    def update_display(self):
        """Met à jour l'affichage des variables"""
        self.image_var.set(str(self.current_image) if self.current_image else "")
        self.folder_var.set(str(self.current_folder) if self.current_folder else "")
        self.output_var.set(str(self.output_dir))
        # self.verbose_var.set(self.verbose) # Removed as per edit hint
    
    def run_selected_pipeline(self, clean_only=False, translate_only=False):
        """Lance le pipeline selon le mode sélectionné"""
        if not self.current_image and not self.current_folder:
            messagebox.showwarning("Attention", "Veuillez sélectionner une image ou un dossier avant de lancer le pipeline.")
            return
        
        # Désactiver les boutons pendant l'exécution
        self.disable_buttons()
        
        # Lancer le pipeline dans un thread
        thread = threading.Thread(
            target=self._run_selected_pipeline_thread,
            args=(clean_only, translate_only),
            daemon=True
        )
        thread.start()
    
    def run_pipeline(self, clean_only=False, translate_only=False):
        """Lance le pipeline dans un thread séparé (ancienne méthode)"""
        if not self.current_image and not self.current_folder:
            messagebox.showwarning("Attention", "Veuillez sélectionner une image ou un dossier avant de lancer le pipeline.")
            return
        
        # Désactiver les boutons pendant l'exécution
        self.disable_buttons()
        
        # Lancer le pipeline dans un thread
        thread = threading.Thread(
            target=self._run_pipeline_thread,
            args=(clean_only, translate_only),
            daemon=True
        )
        thread.start()
    
    def _run_selected_pipeline_thread(self, clean_only, translate_only):
        """Exécute le pipeline selon le mode sélectionné"""
        try:
            # Détecter automatiquement le mode selon la sélection
            if self.current_folder and not self.current_image:
                # Mode dossier (multi-images) - utiliser le traitement par lots
                mode = "batch"
                self.log_message("🔄 Mode détecté automatiquement: Traitement par lots (dossier sélectionné)")
            elif self.current_image and not self.current_folder:
                # Mode image unique - utiliser le traitement unique
                mode = "single"
                self.log_message("🎯 Mode détecté automatiquement: Traitement unique (image sélectionnée)")
            else:
                # Utiliser le mode sélectionné manuellement
                mode = getattr(self, 'processing_mode', tk.StringVar(value="single")).get()
                self.log_message(f"🎯 Mode sélectionné manuellement: {mode}")
            
            if mode == "single":
                # Mode traitement unique avec bulles modifiées
                self.log_message("🎯 Mode: Traitement unique (avec bulles modifiées)")
                self._run_pipeline_thread(clean_only, translate_only)
            else:
                # Mode traitement par lots
                self.log_message("🔄 Mode: Traitement par lots")
                self._run_batch_processing(clean_only, translate_only)
            
        except Exception as e:
            self.log_message(f"❌ Erreur dans le pipeline: {e}")
        finally:
            # Réactiver les boutons
            self.root.after(0, self.enable_buttons)
    
    def _run_batch_processing(self, clean_only, translate_only):
        """Lance le traitement par lots"""
        if not hasattr(self, 'batch_processor') or not self.batch_mode:
            self.log_message("Traitement par lots non disponible")
            return
        
        # Utiliser les paramètres passés directement (depuis les boutons)
        # Les paramètres clean_only et translate_only viennent des boutons cliqués
        # et ne dépendent plus du batch_mode
        
        # Vérifier qu'on a des images à traiter
        images_to_process = []
        if self.current_image:
            images_to_process.append(str(self.current_image))
            self.log_message(f"Image selectionnee: {self.current_image}")
        elif self.current_folder:
            image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff'}
            images = [str(p) for p in self.current_folder.iterdir() 
                     if p.suffix.lower() in image_extensions]
            images_to_process.extend(images)
            self.log_message(f"Dossier selectionne: {len(images)} images trouvees")
        
        if not images_to_process:
            self.log_message("Aucune image selectionnee pour le traitement par lots")
            return
        
        self.log_message(f"{len(images_to_process)} images a traiter")
        
        # Log du mode sélectionné
        mode_text = "Pipeline complet"
        if clean_only:
            mode_text = "Nettoyage seulement"
        elif translate_only:
            mode_text = "Traduction seulement"
        self.log_message(f"Mode selectionne: {mode_text}")
        
        # Ajouter les images au processeur
        self.batch_processor.add_images(images_to_process)
        
        # Démarrer le traitement
        # Utiliser 1 thread pour une seule image, 4 threads pour un dossier
        if len(images_to_process) == 1:
            num_workers = 1
            self.log_message("🎯 Utilisation d'un seul thread (image unique)")
        else:
            num_workers = 4
            self.log_message("🔄 Utilisation de 4 threads (traitement par lots)")
        
        self.batch_processor.start_processing(
            output_dir=str(self.output_dir),
            clean_only=clean_only,
            translate_only=translate_only,
            verbose=self.verbose,
            num_workers=num_workers
        )
        
        # Mettre à jour l'interface
        self.disable_batch_buttons()
        self.log_message("Traitement par lots demarre")
    
    def _run_pipeline_thread(self, clean_only, translate_only):
        """Exécute le pipeline dans un thread séparé"""
        # Imports nécessaires pour le pipeline complet
        from scripts.clean_bubbles import predictor
        from scripts.translate_bubbles import extract_and_translate
        from scripts.reinsert_translations import draw_translated_text
        import cv2
        import numpy as np
        
        try:
            # Vérifier si on a des bulles modifiées pour l'image actuelle
            edited_bulles = getattr(self, 'edited_bulles', None)
            has_edited_bulles = edited_bulles is not None and len(edited_bulles) > 0
            self.log_message(f"🔍 Vérification des bulles modifiées:")
            self.log_message(f"   - hasattr(self, 'edited_bulles'): {hasattr(self, 'edited_bulles')}")
            self.log_message(f"   - self.edited_bulles: {edited_bulles}")
            self.log_message(f"   - len(self.edited_bulles): {len(edited_bulles) if edited_bulles else 0}")
            self.log_message(f"   - has_edited_bulles: {has_edited_bulles}")
            
            if has_edited_bulles:
                self.log_message(f"🔧 Utilisation de {len(edited_bulles)} bulle(s) modifiée(s) pour le pipeline")
                
                if self.current_image:
                    self.log_message(f"🚀 Lancement du pipeline avec bulles modifiées sur: {self.current_image}")
                    
                    if translate_only and not clean_only:
                        # Mode "Traduction seulement" : pas de nettoyage, juste traduction
                        self.log_message("🌐 Mode traduction seulement - pas de nettoyage")
                        from scripts.main_pipeline import run_pipeline
                        run_pipeline(str(self.current_image), str(self.output_dir), clean_only=False, translate_only=True)
                    else:
                        # Mode avec nettoyage (Pipeline complet ou Nettoyage seulement)
                        cleaned_image = self.clean_bubbles_with_edited_data(self.current_image, edited_bulles)
                        
                        if cleaned_image is not None:
                            # Sauvegarder l'image nettoyée
                            output_path = Path(self.output_dir) / f"cleaned_{Path(self.current_image).name}"
                            output_path.parent.mkdir(parents=True, exist_ok=True)
                            
                            success = cv2.imwrite(str(output_path), cleaned_image)
                            if success:
                                self.log_message(f"✅ Image nettoyée avec bulles modifiées: {output_path}")
                                
                                if not clean_only:
                                    # Continuer avec traduction et réinsertion si nécessaire
                                    self.log_message("🔄 Passage à la traduction et réinsertion...")
                                    # Pour le pipeline complet avec bulles modifiées, on doit :
                                    # 1. Utiliser l'image originale pour la détection
                                    # 2. Mais remplacer les bulles détectées par nos bulles modifiées
                                    # 3. Puis faire la traduction et réinsertion
                                    
                                    # Détecter les bulles dans l'image originale
                                    self.log_message("🔍 Détection des bulles pour traduction...")
                                    image = cv2.imread(str(self.current_image))
                                    instances = predictor(image)
                                    
                                    if instances is not None and len(instances) > 0:
                                        # Remplacer les bulles détectées par nos bulles modifiées
                                        self.log_message(f"🔧 Remplacement par {len(edited_bulles)} bulle(s) modifiée(s)")
                                        
                                        # Créer les dossiers de sortie
                                        output_dir = Path(self.output_dir)
                                        translations_dir = output_dir / "translations"
                                        final_dir = output_dir / "final"
                                        translations_dir.mkdir(parents=True, exist_ok=True)
                                        final_dir.mkdir(parents=True, exist_ok=True)
                                        
                                        # Extraire et traduire avec les bulles modifiées
                                        self.log_message("🌐 Extraction et traduction du texte...")
                                        from scripts.translate_bubbles import extract_and_translate_with_edited_bulles
                                        results = extract_and_translate_with_edited_bulles(str(self.current_image), edited_bulles)
                                        
                                        if results:
                                            # Sauvegarder les traductions
                                            base_name = Path(self.current_image).stem
                                            txt_path = translations_dir / f"{base_name}.txt"
                                            json_path = translations_dir / f"{base_name}.json"
                                            
                                            with open(txt_path, 'w', encoding='utf-8') as f:
                                                for r in results:
                                                    f.write(f"[{r['index']}] {r['class']} ({r['confidence']*100:.1f}%)\n")
                                                    f.write(f"Anglais   : {r['ocr_text']}\n")
                                                    f.write(f"Français  : {r['translated_text']}\n\n")
                                            
                                            import json
                                            with open(json_path, 'w', encoding='utf-8') as f:
                                                json.dump(results, f, ensure_ascii=False, indent=2)
                                            
                                            self.log_message(f"✅ Traductions sauvegardées: {txt_path}, {json_path}")
                                            
                                            # Réinsérer le texte traduit
                                            self.log_message("🔄 Réinsertion du texte traduit...")
                                            final_path = final_dir / f"{base_name}_translated.png"
                                            draw_translated_text(str(output_path), str(json_path), str(final_path))
                                            
                                            self.log_message(f"✅ Image finale: {final_path}")
                                            self.log_message("✅ Pipeline complet terminé avec succès!")
                                        else:
                                            self.log_message("❌ Aucune traduction générée")
                                    else:
                                        self.log_message("❌ Aucune bulle détectée pour la traduction")
                            else:
                                self.log_message(f"❌ Échec de la sauvegarde: {output_path}")
                        else:
                            self.log_message(f"❌ Échec du nettoyage avec les bulles modifiées")
                            # Fallback vers le pipeline normal
                            from scripts.main_pipeline import run_pipeline
                            run_pipeline(str(self.current_image), str(self.output_dir), clean_only, translate_only)
                else:
                    # Pour les dossiers, on ne peut pas utiliser les bulles modifiées
                    self.log_message("⚠️ Les bulles modifiées ne sont disponibles que pour une image unique")
                    self._run_pipeline_normal(clean_only, translate_only)
            else:
                # Utiliser le pipeline normal
                self.log_message("🔄 Utilisation du pipeline normal (pas de bulles modifiées)")
                self._run_pipeline_normal(clean_only, translate_only)
            
        except Exception as e:
            self.log_message(f"❌ Erreur dans le pipeline: {e}")
        finally:
            # Réactiver les boutons
            self.root.after(0, self.enable_buttons)
    
    def _run_pipeline_normal(self, clean_only, translate_only):
        """Exécute le pipeline normal sans bulles modifiées"""
        from scripts.main_pipeline import run_pipeline
        
        if self.current_image:
            self.log_message(f"🚀 Lancement du pipeline normal sur: {self.current_image}")
            run_pipeline(str(self.current_image), str(self.output_dir), clean_only, translate_only)
        elif self.current_folder:
            self.log_message(f"🚀 Lancement du pipeline normal sur le dossier: {self.current_folder}")
            image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff'}
            images = [p for p in self.current_folder.iterdir() 
                     if p.suffix.lower() in image_extensions]
            
            if not images:
                self.log_message("❌ Aucun fichier image trouvé dans ce dossier")
                return
            
            for i, img in enumerate(images, 1):
                self.log_message(f"➡️ Traitement de {img} ({i}/{len(images)})")
                run_pipeline(str(img), str(self.output_dir), clean_only, translate_only)
            
            self.log_message("✅ Traitement du dossier terminé")
    
    def disable_buttons(self):
        """Désactive les boutons pendant l'exécution"""
        for widget in self.root.winfo_children():
            if isinstance(widget, ttk.Button):
                widget.configure(state='disabled')
    
    def enable_buttons(self):
        """Réactive les boutons après l'exécution"""
        for widget in self.root.winfo_children():
            if isinstance(widget, ttk.Button):
                widget.configure(state='normal')
    
    def log_message(self, message):
        """Ajoute un message à la queue de logs"""
        timestamp = time.strftime("%H:%M:%S")
        self.log_queue.put(f"[{timestamp}] {message}")
    
    def start_log_thread(self):
        """Démarre le thread de traitement des logs"""
        def process_logs():
            while True:
                try:
                    message = self.log_queue.get(timeout=0.1)
                    self.root.after(0, self._add_log_message, message)
                except queue.Empty:
                    continue
        
        thread = threading.Thread(target=process_logs, daemon=True)
        thread.start()
    
    def _add_log_message(self, message):
        """Ajoute un message aux logs (appelé depuis le thread principal)"""
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
    
    def clear_logs(self):
        """Efface les logs"""
        self.log_text.delete(1.0, tk.END)
        self.log_message("🗑️ Logs effacés")
    
    def save_logs(self):
        """Sauvegarde les logs dans un fichier"""
        filename = filedialog.asksaveasfilename(
            title="Sauvegarder les logs",
            defaultextension=".txt",
            filetypes=[("Texte", "*.txt"), ("Tous les fichiers", "*.*")]
        )
        if filename:
            try:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(self.log_text.get(1.0, tk.END))
                self.log_message(f"✅ Logs sauvegardés: {filename}")
            except Exception as e:
                self.log_message(f"❌ Erreur lors de la sauvegarde des logs: {e}")
    
    # Méthodes pour le traitement par lots
    def update_batch_progress(self, progress_info):
        """Met à jour la progression du traitement par lots"""
        # Utiliser after() pour exécuter dans le thread principal
        self.root.after(0, self._update_batch_progress_ui, progress_info)
    
    def _update_batch_progress_ui(self, progress_info):
        """Met à jour l'interface de progression (appelé dans le thread principal)"""
        try:
            if hasattr(self, 'progress_var'):
                self.progress_var.set(progress_info['progress'])
            
            if hasattr(self, 'current_image_var'):
                current_image = progress_info.get('current_image', 'Aucune')
                if current_image:
                    current_image = os.path.basename(current_image)
                self.current_image_var.set(current_image)
            
            if hasattr(self, 'elapsed_time_var'):
                elapsed = progress_info.get('elapsed_time', 0)
                elapsed_str = f"{int(elapsed//60)}m {int(elapsed%60)}s"
                self.elapsed_time_var.set(elapsed_str)
            
            if hasattr(self, 'remaining_time_var'):
                remaining = progress_info.get('estimated_remaining', 0)
                if remaining > 0:
                    remaining_str = f"{int(remaining//60)}m {int(remaining%60)}s"
                else:
                    remaining_str = "Calcul..."
                self.remaining_time_var.set(remaining_str)
            
            if hasattr(self, 'success_count_var'):
                processed = progress_info.get('processed', 0)
                failed = progress_info.get('failed', 0)
                self.success_count_var.set(str(processed - failed))
            
            if hasattr(self, 'failed_count_var'):
                failed = progress_info.get('failed', 0)
                self.failed_count_var.set(str(failed))
        except Exception as e:
            self.log_message(f"Erreur lors de la mise à jour de la progression: {e}")
    
    def update_batch_status(self, status):
        """Met à jour le statut du traitement par lots"""
        # Utiliser after() pour exécuter dans le thread principal
        self.root.after(0, self._update_batch_status_ui, status)
    
    def _update_batch_status_ui(self, status):
        """Met à jour l'interface de statut (appelé dans le thread principal)"""
        try:
            if hasattr(self, 'status_var'):
                self.status_var.set(status)
            
            # Vérifier si le traitement est terminé
            if hasattr(self, 'batch_processor') and not self.batch_processor.is_processing():
                self.enable_batch_buttons()
        except Exception as e:
            self.log_message(f"Erreur lors de la mise à jour du statut: {e}")
    
    def handle_batch_error(self, image_path, error):
        """Gère les erreurs du traitement par lots"""
        # Utiliser after() pour exécuter dans le thread principal
        self.root.after(0, self._handle_batch_error_ui, image_path, error)
    
    def _handle_batch_error_ui(self, image_path, error):
        """Gère les erreurs dans le thread principal"""
        try:
            image_name = os.path.basename(image_path) if image_path else "Image inconnue"
            error_msg = f"Erreur lors du traitement de {image_name}: {error}"
            self.log_message(f"ERREUR: {error_msg}")
        except Exception as e:
            self.log_message(f"Erreur lors de la gestion d'erreur: {e}")
    
    def enable_batch_buttons(self):
        """Active les boutons du traitement par lots"""
        if hasattr(self, 'start_batch_button'):
            self.start_batch_button.configure(state='normal')
        if hasattr(self, 'pause_batch_button'):
            self.pause_batch_button.configure(state='disabled', text="Pause")
        if hasattr(self, 'stop_batch_button'):
            self.stop_batch_button.configure(state='disabled')
    
    def disable_batch_buttons(self):
        """Désactive les boutons du traitement par lots"""
        if hasattr(self, 'start_batch_button'):
            self.start_batch_button.configure(state='disabled')
        if hasattr(self, 'pause_batch_button'):
            self.pause_batch_button.configure(state='normal')
        if hasattr(self, 'stop_batch_button'):
            self.stop_batch_button.configure(state='normal')
    
    # Méthodes pour le traitement par lots
    def start_batch_processing(self):
        """Démarre le traitement par lots"""
        self.log_message("Tentative de demarrage du traitement par lots...")
        
        if not self.current_folder:
            messagebox.showwarning("Attention", "Veuillez d'abord sélectionner un dossier d'images.")
            return
        
        if not self.output_dir:
            messagebox.showwarning("Attention", "Veuillez d'abord sélectionner un dossier de sortie.")
            return
        
        # Lancer le traitement par lots
        self.log_message("🔄 Mode: Traitement par lots")
        self.log_message(f"Dossier sélectionné: {len(self.get_image_files_from_folder(self.current_folder))} images trouvées")
        
        try:
            from scripts.batch_processor import process_folder
            process_folder(str(self.current_folder), str(self.output_dir))
            self.log_message("✅ Traitement par lots terminé")
        except Exception as e:
            self.log_message(f"❌ Erreur lors du traitement par lots: {e}")
            messagebox.showerror("Erreur", f"Erreur lors du traitement par lots: {e}")
    
    def pause_batch_processing(self):
        """Met en pause le traitement par lots"""
        if not hasattr(self, 'batch_processor') or not self.batch_mode:
            return
        
        if self.batch_processor.is_processing():
            if self.batch_processor.is_paused_state():
                self.batch_processor.resume_processing()
                self.pause_batch_button.configure(text="⏸️ Pause")
                self.log_message("▶️ Traitement par lots repris")
            else:
                self.batch_processor.pause_processing()
                self.pause_batch_button.configure(text="▶️ Reprendre")
                self.log_message("⏸️ Traitement par lots mis en pause")
    
    def stop_batch_processing(self):
        """Arrête le traitement par lots"""
        if not hasattr(self, 'batch_processor') or not self.batch_mode:
            return
        
        if self.batch_processor.is_processing():
            self.batch_processor.stop_processing()
            self.log_message("⏹️ Arrêt du traitement par lots demandé")

    # def edit_bulles(self):
    #     """Ouvre l'éditeur de bulles pour modifier les détections (temporairement désactivé)"""
    #     pass

    # def _handle_editor_result(self, result, success):
    #     """Gère le résultat de l'éditeur de manière thread-safe (temporairement désactivé)"""
    #     pass

    # def _handle_editor_error(self, error_msg):
    #     """Gère les erreurs de l'éditeur de manière thread-safe (temporairement désactivé)"""
    #     pass

    # def clean_bubbles_with_edited_data(self, image_path, edited_bulles):
    #     """Nettoie les bulles en utilisant les données modifiées de l'éditeur (temporairement désactivé)"""
    #     pass
    
    def run_batch_pipeline(self, clean_only=False, translate_only=False):
        """Lance le pipeline sur un fichier ou un dossier (toujours mode batch)"""
        chemin = self.current_image or self.current_folder
        if not chemin:
            messagebox.showwarning("Attention", "Veuillez sélectionner une image ou un dossier avant de lancer le traitement.")
            return
        # Si c'est un fichier, on crée une liste avec un seul élément
        if os.path.isfile(chemin):
            images = [chemin]
        elif os.path.isdir(chemin):
            images = self.get_image_files_from_folder(chemin)
            if not images:
                messagebox.showwarning("Attention", "Aucune image trouvée dans le dossier sélectionné.")
                return
        else:
            messagebox.showwarning("Attention", "Sélection invalide.")
            return
        # Désactiver les boutons pendant l'exécution
        self.disable_buttons()
        # Lancer le pipeline dans un thread
        thread = threading.Thread(
            target=self._run_batch_pipeline_thread,
            args=(images, clean_only, translate_only),
            daemon=True
        )
        thread.start()

    def _run_batch_pipeline_thread(self, images, clean_only, translate_only):
        """Exécute le pipeline sur la liste d'images (toujours mode batch)"""
        from scripts.main_pipeline import run_pipeline
        start_time = time.time()
        try:
            total = len(images)
            for i, image_path in enumerate(images, 1):
                self.log_message(f"➡️ Traitement de {image_path} ({i}/{total})")
                run_pipeline(str(image_path), str(self.output_dir), clean_only, translate_only)
                progress_info = {
                    'progress': int(i * 100 / total),
                    'current_image': str(image_path),
                    'elapsed_time': time.time() - start_time
                }
                self.update_batch_progress(progress_info)
            self.log_message("✅ Traitement terminé pour toutes les images.")
        except Exception as e:
            self.log_message(f"❌ Erreur lors du traitement : {e}")
        finally:
            self.enable_buttons()
    
    def launch_text_editor(self):
        """Lance l'éditeur de texte (détecte automatiquement le mode)"""
        try:
            # Détecter le mode : image unique ou dossier
            if self.current_image and not self.current_folder:
                # Mode image unique
                self.log_message(f"🚀 Lancement de l'éditeur (mode image unique)...")
                self.log_message(f"📁 Image: {self.current_image}")
                
                # Chercher l'image nettoyée
                image_name = os.path.basename(self.current_image)
                base_name = os.path.splitext(image_name)[0]
                
                # Chercher l'image nettoyée dans le dossier de sortie
                cleaned_image_path = None
                
                # Essayer plusieurs stratégies pour trouver l'image nettoyée
                search_strategies = [
                    # Stratégie 1: Chercher dans le dossier de sortie configuré
                    lambda: self.output_dir,
                    # Stratégie 2: Chercher dans le dossier parent de l'image originale
                    lambda: Path(self.current_image).parent.parent / "images_cleaned" if "Pictures" in str(self.current_image) else None,
                    # Stratégie 3: Chercher dans le dossier de l'image originale
                    lambda: Path(self.current_image).parent,
                    # Stratégie 4: Chercher dans le dossier de travail actuel
                    lambda: Path.cwd() / "output"
                ]
                
                for strategy in search_strategies:
                    search_dir = strategy()
                    if search_dir and search_dir.exists():
                        self.log_message(f"🔍 Recherche dans: {search_dir}")
                        
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
                                self.log_message(f"✅ Image nettoyée trouvée: {path}")
                                break
                        
                        if cleaned_image_path:
                            break
                
                if not cleaned_image_path:
                    # Si pas d'image nettoyée, utiliser l'image originale
                    self.log_message("⚠️ Image nettoyée non trouvée, utilisation de l'image originale")
                    cleaned_image_path = self.current_image
                
                # Chemins pour les fichiers JSON et sortie
                json_path = self.output_dir / "translations" / f"{base_name}.json"
                output_path = self.output_dir / "final" / f"{base_name}_translated.png"
                
                # Lancer l'éditeur en mode image unique
                from scripts.text_editor_realtime import launch_realtime_text_editor
                launch_realtime_text_editor(str(cleaned_image_path), str(json_path), str(output_path))
                self.log_message("✅ Éditeur fermé")
                
            elif self.current_folder and not self.current_image:
                # Mode dossier (multi-images)
                self.log_message(f"🚀 Lancement de l'éditeur (mode multi-images)...")
                self.log_message(f"📁 Dossier: {self.current_folder}")
                self.log_message(f"📁 Sortie: {self.output_dir}")
                
                # Vérifier que le dossier de sortie existe
                if not self.output_dir.exists():
                    messagebox.showwarning("Attention", 
                        "Aucun dossier de sortie trouvé. Veuillez d'abord exécuter le pipeline de traitement.")
                    return
                
                # Lancer l'éditeur en mode multi-images
                from scripts.text_editor_realtime import launch_multi_image_text_editor
                launch_multi_image_text_editor(str(self.current_folder), str(self.output_dir))
                self.log_message("✅ Éditeur fermé")
                
            else:
                # Aucune sélection ou sélection multiple
                messagebox.showwarning("Attention", 
                    "Veuillez sélectionner soit une image unique, soit un dossier d'images.")
            
        except Exception as e:
            self.log_message(f"❌ Erreur lors du lancement de l'éditeur: {e}")
            messagebox.showerror("Erreur", f"Erreur lors du lancement de l'éditeur: {e}")


def main():
    """Fonction principale"""
    try:
        root = TkinterDnD.Tk()
        app = BubbleCleanerGUI(root)
        # Gestion de la fermeture
        def on_closing():
            if messagebox.askokcancel("Quitter", "Êtes-vous sûr de vouloir quitter ?"):
                # Arrêter le thread de log si il existe
                if hasattr(app, 'log_thread') and app.log_thread.is_alive():
                    app.log_thread.join(timeout=1)
                root.destroy()
        root.protocol("WM_DELETE_WINDOW", on_closing)
        # Centrer la fenêtre
        root.update_idletasks()
        width = root.winfo_width()
        height = root.winfo_height()
        x = (root.winfo_screenwidth() // 2) - (width // 2)
        y = (root.winfo_screenheight() // 2) - (height // 2)
        root.geometry(f"{width}x{height}+{x}+{y}")
        root.mainloop()
    except Exception as e:
        print(f"❌ Erreur lors du lancement de l'interface: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main() 