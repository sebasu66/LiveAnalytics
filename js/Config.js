export const COLORS = {
    google: '#4285F4',
    direct: '#EA4335',
    social: '#FBBC05',
    mobile: '#A142F4',
    desktop: '#00C853',
    us: '#FF4081',
    eu: '#448AFF',
    asia: '#FFD740',
    new: '#64FFDA',
    returning: '#FF6E40',
    node: '#ffffff',
    nodeText: '#a0a0a0',
    // E-commerce funnel colors
    productView: '#64FFDA',
    addToCart: '#FFD740',
    checkout: '#FF9800',
    purchase: '#00C853'
};

export const NODES_CONFIG = [
    // Traffic Sources (Column 1)
    { id: 'source_google', x: 0, y: -200, label: 'Google Ads', type: 'source', color: COLORS.google },
    { id: 'source_direct', x: 0, y: 0, label: 'Direct', type: 'source', color: COLORS.direct },
    { id: 'source_social', x: 0, y: 200, label: 'Social', type: 'source', color: COLORS.social },

    // E-commerce Funnel Stages (Columns 2-5)
    { id: 'product_view', x: 400, y: 0, label: 'Product View', type: 'funnel', color: COLORS.productView },
    { id: 'add_to_cart', x: 800, y: 0, label: 'Add to Cart', type: 'funnel', color: COLORS.addToCart },
    { id: 'checkout', x: 1200, y: 0, label: 'Checkout', type: 'funnel', color: COLORS.checkout },
    { id: 'purchase', x: 1600, y: 0, label: 'Purchase', type: 'funnel', color: COLORS.purchase }
];

export const CONNECTIONS = {
    'source_google': { target: 'product_view', rate: 1.0 },
    'source_direct': { target: 'product_view', rate: 1.0 },
    'source_social': { target: 'product_view', rate: 1.0 },
    'product_view': { target: 'add_to_cart', rate: 0.25 },  // 25% add to cart
    'add_to_cart': { target: 'checkout', rate: 0.60 },      // 60% proceed to checkout
    'checkout': { target: 'purchase', rate: 0.75 }          // 75% complete purchase
};

export const TIMING = {
    dataRefreshInterval: 60000, // 60s
    aiRefreshInterval: 300000,  // 5m
    monthlyDataRefreshInterval: 300000, // 5m for monthly stats
    lastDataRefresh: Date.now(),
    lastAiRefresh: Date.now(),
    lastMonthlyRefresh: Date.now()
};
