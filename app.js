/* Fontanero 1950 Admin Panel - Business Logic and Bot Simulator */

// CONFIGURACIÓN DE BASE DE DATOS NEON
const DB_CONN_STR = "postgresql://neondb_owner:npg_9Za8KYRFIlkP@ep-patient-dream-at0vuvw4-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";
const DB_ENDPOINT = "https://ep-patient-dream-at0vuvw4-pooler.c-9.us-east-1.aws.neon.tech/sql";

async function dbQuery(query, params = []) {
    try {
        const response = await fetch(DB_ENDPOINT, {
            method: "POST",
            headers: {
                "Neon-Connection-String": DB_CONN_STR,
                "Neon-Raw-Text-Output": "true",
                "Neon-Array-Mode": "true",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ query, params })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Neon SQL error: ${errorText}`);
        }
        
        const data = await response.json();
        if (!data || !data.fields || !data.rows) return [];
        const fields = data.fields;
        return data.rows.map(row => {
            const obj = {};
            row.forEach((val, idx) => {
                obj[fields[idx].name] = val;
            });
            return obj;
        });
    } catch (err) {
        console.error("Database query failed:", err);
        throw err;
    }
}

async function initDatabase() {
    const dbStatusEl = document.getElementById('db-status-text');
    try {
        // Crear tablas si no existen
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS menu_items (
                id VARCHAR PRIMARY KEY,
                name VARCHAR,
                price NUMERIC,
                desc_text VARCHAR
            );
        `);
        
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT PRIMARY KEY,
                client_name VARCHAR,
                client_phone VARCHAR,
                items JSONB,
                subtotal NUMERIC,
                delivery_fee NUMERIC,
                total NUMERIC,
                payment_method VARCHAR,
                address VARCHAR,
                status VARCHAR,
                timestamp_text VARCHAR,
                driver VARCHAR,
                driver_dispatched BOOLEAN
            );
        `);
        
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS customers (
                phone VARCHAR PRIMARY KEY,
                name VARCHAR,
                orders_count INT,
                total_spent NUMERIC,
                fav_dish VARCHAR,
                avg_freq_days INT,
                last_order_date VARCHAR
            );
        `);
        
        await dbQuery(`
            CREATE TABLE IF NOT EXISTS chats (
                id BIGINT PRIMARY KEY,
                client_name VARCHAR,
                client_phone VARCHAR,
                preset VARCHAR,
                chat_state VARCHAR,
                cart JSONB,
                payment JSONB,
                address VARCHAR,
                active BOOLEAN,
                takeover BOOLEAN,
                messages JSONB
            );
        `);
        
        if (dbStatusEl) {
            dbStatusEl.textContent = "Base de Datos Neon: Conectada ⚡";
            dbStatusEl.style.color = "var(--color-secondary)";
        }
        
        // Cargar Menú
        const menuRows = await dbQuery("SELECT * FROM menu_items ORDER BY price ASC");
        if (menuRows.length === 0) {
            for (const item of state.menu) {
                await dbQuery("INSERT INTO menu_items (id, name, price, desc_text) VALUES ($1, $2, $3, $4)", [item.id, item.name, item.price, item.desc]);
            }
        } else {
            state.menu = menuRows.map(r => ({ id: r.id, name: r.name, price: Number(r.price), desc: r.desc_text }));
        }

        // Cargar Pedidos
        const orderRows = await dbQuery("SELECT * FROM orders ORDER BY id ASC");
        if (orderRows.length === 0) {
            for (const o of state.orders) {
                await dbQuery("INSERT INTO orders (id, client_name, client_phone, items, subtotal, delivery_fee, total, payment_method, address, status, timestamp_text, driver, driver_dispatched) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)", 
                    [o.id, o.clientName, o.clientPhone, JSON.stringify(o.items), o.subtotal, o.deliveryFee, o.total, o.paymentMethod, o.address, o.status, o.timestamp, o.driver, o.driverDispatched]);
            }
        } else {
            state.orders = orderRows.map(r => ({
                id: Number(r.id),
                clientName: r.client_name,
                clientPhone: r.client_phone,
                items: typeof r.items === "string" ? JSON.parse(r.items) : r.items,
                subtotal: Number(r.subtotal),
                deliveryFee: Number(r.delivery_fee),
                total: Number(r.total),
                paymentMethod: r.payment_method,
                address: r.address,
                status: r.status,
                timestamp: r.timestamp_text,
                driver: r.driver,
                driverDispatched: r.driver_dispatched
            }));
        }

        // Cargar Clientes
        const customerRows = await dbQuery("SELECT * FROM customers");
        if (customerRows.length === 0) {
            for (const c of state.customers) {
                await dbQuery("INSERT INTO customers (phone, name, orders_count, total_spent, fav_dish, avg_freq_days, last_order_date) VALUES ($1, $2, $3, $4, $5, $6, $7)", 
                    [c.phone, c.name, c.ordersCount, c.totalSpent, c.favDish, c.avgFreqDays, c.lastOrderDate]);
            }
        } else {
            state.customers = customerRows.map(r => ({
                phone: r.phone,
                name: r.name,
                ordersCount: Number(r.orders_count),
                totalSpent: Number(r.total_spent),
                favDish: r.fav_dish,
                avgFreqDays: Number(r.avg_freq_days),
                lastOrderDate: r.last_order_date
            }));
        }

        // Cargar Chats
        const chatRows = await dbQuery("SELECT * FROM chats ORDER BY id ASC");
        state.chats = chatRows.map(r => ({
            id: Number(r.id),
            clientName: r.client_name,
            clientPhone: r.client_phone,
            preset: r.preset,
            state: r.chat_state,
            cart: typeof r.cart === "string" ? JSON.parse(r.cart) : r.cart,
            payment: typeof r.payment === "string" ? JSON.parse(r.payment) : r.payment,
            address: r.address,
            active: r.active,
            takeover: r.takeover,
            messages: typeof r.messages === "string" ? JSON.parse(r.messages) : r.messages
        }));
        
        // Re-renderizado de todo
        renderDashboard();
        renderChatsList();
        renderOrdersTable();
        renderCustomersTab();
        renderConfigMenuList();
        
    } catch (err) {
        console.error("Error al inicializar la base de datos:", err);
        if (dbStatusEl) {
            dbStatusEl.textContent = "Error de Base de Datos ❌";
            dbStatusEl.style.color = "#f43f5e";
        }
    }
}

