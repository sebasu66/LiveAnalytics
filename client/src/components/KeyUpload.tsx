import React, { useState } from 'react';
import axios from 'axios';
import './KeyUpload.css';

interface UploadResponse {
    status: string;
    token: string;
    projectId: string;
    bqDatasets: { id: string; location: string }[];
    ga4Properties: { id: string; displayName: string; parent: string }[];
    message: string;
}

interface KeyUploadProps {
    onUploadSuccess: (data: UploadResponse) => void;
}

export const KeyUpload: React.FC<KeyUploadProps> = ({ onUploadSuccess }) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setUploadResponse(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError("Please select a service account JSON file.");
            return;
        }

        setLoading(true);
        setError(null);
        setUploadResponse(null);

        const formData = new FormData();
        formData.append('keyFile', file);

        try {
            const response = await axios.post<UploadResponse>('/api/upload-key', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            console.log('Upload response:', response.data);
            setUploadResponse(response.data);

            // Wait a moment to show success, then proceed
            setTimeout(() => {
                onUploadSuccess(response.data);
            }, 1500);

        } catch (err: any) {
            console.error('Upload error:', err);
            const errorMsg = err.response?.data?.error || err.message || "Upload failed. Please check the file and try again.";
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="key-upload-container">
            <div className="key-upload-card">
                <h2>Connect Your Data</h2>
                <p className="subtitle">Upload your Google Service Account Key (JSON) to access BigQuery and GA4 data.</p>

                <div className="permissions-box">
                    <h3>Required Permissions</h3>
                    <ul>
                        <li>✅ BigQuery Data Viewer</li>
                        <li>✅ BigQuery Job User</li>
                        <li>✅ Google Analytics Viewer</li>
                    </ul>
                </div>

                <div className="upload-area">
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        id="file-upload"
                        className="file-input"
                    />
                    <label htmlFor="file-upload" className="file-label">
                        {file ? file.name : "Select JSON Key File"}
                    </label>
                </div>

                {uploadResponse && (
                    <div className="success-message">
                        ✅ Found {uploadResponse.ga4Properties.length} GA4 properties and {uploadResponse.bqDatasets.length} BigQuery datasets!
                    </div>
                )}

                {error && <div className="error-message">{error}</div>}

                <button
                    className="upload-btn"
                    onClick={handleUpload}
                    disabled={!file || loading}
                >
                    {loading ? "Validating..." : "Connect & Validate"}
                </button>

                <p className="security-note">
                    🔒 Your key is encrypted in memory and discarded after 1 hour. It is never stored permanently on disk.
                </p>
            </div>
        </div>
    );
};
