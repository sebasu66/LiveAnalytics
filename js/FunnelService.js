const PROPERTY_ID = '407838284';

export class FunnelService {
    constructor() {
        this.funnelData = {
            viewedProducts: [],
            cartProducts: [],
            purchasedProducts: [],
            metrics: {
                totalViews: 0,
                totalCarts: 0,
                totalPurchases: 0,
                viewToCartRate: 0,
                cartToPurchaseRate: 0,
                overallConversionRate: 0
            },
            dataAvailable: false,
            errorMessage: null
        };
    }

    async fetchFunnelData() {
        try {
            const res = await fetch(`http://localhost:3000/api/ecommerce-funnel?propertyId=${PROPERTY_ID}`);
            const data = await res.json();

            if (data.error) {
                this.funnelData.dataAvailable = false;
                this.funnelData.errorMessage = data.details || data.error;
                console.warn('E-commerce funnel data error:', data.error);
                if (data.details) console.warn('Details:', data.details);
                return this.funnelData;
            }

            if (!data.rows || data.rows.length === 0) {
                this.funnelData.dataAvailable = false;
                this.funnelData.errorMessage = 'No e-commerce events found in the last 30 minutes.\n\nPlease ensure:\n• E-commerce tracking is enabled in your GA4 property\n• Products have the following events: view_item, add_to_cart, purchase\n• Events include the itemName parameter\n• Recent activity has occurred (within last 30 minutes)';
                console.warn('No e-commerce funnel data available');
                return this.funnelData;
            }

            this.processFunnelData(data.rows);
            this.funnelData.dataAvailable = true;
            this.funnelData.errorMessage = null;

        } catch (e) {
            console.error('Failed to fetch e-commerce funnel data', e);
            this.funnelData.dataAvailable = false;
            this.funnelData.errorMessage = `Network error: ${e.message}`;
        }

        return this.funnelData;
    }

    processFunnelData(rows) {
        const productsByEvent = {
            view_item: {},
            add_to_cart: {},
            purchase: {}
        };

        // Aggregate counts by event and product
        rows.forEach(row => {
            const eventName = row.dimensionValues[0].value;
            const itemName = row.dimensionValues[1].value;
            const eventCount = parseInt(row.metricValues[0].value, 10);

            if (productsByEvent[eventName]) {
                productsByEvent[eventName][itemName] = (productsByEvent[eventName][itemName] || 0) + eventCount;
            }
        });

        // Sort and get top 10 for each stage
        this.funnelData.viewedProducts = this.getTopProducts(productsByEvent.view_item, 10);
        this.funnelData.cartProducts = this.getTopProducts(productsByEvent.add_to_cart, 10);
        this.funnelData.purchasedProducts = this.getTopProducts(productsByEvent.purchase, 10);

        // Calculate metrics
        this.funnelData.metrics.totalViews = this.sumCounts(productsByEvent.view_item);
        this.funnelData.metrics.totalCarts = this.sumCounts(productsByEvent.add_to_cart);
        this.funnelData.metrics.totalPurchases = this.sumCounts(productsByEvent.purchase);

        // Calculate conversion rates
        if (this.funnelData.metrics.totalViews > 0) {
            this.funnelData.metrics.viewToCartRate =
                (this.funnelData.metrics.totalCarts / this.funnelData.metrics.totalViews * 100).toFixed(2);
            this.funnelData.metrics.overallConversionRate =
                (this.funnelData.metrics.totalPurchases / this.funnelData.metrics.totalViews * 100).toFixed(2);
        }

        if (this.funnelData.metrics.totalCarts > 0) {
            this.funnelData.metrics.cartToPurchaseRate =
                (this.funnelData.metrics.totalPurchases / this.funnelData.metrics.totalCarts * 100).toFixed(2);
        }

        console.log('E-commerce funnel data processed:', this.funnelData);
    }

    getTopProducts(productMap, limit) {
        return Object.entries(productMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([name, count]) => ({ name, count }));
    }

    sumCounts(productMap) {
        return Object.values(productMap).reduce((sum, count) => sum + count, 0);
    }
}
