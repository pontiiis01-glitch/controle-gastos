
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDBcLEJw2PiFoBvocr3Zq01sRjjakteHfs",
    authDomain: "app-controle-gastos-1e658.firebaseapp.com",
    projectId: "app-controle-gastos-1e658",
    storageBucket: "app-controle-gastos-1e658.firebasestorage.app",
    messagingSenderId: "738629744462",
    appId: "1:738629744462:web:f299e491bafe5a059cd01f",
    measurementId: "G-02QPMRE4M8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const ALLOWED_EMAIL = "pontiiis01@gmail.com";

window.isEditing = false; 
let currentDocId = "";
let isReceiving = false; 
let isLoading = false;
let saveTimer;
let unsubscribe = null;
let summaryChart = null; 
let barChart = null;
let historyCategoryChart = null; 
let historyIconChart = null; 
window.lastDebts = {}; 

window.paidDebtors = [];
window.iconsList = ["ðŸ’¸", "ðŸ ", "ðŸ’¡", "ðŸ’§", "ðŸ“¶", "ðŸ‹ï¸", "ðŸš—", "â›½", "ðŸ”", "ðŸ’‡", "ðŸ’Š", "ðŸ’³", "ðŸŽ“", "âœˆï¸", "ðŸ’°", "ðŸŽ®", "ðŸ¾", "ðŸ›’"];

window.CATEGORIES = [
    { value: 'Moradia',     emoji: 'ðŸ ', label: 'Moradia' },
    { value: 'Energia',     emoji: 'âš¡', label: 'Energia' },
    { value: 'Ãgua',       emoji: 'ðŸ’§', label: 'Ãgua' },
    { value: 'Telecom',     emoji: 'ðŸ“±', label: 'Telecom' },
    { value: 'SaÃºde',       emoji: 'ðŸ’Š', label: 'SaÃºde' },
    { value: 'Transporte',  emoji: 'ðŸš—', label: 'Transporte' },
    { value: 'AlimentaÃ§Ã£o', emoji: 'ðŸ”', label: 'AlimentaÃ§Ã£o' },
    { value: 'EducaÃ§Ã£o',    emoji: 'ðŸŽ“', label: 'EducaÃ§Ã£o' },
    { value: 'Lazer',       emoji: 'ðŸŽ®', label: 'Lazer' },
    { value: 'Assinatura',  emoji: 'ðŸ“º', label: 'Assinatura' },
    { value: 'Investimento',emoji: 'ðŸ’°', label: 'Investimento' },
    { value: 'Outros',      emoji: 'ðŸ“¦', label: 'Outros' },
];

window.DEFAULT_CARDS = [
    { id: 'bb',     name: 'Banco do Brasil', emoji: 'ðŸ¦', color1: '#FCD34D', color2: '#F59E0B' },
    { id: 'mp',     name: 'Mercado Pago',    emoji: 'ðŸ’³', color1: '#3B82F6', color2: '#1D4ED8' },
    { id: 'passai', name: 'PassaÃ­ (ItaÃº)',  emoji: 'ðŸŸ ', color1: '#F97316', color2: '#EA580C' },
    { id: 'nubank', name: 'Nubank',           emoji: 'ðŸ’œ', color1: '#A855F7', color2: '#7C3AED' },
];
window.cardsConfig = JSON.parse(JSON.stringify(window.DEFAULT_CARDS));

// ConfiguraÃ§Ã£o de tema (nÃ£o depende de login)
if(localStorage.getItem('theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
if(window.innerWidth <= 768) {
    document.getElementById('main-content').addEventListener('scroll', () => {
        if(window.isEditing) document.activeElement.blur();
    });
}

// Ponto central de controle: observa o estado de autenticaÃ§Ã£o
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Verifica se o e-mail estÃ¡ na whitelist
        if (user.email !== ALLOWED_EMAIL) {
            signOut(auth);
            document.getElementById('loginError').innerText = 'âŒ Acesso negado. Este e-mail nÃ£o tem permissÃ£o.';
            document.getElementById('googleLoginBtn').style.display = 'flex';
            document.getElementById('loginSpinner').style.display = 'none';
            return;
        }
        // UsuÃ¡rio autorizado: esconde tela de login e inicia o app
        updateUserInfo(user);
        document.getElementById('lockScreen').style.opacity = '0';
        setTimeout(() => document.getElementById('lockScreen').style.display = 'none', 350);

        const lastMonth = localStorage.getItem('lastViewedMonth');
        const now = new Date();
        const d = lastMonth || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        document.getElementById('monthPicker').value = d;
        initApp();
    } else {
        // UsuÃ¡rio deslogado: garante que a tela de login estÃ¡ visÃ­vel
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        document.getElementById('lockScreen').style.display = 'flex';
        setTimeout(() => document.getElementById('lockScreen').style.opacity = '1', 10);
        document.getElementById('googleLoginBtn').style.display = 'flex';
        document.getElementById('loginSpinner').style.display = 'none';
    }
});

window.switchView = (viewName, clickedEl) => {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById('view-'+viewName).classList.add('active');
    // Sidebar
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const sideBtn = [...document.querySelectorAll('.nav-btn')].find(b => b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${viewName}'`));
    if (sideBtn) sideBtn.classList.add('active');
    // Bottom nav
    document.querySelectorAll('.bottom-nav a').forEach(a => a.classList.remove('active'));
    const bnItem = clickedEl && clickedEl.closest && clickedEl.closest('.bottom-nav')
        ? clickedEl
        : [...document.querySelectorAll('.bottom-nav a')].find(a => a.getAttribute('onclick') && a.getAttribute('onclick').includes(`'${viewName}'`));
    if (bnItem) bnItem.classList.add('active');

    document.getElementById('main-content').scrollTo(0,0);
    if(viewName === 'history') setTimeout(() => fetchHistoryData(6), 100);
};

window.toggleTheme = () => {
    const html = document.documentElement;
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    if (summaryChart) summaryChart.update(); 
    if (barChart) barChart.update();
    if (historyCategoryChart) historyCategoryChart.update();
};

// Login com Google
window.loginWithGoogle = async () => {
    const btn = document.getElementById('googleLoginBtn');
    const spinner = document.getElementById('loginSpinner');
    const error = document.getElementById('loginError');
    btn.style.display = 'none';
    spinner.style.display = 'flex';
    error.innerText = '';
    try {
        await signInWithPopup(auth, provider);
        // onAuthStateChanged cuida do resto automaticamente
    } catch (err) {
        btn.style.display = 'flex';
        spinner.style.display = 'none';
        if (err.code !== 'auth/popup-closed-by-user') {
            error.innerText = 'Erro ao fazer login. Tente novamente.';
        }
    }
};

// Logout real
window.lockApp = async () => {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    await signOut(auth);
    // onAuthStateChanged exibirÃ¡ a tela de login automaticamente
};

// Exibe info do usuÃ¡rio na sidebar
function updateUserInfo(user) {
    const nameEl = document.getElementById('userDisplayName');
    const emailEl = document.getElementById('userEmail');
    const photoEl = document.getElementById('userPhoto');
    const initialsEl = document.getElementById('userInitials');

    const name = user.displayName || 'UsuÃ¡rio';
    if (nameEl) nameEl.innerText = name;
    if (emailEl) emailEl.innerText = user.email;

    // Gera iniciais a partir do nome
    if (initialsEl) {
        const parts = name.trim().split(' ');
        const initials = parts.length >= 2
            ? parts[0][0] + parts[parts.length - 1][0]
            : parts[0].substring(0, 2);
        initialsEl.innerText = initials.toUpperCase();
    }

    // Tenta carregar a foto; se falhar, o onerror mostra as iniciais
    if (photoEl && user.photoURL) {
        photoEl.src = user.photoURL;
        photoEl.style.display = 'block';
        if (initialsEl) initialsEl.style.display = 'none';
    } else {
        // Sem URL de foto: mostra iniciais direto
        if (photoEl) photoEl.style.display = 'none';
        if (initialsEl) initialsEl.style.display = 'flex';
    }
}

function initApp() {
    const d = document.getElementById('monthPicker').value;
    loadMonthData(d);
}

function showToast() {
    const toast = document.getElementById('saveToast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

function toggleSkeleton(show) {
    const skel = document.getElementById('skeletonScreen');
    if(show) { skel.style.display = 'block'; setTimeout(()=>skel.style.opacity = '1',10); } 
    else { skel.style.opacity = '0'; setTimeout(()=>skel.style.display = 'none',300); }
}

window.changeMonthSafe = () => {
    const newDate = document.getElementById('monthPicker').value;
    if (!newDate || newDate === currentDocId) return;

    isLoading = true;
    toggleSkeleton(true); 
    
    if (unsubscribe) unsubscribe();
    clearTimeout(saveTimer);

    if (currentDocId && !isReceiving) saveDataSync(currentDocId); 

    clearScreen();
    localStorage.setItem('lastViewedMonth', newDate);
    loadMonthData(newDate);
}

function clearScreen() {
    document.getElementById('salary').value = 0;
    document.getElementById('totalExpenses').innerText = "R$ 0,00";
    document.querySelectorAll('tbody').forEach(b => b.innerHTML = "");
    window.cardsConfig.forEach(card => { const el = document.getElementById(card.id + 'TotalBill'); if (el) el.value = ""; });
    document.getElementById('goalsList').innerHTML = "";
    const cc = document.getElementById('cardsContainer'); if(cc) cc.innerHTML = "";
}

function loadMonthData(dateString) {
    currentDocId = dateString;
    
    const docRef = doc(db, "carteira_igor_v42", currentDocId);
    
    unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            if (window.isEditing) return; 

            isReceiving = true;
            const data = docSnap.data();
            window.paidDebtors = data.paidDebtors || []; 
            window.partialPayments = data.partialPayments || {};
            updateScreen(data);
            
            setTimeout(() => { isReceiving = false; isLoading = false; toggleSkeleton(false); }, 400);
        } else { 
            window.paidDebtors = []; 
            window.partialPayments = {};
            const defData = getDefaultData();
            updateScreen(defData); 
            saveDataSync(currentDocId); 
            isLoading = false; isReceiving = false; toggleSkeleton(false);
        }
    });
}

