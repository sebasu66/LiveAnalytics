
import React, { useEffect, useRef, useState } from 'react';
import { NodeHierarchyBuilder, type NodeMetadata } from './SankeyNode';
import './SankeyCanvas.css';

// Updated interfaces to match new backend structure
interface DetailItem {
    key?: string;
    path?: string;
    source?: string;
    medium?: string;
    sessions: number;
}

interface Node {
    id: string;
    type: string;
    label: string;
    sessions: number;
    layer?: number;
    groupId?: string;
    details?: DetailItem[]; // Breakdown data from backend
}

interface Edge {
    source: string;
    target: string;
    value: number;
}

interface DemographicItem {
    name: string;
    value: number;
}

interface GraphData {
    nodes: Node[];
    edges: Edge[];
    dateRange?: {
        startDate: string;
        endDate: string;
    };
    demographics?: {
        age: DemographicItem[];
        gender: DemographicItem[];
        geo: DemographicItem[];
        device: DemographicItem[];
    };
    estimatedSales?: number;
}

interface SankeyCanvasProps {
    data: GraphData | null;
    loading: boolean;
    propertyName?: string; // Passed from parent for header
}

interface LayoutNode {
    id: string;
    label: string;
    x: number;
    y: number;
    radius: number;
    sessions: number;
    color: string;
    metadata: Node;
}

interface LayoutEdge {
    source: LayoutNode;
    target: LayoutNode;
    value: number;
}

