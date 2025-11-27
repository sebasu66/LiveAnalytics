import * as THREE from 'three';
import { SankeyNode, type NodeMetadata, ZoomLevel, NodeHierarchyBuilder } from './SankeyNode';

/**
 * Edge/Flow between nodes
 */
export interface FlowEdge {
    source: string;
    target: string;
    value: number;
}

/**
 * Manages all Sankey nodes and their interactions
 */
export class SankeyNodeManager {
    private nodes: Map<string, SankeyNode> = new Map();
    private scene: THREE.Scene;
    private currentZoomLevel: ZoomLevel = ZoomLevel.GROUPED;
    private hierarchicalData: NodeMetadata[] = [];

    // Layout parameters
    private layerSpacing: number = 15;
    private nodeSpacing: number = 3;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /**
     * Initialize nodes from raw data
     */
    public initializeNodes(rawNodes: NodeMetadata[]): void {
        // Clear existing nodes
        this.clear();

        // Build hierarchical structure
        this.hierarchicalData = NodeHierarchyBuilder.buildHierarchy(rawNodes);

        // Calculate layout positions
        const layout = this.calculateLayout(this.hierarchicalData);

        // Create SankeyNode instances
        this.hierarchicalData.forEach((metadata) => {
            const position = layout.get(metadata.id) || new THREE.Vector3(0, 0, 0);
            const node = new SankeyNode(metadata, position);
            node.createMesh(this.scene);
            this.nodes.set(metadata.id, node);
        });

        console.log(`Initialized ${this.nodes.size} nodes`);
    }

    /**
     * Calculate layout positions for all nodes
     */
    private calculateLayout(nodes: NodeMetadata[]): Map<string, THREE.Vector3> {
        const positions = new Map<string, THREE.Vector3>();

        // Group nodes by layer
        const layers = new Map<number, NodeMetadata[]>();
        nodes.forEach(node => {
            if (!layers.has(node.layer)) {
                layers.set(node.layer, []);
            }
            layers.get(node.layer)!.push(node);
        });

        // Sort layers
        const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);

        // Position nodes in each layer
        sortedLayers.forEach((layerIndex, i) => {
            const layerNodes = layers.get(layerIndex)!;
            const x = (i - sortedLayers.length / 2) * this.layerSpacing;

            // Sort nodes by value (sessions) for better visual hierarchy
            layerNodes.sort((a, b) => b.sessions - a.sessions);

            // Calculate vertical positions
            layerNodes.forEach((node, j) => {
                const y = (j - layerNodes.length / 2) * this.nodeSpacing;
                positions.set(node.id, new THREE.Vector3(x, y, 0));
            });
        });

        return positions;
    }

    /**
     * Update zoom level based on camera distance
     */
    public updateZoomLevel(cameraDistance: number): void {
        const newZoomLevel = SankeyNode.getZoomLevelFromDistance(cameraDistance);

        if (newZoomLevel !== this.currentZoomLevel) {
            const levelNames = ['GROUPED', 'INDIVIDUAL', 'DETAILED'];
            console.log(`Zoom level changed: ${levelNames[this.currentZoomLevel - 1]} -> ${levelNames[newZoomLevel - 1]}`);
            this.currentZoomLevel = newZoomLevel;

            // Update all nodes
            this.nodes.forEach(node => {
                node.updateZoomLevel(newZoomLevel);
            });
        }
    }

    /**
     * Get visible nodes at current zoom level
     */
    public getVisibleNodes(): SankeyNode[] {
        return Array.from(this.nodes.values()).filter(node =>
            node.isVisibleAtZoom(this.currentZoomLevel)
        );
    }

    /**
     * Get all nodes
     */
    public getAllNodes(): SankeyNode[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Get node by ID
     */
    public getNode(id: string): SankeyNode | undefined {
        return this.nodes.get(id);
    }

    /**
     * Animate all nodes
     */
    public animate(deltaTime: number): void {
        this.nodes.forEach(node => {
            node.animate(deltaTime);
        });
    }

    /**
     * Raycast to find node under mouse
     */
    public raycast(raycaster: THREE.Raycaster): SankeyNode | null {
        const visibleNodes = this.getVisibleNodes();
        const meshes = visibleNodes
            .map(n => n.mesh)
            .filter(m => m !== null) as THREE.Mesh[];

        const intersects = raycaster.intersectObjects(meshes);

        if (intersects.length > 0) {
            const nodeId = intersects[0].object.userData.nodeId;
            return this.nodes.get(nodeId) || null;
        }

        return null;
    }

    /**
     * Set hover state for a node
     */
    public setHoveredNode(nodeId: string | null): void {
        this.nodes.forEach((node, id) => {
            node.setHovered(id === nodeId);
        });
    }

    /**
     * Get current zoom level
     */
    public getCurrentZoomLevel(): ZoomLevel {
        return this.currentZoomLevel;
    }

    /**
     * Clear all nodes
     */
    public clear(): void {
        this.nodes.forEach(node => {
            node.dispose();
            if (node.mesh) {
                this.scene.remove(node.mesh);
            }
        });
        this.nodes.clear();
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.clear();
    }
}

