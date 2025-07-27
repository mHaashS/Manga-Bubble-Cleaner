"""
Traitement par lots pour Bubble Cleaner
Gère le traitement de plusieurs images en arrière-plan avec contrôles
"""

import os
import time
import threading
from queue import Queue
from pathlib import Path
from typing import List, Dict, Optional, Callable
import logging
import concurrent.futures

# Import du patch PIL pour compatibilité
import pil_patch

from scripts.main_pipeline import run_pipeline

logger = logging.getLogger(__name__)

def process_one(image_path, output_dir, clean_only, translate_only, verbose):
    from scripts.main_pipeline import run_pipeline
    import os
    from pathlib import Path
    import logging
    logger = logging.getLogger(__name__)
    image_name = Path(image_path).stem
    if clean_only:
        cleaned_dir = os.path.join(output_dir, "cleaned")
        os.makedirs(cleaned_dir, exist_ok=True)
        image_output_dir = cleaned_dir
    elif translate_only:
        image_output_dir = output_dir
    else:
        cleaned_dir = os.path.join(output_dir, "cleaned")
        final_dir = os.path.join(output_dir, "final")
        translations_dir = os.path.join(output_dir, "translations")
        os.makedirs(cleaned_dir, exist_ok=True)
        os.makedirs(final_dir, exist_ok=True)
        os.makedirs(translations_dir, exist_ok=True)
        image_output_dir = output_dir
    try:
        result = run_pipeline(
            image_path=image_path,
            output_dir=image_output_dir,
            clean_only=clean_only,
            translate_only=translate_only,
            verbose=verbose
        )
        return (image_path, True)
    except Exception as e:
        logger.error(f"Erreur dans le process: {e}")
        return (image_path, False)

