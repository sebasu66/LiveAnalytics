export class MetricsTracker {
    constructor() {
        this.monthlyMetrics = {
            revenue: 0,
            orders: 0,
            conversionRate: 0,
            startTime: Date.now()
        };

        this.realtimeMetrics = {
            revenue: 0,
            orders: 0,
            conversionRate: 0,
            sessionStart: Date.now()
        };
    }

    updateMonthlyMetrics(data) {
        if (data && data.metrics) {
            this.monthlyMetrics.revenue = data.metrics.totalRevenue || 0;
            this.monthlyMetrics.orders = data.metrics.totalOrders || 0;
            this.monthlyMetrics.conversionRate = data.metrics.overallConversionRate || 0;
        }
    }

    updateRealtimeMetrics(activeUsers, conversions) {
        // Calculate real-time metrics since session started
        this.realtimeMetrics.orders = conversions;
        if (activeUsers > 0) {
            this.realtimeMetrics.conversionRate = ((conversions / activeUsers) * 100).toFixed(2);
        }
    }

    getMonthlyMetrics() {
        return {
            ...this.monthlyMetrics,
            label: 'Monthly (Historical)'
        };
    }

    getRealtimeMetrics() {
        const sessionDuration = (Date.now() - this.realtimeMetrics.sessionStart) / 1000 / 60; // minutes
        return {
            ...this.realtimeMetrics,
            sessionDuration: sessionDuration.toFixed(1),
            label: 'Real-time (Current Session)'
        };
    }

    getComparisonData() {
        return {
            monthly: this.getMonthlyMetrics(),
            realtime: this.getRealtimeMetrics()
        };
    }
}
