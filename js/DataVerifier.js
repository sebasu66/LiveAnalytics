export class DataVerifier {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.verificationData = null;
    }

    async verifyProperty(propertyId) {
        try {
            const response = await fetch(`/api/verify-property/${propertyId}`);
            this.verificationData = await response.json();
            return this.verificationData;
        } catch (error) {
            console.error('Verification error:', error);
            return { error: error.message };
        }
    }

    render(verificationData) {
        if (!this.container) return;

        if (verificationData.error) {
            this.container.innerHTML = `
                <div class="verification-error">
                    <span class="error-icon">❌</span>
                    <p>${verificationData.error}</p>
                </div>
            `;
            return;
        }

        const bq = verificationData.bigQuery;
        const ga4 = verificationData.ga4Api;

        this.container.innerHTML = `
            <div class="verification-panel">
                <h3>📊 Data Verification Report</h3>
                <div class="verification-timestamp">${new Date(verificationData.timestamp).toLocaleString()}</div>
                
                <div class="verification-section">
                    <h4>BigQuery Status</h4>
                    ${this.renderBigQueryStatus(bq)}
                </div>
                
                <div class="verification-section">
                    <h4>GA4 API Status</h4>
                    ${this.renderGA4Status(ga4)}
                </div>
                
                <div class="verification-health">
                    Overall Health: <span class="health-${verificationData.overallHealth}">${verificationData.overallHealth.toUpperCase()}</span>
                </div>
            </div>
        `;
    }

    renderBigQueryStatus(bq) {
        if (!bq.available) {
            return `<div class="status-item error">❌ ${bq.error || 'Not available'}</div>`;
        }

        return `
            <div class="status-item success">✅ Dataset: ${bq.dataset}</div>
            <div class="status-item success">✅ Tables: ${bq.tables.count} (${bq.tables.oldestDate} to ${bq.tables.newestDate})</div>
            <div class="status-detail">Project: ${bq.projectId}</div>
        `;
    }

    renderGA4Status(ga4) {
        const dataApi = ga4.dataApi;
        const realtimeApi = ga4.realtimeApi;

        return `
            <div class="status-item ${dataApi.available ? 'success' : 'error'}">
                ${dataApi.available ? '✅' : '❌'} Data API: ${dataApi.available ? `${dataApi.responseTime}ms` : dataApi.error}
            </div>
            <div class="status-item ${realtimeApi.available ? 'success' : 'error'}">
                ${realtimeApi.available ? '✅' : '❌'} Realtime API: ${realtimeApi.available ? `${realtimeApi.responseTime}ms` : realtimeApi.error}
            </div>
        `;
    }
}
