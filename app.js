// app.js - 应用入口
// ============================================
import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js';
import {
    getProductos, findProducto, loadInventory,
    setModoJefe, setOnProductoUpdated,
    guardarEdicion, eliminarProducto, guardarAgregar,
    abrirAgregar as invAbrirAgregar
} from './inventory.js';
import {
    getCart, getCartTotal, renderCarrito,
    agregarAlCarrito, vaciarCarrito,
    abrirModalPago, confirmarVenta,
    setToastFn as setCartToastFn,
    setBeepFn as setCartBeepFn
} from './cart.js';
import {
    renderReport, exportarReporteCSV,
    exportarProductosCSV, exportarVentasCSV,
    exportarStockCSV, exportarBackup,
    setToastFn as setReportToastFn
} from './report.js';
import {
    abrirDevolucion, confirmarDevolucion, renderDevoluciones,
    setToastFn as setDevToastFn
} from './devoluciones.js';

// ===== Global state =====
let modoJefe = false;
let searchTimeout = null;

// ===== Toast y Beep =====
function toast(msg, tipo) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (tipo || '');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.className = 'toast'; }, 2500);
    if (tipo === 'success') playBeep('success');
    else if (tipo === 'error') playBeep('error');
}

function playBeep(type) {
    try {
        const ctx = new(window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        if (type === 'success') {
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        } else if (type === 'error') {
            osc.frequency.value = 440;
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'scan') {
            osc.frequency.value = 1200;
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.08);
        } else {
            osc.frequency.value = 660;
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        }
    } catch (e) {}
}

// ===== Inject toast y beep =====
setCartToastFn(toast);
setCartBeepFn(playBeep);
setReportToastFn(toast);
setDevToastFn(toast);

// ===== Navegación =====
function bindNavigation() {
    document.querySelectorAll('#mainNav button').forEach(b => {
        b.addEventListener('click', function() {
            document.querySelectorAll('#mainNav button').forEach(x => x.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.getElementById(this.dataset.panel).classList.add('active');
            if (this.dataset.panel === 'panel-venta') document.getElementById('scanInput').focus();
            if (this.dataset.panel === 'panel-buscar') document.getElementById('buscarInput').focus();
            if (this.dataset.panel === 'panel-reportes') renderReport(document.getElementById('reportePeriodo').value);
        });
    });
}

// ===== Búsqueda en venta =====
function buscarEnVenta(query) {
    const resultsContainer = document.getElementById('searchResults');
    const q = query.toLowerCase().trim();

    if (!q) {
        resultsContainer.innerHTML = '';
        return;
    }

    const productos = getProductos();
    const results = productos.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q)
    );

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="sin-resultados">❌ No se encontraron productos</div>';
        return;
    }

    const mostrar = results.slice(0, 10);
    resultsContainer.innerHTML = mostrar.map(p =>
        `<div class="result-item" data-codigo="${p.codigo}">
            <div>
                <div class="nombre">${p.nombre}</div>
                <div class="detalle">${p.codigo} · Stock: ${p.stock} · ${formatMoneda(p.precio)}</div>
            </div>
            <div>
                <button class="btn btn-success btn-sm" onclick="window.agregarDesdeBusqueda('${p.codigo}')" style="padding:4px 12px;font-size:12px;">➕</button>
            </div>
        </div>
    `).join('');

    resultsContainer.querySelectorAll('.result-item').forEach(el => {
        el.addEventListener('click', function(e) {
            if (e.target.tagName === 'BUTTON') return;
            const codigo = this.dataset.codigo;
            window.agregarDesdeBusqueda(codigo);
        });
    });
}

function formatMoneda(val) { return 'B/.' + val.toFixed(2); }

