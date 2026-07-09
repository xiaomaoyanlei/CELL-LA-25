// app.js
import { loadInventory } from './inventory.js';
import { renderCart } from './cart.js';
import { loadReports, renderReport } from './report.js';
import { fetchProductos } from './supabase.js';

// 全局变量
let modoJefe = false;
let currentPanel = 'panel-venta';

// 初始化
async function init() {
    await loadInventory();
    renderCart();
    await loadReports();
    renderReport('hoy');
    bindNavigation();
    bindShortcuts();
    restoreModoJefe();
}

// 导航切换
function bindNavigation() {
    document.querySelectorAll('.nav button').forEach(btn => {
        btn.addEventListener('click', function() {
            const panel = this.dataset.panel;
            // 切换面板
        });
    });
}

// 快捷键
function bindShortcuts() {
    document.addEventListener('keydown', function(e) {
        if (e.key === 'F1') { /* 搜索 */ }
        if (e.key === 'F2') { /* 老板模式 */ }
        if (e.key === 'F3') { /* 报表 */ }
        if (e.key === 'F4') { /* 库存 */ }
        if (e.key === 'Escape') { /* 关闭弹窗 */ }
        if (e.key === '1' && modalPagoOpen) { /* Efectivo */ }
        if (e.key === '2' && modalPagoOpen) { /* YAPPY */ }
        if (e.key === '3' && modalPagoOpen) { /* Tarjeta */ }
    });
}

// 老板模式
function toggleModo() {
    // ...
}

function restoreModoJefe() {
    // 从localStorage恢复
}

// 启动
document.addEventListener('DOMContentLoaded', init);