// ESTADO GLOBAL DE LA APLICACIÓN
const state = {
    // Nombre comercial actualizado
    brandName: 'Fontanero 1950',
    // Catálogo de pizzas
    menu: [
        { id: 'muzarella', name: 'Muzarella', price: 1200, desc: 'Muzarella clásica con aceitunas verdes y orégano.' },
        { id: 'pepperoni', name: 'Pepperoni', price: 1500, desc: 'Queso mozzarella premium y rodajas crujientes de pepperoni.' },
        { id: 'fugazzeta', name: 'Fugazzeta', price: 1400, desc: 'Muzarella, cebolla dulce marinada en aceite de oliva y orégano.' },
        { id: 'especial', name: 'Especial', price: 1600, desc: 'Muzarella, jamón cocido, morrones asados y aceitunas.' }
    ],
    // Lista de repartidores
    repartidores: ['Carlos Gómez', 'Juan López', 'Diego Pérez'],
    // Costo de envío
    deliveryFee: 250,
    // Dirección del local
    pizzeriaAddress: 'Av. Corrientes 1234, Buenos Aires',
    // Mensaje de saludo
    welcomeMsg: '¡Hola! Bienvenido a Pizzería Fontanero 1950. 🍕 ¿Te gustaría ver nuestro menú del día? Responde "SI" para ver la carta.',

    // Pedidos activos e históricos
    orders: [
        {
            id: 1001,
            clientName: 'Sofía Rodríguez',
            clientPhone: '+54 9 11 3421-9988',
            items: [{ name: 'Muzarella', qty: 2, price: 1200 }],
            subtotal: 2400,
            deliveryFee: 250,
            total: 2650,
            paymentMethod: 'Efectivo (Justo)',
            address: 'Pueyrredón 1420, 4to B, CABA',
            status: 'entregado',
            timestamp: 'Hace 2 horas',
            driver: 'Juan López',
            driverDispatched: true
        },
        {
            id: 1002,
            clientName: 'Fernando Pérez',
            clientPhone: '+54 9 11 6543-2109',
            items: [
                { name: 'Pepperoni', qty: 1, price: 1500 },
                { name: 'Fugazzeta', qty: 1, price: 1400 }
            ],
            subtotal: 2900,
            deliveryFee: 250,
            total: 3150,
            paymentMethod: 'Transferencia (Comprobante)',
            address: 'Av. Santa Fe 2300, Palermo',
            status: 'entregado',
            timestamp: 'Hace 1 hora',
            driver: 'Carlos Gómez',
            driverDispatched: true
        }
    ],

    // Registro de clientes con historial predictivo
    customers: [
        {
            name: 'Sofía Rodríguez',
            phone: '+54 9 11 3421-9988',
            ordersCount: 8,
            totalSpent: 19800,
            favDish: 'Muzarella',
            avgFreqDays: 5, // Compra cada 5 días
            lastOrderDate: '2026-06-12' // Último pedido hace 2 días (siguiente en 3 días)
        },
        {
            name: 'Fernando Pérez',
            phone: '+54 9 11 6543-2109',
            ordersCount: 12,
            totalSpent: 31500,
            favDish: 'Fugazzeta',
            avgFreqDays: 4, // Compra cada 4 días
            lastOrderDate: '2026-06-10' // Último pedido hace 4 días (siguiente HOY!)
        },
        {
            name: 'Carlos Díaz',
            phone: '+54 9 11 9988-7766',
            ordersCount: 0,
            totalSpent: 0,
            favDish: 'Ninguno',
            avgFreqDays: 0,
            lastOrderDate: null
        },
        {
            name: 'María Sosa',
            phone: '+54 9 11 3322-1100',
            ordersCount: 0,
            totalSpent: 0,
            favDish: 'Ninguno',
            avgFreqDays: 0,
            lastOrderDate: null
        },
        {
            name: 'Lucas Romero',
            phone: '+54 9 11 8877-6655',
            ordersCount: 0,
            totalSpent: 0,
            favDish: 'Ninguno',
            avgFreqDays: 0,
            lastOrderDate: null
        }
    ],
    
    chats: [],
    
    activityLog: [
        { time: '19:30', type: 'system', text: 'Servicio Fontanero 1950 Bot iniciado y conectado a WhatsApp.' },
        { time: '21:10', type: 'order', text: 'Pedido #1001 entregado con éxito por Juan López.' },
        { time: '22:15', type: 'order', text: 'Pedido #1002 entregado con éxito por Carlos Gómez.' }
    ],

    activeChatId: null,

    hourlyRevenue: {
        '19:00': 0,
        '20:00': 2650,
        '21:00': 3150,
        '22:00': 0,
        'Ahora': 0
    }
};

// SINTETIZADOR DE NOTIFICACIONES (WEB AUDIO API)
function playSound(type) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'message') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(659.25, ctx.currentTime);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } else if (type === 'order') {
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
        }
    } catch (e) {
        console.warn('Audio desactivado por políticas del navegador.');
    }
}

// FORMATO DE VALORES
function formatCurrency(val) {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);
}

function getFormattedTime() {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
}

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    setupNavigation();
    setupGlobalSearch();
    setupChatSystem();
    setupOrdersSystem();
    setupConfigSystem();
    setupPresetSimulator();
    
    // Renderizado Inicial
    renderDashboard();
    renderChatsList();
    renderOrdersTable();
    renderCustomersTab();
    renderActivityLog();
    
    addActivityLog('system', 'Panel de Control de Fontanero 1950 listo.');
    
    // Inicializar conexión con base de datos Neon
    initDatabase();
});

// CLOCK
function initClock() {
    const clockEl = document.getElementById('current-time');
    setInterval(() => {
        clockEl.textContent = getFormattedTime();
    }, 1000);
}

// NAVIGATION
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');

            navItems.forEach(nav => nav.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));

            item.classList.add('active');
            document.getElementById(`tab-${targetTab}`).classList.add('active');
            
            if (targetTab === 'dashboard') {
                renderDashboard();
            } else if (targetTab === 'pedidos') {
                renderOrdersTable();
            } else if (targetTab === 'clientes') {
                renderCustomersTab();
            }
        });
    });
}

// BUSCADOR GLOBAL
function setupGlobalSearch() {
    const searchInput = document.getElementById('global-search');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query === '') {
            renderOrdersTable();
            return;
        }

        const filtered = state.orders.filter(order => 
            order.clientName.toLowerCase().includes(query) ||
            order.clientPhone.includes(query) ||
            order.address.toLowerCase().includes(query) ||
            order.id.toString().includes(query)
        );

        renderOrdersTable(filtered);
    });
}

// ACTIVITY LOG
function addActivityLog(type, text) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    state.activityLog.unshift({ time: timeStr, type, text });
    
    if (state.activityLog.length > 30) {
        state.activityLog.pop();
    }
    renderActivityLog();
}

function renderActivityLog() {
    const logWrapper = document.getElementById('bot-activity-log');
    if (!logWrapper) return;
    
    if (state.activityLog.length === 0) {
        logWrapper.innerHTML = `<div class="log-item empty-state">No hay actividad registrada aún.</div>`;
        return;
    }

    logWrapper.innerHTML = state.activityLog.map(log => `
        <div class="log-item log-${log.type}">
            <span class="log-time">${log.time}</span>
            <span>${log.text}</span>
        </div>
    `).join('');
}

document.getElementById('clear-activity-log').addEventListener('click', () => {
    state.activityLog = [];
    renderActivityLog();
});

