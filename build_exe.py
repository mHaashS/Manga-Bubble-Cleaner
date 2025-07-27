#!/usr/bin/env python3
"""
Script pour créer un exécutable autonome de Bubble Cleaner
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def check_pyinstaller():
    """Vérifie si PyInstaller est installé"""
    try:
        import PyInstaller
        print("✅ PyInstaller installé")
        return True
    except ImportError:
        print("❌ PyInstaller non installé")
        return False

def install_pyinstaller():
    """Installe PyInstaller"""
    print("📦 Installation de PyInstaller...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
        print("✅ PyInstaller installé avec succès")
        return True
    except subprocess.CalledProcessError:
        print("❌ Erreur lors de l'installation de PyInstaller")
        return False

def create_spec_file():
    """Crée le fichier spec pour PyInstaller"""
    spec_content = '''# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['gui_app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('scripts', 'scripts'),
        ('models', 'models'),
        ('config_gui.json', '.'),
        ('.env', '.'),
    ],
    hiddenimports=[
        'tkinter',
        'tkinter.ttk',
        'tkinter.filedialog',
        'tkinter.messagebox',
        'tkinter.scrolledtext',
        'cv2',
        'torch',
        'torchvision',
        'detectron2',
        'easyocr',
        'openai',
        'PIL',
        'PIL.Image',
        'PIL.ImageDraw',
        'PIL.ImageFont',
        'numpy',
        'json',
        'threading',
        'queue',
        'logging',
        'pathlib',
        'argparse',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='BubbleCleaner',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Pas de console pour une app GUI
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico' if os.path.exists('icon.ico') else None,
)
'''
    
    with open('BubbleCleaner.spec', 'w', encoding='utf-8') as f:
        f.write(spec_content)
    
    print("✅ Fichier spec créé: BubbleCleaner.spec")

def build_executable():
    """Construit l'exécutable"""
    print("🔨 Construction de l'exécutable...")
    
    # Vérifier les fichiers nécessaires
    required_files = ['gui_app.py', 'scripts/', 'config_gui.json']
    missing_files = []
    
    for file in required_files:
        if not Path(file).exists():
            missing_files.append(file)
    
    if missing_files:
        print(f"❌ Fichiers manquants: {', '.join(missing_files)}")
        return False
    
    # Créer le fichier spec
    create_spec_file()
    
    # Construire l'exécutable
    try:
        cmd = [
            sys.executable, "-m", "PyInstaller",
            "--clean",
            "--onefile",
            "--windowed",  # Pas de console
            "--name=BubbleCleaner",
            "gui_app.py"
        ]
        
        # Ajouter les données
        cmd.extend([
            "--add-data=scripts;scripts",
            "--add-data=models;models",
            "--add-data=config_gui.json;.",
        ])
        
        # Ajouter .env s'il existe
        if Path('.env').exists():
            cmd.extend(["--add-data=.env;."])
        
        # Ajouter l'icône s'il existe
        if Path('icon.ico').exists():
            cmd.extend(["--icon=icon.ico"])
        
        print(f"Commande: {' '.join(cmd)}")
        subprocess.check_call(cmd)
        
        print("✅ Exécutable créé avec succès!")
        print("📁 L'exécutable se trouve dans: dist/BubbleCleaner.exe")
        return True
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Erreur lors de la construction: {e}")
        return False

def create_launcher_script():
    """Crée un script de lancement simple"""
    launcher_content = '''#!/usr/bin/env python3
"""
Lanceur simple pour Bubble Cleaner
"""

import sys
import os
from pathlib import Path

# Ajouter le répertoire scripts au path
script_dir = Path(__file__).parent
sys.path.append(str(script_dir / "scripts"))

# Importer et lancer l'application
try:
    from gui_app import main
    main()
except Exception as e:
    print(f"Erreur lors du lancement: {e}")
    input("Appuyez sur Entrée pour quitter...")
'''
    
    with open('launch_simple.py', 'w', encoding='utf-8') as f:
        f.write(launcher_content)
    
    print("✅ Script de lancement créé: launch_simple.py")

def main():
    """Fonction principale"""
    print("🎨 Bubble Cleaner - Création d'exécutable autonome")
    print("=" * 50)
    
    # Vérifier PyInstaller
    if not check_pyinstaller():
        print("\n📦 Installation de PyInstaller...")
        if not install_pyinstaller():
            print("❌ Impossible de continuer sans PyInstaller")
            return
    
    # Créer le script de lancement
    create_launcher_script()
    
    # Construire l'exécutable
    print("\n🔨 Construction de l'exécutable...")
    if build_executable():
        print("\n🎉 Succès!")
        print("📁 Votre exécutable se trouve dans: dist/BubbleCleaner.exe")
        print("💡 Vous pouvez maintenant double-cliquer sur BubbleCleaner.exe pour lancer l'application")
        
        # Copier l'exécutable dans le répertoire principal
        exe_path = Path("dist/BubbleCleaner.exe")
        if exe_path.exists():
            shutil.copy2(exe_path, "BubbleCleaner.exe")
            print("📋 Copie de BubbleCleaner.exe dans le répertoire principal")
    else:
        print("\n❌ Échec de la construction de l'exécutable")

if __name__ == "__main__":
    main() 