function updateScreen(data) {
    if (!data) data = getDefaultData();
    if (!data.goals) data.goals = getDefaultData().goals;

    // Carrega config de cartÃµes do Firestore ou usa defaults
    if (data.cardsConfig && data.cardsConfig.length > 0) {
        window.cardsConfig = data.cardsConfig;
    } else {
        window.cardsConfig = JSON.parse(JSON.stringify(window.DEFAULT_CARDS));
    }

    // Renderiza seÃ§Ãµes de cartÃµes dinamicamente
    renderCardsView();

    document.getElementById('salary').value = data.salary || 0;
    document.getElementById('emergencyFund').value = data.emergency || 0;

    let ei = 0;
    if(data.extraIncomeTotal !== undefined) ei = data.extraIncomeTotal;
    else if(data.extraIncome) ei = data.extraIncome.reduce((acc, item) => acc + (parseFloat(item.value)||0), 0);
    document.getElementById('extraIncomeTotal').value = ei || 0;

    // Carrega faturas e itens de cada cartÃ£o dinamicamente
    window.cardsConfig.forEach(card => {
        const billEl = document.getElementById(card.id + 'TotalBill');
        if (billEl) billEl.value = data[card.id + 'TotalBill'] || 0;
        renderTable(card.id + 'Table', data[card.id] || [], 'split');
    });

    // Filtra auto-rows antigas (compat. com dados antigos) e renderiza gastos fixos
    const mainData = (data.main || []).filter(i => !i.locked);
    renderGoals(data.goals);
    renderTable('mainTable', mainData, 'main');
    syncCardAutoRows(); // Adiciona linhas travadas de cada cartÃ£o
    calculateAll();
}

function getDefaultData() {
    const cardDefaults = {};
    window.cardsConfig.forEach(c => { cardDefaults[c.id] = []; cardDefaults[c.id + 'TotalBill'] = 0; });
    return {
        salary: 0, emergency: 0,
        cardsConfig: JSON.parse(JSON.stringify(window.cardsConfig)),
        goals: [
            { id: 'g1', name: 'Reserva 40k', icon: 'ðŸ’°', target: 40000, current: 0 },
            { id: 'g2', name: 'ManutenÃ§Ã£o Argo', icon: 'ðŸš—', target: 2000, current: 0 }
        ],
        main: [
            { icon: 'ðŸ‹ï¸', name: 'Academia', value: 0, isMine: true, category: 'SaÃºde' },
            { icon: 'ðŸ’¡', name: 'Luz', value: 0, isMine: true, category: 'Energia' }
        ],
        ...cardDefaults,
        extraIncome: [], paidDebtors: [], partialPayments: {}
    };
}

function renderGoals(goalsArray) {
    const list = document.getElementById('goalsList');
    list.innerHTML = "";
    goalsArray.forEach(g => {
        const perc = g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0;
        const div = document.createElement('div');
        div.className = 'goal-card';
        div.innerHTML = `
            <div class="goal-header">
                <div class="goal-icon">${g.icon}</div>
                <div class="goal-details">
                    <input type="text" value="${g.name}" class="goal-title" 
                           oninput="scheduleSave()" onfocus="window.isEditing=true" onblur="window.isEditing=false"
                           style="background:transparent; border:none; padding:0; outline:none; font-family:'Outfit';">
                    <div class="goal-target">Objetivo: R$ ${fmtNumber(g.target)}</div>
                </div>
                <button class="btn-del" onclick="removeGoal('${g.id}')" style="background:transparent; color:var(--text-muted); padding:0;"><span class="material-icons-round">close</span></button>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <div class="goal-perc">${perc.toFixed(0)}%</div>
            </div>
            <div class="goal-progress-wrap">
                <div class="goal-progress-fill" style="width: ${perc}%"></div>
            </div>
            <div class="goal-inputs">
                <div class="goal-input-group">
                    <label>JÃ¡ Tenho</label>
                    <input type="number" class="sys-input" value="${g.current}" oninput="scheduleSave()" onfocus="window.isEditing=true" onblur="window.isEditing=false">
                </div>
                <div class="goal-input-group">
                    <label>Meta</label>
                    <input type="number" class="sys-input" value="${g.target}" oninput="scheduleSave()" onfocus="window.isEditing=true" onblur="window.isEditing=false">
                </div>
            </div>
        `;
        list.appendChild(div);
    });
}

window.addGoal = () => {
    const newGoal = { id: 'g'+Date.now(), name: 'Nova Meta', icon: 'ðŸŽ¯', target: 1000, current: 0 };
    const currentData = captureScreenData();
    currentData.goals.push(newGoal);
    renderGoals(currentData.goals);
    scheduleSave();
};

window.removeGoal = (id) => {
    Swal.fire({
        title: 'Apagar meta?', text: "Tem certeza que deseja remover este projeto?", icon: 'warning',
        showCancelButton: true, confirmButtonText: 'Sim', cancelButtonText: 'NÃ£o',
        customClass: { popup: 'meu-popup-sweet', confirmButton: 'meu-botao-sweet-confirm', cancelButton: 'meu-botao-sweet-cancel' }, buttonsStyling: false
    }).then((result) => {
        if (result.isConfirmed) {
            let currentData = captureScreenData();
            currentData.goals = currentData.goals.filter(g => g.id !== id);
            renderGoals(currentData.goals);
            scheduleSave();
        }
    });
};

function renderTable(id, data, type) {
    const tbody = document.querySelector(`#${id} tbody`);
    tbody.innerHTML = "";
    data.forEach(item => {
        if(type === 'main') addMainRowHTML(tbody, item);
        else if(type === 'split') addSplitRowHTML(tbody, item);
    });
}

