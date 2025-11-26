import { COLORS } from './Config.js';

export class Particle {
    constructor(sourceNode, targetNode, metadata) {
        this.source = sourceNode;
        this.target = targetNode;
        this.metadata = metadata;

        this.progress = 0;
        // SLOWER: Increased from 100-150 to 300-500 frames
        this.duration = 300 + Math.random() * 200;

        this.radius = 3;
        this.life = 1.0;
        this.dead = false;

        // Calculate Control Points for Bezier (Same as animate loop)
        this.cp1x = this.source.x + (this.target.x - this.source.x) * 0.5;
        this.cp1y = this.source.y;
        this.cp2x = this.source.x + (this.target.x - this.source.x) * 0.5;
        this.cp2y = this.target.y;

        // Initial Position
        this.x = this.source.x;
        this.y = this.source.y;
    }

    getColor() {
        // FIXED: Force Source Color - ensure metadata.source is used correctly
        // The key should match COLORS keys: 'source_google', 'source_direct', 'source_social'
        const sourceKey = this.metadata.source;

        // Map source_google -> google, source_direct -> direct, etc.
        const colorKey = sourceKey.replace('source_', '');

        return COLORS[colorKey] || COLORS.google;
    }

    update() {
        if (this.dead) return;

        this.progress += 1 / this.duration;

        if (this.progress >= 1.0) {
            this.progress = 1.0;
            this.onReachTarget();
            return;
        }

        // Cubic Bezier Interpolation
        const t = this.progress;
        const invT = 1 - t;

        this.x = Math.pow(invT, 3) * this.source.x +
            3 * Math.pow(invT, 2) * t * this.cp1x +
            3 * invT * Math.pow(t, 2) * this.cp2x +
            Math.pow(t, 3) * this.target.x;

        this.y = Math.pow(invT, 3) * this.source.y +
            3 * Math.pow(invT, 2) * t * this.cp1y +
            3 * invT * Math.pow(t, 2) * this.cp2y +
            Math.pow(t, 3) * this.target.y;
    }

    onReachTarget() {
        this.target.visits++;
        this.dead = true;
    }

    draw(ctx, zoom) {
        if (this.dead) return;

        const color = this.getColor();

        // ENHANCED: Point of Light effect
        ctx.save();

        // Use additive blending for "light" effect
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = this.life;

        // Larger, more intense glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.fillStyle = color;

        // Draw the core
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw an outer glow ring
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
