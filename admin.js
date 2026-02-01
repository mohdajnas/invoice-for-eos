import { DataService } from './data-service.js';

// DOM Elements
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const clientView = document.getElementById('clientView');
const loginForm = document.getElementById('loginForm');
const clientsGrid = document.getElementById('clientsGrid');
const addClientBtn = document.getElementById('addClientBtn');
const addClientModal = document.getElementById('addClientModal');
const closeClientModal = document.getElementById('closeClientModal');
const addClientForm = document.getElementById('addClientForm');
const invoicesList = document.getElementById('invoicesList');
const backToDashBtn = document.getElementById('backToDashBtn');
const newInvoiceBtn = document.getElementById('newInvoiceBtn');
const logoutBtn = document.getElementById('logoutBtn');
const recentInvoicesList = document.getElementById('recentInvoicesList');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const loginBoxHeader = document.querySelector('.login-box h2');

let isRegistering = false;

let currentClientId = null;
let currentClientName = null;

// Chart Instances
let revenueChart = null;
let distributionChart = null;



// Auth Listener
DataService.onAuthStateChanged((user) => {
    const loader = document.getElementById('loadingOverlay');
    if (user) {
        showDashboard();
    } else {
        showLogin();
    }
    // Hide loader after auth check is done
    if (loader && !loader.classList.contains('hidden')) {
        // Small delay for smooth transition
        setTimeout(() => {
            loader.style.display = 'none';
        }, 300);
    }
});

// Navigation Functions
const analyticsView = document.getElementById('analyticsView');

function showLogin() {
    loginView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    clientView.classList.add('hidden');
    analyticsView.classList.add('hidden');
}

function showDashboard() {
    try {
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        clientView.classList.add('hidden');
        analyticsView.classList.add('hidden');
        loadClients();
        loadRecentInvoices();
    } catch (e) {
        console.error("Error in showDashboard: " + e.message);
    }
}

function showAnalytics() {
    loginView.classList.add('hidden');
    dashboardView.classList.add('hidden');
    clientView.classList.add('hidden');
    analyticsView.classList.remove('hidden');
    loadAnalyticsData();
}

function showClientView(clientId, clientName) {
    currentClientId = clientId;
    currentClientName = clientName;
    document.getElementById('clientNameHeader').textContent = clientName;

    loginView.classList.add('hidden');
    dashboardView.classList.add('hidden');
    clientView.classList.remove('hidden');

    loadInvoices(clientId);
}