function captureScreenData() {
    const data = {
        salary: document.getElementById('salary').value,
        emergency: document.getElementById('emergencyFund').value,
        extraIncomeTotal: document.getElementById('extraIncomeTotal').value,
        paidDebtors: window.paidDebtors,
        partialPayments: window.partialPayments || {},
        cardsConfig: JSON.parse(JSON.stringify(window.cardsConfig)),
        goals: [], main: []
    };

    // Captura faturas e itens de cada cartÃ£o dinamicamente
    window.cardsConfig.forEach(card => {
        const billEl = document.getElementById(card.id + 'TotalBill');
        data[card.id + 'TotalBill'] = billEl ? billEl.value : 0;
        data[card.id] = [];
        document.querySelectorAll(`#${card.id}Table tbody tr`).forEach(tr => {
            const inputs = tr.querySelectorAll('.sys-input');
            const val = tr.querySelector('.val-input').value;
            if(inputs.length >= 4) {
                data[card.id].push({ name: inputs[0].value, date: inputs[1].value, desc: inputs[2].value, inst: inputs[3].value, value: val });
            }
        });
    });

    document.querySelectorAll('.goal-card').forEach(card => {
        const inputs = card.querySelectorAll('input');
        const name = inputs[0].value;
        const current = parseFloat(inputs[1].value) || 0;
        const target = parseFloat(inputs[2].value) || 0;
        const icon = card.querySelector('.goal-icon').innerText;
        const id = card.querySelector('.btn-del').getAttribute('onclick').match(/'([^']+)'/)[1];
        data.goals.push({ id, name, icon, target, current });
    });

    // Captura gastos fixos (somente nÃ£o-travados) com categoria
    document.querySelectorAll('#mainTable tbody tr').forEach(tr => {
        const locked = tr.querySelector('.val-input').hasAttribute('readonly');
        if (!locked) {
            const name = tr.querySelector('.sys-input').value;
            const val = tr.querySelector('.val-input').value;
            const isMine = tr.querySelector('input[type="checkbox"]').checked;
            const icon = tr.querySelector('.sys-select').value;
            const id = tr.querySelector('.val-input').id || null;
            const category = tr.querySelector('.cat-select')?.value || 'Outros';
            data.main.push({ icon, name, value: val, isMine, category, id });
        }
    });

    return data;
}

async function saveDataSync(targetId) {
    if(isLoading) return; 
    const data = captureScreenData();
    try { 
        await setDoc(doc(db, "carteira_igor_v42", targetId), data); 
        if (navigator.vibrate) navigator.vibrate(50); 
        showToast(); 
    } 
    catch(e) { console.error("Erro save sync", e); }
}

window.scheduleSave = (force=false) => {
    calculateAll();
    document.querySelectorAll('.goal-card').forEach(card => {
        const inputs = card.querySelectorAll('input');
        const current = parseFloat(inputs[1].value) || 0;
        const target = parseFloat(inputs[2].value) || 0;
        const perc = target > 0 ? Math.min((current / target) * 100, 100) : 0;
        card.querySelector('.goal-progress-fill').style.width = perc + '%';
        card.querySelector('.goal-perc').innerText = perc.toFixed(0) + '%';
    });

    if (isReceiving && !force) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveDataSync(currentDocId), 800); 
}

window.resetMonthData = async () => {
    const result = await Swal.fire({
        title: 'Limpar mÃªs?', text: "VocÃª vai apagar TODOS os dados deste mÃªs.", icon: 'warning',
        showCancelButton: true, confirmButtonText: 'Sim, limpar!', cancelButtonText: 'Cancelar',
        customClass: { popup: 'meu-popup-sweet', confirmButton: 'meu-botao-sweet-confirm', cancelButton: 'meu-botao-sweet-cancel' }, buttonsStyling: false
    });

    if (result.isConfirmed) {
        isReceiving = true;
        const emptyData = getDefaultData();
        updateScreen(emptyData); 
        await saveDataSync(currentDocId); 
        isReceiving = false;
        Swal.fire({ title: 'Limpo!', icon: 'success', timer: 1500, showConfirmButton: false, customClass: { popup: 'meu-popup-sweet' } });
    }
}

window.calculateAll = () => {
    const allDebts = {};
    const mergeDebts = (s) => {
        for(let k in s) {
            if(!allDebts[k]) allDebts[k] = { name: s[k].name, total: 0, items: [] };
            allDebts[k].total += s[k].total;
            allDebts[k].items = allDebts[k].items.concat(s[k].items);
        }
    };

    let cardsShareTotal = 0;
    window.cardsConfig.forEach(card => {
        const tid = card.id + 'Table';
        const totId = card.id + 'TotalBill';
        const displayId = card.id + 'MyShareDisplay';
        // Skip if table doesn't exist yet (before renderCardsView)
        if (!document.getElementById(totId)) return;
        const result = processCard(tid, totId, displayId, card.name);
        cardsShareTotal += result.myShare;
        const autoInput = document.getElementById(card.id + '_auto');
        if (autoInput) autoInput.value = result.myShare.toFixed(2);
        mergeDebts(result.debtors);
    });

    let fixedSumMine = 0; let fixedSumTotal = 0;
    const emergency = parseFloat(document.getElementById('emergencyFund').value) || 0;
    const categoryTotals = {};

    document.querySelectorAll('#mainTable tbody tr').forEach(tr => {
        const val = parseFloat(tr.querySelector('.val-input').value) || 0;
        const isMine = tr.querySelector('input[type="checkbox"]').checked;
        if (!tr.querySelector('.val-input').hasAttribute('readonly')) {
            fixedSumTotal += val;
            if (isMine) fixedSumMine += val;
            if (val > 0) {
                const cat = tr.querySelector('.cat-select')?.value || 'Outros';
                categoryTotals[cat] = (categoryTotals[cat] || 0) + val;
            }
        }
    });

    let totalExpenses = fixedSumTotal + cardsShareTotal;
    let myRealExpenses = fixedSumMine + cardsShareTotal;
    let extraIncome = parseFloat(document.getElementById('extraIncomeTotal').value) || 0;
    const salary = parseFloat(document.getElementById('salary').value) || 0;
    const totalIncome = salary + extraIncome;

    document.getElementById('totalExpenses').innerText = fmt(totalExpenses);
    document.getElementById('remaining').innerText = fmt(totalIncome - totalExpenses - emergency);
    document.getElementById('myRealExpenses').innerText = fmt(myRealExpenses);

    const perc = totalIncome > 0 ? (totalExpenses/totalIncome)*100 : 0;
    const bar = document.getElementById('salaryBar');
    bar.style.width = Math.min(perc, 100)+'%';
    bar.style.background = perc < 50 ? 'var(--success)' : perc < 85 ? 'var(--warning)' : 'var(--danger)';

    window.lastDebts = allDebts;
    updateDebtors(allDebts);

    // GrÃ¡fico por categoria
    const catColors = {
        'Moradia':'#6366f1','Energia':'#f59e0b','Ãgua':'#06b6d4','Telecom':'#8b5cf6',
        'SaÃºde':'#10b981','Transporte':'#f97316','AlimentaÃ§Ã£o':'#ef4444','EducaÃ§Ã£o':'#3b82f6',
        'Lazer':'#ec4899','Assinatura':'#14b8a6','Investimento':'#84cc16','Outros':'#94a3b8',
    };
    const chartLabels = [], chartData = [], chartColors = [];
    Object.entries(categoryTotals).forEach(([cat, val]) => {
        chartLabels.push(cat); chartData.push(val); chartColors.push(catColors[cat] || '#94a3b8');
    });
    if (cardsShareTotal > 0) { chartLabels.push('CartÃµes'); chartData.push(cardsShareTotal); chartColors.push('hsl(35,92%,55%)'); }
    if (emergency > 0) { chartLabels.push('Reserva'); chartData.push(emergency); chartColors.push('hsl(263,70%,50%)'); }
    const livre = Math.max(0, totalIncome - totalExpenses - emergency);
    if (livre > 0) { chartLabels.push('Livre'); chartData.push(livre); chartColors.push('hsl(162,75%,45%)'); }

    const ctx = document.getElementById('expenseChart').getContext('2d');
    Chart.defaults.color = localStorage.getItem('theme') === 'dark' ? '#94a3b8' : '#64748b';
    Chart.defaults.font.family = "'Inter', sans-serif";
    if(summaryChart) summaryChart.destroy();
    summaryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels.length ? chartLabels : ['Sem dados'],
            datasets: [{ data: chartData.length ? chartData : [1], backgroundColor: chartColors.length ? chartColors : ['var(--border)'], borderWidth: 0, hoverOffset: 15 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true, font: { family: "'Outfit', sans-serif", weight: '700', size: 13 } } },
                tooltip: { backgroundColor: 'rgba(15,23,42,0.9)', padding: 12, cornerRadius: 12, titleFont: { family: "'Outfit', sans-serif", size: 14 }, bodyFont: { family: "'Inter', sans-serif", size: 13 } }
            },
            cutout: '72%',
            animation: { animateScale: true, duration: 1500, easing: 'easeOutQuart' }
        }
    });
};

