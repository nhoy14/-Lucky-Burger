// Configuration
const API_BASE = 'http://127.0.0.1:5000';

// State
let items = [];
let historyLogs = [];

// DOM Elements
const itemForm = document.getElementById('item-form');
const formItemId = document.getElementById('form-item-id');
const itemNameInput = document.getElementById('item-name');
const itemUnitInput = document.getElementById('item-unit');
const btnSaveItem = document.getElementById('btn-save-item');
const formSubmitText = document.getElementById('form-submit-text');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const itemsListContainer = document.getElementById('items-list-container');
const historyTableBody = document.getElementById('history-table-body');
const toastElement = document.getElementById('toast');
const toastMessageElement = document.getElementById('toast-message');
const btnToggleForm = document.getElementById('btn-toggle-form');
const formContainer = document.getElementById('collapsible-form-container');
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

// Collapsible Form Management
function toggleForm() {
  const isOpen = formContainer.classList.contains('open');
  if (isOpen) {
    closeForm();
  } else {
    openForm();
  }
}

function openForm() {
  formContainer.classList.add('open');
  const icon = document.getElementById('toggle-form-icon');
  updateIcon(icon, 'x');
}

function closeForm() {
  formContainer.classList.remove('open');
  const icon = document.getElementById('toggle-form-icon');
  updateIcon(icon, 'plus');
  resetItemForm();
}

// Fetch and Render Items
async function fetchItems() {
  try {
    const response = await fetch(`${API_BASE}/api/items`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load items');
    items = await response.json();
    renderItemsList();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderItemsList() {
  itemsListContainer.innerHTML = '';
  
  if (items.length === 0) {
    itemsListContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍔</div>
        <p>No items found. Click the + button above to add your first item!</p>
      </div>`;
    return;
  }

  items.forEach((item, index) => {
    const itemRow = document.createElement('div');
    itemRow.className = 'item-row';
    
    // Check toggle switch state (default to true if active is not explicitly false)
    const isActive = item.active !== false;
    const checkedAttribute = isActive ? 'checked' : '';

    itemRow.innerHTML = `
      <div class="item-info">
        <span class="item-index">${index + 1}</span>
        <span class="item-name">${item.name} <span class="chip">${item.unit}</span></span>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        <button type="button" class="icon-btn edit-btn" data-id="${item.id}" title="Edit Item">
          <i data-lucide="edit-3"></i>
        </button>
        <button type="button" class="icon-btn delete delete-btn" data-id="${item.id}" title="Delete Item">
          <i data-lucide="trash-2"></i>
        </button>
        <label class="switch" title="Toggle Visibility">
          <input type="checkbox" class="toggle-active-btn" data-id="${item.id}" ${checkedAttribute}>
          <span class="slider"></span>
        </label>
      </div>
    `;
    itemsListContainer.appendChild(itemRow);
  });

  // Attach button event listeners
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openForm();
      editItem(parseInt(btn.getAttribute('data-id')));
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteItem(parseInt(btn.getAttribute('data-id'))));
  });

  document.querySelectorAll('.toggle-active-btn').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const id = parseInt(checkbox.getAttribute('data-id'));
      const activeState = checkbox.checked;
      toggleItemActive(id, activeState);
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

async function toggleItemActive(id, active) {
  try {
    const response = await fetch(`${API_BASE}/api/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active })
    });
    if (!response.ok) throw new Error('Failed to update status');
    
    // Update local state
    const item = items.find(i => i.id === id);
    if (item) item.active = active;
    
    showToast(`Status updated successfully!`);
  } catch (error) {
    showToast(error.message, 'error');
    // Re-render to revert toggle state
    renderItemsList();
  }
}