async function loadAnalyticsData() {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.style.display = 'flex';

    try {
        const invoices = await DataService.fetchAllInvoices();

        // Get Filter Values
        const timeFilter = document.getElementById('analyticsTimeFilter').value;
        const clientFilter = document.getElementById('analyticsClientFilter').value;

        // Populate Client Filter if empty (first load)
        const clientSelect = document.getElementById('analyticsClientFilter');
        if (clientSelect.options.length <= 1) {
            const clients = await DataService.getClients();
            clients.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.name;
                clientSelect.appendChild(opt);
            });
        }

        // Aggregation Variables
        let totalInvoiced = 0;
        let totalReceived = 0;
        let totalDue = 0;

        // Client-wise data map
        const clientStats = {};

        invoices.forEach(inv => {
            // Filter Logic
            if (clientFilter !== 'all' && inv.clientName !== clientFilter) return;
            if (!isWithinPeriod(inv.createdAt, timeFilter)) return;
            if (inv.status === 'closed') return; // Exclude voided/closed invoices

            const amount = parseFloat(inv.totalAmount || 0);
            const received = parseFloat(inv.receivedAmount || 0);
            const due = amount - received;

            // Global Totals
            totalInvoiced += amount;
            totalReceived += received;
            totalDue += due;

            // Client Totals
            const clientName = inv.clientName || 'Unknown';
            if (!clientStats[clientName]) {
                clientStats[clientName] = { invoiced: 0, received: 0, due: 0 };
            }
            clientStats[clientName].invoiced += amount;
            clientStats[clientName].received += received;
            clientStats[clientName].due += due;
        });

        // Update UI Cards
        document.getElementById('statTotalInvoiced').textContent = `₹${totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        document.getElementById('statTotalReceived').textContent = `₹${totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        document.getElementById('statTotalDue').textContent = `₹${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

        // Prepare Chart Data
        const clientLabels = Object.keys(clientStats);
        const clientRevenueData = clientLabels.map(c => clientStats[c].invoiced);
        const clientDueData = clientLabels.map(c => clientStats[c].due);

        renderCharts(clientLabels, clientRevenueData, clientDueData, totalReceived, totalDue);
    } catch (error) {
        console.error("Error loading analytics:", error);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function isWithinPeriod(dateObj, period) {
    if (period === 'all') return true;
    if (!dateObj) return false;

    const date = dateObj.toMillis ? new Date(dateObj.toMillis()) : new Date(dateObj);
    const now = new Date();

    if (period === 'this_month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (period === 'last_month') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear();
    }
    if (period === 'this_year') {
        return date.getFullYear() === now.getFullYear();
    }
    return true;
}

function renderCharts(labels, revenueData, dueData, globalReceived, globalDue) {
    const ctxRevenue = document.getElementById('revenueChart').getContext('2d');
    const ctxDist = document.getElementById('distributionChart').getContext('2d');

    // Destroy existing charts if any
    if (revenueChart) revenueChart.destroy();
    if (distributionChart) distributionChart.destroy();

    // 1. Revenue vs Due Bar Chart
    revenueChart = new Chart(ctxRevenue, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Total Invoiced',
                    data: revenueData,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                },
                {
                    label: 'Balance Due',
                    data: dueData,
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // 2. Global Distribution Doughnut Chart
    distributionChart = new Chart(ctxDist, {
        type: 'doughnut',
        data: {
            labels: ['Received (Paid)', 'Balance Due'],
            datasets: [{
                data: [globalReceived, globalDue],
                backgroundColor: ['#10b981', '#ef4444'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// Data Functions
async function loadClients() {
    // Clear existing (except add btn) - strictly

    // Safer approach: Remove all elements that DO NOT have id='addClientBtn'
    Array.from(clientsGrid.children).forEach(child => {
        if (child.id !== 'addClientBtn') {
            child.remove();
        }
    });

    const clients = await DataService.getClients();
    clients.forEach(client => {
        const card = document.createElement('div');
        card.className = 'client-card';
        card.innerHTML = `
            <div class="delete-client-btn" title="Delete Client" data-id="${client.id}"><i class="fas fa-trash"></i></div>
            <div class="folder-icon"><i class="fas fa-folder"></i></div>
            <h3>${client.name}</h3>
        `;

        // Card click -> View Client
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-client-btn')) {
                showClientView(client.id, client.name)
            }
        });

        // Delete click
        const delBtn = card.querySelector('.delete-client-btn');
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete "${client.name}" and ALL their invoices? This cannot be undone.`)) {
                try {
                    await DataService.deleteClient(client.id);
                    loadClients();
                    loadRecentInvoices(); // Refresh recents in case any were from this client
                } catch (err) {
                    alert("Error deleting client: " + err.message);
                }
            }
        });

        // Insert before add button
        clientsGrid.insertBefore(card, addClientBtn);
    });
}