// DASHBOARD
function renderDashboard() {
    const totalRevenue = state.orders
        .filter(o => o.status === 'entregado')
        .reduce((sum, o) => sum + o.total, 0);

    const pendingOrdersCount = state.orders
        .filter(o => o.status === 'preparando' || o.status === 'listo').length;

    const deliveringCount = state.orders
        .filter(o => o.status === 'en_camino').length;

    const activeChatsCount = state.chats
        .filter(c => c.active && c.state !== 'COMPLETED').length;

    document.getElementById('stat-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('stat-orders-count').textContent = state.orders.length;
    document.getElementById('stat-pending-label').textContent = `${pendingOrdersCount} pendientes`;
    document.getElementById('stat-delivering-count').textContent = deliveringCount;
    document.getElementById('stat-chats-count').textContent = activeChatsCount;
    
    // Badges Sidebar
    const chatsBadge = document.getElementById('active-chats-badge');
    if (activeChatsCount > 0) {
        chatsBadge.textContent = activeChatsCount;
        chatsBadge.classList.remove('hidden');
    } else {
        chatsBadge.classList.add('hidden');
    }

    const ordersBadge = document.getElementById('pending-orders-badge');
    const totalPending = pendingOrdersCount + deliveringCount;
    if (totalPending > 0) {
        ordersBadge.textContent = totalPending;
        ordersBadge.classList.remove('hidden');
    } else {
        ordersBadge.classList.add('hidden');
    }

    updateRevenueChart(totalRevenue);
}

function updateRevenueChart(totalRevenue) {
    state.hourlyRevenue['Ahora'] = totalRevenue;

    const pathLine = document.getElementById('chart-path-line');
    const pathFill = document.getElementById('chart-path-fill');
    if (!pathLine || !pathFill) return;

    const maxVal = Math.max(8000, totalRevenue + 2000);
    const getY = (val) => 170 - ((val / maxVal) * 140);

    const r19 = getY(1200);
    const r20 = getY(2650);
    const r21 = getY(5800);
    const r22 = getY(totalRevenue * 0.85);
    const rNow = getY(totalRevenue);

    const dAttr = `M 50 170 C 100 ${r19.toFixed(1)}, 130 ${r20.toFixed(1)}, 170 ${r20.toFixed(1)} C 220 ${r21.toFixed(1)}, 260 ${r22.toFixed(1)}, 310 ${r22.toFixed(1)} C 370 ${rNow.toFixed(1)}, 420 ${rNow.toFixed(1)}, 480 ${rNow.toFixed(1)}`;
    pathLine.setAttribute('d', dAttr);

    const dFillAttr = `${dAttr} L 480 170 L 50 170 Z`;
    pathFill.setAttribute('d', dFillAttr);
}

// CHAT & BOT SYSTEM
function setupChatSystem() {
    const inputForm = document.getElementById('chat-input-form');
    const textInput = document.getElementById('chat-text-input');
    const takeoverCheckbox = document.getElementById('bot-takeover-checkbox');
    const attachBtn = document.getElementById('btn-chat-attach');

    // Envío manual
    inputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = textInput.value.trim();
        if (text === '' || !state.activeChatId) return;

        const chat = state.chats.find(c => c.id === state.activeChatId);
        if (!chat) return;

        addChatMessage(chat, 'operator', text);
        textInput.value = '';
        addActivityLog('system', `Dueño respondió a ${chat.clientName}: "${text.substring(0, 15)}..."`);
    });

    // Takeover switch
    takeoverCheckbox.addEventListener('change', (e) => {
        if (!state.activeChatId) return;
        const chat = state.chats.find(c => c.id === state.activeChatId);
        if (!chat) return;

        chat.takeover = !e.target.checked;
        updateChatInputState(chat);
        renderChatsList();
        
        const modeText = chat.takeover ? 'MODO MANUAL' : 'MODO BOT ACTIVO';
        addActivityLog('system', `Chat de ${chat.clientName} en ${modeText}`);
        
        // Guardar takeover en base de datos
        dbQuery("UPDATE chats SET takeover = $1 WHERE id = $2", [chat.takeover, chat.id]).catch(err => console.error(err));

        if (!chat.takeover && chat.state !== 'COMPLETED') {
            runBotDecisionTree(chat, '[RE-ACTIVACIÓN]');
        }
    });

    // Simular adjunto de foto (comprobante)
    attachBtn.addEventListener('click', () => {
        if (!state.activeChatId) return;
        const chat = state.chats.find(c => c.id === state.activeChatId);
        if (!chat || chat.state !== 'PAYMENT_TRANSFER_WAIT') return;

        simulateUserMessage(chat, '[COMPROBANTE_FOTO]');
    });

    document.getElementById('btn-spawn-simulated-client').addEventListener('click', () => {
        spawnSimulatedClient();
    });

    // Controles de navegación móvil (Maestro-Detalle y Drawer de Simulación)
    const whatsappLayout = document.querySelector('.whatsapp-layout');
    
    const btnChatBack = document.getElementById('btn-chat-back');
    if (btnChatBack) {
        btnChatBack.addEventListener('click', () => {
            if (whatsappLayout) whatsappLayout.classList.remove('show-chat');
        });
    }

    const btnToggleHelper = document.getElementById('btn-toggle-helper');
    if (btnToggleHelper) {
        btnToggleHelper.addEventListener('click', () => {
            if (whatsappLayout) whatsappLayout.classList.add('show-helper');
        });
    }

    const btnCloseHelper = document.getElementById('btn-close-helper');
    if (btnCloseHelper) {
        btnCloseHelper.addEventListener('click', () => {
            if (whatsappLayout) whatsappLayout.classList.remove('show-helper');
        });
    }
}

function spawnSimulatedClient() {
    const firstNames = ['Felipe', 'Julieta', 'Agustín', 'Martina', 'Valentin', 'Florencia'];
    const lastNames = ['Suárez', 'Giménez', 'Benítez', 'Flores', 'Vázquez', 'Ortega'];
    
    const randomName = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    const randomPhone = `+54 9 11 ${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const randomId = Date.now();

    const newChat = {
        id: randomId,
        clientName: randomName,
        clientPhone: randomPhone,
        preset: null,
        state: 'WELCOME',
        cart: { pizza: null, qty: null },
        payment: { method: null, type: null, amountPaid: null, change: 0 },
        address: null,
        messages: [],
        active: true,
        takeover: false
    };

    state.chats.push(newChat);
    renderChatsList();
    selectChat(randomId);

    // Guardar chat en base de datos
    dbQuery("INSERT INTO chats (id, client_name, client_phone, preset, chat_state, cart, payment, address, active, takeover, messages) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)", 
        [newChat.id, newChat.clientName, newChat.clientPhone, newChat.preset, newChat.state, JSON.stringify(newChat.cart), JSON.stringify(newChat.payment), newChat.address, newChat.active, newChat.takeover, JSON.stringify(newChat.messages)]
    ).catch(err => console.error(err));

    setTimeout(() => {
        simulateUserMessage(newChat, 'Hola, quiero pedir una pizza.');
    }, 500);
}

function simulateUserMessage(chat, text) {
    addChatMessage(chat, 'user', text);
    playSound('message');
    addActivityLog('chat', `Cliente ${chat.clientName}: "${text === '[COMPROBANTE_FOTO]' ? 'Adjuntó comprobante de pago' : text}"`);

    if (!chat.takeover) {
        showBotTypingIndicator();
        setTimeout(() => {
            hideBotTypingIndicator();
            runBotDecisionTree(chat, text);
        }, 1200);
    }
}

function addChatMessage(chat, sender, text) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    chat.messages.push({ sender, text, time: timeStr });
    
    if (state.activeChatId === chat.id) {
        renderActiveChatMessages();
    }
    renderChatsList();

    // Actualizar chat completo en la base de datos
    dbQuery("UPDATE chats SET messages = $1, chat_state = $2, takeover = $3, cart = $4, payment = $5, address = $6 WHERE id = $7", 
        [JSON.stringify(chat.messages), chat.state, chat.takeover, JSON.stringify(chat.cart), JSON.stringify(chat.payment), chat.address, chat.id]
    ).catch(err => console.error(err));
}

function showBotTypingIndicator() {
    const container = document.getElementById('chat-messages-container');
    if (!container || document.querySelector('.message.typing')) return;

    const typingBubble = document.createElement('div');
    typingBubble.className = 'message bot typing';
    typingBubble.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>`;
    container.appendChild(typingBubble);
    container.scrollTop = container.scrollHeight;
}

function hideBotTypingIndicator() {
    const indicator = document.querySelector('.message.typing');
    if (indicator) indicator.remove();
}

