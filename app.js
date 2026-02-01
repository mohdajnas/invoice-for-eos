import { DataService } from './data-service.js';

class InvoiceApp {
    constructor() {
        // Query Params
        this.queryParams = new URLSearchParams(window.location.search);
        this.clientId = this.queryParams.get('clientId');
        if (this.clientId === 'null' || this.clientId === 'undefined') this.clientId = null;

        this.invoiceId = this.queryParams.get('invoiceId');
        if (this.invoiceId === 'null' || this.invoiceId === 'undefined') this.invoiceId = null;

        this.duplicateMode = this.queryParams.get('mode') === 'duplicate';
        this.clientNameParam = this.queryParams.get('clientName');

        this.isEditMode = false;
        this.itemCount = 1;
        this.gstEnabled = false;
        this.gstPercentage = 18;
        this.currency = 'INR';

        // Fixed currency symbols
        this.currencySymbols = {
            'INR': '₹',
            'USD': '$',
            'AED': 'AED ',
            'SAR': 'SAR '
        };

        this.initializeApp();
        this.attachEventListeners();
        this.updateCalculations();
        this.advanceEnabled = false;
        this.advancePercentage = 50;
        this.advanceBase = 'total';
    }

    initializeApp() {
        document.body.classList.add('view-mode');
        this.updateViewTexts();
        this.setupPagination();
        this.initializeGST();
        this.initializeCurrency();
        this.initializeAdvance();
        this.initializeClientSelector();
        this.initializeDate();
        this.handleAdminFeatures();

        this.addRemarkSection();
        this.createEditableAmountTitles();
        this.loadSeal();

        const signatureUpload = document.getElementById('signatureUpload');
        if (signatureUpload) {
            signatureUpload.style.display = 'none';
        }
    }

    async initializeClientSelector() {
        const selector = document.getElementById('clientSelector');
        if (!selector) return;

        try {
            const clients = await DataService.getClients();
            // Clear existing options except first
            while (selector.options.length > 1) selector.remove(1);

            clients.forEach(client => {
                const opt = document.createElement('option');
                opt.value = client.id;
                opt.textContent = client.name;
                // Store full client data in dataset if needed, or just fetch on select
                opt.dataset.address = client.address || ''; // Assuming address exists
                opt.dataset.contact = client.contact || ''; // Assuming contact exists
                selector.appendChild(opt);
            });

            selector.addEventListener('change', (e) => {
                const clientId = e.target.value;
                if (!clientId) return;

                this.clientId = clientId; // Update local state
                const selectedOpt = e.target.selectedOptions[0];
                const clientName = selectedOpt.textContent;

                // Construct address/contact if available, or just set name
                // Note: client object structure in DataService.getClients() might need check. 
                // Using generic approach:
                document.getElementById('clientName').value = clientName;

                // If we want to auto-fill address/contact we need to make sure getClients returns it.
                // admin.js loadClients uses DataService.getClients().
                // Let's assume for now we just link the ID and Name. User can fill others.

                this.updateViewTexts();
                console.log(`Client linked: ${clientName} (${clientId})`);
            });

        } catch (error) {
            console.error("Error initializing client selector:", error);
        }
    }

    initializeGST() {
        const gstCheckbox = document.getElementById('gstEnabled');
        const gstPercentageGroup = document.getElementById('gstPercentageGroup');
        const gstAmountRow = document.getElementById('gstAmountRow');
        const gstPercentageInput = document.getElementById('gstPercentage');

        // Set initial GST state
        if (gstCheckbox) {
            gstCheckbox.checked = false;
            this.gstEnabled = false;

            // Add GST checkbox event listener
            gstCheckbox.addEventListener('change', (e) => {
                console.log('GST checkbox changed:', e.target.checked);
                this.toggleGST(e.target.checked);
            });
        }

        if (gstPercentageInput) {
            gstPercentageInput.value = this.gstPercentage;

            // Add GST percentage input event listener
            gstPercentageInput.addEventListener('input', (e) => {
                console.log('GST percentage changed:', e.target.value);
                this.gstPercentage = parseFloat(e.target.value) || 18;
                this.updateCalculations();
            });
        }

        // Hide GST controls initially
        if (gstPercentageGroup) gstPercentageGroup.style.display = 'none';
        if (gstAmountRow) gstAmountRow.style.display = 'none';
    }

    initializeCurrency() {
        const currencySelect = document.getElementById('currencySelect');
        const currencyDisplay = document.getElementById('currencyDisplay');

        if (currencySelect) {
            currencySelect.value = this.currency;

            // Remove any existing event listeners to avoid duplicates
            currencySelect.removeEventListener('change', this.currencyChangeHandler);

            // Add new event listener
            this.currencyChangeHandler = (e) => {
                this.handleCurrencyChange(e.target.value);
            };

            currencySelect.addEventListener('change', this.currencyChangeHandler);
        }

        this.updateCurrencyDisplay();
    }

    initializeAdvance() {
        const advanceCheckbox = document.getElementById('advanceEnabled');
        const advancePercentageInput = document.getElementById('advancePercentage');

        // Only proceed if elements exist
        if (!advanceCheckbox || !advancePercentageInput) {
            console.log('Advance elements not found in DOM - advance functionality disabled');
            return;
        }

        const advancePercentageGroup = document.getElementById('advancePercentageGroup');
        const advanceBaseGroup = document.getElementById('advanceBaseGroup');
        const advanceAmountRow = document.getElementById('advanceAmountRow');

        // Set initial values
        advanceCheckbox.checked = false;
        this.advanceEnabled = false;
        this.advancePercentage = parseFloat(advancePercentageInput.value) || 50;
        this.advanceBase = 'total';

        // Hide controls initially
        if (advancePercentageGroup) advancePercentageGroup.style.display = 'none';
        if (advanceBaseGroup) advanceBaseGroup.style.display = 'none';
        if (advanceAmountRow) advanceAmountRow.style.display = 'none';

        console.log('Advance initialized successfully');
    }