window.agregarDesdeBusqueda = function(codigo) {
    agregarAlCarrito(codigo, parseInt(document.getElementById('ventaCantidad').value) || 1);
    document.getElementById('scanInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('scanInput').focus();
};

// ===== Modo Jefe =====
function toggleModo() {
    if (modoJefe) {
        modoJefe = false;
        setModoJefe(false);
        localStorage.removeItem('cell_la25_modo_jefe');
        actualizarUI();
        toast('🔒 Modo Empleado', '');
        return;
    }
    document.getElementById('modalJefe').classList.add('active');
    document.getElementById('jefePassword').value = '';
    document.getElementById('jefePassword').focus();
}

function verificarJefe() {
    if (document.getElementById('jefePassword').value === '123456') {
        modoJefe = true;
        setModoJefe(true);
        localStorage.setItem('cell_la25_modo_jefe', JSON.stringify({
            activo: true,
            timestamp: Date.now()
        }));
        document.getElementById('modalJefe').classList.remove('active');
        actualizarUI();
        toast('🔓 Modo Jefe', 'success');
    } else {
        toast('❌ Contraseña incorrecta', 'error');
        document.getElementById('jefePassword').value = '';
        document.getElementById('jefePassword').focus();
    }
}

function restaurarModoJefe() {
    const data = localStorage.getItem('cell_la25_modo_jefe');
    if (data) {
        try {
            const parsed = JSON.parse(data);
            if (parsed.activo && (Date.now() - parsed.timestamp < 8 * 60 * 60 * 1000)) {
                modoJefe = true;
                setModoJefe(true);
                actualizarUI();
                toast('🔓 Modo Jefe restaurado', 'success');
                return;
            } else {
                localStorage.removeItem('cell_la25_modo_jefe');
            }
        } catch (e) {
            localStorage.removeItem('cell_la25_modo_jefe');
        }
    }
}

function actualizarUI() {
    const badge = document.getElementById('modeBadge');
    if (modoJefe) {
        badge.textContent = '👑 Jefe';
        badge.className = 'mode-badge jefe';
    } else {
        badge.textContent = '👤 Empleado';
        badge.className = 'mode-badge';
    }
    // La UI de inventory se actualiza sola con setModoJefe
    loadInventory();
}

// ===== Shortcuts =====
function bindShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (document.getElementById('modalPago').classList.contains('active')) {
                document.getElementById('modalPago').classList.remove('active');
                toast('Cancelado', '');
                return;
            }
            if (document.getElementById('modalEditar').classList.contains('active')) {
                document.getElementById('modalEditar').classList.remove('active');
                return;
            }
            if (document.getElementById('modalAgregar').classList.contains('active')) {
                document.getElementById('modalAgregar').classList.remove('active');
                return;
            }
            if (document.getElementById('modalJefe').classList.contains('active')) {
                document.getElementById('modalJefe').classList.remove('active');
                return;
            }
            if (document.getElementById('modalDevolucion').classList.contains('active')) {
                document.getElementById('modalDevolucion').classList.remove('active');
                return;
            }
            if (document.getElementById('modalExportar').classList.contains('active')) {
                document.getElementById('modalExportar').classList.remove('active');
                return;
            }
            if (document.getElementById('modalPrintSelector').classList.contains('active')) {
                document.getElementById('modalPrintSelector').classList.remove('active');
                return;
            }
            document.getElementById('scanInput').focus();
            return;
        }

        if (e.key === 'F1') { e.preventDefault();
            document.getElementById('scanInput').focus();
            document.getElementById('scanInput').select();
            toast('🔍 Buscar', ''); return; }
        if (e.key === 'F2') { e.preventDefault();
            toggleModo(); return; }
        if (e.key === 'F3') {
            e.preventDefault();
            document.querySelectorAll('#mainNav button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.getElementById('panel-reportes').classList.add('active');
            document.querySelector('#mainNav button[data-panel="panel-reportes"]').classList.add('active');
            renderReport(document.getElementById('reportePeriodo').value);
            return;
        }
        if (e.key === 'F4') {
            e.preventDefault();
            document.querySelectorAll('#mainNav button').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.getElementById('panel-inventario').classList.add('active');
            document.querySelector('#mainNav button[data-panel="panel-inventario"]').classList.add('active');
            return;
        }

        if (document.getElementById('modalPago').classList.contains('active')) {
            if (e.key === '1') { e.preventDefault();
                document.getElementById('pagoSelect').value = 'EFECTIVO';
                document.getElementById('pagoConfirmar').click(); return; }
            if (e.key === '2') { e.preventDefault();
                document.getElementById('pagoSelect').value = 'YAPPY';
                document.getElementById('pagoConfirmar').click(); return; }
            if (e.key === '3') { e.preventDefault();
                document.getElementById('pagoSelect').value = 'TARJETA DE CRÉDITO';
                document.getElementById('pagoConfirmar').click(); return; }
            if (e.key === 'Enter') { e.preventDefault();
                document.getElementById('pagoConfirmar').click(); }
        }

        if (e.key === 'Enter') {
            const modal = document.querySelector('.modal-overlay.active');
            if (modal) {
                const confirmBtn = modal.querySelector('.btn-success');
                if (confirmBtn) {
                    e.preventDefault();
                    confirmBtn.click();
                }
            }
        }
    });
}

