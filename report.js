// report.js - 报表和导出
// ============================================
import { getProductos, getCriticalStock } from './inventory.js';

function formatMoneda(val) { return 'B/.' + val.toFixed(2); }
function getTodayStr() { return new Date().toISOString().split('T')[0]; }

let toastFn = null;
export function setToastFn(fn) { toastFn = fn; }
function toastLocal(msg, tipo) { if (toastFn) toastFn(msg, tipo); }

// ===== Reportes =====
export function getSalesByPeriod(periodo) {
    const ventas = JSON.parse(localStorage.getItem('cell_la25_ventas') || '[]');
    const ahora = new Date();
    const inicio = new Date(ahora);

    if (periodo === 'hoy') inicio.setHours(0, 0, 0, 0);
    else if (periodo === 'semana') inicio.setDate(ahora.getDate() - 7);
    else if (periodo === 'mes') inicio.setMonth(ahora.getMonth() - 1);
    else if (periodo === 'trimestre') inicio.setMonth(ahora.getMonth() - 3);
    else if (periodo === 'anio') inicio.setFullYear(ahora.getFullYear() - 1);
    else if (periodo === 'todo') inicio.setFullYear(2000, 0, 1);

    return ventas.filter(v => {
        if (!v.fecha) return false;
        return new Date(v.fecha) >= inicio;
    });
}

export function getPaymentSummary(ventas) {
    const resumen = { EFECTIVO: 0, YAPPY: 0, 'TARJETA DE CRÉDITO': 0 };
    ventas.forEach(v => {
        const pago = (v.pago || 'EFECTIVO').toUpperCase();
        if (resumen[pago] !== undefined) resumen[pago] += v.total || 0;
        else resumen['EFECTIVO'] += v.total || 0;
    });
    return resumen;
}

