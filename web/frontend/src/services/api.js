// Service API pour toutes les communications avec le backend
const API_BASE_URL = 'http://localhost:8000';

// Traitement principal d'une image
export const processImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch(`${API_BASE_URL}/process`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }
  
  return await response.json();
};

// Récupération des polygones de bulles
export const getBubblePolygons = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  
  const response = await fetch(`${API_BASE_URL}/get-bubble-polygons`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }
  
  return await response.json();
};

// Retraitement avec polygones personnalisés
export const retreatWithPolygons = async (file, polygons) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("polygons", JSON.stringify(polygons));
  
  const response = await fetch(`${API_BASE_URL}/retreat-with-polygons`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }
  
  return await response.json();
};

// Réinsertion du texte traduit
export const reinsertText = async (file, bubbles) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("bubbles", JSON.stringify(bubbles));
  
  const response = await fetch(`${API_BASE_URL}/reinsert`, {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error(`Erreur HTTP: ${response.status}`);
  }
  
  return await response.json();
}; 