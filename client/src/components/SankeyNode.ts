import * as THREE from 'three';

/**
 * Zoom levels for the Sankey diagram
 * Level 1: Grouped view (e.g., "Ad Campaigns", "Social Media", "Organic")
 * Level 2: Individual sources (e.g., "Google Ads", "Facebook", "Instagram")
 * Level 3: Detailed view with metrics and sub-categories
 */
export const ZoomLevel = {
    GROUPED: 1,
    INDIVIDUAL: 2,
    DETAILED: 3
} as const;

export type ZoomLevel = typeof ZoomLevel[keyof typeof ZoomLevel];

/**
 * Node types in the user journey
 */
export const NodeType = {
    SOURCE_GROUP: 'source_group',      // Grouped traffic sources
    SOURCE: 'source',                  // Individual traffic source
    ENTRY_POINT: 'entry_point',        // Website entry points
    PAGE: 'page',                      // Individual pages
    CHECKOUT: 'checkout',              // Checkout steps
    CONVERSION: 'conversion',          // Purchase/conversion
    BOUNCE: 'bounce'                   // Bounce/exit points
} as const;

export type NodeType = typeof NodeType[keyof typeof NodeType];

/**
 * Metadata for a node at different zoom levels
 */
export interface NodeMetadata {
    // Basic info
    id: string;
    type: NodeType;
    label: string;
    layer: number; // Horizontal position (0 = sources, 1 = entry, 2 = pages, etc.)

    // Metrics
    sessions: number;
    users?: number;
    revenue?: number;
    bounceRate?: number;
    conversionRate?: number;

    // Hierarchical structure
    parentId?: string;           // For grouped nodes
    children?: NodeMetadata[];   // Child nodes for drill-down
    groupId?: string;            // Which group this belongs to

    // Visual properties
    color?: string;
    size?: number;

    // Additional data for detailed view
    detailedMetrics?: {
        avgSessionDuration?: number;
        pageViews?: number;
        transactions?: number;
        itemsSold?: number;
        [key: string]: any;
    };
}

/**
 * Display configuration for a node at a specific zoom level
 */
interface NodeDisplayConfig {
    visible: boolean;
    label: string;
    sublabel?: string;
    size: number;
    opacity: number;
    showMetrics: boolean;
    metricsToShow?: string[];
}

/**
 * Smart Sankey Node that adapts to zoom levels
 */
export class SankeyNode {
    public metadata: NodeMetadata;
    public mesh: THREE.Mesh | null = null;
    public position: THREE.Vector3;
    public currentZoomLevel: ZoomLevel = ZoomLevel.GROUPED;

    // Visual state
    private targetSize: number = 1;
    private currentSize: number = 1;
    private targetOpacity: number = 1;
    private currentOpacity: number = 1;

    // Animation
    private pulsePhase: number = 0;
    private isHovered: boolean = false;

    constructor(metadata: NodeMetadata, position: THREE.Vector3) {
        this.metadata = metadata;
        this.position = position.clone();
    }

    /**
     * Determine which zoom level based on camera distance
     */
    public static getZoomLevelFromDistance(distance: number): ZoomLevel {
        if (distance > 40) return ZoomLevel.GROUPED;
        if (distance > 20) return ZoomLevel.INDIVIDUAL;
        return ZoomLevel.DETAILED;
    }

    /**
     * Check if this node should be visible at the current zoom level
     */
    public isVisibleAtZoom(zoomLevel: ZoomLevel): boolean {
        switch (zoomLevel) {
            case ZoomLevel.GROUPED:
                // Only show group nodes or top-level nodes
                return this.metadata.type === NodeType.SOURCE_GROUP || !this.metadata.parentId;

            case ZoomLevel.INDIVIDUAL:
                // Show individual sources, hide groups
                return this.metadata.type !== NodeType.SOURCE_GROUP;

            case ZoomLevel.DETAILED:
                // Show everything including children
                return true;

            default:
                return true;
        }
    }

