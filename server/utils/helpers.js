// Helper: Translate specific terms
function translateTerm(term) {
    if (!term) return '';
    const lower = term.toLowerCase();
    const map = {
        'organic': 'Orgánico',
        'referral': 'Referencia',
        '(none)': 'Directo',
        '(direct)': 'Directo',
        'cpc': 'Pago (CPC)',
        'email': 'Email',
        'social': 'Social',
        'desktop': 'Escritorio',
        'mobile': 'Móvil',
        'tablet': 'Tablet',
        'male': 'Hombre',
        'female': 'Mujer',
        'unknown': 'Desconocido'
    };
    return map[lower] || term;
}

// Helper function to categorize traffic sources
function categorizeSource(source, medium) {
    const sourceLower = source ? source.toLowerCase() : '';
    const mediumLower = medium ? medium.toLowerCase() : '';

    if (mediumLower.includes('cpc') || mediumLower.includes('ppc') ||
        mediumLower.includes('paid') || sourceLower.includes('ads')) {
        return 'Campañas Ads';
    }

    if (mediumLower.includes('social') ||
        ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'pinterest']
            .some(s => sourceLower.includes(s))) {
        return 'Redes Sociales';
    }

    return 'Orgánico';
}


// Helper function to group pages into GENERIC PROCEDURAL CATEGORIES
function groupPage(pagePath) {
    if (!pagePath || pagePath === '/') return 'HOME';

    const parts = pagePath.split('/').filter(p => p.length > 0);
    if (parts.length === 0) return 'HOME';

    // Get the full path in lowercase for matching
    const fullPath = pagePath.toLowerCase();

    // CART - Carrito de compras
    if (fullPath.includes('cart') || fullPath.includes('carrito') ||
        fullPath.includes('basket') || fullPath.includes('cesta')) {
        return 'CART';
    }

    // CHECKOUT - Proceso de pago
    if (fullPath.includes('checkout') || fullPath.includes('payment') ||
        fullPath.includes('pago') || fullPath.includes('compra') ||
        fullPath.includes('order') || fullPath.includes('pedido')) {
        return 'CHECKOUT';
    }

    // CONTACTO - Páginas de contacto
    if (fullPath.includes('contact') || fullPath.includes('contacto') ||
        fullPath.includes('ayuda') || fullPath.includes('help') ||
        fullPath.includes('support') || fullPath.includes('soporte')) {
        return 'CONTACTO';
    }

    // PROMOCION - Landing pages promocionales
    if (fullPath.includes('promo') || fullPath.includes('offer') ||
        fullPath.includes('oferta') || fullPath.includes('descuento') ||
        fullPath.includes('discount') || fullPath.includes('sale') ||
        fullPath.includes('landing') || fullPath.includes('campaign') ||
        fullPath.includes('campana')) {
        return 'PROMOCION';
    }

    // CATALOGO - Páginas de productos, colecciones, categorías
    if (fullPath.includes('product') || fullPath.includes('producto') ||
        fullPath.includes('collection') || fullPath.includes('coleccion') ||
        fullPath.includes('category') || fullPath.includes('categoria') ||
        fullPath.includes('shop') || fullPath.includes('tienda') ||
        fullPath.includes('catalog') || fullPath.includes('catalogo') ||
        // Specific product indicators
        fullPath.includes('zapatilla') || fullPath.includes('zapato') ||
        fullPath.includes('calzado') || fullPath.includes('shoe') ||
        fullPath.includes('ropa') || fullPath.includes('clothing') ||
        fullPath.includes('accesorio') || fullPath.includes('accessory') ||
        // Common e-commerce patterns
        fullPath.includes('/p/') || fullPath.includes('/item/') ||
        fullPath.includes('-nb-') || // New Balance specific pattern
        fullPath.match(/\d{3,}/)) { // URLs with product codes (3+ digits)
        return 'CATALOGO';
    }

    // Check first segment for common patterns
    const mainPath = '/' + parts[0];
    const lowerPath = mainPath.toLowerCase();

    if (lowerPath.includes('blog') || lowerPath.includes('article') ||
        lowerPath.includes('news') || lowerPath.includes('noticia')) {
        return 'BLOG';
    }

    if (lowerPath.includes('about') || lowerPath.includes('nosotros') ||
        lowerPath.includes('company') || lowerPath.includes('empresa')) {
        return 'NOSOTROS';
    }

    if (lowerPath.includes('login') || lowerPath.includes('signin') ||
        lowerPath.includes('account') || lowerPath.includes('cuenta') ||
        lowerPath.includes('profile') || lowerPath.includes('perfil')) {
        return 'CUENTA';
    }

    if (lowerPath.includes('search') || lowerPath.includes('buscar') ||
        lowerPath.includes('busqueda')) {
        return 'BUSQUEDA';
    }

    // Default: OTROS (other pages)
    return 'OTROS';
}

module.exports = {
    translateTerm,
    categorizeSource,
    groupPage
};