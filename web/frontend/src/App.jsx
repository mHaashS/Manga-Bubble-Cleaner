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
  IconButton
} from "@mui/material";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';

const theme = createTheme({
  palette: {
    primary: { main: '#7c3aed' },
    secondary: { main: '#38bdf8' },
    background: { default: '#f3e8ff' },
  },
  shape: { borderRadius: 8 },
  typography: { fontFamily: 'Inter, Roboto, Arial, sans-serif' },
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
    setFiles(selected);
    setImages(selected.map(file => ({ file, status: 'en attente', result: null, error: null })));
    setGlobalError("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selected = Array.from(e.dataTransfer.files);
      setFiles(selected);
      setImages(selected.map(file => ({ file, status: 'en attente', result: null, error: null })));
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
        <AppBar position="static" color="primary" elevation={2} sx={{ borderRadius: 0, mb: 4 }}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
              Bubble Cleaner Web
            </Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4, px: { xs: 1, sm: 2, md: 4, lg: 8, xl: 12 } }}>
          <Card elevation={6} sx={{ borderRadius: 2, boxShadow: 8 }}>
            <CardContent>
              <Typography variant="h5" align="center" gutterBottom sx={{ fontWeight: 600, color: 'primary.main' }}>
                Traitement automatique des bulles de manga
              </Typography>
              <Box
                component="form"
                onSubmit={e => { e.preventDefault(); handleProcessAll(); }}
                sx={{ mt: 3, mb: 2 }}
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
                    borderRadius: 2,
                    transition: 'border 0.2s',
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
                  <CloudUploadIcon sx={{ fontSize: 44, color: '#7c3aed', mb: 1 }} />
                  <Typography variant="body1" color="textSecondary">
                    Glissez-déposez une ou plusieurs images ou cliquez pour sélectionner des fichiers
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
                  fullWidth
                  size="large"
                  disabled={files.length === 0 || processing}
                  startIcon={<CloudUploadIcon />}
                  sx={{ mb: 2, borderRadius: 2, fontWeight: 600, fontSize: 18, py: 1.2 }}
                >
                  {processing ? <CircularProgress size={24} color="inherit" /> : `Traiter ${files.length > 1 ? 'les images' : "l'image"}`}
                </Button>
              </Box>
              {globalError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{globalError}</Alert>
              )}
              {images.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: 2,
                      '@media (max-width:1200px)': { gridTemplateColumns: 'repeat(3, 1fr)' },
                      '@media (max-width:900px)': { gridTemplateColumns: 'repeat(2, 1fr)' },
                      '@media (max-width:600px)': { gridTemplateColumns: 'repeat(1, 1fr)' },
                    }}
                  >
                    {images.map((img, idx) => (
                      <Box key={idx} sx={{ textAlign: 'center', mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 0.5, fontSize: 14 }}>
                          {img.file.name}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 1, fontSize: 13 }}>
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
                            <Box
                              component="img"
                              src={img.result.url}
                              alt="Image traitée"
                              sx={{
                                width: 200,
                                height: 300,
                                objectFit: 'contain',
                                borderRadius: 0,
                                boxShadow: 4,
                                border: '2px solid #a78bfa',
                                cursor: 'pointer',
                                transition: 'transform 0.15s',
                                '&:hover': { transform: 'scale(1.04)' },
                                display: 'block',
                                mx: 'auto',
                              }}
                              onClick={() => handleOpenDialog(img)}
                            />
                            <Button
                              variant="outlined"
                              color="primary"
                              startIcon={<DownloadIcon />}
                              sx={{ mt: 1, borderRadius: 2, fontWeight: 600, fontSize: 13, px: 2, py: 0.7, display: 'block', mx: 'auto' }}
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
          <DialogContent sx={{ position: 'relative', p: 0, bgcolor: '#111827' }}>
            <IconButton
              aria-label="fermer"
              onClick={handleCloseDialog}
              sx={{ position: 'absolute', top: 8, right: 8, color: '#fff', zIndex: 2 }}
            >
              <CloseIcon />
            </IconButton>
            {dialogImg && dialogImg.result && (
              <Box sx={{ width: '100%', textAlign: 'center', bgcolor: '#111827', py: 2 }}>
                <Box
                  component="img"
                  src={dialogImg.result.url}
                  alt="Aperçu"
                  sx={{
                    maxWidth: '90vw',
                    maxHeight: '85vh',
                    borderRadius: 0,
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