// ÁRBOL DE DECISIONES CON LA NUEVA LÓGICA DE PAGOS
function runBotDecisionTree(chat, userMsg) {
    const msgLower = userMsg.toLowerCase().trim();
    let reply = '';
    let nextState = chat.state;
    const totalOrderPrice = chat.cart.pizza ? (chat.cart.pizza.price * chat.cart.qty) + state.deliveryFee : 0;

    switch (chat.state) {
        case 'WELCOME':
            reply = state.welcomeMsg;
            nextState = 'MENU_SELECT';
            break;

        case 'MENU_SELECT':
            const acceptedYes = ['si', 'sí', 's', 'ver menu', 'menu', 'hola', 'buenas'];
            const matchesYes = acceptedYes.some(term => msgLower.includes(term));
            
            let matchedPizza = null;
            if (!matchesYes) {
                matchedPizza = state.menu.find(p => msgLower.includes(p.name.toLowerCase()));
                if (!matchedPizza) {
                    if (msgLower === '1') matchedPizza = state.menu[0];
                    else if (msgLower === '2') matchedPizza = state.menu[1];
                    else if (msgLower === '3') matchedPizza = state.menu[2];
                    else if (msgLower === '4') matchedPizza = state.menu[3];
                }
            }

            if (matchesYes || msgLower === '[re-activación]') {
                let menuText = 'Aquí tienes nuestro menú de hoy 🍕:\n\n';
                state.menu.forEach((item, index) => {
                    menuText += `*${index + 1}. ${item.name}* (${formatCurrency(item.price)})\n_${item.desc}_\n\n`;
                });
                menuText += '¿Cuál te gustaría pedir? Responde con el *Número* o el *Nombre*.';
                reply = menuText;
            } else if (matchedPizza) {
                chat.cart.pizza = matchedPizza;
                reply = `¡Excelente elección! Elegiste **${matchedPizza.name}** (${formatCurrency(matchedPizza.price)}).\n\n¿Cuántas unidades te gustaría ordenar? (Ingresa un número, ej. 2)`;
                nextState = 'QUANTITY_SELECT';
            } else {
                reply = 'No logré entender tu respuesta. Escribe *SI* para ver la lista de pizzas o escribe el nombre de la pizza.';
            }
            break;

        case 'QUANTITY_SELECT':
            const qty = parseInt(msgLower);
            if (!isNaN(qty) && qty > 0) {
                chat.cart.qty = qty;
                const subtotal = chat.cart.pizza.price * qty;
                const total = subtotal + state.deliveryFee;

                reply = `Perfecto. Detalles de tu orden 📝:\n\n` +
                        `- *Detalle:* ${qty}x Pizza de ${chat.cart.pizza.name}\n` +
                        `- *Subtotal:* ${formatCurrency(subtotal)}\n` +
                        `- *Envío:* ${formatCurrency(state.deliveryFee)}\n` +
                        `- *Total a pagar:* **${formatCurrency(total)}**\n\n` +
                        `¿Confirmamos la compra? Responde *SI* para confirmar o *NO* para empezar de nuevo.`;
                nextState = 'CONFIRMATION';
            } else {
                reply = 'Por favor, ingresa una cantidad numérica válida. Por ejemplo, escribe *1*, *2* o *3*.';
            }
            break;

        case 'CONFIRMATION':
            if (msgLower === 'si' || msgLower === 'sí' || msgLower === 's') {
                reply = `¡Excelente! ¿Cómo prefieres realizar el pago? 💳\n\n` +
                        `Responde:\n` +
                        `👉 *EFECTIVO*\n` +
                        `👉 *TRANSFERENCIA*`;
                nextState = 'PAYMENT_METHOD';
            } else if (msgLower === 'no' || msgLower === 'n') {
                reply = 'Pedido cancelado. Si cambias de opinión o quieres hacer otro pedido, escribe *HOLA*.';
                chat.cart = { pizza: null, qty: null };
                nextState = 'WELCOME';
            } else {
                reply = 'Por favor responde *SI* para confirmar tu pedido o *NO* para cancelarlo.';
            }
            break;

        case 'PAYMENT_METHOD':
            if (msgLower.includes('transferencia') || msgLower.includes('trans') || msgLower === 't') {
                chat.payment.method = 'Transferencia';
                reply = `Perfecto, seleccionaste *Transferencia Bancaria* 💳.\n\n` +
                        `Por favor realiza el envío de **${formatCurrency(totalOrderPrice)}** a nuestra cuenta:\n` +
                        `- *Alias:* fontanero.1950.mp\n` +
                        `- *CBU:* 0000003100000000195011\n` +
                        `- *Banco:* Mercado Pago\n\n` +
                        `Una vez hecha, **envíanos la captura de pantalla o foto del comprobante** por aquí para validar el pedido.`;
                nextState = 'PAYMENT_TRANSFER_WAIT';
            } else if (msgLower.includes('efectivo') || msgLower === 'e') {
                chat.payment.method = 'Efectivo';
                reply = `Seleccionaste *Efectivo* 💵.\n\n` +
                        `¿Vas a pagar con el monto justo o necesitas que el repartidor lleve cambio?\n\n` +
                        `Responde:\n` +
                        `👉 *JUSTO*\n` +
                        `👉 *CAMBIO*`;
                nextState = 'PAYMENT_CASH_DETAILS';
            } else {
                reply = 'Por favor, selecciona un método de pago válido. Escribe *EFECTIVO* o *TRANSFERENCIA*.';
            }
            break;

        case 'PAYMENT_TRANSFER_WAIT':
            if (userMsg === '[COMPROBANTE_FOTO]' || msgLower.includes('comprobante') || msgLower.includes('foto') || msgLower.includes('screenshot')) {
                // Si escribió el texto, pero no cargó la foto real, le simulamos el texto
                if (userMsg !== '[COMPROBANTE_FOTO]') {
                    // Re-enviar la foto simulada para que quede en el historial de chat
                    addChatMessage(chat, 'user', '[COMPROBANTE_FOTO]');
                }
                reply = '¡Comprobante de pago recibido y verificado! 👍\n\nPor último, por favor escribe tu **dirección de entrega completa** (calle, número, departamento/localidad) para despachar tu pizza.';
                nextState = 'ADDRESS_INPUT';
            } else {
                reply = 'Aún no he recibido el comprobante. Por favor, realiza la transferencia y **adjunta la foto del comprobante** para poder avanzar con tu pedido.';
            }
            break;

        case 'PAYMENT_CASH_DETAILS':
            if (msgLower.includes('justo') || msgLower === 'j') {
                chat.payment.type = 'justo';
                chat.payment.amountPaid = totalOrderPrice;
                chat.payment.change = 0;
                
                reply = 'Perfecto. Llevaremos el pedido sin cambio. 👍\n\nPor último, por favor escribe tu **dirección de entrega completa** para enviar tu pedido.';
                nextState = 'ADDRESS_INPUT';
            } else if (msgLower.includes('cambio') || msgLower === 'c') {
                chat.payment.type = 'cambio';
                reply = `¿Con qué billete vas a pagar? Escribe el valor exacto en números (ej. *2000*, *5000*, *10000*) para que calculemos tu vuelto.`;
                // Se queda en este mismo estado, esperando el monto numérico
            } else if (chat.payment.type === 'cambio' && !isNaN(parseFloat(msgLower))) {
                const bill = parseFloat(msgLower);
                if (bill >= totalOrderPrice) {
                    chat.payment.amountPaid = bill;
                    chat.payment.change = bill - totalOrderPrice;
                    
                    reply = `Excelente. Pagas con ${formatCurrency(bill)} y te llevamos **${formatCurrency(chat.payment.change)}** de vuelto. 👍\n\nPor último, por favor escribe tu **dirección de entrega completa** para enviar tu pedido.`;
                    nextState = 'ADDRESS_INPUT';
                } else {
                    reply = `El monto ingresado (${formatCurrency(bill)}) es menor que el total de tu pedido (${formatCurrency(totalOrderPrice)}). Por favor ingresa un billete de mayor valor.`;
                }
            } else {
                reply = 'Por favor responde *JUSTO* si tienes el dinero exacto, o *CAMBIO* si necesitas vuelto.';
            }
            break;

        case 'ADDRESS_INPUT':
            if (userMsg.trim().length > 5) {
                chat.address = userMsg.trim();
                reply = `¡Muchas gracias! Tu pedido ya ingresó a la cocina de **Fontanero 1950** 🍕.\n\nEl repartidor llevará tu comida a *${chat.address}*. ¡Que la disfrutes!`;
                nextState = 'COMPLETED';

                // Registrar en la base de pedidos y de clientes
                createOrderFromChat(chat);
            } else {
                reply = 'La dirección ingresada es muy corta. Por favor escribe calle, número y localidad.';
            }
            break;

        case 'COMPLETED':
            reply = 'Tu pedido ya está en preparación en cocina 🍕. Si quieres agregar algo más o modificar los detalles de entrega, aguarda unos instantes y un empleado del local te responderá manualmente aquí.';
            chat.takeover = true;
            addActivityLog('system', `Chat de ${chat.clientName} en control manual tras pedido completado.`);
            break;
    }

    chat.state = nextState;
    addChatMessage(chat, 'bot', reply);
    playSound('message');
    addActivityLog('bot', `Bot respondió a ${chat.clientName} (Fase: ${nextState})`);
    
    if (state.activeChatId === chat.id) {
        updateChatStateIndicators(chat);
        updateChatInputState(chat);
    }
}

// CREACIÓN DE PEDIDO E INTEGRACIÓN DE CLIENTE
function createOrderFromChat(chat) {
    const orderId = state.orders.length > 0 ? state.orders[state.orders.length - 1].id + 1 : 1001;
    const subtotal = chat.cart.pizza.price * chat.cart.qty;
    const total = subtotal + state.deliveryFee;

    // Métod de pago texto descriptivo
    let paymentDesc = '';
    if (chat.payment.method === 'Transferencia') {
        paymentDesc = '💳 Transf. (Listo)';
    } else {
        paymentDesc = chat.payment.type === 'justo' ? '💵 Efect. (Justo)' : `💵 Efect. (Paga $${chat.payment.amountPaid} - Vuelto $${chat.payment.change})`;
    }

    const newOrder = {
        id: orderId,
        clientName: chat.clientName,
        clientPhone: chat.clientPhone,
        items: [{ name: chat.cart.pizza.name, qty: chat.cart.qty, price: chat.cart.pizza.price }],
        subtotal: subtotal,
        deliveryFee: state.deliveryFee,
        total: total,
        paymentMethod: paymentDesc,
        address: chat.address,
        status: 'preparando',
        timestamp: 'Ahora mismo',
        driver: null,
        driverDispatched: false
    };

    state.orders.push(newOrder);
    playSound('order');
    addActivityLog('order', `¡NUEVO PEDIDO CONFIRMADO! #${orderId} de ${chat.clientName} por ${formatCurrency(total)}`);
    
    // Guardar pedido en base de datos
    dbQuery("INSERT INTO orders (id, client_name, client_phone, items, subtotal, delivery_fee, total, payment_method, address, status, timestamp_text, driver, driver_dispatched) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)", 
        [newOrder.id, newOrder.clientName, newOrder.clientPhone, JSON.stringify(newOrder.items), newOrder.subtotal, newOrder.deliveryFee, newOrder.total, newOrder.paymentMethod, newOrder.address, newOrder.status, newOrder.timestamp, newOrder.driver, newOrder.driverDispatched]
    ).catch(err => console.error(err));

    // Guardar/actualizar base de datos predictiva de clientes
    registerOrUpdateCustomer(newOrder);
    
    // Actualizar UI
    renderDashboard();
    renderOrdersTable();
}

