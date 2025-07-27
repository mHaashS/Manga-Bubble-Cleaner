#!/usr/bin/env python3
"""
Script pour télécharger automatiquement la police Anime Ace
"""

import os
import urllib.request
import zipfile
import shutil

def download_anime_ace():
    """Télécharge et installe la police Anime Ace"""
    
    # Créer le dossier fonts s'il n'existe pas
    if not os.path.exists('fonts'):
        os.makedirs('fonts')
    
    font_path = "fonts/animeace.ttf"
    
    # Vérifier si la police existe déjà
    if os.path.exists(font_path):
        print("✅ Police Anime Ace déjà installée")
        return True
    
    print("📥 Téléchargement de la police Anime Ace...")
    
    try:
        # URL de téléchargement (exemple - vous devrez trouver une vraie URL)
        # Note: Cette URL est un exemple, vous devrez trouver une vraie source
        url = "https://www.dafontfree.net/data/25/a/AnimeAce.ttf"
        
        # Essayer de télécharger
        urllib.request.urlretrieve(url, font_path)
        
        if os.path.exists(font_path):
            print("✅ Police Anime Ace téléchargée avec succès!")
            print(f"📁 Fichier installé: {font_path}")
            return True
        else:
            print("❌ Échec du téléchargement")
            return False
            
    except Exception as e:
        print(f"❌ Erreur lors du téléchargement: {e}")
        print("\n💡 Instructions manuelles:")
        print("1. Allez sur https://www.dafont.com/anime-ace.font")
        print("2. Téléchargez le fichier animeace.ttf")
        print("3. Placez-le dans le dossier 'fonts/'")
        print("4. Redémarrez Bubble Cleaner")
        return False

if __name__ == "__main__":
    print("🎨 Installation de la police Anime Ace pour Bubble Cleaner")
    print("=" * 50)
    
    success = download_anime_ace()
    
    if success:
        print("\n🎉 Installation terminée!")
        print("🔄 Redémarrez Bubble Cleaner pour utiliser Anime Ace")
    else:
        print("\n📋 Installation manuelle requise")
        print("Veuillez suivre les instructions ci-dessus") 