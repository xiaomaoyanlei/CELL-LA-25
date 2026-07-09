// devoluciones.js - 退货退款
// ============================================
import { findProducto, findProductoByNombre, loadInventory } from './inventory.js';
import { saveProducto, saveMovimiento } from './supabase.js';

let toastFn = null;
export function setToastFn(fn) { toastFn = fn; }
function toastLocal(msg, tipo) { if (toastFn) toastFn(msg, tipo); }

function formatMoneda(val) { return 'B/.' + val.toFixed(2); }

export function abrirDevolucion() {
    const ventas = JSON.parse(localStorage.getItem('cell_la25_ventas') || '[]');
    const select = document.getElementById('devolucionVentaSelect');
    select.innerHTML = '<option value="">-- Selecciona una venta --</option>';
    ventas.slice(-20).reverse().forEach((v, idx) => {
        const total = v.total || 0;
        const fecha = v.fecha ? new Date(v.fecha).toLocaleString('es-PA') : 'Sin fecha';
        const items = v.items ? v.items.map(i => i.nombre).join(', ') : '';
        select.innerHTML += `<option value="${ventas.length - 1 - idx}">${fecha} - ${formatMoneda(total)} - ${items.substring(0,30)}...</option>`;
    });
    document.getElementById('devolucionItems').innerHTML = '';
    document.getElementById('devolucionMotivo').value = '';
    document.getElementById('modalDevolucion').classList.add('active');

    select.onchange = function() {
        const idx = parseInt(this.value);
        if (isNaN(idx) || idx < 0) {
            document.getElementById('devolucionItems').innerHTML = '';
            return;
        }
        const venta = ventas[idx];
        if (!venta || !venta.items) {
            document.getElementById('devolucionItems').innerHTML = '<div class="text-muted">No hay items para devolver</div>';
            return;
        }
        let html = '<div style="margin-top:8px;font-weight:700;">Selecciona los items a devolver:</div>';
        venta.items.forEach((item, i) => {
            html += `
                <div class="devolucion-item">
                    <div class="info">
                        <strong>${item.nombre}</strong> · ${item.cantidad} und · ${formatMoneda(item.precio)}
                    </div>
                    <div class="acciones">
                        <input type="number" id="devCant_${i}" value="${item.cantidad}" min="1" max="${item.cantidad}" style="width:50px;padding:4px;border:1.5px solid #e2e7f0;border-radius:6px;">
                        <input type="checkbox" id="devCheck_${i}" checked>
                    </div>
                </div>
            `;
        });
        document.getElementById('devolucionItems').innerHTML = html;
        document.getElementById('devolucionVentaSelect').dataset.ventaIdx = idx;
    };
}

export async function confirmarDevolucion() {
    const select = document.getElementById('devolucionVentaSelect');
    const idx = parseInt(select.value);
    if (isNaN(idx) || idx < 0) {
        toastLocal('Selecciona una venta', 'error');
        return;
    }
    const ventas = JSON.parse(localStorage.getItem('cell_la25_ventas') || '[]');
    const venta = ventas[idx];
    if (!venta) {
        toastLocal('Venta no encontrada', 'error');
        return;
    }

    const motivo = document.getElementById('devolucionMotivo').value.trim() || 'Sin motivo';
    let devueltos = 0;

    for (let i = 0; i < venta.items.length; i++) {
        const check = document.getElementById(`devCheck_${i}`);
        if (!check || !check.checked) continue;
        const cantidad = parseInt(document.getElementById(`devCant_${i}`).value) || 0;
        if (cantidad <= 0) continue;
        const item = venta.items[i];
        const p = findProductoByNombre(item.nombre);
        if (p) {
            p.stock += cantidad;
            await saveProducto(p);
        }
        devueltos += cantidad;

        await saveMovimiento({
            tipo: 'entrada',
            producto: item.nombre,
            cantidad: cantidad,
            total: cantidad * item.precio,
            fecha: new Date().toISOString()
        });
        const movs = JSON.parse(localStorage.getItem('cell_la25_movimientos') || '[]');
        movs.push({
            tipo: 'entrada',
            producto: item.nombre,
            cantidad: cantidad,
            total: cantidad * item.precio,
            fecha: new Date().toISOString()
        });
        localStorage.setItem('cell_la25_movimientos', JSON.stringify(movs));

        const devs = JSON.parse(localStorage.getItem('cell_la25_devoluciones') || '[]');
        devs.push({
            producto: item.nombre,
            cantidad: cantidad,
            total: cantidad * item.precio,
            motivo: motivo,
            fecha: new Date().toISOString()
        });
        localStorage.setItem('cell_la25_devoluciones', JSON.stringify(devs));
    }

    if (devueltos === 0) {
        toastLocal('No se seleccionaron items para devolver', 'error');
        return;
    }

    venta.devuelto = true;
    ventas[idx] = venta;
    localStorage.setItem('cell_la25_ventas', JSON.stringify(ventas));

    document.getElementById('modalDevolucion').classList.remove('active');
    toastLocal('✅ Devolución completada: ' + devueltos + ' unidades', 'success');
    await loadInventory();
}

export function renderDevoluciones() {
    const el = document.getElementById('devolucionesLista');
    const devs = JSON.parse(localStorage.getItem('cell_la25_devoluciones') || '[]');
    if (devs.length === 0) {
        el.innerHTML = '<span class="text-muted">Sin devoluciones</span>';
        return;
    }
    const ultimas = devs.slice(-5).reverse();
    el.innerHTML = ultimas.map(d =>
        `<div style="padding:4px 0;border-bottom:1px solid #f0f2f6;font-size:12px;">
            🔄 <strong>${d.producto}</strong> x${d.cantidad} · ${formatMoneda(d.total)}
            <span class="text-muted" style="float:right;">${d.fecha ? new Date(d.fecha).toLocaleString('es-PA') : ''}</span>
            <br><span class="text-muted" style="font-size:10px;">${d.motivo || 'Sin motivo'}</span>
        </div>`
    ).join('');
}
