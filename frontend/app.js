// Configuration
const API_BASE = window.location.hostname.endsWith('.vercel.app')
  ? 'https://lucky-burger-r9nh.onrender.com'
  : (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://127.0.0.1:5000'
      : '');

// State variables
let items = [];
const weights = {}; // Store input weights by item ID

// DOM Elements
const inputsContainer = document.getElementById('inputs-container');
const branchSelect = document.getElementById('branch-select');
const dateSelect = document.getElementById('date-select');
const totalRecordsDisplay = document.getElementById('total-records-display');
const totalWeightDisplay = document.getElementById('total-weight-display');
const reportOutput = document.getElementById('report-output');
const btnClear = document.getElementById('btn-clear');
const btnCopyReport = document.getElementById('btn-copy-report');
const btnSaveLog = document.getElementById('btn-save-log');
const toastElement = document.getElementById('toast');
const toastMessageElement = document.getElementById('toast-message');

// Helper to update Lucide icons dynamically without breaking after conversion to SVG
function updateIcon(targetElement, newIconName) {
  if (!targetElement) return;
  const newIcon = document.createElement('i');
  if (targetElement.id) newIcon.id = targetElement.id;
  if (targetElement.className) newIcon.className = targetElement.className;
  newIcon.setAttribute('data-lucide', newIconName);
  targetElement.parentNode.replaceChild(newIcon, targetElement);
  if (window.lucide) window.lucide.createIcons();
}

// Set default date to local today
function setDefaultDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  dateSelect.value = `${year}-${month}-${day}`;
}

// Format date into specific user format: DD/ MM/ YY (e.g. 31/ 05/ 26)
function formatReportDate(dateString) {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const year = parts[0].substring(2); // Last 2 digits
  const month = parts[1];
  const day = parts[2];
  return `${day}/ ${month}/ ${year}`;
}

// Fetch items from backend API
async function fetchItems() {
  try {
    const response = await fetch(`${API_BASE}/api/items`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load items');
    items = await response.json();
    renderInputs();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Render inputs dynamically
function renderInputs() {
  inputsContainer.innerHTML = '';
  
  const activeItems = items.filter(item => item.active !== false);
  
  if (activeItems.length === 0) {
    inputsContainer.innerHTML = `
      <div class="text-center" style="padding: 20px; color: var(--text-muted);">
        No active tracking items. Go to Admin Panel to configure items.
      </div>`;
    return;
  }

  activeItems.forEach((item, idx) => {
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    
    // Default/saved weight
    const currentVal = weights[item.id] !== undefined ? weights[item.id] : '';

    itemRow.innerHTML = `
      <div class="item-info">
        <span class="item-index">${idx + 1}</span>
        <span class="item-name">${item.name}</span>
      </div>
      <div class="stepper-container">
        <button type="button" class="stepper-btn minus" data-id="${item.id}">-</button>
        <input type="number" step="0.001" min="0" 
               class="stepper-input" 
               id="input-item-${item.id}" 
               data-id="${item.id}" 
               data-name="${item.name}" 
               data-unit="${item.unit}" 
               value="${currentVal}" 
               placeholder="0.000">
        <span class="stepper-unit">${item.unit}</span>
        <button type="button" class="stepper-btn plus" data-id="${item.id}">+</button>
      </div>
    `;
    inputsContainer.appendChild(itemRow);
  });

  // Attach event listeners to input elements
  document.querySelectorAll('.stepper-input').forEach(input => {
    input.addEventListener('input', handleInputChange);
  });

  // Stepper buttons listeners
  document.querySelectorAll('.stepper-btn.minus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const input = document.getElementById(`input-item-${id}`);
      let val = parseFloat(input.value) || 0;
      val = Math.max(0, val - 0.05); // Decrease by 50g
      input.value = val > 0 ? val.toFixed(3) : '';
      weights[id] = val > 0 ? parseFloat(val.toFixed(3)) : undefined;
      updateSummary();
    });
  });

  document.querySelectorAll('.stepper-btn.plus').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const input = document.getElementById(`input-item-${id}`);
      let val = parseFloat(input.value) || 0;
      val = val + 0.05; // Increase by 50g
      input.value = val.toFixed(3);
      weights[id] = parseFloat(val.toFixed(3));
      updateSummary();
    });
  });

  updateSummary();
}

// Handle value typing
function handleInputChange(e) {
  const id = e.target.getAttribute('data-id');
  const val = parseFloat(e.target.value);
  
  if (isNaN(val) || val <= 0) {
    delete weights[id];
  } else {
    weights[id] = val;
  }
  updateSummary();
}

