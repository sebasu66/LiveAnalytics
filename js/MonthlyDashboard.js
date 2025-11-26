export class MonthlyDashboard {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.debugExpanded = false;

        if (!this.container) {
            console.error(`Monthly dashboard container '${containerId}' not found`);
        }
    }

    render(result) {
        if (!this.container) return;

        if (!result.success) {
            this.renderError(result.error, result.debug);
            return;
        }

        const data = result.data;

        this.container.innerHTML = `
            <div class="monthly-header">
                <h2>📊 Monthly Sales Dashboard</h2>
                <div class="monthly-period">
                    ${data.period.start} to ${data.period.today}
                    <span class="data-source-badge">${data.period.dataSource}</span>
                </div>
            </div>

            <div class="monthly-metrics">
                <div class="metric-card">
                    <div class="metric-label">Total Revenue</div>
                    <div class="metric-value">$${data.metrics.totalRevenue.toLocaleString()}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Orders</div>
                    <div class="metric-value">${data.metrics.totalOrders}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Avg Order Value</div>
                    <div class="metric-value">$${data.metrics.avgOrderValue}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Conversion Rate</div>
                    <div class="metric-value">${data.metrics.overallConversionRate}%</div>
                </div>
            </div>

            <div class="monthly-products">
                <div class="product-section">
                    <h3>🏆 Top 10 Selling Products</h3>
                    ${this.renderProductTable(data.topProducts)}
                </div>
                <div class="product-section">
                    <h3>⚠️ Worst 10 Performing Products</h3>
                    ${this.renderProductTable(data.worstProducts)}
                </div>
            </div>

            <div class="debug-console">
                <div class="debug-header" onclick="window.monthlyDashboard.toggleDebug()">
                    <span>🔍 Debug Console</span>
                    <span class="debug-toggle">${this.debugExpanded ? '▼' : '▶'}</span>
                </div>
                <div class="debug-content" style="display: ${this.debugExpanded ? 'block' : 'none'}">
                    ${this.renderDebugInfo(data.debug)}
                </div>
            </div>
        `;

        // Store reference for toggle function
        window.monthlyDashboard = this;
    }

    renderProductTable(products) {
        if (!products || products.length === 0) {
            return '<div class="no-data">No product data available</div>';
        }

        return `
            <table class="product-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Revenue</th>
                        <th>Units</th>
                        <th>Conv. Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map(p => `
                        <tr>
                            <td class="product-name">${p.name}</td>
                            <td>$${p.revenue.toLocaleString()}</td>
                            <td>${p.units}</td>
                            <td>${p.overallConversionRate}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderDebugInfo(debug) {
        if (!debug) return '<div class="debug-empty">No debug information available</div>';

        return `
            <div class="debug-section">
                <h4>📅 Date Range</h4>
                <pre>${JSON.stringify(debug.dateRange, null, 2)}</pre>
            </div>

            <div class="debug-section">
                <h4>🔌 Data Sources</h4>
                ${debug.dataSources.map(ds => `
                    <div class="debug-source ${ds.status}">
                        <strong>${ds.source}</strong>: ${ds.status}
                        ${ds.rowCount !== undefined ? `(${ds.rowCount} rows)` : ''}
                        ${ds.error ? `<br><span class="error-text">Error: ${ds.error}</span>` : ''}
                    </div>
                `).join('')}
            </div>

            ${debug.bigQueryQuery ? `
                <div class="debug-section">
                    <h4>📝 BigQuery Query</h4>
                    <pre class="sql-query">${debug.bigQueryQuery}</pre>
                </div>
            ` : ''}

            <div class="debug-section">
                <h4>🧮 Calculations</h4>
                ${debug.calculations.map(calc => `<div class="debug-calc">✓ ${calc}</div>`).join('')}
            </div>

            ${debug.errors.length > 0 ? `
                <div class="debug-section">
                    <h4>⚠️ Errors</h4>
                    ${debug.errors.map(err => `<div class="debug-error">${err}</div>`).join('')}
                </div>
            ` : ''}

            <div class="debug-section">
                <h4>⏰ Timestamp</h4>
                <div>${new Date(debug.timestamp).toLocaleString()}</div>
            </div>
        `;
    }

    renderError(error, debug) {
        this.container.innerHTML = `
            <div class="monthly-error">
                <div class="error-icon">⚠️</div>
                <h3>Monthly Dashboard Error</h3>
                <p>${error}</p>
                ${debug ? `
                    <div class="debug-console">
                        <div class="debug-header" onclick="window.monthlyDashboard.toggleDebug()">
                            <span>🔍 Debug Console</span>
                            <span class="debug-toggle">▶</span>
                        </div>
                        <div class="debug-content" style="display: none">
                            ${this.renderDebugInfo(debug)}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        window.monthlyDashboard = this;
    }

    toggleDebug() {
        this.debugExpanded = !this.debugExpanded;
        const content = this.container.querySelector('.debug-content');
        const toggle = this.container.querySelector('.debug-toggle');

        if (content) {
            content.style.display = this.debugExpanded ? 'block' : 'none';
        }
        if (toggle) {
            toggle.textContent = this.debugExpanded ? '▼' : '▶';
        }
    }
}