// REGISTRO PREDICTIVO DE CLIENTES
function registerOrUpdateCustomer(order) {
    let client = state.customers.find(c => c.phone === order.clientPhone);
    const todayStr = '2026-06-14';

    if (!client) {
        client = {
            name: order.clientName,
            phone: order.clientPhone,
            ordersCount: 1,
            totalSpent: order.total,
            favDish: order.items[0].name,
            avgFreqDays: 5, // Valor inicial promedio
            lastOrderDate: todayStr
        };
        state.customers.push(client);
    } else {
        // Recalcular estadísticas
        client.ordersCount += 1;
        client.totalSpent += order.total;
        
        // Frecuencia promedio (simulamos ajuste: si era 0, poner 4; si ya existía, ajustar levemente)
        if (client.avgFreqDays === 0) {
            client.avgFreqDays = 4;
        }
        
        client.lastOrderDate = todayStr;
        
        // Comida preferida
        if (client.favDish === 'Ninguno') {
            client.favDish = order.items[0].name;
        }
    }

    // Guardar o actualizar cliente en base de datos
    dbQuery("INSERT INTO customers (phone, name, orders_count, total_spent, fav_dish, avg_freq_days, last_order_date) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, orders_count = EXCLUDED.orders_count, total_spent = EXCLUDED.total_spent, fav_dish = EXCLUDED.fav_dish, avg_freq_days = EXCLUDED.avg_freq_days, last_order_date = EXCLUDED.last_order_date", 
        [client.phone, client.name, client.ordersCount, client.totalSpent, client.favDish, client.avgFreqDays, client.lastOrderDate]
    ).catch(err => console.error(err));

    renderCustomersTab();
}

// RENDER PESTAÑA CLIENTES
function renderCustomersTab() {
    const tbody = document.getElementById('customers-table-body');
    if (!tbody) return;

    // Filtrar sólo clientes con compras
    const activeCustomers = state.customers.filter(c => c.ordersCount > 0);

    // Calcular KPI de clientes
    const totalCustomers = activeCustomers.length;
    
    let avgFreqVal = 'Cada 4.5 días';
    if (totalCustomers > 0) {
        const sumFreq = activeCustomers.reduce((sum, c) => sum + c.avgFreqDays, 0);
        avgFreqVal = `Cada ${(sumFreq / totalCustomers).toFixed(1)} días`;
    }
    
    // Plato preferido general
    const dishCounts = {};
    activeCustomers.forEach(c => {
        if (c.favDish !== 'Ninguno') {
            dishCounts[c.favDish] = (dishCounts[c.favDish] || 0) + 1;
        }
    });
    let topDish = 'Muzarella';
    let maxCount = 0;
    for (const dish in dishCounts) {
        if (dishCounts[dish] > maxCount) {
            maxCount = dishCounts[dish];
            topDish = dish;
        }
    }

    // Pedidos estimados en la semana (hoy o mañana)
    let upcomingCount = 0;
    activeCustomers.forEach(c => {
        const prediction = calculateNextOrderPrediction(c);
        if (prediction.label.includes('Hoy') || prediction.label.includes('Mañana')) {
            upcomingCount++;
        }
    });

    // Actualizar KPI
    document.getElementById('c-stat-total').textContent = totalCustomers;
    document.getElementById('c-stat-avg-freq').textContent = avgFreqVal;
    document.getElementById('c-stat-top-dish').textContent = topDish;
    document.getElementById('c-stat-upcoming').textContent = upcomingCount;

    if (activeCustomers.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-table-row">
                <td colspan="8" class="text-center">No hay clientes con compras registradas. Completa un pedido simulado para ver datos aquí.</td>
            </tr>`;
        return;
    }

    tbody.innerHTML = activeCustomers.map(c => {
        const prediction = calculateNextOrderPrediction(c);
        const lastOrderFormatted = c.lastOrderDate === '2026-06-14' ? 'Hoy' : c.lastOrderDate;

        return `
            <tr>
                <td><span class="client-name">${c.name}</span></td>
                <td><span class="client-phone">${c.phone}</span></td>
                <td><span class="order-id-badge">${c.ordersCount}</span></td>
                <td class="order-total-cell">${formatCurrency(c.totalSpent)}</td>
                <td><strong>🍕 ${c.favDish}</strong></td>
                <td>Cada ${c.avgFreqDays} días</td>
                <td>${lastOrderFormatted}</td>
                <td><span class="prediction-badge ${prediction.class}">${prediction.label}</span></td>
            </tr>
        `;
    }).join('');
}

// CÁLCULO DE PREDICCIÓN DE PRÓXIMO PEDIDO
function calculateNextOrderPrediction(client) {
    if (!client.lastOrderDate || client.ordersCount < 1) {
        return { label: 'Sin historial', class: 'far' };
    }

    const lastDate = new Date(client.lastOrderDate + 'T00:00:00');
    const today = new Date('2026-06-14T00:00:00'); // Sincronizado con fecha local
    
    // Siguiente pedido = última fecha + días de frecuencia promedio
    const nextDate = new Date(lastDate.getTime() + client.avgFreqDays * 24 * 60 * 60 * 1000);
    
    const diffTime = nextDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return { label: 'Hoy 🚨', class: 'soon' };
    } else if (diffDays < 0) {
        return { label: 'Demorado ⚠️', class: 'soon' };
    } else if (diffDays === 1) {
        return { label: 'Mañana', class: 'normal' };
    } else {
        return { label: `En ${diffDays} días`, class: 'far' };
    }
}

// LISTA DE CONVERSACIONES SIDEBAR
function renderChatsList() {
    const listContainer = document.getElementById('chats-list-container');
    if (!listContainer) return;

    if (state.chats.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-chats-state">
                <p>No hay chats activos en este momento.</p>
                <p>Haz clic en "Simular Cliente" para probar el chatbot.</p>
            </div>`;
        return;
    }

    listContainer.innerHTML = state.chats.map(chat => {
        const lastMsg = chat.messages[chat.messages.length - 1];
        let lastMsgText = 'Conversación iniciada';
        if (lastMsg) {
            lastMsgText = lastMsg.text === '[COMPROBANTE_FOTO]' ? '📷 Comprobante_Pago.png' : lastMsg.text;
        }
        const lastMsgTime = lastMsg ? lastMsg.time : '';
        const activeClass = state.activeChatId === chat.id ? 'active' : '';
        
        let stateText = 'Iniciado';
        let badgeClass = 'active-step';

        if (chat.takeover) {
            stateText = 'Manual Intervenido';
            badgeClass = 'takeover-step';
        } else {
            switch (chat.state) {
                case 'WELCOME': stateText = 'Bienvenida'; break;
                case 'MENU_SELECT': stateText = 'Eligiendo menú'; break;
                case 'QUANTITY_SELECT': stateText = 'Cantidad'; break;
                case 'CONFIRMATION': stateText = 'Confirmando'; break;
                case 'PAYMENT_METHOD': stateText = 'Medio Pago'; break;
                case 'PAYMENT_TRANSFER_WAIT': stateText = 'Esperando Captura'; break;
                case 'PAYMENT_CASH_DETAILS': stateText = 'Cambio / Vuelto'; break;
                case 'ADDRESS_INPUT': stateText = 'Dirección'; break;
                case 'COMPLETED': 
                    stateText = 'Pedido listo'; 
                    badgeClass = 'completed-step';
                    break;
            }
        }

        return `
            <div class="chat-list-item ${activeClass}" onclick="selectChat(${chat.id})">
                <div class="user-avatar">${chat.clientName[0]}</div>
                <div class="chat-list-item-info">
                    <div class="chat-list-item-meta">
                        <span class="chat-list-item-name">${chat.clientName}</span>
                        <span class="chat-list-item-time">${lastMsgTime}</span>
                    </div>
                    <p class="chat-list-item-lastmsg">${lastMsgText}</p>
                    <span class="chat-status-badge ${badgeClass}">${stateText}</span>
                </div>
            </div>
        `;
    }).join('');
}