// Compute statistics and live report formatting
function updateSummary() {
  let activeRecordsCount = 0;
  let totalWeight = 0;
  let reportItemsText = '';

  const activeItems = items.filter(item => item.active !== false);
  activeItems.forEach((item) => {
    const val = weights[item.id];
    if (val !== undefined && val > 0) {
      activeRecordsCount++;
      totalWeight += val;
      reportItemsText += `${activeRecordsCount}. ${item.name} : ${val.toFixed(3)} ${item.unit} \n`;
    }
  });

  // Update DOM displays
  totalRecordsDisplay.textContent = activeRecordsCount;
  totalWeightDisplay.textContent = `${totalWeight.toFixed(3)} kg`;

  // Generate formatting template matching user exact structure
  const branch = (branchSelect.value || 'LBCHM').toUpperCase();
  const reportDate = formatReportDate(dateSelect.value);

  let formattedReport = `Dear manager \n`;
  formattedReport += `Here is the picture of defective item for ${branch} on ${reportDate}\n\n`;
  
  if (activeRecordsCount > 0) {
    formattedReport += reportItemsText;
  } else {
    formattedReport += `[No defective items logged]\n`;
  }
  
  formattedReport += `\nTotal  ${activeRecordsCount} cord . Thank !`;

  // Render to UI code container
  reportOutput.textContent = formattedReport;
  
  // Re-run icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Clear all inputs
function clearForm() {
  items.forEach(item => {
    delete weights[item.id];
    const input = document.getElementById(`input-item-${item.id}`);
    if (input) input.value = '';
  });
  updateSummary();
  const previewPanel = document.getElementById('preview-panel');
  if (previewPanel) previewPanel.style.display = 'none';
  showToast('Form cleared');
}

// Copy output report to clipboard
async function copyReportText() {
  const textToCopy = reportOutput.textContent;
  try {
    await navigator.clipboard.writeText(textToCopy);
    showToast('Report copied to clipboard!');
  } catch (err) {
    showToast('Failed to copy text', 'error');
  }
}

// Save logged report to history database
async function saveReportToHistory() {
  const branch = (branchSelect.value || 'LBCHM').toUpperCase();
  const dateVal = dateSelect.value;
  
  const loggedItems = [];
  let totalW = 0;

  const activeItems = items.filter(item => item.active !== false);
  activeItems.forEach(item => {
    const val = weights[item.id];
    if (val !== undefined && val > 0) {
      loggedItems.push({
        item_id: item.id,
        name: item.name,
        weight: val,
        unit: item.unit
      });
      totalW += val;
    }
  });

  if (loggedItems.length === 0) {
    showToast('Cannot save empty report!', 'error');
    return;
  }

  const payload = {
    branch: branch,
    date: dateVal,
    items: loggedItems,
    total_weight: totalW
  };

  try {
    const response = await fetch(`${API_BASE}/api/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Time': new Date().toISOString()
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to save to database history');

    showToast('Report successfully logged to database!');
    clearForm();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Show standard beautiful toast notifications
function showToast(message, type = 'success') {
  toastMessageElement.textContent = message;
  toastElement.className = `toast show ${type}`;
  
  const icon = toastElement.querySelector('i, svg');
  updateIcon(icon, type === 'error' ? 'alert-circle' : 'check-circle-2');
  
  if (type === 'error') {
    toastElement.style.background = '#ef4444';
    toastElement.style.color = '#ffffff';
  } else {
    toastElement.style.background = '#10b981';
    toastElement.style.color = '#000000';
  }

  setTimeout(() => {
    toastElement.classList.remove('show');
  }, 3000);
}

// Setup mobile hamburger navigation menu
function initMobileMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const navMenu = document.getElementById('nav-menu');
  const backdrop = document.getElementById('menu-backdrop');

  if (menuToggle && navMenu) {
    const toggleMenu = (open) => {
      const isOpen = open !== undefined ? open : !navMenu.classList.contains('open');
      
      if (isOpen) {
        navMenu.classList.add('open');
        if (backdrop) backdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
      } else {
        navMenu.classList.remove('open');
        if (backdrop) backdrop.classList.remove('show');
        document.body.style.overflow = '';
      }

      const icon = menuToggle.querySelector('i, svg');
      updateIcon(icon, isOpen ? 'x' : 'menu');
    };

    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        toggleMenu(false);
      });
    }

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('open') && !navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        toggleMenu(false);
      }
    });
  }
}

// Wire everything up on load
document.addEventListener('DOMContentLoaded', () => {
  setDefaultDate();
  fetchItems();
  initMobileMenu();
  
  // Add listeners
  branchSelect.addEventListener('input', updateSummary);
  dateSelect.addEventListener('change', updateSummary);
  btnClear.addEventListener('click', clearForm);
  btnCopyReport.addEventListener('click', copyReportText);
  btnSaveLog.addEventListener('click', saveReportToHistory);

  const btnShowPreview = document.getElementById('btn-show-preview');
  if (btnShowPreview) {
    btnShowPreview.addEventListener('click', () => {
      const previewSection = document.getElementById('preview-panel');
      if (previewSection) {
        previewSection.style.display = 'flex';
        // Tiny timeout to let browser calculate layouts before scrolling
        setTimeout(() => {
          previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Highlight preview panel border briefly
          previewSection.style.borderColor = 'var(--primary)';
          setTimeout(() => {
            previewSection.style.borderColor = 'var(--card-border)';
          }, 1200);
        }, 50);
      }
    });
  }

  const btnSetToday = document.getElementById('btn-set-today');
  if (btnSetToday) {
    btnSetToday.addEventListener('click', () => {
      setDefaultDate();
      updateSummary();
      showToast('Date set to today!');
    });
  }
});
