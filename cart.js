// cart.js - 购物车管理
// ============================================
import { getProductos, findProducto, loadInventory, setOnProductoUpdated } from './inventory.js';
import { saveProducto, saveVenta, saveMovimiento } from './supabase.js';

let carrito = [];
let facturaCounter = 1;
let onCartUpdated = null;

export function setOnCartUpdated(callback) {
    onCartUpdated = callback;
}

function formatMoneda(val) { return 'B/.' + val.toFixed(2); }
function toast(msg, tipo) { /* será llamado desde app.js */ }
function playBeep(type) { /* será llamado desde app.js */ }
let toastFn = null;
let beepFn = null;

export function setToastFn(fn) { toastFn = fn; }
export function setBeepFn(fn) { beepFn = fn; }

function toastLocal(msg, tipo) { if (toastFn) toastFn(msg, tipo); }
function beepLocal(type) { if (beepFn) beepFn(type); }

// ===== Carrito =====
export function getCart() { return carrito; }
export function getCartTotal() {
    return carrito.reduce((sum, i) => sum + i.cantidad * i.precio, 0);
}
export function getCartCount() {
    return carrito.reduce((sum, i) => sum + i.cantidad, 0);
}

export function renderCarrito() {
    const container = document.getElementById('carritoLista');
    const resumen = document.getElementById('carritoResumen');
    const totalEl = document.getElementById('carritoTotal');

    if (carrito.length === 0) {
        container.innerHTML = '<div class="carrito-vacio">🛒 Carrito vacío</div>';
        resumen.style.display = 'none';
        return;
    }

    let html = '', total = 0;
    carrito.forEach((item, index) => {
        const subtotal = item.cantidad * item.precio;
        total += subtotal;
        html += `
            <div class="carrito-item">
                <div class="info">
                    <strong>${item.nombre}</strong>
                    <span class="text-muted" style="margin-left:8px;">${item.codigo}</span>
                    <br>
                    <span>${item.cantidad} x ${formatMoneda(item.precio)} = ${formatMoneda(subtotal)}</span>
                </div>
                <div class="acciones">
                    <button onclick="window.cambiarCantidadCarrito(${index}, ${item.cantidad - 1})">−</button>
                    <span style="min-width:24px;text-align:center;">${item.cantidad}</span>
                    <button onclick="window.cambiarCantidadCarrito(${index}, ${item.cantidad + 1})">+</button>
                    <button class="eliminar" onclick="window.eliminarDelCarrito(${index})">✕</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    resumen.style.display = 'block';
    totalEl.textContent = formatMoneda(total);

    const modalTotal = document.getElementById('modalTotalPago');
    const modalCantidad = document.getElementById('modalCantidadItems');
    if (modalTotal) modalTotal.textContent = formatMoneda(total);
    if (modalCantidad) modalCantidad.textContent = carrito.reduce((sum, i) => sum + i.cantidad, 0);
}

export function cambiarCantidadCarrito(index, nuevaCantidad) {
    if (nuevaCantidad <= 0) {
        eliminarDelCarrito(index);
        return;
    }
    const item = carrito[index];
    if (nuevaCantidad > item.stock) {
        toastLocal('Stock insuficiente (disponible: ' + item.stock + ')', 'error');
        return;
    }
    item.cantidad = nuevaCantidad;
    renderCarrito();
    if (onCartUpdated) onCartUpdated();
}

export function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    renderCarrito();
    toastLocal('🗑 Producto eliminado del carrito', '');
    if (onCartUpdated) onCartUpdated();
}

export function vaciarCarrito() {
    if (carrito.length === 0) return;
    if (!confirm('¿Vaciar todo el carrito?')) return;
    carrito = [];
    renderCarrito();
    toastLocal('🗑 Carrito vaciado', '');
    if (onCartUpdated) onCartUpdated();
}

export function agregarAlCarrito(codigo, cantidad) {
    cantidad = parseInt(cantidad) || 1;
    if (cantidad <= 0) { toastLocal('Cantidad inválida', 'error'); return; }
    const p = findProducto(codigo);
    if (!p) { toastLocal('Producto no encontrado', 'error'); return; }
    if (p.stock < cantidad) {
        toastLocal('Stock insuficiente (disponible: ' + p.stock + ')', 'error');
        return;
    }

    const existente = carrito.find(i => i.codigo === p.codigo);
    if (existente) {
        const nuevaCant = existente.cantidad + cantidad;
        if (nuevaCant > p.stock) {
            toastLocal('Stock insuficiente (disponible: ' + p.stock + ')', 'error');
            return;
        }
        existente.cantidad = nuevaCant;
    } else {
        carrito.push({
            codigo: p.codigo,
            nombre: p.nombre,
            precio: p.precio,
            cantidad: cantidad,
            stock: p.stock
        });
    }
    renderCarrito();
    toastLocal('✅ ' + p.nombre + ' x' + cantidad + ' agregado', 'success');
    beepLocal('scan');
    if (onCartUpdated) onCartUpdated();
    document.getElementById('scanInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('scanResult').style.display = 'none';
    document.getElementById('scanInput').focus();
}

// ===== Finalizar Compra =====
export function abrirModalPago(pagoPredefinido) {
    if (carrito.length === 0) {
        toastLocal('🛒 El carrito está vacío', 'error');
        return;
    }
    const total = getCartTotal();
    document.getElementById('modalTotalPago').textContent = formatMoneda(total);
    document.getElementById('modalCantidadItems').textContent = carrito.reduce((sum, i) => sum + i.cantidad, 0);

    if (pagoPredefinido) {
        document.getElementById('pagoSelect').value = pagoPredefinido;
        setTimeout(() => {
            document.getElementById('pagoConfirmar').click();
        }, 150);
        return;
    }
    document.getElementById('modalPago').classList.add('active');
    document.getElementById('pagoSelect').focus();
}

export async function confirmarVenta() {
    const pago = document.getElementById('pagoSelect').value;
    const tasaImpuesto = parseInt(document.getElementById('tasaImpuestoSelect').value);

    for (const item of carrito) {
        const p = findProducto(item.codigo);
        if (!p) {
            toastLocal('⚠️ Producto no encontrado: ' + item.codigo, 'error');
            return;
        }
        if (p.stock < item.cantidad) {
            toastLocal('⚠️ Stock insuficiente: ' + p.nombre + ' (disponible: ' + p.stock + ')', 'error');
            return;
        }
    }

    const ventaItems = [];
    for (const item of carrito) {
        const p = findProducto(item.codigo);
        p.stock -= item.cantidad;
        ventaItems.push({
            nombre: p.nombre,
            cantidad: item.cantidad,
            precio: p.precio
        });
    }

    for (const item of carrito) {
        const p = findProducto(item.codigo);
        await saveProducto(p);
    }

    const subtotal = ventaItems.reduce((sum, i) => sum + i.cantidad * i.precio, 0);
    const impuesto = subtotal * (tasaImpuesto / 100);
    const total = subtotal + impuesto;

    const ventaRecord = {
        items: ventaItems,
        subtotal, impuesto, total,
        pago, iva: tasaImpuesto,
        fecha: new Date().toISOString()
    };

    await saveVenta(ventaRecord);
    const ventas = JSON.parse(localStorage.getItem('cell_la25_ventas') || '[]');
    ventas.push(ventaRecord);
    localStorage.setItem('cell_la25_ventas', JSON.stringify(ventas));

    for (const item of ventaItems) {
        await saveMovimiento({
            tipo: 'salida',
            producto: item.nombre,
            cantidad: item.cantidad,
            total: item.cantidad * item.precio,
            fecha: new Date().toISOString()
        });
        const movs = JSON.parse(localStorage.getItem('cell_la25_movimientos') || '[]');
        movs.push({
            tipo: 'salida',
            producto: item.nombre,
            cantidad: item.cantidad,
            total: item.cantidad * item.precio,
            fecha: new Date().toISOString()
        });
        localStorage.setItem('cell_la25_movimientos', JSON.stringify(movs));
    }

    toastLocal('✅ Venta completada! ' + ventaItems.length + ' productos', 'success');

    const ventaData = { items: ventaItems, pago, subtotal, impuesto, tasa_impuesto: tasaImpuesto, total };

    carrito = [];
    renderCarrito();
    document.getElementById('modalPago').classList.remove('active');
    if (onCartUpdated) onCartUpdated();

    if (confirm('¿Imprimir factura?')) {
        window.preparePrintData && window.preparePrintData(ventaData);
        document.getElementById('modalPrintSelector').classList.add('active');
    }
}

// Exponer funciones a window
window.cambiarCantidadCarrito = cambiarCantidadCarrito;
window.eliminarDelCarrito = eliminarDelCarrito;
