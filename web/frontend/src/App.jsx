import React, { useState } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setProcessedImage(null);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("http://localhost:8000/process", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error(`Erreur HTTP: ${res.status}`);
      }
      const imageBlob = await res.blob();
      const imageUrl = URL.createObjectURL(imageBlob);
      setProcessedImage({ url: imageUrl, blob: imageBlob });
    } catch (err) {
      setError(`Erreur: ${err.message}`);
      setProcessedImage(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;
    const link = document.createElement("a");
    link.href = processedImage.url;
    link.download = "image_traitee.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: "0 auto" }}>
      <h1>Bubble Cleaner Web</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </div>
        <button type="submit" disabled={!file || loading} style={{ padding: "10px 20px", fontSize: 16 }}>
          {loading ? "Traitement en cours..." : "Traiter l'image"}
        </button>
      </form>
      {error && (
        <div style={{ color: "red", marginBottom: 20 }}>{error}</div>
      )}
      {processedImage && (
        <div>
          <h3>Image traitée :</h3>
          <img src={processedImage.url} alt="Image traitée" style={{ maxWidth: "100%", border: "1px solid #ddd", borderRadius: 5 }} />
          <div style={{ marginTop: 10 }}>
            <button onClick={handleDownload} style={{ padding: "8px 16px", fontSize: 15 }}>
              Télécharger l'image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App; 