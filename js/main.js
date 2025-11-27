import { COLORS, NODES_CONFIG, TIMING } from './Config.js';
import { Node } from './Node.js';
import { Particle } from './Particle.js';
import { DataService } from './DataService.js';
import { FunnelService } from './FunnelService.js';
import { FunnelPanel } from './FunnelPanel.js';
import { MonthlyDataService } from './MonthlyDataService.js';
import { SalesOverlay } from './SalesOverlay.js';
import { PathRenderer } from './PathRenderer.js';
import { MetricsTracker } from './MetricsTracker.js';
import { PropertyManager } from './PropertyManager.js';
import { DataVerifier } from './DataVerifier.js';

const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

// --- Camera System ---
const camera = {
    x: 0,
    y: 0,
    zoom: 0.6,
    targetZoom: 0.6,
    dragging: false,
    lastX: 0,
    lastY: 0
};

// --- System State ---
let nodes = [];
let nodesMap = {};
let particles = [];
let stats = {
    activeUsers: 0,
    conversions: 0,
    revenue: 0
};

const dataService = new DataService();
const funnelService = new FunnelService();
const funnelPanel = new FunnelPanel('funnelPanel');
const monthlyDataService = new MonthlyDataService();
const salesOverlay = new SalesOverlay('salesOverlay');
const pathRenderer = new PathRenderer();
const metricsTracker = new MetricsTracker();
const propertyManager = new PropertyManager();
const dataVerifier = new DataVerifier('verificationContent');

// --- Initialization ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.x = canvas.width / 2 - 800;
    camera.y = canvas.height / 2;
}

function initNodes() {
    nodes = [];
    nodesMap = {};
    NODES_CONFIG.forEach(cfg => {
        const node = new Node(cfg);
        nodes.push(node);
        nodesMap[node.id] = node;
    });
}

function updateStats() {
    document.getElementById('activeUsers').innerText = particles.length;
}

// --- Simulation Loop ---
function spawnParticles() {
    const targetCount = dataService.liveDataBuffer.length || 0;

    if (particles.length < targetCount) {
        const spawnRate = (targetCount - particles.length) > 100 ? 0.5 : 0.1;

        if (Math.random() < spawnRate) {
            const meta = dataService.liveDataBuffer[Math.floor(Math.random() * dataService.liveDataBuffer.length)];
            if (!meta) return;

            let sourceId = meta.source;
            if (!nodesMap[sourceId]) sourceId = 'source_direct';

            let targetNodeId = meta.targetNodeId;
            if (!nodesMap[targetNodeId]) return;

            particles.push(new Particle(nodesMap[sourceId], nodesMap[targetNodeId], meta));
        }
    } else if (particles.length > targetCount) {
        particles.pop();
    }
}

function updateTimers() {
    const now = Date.now();

    const dataElapsed = now - TIMING.lastDataRefresh;
    const dataProgress = Math.min(100, (dataElapsed / TIMING.dataRefreshInterval) * 100);
    document.getElementById('refreshProgress').style.width = `${dataProgress}%`;

    if (dataElapsed >= TIMING.dataRefreshInterval) {
        TIMING.lastDataRefresh = now;
        dataService.fetchLiveData(nodes, nodesMap);

        // Fetch funnel data concurrently
        funnelService.fetchFunnelData().then(data => {
            funnelPanel.render(data);
        });

        nodes.forEach(n => n.pulse = Math.PI * 1.5);
    }

    if (now - TIMING.lastAiRefresh >= TIMING.aiRefreshInterval) {
        TIMING.lastAiRefresh = now;
        runAIAnalysis();
    }
}

// Performance optimization: Throttle to 30fps instead of 60fps
let lastFrameTime = 0;
const targetFPS = 30;
const frameInterval = 1000 / targetFPS;

function animate(currentTime = 0) {
    const elapsed = currentTime - lastFrameTime;

    // Skip frame if not enough time has passed
    if (elapsed < frameInterval) {
        requestAnimationFrame(animate);
        return;
    }

    lastFrameTime = currentTime - (elapsed % frameInterval);

    camera.zoom += (camera.targetZoom - camera.zoom) * 0.1;

    ctx.fillStyle = '#0f111a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // Draw E-commerce Funnel Connections using PathRenderer
    pathRenderer.draw(ctx, nodesMap, camera);

    // Nodes
    nodes.forEach(node => node.draw(ctx, camera.zoom));

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(ctx, camera.zoom);
        if (p.dead) {
            particles.splice(i, 1);
        }
    }

    ctx.restore();

    spawnParticles();
    updateStats();
    updateTimers();

    requestAnimationFrame(animate);
}