// SELECCIÓN DE CHAT ACTIVO
window.selectChat = function(chatId) {
    state.activeChatId = chatId;
    
    document.getElementById('chat-empty-view').classList.add('hidden');
    document.getElementById('chat-active-view').classList.remove('hidden');

    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    document.getElementById('active-chat-avatar').textContent = chat.clientName[0];
    document.getElementById('active-chat-name').textContent = chat.clientName;
    document.getElementById('bot-takeover-checkbox').checked = !chat.takeover;

    renderActiveChatMessages();
    updateChatStateIndicators(chat);
    updateChatInputState(chat);
    renderChatsList();

    // Deslizar para mostrar el chat activo en móvil
    const whatsappLayout = document.querySelector('.whatsapp-layout');
    if (whatsappLayout) {
        whatsappLayout.classList.add('show-chat');
    }
};

function renderActiveChatMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container || !state.activeChatId) return;

    const chat = state.chats.find(c => c.id === state.activeChatId);
    if (!chat) return;

    if (chat.messages.length === 0) {
        container.innerHTML = `<div class="text-center text-muted" style="margin: auto; font-size: 0.8rem;">No hay mensajes.</div>`;
        return;
    }

    container.innerHTML = chat.messages.map(msg => {
        // Tratamiento especial de la foto del comprobante
        if (msg.text === '[COMPROBANTE_FOTO]') {
            return `
                <div class="message user image-msg">
                    <div class="screenshot-preview-container">
                        <div class="screenshot-mock-img" style="background: linear-gradient(135deg, #0d5c3a, #15803d); height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white;">
                            <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">💳</div>
                            <div style="font-weight: 700; font-size: 0.8rem;">Mercado Pago</div>
                            <div style="font-size: 0.6rem; opacity: 0.7;">Transferencia Exitosa</div>
                        </div>
                    </div>
                    <div class="screenshot-text-tag">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: var(--color-text-muted);">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>Comprobante_Pago.png</span>
                    </div>
                    <div class="message-meta">
                        <span>${msg.time}</span>
                    </div>
                </div>
            `;
        }

        let senderClass = 'user';
        if (msg.sender === 'bot') senderClass = 'bot';
        else if (msg.sender === 'operator') senderClass = 'operator';

        const showChecks = msg.sender === 'bot' || msg.sender === 'operator';
        let textFormatted = msg.text.replace(/\n/g, '<br>');
        textFormatted = textFormatted.replace(/\*(.*?)\*/g, '<strong>$1</strong>');

        return `
            <div class="message ${senderClass}">
                <div>${textFormatted}</div>
                <div class="message-meta">
                    <span>${msg.time}</span>
                    ${showChecks ? `
                        <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                            <polyline points="20 12 9 23 4 18" style="transform: translate(2px, -3px)"/>
                        </svg>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

// Sincroniza indicadores del Sidebar derecho de etapas
function updateChatStateIndicators(chat) {
    const steps = ['welcome', 'menu', 'quantity', 'confirm', 'payment', 'payment-check', 'address', 'done'];
    steps.forEach(step => {
        document.getElementById(`step-${step}`).className = 'state-step';
    });

    const botStatusEl = document.getElementById('active-chat-bot-status');
    const labelText = document.getElementById('toggle-label-text');

    if (chat.takeover) {
        botStatusEl.textContent = 'Intervenido por operador';
        botStatusEl.style.color = 'var(--color-accent)';
        labelText.textContent = 'Bot Apagado / Manual';
        return;
    }

    botStatusEl.style.color = 'var(--color-secondary)';
    labelText.textContent = 'Modo Bot Activo';

    let activeStep = '';
    switch (chat.state) {
        case 'WELCOME':
            activeStep = 'welcome';
            botStatusEl.textContent = 'Esperando saludo...';
            break;
        case 'MENU_SELECT':
            activeStep = 'menu';
            botStatusEl.textContent = 'Bot mostrando menú...';
            break;
        case 'QUANTITY_SELECT':
            activeStep = 'quantity';
            botStatusEl.textContent = 'Bot procesando cantidad...';
            break;
        case 'CONFIRMATION':
            activeStep = 'confirm';
            botStatusEl.textContent = 'Esperando confirmación...';
            break;
        case 'PAYMENT_METHOD':
            activeStep = 'payment';
            botStatusEl.textContent = 'Seleccionando método de pago...';
            break;
        case 'PAYMENT_TRANSFER_WAIT':
            activeStep = 'payment-check';
            botStatusEl.textContent = 'Esperando comprobante de transferencia...';
            break;
        case 'PAYMENT_CASH_DETAILS':
            activeStep = 'payment-check';
            botStatusEl.textContent = 'Procesando cambio/vuelto...';
            break;
        case 'ADDRESS_INPUT':
            activeStep = 'address';
            botStatusEl.textContent = 'Esperando dirección...';
            break;
        case 'COMPLETED':
            activeStep = 'done';
            botStatusEl.textContent = 'Pedido finalizado';
            botStatusEl.style.color = 'var(--color-text-muted)';
            break;
    }

    let foundActive = false;
    for (let i = 0; i < steps.length; i++) {
        const stepId = steps[i];
        const stepEl = document.getElementById(`step-${stepId}`);
        
        if (stepId === activeStep) {
            stepEl.classList.add('active');
            foundActive = true;
        } else if (!foundActive) {
            stepEl.classList.add('completed');
        }
    }
}

// Sincroniza estado de los inputs
function updateChatInputState(chat) {
    const inputField = document.getElementById('chat-text-input');
    const sendBtn = document.getElementById('chat-send-btn');
    const attachBtn = document.getElementById('btn-chat-attach');

    // Habilitar clip adjunto si el bot está activo y esperando el comprobante
    if (!chat.takeover && chat.state === 'PAYMENT_TRANSFER_WAIT') {
        attachBtn.removeAttribute('disabled');
        attachBtn.setAttribute('title', 'Cargar captura del comprobante');
    } else {
        attachBtn.setAttribute('disabled', 'true');
        attachBtn.setAttribute('title', 'Adjuntos inactivos (solo en fase de transferencia)');
    }

    if (chat.takeover) {
        inputField.removeAttribute('disabled');
        sendBtn.removeAttribute('disabled');
        inputField.placeholder = 'Escribe un mensaje de respuesta manual...';
    } else {
        inputField.setAttribute('disabled', 'true');
        sendBtn.setAttribute('disabled', 'true');
        inputField.placeholder = 'El bot tiene el control. Desactiva "Modo Bot Activo" para escribir...';
    }
}

// GESTIÓN DE PEDIDOS
let activeFilter = 'all';

function setupOrdersSystem() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFilter = tab.getAttribute('data-filter');
            renderOrdersTable();
        });
    });

    document.getElementById('btn-close-dispatch-modal').addEventListener('click', hideDispatchModal);
    document.getElementById('btn-close-dispatch-confirm').addEventListener('click', confirmDispatchDelivery);
}