function updateAutoRow(cardId, value) {
    // Legacy compat â€” now uses direct ID lookup in calculateAll
    const input = document.getElementById(cardId + '_auto');
    if (input) input.value = value.toFixed(2);
}

function processCard(tid, totId, displayId, cardName) {
    const bill = parseFloat(document.getElementById(totId).value) || 0;
    let others = 0, debtors = {};
    document.querySelectorAll(`#${tid} tbody tr`).forEach(tr => {
        const inputs = tr.querySelectorAll('.sys-input');
        const name = inputs[0].value.trim();
        const date = inputs[1].value.trim();
        const desc = inputs[2].value.trim();
        const inst = inputs[3].value.trim();
        const val = parseFloat(tr.querySelector('.val-input').value) || 0;
        
        if(val>0) {
            others += val;
            if(name) {
                const k = name.toLowerCase();
                if(!debtors[k]) debtors[k] = { name, total: 0, items: [] };
                debtors[k].total += val;
                debtors[k].items.push({ card: cardName, date, desc, inst, val });
            }
        }
    });
    const myShare = bill - others;
    const detailText = `${fmt(bill)} (Fatura) - ${fmt(others)} (Terceiros) = `;
    document.getElementById(displayId).innerHTML = `<small style="font-size:0.75rem; opacity:0.7; color:var(--text-main); font-weight:600;">${detailText}</small> <b>Minha Parte: ${fmt(myShare)}</b>`;
    return { myShare, debtors };
}

function getCardBadge(cardName) {
    const card = window.cardsConfig.find(c => c.name === cardName);
    if (card) {
        const short = cardName.split(' ')[0].toUpperCase().substring(0, 6);
        return `<span style="background:${card.color1}; color:white; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:900; display:inline-block; text-shadow:0 1px 2px rgba(0,0,0,0.3);">${short}</span>`;
    }
    // Fallback legado
    if(cardName==='BB') return `<span style="background:#fcd34d; color:#854d0e; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:900; display:inline-block;">BB</span>`;
    if(cardName==='MP') return `<span style="background:#3b82f6; color:#fff; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:900; display:inline-block;">MP</span>`;
    if(cardName==='PassaÃ­') return `<span style="background:#f97316; color:#fff; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:900; display:inline-block;">PASSAÃ</span>`;
    if(cardName==='Nubank') return `<span style="background:#a855f7; color:#fff; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:900; display:inline-block;">NUBANK</span>`;
    return `<span style="background:var(--border); color:var(--text-main); padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:900; display:inline-block;">${cardName.substring(0,6)}</span>`;
}

window.addMainRow = () => { addMainRowHTML(document.querySelector("#mainTable tbody"), {icon:'ðŸ’¸',name:'',value:'',isMine:true}); scheduleSave(); }

window.addSplitRow = (id) => { addSplitRowHTML(document.querySelector(`#${id} tbody`), {name:'',date:'',desc:'',inst:'',value:''}); scheduleSave(); }

function addMainRowHTML(tbody, item) {
    const tr = document.createElement("tr");
    let opts = window.iconsList.map(i => `<option value="${i}" ${i === item.icon ? 'selected' : ''}>${i}</option>`).join('');
    const locked = item.locked ? 'readonly style="background:transparent; color:var(--text-muted); opacity:0.8"' : 'onfocus="window.isEditing=true" onblur="window.isEditing=false"';
    const del = item.locked ? '' : `<button class="btn-del" onclick="removeRow(this)"><span class="material-icons-round">close</span></button>`;
    const catOpts = window.CATEGORIES.map(c => `<option value="${c.value}" ${item.category === c.value ? 'selected' : ''}>${c.emoji} ${c.label}</option>`).join('');
    const catSelect = item.locked ? '' : `<select class="cat-select" onchange="scheduleSave()">${catOpts}</select>`;
    tr.innerHTML = `<td><select class="sys-select" onchange="scheduleSave()">${opts}</select></td><td><input type="text" class="sys-input" value="${item.name}" ${locked} oninput="scheduleSave()">${catSelect}</td><td><input type="number" class="val-input" value="${item.value}" step="0.01" id="${item.id||''}" ${locked} oninput="scheduleSave()"></td><td style="text-align:center"><input type="checkbox" ${item.isMine?'checked':''} onchange="scheduleSave()"></td><td style="text-align:center">${del}</td>`;
    tbody.appendChild(tr);
}

function addSplitRowHTML(tbody, item) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><input type="text" class="sys-input split-name" value="${item.name}" placeholder="Nome" oninput="scheduleSave()" onfocus="window.isEditing=true" onblur="window.isEditing=false"></td><td><input type="text" class="sys-input split-date" value="${item.date||''}" placeholder="Ex: 04/03" oninput="scheduleSave()" onfocus="window.isEditing=true" onblur="window.isEditing=false" style="text-align: center;"></td><td><input type="text" class="sys-input" value="${item.desc}" placeholder="Item" oninput="scheduleSave()" onfocus="window.isEditing=true" onblur="window.isEditing=false"></td><td><input type="text" class="sys-input" value="${item.inst||''}" placeholder="1/10" oninput="updateBar(this);scheduleSave()" onfocus="window.isEditing=true" onblur="window.isEditing=false"></td><td><input type="number" class="val-input" value="${item.value}" step="0.01" oninput="scheduleSave()" onfocus="window.isEditing=true" onblur="window.isEditing=false"></td><td style="text-align:center"><button class="btn-del" onclick="removeRow(this)"><span class="material-icons-round">close</span></button></td>`;
    tbody.appendChild(tr);
}

window.removeRow = (btn) => { btn.closest('tr').remove(); scheduleSave(); }

window.toggleItemPaid = (itemId) => {
    const idx = window.paidDebtors.indexOf(itemId);
    if(idx > -1) window.paidDebtors.splice(idx, 1);
    else window.paidDebtors.push(itemId);
    scheduleSave();
}

window.togglePaid = (name) => {
    const key = name.toLowerCase();
    const p = window.lastDebts[key];
    if(!p) return;

    const legacyIsPaid = window.paidDebtors.includes(p.name);
    let allPaid = true;
    const ids = p.items.map(it => `${p.name}|${it.card}|${(it.desc||'').replace(/'/g, "\\'")}|${it.val}|${it.date||''}|${it.inst||''}`);

    ids.forEach(id => { if(!legacyIsPaid && !window.paidDebtors.includes(id)) allPaid = false; });

    ids.forEach(id => {
        const idx = window.paidDebtors.indexOf(id);
        if(legacyIsPaid) { if(idx === -1) window.paidDebtors.push(id); }
        else {
            if(allPaid && idx === -1) window.paidDebtors.push(id);
            else if(!allPaid && idx > -1) window.paidDebtors.splice(idx, 1);
        }
    });

    if(legacyIsPaid) {
        window.paidDebtors = window.paidDebtors.filter(i => i !== p.name);
    } else {
        if(allPaid) window.paidDebtors.push(p.name);
        else window.paidDebtors = window.paidDebtors.filter(i => i !== p.name);
    }
    scheduleSave();
}

window.payAllForDebtor = (name) => {
    const key = name.toLowerCase();
    const p = window.lastDebts[key];
    if(!p) return;
    p.items.forEach(it => {
        const id = `${p.name}|${it.card}|${(it.desc||'').replace(/'/g, "\\'")}|${it.val}|${it.date||''}|${it.inst||''}`;
        if(!window.paidDebtors.includes(id)) window.paidDebtors.push(id);
    });
    if(!window.paidDebtors.includes(p.name)) window.paidDebtors.push(p.name);
    scheduleSave();
}

window.abaterValor = async (name) => {
    const currentVal = (window.partialPayments && window.partialPayments[name]) ? window.partialPayments[name] : 0;
    const { value: amount } = await Swal.fire({
        title: 'Abater Valor Avulso',
        html: `Defina um valor extra que <b>${name}</b> jÃ¡ pagou.<br><br><small>Coloque 0 para remover o abatimento.</small>`,
        input: 'number',
        inputValue: currentVal > 0 ? currentVal : '',
        inputAttributes: { step: '0.01' },
        showCancelButton: true,
        confirmButtonText: 'Salvar',
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'meu-popup-sweet', confirmButton: 'meu-botao-sweet-confirm', cancelButton: 'meu-botao-sweet-cancel' }
    });

    if (amount !== undefined) {
        let val = parseFloat(amount);
        if(isNaN(val) || val < 0) val = 0;
        if(!window.partialPayments) window.partialPayments = {};
        window.partialPayments[name] = val;
        scheduleSave();
    }
}

