import { CONNECTIONS } from './Config.js';

export class PathRenderer {
    constructor() {
        this.monthlyData = null;
    }

    setMonthlyData(data) {
        this.monthlyData = data;
    }

    draw(ctx, nodesMap, camera) {
        ctx.lineCap = 'round';

        // Debug: Log once every 100 frames
        if (Math.random() < 0.01) {
            console.log('PathRenderer.draw called', {
                connectionsCount: Object.keys(CONNECTIONS).length,
                nodesMapKeys: Object.keys(nodesMap),
                hasMonthlyData: !!this.monthlyData
            });
        }

        // Draw connections based on CONNECTIONS config
        Object.keys(CONNECTIONS).forEach(sourceId => {
            const conn = CONNECTIONS[sourceId];
            if (!conn.target) return;

            const s = nodesMap[sourceId];
            const t = nodesMap[conn.target];

            if (s && t) {
                this.drawPath(ctx, s, t, conn, camera);
            } else if (Math.random() < 0.01) {
                console.warn('Missing nodes for connection:', sourceId, '->', conn.target, {
                    hasSource: !!s,
                    hasTarget: !!t
                });
            }
        });
    }

    drawPath(ctx, source, target, connection, camera) {
        // Base thickness on conversion rate
        const baseThickness = 2;
        const conversionMultiplier = connection.rate * 20;
        const thickness = baseThickness + conversionMultiplier;

        // Path opacity - visible and clear
        let pathOpacity = 0.5;

        // Enhance based on monthly data if available
        if (this.monthlyData && this.monthlyData.metrics) {
            const convRate = this.monthlyData.metrics.overallConversionRate;
            if (convRate > 2) {
                pathOpacity = Math.min(0.7, 0.5 + (convRate / 100));
            }
        }

        ctx.lineWidth = thickness;
        ctx.strokeStyle = `rgba(100, 255, 218, ${pathOpacity})`;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        const cp1x = source.x + (target.x - source.x) * 0.5;
        const cp1y = source.y;
        const cp2x = source.x + (target.x - source.x) * 0.5;
        const cp2y = target.y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, target.x, target.y);
        ctx.stroke();

        // Draw conversion rate label
        if (camera.zoom > 0.8) {
            this.drawConversionLabel(ctx, source, target, connection.rate);
        }
    }

    drawConversionLabel(ctx, source, target, rate) {
        const midX = source.x + (target.x - source.x) * 0.5;
        const midY = source.y + (target.y - source.y) * 0.5;

        ctx.fillStyle = 'rgba(100, 255, 218, 0.9)';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${(rate * 100).toFixed(0)}%`, midX, midY - 10);
    }
}