// ===== Preparar impresión =====
function preparePrintData(ventaData) {
    const now = new Date();
    const fechaStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const horaStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');
    const noFactura = String(facturaCounter).padStart(6, '0');
    facturaCounter++;

    let itemsHtml = '';
    ventaData.items.forEach(item => {
        const totalItem = item.cantidad * item.precio;
        itemsHtml += `
            <div class="fila"><span class="izq">${item.nombre}</span><span class="der">${formatMoneda(totalItem)}</span></div>
            <div class="fila small" style="font-size:11px;color:#555;"><span class="izq">${item.cantidad} und x ${formatMoneda(item.precio)}</span></div>
        `;
    });

    const subtotal = ventaData.subtotal;
    const impuesto = ventaData.impuesto;
    const total = ventaData.total;
    const tasaStr = ventaData.tasa_impuesto + '%';

    document.getElementById('ticketCliente').textContent = 'Consumidor Final';
    document.getElementById('ticketNo').textContent = '2222/' + noFactura;
    document.getElementById('ticketFecha').textContent = fechaStr;
    document.getElementById('ticketHora').textContent = horaStr;
    document.getElementById('ticketItems').innerHTML = itemsHtml;
    document.getElementById('ticketSubtotal').textContent = formatMoneda(subtotal);
    document.getElementById('ticketImpuestoLabel').textContent = 'Impuesto ' + tasaStr;
    document.getElementById('ticketImpuesto').textContent = formatMoneda(impuesto);
    document.getElementById('ticketTotal').textContent = formatMoneda(total);
    document.getElementById('ticketPagoLabel').textContent = ventaData.pago;
    document.getElementById('ticketPagoMonto').textContent = formatMoneda(total);

    document.getElementById('ticketRespaldoCliente').textContent = 'Consumidor Final';
    document.getElementById('ticketRespaldoNo').textContent = '2222/' + noFactura;
    document.getElementById('ticketRespaldoFecha').textContent = fechaStr;
    document.getElementById('ticketRespaldoHora').textContent = horaStr;
    document.getElementById('ticketRespaldoItems').innerHTML = itemsHtml;
    document.getElementById('ticketRespaldoSubtotal').textContent = formatMoneda(subtotal);
    document.getElementById('ticketRespaldoImpuestoLabel').textContent = 'Impuesto ' + tasaStr;
    document.getElementById('ticketRespaldoImpuesto').textContent = formatMoneda(impuesto);
    document.getElementById('ticketRespaldoTotal').textContent = formatMoneda(total);
    document.getElementById('ticketRespaldoPagoLabel').textContent = ventaData.pago;
    document.getElementById('ticketRespaldoPagoMonto').textContent = formatMoneda(total);
}

function printCliente() {
    const ticket = document.getElementById('ticket');
    const respaldo = document.getElementById('ticketRespaldo');
    respaldo.style.display = 'none';
    ticket.style.display = 'block';
    document.getElementById('modalPrintSelector').classList.remove('active');
    toast('🖨️ Imprimiendo Cliente...', '');
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            ticket.style.display = 'none';
            toast('✅ Cliente impreso', 'success');
        }, 500);
    }, 300);
}

function printRespaldo() {
    const ticket = document.getElementById('ticket');
    const respaldo = document.getElementById('ticketRespaldo');
    ticket.style.display = 'none';
    respaldo.style.display = 'block';
    document.getElementById('modalPrintSelector').classList.remove('active');
    toast('🖨️ Imprimiendo Resguardo...', '');
    setTimeout(() => {
        window.print();
        setTimeout(() => {
            respaldo.style.display = 'none';
            toast('✅ Resguardo impreso', 'success');
        }, 500);
    }, 300);
}

function cancelPrint() {
    document.getElementById('modalPrintSelector').classList.remove('active');
    document.getElementById('ticket').style.display = 'none';
    document.getElementById('ticketRespaldo').style.display = 'none';
    toast('❌ Impresión cancelada', 'error');
}

let facturaCounter = 1;

// ===== Exportar modal =====
function abrirExportar() {
    if (!modoJefe) { toast('🔒 Solo jefe', 'error'); return; }
    document.getElementById('modalExportar').classList.add('active');
}

