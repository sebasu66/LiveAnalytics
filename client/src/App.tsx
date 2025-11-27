import { useState, useEffect } from 'react';
import './App.css';
import { KeyUpload } from './components/KeyUpload';
import { PropertySelector } from './components/PropertySelector';
import { SankeyCanvas } from './components/SankeyCanvas';
import axios from 'axios';

interface AuthData {
  token: string;
  projectId: string;
  bqDatasets: { id: string; location: string }[];
  ga4Properties: { id: string; displayName: string; parent: string }[];
  debugConfig?: {
    defaultPropertyId: string;
    defaultDataset: string;
  };
}

interface GraphData {
  nodes: Array<{ id: string; type: string; label: string; value: number }>;
  edges: Array<{ source: string; target: string; value: number }>;
}

type AppStep = 'upload' | 'select' | 'dashboard';

function App() {
  const [step, setStep] = useState<AppStep>('upload');
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // Check for debug mode on mount
  useEffect(() => {
    const checkDebugMode = async () => {
      try {
        const response = await axios.get('/api/debug-auto-login');
        if (response.data.status === 'ok') {
          console.log('🔧 Debug mode enabled - auto-loading credentials');
          setDebugMode(true);
          setAuthData(response.data);

          // Auto-select default property and dataset if configured
          if (response.data.debugConfig?.defaultPropertyId) {
            setSelectedProperty(response.data.debugConfig.defaultPropertyId);
          }
          if (response.data.debugConfig?.defaultDataset) {
            setSelectedDataset(response.data.debugConfig.defaultDataset);
          }

          setStep('select');
        }
      } catch (error) {
        // Debug mode not enabled or failed - show normal upload screen
        console.log('Debug mode not available, showing upload screen');
      }
    };

    checkDebugMode();
  }, []);

  const handleUploadSuccess = (data: AuthData) => {
    console.log("Upload success:", data);
    setAuthData(data);
    setStep('select');
  };

  const handlePropertySelect = async (propertyId: string, datasetId: string) => {
    setSelectedProperty(propertyId);
    setSelectedDataset(datasetId);
    setStep('dashboard');
    setLoading(true);

    try {
      // Calculate date range (last 30 days)
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1); // Yesterday
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const response = await axios.post('/api/start-historical-job', {
        token: authData?.token,
        propertyId: propertyId,
        datasetId: datasetId,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });

      if (response.data.status === 'completed') {
        setGraphData(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to load historical data:', error);
      alert('Failed to load data: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setAuthData(null);
    setSelectedProperty('');
    setSelectedDataset('');
    setGraphData(null);
  };

  // Get property name from authData
  const getPropertyName = () => {
    if (!authData || !selectedProperty) return 'Propiedad Desconocida';
    const property = authData.ga4Properties.find(p => p.id === selectedProperty);
    return property?.displayName || 'Propiedad Desconocida';
  };

  // Auto-trigger job if debug mode is on and defaults are set
  useEffect(() => {
    if (debugMode && authData?.debugConfig && step === 'select') {
      const { defaultPropertyId, defaultDataset } = authData.debugConfig;
      if (defaultPropertyId && defaultDataset) {
        console.log('🔧 Debug Mode: Auto-starting historical job...');
        handlePropertySelect(defaultPropertyId, defaultDataset);
      }
    }
  }, [debugMode, authData, step]);

  return (
    <div className="app-container">
      {step === 'upload' && (
        <KeyUpload onUploadSuccess={handleUploadSuccess} />
      )}

      {step === 'select' && authData && (
        <PropertySelector
          properties={authData.ga4Properties}
          datasets={authData.bqDatasets}
          onSelect={handlePropertySelect}
        />
      )}

      {step === 'dashboard' && (
        <>
          <div className="dashboard-header">
            <h1>Navigation Flow Visualizer</h1>
            <div className="header-info">
              {debugMode && <span className="debug-badge">🔧 DEBUG MODE</span>}
              <span>Property: {selectedProperty}</span>
              <span>Dataset: {selectedDataset}</span>
              <button className="reset-btn-header" onClick={handleReset}>
                Change Source
              </button>
            </div>
          </div>
          <SankeyCanvas
            data={graphData}
            loading={loading}
            propertyName={getPropertyName()}
          />
        </>
      )}
    </div>
  );
}

export default App;

