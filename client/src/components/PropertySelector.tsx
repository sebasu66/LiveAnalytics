import React, { useState, useEffect } from 'react';
import './PropertySelector.css';

interface Property {
    id: string;
    displayName: string;
    parent: string;
}

interface Dataset {
    id: string;
    location: string;
}

interface PropertySelectorProps {
    properties: Property[];
    datasets: Dataset[];
    onSelect: (propertyId: string, datasetId: string) => void;
}

export const PropertySelector: React.FC<PropertySelectorProps> = ({
    properties,
    datasets,
    onSelect
}) => {
    const [selectedProperty, setSelectedProperty] = useState<string>('');
    const [selectedDataset, setSelectedDataset] = useState<string>('');

    useEffect(() => {
        if (properties.length > 0 && !selectedProperty) {
            setSelectedProperty(properties[0].id);
        }
        if (datasets.length > 0 && !selectedDataset) {
            setSelectedDataset(datasets[0].id);
        }
    }, [properties, datasets]);

    const handleContinue = () => {
        if (selectedProperty && selectedDataset) {
            onSelect(selectedProperty, selectedDataset);
        }
    };

    return (
        <div className="property-selector">
            <h2>Select Your Data Source</h2>

            <div className="selector-group">
                <label>GA4 Property</label>
                <select
                    value={selectedProperty}
                    onChange={(e) => setSelectedProperty(e.target.value)}
                    className="selector-dropdown"
                >
                    {properties.length === 0 && (
                        <option>No properties found - check Service Account permissions</option>
                    )}
                    {properties.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.displayName} ({p.id})
                        </option>
                    ))}
                </select>
            </div>

            <div className="selector-group">
                <label>BigQuery Dataset</label>
                <select
                    value={selectedDataset}
                    onChange={(e) => setSelectedDataset(e.target.value)}
                    className="selector-dropdown"
                >
                    {datasets.length === 0 && (
                        <option>No datasets found</option>
                    )}
                    {datasets.map(d => (
                        <option key={d.id} value={d.id}>
                            {d.id} ({d.location})
                        </option>
                    ))}
                </select>
            </div>

            <button
                className="continue-btn"
                onClick={handleContinue}
                disabled={!selectedProperty || !selectedDataset}
            >
                Continue to Dashboard
            </button>
        </div>
    );
};