function renderOrdersTable(dataToRender = null) {
    const tbody = document.getElementById('orders-table-body');
    if (!tbody) return;

    const orders = dataToRender || state.orders;
    
    const filteredOrders = orders.filter(order => {
        if (activeFilter === 'all') return true;
        return order.status === activeFilter;
    });

    document.getElementById('count-all-orders').textContent = state.orders.length;
    document.getElementById('count-pending-orders').textContent = state.orders.filter(o => o.status === 'preparando').length;
    document.getElementById('count-ready-orders').textContent = state.orders.filter(o => o.status === 'listo').length;
    document.getElementById('count-dispatched-orders').textContent = state.orders.filter(o => o.status === 'en_camino').length;
    document.getElementById('count-delivered-orders').textContent = state.orders.filter(o => o.status === 'entregado').length;

    if (filteredOrders.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-table-row">
                <td colspan="9" class="text-center">No hay pedidos registrados en este estado. Completa una compra en el Chatbot para ver un pedido aquí.</td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filteredOrders.map(order => {
        const itemsList = order.items.map(item => `<span class="pizza-qty-badge">${item.qty}</span>${item.name}`).join('<br>');
        
        let driverSelectHTML = '';
        if (order.status === 'preparando' || order.status === 'listo') {
            driverSelectHTML = `
                <select class="driver-select" onchange="assignDriver(${order.id}, this.value)">
                    <option value="">-- Seleccionar --</option>
                    ${state.repartidores.map(r => `<option value="${r}" ${order.driver === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
            `;
        } else {
            driverSelectHTML = `<span>🚴 ${order.driver || 'No asignado'}</span>`;
        }

        let statusBadge = '';
        switch (order.status) {
            case 'preparando': statusBadge = '<span class="status-cell-badge pending">En Cocina</span>'; break;
            case 'listo': statusBadge = '<span class="status-cell-badge ready">Listo / Esperando</span>'; break;
            case 'en_camino': statusBadge = '<span class="status-cell-badge dispatched">En Camino</span>'; break;
            case 'entregado': statusBadge = '<span class="status-cell-badge delivered">Entregado</span>'; break;
        }

        let actionButtonHTML = '';
        if (order.status === 'preparando') {
            actionButtonHTML = `<button class="btn btn-outline btn-small" onclick="advanceOrderStatus(${order.id}, 'listo')">Listo para enviar</button>`;
        } else if (order.status === 'listo') {
            const disableDispatch = !order.driver;
            actionButtonHTML = `<button class="btn btn-primary btn-small" ${disableDispatch ? 'disabled title="Asigna un repartidor primero"' : ''} onclick="openDispatchModal(${order.id})">Despachar</button>`;
        } else if (order.status === 'en_camino') {
            actionButtonHTML = `<button class="btn btn-whatsapp-direct btn-small" onclick="advanceOrderStatus(${order.id}, 'entregado')">Entregado</button>`;
        } else {
            actionButtonHTML = '<span class="text-muted" style="font-size:0.75rem;">Finalizado ✓</span>';
        }

        return `
            <tr>
                <td><span class="order-id-badge">#${order.id}</span></td>
                <td>
                    <div class="client-info-cell">
                        <span class="client-name">${order.clientName}</span>
                        <span class="client-phone">${order.clientPhone}</span>
                    </div>
                </td>
                <td class="order-details-cell">${itemsList}</td>
                <td><span style="font-size:0.8rem; font-weight:600;">${order.paymentMethod}</span></td>
                <td class="order-total-cell">${formatCurrency(order.total)}</td>
                <td class="address-cell" title="${order.address}">${order.address}</td>
                <td>${driverSelectHTML}</td>
                <td>${statusBadge}</td>
                <td class="actions-cell-container">${actionButtonHTML}</td>
            </tr>
        `;
    }).join('');
}

// Función auxiliar para enviar notificación automática de despacho al cliente vía WhatsApp
function sendOutboundDispatchNotification(order) {
    const chat = state.chats.find(c => c.clientPhone === order.clientPhone);
    if (!chat) return;

    const itemsText = order.items.map(item => `${item.qty}x Pizza de ${item.name}`).join(' y ');
    const msg = `¡Tu pedido ya salió del local! 🍕🛵 Tu *${itemsText}* va en camino. El repartidor (*${order.driver || 'Nuestro Delivery'}*) 🚴 ya tiene tu dirección y llegará en breve. ¡Que disfrutes tu comida! 🍕🛵💨`;

    addChatMessage(chat, 'bot', msg);
    playSound('message');
    addActivityLog('bot', `Notificación de despacho enviada a ${chat.clientName} vía WhatsApp.`);
}

window.advanceOrderStatus = function(orderId, newStatus) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    order.status = newStatus;

    if (newStatus === 'entregado') {
        addActivityLog('delivery', `Pedido #${orderId} de ${order.clientName} entregado con éxito por ${order.driver}.`);
        addActivityLog('system', `Ingresos sumados: +${formatCurrency(order.total)}`);
    } else if (newStatus === 'en_camino') {
        addActivityLog('delivery', `Pedido #${orderId} de ${order.clientName} despachado. En camino.`);
        sendOutboundDispatchNotification(order);
    } else if (newStatus === 'listo') {
        addActivityLog('order', `Pedido #${orderId} de ${order.clientName} está en bandeja de despacho.`);
    }

    // Actualizar estado del pedido en base de datos
    dbQuery("UPDATE orders SET status = $1 WHERE id = $2", [newStatus, orderId]).catch(err => console.error(err));

    renderDashboard();
    renderOrdersTable();
};

window.assignDriver = function(orderId, driverName) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    order.driver = driverName || null;
    
    if (order.driver && order.status === 'preparando') {
        order.status = 'listo';
    }

    addActivityLog('system', `Pedido #${orderId} asignado a: ${driverName || 'Ninguno'}`);
    
    // Actualizar repartidor y estado en base de datos
    dbQuery("UPDATE orders SET driver = $1, status = $2 WHERE id = $3", [order.driver, order.status, orderId]).catch(err => console.error(err));

    renderDashboard();
    renderOrdersTable();
};

// MODAL DESPACHO
let selectedDispatchOrderId = null;

window.openDispatchModal = function(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order || !order.driver) return;

    selectedDispatchOrderId = orderId;

    document.getElementById('dispatch-driver-name').textContent = order.driver;
    document.getElementById('dispatch-client-name').textContent = order.clientName;
    document.getElementById('dispatch-client-address').textContent = order.address;
    
    const itemsText = order.items.map(item => `${item.qty}x ${item.name}`).join(', ');
    document.getElementById('dispatch-order-items').textContent = itemsText;

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
    document.getElementById('link-maps-redirect').setAttribute('href', mapsUrl);

    // Plantilla WhatsApp
    const messageTemplate = `*FONTANERO 1950 - NUEVO REPARTO* 🚴\n\n` +
        `*Repartidor:* ${order.driver}\n` +
        `*Cliente:* ${order.clientName} (${order.clientPhone})\n` +
        `*Pedido:* ${itemsText}\n` +
        `*Pago:* ${order.paymentMethod}\n` +
        `*Dirección:* ${order.address}\n\n` +
        `*Ubicación (Maps):* ${mapsUrl}`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(messageTemplate)}`;
    document.getElementById('link-whatsapp-redirect').setAttribute('href', whatsappUrl);

    document.getElementById('dispatch-modal').classList.remove('hidden');
    addActivityLog('delivery', `Abierto panel de despacho para #${orderId}.`);
};

function hideDispatchModal() {
    document.getElementById('dispatch-modal').classList.add('hidden');
    selectedDispatchOrderId = null;
}

function confirmDispatchDelivery() {
    if (selectedDispatchOrderId) {
        const order = state.orders.find(o => o.id === selectedDispatchOrderId);
        if (order) {
            order.status = 'en_camino';
            order.driverDispatched = true;
            addActivityLog('delivery', `Pedido #${order.id} despachado. ${order.driver} en viaje.`);
            sendOutboundDispatchNotification(order);

            // Actualizar despacho en base de datos
            dbQuery("UPDATE orders SET status = 'en_camino', driver_dispatched = true WHERE id = $1", [order.id]).catch(err => console.error(err));
        }
    }
    hideDispatchModal();
    renderDashboard();
    renderOrdersTable();
}

// CONFIGURACIÓN
function setupConfigSystem() {
    const menuForm = document.getElementById('menu-item-form');
    const configForm = document.getElementById('bot-config-form');

    document.getElementById('config-welcome-msg').value = state.welcomeMsg;
    document.getElementById('config-delivery-fee').value = state.deliveryFee;
    document.getElementById('config-pizzeria-address').value = state.pizzeriaAddress;
    document.getElementById('config-repartidores-list').value = state.repartidores.join(', ');

    renderConfigMenuList();

    configForm.addEventListener('submit', (e) => {
        e.preventDefault();
        state.welcomeMsg = document.getElementById('config-welcome-msg').value;
        state.deliveryFee = parseFloat(document.getElementById('config-delivery-fee').value);
        state.pizzeriaAddress = document.getElementById('config-pizzeria-address').value;
        
        const repText = document.getElementById('config-repartidores-list').value;
        state.repartidores = repText.split(',').map(s => s.trim()).filter(s => s.length > 0);

        addActivityLog('system', 'Configuración de Fontanero 1950 actualizada.');
        alert('Configuración guardada.');
        renderDashboard();
    });

    document.getElementById('btn-add-menu-item').addEventListener('click', () => openMenuModal());
    document.getElementById('btn-close-menu-modal').addEventListener('click', closeMenuModal);
    document.getElementById('btn-cancel-menu-modal').addEventListener('click', closeMenuModal);

    menuForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const itemId = document.getElementById('menu-item-id').value;
        const itemName = document.getElementById('menu-item-name').value;
        const itemDesc = document.getElementById('menu-item-description').value;
        const itemPrice = parseFloat(document.getElementById('menu-item-price').value);

        if (itemId) {
            const pizza = state.menu.find(p => p.id === itemId);
            if (pizza) {
                pizza.name = itemName;
                pizza.desc = itemDesc;
                pizza.price = itemPrice;
                addActivityLog('system', `Menú modificado: Pizza de ${itemName}`);
                
                // Actualizar en base de datos
                dbQuery("UPDATE menu_items SET name = $1, desc_text = $2, price = $3 WHERE id = $4", [itemName, itemDesc, itemPrice, itemId]).catch(err => console.error(err));
            }
        } else {
            const newId = itemName.toLowerCase().replace(/\s+/g, '-');
            state.menu.push({ id: newId, name: itemName, price: itemPrice, desc: itemDesc });
            addActivityLog('system', `Nueva pizza agregada: ${itemName}`);
            
            // Insertar en base de datos
            dbQuery("INSERT INTO menu_items (id, name, price, desc_text) VALUES ($1, $2, $3, $4)", [newId, itemName, itemPrice, itemDesc]).catch(err => console.error(err));
        }

        closeMenuModal();
        renderConfigMenuList();
    });
}

