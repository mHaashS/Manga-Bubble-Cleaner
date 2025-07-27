"""
Patch de compatibilité pour Pillow >= 10.0
Ce fichier doit être importé au tout début de chaque script qui utilise PIL
"""

def apply_pil_patch():
    """Applique le patch de compatibilité PIL"""
    try:
        from PIL import Image
        if not hasattr(Image, "Resampling"):
            # Pour compatibilité Pillow < 10
            Image.Resampling = Image
        if not hasattr(Image, "LANCZOS"):
            # Remplacer ANTIALIAS par LANCZOS si nécessaire
            Image.LANCZOS = Image.ANTIALIAS if hasattr(Image, "ANTIALIAS") else Image.Resampling.LANCZOS
        return True
    except ImportError:
        return False

# Appliquer le patch automatiquement à l'import
apply_pil_patch() 