const PROPERTY_ID = '407838284';

export class MonthlyDataService {
    constructor() {
        this.monthlyData = null;
        this.lastFetch = null;
    }

    async fetchMonthlyData() {
        try {
            const res = await fetch(`http://localhost:3000/api/monthly-dashboard?propertyId=${PROPERTY_ID}`);
            const data = await res.json();

            if (data.error) {
                console.error('Monthly dashboard error:', data.error);
                console.log('Debug info:', data.debug);
                return {
                    success: false,
                    error: data.error,
                    debug: data.debug
                };
            }

            this.monthlyData = data;
            this.lastFetch = new Date();

            console.log('Monthly data fetched successfully');
            console.log('Data source:', data.period.dataSource);
            console.log('Debug log:', data.debug);

            return {
                success: true,
                data: data
            };

        } catch (e) {
            console.error('Failed to fetch monthly data', e);
            return {
                success: false,
                error: e.message,
                debug: null
            };
        }
    }

    getMonthlyData() {
        return this.monthlyData;
    }
}