// --- Interaction ---
canvas.addEventListener('mousedown', e => {
    camera.dragging = true;
    camera.lastX = e.clientX;
    camera.lastY = e.clientY;
});

window.addEventListener('mouseup', () => camera.dragging = false);

canvas.addEventListener('mousemove', e => {
    if (camera.dragging) {
        const dx = e.clientX - camera.lastX;
        const dy = e.clientY - camera.lastY;
        camera.x += dx;
        camera.y += dy;
        camera.lastX = e.clientX;
        camera.lastY = e.clientY;
    }

    if (camera.zoom <= 1.5) {
        const worldX = (e.clientX - camera.x) / camera.zoom;
        const worldY = (e.clientY - camera.y) / camera.zoom;

        let hoveredNode = null;
        nodes.forEach(node => {
            if (node.isHovered(worldX, worldY)) hoveredNode = node;
        });

        const tooltip = document.getElementById('tooltip');
        if (hoveredNode) {
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';

            tooltip.innerHTML = `
                <h4>${hoveredNode.label}</h4>
                <div class="tooltip-row"><span>Visits:</span> <span class="val">${hoveredNode.visits}</span></div>
                <div class="tooltip-row"><span>Drop-offs:</span> <span class="val">${hoveredNode.dropoffs}</span></div>
            `;
        } else {
            tooltip.style.display = 'none';
        }
    } else {
        document.getElementById('tooltip').style.display = 'none';
    }
});

canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    camera.targetZoom *= delta;
    camera.targetZoom = Math.max(0.2, Math.min(3.0, camera.targetZoom));
});

window.addEventListener('resize', resize);

// --- AI Analyst ---
const INSIGHTS = [
    "⚠️ High bounce rate detected on 'Product View' for Mobile users.",
    "✅ 'Google Ads' campaign performing 15% above average.",
    "ℹ️ User retention dropping in 'Cart' step. Suggest checking shipping costs.",
    "🚀 Spike in traffic from 'Social' detected.",
    "⚠️ Checkout latency seems high, users are abandoning.",
    "✅ Conversion rate stabilized at 3.2%."
];

function runAIAnalysis() {
    const panel = document.getElementById('aiContent');
    const msg = INSIGHTS[Math.floor(Math.random() * INSIGHTS.length)];

    const line = document.createElement('div');
    line.className = 'ai-line new';
    line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;

    panel.appendChild(line);
    panel.scrollTop = panel.scrollHeight;

    if (panel.children.length > 10) panel.removeChild(panel.firstChild);
}

// Start
initNodes();
resize();
animate();
dataService.fetchLiveData(nodes, nodesMap);

// Initial funnel fetch
funnelService.fetchFunnelData().then(data => {
    funnelPanel.render(data);
});

// Initial monthly dashboard fetch
monthlyDataService.fetchMonthlyData().then(result => {
    salesOverlay.render(result);
    if (result.success && result.data) {
        pathRenderer.setMonthlyData(result.data);
        metricsTracker.updateMonthlyMetrics(result.data);
    }
});

setTimeout(runAIAnalysis, 2000);

// Initialize Property Selector
async function initPropertySelector() {
    const propertySelect = document.getElementById('propertySelect');
    const verifyBtn = document.getElementById('verifyBtn');

    // Load properties
    await propertyManager.loadProperties();
    const properties = propertyManager.getProperties();

    // Populate dropdown
    propertySelect.innerHTML = '';
    properties.forEach(prop => {
        const option = document.createElement('option');
        option.value = prop.id;
        option.textContent = `${prop.name} (${prop.id})`;
        if (prop.id === propertyManager.getCurrentProperty()?.id) {
            option.selected = true;
        }
        propertySelect.appendChild(option);
    });

    // Property change handler
    propertySelect.addEventListener('change', (e) => {
        const propertyId = e.target.value;
        propertyManager.selectProperty(propertyId);
        // Reload data for new property
        dataService.fetchLiveData(nodes, nodesMap);
        monthlyDataService.fetchMonthlyData().then(result => {
            salesOverlay.render(result);
            if (result.success && result.data) {
                pathRenderer.setMonthlyData(result.data);
                metricsTracker.updateMonthlyMetrics(result.data);
            }
        });
    });

    // Verify button handler
    verifyBtn.addEventListener('click', async () => {
        const currentProperty = propertyManager.getCurrentProperty();
        if (!currentProperty) return;

        // Show verification overlay
        const overlay = document.getElementById('verificationOverlay');
        overlay.style.display = 'block';

        // Run verification
        const verificationData = await dataVerifier.verifyProperty(currentProperty.id);
        dataVerifier.render(verificationData);
    });
}

initPropertySelector();