export function getTopProducts(ventas, limit = 20) {
    const productos = {};
    ventas.forEach(v => {
        if (v.items) {
            v.items.forEach(item => {
                productos[item.nombre] = (productos[item.nombre] || 0) + (item.cantidad || 0);
            });
        }
    });
    return Object.entries(productos).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function renderReport(periodo) {
    const filtered = getSalesByPeriod(periodo);
    const totalVentas = filtered.length;
    const totalMonto = filtered.reduce((sum, v) => sum + (v.total || 0), 0);
    const totalItems = filtered.reduce((sum, v) => {
        if (v.items) return sum + v.items.reduce((s, i) => s + (i.cantidad || 0), 0);
        return sum;
    }, 0);
    const pagoResumen = getPaymentSummary(filtered);
    const top = getTopProducts(filtered);

    let html = `
        <div class="reporte-resumen">
            <div class="item"><div class="label">Ventas</div><div class="value">${totalVentas}</div></div>
            <div class="item"><div class="label">Artículos</div><div class="value">${totalItems}</div></div>
            <div class="item"><div class="label">Total</div><div class="value">${formatMoneda(totalMonto)}</div></div>
            <div class="item"><div class="label">💵 Efectivo</div><div class="value">${formatMoneda(pagoResumen.EFECTIVO)}</div></div>
            <div class="item"><div class="label">📱 YAPPY</div><div class="value">${formatMoneda(pagoResumen.YAPPY)}</div></div>
            <div class="item"><div class="label">💳 Tarjeta</div><div class="value">${formatMoneda(pagoResumen['TARJETA DE CRÉDITO'])}</div></div>
        </div>
        <div style="font-weight:700;margin-bottom:8px;">📈 Productos más vendidos</div>
        <table class="reporte-tabla">
            <thead><tr><th>Producto</th><th>Cantidad</th></tr></thead>
            <tbody>
    `;

    if (top.length === 0) {
        html += `<tr><td colspan="2" class="text-muted">Sin datos en este período</td></tr>`;
    } else {
        top.forEach(([nombre, cantidad]) => {
            html += `<tr><td>${nombre}</td><td>${cantidad}</td></tr>`;
        });
    }

    const ahora = new Date();
    const inicio = new Date(ahora);
    if (periodo === 'hoy') inicio.setHours(0, 0, 0, 0);
    else if (periodo === 'semana') inicio.setDate(ahora.getDate() - 7);
    else if (periodo === 'mes') inicio.setMonth(ahora.getMonth() - 1);
    else if (periodo === 'trimestre') inicio.setMonth(ahora.getMonth() - 3);
    else if (periodo === 'anio') inicio.setFullYear(ahora.getFullYear() - 1);
    else if (periodo === 'todo') inicio.setFullYear(2000, 0, 1);

    html += `
            </tbody>
        </table>
        <div style="margin-top:12px;font-size:11px;color:#8892a8;text-align:center;">
            Período: ${inicio.toLocaleDateString('es-PA')} - ${ahora.toLocaleDateString('es-PA')}
            · ${filtered.length} registros
        </div>
    `;

    document.getElementById('reporteContenido').innerHTML = html;
    return filtered;
}

// ===== Exportar =====
export function exportarReporteCSV(periodo) {
    const filtered = getSalesByPeriod(periodo);
    let csv = 'Fecha,Producto,Cantidad,Precio Unitario,Total,Pago\n';
    filtered.forEach(v => {
        const fecha = v.fecha ? new Date(v.fecha).toLocaleString('es-PA') : '';
        if (v.items) {
            v.items.forEach(item => {
                csv += `${fecha},${item.nombre},${item.cantidad},${item.precio},${item.cantidad * item.precio},${v.pago}\n`;
            });
        }
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte_${periodo}_${getTodayStr()}.csv`;
    link.click();
    toastLocal('📤 Reporte exportado', 'success');
}

export function exportarProductosCSV() {
    const productos = getProductos();
    let csv = 'Código,Nombre,Precio,Costo,Stock,Mínimo\n';
    productos.forEach(p => {
        csv += `${p.codigo},${p.nombre},${p.precio},${p.costo},${p.stock},${p.minimo || 3}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `productos_${getTodayStr()}.csv`;
    link.click();
    toastLocal('📦 Productos exportados', 'success');
}

export function exportarVentasCSV() {
    const ventas = JSON.parse(localStorage.getItem('cell_la25_ventas') || '[]');
    let csv = 'Fecha,Producto,Cantidad,Precio,Total,Pago\n';
    ventas.forEach(v => {
        const fecha = v.fecha ? new Date(v.fecha).toLocaleString('es-PA') : '';
        if (v.items) {
            v.items.forEach(item => {
                csv += `${fecha},${item.nombre},${item.cantidad},${item.precio},${item.cantidad * item.precio},${v.pago}\n`;
            });
        }
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventas_${getTodayStr()}.csv`;
    link.click();
    toastLocal('📊 Ventas exportadas', 'success');
}

export function exportarStockCSV() {
    const criticos = getCriticalStock();
    if (criticos.length === 0) {
        toastLocal('✅ No hay productos críticos', 'success');
        return;
    }
    let csv = 'Código,Nombre,Stock,Mínimo\n';
    criticos.forEach(p => {
        csv += `${p.codigo},${p.nombre},${p.stock},${p.minimo || 3}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stock_critico_${getTodayStr()}.csv`;
    link.click();
    toastLocal('⚠️ Stock crítico exportado', 'success');
}

export function exportarBackup() {
    const data = {
        productos: getProductos(),
        ventas: JSON.parse(localStorage.getItem('cell_la25_ventas') || '[]'),
        movimientos: JSON.parse(localStorage.getItem('cell_la25_movimientos') || '[]'),
        devoluciones: JSON.parse(localStorage.getItem('cell_la25_devoluciones') || '[]'),
        fecha_backup: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `backup_cell_la25_${getTodayStr()}.json`;
    link.click();
    toastLocal('💾 Backup completo descargado', 'success');
}
