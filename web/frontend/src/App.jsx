import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Box,
  Paper,
  ThemeProvider,
  createTheme,
  Grid,
  Dialog,
  DialogContent,
  IconButton,
  LinearProgress
} from "@mui/material";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#7c3aed' }, // violet
    secondary: { main: '#38bdf8' }, // bleu clair
    background: {
      default: '#f3e8ff', // violet très pâle
      paper: '#fff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#6366f1',
    },
    error: { main: '#ef4444' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, Roboto, Arial, sans-serif',
    h4: { fontWeight: 800 },
    h5: { fontWeight: 700 },
    button: { fontWeight: 700 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

function App() {
  const [files, setFiles] = useState([]);
  const [images, setImages] = useState([]); // [{file, status, result, error}]
  const [globalError, setGlobalError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogImg, setDialogImg] = useState(null);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    const existingFiles = files;
    const allFiles = [...existingFiles];
    const allImages = [...images];
    selected.forEach(file => {
      const alreadyExists = allFiles.some(f => f.name === file.name && f.size === file.size);
      if (!alreadyExists) {
        allFiles.push(file);
        allImages.push({ file, status: 'en attente', result: null, error: null });
      }
    });
    setFiles(allFiles);
    setImages(allImages);
    setGlobalError("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = Array.from(e.dataTransfer.files);
      const existingFiles = files;
      const allFiles = [...existingFiles];
      const allImages = [...images];
      selected.forEach(file => {
        const alreadyExists = allFiles.some(f => f.name === file.name && f.size === file.size);
        if (!alreadyExists) {
          allFiles.push(file);
          allImages.push({ file, status: 'en attente', result: null, error: null });
        }
      });
      setFiles(allFiles);
      setImages(allImages);
      setGlobalError("");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleProcessAll = async () => {
    setProcessing(true);
    setGlobalError("");
    const newImages = [...images];
    for (let i = 0; i < newImages.length; i++) {
      if (newImages[i].status === 'en attente' || newImages[i].status === 'erreur') {
        newImages[i].status = 'en cours';
        setImages([...newImages]);
        try {
          const formData = new FormData();
          formData.append("file", newImages[i].file);
          const res = await fetch("http://localhost:8000/process", {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            throw new Error(`Erreur HTTP: ${res.status}`);
          }
          const imageBlob = await res.blob();
          const imageUrl = URL.createObjectURL(imageBlob);
          newImages[i].result = { url: imageUrl, blob: imageBlob };
          newImages[i].status = 'terminée';
          newImages[i].error = null;
        } catch (err) {
          newImages[i].status = 'erreur';
          newImages[i].error = err.message;
          newImages[i].result = null;
        }
        setImages([...newImages]);
      }
    }
    setProcessing(false);
  };

  const handleDownload = (img) => {
    if (!img.result) return;
    const link = document.createElement("a");
    link.href = img.result.url;
    link.download = `image_traitee_${img.file.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteImage = (idx) => {
    const newFiles = files.filter((_, i) => i !== idx);
    const newImages = images.filter((_, i) => i !== idx);
    setFiles(newFiles);
    setImages(newImages);
  };

  const handleOpenDialog = (img) => {
    setDialogImg(img);
    setDialogOpen(true);
  };
  const handleCloseDialog = () => {
    setDialogOpen(false);
    setDialogImg(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #a78bfa 0%, #818cf8 100%)',
          py: 0,
        }}
      >
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4, px: { xs: 1, sm: 2, md: 4, lg: 8, xl: 12 } }}>
          <Card elevation={8} sx={{
            borderRadius: 4,
            boxShadow: '0 8px 32px 0 rgba(124,58,237,0.15)',
            bgcolor: 'background.paper',
            maxWidth: 900,
            mx: 'auto',
            px: { xs: 2, sm: 4 },
            py: { xs: 3, sm: 5 },
          }}>
            <CardContent sx={{ p: 0 }}>
              <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: 1, mb: 1 }}>
                Traitement automatique des bulles de manga
              </Typography>
              <Typography align="center" sx={{ color: 'text.secondary', mb: 4, fontSize: 18 }}>
                Uploadez vos pages, nettoyez et traduisez les bulles en un clic.
              </Typography>
              <Box
                component="form"
                onSubmit={e => { e.preventDefault(); handleProcessAll(); }}
                sx={{ mt: 2, mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    mb: 2,
                    border: '2px dashed #a78bfa',
                    textAlign: 'center',
                    bgcolor: '#ede9fe',
                    cursor: 'pointer',
                    borderRadius: 3,
                    transition: 'border 0.2s',
                    maxWidth: 480,
                    width: '100%',
                    mx: 'auto',
                    '&:hover': {
                      border: '2px solid #7c3aed',
                      bgcolor: '#f3e8ff',
                    },
                  }}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => document.getElementById('file-input').click()}
                >
                  <input
                    id="file-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <CloudUploadIcon sx={{ fontSize: 54, color: 'primary.main', mb: 1, opacity: 0.85 }} />
                  <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: 17 }}>
                    Glissez-déposez ou cliquez pour sélectionner vos images
                  </Typography>
                  {files.length > 0 && (
                    <Typography variant="body2" color="primary" sx={{ mt: 1, fontWeight: 500 }}>
                      {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}
                    </Typography>
                  )}
                </Paper>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={files.length === 0 || processing}
                  startIcon={<CloudUploadIcon />}
                  sx={{
                    mb: 2,
                    borderRadius: 3,
                    fontWeight: 700,
                    fontSize: 20,
                    py: 1.4,
                    maxWidth: 340,
                    width: '100%',
                    boxShadow: '0 4px 24px 0 rgba(124,58,237,0.12)',
                    letterSpacing: 1,
                    background: 'linear-gradient(90deg, #a78bfa 0%, #818cf8 100%)',
                    color: '#fff',
                    transition: 'background 0.2s',
                    '&:hover': {
                      background: 'linear-gradient(90deg, #7c3aed 0%, #38bdf8 100%)',
                    },
                  }}
                >
                  {processing ? <CircularProgress size={24} color="inherit" /> : `Traiter ${files.length > 1 ? 'les images' : "l'image"}`}
                </Button>
              </Box>
              {globalError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{globalError}</Alert>
              )}
              {images.length > 0 && (
                <Box sx={{ mt: 4 }}>
                  {processing && (
                    <Box sx={{ mb: 3 }}>
                      <LinearProgress
                        variant="determinate"
                        value={
                          images.length === 0
                            ? 0
                            : (images.filter(img => img.status === 'terminée' || img.status === 'erreur').length / images.length) * 100
                        }
                        sx={{ height: 10, borderRadius: 5, background: '#ede9fe', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #a78bfa 0%, #818cf8 100%)' } }}
                      />
                      <Typography variant="body2" align="center" sx={{ mt: 1, fontWeight: 500, color: 'primary.main' }}>
                        {images.filter(img => img.status === 'terminée' || img.status === 'erreur').length} / {images.length} images traitées
                      </Typography>
                    </Box>
                  )}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: 3,
                      '@media (max-width:1200px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
                      '@media (max-width:900px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
                      '@media (max-width:600px)': { gridTemplateColumns: 'repeat(1, 1fr)' },
                    }}
                  >
                    {images.map((img, idx) => (
                      <Box key={idx} sx={{ textAlign: 'center', mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, fontSize: 15, color: 'primary.main' }}>
                          {img.file.name}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1, fontSize: 13, color: 'text.secondary' }}>
                          Statut : {img.status === 'en attente' && 'En attente'}
                          {img.status === 'en cours' && 'Traitement...'}
                          {img.status === 'terminée' && 'Terminé'}
                          {img.status === 'erreur' && 'Erreur'}
                        </Typography>
                        {img.status === 'en cours' && <CircularProgress size={24} color="primary" sx={{ mb: 1 }} />}
                        {img.status === 'erreur' && (
                          <Alert severity="error" sx={{ mb: 1, borderRadius: 2, fontSize: 12, p: 0.5 }}>{img.error}</Alert>
                        )}
                        {img.result && (
                          <>
                            <Box sx={{ position: 'relative', width: 200, height: 300, mx: 'auto', mb: 1, bgcolor: '#ede9fe', borderRadius: 3, boxShadow: '0 4px 24px 0 rgba(124,58,237,0.10)', border: '1.5px solid #a78bfa', overflow: 'hidden', transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 8px 32px 0 #a78bfa' } }}>
                              <IconButton
                                size="small"
                                aria-label="Supprimer"
                                onClick={() => handleDeleteImage(idx)}
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  zIndex: 2,
                                  color: '#ef4444',
                                  background: 'rgba(243,244,246,0.97)',
                                  boxShadow: 6,
                                  width: 28,
                                  height: 28,
                                  borderRadius: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  p: 0,
                                  '&:hover': { background: '#fee2e2' },
                                }}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                              <Box
                                component="img"
                                src={img.result.url}
                                alt="Image traitée"
                                sx={{
                                  width: 200,
                                  height: 300,
                                  objectFit: 'contain',
                                  borderRadius: 0,
                                  boxShadow: 0,
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'transform 0.15s',
                                  display: 'block',
                                  mx: 'auto',
                                  '&:hover': { transform: 'scale(1.04)' },
                                }}
                                onClick={() => handleOpenDialog(img)}
                              />
                            </Box>
                            <Button
                              variant="outlined"
                              color="primary"
                              startIcon={<DownloadIcon />}
                              sx={{ mt: 1, borderRadius: 2, fontWeight: 600, fontSize: 13, px: 2, py: 0.7, display: 'block', mx: 'auto', color: 'primary.main', borderColor: 'primary.main', background: 'rgba(124,58,237,0.08)', '&:hover': { background: 'rgba(124,58,237,0.18)' } }}
                              onClick={() => handleDownload(img)}
                            >
                              Télécharger
                            </Button>
                          </>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Container>
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="xl" fullWidth>
          <DialogContent sx={{ position: 'relative', p: 0, bgcolor: '#f3e8ff' }}>
            <IconButton
              aria-label="fermer"
              onClick={handleCloseDialog}
              sx={{ position: 'absolute', top: 8, right: 8, color: '#7c3aed', zIndex: 2, background: 'rgba(236,233,254,0.7)', '&:hover': { background: '#a78bfa' } }}
            >
              <CloseIcon />
            </IconButton>
            {dialogImg && dialogImg.result && (
              <Box sx={{ width: '100%', textAlign: 'center', bgcolor: '#f3e8ff', py: 2 }}>
                <Box
                  component="img"
                  src={dialogImg.result.url}
                  alt="Aperçu"
                  sx={{
                    maxWidth: '90vw',
                    maxHeight: '85vh',
                    borderRadius: 2,
                    boxShadow: 6,
                    border: '2px solid #a78bfa',
                  }}
                />
              </Box>
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default App; 