async function loadRecentInvoices() {
    recentInvoicesList.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Loading...</div>';
    const invoices = await DataService.getAllInvoices(10);

    recentInvoicesList.innerHTML = '';
    if (invoices.length === 0) {
        recentInvoicesList.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No recent invoices found.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();

    invoices.forEach(inv => {
        const item = document.createElement('div');
        item.className = 'invoice-item';
        // Date formatting or number
        const displayDate = inv.date || 'No Date';
        const displayNumber = inv.invoiceNumber || 'No Number';
        const amount = parseFloat(inv.totalAmount) || 0;
        const received = parseFloat(inv.receivedAmount) || 0;
        const clientName = inv.clientName || 'Unknown Client';
        const currency = inv.currency || 'INR';
        const symbol = currency === 'USD' ? '$' : (currency === 'AED' ? 'AED ' : (currency === 'SAR' ? 'SAR ' : '₹'));

        // Status Logic
        let statusText = '';
        let statusColor = '#64748b';

        if (inv.status === 'closed') {
            statusText = 'Closed (Void)';
            statusColor = '#9ca3af';
        } else if (received >= amount - 0.5) {
            statusText = 'Paid';
            statusColor = '#10b981';
        } else if (received > 0) {
            statusText = `Partial (${symbol}${received.toFixed(2)})`;
            statusColor = '#f59e0b';
        } else {
            statusText = 'Unpaid';
            statusColor = '#ef4444';
        }


        item.innerHTML = `
            <div>
                <strong>${displayNumber}</strong> - ${displayDate} <span style="font-size:12px; color:#888;">(${clientName})</span>
                <div style="font-size:12px; color:#555; margin-top:4px; line-height: 1.4;">
                    <div>Total : ${symbol} ${amount.toFixed(2)}</div>
                    <div>Received : ${symbol} ${received.toFixed(2)}</div>
                    <div style="color:${(amount - received) > 0.5 ? '#ef4444' : '#10b981'}">Balance : ${symbol} ${(amount - received).toFixed(2)}</div>
                </div>
                <div style="font-size:11px; font-weight:600; color:${statusColor}; margin-top:4px;">${statusText}</div>
            </div>
            <div class="invoice-actions">
                <div class="payment-dropdown">
                    <button class="payment-menu-btn" title="Payment Options">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="payment-menu-content">
                        <button class="payment-menu-item action-full-pay">
                            <i class="fas fa-check-circle" style="color:#10b981"></i> Full Amount Paid
                        </button>
                        <button class="payment-menu-item action-half-pay">
                            <i class="fas fa-adjust" style="color:#f59e0b"></i> Half Amount Paid
                        </button>
                        <button class="payment-menu-item action-custom-pay">
                            <i class="fas fa-pen" style="color:#3b82f6"></i> Custom Amount...
                        </button>

                    </div>
                </div>

                <button class="btn small-btn close-inv-btn" style="margin-left:5px;" title="Close/Void"><span style="font-weight:bold;">C</span></button>
                <button class="btn small-btn duplicate-inv-btn" style="margin-left:5px;" title="Duplicate"><i class="fas fa-copy"></i></button>
                <button class="btn small-btn edit-inv-btn" style="margin-left:5px;" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="btn small-btn delete-inv-btn" style="margin-left:5px;" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        `;

        // Dropdown Handlers
        const dropdownBtn = item.querySelector('.payment-menu-btn');
        const dropdownContent = item.querySelector('.payment-menu-content');

        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.payment-menu-content.show').forEach(el => {
                if (el !== dropdownContent) el.classList.remove('show');
            });
            dropdownContent.classList.toggle('show');
        });

        // Duplicate
        item.querySelector('.duplicate-inv-btn').addEventListener('click', () => {
            window.open(`index.html?invoiceId=${inv.firebaseId}&mode=duplicate`, '_blank');
        });

        // Close (Void)
        item.querySelector('.close-inv-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to CLOSE (Void) this invoice?\nThe balance will no longer be counted as pending.`)) {
                await DataService.closeInvoice(inv.firebaseId);
                loadRecentInvoices();
            }
        });

        // Full Pay
        item.querySelector('.action-full-pay').addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdownContent.classList.remove('show');
            await DataService.updateReceivedAmount(inv.firebaseId, amount);
            loadRecentInvoices();
        });

        // Half Pay
        item.querySelector('.action-half-pay').addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdownContent.classList.remove('show');
            await DataService.updateReceivedAmount(inv.firebaseId, amount / 2);
            loadRecentInvoices();
        });

        // Custom Pay
        item.querySelector('.action-custom-pay').addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdownContent.classList.remove('show');
            const currentReceived = received;
            setTimeout(async () => {
                const input = prompt(`Enter received amount for ${displayNumber}\nTotal: ${symbol}${amount}\nCurrently Received: ${symbol}${currentReceived}`, currentReceived);

                if (input !== null) {
                    const newAmount = parseFloat(input);
                    if (isNaN(newAmount) || newAmount < 0) {
                        alert("Invalid amount");
                        return;
                    }
                    await DataService.updateReceivedAmount(inv.firebaseId, newAmount);
                    loadRecentInvoices();
                }
            }, 50);
        });

        item.querySelector('.edit-inv-btn').addEventListener('click', () => {
            // console.log('Navigating to invoice: ', inv.firebaseId);
            window.location.href = `index.html?invoiceId=${inv.firebaseId}`;
        });

        const delBtn = item.querySelector('.delete-inv-btn');
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete Invoice ${displayNumber}? This cannot be undone.`)) {
                if (!inv.firebaseId) {
                    alert("Error: Missing Invoice ID. Cannot delete.");
                    return;
                }
                try {
                    await DataService.deleteInvoice(inv.firebaseId);
                    loadRecentInvoices(); // Refresh list
                    if (currentClientId) loadClients(); // Refresh counts if any
                } catch (err) {
                    alert("Error deleting invoice: " + err.message);
                }
            }
        });

        fragment.appendChild(item);
    });

    recentInvoicesList.appendChild(fragment);
}

async function loadInvoices(clientId) {
    const loader = document.getElementById('loadingOverlay');
    if (loader) loader.style.display = 'flex';

    // Clear list but don't show text loader since we have overlay
    invoicesList.innerHTML = '';

    try {
        const invoices = await DataService.getInvoicesByClient(clientId);

        // Emergency Fallback for Rose Corner if DB index is lagging
        let finalInvoices = invoices;
        if (invoices.length === 0 && currentClientName.toUpperCase().includes('ROSE CORNER')) {
            console.log("Empty result for Rose Corner. Attempting client-side fetch...");
            const all = await DataService.getAllInvoices(50);
            finalInvoices = all.filter(inv =>
                inv.clientId === clientId ||
                (inv.clientName && inv.clientName.trim().toUpperCase() === 'ROSE CORNER')
            );
            if (finalInvoices.length > 0) {
                console.log("Recovered invoices via client-side filter:", finalInvoices.length);
            }
        }

        if (finalInvoices.length === 0) {
            invoicesList.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">No invoices found. Create one!</div>';
            return;
        }

        // --- Client Analytics Summary ---
        let totalCount = 0;
        let totalAmount = 0;
        let totalReceived = 0;

        finalInvoices.forEach(inv => {
            totalCount++;
            if (inv.status !== 'closed') {
                totalAmount += parseFloat(inv.totalAmount) || 0;
                totalReceived += parseFloat(inv.receivedAmount) || 0;
            }
        });
        const totalBalance = totalAmount - totalReceived;

        // Use symbol from first invoice
        const currency = finalInvoices[0]?.currency || 'INR';
        const symbol = currency === 'USD' ? '$' : (currency === 'AED' ? 'AED ' : (currency === 'SAR' ? 'SAR ' : '₹'));

        const summaryHTML = `
            <div style="
                background: linear-gradient(to right, #f8fafc, #f1f5f9);
                padding: 16px;
                border-radius: 12px;
                margin-bottom: 24px;
                display: flex;
                flex-wrap: wrap;
                gap: 16px;
                border: 1px solid #e2e8f0;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            ">
                <div style="flex: 1; min-width: 80px; text-align: center; border-right: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Invoices</div>
                    <div style="font-size: 16px; color: #1e293b; font-weight: 700; margin-top:4px;">${totalCount}</div>
                </div>
                <div style="flex: 1; min-width: 80px; text-align: center; border-right: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Total</div>
                    <div style="font-size: 16px; color: #3b82f6; font-weight: 700; margin-top:4px;">${symbol}${totalAmount.toFixed(0)}</div>
                </div>
                <div style="flex: 1; min-width: 80px; text-align: center; border-right: 1px solid #e2e8f0;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Received</div>
                    <div style="font-size: 16px; color: #10b981; font-weight: 700; margin-top:4px;">${symbol}${totalReceived.toFixed(0)}</div>
                </div>
                <div style="flex: 1; min-width: 80px; text-align: center;">
                    <div style="font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase;">Balance</div>
                    <div style="font-size: 16px; color: #ef4444; font-weight: 700; margin-top:4px;">${symbol}${totalBalance.toFixed(0)}</div>
                </div>
            </div>
        `;
        invoicesList.innerHTML = summaryHTML;
        // --------------------------------

        const fragment = document.createDocumentFragment();

        finalInvoices.forEach(inv => {
            const item = document.createElement('div');
            item.className = 'invoice-item';

            // Format numbers
            const displayDate = inv.date || 'No Date';
            const displayNumber = inv.invoiceNumber || 'No Number';
            const amount = parseFloat(inv.totalAmount) || 0;
            const received = parseFloat(inv.receivedAmount) || 0;
            const symbol = inv.currency === 'USD' ? '$' : (inv.currency === 'AED' ? 'AED ' : (inv.currency === 'SAR' ? 'SAR ' : '₹'));

            // Status Logic
            let statusText = '';
            let statusColor = '#64748b';

            if (inv.status === 'closed') {
                statusText = 'Closed (Void)';
                statusColor = '#9ca3af';
            } else if (received >= amount - 0.5) {
                statusText = 'Paid';
                statusColor = '#10b981';
            } else if (received > 0) {
                statusText = `Partial (${symbol}${received.toFixed(2)})`;
                statusColor = '#f59e0b';
            } else {
                statusText = 'Unpaid';
                statusColor = '#ef4444';
            }

            item.innerHTML = `
                <div>
                    <strong>${displayNumber}</strong> - ${displayDate}
                    <div style="font-size:12px; color:#555; margin-top:4px; line-height: 1.4;">
                        <div>Total : ${symbol}${amount.toFixed(2)}</div>
                        <div>Received : ${symbol}${received.toFixed(2)}</div>
                        <div style="color:${(amount - received) > 0.5 ? '#ef4444' : '#10b981'}">Balance : ${symbol}${(amount - received).toFixed(2)}</div>
                    </div>
                    <div style="font-size:11px; font-weight:600; color:${statusColor}; margin-top:4px;">${statusText}</div>
                </div>
                <div class="invoice-actions">
                    <div class="payment-dropdown">
                        <button type="button" class="payment-menu-btn" title="Payment Options">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="payment-menu-content">
                            <button class="payment-menu-item action-full-pay">
                                <i class="fas fa-check-circle" style="color:#10b981"></i> Full Amount Paid
                            </button>
                            <button class="payment-menu-item action-half-pay">
                                <i class="fas fa-adjust" style="color:#f59e0b"></i> Half Amount Paid
                            </button>
                            <button class="payment-menu-item action-custom-pay">
                                <i class="fas fa-pen" style="color:#3b82f6"></i> Custom Amount...
                            </button>

                        </div>
                    </div>

                    <button class="btn small-btn close-inv-btn" style="margin-left:5px;" title="Close/Void"><span style="font-weight:bold;">C</span></button>
                    <button class="btn small-btn duplicate-inv-btn" style="margin-left:5px;" title="Duplicate"><i class="fas fa-copy"></i></button>
                    <button class="btn small-btn edit-inv-btn" style="margin-left:5px;" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn small-btn delete-inv-btn" style="margin-left:5px;" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            `;

            // Dropdown Handlers
            const dropdownBtn = item.querySelector('.payment-menu-btn');
            const dropdownContent = item.querySelector('.payment-menu-content');

            dropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close others
                document.querySelectorAll('.payment-menu-content.show').forEach(el => {
                    if (el !== dropdownContent) el.classList.remove('show');
                });
                dropdownContent.classList.toggle('show');
            });

            // Duplicate
            item.querySelector('.duplicate-inv-btn').addEventListener('click', () => {
                window.open(`index.html?invoiceId=${inv.firebaseId}&mode=duplicate`, '_blank');
            });

            // Close on click outside (this listener accumulates, but for simplicity here it's ok, or move to global)
            // Ideally global click listener handles this, but we can do a local stopPropagation above.

            // Close (Void)
            item.querySelector('.close-inv-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to CLOSE (Void) this invoice?\nThe balance will no longer be counted as pending.`)) {
                    await DataService.closeInvoice(inv.firebaseId);
                    loadInvoices(clientId);
                }
            });

            // Full Pay
            item.querySelector('.action-full-pay').addEventListener('click', async (e) => {
                e.stopPropagation();
                dropdownContent.classList.remove('show');
                await DataService.updateReceivedAmount(inv.firebaseId, amount);
                loadInvoices(clientId);
            });

            // Half Pay
            item.querySelector('.action-half-pay').addEventListener('click', async (e) => {
                e.stopPropagation();
                dropdownContent.classList.remove('show');
                await DataService.updateReceivedAmount(inv.firebaseId, amount / 2);
                loadInvoices(clientId);
            });

            // Custom Pay
            item.querySelector('.action-custom-pay').addEventListener('click', async (e) => {
                e.stopPropagation();
                dropdownContent.classList.remove('show');
                const currentReceived = received;
                // Set timeout to allow menu to close visually
                setTimeout(async () => {
                    const input = prompt(`Enter received amount for ${displayNumber}\nTotal: ${symbol}${amount}\nCurrently Received: ${symbol}${currentReceived}`, currentReceived);

                    if (input !== null) {
                        const newAmount = parseFloat(input);
                        if (isNaN(newAmount) || newAmount < 0) {
                            alert("Invalid amount");
                            return;
                        }
                        await DataService.updateReceivedAmount(inv.firebaseId, newAmount);
                        loadInvoices(clientId);
                    }
                }, 50);
            });

            item.querySelector('.edit-inv-btn').addEventListener('click', () => {
                window.location.href = `index.html?invoiceId=${inv.firebaseId}`;
            });

            const delBtn = item.querySelector('.delete-inv-btn');
            delBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete Invoice ${displayNumber}? This cannot be undone.`)) {
                    if (!inv.firebaseId) {
                        alert("Error: Missing Invoice ID. Cannot delete.");
                        return;
                    }
                    try {
                        await DataService.deleteInvoice(inv.firebaseId);
                        loadInvoices(clientId);
                        loadRecentInvoices();
                        if (currentClientId) loadClients();
                    } catch (err) {
                        alert("Error deleting invoice: " + err.message);
                    }
                }
            });

            fragment.appendChild(item);
        });

        invoicesList.appendChild(fragment);

        // Add global listener once to close menus
        if (!window.menuListenerAdded) {
            document.addEventListener('click', () => {
                document.querySelectorAll('.payment-menu-content.show').forEach(el => el.classList.remove('show'));
            });
            window.menuListenerAdded = true;
        }
    } catch (e) {
        console.error("Error loading invoices:", e);
        invoicesList.innerHTML = `<div style="padding:20px; text-align:center; color:#ef4444;">Error loading invoices.</div>`;
    } finally {
        // HIDE OVERLAY
        if (loader) {
            setTimeout(() => {
                loader.style.display = 'none';
            }, 300); // Small delay for smooth feel
        }
    }
}

// Event Listeners
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginSubmitBtn');
    const originalText = loginBtn.textContent;

    loginBtn.textContent = 'Processing...';
    loginBtn.disabled = true;

    try {
        if (isRegistering) {
            await DataService.register(email, password);
            alert("Account created successfully!");
        } else {
            await DataService.login(email, password);
        }
        // Force transition in case listener is slow
        // showDashboard(); // Removed to prevent double triggering with auth listener
    } catch (error) {
        console.error(error);
        if (error.code === 'auth/configuration-not-found' || error.code === 'auth/operation-not-allowed') {
            alert("Error: Email/Password authentication is not enabled. Please go to the Firebase Console -> Authentication -> Sign-in method and enable 'Email/Password'.");
        } else {
            alert((isRegistering ? "Registration" : "Login") + " failed: " + error.message);
        }
    } finally {
        loginBtn.textContent = originalText;
        loginBtn.disabled = false;
    }
});



logoutBtn.addEventListener('click', () => DataService.logout());

addClientBtn.addEventListener('click', () => {
    addClientModal.classList.remove('hidden');
});

closeClientModal.addEventListener('click', () => {
    addClientModal.classList.add('hidden');
});

addClientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newClientName').value;
    try {
        await DataService.addClient({ name });
        addClientModal.classList.add('hidden');
        document.getElementById('newClientName').value = '';
        loadClients();
    } catch (error) {
        console.error(error);
        if (error.code === 'permission-denied') {
            alert("Permission Error: Please go to Firebase Console -> Firestore Database -> Rules, and change them to allow read/write for authenticated users.\n\nExample:\nallow read, write: if request.auth != null;");
        } else {
            alert("Error adding client: " + error.message);
        }
    }
});

backToDashBtn.addEventListener('click', showDashboard);
// Event Listeners for Analytics
document.getElementById('showAnalyticsBtn').addEventListener('click', showAnalytics);
document.getElementById('backToDashFromAnalyticsBtn').addEventListener('click', showDashboard);

// Global Scope for Refresh Button
window.loadAnalyticsData = loadAnalyticsData;
newInvoiceBtn.addEventListener('click', () => {
    if (currentClientId) {
        // Pass client ID and Name to prefill
        const urlP = new URLSearchParams();
        urlP.set('clientId', currentClientId);
        urlP.set('clientName', currentClientName);
        window.location.href = `index.html?${urlP.toString()}`;
    }
});

// Utility to fix missing client links
// Utility to fix missing client links
window.fixRoseCornerData = async () => {
    const btn = document.getElementById('fixDataBtn');
    if (btn) btn.textContent = 'Fixing...';

    try {
        console.log("Starting fix...");
        // 1. Get Client ID for ROSE CORNER
        const clients = await DataService.getClients();
        // Use filter to find potential duplicates
        const roseClients = clients.filter(c => c.name.trim().toUpperCase() === 'ROSE CORNER');

        if (roseClients.length === 0) {
            alert("Client 'ROSE CORNER' not found. Please create the client folder first.");
            if (btn) btn.textContent = 'Fix Data';
            return;
        }

        if (roseClients.length > 1) {
            alert(`WARNING: Multiple (${roseClients.length}) 'ROSE CORNER' clients found! Consolidating to the first one found.`);
        }

        const roseClient = roseClients[0]; // Use the first one
        console.log("Using Target Client:", roseClient);

        // 2. Get Recent Invoices
        const invoices = await DataService.getAllInvoices(50);
        const targetInvoices = invoices.filter(inv => ['INVRC01', 'INVRC02'].includes(inv.invoiceNumber));

        if (targetInvoices.length === 0) {
            alert("Invoices INVRC01/02 not found in recent list.");
            if (btn) btn.textContent = 'Fix Data';
            return;
        }

        // 3. Update them FORCEFULLY
        let updatedCount = 0;
        for (const inv of targetInvoices) {
            console.log(`Force Updating ${inv.invoiceNumber}. Old ClientID: ${inv.clientId} -> New ClientID: ${roseClient.id}`);

            const newData = {
                ...inv,
                clientId: roseClient.id,
                clientName: roseClient.name, // Ensure exact name match
                updatedAt: new Date() // Force timestamp to ensure write
            };

            await DataService.saveInvoice(newData);
            updatedCount++;
        }

        alert(`Forced update on ${updatedCount} invoices. Page will now reload.`);
        location.reload();

    } catch (e) {
        console.error(e);
        alert("Error fixing data: " + e.message);
        if (btn) btn.textContent = 'Fix Data';
    }
};