function updateDebtors(all) {
    const list = document.getElementById('debtorsList'); list.innerHTML = "";
    let tr=0, r=0;
    if (Object.keys(all).length === 0) list.innerHTML = "<div style='color:var(--text-muted); width:100%; text-align:center; padding: 20px; font-weight: 700;'>Nenhum devedor no momento.</div>";
    else {
        for(let k in all) {
            const p = all[k];
            const legacyIsPaid = window.paidDebtors.includes(p.name);
            let debtorTotalPaid = 0;
            let debtorTotalPending = 0;

            let itemsHTML = `<div style="margin-top:10px; border-top:1px dashed var(--border-light); padding-top:15px; display:flex; flex-direction:column; gap:10px;">`;

            p.items.sort((a,b) => (a.date||'').localeCompare(b.date||''));

            p.items.forEach(it => {
                const safeDesc = (it.desc || '').replace(/'/g, "\\'");
                const itemId = `${p.name}|${it.card}|${safeDesc}|${it.val}|${it.date||''}|${it.inst||''}`;
                const isItemPaid = legacyIsPaid || window.paidDebtors.includes(itemId);

                if(isItemPaid) { r+=it.val; debtorTotalPaid+=it.val; } else { tr+=it.val; debtorTotalPending+=it.val; }

                const badge = getCardBadge(it.card);
                const dt = it.date ? `<span style="color:var(--text-muted); font-weight:800; font-size:0.75rem; background:var(--border-light); padding:4px 8px; border-radius:6px; margin-top:5px; display:inline-block;">ðŸ—“ ${it.date}</span>` : '';
                const parc = it.inst ? `<span style="font-size:0.8rem; color:var(--text-muted); font-weight:700;">${it.inst}</span>` : '';

                itemsHTML += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-body); padding:10px 12px; border-radius:var(--radius-sm); opacity: ${isItemPaid?'0.5':'1'}; border: 1px solid var(--border-light);">
                    <div style="display:flex; align-items:center; gap:8px; min-width: 0; flex: 1;">
                        <button class="item-status-btn ${isItemPaid?'paid':'pending'}" onclick="toggleItemPaid('${itemId}')" style="width:30px; height:30px; flex-shrink:0;">
                            <span class="material-icons-round" style="font-size:1.1rem;">${isItemPaid?'check':'horizontal_rule'}</span>
                        </button>
                        <div style="display:flex; flex-direction:column; gap:2px; min-width: 0;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                ${badge}
                                <span style="font-size:0.85rem; font-weight:800; text-decoration: ${isItemPaid?'line-through':'none'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${it.desc || 'Item'}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                ${parc ? `<span style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">${it.inst}</span>` : ''}
                                ${dt}
                            </div>
                        </div>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                        <span style="font-weight:900; color:var(--text-main); font-size:0.95rem; text-decoration: ${isItemPaid?'line-through':'none'}">${fmt(it.val)}</span>
                    </div>
                </div>`;
            });
            itemsHTML += `</div>`;

            let partial = window.partialPayments ? (window.partialPayments[p.name] || 0) : 0;
            let effectivePartial = Math.min(partial, debtorTotalPending);
            debtorTotalPaid += effectivePartial;
            debtorTotalPending -= effectivePartial;
            r += effectivePartial;
            tr -= effectivePartial;

            const allItemsPaid = (debtorTotalPending <= 0 && p.items.length > 0);

            const div = document.createElement('div');
            div.className = `debt-card ${allItemsPaid?'paid':''}`;
            div.innerHTML = `
                <div class="debt-header" style="margin-bottom: 20px;">
                    <div style="flex: 1;">
                        <span style="font-size:1.3rem; display: block; font-weight: 800; color:var(--text-main);">${p.name}</span>
                        <div style="font-size:0.75rem; color:var(--primary); font-weight:900; text-transform: uppercase; letter-spacing: 1px;">
                            ${allItemsPaid ? 'âœ” Tudo Pago' : (debtorTotalPaid > 0 ? `Abatido: ${fmt(debtorTotalPaid)}` : 'Em Aberto')}
                        </div>
                    </div>
                    <div style="text-align:right">
                        <span class="debt-amount">${fmt(p.total)}</span>
                        <div style="font-size:0.8rem; color:var(--text-muted); font-weight:700;">Restante: ${fmt(debtorTotalPending)}</div>
                    </div>
                </div>

                ${!allItemsPaid ? `
                <div style="display:flex; gap:10px; margin-bottom: 10px;">
                    <button class="status-btn pending" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; background:transparent;" onclick="payAllForDebtor('${p.name}')">
                        <span class="material-icons-round" style="font-size:1.1rem;">done_all</span> QUITAR TUDO
                    </button>
                    <button class="status-btn pending" style="flex:1; display:flex; align-items:center; justify-content:center; gap:8px; background:transparent; border-color: var(--primary); color: var(--primary);" onclick="abaterValor('${p.name}')">
                        <span class="material-icons-round" style="font-size:1.1rem;">payments</span> ABATER
                    </button>
                </div>` : `
                <div style="display:flex; gap:10px; margin-bottom: 10px;">
                    <div style="flex:1; background:var(--success-bg); color:var(--success); padding:10px; border-radius:12px; text-align:center; font-weight:800; font-size:0.8rem; border: 1px solid var(--success);">
                       <span class="material-icons-round" style="vertical-align:middle; font-size:1rem;">verified</span> QUITADO
                    </div>
                    ${partial > 0 ? `
                    <button class="status-btn pending" style="display:flex; align-items:center; justify-content:center; padding:10px; background:transparent; border-color: var(--primary); color: var(--primary);" onclick="abaterValor('${p.name}')" title="Editar abatimento">
                        <span class="material-icons-round" style="font-size:1.1rem;">edit</span>
                    </button>` : ''}
                </div>`}
                
                ${itemsHTML}
            `;
            list.appendChild(div);
        }
    }
    document.getElementById('totalToReceive').innerText = fmt(tr); document.getElementById('totalReceived').innerText = fmt(r);
}