    /**
     * Get display configuration for current zoom level
     */
    public getDisplayConfig(zoomLevel: ZoomLevel): NodeDisplayConfig {
        const baseSize = Math.log10(this.metadata.sessions + 10) * 0.5;

        switch (zoomLevel) {
            case ZoomLevel.GROUPED:
                return {
                    visible: this.isVisibleAtZoom(zoomLevel),
                    label: this.getGroupedLabel(),
                    size: baseSize * 2,
                    opacity: 0.7,
                    showMetrics: false
                };

            case ZoomLevel.INDIVIDUAL:
                return {
                    visible: this.isVisibleAtZoom(zoomLevel),
                    label: this.metadata.label,
                    sublabel: `${this.metadata.sessions} sessions`,
                    size: baseSize * 1.5,
                    opacity: 0.8,
                    showMetrics: true,
                    metricsToShow: ['sessions', 'bounceRate']
                };

            case ZoomLevel.DETAILED:
                return {
                    visible: this.isVisibleAtZoom(zoomLevel),
                    label: this.metadata.label,
                    sublabel: this.getDetailedSublabel(),
                    size: baseSize,
                    opacity: 0.9,
                    showMetrics: true,
                    metricsToShow: ['sessions', 'users', 'revenue', 'bounceRate', 'conversionRate']
                };

            default:
                return {
                    visible: true,
                    label: this.metadata.label,
                    size: baseSize,
                    opacity: 0.8,
                    showMetrics: false
                };
        }
    }

    /**
     * Get grouped label (for zoom level 1)
     */
    private getGroupedLabel(): string {
        if (this.metadata.type === NodeType.SOURCE_GROUP) {
            return this.metadata.label;
        }

        // Aggregate label based on group
        if (this.metadata.groupId) {
            return this.metadata.groupId;
        }

        return this.metadata.label;
    }

    /**
     * Get detailed sublabel (for zoom level 3)
     */
    private getDetailedSublabel(): string {
        const parts: string[] = [];

        if (this.metadata.users) {
            parts.push(`${this.metadata.users} users`);
        }
        if (this.metadata.revenue) {
            parts.push(`$${this.metadata.revenue.toFixed(2)}`);
        }
        if (this.metadata.conversionRate) {
            parts.push(`${(this.metadata.conversionRate * 100).toFixed(1)}% conv`);
        }

        return parts.join(' • ');
    }

    /**
     * Update zoom level and adjust display
     */
    public updateZoomLevel(newZoomLevel: ZoomLevel): void {
        if (this.currentZoomLevel === newZoomLevel) return;

        this.currentZoomLevel = newZoomLevel;
        const config = this.getDisplayConfig(newZoomLevel);

        this.targetSize = config.size;
        this.targetOpacity = config.visible ? config.opacity : 0;
    }