function renderConfigMenuList() {
    const list = document.getElementById('config-menu-list');
    if (!list) return;

    list.innerHTML = state.menu.map(pizza => `
        <div class="menu-item-row">
            <div class="menu-item-details">
                <h4>${pizza.name}</h4>
                <p>${pizza.desc}</p>
            </div>
            <div class="menu-item-price-box">
                <span class="menu-item-price-value">${formatCurrency(pizza.price)}</span>
                <button class="btn-icon-only" onclick="deleteMenuItem('${pizza.id}')" title="Eliminar del menú">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px; height:16px;">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

window.deleteMenuItem = function(id) {
    if (state.menu.length <= 1) {
        alert('Debes mantener al menos una pizza.');
        return;
    }
    const pizza = state.menu.find(p => p.id === id);
    if (!pizza) return;

    if (confirm(`¿Seguro que deseas eliminar la pizza de ${pizza.name} del menú?`)) {
        state.menu = state.menu.filter(p => p.id !== id);
        addActivityLog('system', `Eliminada pizza del menú: ${pizza.name}`);
        
        // Eliminar de base de datos
        dbQuery("DELETE FROM menu_items WHERE id = $1", [id]).catch(err => console.error(err));
        
        renderConfigMenuList();
    }
};

function openMenuModal(pizzaId = null) {
    const form = document.getElementById('menu-item-form');
    form.reset();

    if (pizzaId) {
        const pizza = state.menu.find(p => p.id === pizzaId);
        if (pizza) {
            document.getElementById('menu-modal-title').textContent = 'Editar Pizza';
            document.getElementById('menu-item-id').value = pizza.id;
            document.getElementById('menu-item-name').value = pizza.name;
            document.getElementById('menu-item-description').value = pizza.desc;
            document.getElementById('menu-item-price').value = pizza.price;
        }
    } else {
        document.getElementById('menu-modal-title').textContent = 'Agregar Pizza al Menú';
        document.getElementById('menu-item-id').value = '';
    }

    document.getElementById('menu-item-modal').classList.remove('hidden');
}

function closeMenuModal() {
    document.getElementById('menu-item-modal').classList.add('hidden');
}

// PRESET SIMULATION CON NUEVAS ETAPAS DE PAGO
function setupPresetSimulator() {
    const buttons = document.querySelectorAll('.btn-sim-client');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const presetType = btn.getAttribute('data-client-preset');
            runPresetSimulation(presetType);
        });
    });
}

function runPresetSimulation(presetType) {
    let clientName = '';
    let clientPhone = '';
    let steps = [];

    if (presetType === 'carlos') {
        clientName = 'Carlos Díaz';
        clientPhone = '+54 9 11 9988-7766';
        steps = [
            { text: 'Hola, buenas noches. Quiero ordenar una pizza.', delay: 200 },
            { text: 'SI', delay: 2000 },
            { text: 'Pepperoni', delay: 2500 },
            { text: '2', delay: 2500 },
            { text: 'SI', delay: 2500 },
            { text: 'transferencia', delay: 2500 },
            { text: '[COMPROBANTE_FOTO]', delay: 3500 }, // Sube comprobante simulado
            { text: 'Av. Rivadavia 4500, Caballito, CABA', delay: 2500 }
        ];
    } else if (presetType === 'maria') {
        clientName = 'María Sosa';
        clientPhone = '+54 9 11 3322-1100';
        steps = [
            { text: 'Hola, ¿están atendiendo?', delay: 200 },
            { text: 'si', delay: 2000 },
            { text: 'Muzarella', delay: 2500 },
            { text: '1', delay: 2500 },
            { text: 'si', delay: 2500 },
            { text: 'efectivo', delay: 2500 },
            { text: 'justo', delay: 2500 },
            { text: 'Bulnes 1200, Palermo', delay: 2500 }
        ];
    } else if (presetType === 'lucas') {
        clientName = 'Lucas Romero';
        clientPhone = '+54 9 11 8877-6655';
        // Compra 2 pizzas Especiales ($3200 + $250 envío = $3450), paga en efectivo con $5000 (vuelto $1550)
        steps = [
            { text: 'Hola, ¿qué pizzas tienen?', delay: 200 },
            { text: 'si', delay: 2000 },
            { text: 'Especial', delay: 2500 },
            { text: '2', delay: 2500 },
            { text: 'SI', delay: 2500 },
            { text: 'efectivo', delay: 2500 },
            { text: 'cambio', delay: 2500 },
            { text: '5000', delay: 2500 },
            { text: 'Bartolomé Mitre 150, Piso 2, Avellaneda', delay: 2500 }
        ];
    }

    document.querySelector('[data-tab="chats"]').click();

    // Ocultar el drawer de simulación móvil al iniciar
    const whatsappLayout = document.querySelector('.whatsapp-layout');
    if (whatsappLayout) {
        whatsappLayout.classList.remove('show-helper');
    }

    const randomId = Date.now();
    const chat = {
        id: randomId,
        clientName: clientName,
        clientPhone: clientPhone,
        preset: presetType,
        state: 'WELCOME',
        cart: { pizza: null, qty: null },
        payment: { method: null, type: null, amountPaid: null, change: 0 },
        address: null,
        messages: [],
        active: true,
        takeover: false
    };

    state.chats.push(chat);
    renderChatsList();
    selectChat(randomId);

    // Guardar chat en base de datos
    dbQuery("INSERT INTO chats (id, client_name, client_phone, preset, chat_state, cart, payment, address, active, takeover, messages) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)", 
        [chat.id, chat.clientName, chat.clientPhone, chat.preset, chat.state, JSON.stringify(chat.cart), JSON.stringify(chat.payment), chat.address, chat.active, chat.takeover, JSON.stringify(chat.messages)]
    ).catch(err => console.error(err));

    let currentStep = 0;
    
    function executeNextStep() {
        if (currentStep >= steps.length) return;

        const step = steps[currentStep];
        setTimeout(() => {
            simulateUserMessage(chat, step.text);
            currentStep++;
            executeNextStep();
        }, step.delay);
    }

    executeNextStep();
}
