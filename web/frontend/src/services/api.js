// Service API pour toutes les communications avec le backend
import authService from './authService';

// Traitement principal d'une image
export const processImage = async (file) => {
  return await authService.processImage(file);
};

// Récupération des polygones de bulles
export const getBubblePolygons = async (file) => {
  const result = await authService.getBubblePolygons(file);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.result;
};

// Retraitement avec polygones personnalisés
export const retreatWithPolygons = async (file, polygons) => {
  const result = await authService.retreatWithPolygons(file, polygons);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.result;
};

// Réinsertion du texte traduit
export const reinsertText = async (file, bubbles) => {
  const result = await authService.reinsertText(file, bubbles);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.result;
}; 