// inventory.js - 商品管理
// ============================================
import { fetchProductos, saveProducto, deleteProducto } from './supabase.js';

let productos = [];

export function getProductos() { return productos; }
export function findProducto(codigo) {
    return productos.find(p => p.codigo === codigo || p.codigo === codigo.trim());
}
export function findProductoByNombre(nombre) {
    return productos.find(p => p.nombre === nombre);
}

function formatMoneda(val) { return 'B/.' + val.toFixed(2); }
function getStockBadge(stock, minimo) {
    if (stock <= 0) return '<span class="badge-stock critico">⚠ Sin stock</span>';
    if (stock <= (minimo || 3)) return '<span class="badge-stock critico">⚠ Crítico</span>';
    if (stock >= 10) return '<span class="badge-stock alto">✓ Alto</span>';
    if (stock >= 3) return '<span class="badge-stock medio">◉ Medio</span>';
    return '<span class="badge-stock bajo">⚠ Bajo</span>';
}

let modoJefe = false;
export function setModoJefe(valor) { modoJefe = valor; }

let editandoCodigo = null;
let onProductoUpdated = null;

export function setOnProductoUpdated(callback) {
    onProductoUpdated = callback;
}

async function guardarYRecargar(producto) {
    await saveProducto(producto);
    await loadInventory();
    if (onProductoUpdated) onProductoUpdated();
}

export async function loadInventory() {
    try {
        productos = await fetchProductos();
        renderInventory();
        return true;
    } catch (error) {
        console.error('Error cargando productos:', error);
        return false;
    }
}

export function renderInventory() {
    const tbody = document.getElementById('inventarioBody');
    if (!productos || productos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay productos</td></tr>';
        return;
    }
    let html = '', totalValor = 0, totalUds = 0, totalCriticos = 0;
    productos.forEach(p => {
        totalValor += p.stock * p.precio;
        totalUds += p.stock;
        const minimo = p.minimo || 3;
        if (p.stock <= minimo) totalCriticos++;
        const disabled = modoJefe ? '' : 'disabled';
        html += `<tr>
            <td><span class="codigo-badge">${p.codigo}</span></td>
            <td>${p.nombre}</td>
            <td style="text-align:center;">${p.stock} ${getStockBadge(p.stock, minimo)}</td>
            <td style="text-align:center;">${minimo}</td>
            <td style="text-align:right;font-weight:600;">${formatMoneda(p.precio)}</td>
            <td style="text-align:center;">
                <button class="edit-btn ${disabled}" data-codigo="${p.codigo}" ${modoJefe?'':'disabled'}>✏️</button>
            </td>
        </tr>`;
    });
    tbody.innerHTML = html;
    document.getElementById('totalProductos').textContent = productos.length;
    document.getElementById('totalUnidades').textContent = totalUds;
    document.getElementById('valorTotal').textContent = formatMoneda(totalValor);
    document.getElementById('totalCriticos').textContent = totalCriticos;

    document.querySelectorAll('.edit-btn').forEach(b => {
        b.addEventListener('click', function() {
            if (!modoJefe) { toast('🔒 Solo jefe', 'error'); return; }
            abrirModal(this.dataset.codigo);
        });
    });
}

export function getCriticalStock() {
    return productos.filter(p => p.stock <= (p.minimo || 3));
}

// ===== Modal Editar =====
function abrirModal(codigo) {
    if (!modoJefe) return;
    const p = findProducto(codigo);
    if (!p) return;
    editandoCodigo = codigo;
    document.getElementById('editCodigo').value = p.codigo;
    document.getElementById('editNombre').value = p.nombre;
    document.getElementById('editPrecio').value = p.precio;
    document.getElementById('editCosto').value = p.costo;
    document.getElementById('editStock').value = p.stock;
    document.getElementById('editMinimo').value = p.minimo || 3;
    document.getElementById('modalEditar').classList.add('active');
}

function cerrarModal() {
    document.getElementById('modalEditar').classList.remove('active');
    editandoCodigo = null;
}

export async function guardarEdicion() {
    if (!modoJefe || !editandoCodigo) return;
    const p = findProducto(editandoCodigo);
    if (!p) return;
    const nombre = document.getElementById('editNombre').value.trim();
    const precio = parseFloat(document.getElementById('editPrecio').value);
    const costo = parseFloat(document.getElementById('editCosto').value);
    const stock = parseInt(document.getElementById('editStock').value);
    const minimo = parseInt(document.getElementById('editMinimo').value) || 3;
    if (!nombre || isNaN(precio) || precio < 0 || isNaN(costo) || costo < 0 || isNaN(stock) || stock < 0 || isNaN(minimo) || minimo < 0) {
        toast('Datos inválidos', 'error');
        return;
    }
    p.nombre = nombre;
    p.precio = precio;
    p.costo = costo;
    p.stock = stock;
    p.minimo = minimo;
    await guardarYRecargar(p);
    cerrarModal();
    toast('✅ Producto actualizado', 'success');
}

export async function eliminarProducto() {
    if (!modoJefe || !editandoCodigo) return;
    if (!confirm('¿Eliminar este producto permanentemente?')) return;
    await deleteProducto(editandoCodigo);
    await loadInventory();
    cerrarModal();
    toast('🗑 Producto eliminado', 'success');
}

// ===== Modal Agregar =====
export function abrirAgregar() {
    if (!modoJefe) { toast('🔒 Solo jefe', 'error'); return; }
    document.getElementById('agregarCodigo').value = '';
    document.getElementById('agregarNombre').value = '';
    document.getElementById('agregarPrecio').value = '';
    document.getElementById('agregarCosto').value = '';
    document.getElementById('agregarStock').value = '';
    document.getElementById('agregarMinimo').value = '3';
    document.getElementById('modalAgregar').classList.add('active');
    document.getElementById('agregarNombre').focus();
}

export async function guardarAgregar() {
    if (!modoJefe) { toast('🔒 Solo jefe', 'error'); return; }
    let codigo = document.getElementById('agregarCodigo').value.trim();
    const nombre = document.getElementById('agregarNombre').value.trim();
    const precio = parseFloat(document.getElementById('agregarPrecio').value);
    const costo = parseFloat(document.getElementById('agregarCosto').value);
    const stock = parseInt(document.getElementById('agregarStock').value);
    const minimo = parseInt(document.getElementById('agregarMinimo').value) || 3;
    if (!nombre || isNaN(precio) || precio < 0 || isNaN(costo) || costo < 0 || isNaN(stock) || stock < 0 || isNaN(minimo) || minimo < 0) {
        toast('Datos inválidos', 'error');
        return;
    }
    if (!codigo) {
        const maxNum = productos.reduce((max, p) => {
            const n = parseInt(p.codigo.replace('ZP-', ''));
            return n > max ? n : max;
        }, 0);
        codigo = 'ZP-' + String(maxNum + 1).padStart(3, '0');
    }
    if (findProducto(codigo)) { toast('Código ya existe', 'error'); return; }
    const nuevoProducto = { codigo, nombre, precio, costo, stock, minimo };
    await guardarYRecargar(nuevoProducto);
    document.getElementById('modalAgregar').classList.remove('active');
    toast('✅ Producto agregado', 'success');
}

// Exponer funciones a window para eventos onclick
window.abrirAgregar = abrirAgregar;
window.guardarAgregar = guardarAgregar;
window.guardarEdicion = guardarEdicion;
window.eliminarProducto = eliminarProducto;
