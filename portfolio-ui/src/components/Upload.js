import { useState } from "react";
import axios from "axios";

function Upload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);

    try {
      const response = await axios.post(
        "http://localhost:8000/upload-cv",
        formData
      );
      onUploadSuccess(response.data.session_id);
    } catch (err) {
      setError("Failed to upload CV. Make sure your API is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Upload your CV</h2>
      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button onClick={handleUpload} disabled={!file || loading}>
        {loading ? "Uploading..." : "Upload"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default Upload;