// RELATORIO PDF
window.openPDFPreview = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const colPrimary = [79, 70, 229]; const colSuccess = [16, 185, 129]; const colDanger = [239, 68, 68]; const colWarning = [245, 158, 11]; const colDark = [15, 23, 42]; const colGray = [100, 116, 139];

    doc.setFillColor(...colPrimary); doc.rect(0, 0, 8, 297, 'F'); 
    doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(...colDark); doc.text("RelatÃ³rio PRO", 20, 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...colGray);
    doc.text(`ReferÃªncia: ${document.getElementById('monthPicker').value}  |  Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30);
    doc.setDrawColor(226, 232, 240); doc.line(20, 36, 190, 36);

    let y = 48;
    const salary = parseFloat(document.getElementById('salary').value)||0;
    const extra = parseFloat(document.getElementById('extraIncomeTotal').value)||0;
    let fixedSum = 0; document.querySelectorAll('#mainTable tbody tr').forEach(tr => { if(!tr.querySelector('.val-input').hasAttribute('readonly')) fixedSum += parseFloat(tr.querySelector('.val-input').value)||0; });
    const bb = parseFloat(document.getElementById('bbTotalBill').value)||0; const mp = parseFloat(document.getElementById('mpTotalBill').value)||0; const passai = parseFloat(document.getElementById('passaiTotalBill').value)||0; const nubank = parseFloat(document.getElementById('nubankTotalBill').value)||0;
    const totalCards = bb + mp + passai + nubank;
    const saldoFinal = parseFloat(document.getElementById('remaining').innerText.replace(/[^\d,-]/g,'').replace(',','.'))||0;

    const drawCard = (x, title, value, color) => {
        doc.setFillColor(250, 250, 250); doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); doc.roundedRect(x, y, 40, 25, 3, 3, 'FD');
        doc.setFillColor(...color); doc.rect(x, y, 40, 3, 'F');
        doc.setFontSize(7); doc.setTextColor(...colGray); doc.text(title, x+3, y+10);
        doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...colDark); doc.text(fmt(value), x+3, y+20);
    };

    drawCard(20, "RECEITA TOTAL", salary+extra, colSuccess);
    drawCard(65, "GASTOS FIXOS", fixedSum, colWarning);
    drawCard(110, "FATURA CARTÃ•ES", totalCards, [139, 92, 246]);
    drawCard(155, "SALDO FINAL", saldoFinal, saldoFinal >= 0 ? colPrimary : colDanger);

    y += 38; 
    const tableStyles = { theme: 'grid', headStyles: { fontStyle: 'bold', fontSize: 9, halign: 'left' }, bodyStyles: { fontSize: 9, textColor: 50 }, alternateRowStyles: { fillColor: [248, 250, 252] }, columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 40, halign: 'right', fontStyle: 'bold' } }, margin: { left: 20, right: 20 } };

    const incomeRows = [['SalÃ¡rio Base', fmt(salary)]];
    if (extra > 0) incomeRows.push(['Renda Extra', fmt(extra)]);
    
    doc.setFontSize(12); doc.setTextColor(...colSuccess); doc.setFont("helvetica", "bold"); doc.text("Entradas & Rendas", 20, y);
    doc.autoTable({ startY: y+3, head: [['Fonte', 'Valor']], body: incomeRows, ...tableStyles, headStyles: { ...tableStyles.headStyles, fillColor: colSuccess } });
    y = doc.lastAutoTable.finalY + 15;

    const fixedRows = []; document.querySelectorAll('#mainTable tbody tr').forEach(tr => { const n = tr.querySelector('.sys-input').value; const v = parseFloat(tr.querySelector('.val-input').value)||0; const isMine = tr.querySelector('input[type="checkbox"]').checked; if(v>0 && !tr.querySelector('.val-input').hasAttribute('readonly')) fixedRows.push([n + (isMine ? "" : " (Terceiros)"), fmt(v)]); });
    const emerg = parseFloat(document.getElementById('emergencyFund').value)||0; if(emerg>0) fixedRows.push(['Reserva / Investimento', fmt(emerg)]);

    if(fixedRows.length > 0) {
        doc.setTextColor(...colWarning); doc.text("Despesas Fixas", 20, y);
        doc.autoTable({ startY: y+3, head: [['Despesa', 'Valor']], body: fixedRows, ...tableStyles, headStyles: { ...tableStyles.headStyles, fillColor: colWarning } });
        y = doc.lastAutoTable.finalY + 15;
    }

    const cardTables = window.cardsConfig.map(c => ({ id: c.id + 'Table', name: c.name, tot: c.id + 'TotalBill', card: c }));
    let hasCards = false;
    cardTables.forEach(card => {
        const rows = []; const totalBill = parseFloat(document.getElementById(card.tot).value)||0;
        document.querySelectorAll(`#${card.id} tbody tr`).forEach(tr => { 
            const inputs = tr.querySelectorAll('.sys-input'); 
            const v = parseFloat(tr.querySelector('.val-input').value)||0; 
            if(v>0) {
                const dateText = inputs[1].value ? ` [Dia: ${inputs[1].value}]` : '';
                rows.push([`${inputs[2].value} (${inputs[0].value})${dateText} ${inputs[3].value ? '- '+inputs[3].value : ''}`, fmt(v)]);
            }
        });

        if(totalBill > 0 || rows.length > 0) {
            if(!hasCards) { if(y > 250) { doc.addPage(); y=20; doc.setFillColor(...colPrimary); doc.rect(0, 0, 8, 297, 'F'); } doc.setTextColor(139, 92, 246); doc.text("Detalhamento de CartÃµes", 20, y); y += 5; hasCards = true; }
            doc.setFontSize(10); doc.setTextColor(...colDark); doc.text(`${card.name} (Total: ${fmt(totalBill)})`, 20, y+4);
            if(rows.length > 0) { doc.autoTable({ startY: y+6, head: [['Item / ResponsÃ¡vel', 'Valor']], body: rows, ...tableStyles, headStyles: { ...tableStyles.headStyles, fillColor: [139, 92, 246] }, margin: { left: 25 } }); y = doc.lastAutoTable.finalY + 10; } else y += 15;
        }
    });

    const debtors = []; 
    for(let k in window.lastDebts) {
        const p = window.lastDebts[k];
        const legacyIsPaid = window.paidDebtors.includes(p.name);
        let debtorTotalPending = 0;
        let details = "";
        p.items.forEach(it => {
            const safeDesc = (it.desc || '').replace(/'/g, "\\'");
            const itemId = `${p.name}|${it.card}|${safeDesc}|${it.val}|${it.date||''}|${it.inst||''}`;
            const isItemPaid = legacyIsPaid || window.paidDebtors.includes(itemId);
            if(!isItemPaid) debtorTotalPending += it.val;

            const dt = it.date ? `Dia ${it.date} | ` : '';
            const parc = it.inst ? `(${it.inst})` : '';
            const statusStr = isItemPaid ? "[PAGO]" : "[PENDENTE]";
            details += `â€¢ ${dt}${it.card}: ${it.desc} ${parc} - ${fmt(it.val)} ${statusStr}\n`;
        });
        const allItemsPaid = (debtorTotalPending === 0 && p.items.length > 0);
        debtors.push([
            `${p.name}\n${details.trim()}`,
            allItemsPaid ? "PAGO" : "PENDENTE",
            fmt(p.total)
        ]);
    }
    
    if(debtors.length > 0) {
        if(y > 240) { doc.addPage(); y=20; doc.setFillColor(...colPrimary); doc.rect(0, 0, 8, 297, 'F'); }
        doc.setFontSize(12); doc.setTextColor(...colDanger); doc.text("Controle de Devedores", 20, y);
        doc.autoTable({ startY: y+3, head: [['Devedor', 'Status', 'Valor']], body: debtors, ...tableStyles, columnStyles: { 0: {cellWidth:'auto'}, 1: {cellWidth:30}, 2: {cellWidth:40, halign:'right'} }, headStyles: { ...tableStyles.headStyles, fillColor: colDanger }, didParseCell: function(data) { if (data.section === 'body' && data.column.index === 1) { data.cell.styles.textColor = data.cell.raw === 'PAGO' ? colSuccess : colWarning; data.cell.styles.fontStyle = 'bold'; } } });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`PÃ¡gina ${i} de ${pageCount} - Financeiro Pro`, 105, 290, { align: 'center' }); }
    document.getElementById('pdfPreviewFrame').src = doc.output('bloburl'); document.getElementById('pdfModal').style.display = 'flex'; document.getElementById('btnDownloadPDF').onclick = () => doc.save(`Relatorio_Pro_${currentDocId}.pdf`);
}