    /**
     * Create or update the Three.js mesh for this node
     */
    public createMesh(scene: THREE.Scene): THREE.Mesh {
        if (this.mesh) {
            scene.remove(this.mesh);
        }

        const config = this.getDisplayConfig(this.currentZoomLevel);
        const geometry = this.getGeometryForType();
        const material = new THREE.MeshStandardMaterial({
            color: this.getColorForType(),
            transparent: true,
            opacity: config.opacity,
            emissive: this.getColorForType(),
            emissiveIntensity: 0.2,
            metalness: 0.3,
            roughness: 0.7
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.scale.setScalar(config.size);
        this.mesh.userData = { nodeId: this.metadata.id, node: this };

        scene.add(this.mesh);
        return this.mesh;
    }

    /**
     * Get geometry based on node type
     */
    private getGeometryForType(): THREE.BufferGeometry {
        switch (this.metadata.type) {
            case NodeType.SOURCE_GROUP:
            case NodeType.SOURCE:
                return new THREE.SphereGeometry(1, 16, 16);

            case NodeType.ENTRY_POINT:
            case NodeType.PAGE:
                return new THREE.BoxGeometry(1, 1, 1);

            case NodeType.CHECKOUT:
                return new THREE.CylinderGeometry(0.8, 0.8, 1, 8);

            case NodeType.CONVERSION:
                return new THREE.OctahedronGeometry(1);

            case NodeType.BOUNCE:
                return new THREE.TetrahedronGeometry(1);

            default:
                return new THREE.SphereGeometry(1, 16, 16);
        }
    }

    /**
     * Get color based on node type
     */
    private getColorForType(): number {
        switch (this.metadata.type) {
            case NodeType.SOURCE_GROUP:
            case NodeType.SOURCE:
                return 0x4facfe; // Blue

            case NodeType.ENTRY_POINT:
                return 0x00f2fe; // Cyan

            case NodeType.PAGE:
                return 0xff0080; // Pink

            case NodeType.CHECKOUT:
                return 0xffd700; // Gold

            case NodeType.CONVERSION:
                return 0x00ff88; // Green

            case NodeType.BOUNCE:
                return 0xff4444; // Red

            default:
                return 0xffffff; // White
        }
    }

    /**
     * Animate the node (called every frame)
     */
    public animate(deltaTime: number): void {
        if (!this.mesh) return;

        // Smooth size transition
        this.currentSize += (this.targetSize - this.currentSize) * 0.1;
        this.mesh.scale.setScalar(this.currentSize);

        // Smooth opacity transition
        this.currentOpacity += (this.targetOpacity - this.currentOpacity) * 0.1;
        if (this.mesh.material instanceof THREE.MeshStandardMaterial) {
            this.mesh.material.opacity = this.currentOpacity;
            this.mesh.visible = this.currentOpacity > 0.01;
        }

        // Pulse animation
        this.pulsePhase += deltaTime * 2;
        const pulse = Math.sin(this.pulsePhase) * 0.05 + 1;

        if (this.isHovered) {
            this.mesh.scale.multiplyScalar(pulse);
        }

        // Gentle rotation
        this.mesh.rotation.y += deltaTime * 0.5;
    }

    /**
     * Set hover state
     */
    public setHovered(hovered: boolean): void {
        this.isHovered = hovered;

        if (this.mesh?.material instanceof THREE.MeshStandardMaterial) {
            this.mesh.material.emissiveIntensity = hovered ? 0.5 : 0.2;
        }
    }

    /**
     * Get formatted metrics for display
     */
    public getFormattedMetrics(metricsToShow?: string[]): Array<{ label: string; value: string }> {
        const metrics: Array<{ label: string; value: string }> = [];
        const toShow = metricsToShow || ['sessions'];

        if (toShow.includes('sessions')) {
            metrics.push({ label: 'Sessions', value: this.metadata.sessions.toLocaleString() });
        }
        if (toShow.includes('users') && this.metadata.users) {
            metrics.push({ label: 'Users', value: this.metadata.users.toLocaleString() });
        }
        if (toShow.includes('revenue') && this.metadata.revenue) {
            metrics.push({ label: 'Revenue', value: `$${this.metadata.revenue.toFixed(2)}` });
        }
        if (toShow.includes('bounceRate') && this.metadata.bounceRate !== undefined) {
            metrics.push({ label: 'Bounce Rate', value: `${(this.metadata.bounceRate * 100).toFixed(1)}%` });
        }
        if (toShow.includes('conversionRate') && this.metadata.conversionRate !== undefined) {
            metrics.push({ label: 'Conversion', value: `${(this.metadata.conversionRate * 100).toFixed(1)}%` });
        }

        return metrics;
    }

    /**
     * Dispose of Three.js resources
     */
    public dispose(): void {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            if (this.mesh.material instanceof THREE.Material) {
                this.mesh.material.dispose();
            }
        }
    }
}

/**
 * Helper to create hierarchical node structure from flat data
 */
export class NodeHierarchyBuilder {
    /**
     * Group nodes by category for zoom level 1
     */
    public static buildHierarchy(flatNodes: NodeMetadata[]): NodeMetadata[] {
        const grouped = new Map<string, NodeMetadata>();
        const result: NodeMetadata[] = [];

        // First pass: create group nodes
        flatNodes.forEach(node => {
            if (node.groupId && !grouped.has(node.groupId)) {
                grouped.set(node.groupId, {
                    id: `group_${node.groupId}`,
                    type: NodeType.SOURCE_GROUP,
                    label: node.groupId,
                    layer: node.layer,
                    sessions: 0,
                    children: []
                });
            }
        });

        // Second pass: assign nodes to groups and aggregate metrics
        flatNodes.forEach(node => {
            if (node.groupId && grouped.has(node.groupId)) {
                const group = grouped.get(node.groupId)!;
                group.sessions += node.sessions;
                group.children!.push(node);

                // Set parent reference
                node.parentId = group.id;
            }
        });

        // Combine groups and ungrouped nodes
        result.push(...Array.from(grouped.values()));
        result.push(...flatNodes.filter(n => !n.groupId));

        return result;
    }

    /**
     * Categorize traffic sources into groups
     */
    public static categorizeSource(source: string, medium: string): string {
        const sourceLower = source.toLowerCase();
        const mediumLower = medium.toLowerCase();

        // Ad campaigns
        if (mediumLower.includes('cpc') || mediumLower.includes('ppc') ||
            mediumLower.includes('paid') || sourceLower.includes('ads')) {
            return 'Ad Campaigns';
        }

        // Social media
        if (mediumLower.includes('social') ||
            ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'pinterest'].some(s => sourceLower.includes(s))) {
            return 'Social Media';
        }

        // Organic search
        if (mediumLower.includes('organic') ||
            ['google', 'bing', 'yahoo', 'duckduckgo'].some(s => sourceLower.includes(s))) {
            return 'Organic Search';
        }

        // Referral
        if (mediumLower.includes('referral')) {
            return 'Referral';
        }

        // Email
        if (mediumLower.includes('email')) {
            return 'Email';
        }

        // Direct
        if (sourceLower === '(direct)' || mediumLower === '(none)') {
            return 'Direct';
        }

        return 'Other';
    }
}
