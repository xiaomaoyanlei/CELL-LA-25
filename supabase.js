// supabase.js - 数据访问层
// ============================================

export const SUPABASE_URL = 'https://hruwxcqedhogseqpbcio.supabase.co';
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydXd4Y3FlZGhvZ3NlcXBiY2lvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUyNzExMywiZXhwIjoyMDk5MTAzMTEzfQ.VfnKr375IEpv83neEhQ9h5mLgpknIp1pyZjDaG1jCOw';

async function supabaseFetch(endpoint, options = {}) {
    const url = SUPABASE_URL + endpoint;
    const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        ...options.headers
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
    }
    return response.json();
}

// ===== Productos =====
export async function fetchProductos() {
    return supabaseFetch('/rest/v1/productos?select=*');
}

export async function saveProducto(producto) {
    const method = producto.id ? 'PATCH' : 'POST';
    const endpoint = producto.id ? `/rest/v1/productos?id=eq.${producto.id}` : '/rest/v1/productos';
    const body = { ...producto };
    delete body.id;
    return supabaseFetch(endpoint, { method, body: JSON.stringify(body) });
}

export async function deleteProducto(codigo) {
    return supabaseFetch(`/rest/v1/productos?codigo=eq.${encodeURIComponent(codigo)}`, { method: 'DELETE' });
}

// ===== Ventas =====
export async function fetchVentas() {
    return supabaseFetch('/rest/v1/ventas?order=fecha.desc');
}

export async function saveVenta(venta) {
    return supabaseFetch('/rest/v1/ventas', { method: 'POST', body: JSON.stringify(venta) });
}

// ===== Movimientos =====
export async function saveMovimiento(movimiento) {
    return supabaseFetch('/rest/v1/movimientos', { method: 'POST', body: JSON.stringify(movimiento) });
}
