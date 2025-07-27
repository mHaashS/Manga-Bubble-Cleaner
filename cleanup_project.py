#!/usr/bin/env python3
"""
Script de nettoyage du projet Bubble Cleaner
Supprime les fichiers inutiles et libère de l'espace
"""

import os
import shutil
from pathlib import Path
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def cleanup_project():
    """Nettoie le projet en supprimant les fichiers inutiles"""
    
    project_root = Path.cwd()
    total_freed = 0
    deleted_items = []
    
    # 1. Supprimer __pycache__
    pycache_dirs = list(project_root.rglob("__pycache__"))
    for pycache_dir in pycache_dirs:
        try:
            size = sum(f.stat().st_size for f in pycache_dir.rglob('*') if f.is_file())
            shutil.rmtree(pycache_dir)
            total_freed += size
            deleted_items.append(f"🗂️ {pycache_dir} ({size/1024:.1f}KB)")
            logger.info(f"✅ Supprimé: {pycache_dir}")
        except Exception as e:
            logger.error(f"❌ Erreur lors de la suppression de {pycache_dir}: {e}")
    
    # 2. Supprimer pipeline.log
    pipeline_log = project_root / "pipeline.log"
    if pipeline_log.exists():
        try:
            size = pipeline_log.stat().st_size
            pipeline_log.unlink()
            total_freed += size
            deleted_items.append(f"📄 pipeline.log ({size/1024:.1f}KB)")
            logger.info(f"✅ Supprimé: {pipeline_log}")
        except Exception as e:
            logger.error(f"❌ Erreur lors de la suppression de {pipeline_log}: {e}")
    
    # 3. Supprimer test_output/
    test_output_dir = project_root / "test_output"
    if test_output_dir.exists():
        try:
            size = sum(f.stat().st_size for f in test_output_dir.rglob('*') if f.is_file())
            shutil.rmtree(test_output_dir)
            total_freed += size
            deleted_items.append(f"🧪 test_output/ ({size/1024:.1f}KB)")
            logger.info(f"✅ Supprimé: {test_output_dir}")
        except Exception as e:
            logger.error(f"❌ Erreur lors de la suppression de {test_output_dir}: {e}")
    
    # 4. Supprimer les fichiers TensorBoard/ML obsolètes
    output_dir = project_root / "output"
    if output_dir.exists():
        # Fichiers TensorBoard
        tensorboard_files = [
            "events.out.tfevents.1748647825.DESKTOP-G2ER26U.9068.0",
            "metrics.json",
            "last_checkpoint"
        ]
        
        for filename in tensorboard_files:
            file_path = output_dir / filename
            if file_path.exists():
                try:
                    size = file_path.stat().st_size
                    file_path.unlink()
                    total_freed += size
                    deleted_items.append(f"📊 {filename} ({size/1024:.1f}KB)")
                    logger.info(f"✅ Supprimé: {file_path}")
                except Exception as e:
                    logger.error(f"❌ Erreur lors de la suppression de {file_path}: {e}")
        
        # Dossiers ML obsolètes
        ml_dirs = ["predtest", "visuals", "inference"]
        for dirname in ml_dirs:
            dir_path = output_dir / dirname
            if dir_path.exists():
                try:
                    size = sum(f.stat().st_size for f in dir_path.rglob('*') if f.is_file())
                    shutil.rmtree(dir_path)
                    total_freed += size
                    deleted_items.append(f"📈 {dirname}/ ({size/1024:.1f}KB)")
                    logger.info(f"✅ Supprimé: {dir_path}")
                except Exception as e:
                    logger.error(f"❌ Erreur lors de la suppression de {dir_path}: {e}")
    
    # 5. Supprimer les fichiers obsolètes du développement
    obsolete_files = [
        "editeur_bulles_qt.py",
        "gui_batch.py", 
        "launch_batch.py"
    ]
    
    for filename in obsolete_files:
        file_path = project_root / filename
        if file_path.exists():
            try:
                size = file_path.stat().st_size
                file_path.unlink()
                total_freed += size
                deleted_items.append(f"📝 {filename} ({size/1024:.1f}KB)")
                logger.info(f"✅ Supprimé: {file_path}")
            except Exception as e:
                logger.error(f"❌ Erreur lors de la suppression de {file_path}: {e}")
    
    # Résumé
    logger.info("=" * 50)
    logger.info("🧹 NETTOYAGE TERMINÉ")
    logger.info("=" * 50)
    
    if deleted_items:
        logger.info("📋 Fichiers supprimés:")
        for item in deleted_items:
            logger.info(f"   {item}")
    
    logger.info(f"💾 Espace libéré: {total_freed/1024:.1f}KB ({total_freed/1024/1024:.2f}MB)")
    
    if total_freed > 0:
        logger.info("✅ Nettoyage réussi!")
    else:
        logger.info("ℹ️ Aucun fichier inutile trouvé.")
    
    return total_freed, deleted_items

if __name__ == "__main__":
    print("🧹 Début du nettoyage du projet Bubble Cleaner...")
    print("=" * 50)
    
    freed_space, deleted_items = cleanup_project()
    
    print("\n🎯 Résumé:")
    print(f"   - Espace libéré: {freed_space/1024:.1f}KB")
    print(f"   - Fichiers supprimés: {len(deleted_items)}")
    
    if freed_space > 0:
        print("✅ Nettoyage terminé avec succès!")
    else:
        print("ℹ️ Projet déjà propre!") 