export class SalesOverlay {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        if (!this.container) {
            console.error(`Sales overlay container '${containerId}' not found`);
        }
    }

    render(result) {
        if (!this.container) return;

        const tablesDiv = document.getElementById('salesTables');
        if (!tablesDiv) return;

        if (!result.success) {
            tablesDiv.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p style="color: var(--warning);">⚠️ ${result.error}</p>
                    <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 10px;">
                        Check the debug console in the e-commerce funnel panel for details.
                    </p>
                </div>
            `;
            return;
        }

        const data = result.data;

        tablesDiv.innerHTML = `
            <div class="sales-metrics">
                <div class="sales-metric-card">
                    <div class="sales-metric-label">Total Revenue</div>
                    <div class="sales-metric-value">$${data.metrics.totalRevenue.toLocaleString()}</div>
                </div>
                <div class="sales-metric-card">
                    <div class="sales-metric-label">Total Orders</div>
                    <div class="sales-metric-value">${data.metrics.totalOrders}</div>
                </div>
                <div class="sales-metric-card">
                    <div class="sales-metric-label">Conversion Rate</div>
                    <div class="sales-metric-value">${data.metrics.overallConversionRate}%</div>
                </div>
            </div>

            <table class="sales-table">
                <caption>🏆 Top 10 Selling Products</caption>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Revenue</th>
                        <th>Units</th>
                        <th>Conv. Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.renderProductRows(data.topProducts)}
                </tbody>
            </table>

            <table class="sales-table">
                <caption>⚠️ Worst 10 Performing Products</caption>
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Revenue</th>
                        <th>Units</th>
                        <th>Conv. Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.renderProductRows(data.worstProducts)}
                </tbody>
            </table>

            <div class="data-source-info">
                📅 ${data.period.start} to ${data.period.today} | 
                Data Source: <strong>${data.period.dataSource}</strong>
                ${data.period.hasRealtimeEnrichment ? ' + Real-time' : ''}
            </div>
        `;
    }

    renderProductRows(products) {
        if (!products || products.length === 0) {
            return '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-secondary);">No data available</td></tr>';
        }

        return products.map(p => `
            <tr>
                <td class="product-name-col">${p.name}</td>
                <td class="revenue-col">$${p.revenue.toLocaleString()}</td>
                <td>${p.units}</td>
                <td class="conversion-col">${p.overallConversionRate}%</td>
            </tr>
        `).join('');
    }
}
