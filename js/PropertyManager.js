export class PropertyManager {
    constructor() {
        this.properties = [];
        this.currentProperty = null;
        this.onPropertyChange = null; // Callback function
    }

    async loadProperties() {
        try {
            const response = await fetch('/api/properties');
            const data = await response.json();
            this.properties = data.properties || [];

            // Load saved property from localStorage or use first enabled property
            const savedPropertyId = localStorage.getItem('selectedPropertyId');
            if (savedPropertyId) {
                this.currentProperty = this.properties.find(p => p.id === savedPropertyId);
            }

            if (!this.currentProperty && this.properties.length > 0) {
                this.currentProperty = this.properties.find(p => p.enabled) || this.properties[0];
            }

            return this.properties;
        } catch (error) {
            console.error('Error loading properties:', error);
            return [];
        }
    }

    selectProperty(propertyId) {
        const property = this.properties.find(p => p.id === propertyId);
        if (!property) {
            console.error(`Property ${propertyId} not found`);
            return false;
        }

        this.currentProperty = property;
        localStorage.setItem('selectedPropertyId', propertyId);

        // Trigger callback if set
        if (this.onPropertyChange) {
            this.onPropertyChange(property);
        }

        return true;
    }

    getCurrentProperty() {
        return this.currentProperty;
    }

    getProperties() {
        return this.properties;
    }
}