class BatchProcessor:
    """Gestionnaire de traitement par lots"""
    
    def __init__(self, progress_callback: Optional[Callable] = None, 
                 status_callback: Optional[Callable] = None,
                 error_callback: Optional[Callable] = None):
        """
        Initialise le processeur par lots
        
        Args:
            progress_callback: Fonction appelée pour mettre à jour la progression
            status_callback: Fonction appelée pour mettre à jour le statut
            error_callback: Fonction appelée en cas d'erreur
        """
        self.queue = Queue()
        self.results = {}
        self.current_image = None
        self.progress = 0
        self.total_images = 0
        self.processed_images = 0
        self.failed_images = 0
        self.start_time = None
        self.is_running = False
        self.is_paused = False
        self.should_stop = False
        self.num_workers = 1  # Valeur par défaut
        
        # Callbacks pour l'interface
        self.progress_callback = progress_callback
        self.status_callback = status_callback
        self.error_callback = error_callback
        
        # Thread de traitement
        self.worker_thread = None
        
        logger.info("Processeur par lots initialise")
    
    def add_images(self, image_paths: List[str]) -> None:
        """
        Ajoute des images à la file d'attente
        
        Args:
            image_paths: Liste des chemins d'images à traiter
        """
        valid_paths = []
        for path in image_paths:
            if os.path.exists(path) and path.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                valid_paths.append(path)
            else:
                logger.warning(f"Fichier ignore (non trouve ou format non supporte): {path}")
        
        self.total_images = len(valid_paths)
        self.processed_images = 0
        self.failed_images = 0
        
        for path in valid_paths:
            self.queue.put(path)
        
        logger.info(f"{len(valid_paths)} images ajoutees a la file d'attente")
        self._update_status(f"{len(valid_paths)} images en attente")
    
    def start_processing(self, output_dir: str, clean_only: bool = False, 
                        translate_only: bool = False, verbose: bool = False, num_workers: int = 1) -> None:
        """
        Lance le traitement par lots en parallèle
        """
        if self.is_running:
            logger.warning("Traitement deja en cours")
            return
        if self.queue.empty():
            logger.warning("Aucune image dans la file d'attente")
            return
        self.is_running = True
        self.is_paused = False
        self.should_stop = False
        self.start_time = time.time()
        self.num_workers = num_workers
        # Lance le thread de gestion du pool
        self.worker_thread = threading.Thread(
            target=self._process_pool_worker,
            args=(output_dir, clean_only, translate_only, verbose, num_workers),
            daemon=True
        )
        self.worker_thread.start()
        logger.info(f"Traitement par lots lance avec {num_workers} threads")
        self._update_status("Traitement en cours...")
    
    def pause_processing(self) -> None:
        """Met en pause le traitement"""
        if not self.is_running:
            return
        
        self.is_paused = True
        logger.info("Traitement mis en pause")
        self._update_status("Traitement en pause")
    
    def resume_processing(self) -> None:
        """Reprend le traitement"""
        if not self.is_running or not self.is_paused:
            return
        
        self.is_paused = False
        logger.info("Traitement repris")
        self._update_status("Traitement en cours...")
    
    def stop_processing(self) -> None:
        """Arrête complètement le traitement"""
        if not self.is_running:
            return
        
        self.should_stop = True
        self.is_paused = False
        logger.info("Arret du traitement demande")
        self._update_status("Arret en cours...")
    
    def get_progress(self) -> Dict:
        """
        Retourne les informations de progression
        
        Returns:
            Dict avec les informations de progression
        """
        if self.total_images == 0:
            return {
                'progress': 0,
                'processed': 0,
                'total': 0,
                'failed': 0,
                'current_image': None,
                'elapsed_time': 0,
                'estimated_remaining': 0
            }
        
        progress = (self.processed_images / self.total_images) * 100
        elapsed_time = time.time() - self.start_time if self.start_time else 0
        
        # Estimation du temps restant
        if self.processed_images > 0 and elapsed_time > 0:
            avg_time_per_image = elapsed_time / self.processed_images
            remaining_images = self.total_images - self.processed_images
            estimated_remaining = avg_time_per_image * remaining_images
        else:
            estimated_remaining = 0
        
        return {
            'progress': progress,
            'processed': self.processed_images,
            'total': self.total_images,
            'failed': self.failed_images,
            'current_image': self.current_image,
            'elapsed_time': elapsed_time,
            'estimated_remaining': estimated_remaining
        }
    
    def get_results(self) -> Dict:
        """
        Retourne les résultats du traitement
        
        Returns:
            Dict avec les résultats
        """
        return {
            'successful': self.results,
            'failed': self.failed_images,
            'total_processed': self.processed_images,
            'total_images': self.total_images
        }
    
    def _process_pool_worker(self, output_dir: str, clean_only: bool, translate_only: bool, verbose: bool, num_workers: int) -> None:
        """Traitement parallèle des images avec ProcessPoolExecutor"""
        try:
            images = []
            while not self.queue.empty():
                images.append(self.queue.get())
            self.total_images = len(images)
            self.processed_images = 0
            self.failed_images = 0
            self._update_progress()
            self._update_status(f"{self.total_images} images à traiter")
            # Utilisation de ProcessPoolExecutor avec la fonction process_one du module
            with concurrent.futures.ProcessPoolExecutor(max_workers=num_workers) as executor:
                futures = [executor.submit(process_one, img, output_dir, clean_only, translate_only, verbose) for img in images]
                for future in concurrent.futures.as_completed(futures):
                    try:
                        img_path, success = future.result()
                        self.processed_images += 1
                        if not success:
                            self.failed_images += 1
                    except Exception as e:
                        self.processed_images += 1
                        self.failed_images += 1
                        logger.error(f"Erreur dans le process: {e}")
                    self._update_progress()
            self.is_running = False
            self.current_image = None
            if self.should_stop:
                logger.info("Traitement arrete par l'utilisateur")
                self._update_status("Traitement arrete")
            else:
                logger.info("Traitement par lots termine")
                self._update_status("Traitement termine")
                success_rate = ((self.total_images - self.failed_images) / self.total_images) * 100 if self.total_images else 0
                total_time = time.time() - self.start_time if self.start_time else 0
                logger.info(f"Statistiques finales:")
                logger.info(f"   - Images traitees: {self.processed_images}/{self.total_images}")
                logger.info(f"   - Taux de reussite: {success_rate:.1f}%")
                logger.info(f"   - Temps total: {total_time:.1f}s")
        except Exception as e:
            logger.error(f"Erreur fatale dans le traitement par lots: {e}")
            self.is_running = False
            self._update_status("Erreur fatale")
            if self.error_callback:
                self.error_callback(None, f"Erreur fatale: {e}")
    
    def _update_progress(self) -> None:
        """Met à jour la progression"""
        if self.progress_callback:
            progress_info = self.get_progress()
            self.progress_callback(progress_info)
    
    def _update_status(self, status: str) -> None:
        """Met à jour le statut"""
        if self.status_callback:
            self.status_callback(status)
    
    def is_processing(self) -> bool:
        """Vérifie si un traitement est en cours"""
        return self.is_running
    
    def is_paused_state(self) -> bool:
        """Vérifie si le traitement est en pause"""
        return self.is_paused
    
    def clear_queue(self) -> None:
        """Vide la file d'attente"""
        while not self.queue.empty():
            try:
                self.queue.get_nowait()
                self.queue.task_done()
            except:
                pass
        self.total_images = 0
        self.processed_images = 0
        self.failed_images = 0
        logger.info("File d'attente videe") 