// ===== Inicialización =====
async function init() {
    restaurarModoJefe();

    // Cargar datos
    await loadInventory();
    renderCarrito();
    renderDevoluciones();

    // Bindear navegación
    bindNavigation();

    // Bindear shortcuts
    bindShortcuts();

    // Bindear eventos de input
    document.getElementById('scanInput').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const val = this.value;
        searchTimeout = setTimeout(() => {
            buscarEnVenta(val);
        }, 200);
    });

    document.getElementById('scanInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstResult = document.querySelector('#searchResults .result-item');
            if (firstResult) {
                const codigo = firstResult.dataset.codigo;
                window.agregarDesdeBusqueda(codigo);
            } else {
                const codigo = this.value.trim();
                if (codigo) {
                    agregarAlCarrito(codigo, parseInt(document.getElementById('ventaCantidad').value) || 1);
                } else {
                    toast('Producto no encontrado', 'error');
                }
            }
        }
    });

    document.getElementById('btnAgregarCarrito').addEventListener('click', function() {
        const codigo = document.getElementById('scanInput').value.trim();
        if (!codigo) { toast('Ingresa un código o nombre', 'error'); return; }
        agregarAlCarrito(codigo, parseInt(document.getElementById('ventaCantidad').value) || 1);
    });

    document.getElementById('btnVenderCancel').addEventListener('click', function() {
        document.getElementById('scanResult').style.display = 'none';
        document.getElementById('scanInput').focus();
    });

    // Carrito
    document.getElementById('btnVaciarCarrito').addEventListener('click', vaciarCarrito);
    document.getElementById('btnFinalizarCompra').addEventListener('click', () => abrirModalPago(null));

    // Pago
    document.getElementById('pagoConfirmar').addEventListener('click', confirmarVenta);
    document.getElementById('pagoCancelar').addEventListener('click', function() {
        document.getElementById('modalPago').classList.remove('active');
        toast('Cancelado', '');
    });

    // Jefe
    document.getElementById('jefeConfirmar').addEventListener('click', verificarJefe);
    document.getElementById('jefeCancelar').addEventListener('click', function() {
        document.getElementById('modalJefe').classList.remove('active');
    });
    document.getElementById('jefePassword').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') verificarJefe();
    });
    document.getElementById('modalJefe').addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });

    // Entrada / Salida
    document.getElementById('btnEntrada').addEventListener('click', async function() {
        if (!modoJefe) { toast('🔒 Solo jefe', 'error'); return; }
        const codigo = document.getElementById('entradaCodigo').value.trim();
        const cantidad = parseInt(document.getElementById('entradaCantidad').value) || 1;
        if (!codigo) { toast('Ingresa código', 'error'); return; }
        const p = findProducto(codigo);
        if (!p) { toast('Producto no encontrado', 'error'); return; }
        p.stock += cantidad;
        await saveProducto(p);
        await loadInventory();
        toast('📥 +' + cantidad + ' ' + p.nombre, 'success');
        document.getElementById('entradaCodigo').value = '';
        document.getElementById('entradaCantidad').value = 1;
    });

    document.getElementById('btnSalida').addEventListener('click', async function() {
        if (!modoJefe) { toast('🔒 Solo jefe', 'error'); return; }
        const codigo = document.getElementById('salidaCodigo').value.trim();
        const cantidad = parseInt(document.getElementById('salidaCantidad').value) || 1;
        if (!codigo) { toast('Ingresa código', 'error'); return; }
        const p = findProducto(codigo);
        if (!p) { toast('Producto no encontrado', 'error'); return; }
        if (p.stock < cantidad) { toast('Stock insuficiente', 'error'); return; }
        p.stock -= cantidad;
        await saveProducto(p);
        await loadInventory();
        toast('📤 -' + cantidad + ' ' + p.nombre, 'success');
        document.getElementById('salidaCodigo').value = '';
        document.getElementById('salidaCantidad').value = 1;
    });

    document.getElementById('entradaCodigo').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('btnEntrada').click();
    });
    document.getElementById('salidaCodigo').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') document.getElementById('btnSalida').click();
    });

    // Devoluciones
    document.getElementById('btnAbrirDevolucion').addEventListener('click', abrirDevolucion);
    document.getElementById('devolucionConfirmar').addEventListener('click', confirmarDevolucion);
    document.getElementById('devolucionCancelar').addEventListener('click', function() {
        document.getElementById('modalDevolucion').classList.remove('active');
    });
    document.getElementById('modalDevolucion').addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });

    // Reportes
    document.getElementById('btnActualizarReporte').addEventListener('click', function() {
        renderReport(document.getElementById('reportePeriodo').value);
    });
    document.getElementById('btnExportarReporte').addEventListener('click', function() {
        exportarReporteCSV(document.getElementById('reportePeriodo').value);
    });

    // Exportar
    document.getElementById('btnExportar').addEventListener('click', abrirExportar);
    document.getElementById('exportarProductos').addEventListener('click', function() {
        document.getElementById('modalExportar').classList.remove('active');
        exportarProductosCSV();
    });
    document.getElementById('exportarVentas').addEventListener('click', function() {
        document.getElementById('modalExportar').classList.remove('active');
        exportarVentasCSV();
    });
    document.getElementById('exportarStock').addEventListener('click', function() {
        document.getElementById('modalExportar').classList.remove('active');
        exportarStockCSV();
    });
    document.getElementById('exportarBackup').addEventListener('click', function() {
        document.getElementById('modalExportar').classList.remove('active');
        exportarBackup();
    });
    document.getElementById('exportarCancelar').addEventListener('click', function() {
        document.getElementById('modalExportar').classList.remove('active');
    });
    document.getElementById('modalExportar').addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });

    // Buscar panel
    document.getElementById('buscarInput').addEventListener('input', function() {
        const q = this.value.toLowerCase().trim();
        const el = document.getElementById('buscarResultados');
        if (!q) { el.innerHTML = 'Escribe para buscar'; return; }
        const productos = getProductos();
        const results = productos.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            p.codigo.toLowerCase().includes(q)
        );
        if (!results.length) { el.innerHTML = '❌ No encontrados'; return; }
        el.innerHTML = results.map(p =>
            `<div style="padding:6px 0;border-bottom:1px solid #f0f2f6;font-size:13px;display:flex;justify-content:space-between;flex-wrap:wrap;">
                <span><span class="codigo-badge">${p.codigo}</span> ${p.nombre}</span>
                <span>📦 ${p.stock} · ${formatMoneda(p.precio)}</span>
            </div>`
        ).join('');
    });

    document.getElementById('buscarInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            this.value = '';
            document.getElementById('buscarResultados').innerHTML = 'Escribe para buscar';
        }
    });

    // Editar (desde inventory.js)
    document.getElementById('editGuardar').addEventListener('click', guardarEdicion);
    document.getElementById('editEliminar').addEventListener('click', eliminarProducto);
    document.getElementById('editCancelar').addEventListener('click', function() {
        document.getElementById('modalEditar').classList.remove('active');
    });
    document.getElementById('modalEditar').addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });

    // Agregar
    document.getElementById('btnAbrirAgregar').addEventListener('click', invAbrirAgregar);
    document.getElementById('agregarGuardar').addEventListener('click', guardarAgregar);
    document.getElementById('agregarCancelar').addEventListener('click', function() {
        document.getElementById('modalAgregar').classList.remove('active');
    });
    document.getElementById('modalAgregar').addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });

    ['agregarCodigo', 'agregarNombre', 'agregarPrecio', 'agregarCosto', 'agregarStock', 'agregarMinimo'].forEach((id, i) => {
        document.getElementById(id).addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const next = ['agregarCodigo', 'agregarNombre', 'agregarPrecio', 'agregarCosto', 'agregarStock', 'agregarMinimo'][i + 1];
                if (next) document.getElementById(next).focus();
                else document.getElementById('agregarGuardar').click();
            }
        });
    });

    // Impresión
    document.getElementById('printClienteBtn').addEventListener('click', printCliente);
    document.getElementById('printRespaldoBtn').addEventListener('click', printRespaldo);
    document.getElementById('printCancelBtn').addEventListener('click', cancelPrint);
    document.getElementById('modalPrintSelector').addEventListener('click', function(e) {
        if (e.target === this) cancelPrint();
    });

    // Exponer preparePrintData a cart.js
    window.preparePrintData = preparePrintData;

    // Exponer toggleModo a window para onclick del badge
    window.toggleModo = toggleModo;

    // Exponer funciones a window para onclick en HTML
    window.abrirAgregar = invAbrirAgregar;

    // Actualizar UI inicial
    actualizarUI();

    // Render inicial
    renderCarrito();
    renderDevoluciones();
    renderReport('hoy');

    // Foco inicial
    if (document.getElementById('panel-venta').classList.contains('active')) {
        document.getElementById('scanInput').focus();
    }

    // Sincronizar cada 30 segundos
    setInterval(() => {
        loadInventory();
    }, 30000);
}

// Iniciar
document.addEventListener('DOMContentLoaded', init);
