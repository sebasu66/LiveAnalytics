import { COLORS } from './Config.js';

export class Node {
    constructor(config) {
        this.id = config.id;
        this.x = config.x;
        this.y = config.y;
        this.label = config.label;
        this.type = config.type;
        this.baseColor = config.color || COLORS.node;
        this.radius = this.type === 'source' ? 20 : 40;
        this.pulse = 0;

        // Stats
        this.visits = 0;
        this.dropoffs = 0;

        // Sub-details for Zoom Level 3
        this.topProducts = [];
        this.issues = ['Slow Load', '404 Error'];
    }

    draw(ctx, zoom) {
        // LOD 1: Basic Shape
        ctx.shadowBlur = 20 * zoom;
        ctx.shadowColor = this.baseColor;

        ctx.beginPath();
        if (this.type === 'step') {
            // Square for Pages
            const size = 30; // Smaller square
            ctx.rect(this.x - size / 2, this.y - size / 2, size, size);
        } else {
            // Circle for Sources
            ctx.arc(this.x, this.y, this.radius + Math.sin(this.pulse) * 3, 0, Math.PI * 2);
        }
        ctx.fillStyle = this.baseColor;
        ctx.fill();
        ctx.shadowBlur = 0;

        // LOD 2: Labels & Basic Stats (Zoom > 0.5)
        if (zoom > 0.5) {
            ctx.fillStyle = COLORS.nodeText;
            ctx.font = '16px Inter';
            ctx.textAlign = 'center';

            // Adjust label position for squares
            const offset = this.type === 'step' ? 25 : this.radius + 30;

            // Show FULL label if zoomed in, otherwise truncate
            let labelText = this.label;
            if (zoom < 1.0 && labelText.length > 20) {
                labelText = labelText.substring(0, 17) + '...';
            }

            ctx.fillText(labelText, this.x, this.y + offset);

            if (this.type === 'step') {
                // Count INSIDE the node
                ctx.fillStyle = '#000'; // Black text for contrast
                ctx.font = 'bold 12px Inter';
                ctx.fillText(this.visits, this.x, this.y + 4);
            }
        }

        // LOD 3: Deep Details (Zoom > 1.5)
        if (zoom > 1.5 && this.type === 'step') {
            // Draw a "detail box" floating near the node
            ctx.fillStyle = 'rgba(20, 22, 30, 0.9)';
            ctx.strokeStyle = this.baseColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(this.x + 60, this.y - 40, 160, 100, 8); // Larger box
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.font = '12px Inter';
            ctx.fillText('Page Details:', this.x + 70, this.y - 20);

            // Full Title
            ctx.fillStyle = '#ccc';
            ctx.fillText(this.label, this.x + 70, this.y);

            // Link Indicator
            ctx.fillStyle = '#448AFF';
            ctx.font = 'italic 11px Inter';
            ctx.fillText('🔗 Visit Page', this.x + 70, this.y + 20);

            // Stats
            ctx.fillStyle = '#aaa';
            ctx.font = '11px Inter';
            ctx.fillText(`Drop-offs: ${this.dropoffs}`, this.x + 70, this.y + 40);
        }

        this.pulse += 0.05;
    }

    isHovered(mx, my) {
        const dx = mx - this.x;
        const dy = my - this.y;
        // Simple hit detection
        return Math.sqrt(dx * dx + dy * dy) < (this.type === 'source' ? this.radius + 10 : 30);
    }
}