// Item CRUD Actions
async function handleItemFormSubmit(e) {
  e.preventDefault();
  
  const id = formItemId.value;
  const name = itemNameInput.value.trim();
  const unit = itemUnitInput.value.trim();

  if (!name || !unit) {
    showToast('Name and Unit are required', 'error');
    return;
  }

  const payload = { name, unit };
  const isEditing = id !== "";

  try {
    let url = `${API_BASE}/api/items`;
    let method = 'POST';

    if (isEditing) {
      url = `${API_BASE}/api/items/${id}`;
      method = 'PUT';
    }

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(isEditing ? 'Failed to update item' : 'Failed to create item');

    showToast(isEditing ? 'Item updated successfully!' : 'Item created successfully!');
    closeForm();
    fetchItems();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function editItem(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  formItemId.value = item.id;
  itemNameInput.value = item.name;
  itemUnitInput.value = item.unit;
  
  formSubmitText.textContent = "Update Item";
  btnCancelEdit.style.display = "inline-flex";
  
  // Icon update for submit button
  const icon = btnSaveItem.querySelector('i, svg');
  updateIcon(icon, 'check');
  
  itemNameInput.focus();
}

function resetItemForm() {
  formItemId.value = "";
  itemNameInput.value = "";
  itemUnitInput.value = "kg";
  
  formSubmitText.textContent = "Add Item";
  btnCancelEdit.style.display = "none";
  
  const icon = btnSaveItem.querySelector('i, svg');
  updateIcon(icon, 'plus-circle');
}

async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item? It will remove it from the tracking template.')) return;

  try {
    const response = await fetch(`${API_BASE}/api/items/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete item');

    showToast('Item deleted successfully');
    fetchItems();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Fetch and Render History Logs
async function fetchHistory() {
  try {
    const response = await fetch(`${API_BASE}/api/history`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Failed to load history logs');
    historyLogs = await response.json();
    renderHistoryTable();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Helper to format date into user style: DD/ MM/ YY
function formatReportDate(dateString) {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const year = parts[0].substring(2);
  const month = parts[1];
  const day = parts[2];
  return `${day}/ ${month}/ ${year}`;
}

function renderHistoryTable() {
  historyTableBody.innerHTML = '';

  if (historyLogs.length === 0) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center" style="color: var(--text-muted); padding: 30px;">
          No reports logged in database history.
        </td>
      </tr>`;
    return;
  }

  historyLogs.forEach((log) => {
    const tr = document.createElement('tr');
    
    // Format individual logged items as chips
    const itemsMarkup = log.items.map(item => 
      `<span class="chip chip-primary">${item.name} (${item.weight.toFixed(3)} ${item.unit})</span>`
    ).join(' ');

    const formattedDate = formatReportDate(log.date);

    tr.innerHTML = `
      <td><span class="bold">#${log.id}</span></td>
      <td><span class="bold text-muted">${formattedDate}</span></td>
      <td><span class="chip" style="font-weight:600;">${log.branch}</span></td>
      <td><div class="logged-items-list">${itemsMarkup}</div></td>
      <td style="text-align: right;" class="bold primary-color">${log.total_weight.toFixed(3)} kg</td>
      <td style="text-align: right;">
        <button type="button" class="icon-btn copy-log-btn" data-id="${log.id}" title="Copy Formatted Text">
          <i data-lucide="copy"></i>
        </button>
        <button type="button" class="icon-btn delete delete-log-btn" data-id="${log.id}" title="Delete Record">
          <i data-lucide="trash-2"></i>
        </button>
      </td>
    `;
    historyTableBody.appendChild(tr);
  });

  // Attach events
  document.querySelectorAll('.copy-log-btn').forEach(btn => {
    btn.addEventListener('click', () => copyFormattedHistory(parseInt(btn.getAttribute('data-id'))));
  });

  document.querySelectorAll('.delete-log-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteHistoryRecord(parseInt(btn.getAttribute('data-id'))));
  });

  if (window.lucide) window.lucide.createIcons();
}

// Actions on history logs
async function deleteHistoryRecord(id) {
  if (!confirm('Are you sure you want to delete this historical record? This cannot be undone.')) return;

  try {
    const response = await fetch(`${API_BASE}/api/history/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete history record');

    showToast('Record deleted successfully');
    fetchHistory();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function copyFormattedHistory(id) {
  const log = historyLogs.find(l => l.id === id);
  if (!log) return;

  const formattedDate = formatReportDate(log.date);
  let reportItemsText = '';
  
  log.items.forEach((item, index) => {
    reportItemsText += `${index + 1}. ${item.name} : ${item.weight.toFixed(3)} ${item.unit} \n`;
  });

  let formattedReport = `Dear manager \n`;
  formattedReport += `Here is the picture of defective item for ${log.branch} on ${formattedDate}\n\n`;
  formattedReport += reportItemsText;
  formattedReport += `\nTotal  ${log.items.length} cord . Thank !`;

  try {
    await navigator.clipboard.writeText(formattedReport);
    showToast('Formatted report copied to clipboard!');
  } catch (err) {
    showToast('Failed to copy text', 'error');
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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  fetchItems();
  fetchHistory();
  initMobileMenu();

  itemForm.addEventListener('submit', handleItemFormSubmit);
  btnCancelEdit.addEventListener('click', closeForm);
  if (btnToggleForm) {
    btnToggleForm.addEventListener('click', toggleForm);
  }
});