window.exportToCSV = async () => {
    const pickerVal = document.getElementById('monthPicker').value;
    const yearRef = parseInt(pickerVal.split('-')[0]);
    const monthRef = parseInt(pickerVal.split('-')[1]);
    
    const reqs = [];
    for(let i=11; i>=0; i--) {
        let m = monthRef - i, y = yearRef; 
        while(m <= 0) { m += 12; y--; }
        const id = `${y}-${String(m).padStart(2,'0')}`; 
        reqs.push(getDoc(doc(db, "carteira_igor_v42", id)));
    }
    const snaps = await Promise.all(reqs);
    
    let csv = "Mes,Tipo,Descricao,Valor\n";
    snaps.forEach((snap, idx) => {
        if(snap.exists()){
            const d = snap.data();
            const mes = snap.id;
            csv += `${mes},Salario,Base,${d.salary||0}\n`;
            if(d.extraIncomeTotal) csv += `${mes},RendaExtra,Total,${d.extraIncomeTotal}\n`;
            else if(d.extraIncome) d.extraIncome.forEach(x => csv += `${mes},RendaExtra,${x.desc},${x.value}\n`);
            if(d.main) d.main.forEach(x => csv += `${mes},Fixo,${x.name},${x.value}\n`);
            ['bb','mp','passai','nubank'].forEach(c => {
                if(d[c]) d[c].forEach(x => csv += `${mes},Cartao_${c.toUpperCase()},${x.desc},${x.value}\n`);
            });
        }
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Historico_Financeiro_${pickerVal}.csv`;
    link.click();
}

window.closePDFModal = () => document.getElementById('pdfModal').style.display = 'none';

// HISTÃ“RICO
window.fetchHistoryData = async (range, btnElement = null) => {
    if(btnElement) { document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active')); btnElement.classList.add('active'); }
    
    const pickerVal = document.getElementById('monthPicker').value;
    const yearRef = parseInt(pickerVal.split('-')[0]);
    const monthRef = parseInt(pickerVal.split('-')[1]);
    const finalRange = (range === 'max') ? 24 : range; 

    const reqs = [], labels = [];
    for(let i=finalRange-1; i>=0; i--) {
        let m = monthRef - i, y = yearRef; 
        while(m <= 0) { m += 12; y--; }
        const id = `${y}-${String(m).padStart(2,'0')}`; 
        labels.push(`${m}/${y}`);
        reqs.push(getDoc(doc(db, "carteira_igor_v42", id)));
    }
    const snaps = await Promise.all(reqs);
    
    const dataIncome = [], dataExpense = [], dataCards = [], dataFixed = [], dataRemaining = [];
    const iconCounts = {};

    snaps.forEach(snap => {
        let inc = 0, expFixed = 0, expCards = 0;
        if(snap.exists()) {
            const d = snap.data();
            inc = (parseFloat(d.salary)||0) + (parseFloat(d.extraIncomeTotal)||0); 
            if(!d.extraIncomeTotal && d.extraIncome) d.extraIncome.forEach(x=>inc+=(parseFloat(x.value)||0));
            
            if(d.main) d.main.forEach(x=>{
                const v = parseFloat(x.value)||0;
                if(!x.locked) {
                    expFixed += v;
                    if(v > 0) {
                        const icon = x.icon || 'ðŸ’¸';
                        iconCounts[icon] = (iconCounts[icon] || 0) + v;
                    }
                }
            });
            const sumC = (l) => { let s=0; if(l) l.forEach(k=>s+=parseFloat(k.value)||0); return s; };
            const cards = d.cardsConfig || window.DEFAULT_CARDS;
            expCards = cards.reduce((sum, c) => sum + (parseFloat(d[c.id+'TotalBill'])||0) - sumC(d[c.id]), 0);
            
            // Add my part of cards to icon counts
            if(expCards > 0) {
                iconCounts['ðŸ’³ CartÃµes'] = (iconCounts['ðŸ’³ CartÃµes'] || 0) + expCards;
            }
        }
        dataIncome.push(inc); dataExpense.push(expFixed + expCards); dataCards.push(expCards); dataFixed.push(expFixed);
        dataRemaining.push(Math.max(0, inc - (expFixed + expCards)));
    });

    // Insights
    const avgExp = dataExpense.reduce((a,b)=>a+b,0) / dataExpense.filter(x=>x>0).length || 0;
    const avgRem = dataRemaining.reduce((a,b)=>a+b,0) / dataRemaining.filter(x=>x>0).length || 0;
    document.getElementById('insightAvgExpense').innerText = fmt(avgExp);
    document.getElementById('insightAvgRemaining').innerText = fmt(avgRem);

    const last = dataExpense[dataExpense.length-1] || 0;
    const prev = dataExpense[dataExpense.length-2] || 0;
    if(prev > 0) {
        const trend = ((last - prev) / prev) * 100;
        const trendEl = document.getElementById('insightTrend');
        trendEl.innerText = (trend > 0 ? '+' : '') + trend.toFixed(1) + '%';
        trendEl.style.color = trend > 0 ? 'var(--danger)' : 'var(--success)';
        
        const statusEl = document.getElementById('insightStatus');
        if(trend > 10) { statusEl.innerText = 'ALERTA ðŸ“ˆ'; statusEl.style.color = 'var(--danger)'; }
        else if(trend < -10) { statusEl.innerText = 'ECONOMIA ðŸ“‰'; statusEl.style.color = 'var(--success)'; }
        else { statusEl.innerText = 'ESTÃVEL âš–ï¸'; statusEl.style.color = 'var(--primary)'; }
    }

    Chart.defaults.color = localStorage.getItem('theme') === 'dark' ? '#94a3b8' : '#64748b';
    Chart.defaults.font.family = "'Inter', sans-serif";

    const ctxBar = document.getElementById('historyChart').getContext('2d');
    if(barChart) barChart.destroy();
    barChart = new Chart(ctxBar, { 
        type: 'bar', 
        data: { labels: labels, datasets: [
            { label: 'Entradas', data: dataIncome, backgroundColor: 'hsl(162, 75%, 45%)', borderRadius: 10, barPercentage: 0.5 }, 
            { label: 'SaÃ­das', data: dataExpense, backgroundColor: 'hsl(0, 84%, 60%)', borderRadius: 10, barPercentage: 0.5 }
        ]}, 
        options: { responsive:true, maintainAspectRatio:false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)', drawBorder: false } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'top', labels: { font: { family: "'Outfit', sans-serif", weight: '700' } } } }, animation: { duration: 1200 } } 
    });

    const ctxCat = document.getElementById('historyCategoryChart').getContext('2d');
    if(historyCategoryChart) historyCategoryChart.destroy();
    historyCategoryChart = new Chart(ctxCat, {
        type: 'line',
        data: { labels: labels, datasets: [
            { label: 'CartÃµes', data: dataCards, borderColor: 'hsl(35, 92%, 55%)', backgroundColor: 'rgba(245, 158, 11, 0.05)', fill: true, tension: 0.4, borderWidth: 4, pointRadius: 4 },
            { label: 'Fixos', data: dataFixed, borderColor: 'hsl(243, 75%, 59%)', backgroundColor: 'rgba(79, 70, 229, 0.05)', fill: true, tension: 0.4, borderWidth: 4, pointRadius: 4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.03)', drawBorder: false } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'top', labels: { font: { family: "'Outfit', sans-serif", weight: '700' } } } }, animation: { duration: 1500 } }
    });

    const ctxIcon = document.getElementById('historyIconChart').getContext('2d');
    if(historyIconChart) historyIconChart.destroy();
    
    const monthCount = snaps.filter(s => s.exists()).length || 1;
    const iconLabels = Object.keys(iconCounts);
    const iconValues = Object.values(iconCounts).map(v => v / monthCount);
    
    historyIconChart = new Chart(ctxIcon, {
        type: 'doughnut',
        data: { labels: iconLabels, datasets: [{ data: iconValues, backgroundColor: ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#14b8a6','#f97316'], borderWidth: 0 }]},
        options: { 
            responsive: true, maintainAspectRatio: false, cutout: '65%', 
            plugins: { 
                legend: { position: 'right', labels: { padding: 15, font: { family: "'Outfit', sans-serif", weight: '600' } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` MÃ©dia: ${fmt(context.raw)}`;
                        }
                    }
                }
            }, 
            animation: { animateScale: true, duration: 2000 } 
        }
    });
};

function fmt(n) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtNumber(n) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

window.copyPreviousMonth = async function() {
    const result = await Swal.fire({
        title: 'Importar MÃªs Anterior?', text: "Puxar parcelas e devedores do mÃªs passado.", icon: 'question',
        showCancelButton: true, confirmButtonText: 'Sim, importar', cancelButtonText: 'Cancelar',
        customClass: { popup: 'meu-popup-sweet', confirmButton: 'meu-botao-sweet-confirm', cancelButton: 'meu-botao-sweet-cancel' }, buttonsStyling: false
    });

    if (result.isConfirmed) {
        const parts = currentDocId.split('-'); let year = parseInt(parts[0]); let month = parseInt(parts[1]);
        month--; if(month===0) { month=12; year--; }
        const prevId = `${year}-${String(month).padStart(2,'0')}`;
        toggleSkeleton(true);
        const snap = await getDoc(doc(db, "carteira_igor_v42", prevId));
        if(snap.exists()) {
            const data = snap.data(); data.paidDebtors = [];
            if(data.main) { data.main = data.main.filter(i => !i.locked); } 
            
            const processItems = (arr) => {
                if(!arr) return [];
                return arr.map(i => {
                    if(i.inst && i.inst.includes('/')) {
                        let [c,t] = i.inst.split('/').map(n => parseInt(n));
                        if(c < t) { i.inst = `${c+1}/${t}`; return i; }
                        return null; // Completed installment
                    }
                    return i; // Item without installments (like a monthly recurrency manual)
                }).filter(i => i !== null);
            };
            
            // Processa itens de todos os cartÃµes dinamicamente
            const cardsConf = data.cardsConfig || window.DEFAULT_CARDS;
            cardsConf.forEach(c => { if (data[c.id]) data[c.id] = processItems(data[c.id]); });
            // Garante cardsConfig na cÃ³pia
            if (!data.cardsConfig) data.cardsConfig = JSON.parse(JSON.stringify(window.DEFAULT_CARDS));
            // Remove auto-rows da cÃ³pia
            if (data.main) data.main = data.main.filter(i => !i.locked);

            updateScreen(data); setTimeout(() => { saveDataSync(currentDocId); toggleSkeleton(false); }, 500);
        } else { toggleSkeleton(false); Swal.fire({ title: 'Ops', text: 'MÃªs anterior vazio.', icon: 'info' }); }
    }
};

// ============================================================
// CARTÃ•ES DINÃ‚MICOS
// ============================================================

function renderCardsView() {
    const container = document.getElementById('cardsContainer');
    if (!container) return;
    container.innerHTML = '';
    window.cardsConfig.forEach(card => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = buildCardSection(card);
        container.appendChild(wrapper.firstElementChild);
    });
}

function buildCardSection(card) {
    const gradient = `linear-gradient(135deg, ${card.color1}, ${card.color2})`;
    return `
    <div class="section" id="section-${card.id}" style="position:relative;">
        <div class="card-row">
            <div class="card-thumb-dyn" style="background:${gradient};">
                <span style="font-size:2.8rem; line-height:1; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">${card.emoji}</span>
            </div>
            <div class="card-info" style="flex:1;">
                <h2 style="display:flex; align-items:center; gap:10px;">
                    ${card.name}
                    <button class="btn-del-card" onclick="removeCard('${card.id}')" title="Remover cartÃ£o">
                        <span class="material-icons-round" style="font-size:1.1rem;">delete_outline</span>
                    </button>
                </h2>
                <div class="bill-wrapper">Fatura: R$ <input type="number" id="${card.id}TotalBill" oninput="scheduleSave()" onfocus="window.isEditing=true" onblur="window.isEditing=false"></div>
                <div class="my-share-text" id="${card.id}MyShareDisplay">Minha Parte: R$ 0,00</div>
            </div>
        </div>
        <div class="sec-body" style="background:var(--bg-body);">
            <div class="table-wrap"><table id="${card.id}Table"><thead><tr><th>Quem</th><th>Dia</th><th>DescriÃ§Ã£o</th><th>Parc.</th><th>Valor (R$)</th><th></th></tr></thead><tbody></tbody></table></div>
            <button class="btn-add" onclick="addSplitRow('${card.id}Table')"><span class="material-icons-round">add</span> Item ${card.name}</button>
        </div>
    </div>`;
}

window.addCard = async () => {
    const colorPresets = [
        { c1: '#FCD34D', c2: '#F59E0B', label: 'ðŸŸ¡ Amarelo' },
        { c1: '#3B82F6', c2: '#1D4ED8', label: 'ðŸ”µ Azul' },
        { c1: '#F97316', c2: '#EA580C', label: 'ðŸŸ  Laranja' },
        { c1: '#A855F7', c2: '#7C3AED', label: 'ðŸŸ£ Roxo' },
        { c1: '#10B981', c2: '#059669', label: 'ðŸŸ¢ Verde' },
        { c1: '#EF4444', c2: '#DC2626', label: 'ðŸ”´ Vermelho' },
        { c1: '#EC4899', c2: '#DB2777', label: 'ðŸ©· Rosa' },
        { c1: '#06B6D4', c2: '#0891B2', label: 'ðŸ©µ Ciano' },
    ];
    const colorOpts = colorPresets.map((p, i) => `<option value="${i}">${p.label}</option>`).join('');

    const { value: formValues } = await Swal.fire({
        title: 'Novo CartÃ£o',
        html: `<div style="text-align:left; display:flex; flex-direction:column; gap:14px;">
            <div><label style="font-size:0.8rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">NOME DO CARTÃƒO</label>
            <input id="swal-card-name" class="swal2-input" placeholder="Ex: Nubank, C6 Bank..." style="margin:0; width:100%; box-sizing:border-box;"></div>
            <div><label style="font-size:0.8rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">ÃCONE (EMOJI)</label>
            <input id="swal-card-emoji" class="swal2-input" placeholder="ðŸ’³" maxlength="2" value="ðŸ’³" style="margin:0; width:100%; box-sizing:border-box; font-size:1.5rem; text-align:center;"></div>
            <div><label style="font-size:0.8rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:6px;">COR</label>
            <select id="swal-card-color" style="width:100%; padding:12px; border-radius:12px; border:2px solid var(--border); background:var(--bg-body); color:var(--text-main); font-size:0.95rem; font-family:'Inter',sans-serif;">${colorOpts}</select></div>
        </div>`,
        showCancelButton: true, confirmButtonText: 'Adicionar', cancelButtonText: 'Cancelar',
        customClass: { popup: 'meu-popup-sweet', confirmButton: 'meu-botao-sweet-confirm', cancelButton: 'meu-botao-sweet-cancel' },
        buttonsStyling: false,
        preConfirm: () => {
            const name = document.getElementById('swal-card-name').value.trim();
            if (!name) { Swal.showValidationMessage('Digite o nome do cartÃ£o'); return false; }
            const emoji = document.getElementById('swal-card-emoji').value.trim() || 'ðŸ’³';
            const idx = parseInt(document.getElementById('swal-card-color').value);
            const { c1, c2 } = colorPresets[idx];
            return { name, emoji, color1: c1, color2: c2 };
        }
    });

    if (formValues) {
        const id = 'card_' + Date.now();
        window.cardsConfig.push({ id, ...formValues });
        renderCardsView();
        syncCardAutoRows();
        scheduleSave();
    }
};

window.removeCard = async (cardId) => {
    const card = window.cardsConfig.find(c => c.id === cardId);
    if (!card) return;
    const result = await Swal.fire({
        title: `Remover ${card.name}?`, text: 'Todos os itens desta fatura serÃ£o perdidos.', icon: 'warning',
        showCancelButton: true, confirmButtonText: 'Sim, remover', cancelButtonText: 'Cancelar',
        customClass: { popup: 'meu-popup-sweet', confirmButton: 'meu-botao-sweet-confirm', cancelButton: 'meu-botao-sweet-cancel' },
        buttonsStyling: false,
    });
    if (result.isConfirmed) {
        window.cardsConfig = window.cardsConfig.filter(c => c.id !== cardId);
        renderCardsView();
        syncCardAutoRows();
        scheduleSave();
    }
};

function syncCardAutoRows() {
    const tbody = document.querySelector('#mainTable tbody');
    if (!tbody) return;

    // Remove auto-rows de cartÃµes que nÃ£o existem mais
    const validIds = new Set(window.cardsConfig.map(c => c.id + '_auto'));
    tbody.querySelectorAll('tr').forEach(tr => {
        const vi = tr.querySelector('.val-input');
        if (vi?.hasAttribute('readonly') && vi?.id && !validIds.has(vi.id)) tr.remove();
    });

    // Adiciona auto-rows para cartÃµes que ainda nÃ£o tÃªm (na frente)
    const existingIds = new Set([...tbody.querySelectorAll('.val-input[readonly]')].map(el => el.id));
    [...window.cardsConfig].reverse().forEach(card => {
        const autoId = card.id + '_auto';
        if (!existingIds.has(autoId)) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><select class="sys-select" onchange="scheduleSave()"><option value="ðŸ’³">ðŸ’³</option></select></td>
                            <td><input type="text" class="sys-input" value="${card.name}" readonly style="background:transparent; color:var(--text-muted); opacity:0.8; cursor:default;"></td>
                            <td><input type="number" class="val-input" value="0" step="0.01" id="${autoId}" readonly style="background:transparent; color:var(--text-muted); opacity:0.8;"></td>
                            <td style="text-align:center"><input type="checkbox" checked onchange="scheduleSave()"></td>
                            <td style="text-align:center"></td>`;
            tbody.insertBefore(tr, tbody.firstChild);
            existingIds.add(autoId);
        }
    });
}