    initializeDate() {
        const dateInput = document.getElementById('invoiceDate');
        if (dateInput && !dateInput.value) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            dateInput.value = `${year}-${month}-${day}`;
            this.updateViewTexts();
        }
    }

    attachEventListeners() {
        // Mode toggle
        const toggleBtn = document.getElementById('toggleMode');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleMode());
        }

        // Print button
        const printBtn = document.getElementById('printBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.printInvoice());
        }

        // Download button - FIXED
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadPDF());
        }

        // Add Row button - FIXED
        const addRowBtn = document.getElementById('addRowBtn');
        if (addRowBtn) {
            addRowBtn.addEventListener('click', () => this.addItemRow());
        }

        // ADVANCE CONTROLS - Add null checks
        const advanceCheckbox = document.getElementById('advanceEnabled');
        if (advanceCheckbox) {
            advanceCheckbox.addEventListener('change', (e) => this.toggleAdvance(e.target.checked));
        }

        const advancePercentageInput = document.getElementById('advancePercentage');
        if (advancePercentageInput) {
            advancePercentageInput.addEventListener('input', (e) => {
                console.log('Advance percentage input changed to:', e.target.value);
                this.updateAdvancePercentage();
            });
        }

        const advanceBaseSelect = document.getElementById('advanceBase');
        if (advanceBaseSelect) {
            advanceBaseSelect.addEventListener('change', () => this.updateAdvanceBase());
        }

        // Form field listeners
        this.attachFormListeners();

        // Signature upload (disabled)
        const signatureUpload = document.getElementById('signatureUpload');
        if (signatureUpload) {
            signatureUpload.addEventListener('change', (e) => this.handleSignatureUpload(e));
        }

        // Initial row calculation listeners
        this.attachRowListeners(0);
    }

    attachFormListeners() {
        // Invoice metadata listeners
        const invoiceNumber = document.getElementById('invoiceNumber');
        if (invoiceNumber) {
            invoiceNumber.addEventListener('input', () => this.updateViewTexts());
        }

        const invoiceDate = document.getElementById('invoiceDate');
        if (invoiceDate) {
            invoiceDate.addEventListener('change', () => this.updateViewTexts());
        }

        const dueDate = document.getElementById('dueDate');
        if (dueDate) {
            dueDate.addEventListener('change', () => this.updateViewTexts());
        }

        // Client details listeners
        const clientName = document.getElementById('clientName');
        if (clientName) {
            clientName.addEventListener('input', () => this.updateViewTexts());
        }

        const clientAddress = document.getElementById('clientAddress');
        if (clientAddress) {
            clientAddress.addEventListener('input', () => this.updateViewTexts());
        }

        const clientContact = document.getElementById('clientContact');
        if (clientContact) {
            clientContact.addEventListener('input', () => this.updateViewTexts());
        }

        // Received amount listener
        const receivedAmount = document.getElementById('receivedAmount');
        if (receivedAmount) {
            receivedAmount.addEventListener('input', () => {
                this.updateCalculations();
                this.updateViewTexts();
            });
        }

        // Add remark field listener
        setTimeout(() => {
            const remarkField = document.getElementById('remarkField');
            if (remarkField) {
                remarkField.addEventListener('input', () => this.updateViewTexts());
            }
        }, 100);
    }

    attachRowListeners(rowIndex) {
        const row = document.querySelector(`[data-row="${rowIndex}"]`);
        if (!row) return;

        const descInput = row.querySelector('.item-description');
        const rateInput = row.querySelector('.item-rate');
        const qtyInput = row.querySelector('.item-qty');

        if (descInput) {
            descInput.addEventListener('input', () => this.updateRowView(rowIndex));
        }

        if (rateInput) {
            rateInput.addEventListener('input', () => {
                this.updateRowCalculation(rowIndex);
                this.updateRowView(rowIndex);
                this.updateCalculations();
            });
        }

        if (qtyInput) {
            qtyInput.addEventListener('input', () => {
                this.updateRowCalculation(rowIndex);
                this.updateRowView(rowIndex);
                this.updateCalculations();
            });
        }
    }

    addRemarkSection() {
        const remarkContainer = document.getElementById('remarkSection');
        if (!remarkContainer) {
            const signatureSection = document.querySelector('.signature-section');
            const remarkDiv = document.createElement('div');
            remarkDiv.id = 'remarkSection';
            remarkDiv.className = 'remark-section';
            remarkDiv.style.marginBottom = '20px';
            remarkDiv.innerHTML = `
            <div class="field-group">
                <label class="field-label">REMARK:</label>
                <input type="text" id="remarkField" class="edit-field" placeholder="Enter remark here" 
                    style="width: 100%; padding: 8px; font-style: italic;">
                <span class="view-text" id="remarkView" style="font-style: italic;">-</span>
            </div>
            `;
            signatureSection.parentNode.insertBefore(remarkDiv, signatureSection);
        }
    }

    createEditableAmountTitles() {
        const totalsSection = document.querySelector('.totals-section');
        if (!totalsSection || document.getElementById('subtotalTitleInput')) return;

        const defaultTitles = {
            'subtotal': 'SUBTOTAL',
            'gst': 'GST AMOUNT',
            'total': 'TOTAL',
            'received': 'RECEIVED AMOUNT',
            'balance': 'BALANCE DUE'
        };

        // Find all totals rows and make titles editable
        const rows = totalsSection.querySelectorAll('.totals-row, .total-row, .balance-due-row, .gst-row');

        rows.forEach((row, index) => {
            const label = row.querySelector('label');
            if (!label) return;

            let currentText = label.textContent.trim();
            if (currentText.endsWith(':') || currentText.endsWith(' :')) {
                currentText = currentText.replace(/ *:$/, '');
            }
            const fieldType = Object.keys(defaultTitles).find(key =>
                defaultTitles[key] === currentText || currentText.includes(defaultTitles[key])
            ) || 'custom' + index;

            // Create container for editable title
            const titleContainer = document.createElement('div');
            titleContainer.className = 'title-container';
            titleContainer.style.display = 'flex';
            titleContainer.style.alignItems = 'center';
            titleContainer.style.minWidth = '150px';

            // Create editable input for title
            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.id = fieldType + 'TitleInput';
            titleInput.className = 'edit-field title-edit';
            titleInput.value = currentText;
            titleInput.style.fontWeight = '600';
            titleInput.style.fontSize = '14px';
            titleInput.style.border = 'none';
            titleInput.style.background = 'transparent';
            titleInput.style.minWidth = '120px';

            // Create display span for view mode
            const titleView = document.createElement('span');
            titleView.className = 'view-text title-view';
            titleView.textContent = currentText + ' :';
            titleView.style.fontWeight = '600';

            // Add event listener to sync input with display
            titleInput.addEventListener('input', () => {
                titleView.textContent = titleInput.value + ' :';
                label.textContent = titleInput.value + ' :';
            });

            // Replace label content with our container
            titleContainer.appendChild(titleInput);
            titleContainer.appendChild(titleView);

            // Replace the original label
            label.parentNode.replaceChild(titleContainer, label);
        });
    }

    handleSignatureUpload(e) {
        // Disable signature upload functionality
        e.preventDefault();
        e.target.value = '';
        alert('Signature upload has been disabled. Use the signature placeholder only.');
        return false;
    }

    toggleGST(enabled) {
        console.log('Toggling GST:', enabled);
        this.gstEnabled = enabled;

        const gstPercentageGroup = document.getElementById('gstPercentageGroup');
        const gstAmountRow = document.getElementById('gstAmountRow');

        if (gstPercentageGroup) {
            gstPercentageGroup.style.display = enabled ? 'flex' : 'none';
        }

        if (gstAmountRow) {
            gstAmountRow.style.display = enabled ? 'flex' : 'none';
        }

        // Update calculations when GST is toggled
        this.updateCalculations();
        this.updateViewTexts();
    }

    toggleAdvance(enabled) {
        this.advanceEnabled = enabled;
        const advancePercentageGroup = document.getElementById('advancePercentageGroup');
        const advanceBaseGroup = document.getElementById('advanceBaseGroup');
        const advanceAmountRow = document.getElementById('advanceAmountRow');

        if (enabled) {
            if (advancePercentageGroup) advancePercentageGroup.style.display = 'flex';
            if (advanceBaseGroup) advanceBaseGroup.style.display = 'flex';
            if (advanceAmountRow) advanceAmountRow.style.display = 'flex';
        } else {
            if (advancePercentageGroup) advancePercentageGroup.style.display = 'none';
            if (advanceBaseGroup) advanceBaseGroup.style.display = 'none';
            if (advanceAmountRow) advanceAmountRow.style.display = 'none';
        }

        this.updateAdvanceCalculation();
    }

    updateAdvancePercentage() {
        const advancePercentageInput = document.getElementById('advancePercentage');
        const oldPercentage = this.advancePercentage;
        this.advancePercentage = parseFloat(advancePercentageInput.value) || 0;

        console.log(`Advance percentage changed from ${oldPercentage}% to ${this.advancePercentage}%`);

        // Update the display percentage immediately
        const displayElement = document.getElementById('advancePercentageDisplay');
        if (displayElement) {
            displayElement.textContent = this.advancePercentage;
        }

        // Force immediate recalculation
        this.updateAdvanceCalculation();
    }

    updateAdvanceBase() {
        const advanceBaseSelect = document.getElementById('advanceBase');
        this.advanceBase = advanceBaseSelect.value;

        // Update the display text
        const displayText = this.advanceBase === 'subtotal' ? 'Subtotal' : 'Total Amount';
        const displayElement = document.getElementById('advanceBaseDisplay');
        if (displayElement) {
            displayElement.textContent = displayText;
        }

        // Force recalculation
        this.updateAdvanceCalculation();
    }

    updateAdvanceCalculation() {
        const advanceAmountElement = document.getElementById('advanceAmount');

        if (!this.advanceEnabled || !advanceAmountElement) {
            if (advanceAmountElement) {
                advanceAmountElement.textContent = this.formatCurrency(0);
            }
            return;
        }

        // Get the base amount based on selection
        let baseAmount = 0;

        if (this.advanceBase === 'subtotal') {
            // Calculate subtotal from current items
            document.querySelectorAll('.item-row').forEach((row, index) => {
                const rateValue = row.querySelector('.item-rate').value;
                const qtyValue = row.querySelector('.item-qty').value;

                const rate = parseFloat(rateValue) || 0;
                const qty = parseInt(qtyValue) || 1;
                const itemAmount = rate * qty;

                console.log(`Item ${index}: Rate=${rate}, Qty=${qty}, Amount=${itemAmount}`);
                baseAmount += itemAmount;
            });
        } else {
            // Use total amount (subtotal + GST if enabled)
            baseAmount = this.calculateTotal();
        }

        // Calculate advance amount using current percentage
        const advanceAmount = (baseAmount * this.advancePercentage) / 100;

        console.log(`Advance Calculation: ${this.advancePercentage}% of ${this.formatCurrency(baseAmount)} = ${this.formatCurrency(advanceAmount)}`);

        // Update the display immediately
        advanceAmountElement.textContent = this.formatCurrency(advanceAmount);
    }

    updateCurrencyDisplay() {
        const currencyDisplay = document.getElementById('currencyDisplay');
        if (currencyDisplay) {
            const currencyNames = {
                'INR': 'Indian Rupee',
                'USD': 'US Dollar',
                'AED': 'UAE Dirham',
                'SAR': 'Saudi Riyal'
            };

            currencyDisplay.textContent = `${this.currencySymbols[this.currency]} ${this.currency} (${currencyNames[this.currency]})`;
        }
    }

    updateAllItemAmounts() {
        // Update all item row amounts with new currency symbol
        const rows = document.querySelectorAll('[data-row]');
        rows.forEach((row, index) => {
            this.updateRowCalculation(index);
            this.updateRowView(index);
        });
    }

    calculateTotal() {
        let subtotal = 0;

        // Calculate subtotal
        document.querySelectorAll('.item-row').forEach((row) => {
            const rateValue = row.querySelector('.item-rate').value;
            const qtyValue = row.querySelector('.item-qty').value;

            const rate = parseFloat(rateValue) || 0;
            const qty = parseInt(qtyValue) || 1;

            subtotal += (rate * qty);
        });

        // Add GST if enabled
        if (this.gstEnabled) {
            const gstAmount = (subtotal * this.gstPercentage) / 100;
            return subtotal + gstAmount;
        }

        return subtotal;
    }

    toggleMode() {
        this.isEditMode = !this.isEditMode;
        const body = document.body;
        const toggleBtn = document.getElementById('toggleMode');

        if (this.isEditMode) {
            body.classList.remove('view-mode');
            body.classList.add('edit-mode');
            toggleBtn.textContent = 'Switch to View Mode';
            this.enableFields();
        } else {
            body.classList.remove('edit-mode');
            body.classList.add('view-mode');
            toggleBtn.textContent = 'Switch to Edit Mode';
            this.disableFields();
            this.updateViewTexts();
        }
    }

    enableFields() {
        const editFields = document.querySelectorAll('.edit-field');
        editFields.forEach(field => {
            field.removeAttribute('readonly');
            field.removeAttribute('disabled');
        });

        // Enable checkboxes
        const gstCheckbox = document.getElementById('gstEnabled');
        if (gstCheckbox) gstCheckbox.removeAttribute('disabled');

        const advanceCheckbox = document.getElementById('advanceEnabled');
        if (advanceCheckbox) advanceCheckbox.removeAttribute('disabled');

        const clientSelector = document.getElementById('clientSelector');
        if (clientSelector) clientSelector.style.display = 'inline-block';
    }

    disableFields() {
        const editFields = document.querySelectorAll('.edit-field');
        editFields.forEach(field => {
            field.setAttribute('readonly', true);
        });

        // Disable checkboxes in view mode
        const gstCheckbox = document.getElementById('gstEnabled');
        if (gstCheckbox) gstCheckbox.setAttribute('disabled', true);

        const advanceCheckbox = document.getElementById('advanceEnabled');
        if (advanceCheckbox) advanceCheckbox.setAttribute('disabled', true);

        const clientSelector = document.getElementById('clientSelector');
        if (clientSelector) clientSelector.style.display = 'none';
    }

    updateViewTexts() {
        // Invoice metadata
        const invoiceNumber = document.getElementById('invoiceNumber').value || 'INV002';
        const invoiceNumberView = document.querySelector('#invoiceNumber + .view-text');
        if (invoiceNumberView) invoiceNumberView.textContent = invoiceNumber;

        const invoiceDate = document.getElementById('invoiceDate').value;
        const formattedDate = invoiceDate ? this.formatDate(invoiceDate) : '-';
        const invoiceDateView = document.querySelector('#invoiceDate + .view-text');
        if (invoiceDateView) invoiceDateView.textContent = formattedDate;

        const dueDate = document.getElementById('dueDate').value;
        const formattedDueDate = dueDate ? this.formatDate(dueDate) : '-';
        const dueDateView = document.querySelector('#dueDate + .view-text');
        if (dueDateView) dueDateView.textContent = formattedDueDate;

        // Client details
        const clientName = document.getElementById('clientName').value || '-';
        const clientNameView = document.getElementById('clientNameView');
        if (clientNameView) clientNameView.textContent = clientName;

        const clientAddress = document.getElementById('clientAddress').value || '-';
        const clientAddressView = document.getElementById('clientAddressView');
        if (clientAddressView) clientAddressView.innerHTML = clientAddress.replace(/\n/g, '<br>');

        const clientContact = document.getElementById('clientContact').value || '-';
        const clientContactView = document.getElementById('clientContactView');
        if (clientContactView) clientContactView.textContent = clientContact;

        // Received amount
        const receivedAmount = parseFloat(document.getElementById('receivedAmount').value) || 0;
        const receivedAmountView = document.getElementById('receivedAmountView');
        if (receivedAmountView) receivedAmountView.textContent = this.formatCurrency(receivedAmount);

        // Remark update
        const remarkField = document.getElementById('remarkField');
        const remarkView = document.getElementById('remarkView');
        if (remarkField && remarkView) {
            remarkView.textContent = remarkField.value || '-';
            remarkView.style.fontStyle = 'italic';
        }

        // Update all row views
        document.querySelectorAll('.item-row').forEach((row, index) => {
            this.updateRowView(index);
        });
    }

    updateRowView(rowIndex) {
        const row = document.querySelector(`[data-row="${rowIndex}"]`);
        if (!row) return;

        const description = row.querySelector('.item-description').value || '-';
        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
        const qty = parseInt(row.querySelector('.item-qty').value) || 1;

        const descView = row.querySelector('.item-description-view');
        const rateView = row.querySelector('.item-rate-view');
        const qtyView = row.querySelector('.item-qty-view');

        if (descView) descView.textContent = description;
        if (rateView) rateView.textContent = this.formatCurrency(rate);
        if (qtyView) qtyView.textContent = qty.toString();
    }

    addItemRow() {
        const tbody = document.getElementById('itemsTableBody');
        if (!tbody) return;

        const newRow = document.createElement('tr');
        newRow.className = 'item-row';
        newRow.setAttribute('data-row', this.itemCount);

        newRow.innerHTML = `
            <td>
                <input type="text" class="item-description edit-field" placeholder="Enter description" readonly>
                <span class="view-text item-description-view">-</span>
            </td>
            <td>
                <input type="number" class="item-rate edit-field" step="0.01" min="0" placeholder="0.00" readonly>
                <span class="view-text item-rate-view">${this.formatCurrency(0)}</span>
            </td>
            <td>
                <input type="number" class="item-qty edit-field" min="1" value="1" readonly>
                <span class="view-text item-qty-view">1</span>
            </td>
            <td class="item-amount">${this.formatCurrency(0)}</td>
            <td class="edit-only">
                <button class="remove-row-btn" onclick="invoiceApp.removeRow(${this.itemCount})">×</button>
            </td>
        `;

        tbody.appendChild(newRow);
        this.attachRowListeners(this.itemCount);

        // If in edit mode, enable the fields
        if (this.isEditMode) {
            const editFields = newRow.querySelectorAll('.edit-field');
            editFields.forEach(field => field.removeAttribute('readonly'));
        }

        this.itemCount++;
        this.checkPagination();
    }

    removeRow(rowIndex) {
        const row = document.querySelector(`[data-row="${rowIndex}"]`);
        if (row) {
            row.remove();
            this.updateCalculations();
            this.checkPagination();
        }
    }

    updateRowCalculation(rowIndex) {
        const row = document.querySelector(`[data-row="${rowIndex}"]`);
        if (!row) return;

        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const amount = rate * qty;

        const amountCell = row.querySelector('.item-amount');
        if (amountCell) {
            amountCell.textContent = this.formatCurrency(amount);
        }
    }

    updateCalculations() {
        let subtotal = 0;

        // Calculate subtotal from all rows
        const rows = document.querySelectorAll('[data-row]');
        rows.forEach(row => {
            const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            subtotal += rate * qty;
        });

        // Calculate GST - FIXED LOGIC
        let gstAmount = 0;
        if (this.gstEnabled && subtotal > 0) {
            gstAmount = (subtotal * this.gstPercentage) / 100;
            console.log('GST Calculation:', {
                enabled: this.gstEnabled,
                subtotal: subtotal,
                percentage: this.gstPercentage,
                amount: gstAmount
            });
        }

        // Calculate advance (for display only - doesn't affect balance due)
        let advanceAmount = 0;
        if (this.advanceEnabled) {
            const baseAmount = this.advanceBase === 'subtotal' ? subtotal : (subtotal + gstAmount);
            advanceAmount = (baseAmount * this.advancePercentage) / 100;
        }

        // Calculate total
        const total = subtotal + gstAmount;

        // Get received amount
        const receivedAmountInput = document.getElementById('receivedAmount');
        const receivedAmount = parseFloat(receivedAmountInput?.value) || 0;

        // Calculate balance due (CORRECTED: advance amount is NOT subtracted)
        const balanceDue = total - receivedAmount;

        // Get current currency symbol
        const symbol = this.currencySymbols[this.currency];

        // Update ALL displays with consistent currency symbol using correct element IDs
        this.updateAmountDisplay('subtotalAmount', subtotal, symbol);
        this.updateAmountDisplay('gstAmount', gstAmount, symbol);
        this.updateAmountDisplay('advanceAmount', advanceAmount, symbol);
        this.updateAmountDisplay('totalAmount', total, symbol);

        // Update balance due displays directly with correct IDs from HTML
        const balanceDueDisplay = document.getElementById('balanceDueDisplay');
        const finalBalanceDue = document.getElementById('finalBalanceDue');

        if (balanceDueDisplay) {
            balanceDueDisplay.textContent = `${symbol}${balanceDue.toFixed(2)}`;
        }

        if (finalBalanceDue) {
            finalBalanceDue.textContent = `${symbol}${balanceDue.toFixed(2)}`;
        }

        console.log('Final calculations:', {
            currency: this.currency,
            symbol: symbol,
            subtotal: subtotal,
            gstAmount: gstAmount,
            advanceAmount: advanceAmount, // This is for display only
            total: total,
            balanceDue: balanceDue // This is total - received only
        });
    }
    updateAmountDisplay(elementId, amount) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = this.formatCurrency(amount);
        }
    }

    formatCurrency(amount) {
        const numAmount = parseFloat(amount) || 0;
        const symbol = this.currencySymbols[this.currency] || '₹';
        return `${symbol}${numAmount.toFixed(2)}`;
    }

    handleCurrencyChange(newCurrency) {
        console.log('Currency changing from', this.currency, 'to', newCurrency);
        this.currency = newCurrency;

        // Update currency display
        this.updateCurrencyDisplay();

        // Update all item amounts
        this.updateAllItemAmounts();

        // Update all calculations
        this.updateCalculations();

        // Update view texts
        this.updateViewTexts();
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }

    async printInvoice() {
        console.log("Print initiated");

        // 1. Trigger Auto-save in BACKGROUND
        this.saveInvoiceData(true).catch(e => console.error("Background auto-save failed:", e));

        // 2. Print immediately (CSS handles the view mode)
        window.print();
    }

    async downloadPDF() {
        // Auto-save
        await this.saveInvoiceData(true);

        // Switch to view mode for clean export
        const wasEditMode = this.isEditMode;
        if (this.isEditMode) {
            this.toggleMode();
        }

        // Add class to enforce print styles
        document.body.classList.add('generating-pdf');

        // Ensure pagination is correct and view is scrolled to top
        this.checkPagination();
        window.scrollTo(0, 0);

        // Small delay to ensure layout settles
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const { jsPDF } = window.jspdf;
            const html2canvas = window.html2canvas;

            if (!jsPDF || !html2canvas) {
                alert('PDF libraries not loaded. Please refresh the page and try again.');
                return;
            }

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = 297;

            // Get all page elements
            const pages = document.querySelectorAll('.page');

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];

                // Add new page to PDF if it's not the first one
                if (i > 0) {
                    pdf.addPage();
                }

                const canvas = await html2canvas(page, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#fff',
                    logging: false,
                    windowWidth: 794 // Force A4 width (210mm @ 96dpi)
                });

                const imgData = canvas.toDataURL('image/png');
                const imgWidth = pdfWidth;
                const imgHeight = (canvas.height * pdfWidth) / canvas.width;

                // Add image to current PDF page
                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            }

            // File name setup
            const invoiceNumber = document.getElementById('invoiceNumber')?.value || 'INV002';
            const today = new Date().toISOString().split('T')[0];
            const filename = `Invoice_${invoiceNumber}_${today}.pdf`;

            pdf.save(filename);

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF. Please try again.');
        } finally {
            document.body.classList.remove('generating-pdf');
            if (wasEditMode) {
                // Restore edit mode if it was active
                this.toggleMode();
            }
        }
    }

    setupPagination() {
        this.checkPagination();

        // Listen for window resize to recalculate pagination
        window.addEventListener('resize', () => {
            this.checkPagination();
        });
    }

    checkPagination() {
        const itemsTable = document.querySelector('.items-table tbody');
        const rows = itemsTable.querySelectorAll('tr');
        const itemsPerPage = this.calculateItemsPerPage();

        console.log(`Total rows: ${rows.length}, Items per page: ${itemsPerPage}`);

        if (rows.length > itemsPerPage) {
            this.createMultiplePages(rows, itemsPerPage);
        } else {
            this.ensureSinglePage();
        }
    }

    calculateItemsPerPage() {
        return 12; // Conservative estimate for A4 page to prevent cutting
    }

    createMultiplePages(rows, itemsPerPage) {
        const container = document.getElementById('invoiceContainer');
        const currentPage = document.getElementById('page1');

        // Remove any existing additional pages
        const existingPages = container.querySelectorAll('.page:not(#page1)');
        existingPages.forEach(page => page.remove());

        // Hide totals section on first page since we have multiple pages
        const firstPageTotals = currentPage.querySelector('.totals-section');
        const firstPageSignature = currentPage.querySelector('.signature-section');
        const firstPageRemark = currentPage.querySelector('#remarkSection');

        if (firstPageTotals) firstPageTotals.style.display = 'none';
        if (firstPageSignature) firstPageSignature.style.display = 'none';
        if (firstPageRemark) firstPageRemark.style.display = 'none';

        // Clear the original table body and add first page items
        const originalTableBody = currentPage.querySelector('.items-table tbody');
        originalTableBody.innerHTML = '';

        // Add first batch of rows to original page
        for (let i = 0; i < Math.min(itemsPerPage, rows.length); i++) {
            const rowClone = rows[i].cloneNode(true);
            originalTableBody.appendChild(rowClone);
        }

        // Create additional pages for remaining rows
        let currentRowIndex = itemsPerPage;
        let pageNumber = 2;

        while (currentRowIndex < rows.length) {
            const remainingRows = rows.length - currentRowIndex;
            const rowsForThisPage = Math.min(itemsPerPage, remainingRows);
            const isLastPage = (currentRowIndex + rowsForThisPage) >= rows.length;

            const newPage = this.createContinuationPage(pageNumber, isLastPage);
            const newTableBody = newPage.querySelector('.items-table tbody');

            // Add rows to this page
            for (let i = 0; i < rowsForThisPage; i++) {
                if (rows[currentRowIndex + i]) {
                    const rowClone = rows[currentRowIndex + i].cloneNode(true);
                    newTableBody.appendChild(rowClone);
                }
            }

            container.appendChild(newPage);
            currentRowIndex += rowsForThisPage;
            pageNumber++;
        }
    }

    // Admin / Data Methods
    async handleAdminFeatures() {
        const backBtnContainer = document.getElementById('adminControls');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const saveBtn = document.getElementById('saveBtn');

        // 1. Setup Admin Controls (Back Button)
        if (backBtnContainer) {
            // Only show if we have context (clientId or invoiceId)
            if (this.clientId || this.invoiceId) {
                backBtnContainer.style.display = 'block';
                const backBtn = document.getElementById('backToAdminBtn');
                if (backBtn) {
                    // Remove old listeners to be safe, or just add new one (assuming one-time init)
                    backBtn.onclick = async () => {
                        await this.saveInvoiceData(true); // Auto-save silent
                        window.location.href = 'admin.html';
                    };
                }
            }
        }

        // 2. Setup Save Button
        if (saveBtn && (this.clientId || this.invoiceId)) {
            saveBtn.style.display = 'inline-block';
            saveBtn.onclick = () => this.saveInvoiceData();
        }

        // 3. Load Data & Manage Overlay
        try {
            if (this.invoiceId) {
                await this.loadInvoiceData(this.invoiceId);
            } else if (this.clientId) {
                // New Invoice: Pre-fill client name
                if (this.clientNameParam) {
                    const clientNameInput = document.getElementById('clientName');
                    if (clientNameInput) {
                        clientNameInput.value = this.clientNameParam;
                        this.updateViewTexts();
                    }
                }
            }
        } catch (error) {
            console.error("Error loading invoice data:", error);
            alert("Failed to load invoice data. Please try again.");
        } finally {
            // 4. Hide Overlay irrespective of success or failure
            if (loadingOverlay) {
                // simple fade out
                loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 300);
            }
        }
    }

    getInvoiceData() {
        // Helpers
        const getVal = (id) => document.getElementById(id)?.value || '';
        const getNum = (id) => parseFloat(document.getElementById(id)?.value) || 0;

        // Scraping Items
        const items = [];
        document.querySelectorAll('.item-row').forEach(row => {
            items.push({
                description: row.querySelector('.item-description')?.value || '',
                rate: parseFloat(row.querySelector('.item-rate')?.value) || 0,
                qty: parseFloat(row.querySelector('.item-qty')?.value) || 0
            });
        });

        // Current Date for storage checks
        const invoiceDate = getVal('invoiceDate');

        return {
            firebaseId: this.invoiceId, // For updates
            clientId: this.clientId, // Link to client

            // Metadata
            invoiceNumber: getVal('invoiceNumber'),
            date: invoiceDate,
            dueDate: getVal('dueDate'),

            // Client
            clientName: getVal('clientName'),
            clientAddress: getVal('clientAddress'),
            clientContact: getVal('clientContact'),

            // Financials
            currency: this.currency,
            items: items,

            // Settings
            gstEnabled: this.gstEnabled,
            gstPercentage: this.gstPercentage,
            advanceEnabled: this.advanceEnabled,
            advancePercentage: this.advancePercentage,
            advanceBase: this.advanceBase,

            receivedAmount: getNum('receivedAmount'),
            totalAmount: this.calculateTotal(), // Rough calculation or sync with logic
            remark: getVal('remarkField'),

            createdAt: new Date().toISOString()
        };
    }

    async saveInvoiceData(silent = false) {
        if (!this.clientId && !this.invoiceId) {
            if (!silent) alert("Please access this invoice from the Admin Dashboard to save it properly.");
            return;
        }

        const data = this.getInvoiceData();
        console.log("Saving invoice data:", data); // Debug log

        if (!data.clientId && !this.invoiceId) {
            alert("Error: Missing Client ID. Cannot save new invoice without a client.");
            return;
        }

        const saveBtn = document.getElementById('saveBtn');

        if (saveBtn) saveBtn.textContent = 'Saving...';

        try {
            const id = await DataService.saveInvoice(data);
            this.invoiceId = id; // Update ID if it was new

            // Update URL without reload if it was new
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('invoiceId', id);
            window.history.pushState({}, '', newUrl);

            if (!silent) alert('Invoice Saved Successfully!');
            if (saveBtn) saveBtn.textContent = 'Save';
        } catch (e) {
            console.error(e);
            if (!silent) alert('Error saving invoice: ' + e.message);
            if (saveBtn) saveBtn.textContent = 'Save';
        }
    }

    async loadInvoiceData(id) {
        const data = await DataService.getInvoice(id);
        if (!data) {
            alert('Invoice not found: ' + id);
            return;
        }

        // Populate fields
        const setVal = (eid, val) => {
            const el = document.getElementById(eid);
            if (el) {
                el.value = val || '';
                el.dispatchEvent(new Event('input')); // Trigger listeners
                el.dispatchEvent(new Event('change'));
            }
        };

        this.clientId = data.clientId;
        this.currency = data.currency || 'INR';
        this.gstEnabled = data.gstEnabled || false;
        this.gstPercentage = data.gstPercentage || 18;
        this.advanceEnabled = data.advanceEnabled || false;
        this.advancePercentage = data.advancePercentage || 50;
        this.advanceBase = data.advanceBase || 'total';

        // Update Toggle Switchers
        const gstCheck = document.getElementById('gstEnabled');
        if (gstCheck) { gstCheck.checked = this.gstEnabled; this.toggleGST(this.gstEnabled); }

        const advCheck = document.getElementById('advanceEnabled');
        if (advCheck) { advCheck.checked = this.advanceEnabled; this.toggleAdvance(this.advanceEnabled); }

        if (this.duplicateMode) {
            console.log("Duplicating Invoice...");
            this.invoiceId = null; // Clear ID to ensure new creation

            // Adjust metadata for new invoice
            setVal('invoiceNumber', (data.invoiceNumber || '') + '-COPY');

            // Reset dates to today
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            setVal('invoiceDate', todayStr);
            setVal('dueDate', ''); // Clear due date or set to today

            // Reset payments? User requested to KEEP received amount.
            setVal('receivedAmount', data.receivedAmount);

            // Adjust title
            document.title = 'New Invoice (Copy)';

            // Clear URL param so refresh doesn't duplicate again (optional, but good UX is confusing if not handled)
            // But for now, we leave it or replace state
            const newUrl = new URL(window.location);
            newUrl.searchParams.delete('mode');
            newUrl.searchParams.delete('invoiceId');
            window.history.replaceState({}, '', newUrl);

        } else {
            // Normal Load
            setVal('invoiceNumber', data.invoiceNumber);
            setVal('invoiceDate', data.date);
            setVal('dueDate', data.dueDate);
            setVal('receivedAmount', data.receivedAmount);
        }

        setVal('clientName', data.clientName);
        setVal('clientAddress', data.clientAddress);
        setVal('clientContact', data.clientContact);
        setVal('remarkField', data.remark);
        // setVal('receivedAmount', data.receivedAmount); // Handled above

        // Currency
        const curSel = document.getElementById('currencySelect');
        if (curSel) { curSel.value = this.currency; this.handleCurrencyChange(this.currency); }

        // Items
        // Clear existing rows first
        const tbody = document.getElementById('itemsTableBody');
        tbody.innerHTML = '';
        this.itemCount = 0;

        if (data.items && data.items.length > 0) {
            data.items.forEach(item => {
                this.addItemRow();
                const rowId = this.itemCount - 1;
                const row = document.querySelector(`[data-row="${rowId}"]`);
                if (row) {
                    row.querySelector('.item-description').value = item.description;
                    row.querySelector('.item-rate').value = item.rate;
                    row.querySelector('.item-qty').value = item.qty;
                    this.updateRowCalculation(rowId);
                    this.updateRowView(rowId);
                }
            });
        } else {
            this.addItemRow();
        }

        this.updateCalculations();
        this.updateViewTexts();

        // If duplicating, force Edit Mode
        if (this.duplicateMode && !this.isEditMode) {
            this.toggleMode();
        }
    }

    createContinuationPage(pageNumber, isLastPage) {
        const newPage = document.createElement('div');
        newPage.className = 'page page-break continued-page';
        newPage.id = `page${pageNumber}`;

        // Get current invoice number for header
        const invoiceNumber = document.getElementById('invoiceNumber').value || 'INV002';

        let pageHTML = `
            <div class="page-header">
                <div class="company-name">BOEHM TECH LLP</div>
                <div>Invoice ${invoiceNumber} - Continued</div>
            </div>
            
            <div class="items-section">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>DESCRIPTION</th>
                            <th>RATE</th>
                            <th>QTY</th>
                            <th>AMOUNT</th>
                            <th class="edit-only">ACTION</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        `;

        // Only add totals, remark, and signature sections to the last page
        if (isLastPage) {
            pageHTML += this.getTotalsHTML();
        }

        newPage.innerHTML = pageHTML;
        return newPage;
    }

    async loadSeal() {
        try {
            const response = await fetch('seal.png');
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    this.sealDataUrl = reader.result;

                    // Update the static image element for single-page scenarios
                    const staticImg = document.getElementById('signatureImage');
                    if (staticImg) {
                        staticImg.src = this.sealDataUrl;
                    }

                    resolve();
                };
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Failed to load seal image:", e);
        }
    }

    getTotalsHTML() {
        const gstRowHTML = this.gstEnabled ? `
            <div class="totals-row gst-row">
                <label>GST AMOUNT (${this.gstPercentage}%):</label>
                <span>${document.getElementById('gstAmount')?.textContent || this.formatCurrency(0)}</span>
            </div>
        ` : '';

        const remarkValue = document.getElementById('remarkField')?.value || '';
        const remarkHTML = remarkValue ? `
            <div class="remark-section" style="margin-bottom: 20px;">
                <div class="field-group">
                    <label class="field-label">REMARK:</label>
                    <span class="view-text">${remarkValue}</span>
                </div>
            </div>
        ` : '';

        const sealSrc = this.sealDataUrl || 'seal.png';

        return `
            <div class="totals-section">
                <div class="totals-row">
                    <label>SUBTOTAL:</label>
                    <span>${document.getElementById('subtotalAmount')?.textContent || this.formatCurrency(0)}</span>
                </div>
                ${gstRowHTML}
                <div class="totals-row total-row">
                    <label>TOTAL:</label>
                    <span>${document.getElementById('totalAmount')?.textContent || this.formatCurrency(0)}</span>
                </div>
                <div class="totals-row">
                    <label>RECEIVED AMOUNT:</label>
                    <span>${document.getElementById('receivedAmountView')?.textContent || this.formatCurrency(0)}</span>
                </div>
                <div class="totals-row balance-due-row">
                    <label>BALANCE DUE:</label>
                    <span>${document.getElementById('finalBalanceDue')?.textContent || this.formatCurrency(0)}</span>
                </div>
            </div>
            
            ${remarkHTML}
            
            <div class="signature-section">
                <div class="signature-display">
                    <div class="signature-label">SEAL</div>
                    <div class="signature-area">
                        <img src="${sealSrc}" alt="Company Seal" style="max-height: 150px; max-width: 150px;">
                    </div>
                </div>
            </div>
        `;
    }

    ensureSinglePage() {
        const container = document.getElementById('invoiceContainer');
        const additionalPages = container.querySelectorAll('.page:not(#page1)');
        additionalPages.forEach(page => page.remove());

        // Show totals section on first page when there's only one page
        const currentPage = document.getElementById('page1');
        const firstPageTotals = currentPage.querySelector('.totals-section');
        const firstPageSignature = currentPage.querySelector('.signature-section');
        const firstPageRemark = currentPage.querySelector('#remarkSection');

        if (firstPageTotals) firstPageTotals.style.display = 'block';
        if (firstPageSignature) firstPageSignature.style.display = 'block';
        if (firstPageRemark) firstPageRemark.style.display = 'block';
    }

    // Data persistence methods
    saveData() {
        const data = {
            invoiceNumber: document.getElementById('invoiceNumber').value,
            invoiceDate: document.getElementById('invoiceDate').value,
            dueDate: document.getElementById('dueDate').value,
            clientName: document.getElementById('clientName').value,
            clientAddress: document.getElementById('clientAddress').value,
            clientContact: document.getElementById('clientContact').value,
            receivedAmount: document.getElementById('receivedAmount').value,
            remarkField: document.getElementById('remarkField')?.value || '',
            gstEnabled: this.gstEnabled,
            gstPercentage: this.gstPercentage,
            currency: this.currency,
            items: []
        };

        document.querySelectorAll('.item-row').forEach(row => {
            data.items.push({
                description: row.querySelector('.item-description').value,
                rate: row.querySelector('.item-rate').value,
                qty: row.querySelector('.item-qty').value
            });
        });

        return data;
    }

    loadData(data) {
        if (!data) return;

        // Load basic fields
        if (data.invoiceNumber) document.getElementById('invoiceNumber').value = data.invoiceNumber;
        if (data.invoiceDate) document.getElementById('invoiceDate').value = data.invoiceDate;
        if (data.dueDate) document.getElementById('dueDate').value = data.dueDate;
        if (data.clientName) document.getElementById('clientName').value = data.clientName;
        if (data.clientAddress) document.getElementById('clientAddress').value = data.clientAddress;
        if (data.clientContact) document.getElementById('clientContact').value = data.clientContact;
        if (data.receivedAmount) document.getElementById('receivedAmount').value = data.receivedAmount;
        if (data.remarkField) document.getElementById('remarkField').value = data.remarkField;

        // Load GST settings
        if (data.gstEnabled !== undefined) {
            document.getElementById('gstEnabled').checked = data.gstEnabled;
            this.toggleGST(data.gstEnabled);
        }
        if (data.gstPercentage !== undefined) {
            document.getElementById('gstPercentage').value = data.gstPercentage;
            this.gstPercentage = data.gstPercentage;
        }

        // Load currency settings
        if (data.currency !== undefined) {
            this.currency = data.currency;
            const currencySelect = document.getElementById('currencySelect');
            if (currencySelect) {
                currencySelect.value = this.currency;
            }
            this.updateCurrencyDisplay();
        }

        // Load items
        if (data.items && data.items.length > 0) {
            // Clear existing rows
            const tbody = document.getElementById('itemsTableBody');
            tbody.innerHTML = '';
            this.itemCount = 0;

            // Add rows from data
            data.items.forEach((item, index) => {
                if (index === 0) {
                    // Use existing first row
                    const row = this.createFirstRow();
                    tbody.appendChild(row);
                } else {
                    this.addItemRow();
                }

                const currentRow = tbody.children[index];
                currentRow.querySelector('.item-description').value = item.description || '';
                currentRow.querySelector('.item-rate').value = item.rate || '';
                currentRow.querySelector('.item-qty').value = item.qty || '1';

                this.updateRowCalculation(index);
            });
        }

        this.updateViewTexts();
        this.updateCalculations();
    }

    createFirstRow() {
        const row = document.createElement('tr');
        row.className = 'item-row';
        row.setAttribute('data-row', '0');

        row.innerHTML = `
            <td>
                <input type="text" class="item-description edit-field" placeholder="Enter description" readonly>
                <span class="view-text item-description-view">-</span>
            </td>
            <td>
                <input type="number" class="item-rate edit-field" step="0.01" min="0" placeholder="0.00" readonly>
                <span class="view-text item-rate-view">${this.formatCurrency(0)}</span>
            </td>
            <td>
                <input type="number" class="item-qty edit-field" min="1" value="1" readonly>
                <span class="view-text item-qty-view">1</span>
            </td>
            <td class="item-amount">${this.formatCurrency(0)}</td>
            <td class="edit-only">
                <button class="remove-row-btn" onclick="invoiceApp.removeRow(0)">×</button>
            </td>
        `;

        this.attachRowListeners(0);
        this.itemCount = 1;
        return row;
    }
}

// Initialize the application
let invoiceApp;

document.addEventListener('DOMContentLoaded', () => {
    invoiceApp = new InvoiceApp();
    window.invoiceApp = invoiceApp; // Explicit global

    // Make removeRow globally accessible for inline onclick handlers
    window.removeRow = (index) => invoiceApp.removeRow(index);
});

// Add beforeunload event to warn about unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (invoiceApp && invoiceApp.isEditMode) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
});


// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (!invoiceApp) return;

    // Ctrl+P for print
    if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        invoiceApp.printInvoice();
    }

    // Ctrl+E for edit mode toggle
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        invoiceApp.toggleMode();
    }

    // Ctrl+Enter to add new row (in edit mode)
    if (e.ctrlKey && e.key === 'Enter' && invoiceApp.isEditMode) {
        e.preventDefault();
        invoiceApp.addItemRow();
    }
});

// Export functionality for potential future use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InvoiceApp;
}
