export class FunnelPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Funnel panel container '${containerId}' not found`);
        }
    }

    render(funnelData) {
        if (!this.container) return;

        // If data is not available, show error message
        if (!funnelData.dataAvailable) {
            this.container.innerHTML = `
                <div class="funnel-error">
                    <div class="error-icon">⚠️</div>
                    <h3>E-commerce Data Not Available</h3>
                    <p>${funnelData.errorMessage || 'Unable to fetch e-commerce funnel data.'}</p>
                    <p class="error-detail">Please ensure your GA4 property has e-commerce tracking enabled with the following events:</p>
                    <ul class="error-list">
                        <li><code>view_item</code> - Product views</li>
                        <li><code>add_to_cart</code> - Cart additions</li>
                        <li><code>purchase</code> - Completed purchases</li>
                    </ul>
                </div>
            `;
            return;
        }

        // Render funnel with real data
        const { viewedProducts, cartProducts, purchasedProducts, metrics } = funnelData;

        this.container.innerHTML = `
            <div class="funnel-header">
                <h2>🛒 E-commerce Funnel</h2>
                <div class="funnel-subtitle">Real-time product journey</div>
            </div>

            <div class="funnel-metrics">
                <div class="funnel-stage">
                    <div class="stage-label">Product Views</div>
                    <div class="stage-count">${metrics.totalViews}</div>
                    <div class="stage-bar" style="width: 100%; background: #4285F4;"></div>
                </div>
                <div class="funnel-arrow">↓ ${metrics.viewToCartRate}%</div>
                <div class="funnel-stage">
                    <div class="stage-label">Add to Cart</div>
                    <div class="stage-count">${metrics.totalCarts}</div>
                    <div class="stage-bar" style="width: ${metrics.viewToCartRate}%; background: #FBBC05;"></div>
                </div>
                <div class="funnel-arrow">↓ ${metrics.cartToPurchaseRate}%</div>
                <div class="funnel-stage">
                    <div class="stage-label">Purchases</div>
                    <div class="stage-count">${metrics.totalPurchases}</div>
                    <div class="stage-bar" style="width: ${metrics.overallConversionRate}%; background: #00C853;"></div>
                </div>
            </div>

            <div class="funnel-conversion">
                <strong>Overall Conversion Rate:</strong> ${metrics.overallConversionRate}%
            </div>

            <div class="funnel-products">
                <div class="product-column">
                    <h3>Top Viewed Products</h3>
                    ${this.renderProductList(viewedProducts, 'No product views recorded')}
                </div>
                <div class="product-column">
                    <h3>Top Cart Additions</h3>
                    ${this.renderProductList(cartProducts, 'No cart additions recorded')}
                </div>
                <div class="product-column">
                    <h3>Top Purchases</h3>
                    ${this.renderProductList(purchasedProducts, 'No purchases recorded')}
                </div>
            </div>
        `;
    }

    renderProductList(products, emptyMessage) {
        if (!products || products.length === 0) {
            return `<div class="product-empty">${emptyMessage}</div>`;
        }

        return `
            <ol class="product-list">
                ${products.map(p => `
                    <li class="product-item">
                        <span class="product-name">${p.name}</span>
                        <span class="product-count">${p.count}</span>
                    </li>
                `).join('')}
            </ol>
        `;
    }
}