export const SankeyCanvas: React.FC<SankeyCanvasProps> = ({ data, loading, propertyName }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Camera state (Visual only)
    const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

    // Interaction state
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [selectedNode, setSelectedNode] = useState<LayoutNode | null>(null);
    const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);

    const layoutNodesRef = useRef<LayoutNode[]>([]);
    const layoutEdgesRef = useRef<LayoutEdge[]>([]);
    const animationFrameRef = useRef<number | null>(null);

    // Node Colors
    const getNodeColor = (type: string): string => {
        switch (type) {
            case 'source_group': return '#4facfe'; // Blue
            case 'entry_point': return '#00f2fe'; // Cyan
            default: return '#ffffff';
        }
    };

    // Calculate Layout
    const calculateLayout = (nodes: Node[], edges: Edge[]): { nodes: LayoutNode[], edges: LayoutEdge[] } => {
        const canvas = canvasRef.current;
        if (!canvas) return { nodes: [], edges: [] };

        const width = canvas.width;
        const height = canvas.height;

        // Group by layer
        const layers = new Map<number, Node[]>();
        nodes.forEach(node => {
            const layer = node.layer || 0;
            if (!layers.has(layer)) layers.set(layer, []);
            layers.get(layer)!.push(node);
        });

        const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);
        // Add padding to sides
        const availableWidth = width * 0.7; // Use 70% of width to leave room for side panel
        const xOffset = width * 0.15;
        const layerSpacing = availableWidth / (Math.max(sortedLayers.length - 1, 1));

        const layoutNodes: LayoutNode[] = [];
        const nodeMap = new Map<string, LayoutNode>();

        sortedLayers.forEach((layerIndex, i) => {
            const layerNodes = layers.get(layerIndex)!;
            // Sort by sessions descending
            layerNodes.sort((a, b) => b.sessions - a.sessions);

            const x = xOffset + (i * layerSpacing);

            // Vertical spacing - Dynamic based on node count to prevent overlap
            // Use more height if there are many nodes
            const nodeCount = layerNodes.length;
            const minNodeSpacing = 60; // Minimum pixels between nodes
            const requiredHeight = nodeCount * minNodeSpacing;
            const availableHeight = Math.max(height * 0.8, requiredHeight);
            const startY = (height - availableHeight) / 2 + 50; // Center vertically, offset for header

            const nodeSpacing = availableHeight / (nodeCount + 1);

            layerNodes.forEach((node, j) => {
                const y = startY + ((j + 1) * nodeSpacing);
                // Size based on sessions, but clamped for clickability
                const radius = Math.max(30, Math.min(60, Math.log10(node.sessions + 1) * 12));

                const layoutNode: LayoutNode = {
                    id: node.id,
                    label: node.label,
                    x,
                    y,
                    radius,
                    sessions: node.sessions,
                    color: getNodeColor(node.type),
                    metadata: node
                };

                layoutNodes.push(layoutNode);
                nodeMap.set(node.id, layoutNode);
            });
        });

        const layoutEdges: LayoutEdge[] = edges
            .map(edge => {
                const source = nodeMap.get(edge.source);
                const target = nodeMap.get(edge.target);
                if (!source || !target) return null;
                return { source, target, value: edge.value };
            })
            .filter(e => e !== null) as LayoutEdge[];

        return { nodes: layoutNodes, edges: layoutEdges };
    };

    // Draw Function
    const draw = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        // Clear
        ctx.fillStyle = '#0f111a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(camera.x, camera.y);
        ctx.scale(camera.zoom, camera.zoom);

        // Draw Subtitle on Canvas (Fixed position in world space)
        if (data) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.font = '600 24px Inter, sans-serif';
            ctx.textAlign = 'center';
            // Position it above the first layer
            const firstLayerX = layoutNodesRef.current.length > 0 ? layoutNodesRef.current[0].x : 200;
            ctx.fillText("Adquisición de usuarios. Fuentes de Tráfico", firstLayerX + 150, 100);
        }

        // Draw Edges
        layoutEdgesRef.current.forEach(edge => {
            const { source, target, value } = edge;
            const midX = (source.x + target.x) / 2;

            ctx.beginPath();
            ctx.moveTo(source.x, source.y);
            ctx.bezierCurveTo(midX, source.y, midX, target.y, target.x, target.y);

            const lineWidth = Math.max(2, Math.log10(value + 1) * 3);
            ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        });

        // Draw Nodes
        layoutNodesRef.current.forEach(node => {
            const isSelected = selectedNode?.id === node.id;
            const isHovered = hoveredNode?.id === node.id;

            // Glow effect for selected/hovered
            if (isSelected || isHovered) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fill();
            }

            // Node Circle
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            ctx.fillStyle = node.color;
            ctx.globalAlpha = (isSelected || isHovered) ? 1 : 0.8;
            ctx.fill();

            // Border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.globalAlpha = 1;
            ctx.stroke();

            // Text: Session Count (Inside)
            ctx.fillStyle = '#0f111a'; // Dark text on bright node
            ctx.font = `bold ${Math.max(12, node.radius * 0.35)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.sessions.toLocaleString(), node.x, node.y);

            // Text: Label (Above)
            ctx.fillStyle = '#ffffff';
            ctx.font = `600 ${Math.max(14, 16 / camera.zoom)}px Inter, sans-serif`;
            ctx.fillText(node.label, node.x, node.y - node.radius - 10);
        });

        // Draw Mindmap Info Blocks (Static relative to nodes)
        if (data && layoutNodesRef.current.length > 0) {
            const totalSessions = data.nodes.reduce((sum, n) => n.layer === 0 ? sum + n.sessions : sum, 0);
            const firstNode = layoutNodesRef.current[0];

            // Info Block 1: Date Range
            if (data.dateRange) {
                drawInfoBlock(ctx, firstNode.x - 120, firstNode.y - 180,
                    'Período',
                    `${data.dateRange.startDate} - ${data.dateRange.endDate}`
                );
            }

            // Info Block 2: Total Traffic
            drawInfoBlock(ctx, firstNode.x - 120, firstNode.y - 110,
                'Tráfico Total',
                `${totalSessions.toLocaleString()} Sesiones`
            );

            // Info Block 3: Estimated Sales
            if (data.estimatedSales !== undefined) {
                drawInfoBlock(ctx, firstNode.x - 120, firstNode.y - 40,
                    'Ventas Estimadas',
                    `$${data.estimatedSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                );
            }
        }

        ctx.restore();
    };

    const drawInfoBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, title: string, value: string) => {
        ctx.fillStyle = 'rgba(20, 25, 40, 0.8)';
        ctx.strokeStyle = 'rgba(79, 172, 254, 0.3)';
        ctx.lineWidth = 1;

        // Background
        ctx.beginPath();
        ctx.roundRect(x, y, 220, 60, 8);
        ctx.fill();
        ctx.stroke();

        // Title
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(title, x + 15, y + 25);

        // Value
        ctx.fillStyle = '#4facfe';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.fillText(value, x + 15, y + 45);
    };

    // Animation Loop
    useEffect(() => {
        const animate = () => {
            draw();
            animationFrameRef.current = requestAnimationFrame(animate);
        };
        animate();
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [camera, selectedNode, hoveredNode, data]); // Added data to dependencies to re-draw info blocks

    // Data Loading & Layout
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            if (data) {
                const layout = calculateLayout(data.nodes, data.edges);
                layoutNodesRef.current = layout.nodes;
                layoutEdgesRef.current = layout.edges;
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        // Initial center
        if (data) {
            setCamera({ x: 0, y: 0, zoom: 1 });
        }

        return () => window.removeEventListener('resize', handleResize);
    }, [data]);

    // Input Handlers
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.5, Math.min(3, camera.zoom * zoomFactor));

        // Zoom towards mouse
        const rect = canvasRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - camera.x) / camera.zoom;
        const worldY = (mouseY - camera.y) / camera.zoom;

        setCamera({
            x: mouseX - worldX * newZoom,
            y: mouseY - worldY * newZoom,
            zoom: newZoom
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - camera.x) / camera.zoom;
        const worldY = (mouseY - camera.y) / camera.zoom;

        // Check node click
        let clicked: LayoutNode | null = null;
        for (const node of layoutNodesRef.current) {
            const dx = worldX - node.x;
            const dy = worldY - node.y;
            if (Math.sqrt(dx * dx + dy * dy) <= node.radius) {
                clicked = node;
                break;
            }
        }

        if (clicked) {
            setSelectedNode(clicked);
        } else {
            setIsDragging(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
            // Deselect if clicking background to show general stats
            setSelectedNode(null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (isDragging) {
            const dx = e.clientX - lastMousePos.x;
            const dy = e.clientY - lastMousePos.y;
            setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        } else {
            // Hover check
            const worldX = (mouseX - camera.x) / camera.zoom;
            const worldY = (mouseY - camera.y) / camera.zoom;
            let found: LayoutNode | null = null;
            for (const node of layoutNodesRef.current) {
                const dx = worldX - node.x;
                const dy = worldY - node.y;
                if (Math.sqrt(dx * dx + dy * dy) <= node.radius) {
                    found = node;
                    break;
                }
            }
            setHoveredNode(found);
            canvasRef.current!.style.cursor = found ? 'pointer' : (isDragging ? 'grabbing' : 'grab');
        }
    };

    // Helper to render a simple bar chart
    const renderBarChart = (items: DemographicItem[], title: string) => (
        <div className="demographic-section">
            <h3>{title}</h3>
            <div className="bar-chart">
                {items.slice(0, 5).map((item, i) => {
                    const maxVal = Math.max(...items.map(it => it.value));
                    const percent = (item.value / maxVal) * 100;
                    return (
                        <div key={i} className="chart-row">
                            <div className="row-label">{item.name || '(not set)'}</div>
                            <div className="row-bar-container">
                                <div className="row-bar" style={{ width: `${percent}%` }}></div>
                                <span className="row-value">{item.value.toLocaleString()}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="sankey-canvas-container" ref={containerRef}>
            {/* Header Bar */}
            <div className="canvas-header">
                <div className="header-left">
                    <h1>{propertyName || 'Propiedad Desconocida'}</h1>
                    <span className="header-subtitle">Mes en curso</span>

                    {/* Info blocks below "Mes en curso" */}
                    <div className="info-blocks">
                        {data?.dateRange && (
                            <div className="info-block">
                                <div className="info-label">📅 Período</div>
                                <div className="info-value">
                                    {data.dateRange.startDate} - {data.dateRange.endDate}
                                </div>
                            </div>
                        )}

                        {data?.nodes && (
                            <div className="info-block">
                                <div className="info-label">👥 Tráfico Total</div>
                                <div className="info-value">
                                    {data.nodes.reduce((sum, n) => n.layer === 0 ? sum + n.sessions : sum, 0).toLocaleString()}
                                </div>
                            </div>
                        )}

                        {data?.estimatedSales !== undefined && (
                            <div className="info-block">
                                <div className="info-label">💰 Ventas Estimadas</div>
                                <div className="info-value">
                                    ${data.estimatedSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onMouseMove={handleMouseMove}
                onWheel={handleWheel}
            />

            {loading && <div className="loading-overlay"><div className="spinner"></div></div>}

            {/* Fixed Side Panel */}
            <div className={`side-panel open`}> {/* Always open now, showing either selection or general stats */}
                {selectedNode ? (
                    <>
                        <div className="panel-header">
                            <h2>{selectedNode.label}</h2>
                            <button className="close-btn" onClick={() => setSelectedNode(null)}>×</button>
                        </div>
                        <div className="panel-content">
                            <div className="summary-card">
                                <div className="label">Sesiones Totales</div>
                                <div className="value">{selectedNode.sessions.toLocaleString()}</div>
                            </div>

                            <h3>Desglose</h3>
                            <div className="breakdown-list">
                                {selectedNode.metadata.details && selectedNode.metadata.details.length > 0 ? (
                                    selectedNode.metadata.details.map((item, i) => (
                                        <div key={i} className="breakdown-item">
                                            <div className="item-info">
                                                <span className="item-name">
                                                    {item.key || item.path || 'Desconocido'}
                                                </span>
                                                {item.source && (
                                                    <span className="item-sub">
                                                        {item.source} / {item.medium}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="item-value">
                                                {item.sessions.toLocaleString()}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-data">No hay detalles disponibles</div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="panel-header">
                            <h2>Resumen de Audiencia</h2>
                        </div>
                        <div className="panel-content">
                            {data?.demographics ? (
                                <>
                                    {renderBarChart(data.demographics.device, 'Dispositivos')}
                                    {renderBarChart(data.demographics.geo, 'Ubicación (Top 5)')}
                                    {renderBarChart(data.demographics.age, 'Edad')}
                                    {renderBarChart(data.demographics.gender, 'Género')}
                                </>
                            ) : (
                                <div className="panel-placeholder">
                                    <p>Cargando datos demográficos...</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