/**
 * Flow renderer for edges between nodes
 */
export class FlowRenderer {
    private scene: THREE.Scene;
    private flowLines: THREE.Line[] = [];
    private flowParticles: THREE.Mesh[] = [];
    private currentZoomLevel: ZoomLevel = ZoomLevel.GROUPED;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /**
     * Create flow lines between nodes
     */
    public createFlows(
        edges: FlowEdge[],
        nodeManager: SankeyNodeManager,
        zoomLevel: ZoomLevel
    ): void {
        // Clear existing flows
        this.clear();
        this.currentZoomLevel = zoomLevel;

        const visibleNodes = nodeManager.getVisibleNodes();
        const visibleNodeIds = new Set(visibleNodes.map(n => n.metadata.id));

        edges.forEach(edge => {
            const sourceNode = nodeManager.getNode(edge.source);
            const targetNode = nodeManager.getNode(edge.target);

            if (!sourceNode || !targetNode) return;

            // Only show flows between visible nodes
            if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
                return;
            }

            // Create flow line
            this.createFlowLine(sourceNode, targetNode, edge.value);

            // Create animated particles
            if (zoomLevel >= ZoomLevel.INDIVIDUAL) {
                this.createFlowParticles(sourceNode, targetNode, edge.value);
            }
        });
    }

    /**
     * Create a single flow line
     */
    private createFlowLine(
        sourceNode: SankeyNode,
        targetNode: SankeyNode,
        value: number
    ): void {
        const start = sourceNode.position.clone();
        const end = targetNode.position.clone();

        // Create curved path
        const midX = (start.x + end.x) / 2;
        const controlPoint1 = new THREE.Vector3(midX, start.y, 0);
        const controlPoint2 = new THREE.Vector3(midX, end.y, 0);

        // Generate curve points
        const curve = new THREE.CubicBezierCurve3(start, controlPoint1, controlPoint2, end);
        const curvePoints = curve.getPoints(50);

        // Create line geometry
        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);

        // Line width based on value
        const lineWidth = Math.log10(value + 10) * 0.5;
        const material = new THREE.LineBasicMaterial({
            color: 0x00f2fe,
            transparent: true,
            opacity: 0.3,
            linewidth: lineWidth
        });

        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        this.flowLines.push(line);
    }

    /**
     * Create animated particles along flow
     */
    private createFlowParticles(
        sourceNode: SankeyNode,
        targetNode: SankeyNode,
        value: number
    ): void {
        const particleCount = Math.min(Math.floor(value / 50), 20);

        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.2, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: 0x00f2fe,
                transparent: true,
                opacity: 0.8
            });

            const particle = new THREE.Mesh(geometry, material);

            // Store animation data
            particle.userData = {
                sourcePos: sourceNode.position.clone(),
                targetPos: targetNode.position.clone(),
                progress: Math.random(),
                speed: 0.002 + Math.random() * 0.003
            };

            this.scene.add(particle);
            this.flowParticles.push(particle);
        }
    }

    /**
     * Animate flow particles
     */
    public animate(): void {
        this.flowParticles.forEach(particle => {
            const data = particle.userData;
            data.progress += data.speed;

            if (data.progress > 1) {
                data.progress = 0;
            }

            // Interpolate position along curve
            const t = data.progress;
            const start = data.sourcePos;
            const end = data.targetPos;
            const midX = (start.x + end.x) / 2;

            // Cubic bezier interpolation
            const p0 = start;
            const p1 = new THREE.Vector3(midX, start.y, 0);
            const p2 = new THREE.Vector3(midX, end.y, 0);
            const p3 = end;

            const t2 = t * t;
            const t3 = t2 * t;
            const mt = 1 - t;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;

            particle.position.x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x;
            particle.position.y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y;
            particle.position.z = mt3 * p0.z + 3 * mt2 * t * p1.z + 3 * mt * t2 * p2.z + t3 * p3.z;
        });
    }

    /**
     * Update zoom level
     */
    public updateZoomLevel(zoomLevel: ZoomLevel, edges: FlowEdge[], nodeManager: SankeyNodeManager): void {
        if (zoomLevel !== this.currentZoomLevel) {
            this.createFlows(edges, nodeManager, zoomLevel);
        }
    }

    /**
     * Clear all flows
     */
    public clear(): void {
        this.flowLines.forEach(line => {
            line.geometry.dispose();
            if (line.material instanceof THREE.Material) {
                line.material.dispose();
            }
            this.scene.remove(line);
        });
        this.flowLines = [];

        this.flowParticles.forEach(particle => {
            particle.geometry.dispose();
            if (particle.material instanceof THREE.Material) {
                particle.material.dispose();
            }
            this.scene.remove(particle);
        });
        this.flowParticles = [];
    }

    /**
     * Dispose of all resources
     */
    public dispose(): void {
        this.clear();
    }
}
