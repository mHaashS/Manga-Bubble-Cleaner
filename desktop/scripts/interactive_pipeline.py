#!/usr/bin/env python3
"""
Interface interactive pour le pipeline de traitement des bulles de manga
Menu similaire à l'exemple fourni avec gestion des images
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Optional, List

# Patch de compatibilité pour Pillow >= 10.0
try:
    from PIL import Image
    if not hasattr(Image, "Resampling"):
        # Pour compatibilité Pillow < 10
        Image.Resampling = Image
    if not hasattr(Image, "LANCZOS"):
        # Remplacer ANTIALIAS par LANCZOS si nécessaire
        Image.LANCZOS = Image.ANTIALIAS if hasattr(Image, "ANTIALIAS") else Image.Resampling.LANCZOS
except ImportError:
    pass

# Chargement des variables d'environnement depuis .env
def load_env_file():
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
            print("✅ Variables d'environnement chargées depuis .env")
        except Exception as e:
            print(f"⚠️ Erreur lors du chargement de .env: {e}")

# Chargement du fichier .env au démarrage
load_env_file()

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('pipeline.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class InteractivePipeline:
    def __init__(self):
        self.output_dir = Path("output")
        self.current_image: Optional[Path] = None
        self.current_folder: Optional[Path] = None
        self.verbose = False
        self.config_file = Path("config.json")
        self.load_config()

    def load_config(self, config_path: Optional[Path] = None):
        """Charge la configuration depuis le fichier JSON"""
        path = config_path or self.config_file
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    self.output_dir = Path(config.get('output_dir', 'output'))
                    self.verbose = config.get('verbose', False)
                    if config.get('current_image'):
                        self.current_image = Path(config['current_image'])
                    else:
                        self.current_image = None
                    if config.get('current_folder'):
                        self.current_folder = Path(config['current_folder'])
                    else:
                        self.current_folder = None
            except Exception as e:
                logger.error(f"Erreur lors du chargement de la config: {e}")

    def save_config(self, export_path: Optional[Path] = None):
        """Sauvegarde la configuration dans le fichier JSON ou à l'emplacement export_path"""
        config = {
            'output_dir': str(self.output_dir),
            'verbose': self.verbose,
            'current_image': str(self.current_image) if self.current_image else None,
            'current_folder': str(self.current_folder) if self.current_folder else None
        }
        path = export_path or self.config_file
        try:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            print(f"✅ Configuration exportée dans {path}") if export_path else None
        except Exception as e:
            logger.error(f"Erreur lors de la sauvegarde de la config: {e}")

    def select_image(self) -> bool:
        """Permet à l'utilisateur de sélectionner une image"""
        print("\n📁 Sélection d'image")
        print("=" * 50)
        image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff'}
        images = []
        for ext in image_extensions:
            images.extend(Path('.').rglob(f'*{ext}'))
            images.extend(Path('.').rglob(f'*{ext.upper()}'))
        if not images:
            print("❌ Aucune image trouvée dans le répertoire courant et ses sous-répertoires")
            return False
        print(f"📸 Images trouvées ({len(images)}):")
        for i, img_path in enumerate(images, 1):
            print(f"   [{i}] {img_path}")
        while True:
            try:
                choice = input(f"\nSélectionnez une image (1-{len(images)}) ou 'q' pour quitter: ").strip()
                if choice.lower() == 'q':
                    return False
                choice_num = int(choice)
                if 1 <= choice_num <= len(images):
                    self.current_image = images[choice_num - 1]
                    self.current_folder = None
                    print(f"✅ Image sélectionnée: {self.current_image}")
                    self.save_config()
                    return True
                else:
                    print("❌ Choix invalide")
            except ValueError:
                print("❌ Veuillez entrer un nombre valide")
            except KeyboardInterrupt:
                return False

    def select_folder(self) -> bool:
        """Permet à l'utilisateur de sélectionner un dossier d'images ou d'entrer un chemin manuellement"""
        print("\n📁 Sélection d'un dossier d'images")
        print("=" * 50)
        folders = [p for p in Path('.').iterdir() if p.is_dir() and not p.name.startswith('.')]
        if folders:
            print(f"📂 Dossiers trouvés ({len(folders)}):")
            for i, folder in enumerate(folders, 1):
                print(f"   [{i}] {folder}")
        print("\nVous pouvez soit :")
        print(" - Entrer le numéro d'un dossier ci-dessus")
        print(" - Entrer le chemin absolu ou relatif d'un dossier de votre choix")
        print(" - Taper 'q' pour quitter")
        while True:
            try:
                choice = input(f"\nSélectionnez un dossier (numéro ou chemin) : ").strip()
                if choice.lower() == 'q':
                    return False
                if choice.isdigit() and folders:
                    choice_num = int(choice)
                    if 1 <= choice_num <= len(folders):
                        self.current_folder = folders[choice_num - 1]
                        self.current_image = None
                        print(f"✅ Dossier sélectionné: {self.current_folder}")
                        self.save_config()
                        return True
                    else:
                        print("❌ Choix invalide")
                else:
                    # Essayer d'interpréter comme chemin
                    path = Path(choice)
                    if path.exists() and path.is_dir():
                        self.current_folder = path
                        self.current_image = None
                        print(f"✅ Dossier sélectionné: {self.current_folder}")
                        self.save_config()
                        return True
                    else:
                        print("❌ Dossier introuvable : vérifiez le chemin saisi")
            except KeyboardInterrupt:
                return False

    def set_output_folder(self):
        print(f"\n📁 Répertoire de sortie actuel: {self.output_dir}")
        new_dir = input("Nouveau répertoire de sortie (laissez vide pour garder l'actuel): ").strip()
        if new_dir:
            new_path = Path(new_dir)
            try:
                new_path.mkdir(parents=True, exist_ok=True)
                self.output_dir = new_path
                print(f"✅ Répertoire de sortie défini: {self.output_dir}")
                self.save_config()
            except Exception as e:
                print(f"❌ Erreur lors de la création du répertoire: {e}")
        else:
            print("✅ Répertoire de sortie inchangé")

    def load_config_interactive(self):
        print("\n🔄 Charger un fichier de configuration")
        config_path = input("Chemin du fichier de configuration à charger: ").strip()
        if config_path:
            path = Path(config_path)
            if path.exists():
                self.load_config(path)
                print(f"✅ Configuration chargée depuis {path}")
            else:
                print("❌ Fichier de configuration introuvable")
        else:
            print("❌ Chemin non fourni")

    def export_config_interactive(self):
        print("\n💾 Exporter la configuration actuelle")
        export_path = input("Chemin du fichier de destination (ex: ./ma_config.json): ").strip()
        if export_path:
            self.save_config(Path(export_path))
        else:
            print("❌ Chemin non fourni")

    def run_pipeline(self, clean_only=False, translate_only=False):
        """Exécute le pipeline de traitement sur une image ou un dossier"""
        from main_pipeline import run_pipeline
        if self.current_image:
            print(f"\n🚀 Lancement du pipeline sur: {self.current_image}")
            run_pipeline(str(self.current_image), str(self.output_dir), clean_only, translate_only)
        elif self.current_folder:
            print(f"\n🚀 Lancement du pipeline sur toutes les images du dossier: {self.current_folder}")
            image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff'}
            images = [p for p in self.current_folder.iterdir() if p.suffix.lower() in image_extensions]
            if not images:
                print("❌ Aucun fichier image trouvé dans ce dossier")
                return
            for img in images:
                print(f"\n➡️ Traitement de {img}")
                run_pipeline(str(img), str(self.output_dir), clean_only, translate_only)
            print("\n✅ Traitement du dossier terminé")
        else:
            print("❌ Aucune image ou dossier sélectionné")

    def toggle_verbose(self):
        self.verbose = not self.verbose
        status = "activé" if self.verbose else "désactivé"
        print(f"✅ Mode verbeux {status}")
        self.save_config()

    def show_menu(self):
        print("\n" + "=" * 60)
        print("🎨 MANGA BUBBLE CLEANER - Interface Interactive")
        print("=" * 60)
        print(f"📸 Image actuelle: {self.current_image if self.current_image else 'Aucune'}")
        print(f"📂 Dossier actuel: {self.current_folder if self.current_folder else 'Aucun'}")
        print(f"📁 Sortie: {self.output_dir}")
        print(f"🔍 Verbeux: {'ON' if self.verbose else 'OFF'}")
        print()
        print("Options disponibles:")
        print("  [1] - Sélectionner une image")
        print("  [2] - Sélectionner un dossier d'images")
        print("  [3] - Définir le dossier de sortie")
        print("  [4] - Charger un fichier de configuration")
        print("  [5] - Pipeline complet (nettoyage + traduction + réinsertion)")
        print("  [6] - Nettoyer seulement (sans traduction)")
        print("  [7] - Traduire seulement (sans nettoyage)")
        print("  [8] - Mode verbeux (actuellement: " + ("ON" if self.verbose else "OFF") + ")")
        print("  [9] - Exporter la configuration actuelle")
        print("  [0] - Quitter")
        print()

    def run(self):
        """Boucle principale de l'interface"""
        print("🎨 Interface interactive pour le traitement des bulles de manga")
        print("Utilisation de TensorFlow backend.")
        print(f"Configuration: {self.config_file}")
        
        while True:
            try:
                self.show_menu()
                choice = input("Sélectionnez une option (0-9): ").strip()
                
                if choice == "1":
                    self.select_image()
                elif choice == "2":
                    self.select_folder()
                elif choice == "3":
                    self.set_output_folder()
                elif choice == "4":
                    self.load_config_interactive()
                elif choice == "5":
                    self.run_pipeline(clean_only=False, translate_only=False)
                elif choice == "6":
                    self.run_pipeline(clean_only=True, translate_only=False)
                elif choice == "7":
                    self.run_pipeline(clean_only=False, translate_only=True)
                elif choice == "8":
                    self.toggle_verbose()
                elif choice == "9":
                    self.export_config_interactive()
                elif choice == "0":
                    confirm = input("Êtes-vous sûr de vouloir quitter ? (o/n): ").strip().lower()
                    if confirm in ['o', 'oui', 'y', 'yes']:
                        print("👋 Au revoir!")
                        break
                    else:
                        print("Retour au menu...")
                else:
                    print("❌ Option invalide")
                
                input("\nAppuyez sur Entrée pour continuer...")
                
            except KeyboardInterrupt:
                confirm = input("\nÊtes-vous sûr de vouloir quitter ? (o/n): ").strip().lower()
                if confirm in ['o', 'oui', 'y', 'yes']:
                    print("👋 Au revoir!")
                    break
                else:
                    print("Retour au menu...")
            except Exception as e:
                print(f"❌ Erreur: {e}")
                input("Appuyez sur Entrée pour continuer...")

def main():
    """Point d'entrée principal"""
    try:
        pipeline = InteractivePipeline()
        pipeline.run()
    except Exception as e:
        print(f"❌ Erreur fatale: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 