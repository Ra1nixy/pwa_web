// ===== DATABASE INITIALIZATION =====
let db;
const DB_NAME = "StoreDB";
const DB_VERSION = 2;
const STORE_ITEMS = "items";
const STORE_TRANSACTIONS = "transactions";

// Open or create IndexedDB
const request = indexedDB.open(DB_NAME, DB_VERSION);

request.onupgradeneeded = (event) => {
  db = event.target.result;
  
  // Create items store if it doesn't exist
  if (!db.objectStoreNames.contains(STORE_ITEMS)) {
    const itemsStore = db.createObjectStore(STORE_ITEMS, { keyPath: "id", autoIncrement: true });
    itemsStore.createIndex("name", "name", { unique: false });
    itemsStore.createIndex("category", "category", { unique: false });
  }
  
  // Create transactions store if it doesn't exist
  if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
    const transactionsStore = db.createObjectStore(STORE_TRANSACTIONS, { keyPath: "id", autoIncrement: true });
    transactionsStore.createIndex("date", "date", { unique: false });
  }
};

request.onsuccess = (event) => {
  db = event.target.result;
  loadItems();
  loadProductsForCashier();
  loadReports();
};

request.onerror = (event) => {
  console.error("Database error:", event.target.error);
};

// ===== DOM ELEMENTS =====
const sections = {
  inventory: document.getElementById("inventory-section"),
  cashier: document.getElementById("cashier-section"),
  reports: document.getElementById("reports-section")
};

const navItems = document.querySelectorAll(".nav-menu li");
const sectionTitle = document.getElementById("section-title");

// Inventory elements
const itemList = document.getElementById("itemList");
const itemForm = document.getElementById("itemForm");
const itemModal = document.getElementById("itemModal");
const modalTitle = document.getElementById("modalTitle");
const addBtn = document.getElementById("addBtn");
const cancelBtn = document.getElementById("cancelBtn");
const searchItem = document.getElementById("searchItem");

// Cashier elements
const productGrid = document.getElementById("productGrid");
const cartItems = document.getElementById("cartItems");
const totalItems = document.getElementById("totalItems");
const totalPrice = document.getElementById("totalPrice");
const checkoutAmount = document.getElementById("checkoutAmount");
const clearCart = document.getElementById("clearCart");
const checkout = document.getElementById("checkout");
const searchProduct = document.getElementById("searchProduct");

// Payment modal elements
const paymentModal = document.getElementById("paymentModal");
const paymentTotal = document.getElementById("paymentTotal");
const amountPaid = document.getElementById("amountPaid");
const changeAmount = document.getElementById("changeAmount");
const cashAmount = document.getElementById("cashAmount");
const cancelPayment = document.getElementById("cancelPayment");
const confirmPayment = document.getElementById("confirmPayment");

// Reports elements
const totalProducts = document.getElementById("totalProducts");
const todayTransactions = document.getElementById("todayTransactions");
const todayRevenue = document.getElementById("todayRevenue");
const transactionsTable = document.getElementById("transactionsTable").getElementsByTagName('tbody')[0];

// ===== GLOBAL VARIABLES =====
let currentCart = [];
let editingItemId = null;

// ===== EVENT LISTENERS =====
// Navigation
navItems.forEach(item => {
  item.addEventListener("click", () => {
    const section = item.getAttribute("data-section");
    switchSection(section);
    
    // Update active state
    navItems.forEach(nav => nav.classList.remove("active"));
    item.classList.add("active");
  });
});

// Inventory
addBtn.addEventListener("click", () => openItemModal());
cancelBtn.addEventListener("click", () => closeModal(itemModal));
itemForm.addEventListener("submit", (e) => {
  e.preventDefault();
  saveItem();
});
searchItem.addEventListener("input", () => filterItems());

// Cashier
clearCart.addEventListener("click", () => clearShoppingCart());
checkout.addEventListener("click", () => openPaymentModal());
searchProduct.addEventListener("input", () => filterProducts());
cancelPayment.addEventListener("click", () => closeModal(paymentModal));
confirmPayment.addEventListener("click", () => processPayment());

// Payment amount calculation
cashAmount.addEventListener("input", () => calculateChange());

// Close modals when clicking outside
document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal(modal);
    }
  });
});

// Close buttons
document.querySelectorAll(".close-modal").forEach(btn => {
  btn.addEventListener("click", () => {
    const modal = btn.closest(".modal");
    closeModal(modal);
  });
});

// ===== CORE FUNCTIONS =====
function switchSection(section) {
  // Hide all sections
  Object.values(sections).forEach(sec => {
    sec.classList.remove("active");
  });
  
  // Show selected section
  sections[section].classList.add("active");
  
  // Update title
  const titleMap = {
    inventory: "Manajemen Barang",
    cashier: "Kasir",
    reports: "Laporan"
  };
  sectionTitle.textContent = titleMap[section];
}

// ===== INVENTORY FUNCTIONS =====
function openItemModal(item = null) {
  if (item) {
    modalTitle.textContent = "Edit Barang";
    document.getElementById("itemId").value = item.id;
    document.getElementById("itemName").value = item.name;
    document.getElementById("itemQty").value = item.quantity;
    document.getElementById("itemPrice").value = item.price;
    document.getElementById("itemCategory").value = item.category || "general";
    editingItemId = item.id;
  } else {
    modalTitle.textContent = "Tambah Barang";
    itemForm.reset();
    editingItemId = null;
  }
  openModal(itemModal);
}

function loadItems() {
  const transaction = db.transaction(STORE_ITEMS, "readonly");
  const store = transaction.objectStore(STORE_ITEMS);
  const request = store.getAll();

  request.onsuccess = () => {
    const items = request.result;
    renderItems(items);
  };
}

function renderItems(items) {
  itemList.innerHTML = "";
  
  if (items.length === 0) {
    itemList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>Tidak ada barang tersedia</p>
      </div>
    `;
    return;
  }
  
  items.forEach(item => {
    const itemCard = document.createElement("div");
    itemCard.className = "item-card";
    itemCard.innerHTML = `
      <div class="item-info">
        <h3>${item.name}</h3>
        <p><i class="fas fa-boxes"></i> Stok: ${item.quantity} | <i class="fas fa-tag"></i> ${item.category}</p>
        <p><i class="fas fa-money-bill-wave"></i> Rp${item.price.toLocaleString()}</p>
      </div>
      <div class="item-actions">
        <button onclick="editItem(${item.id})" class="btn btn-secondary btn-sm"><i class="fas fa-edit"></i></button>
        <button onclick="deleteItem(${item.id})" class="btn btn-danger btn-sm"><i class="fas fa-trash"></i></button>
      </div>
    `;
    itemList.appendChild(itemCard);
  });
}

function saveItem() {
  const id = document.getElementById("itemId").value;
  const name = document.getElementById("itemName").value.trim();
  const quantity = parseInt(document.getElementById("itemQty").value);
  const price = parseInt(document.getElementById("itemPrice").value);
  const category = document.getElementById("itemCategory").value;

  if (!name || isNaN(quantity) || isNaN(price)) {
    alert("Harap isi semua field dengan benar!");
    return;
  }

  const item = { name, quantity, price, category };

  const transaction = db.transaction(STORE_ITEMS, "readwrite");
  const store = transaction.objectStore(STORE_ITEMS);

  if (id) {
    item.id = parseInt(id);
    const request = store.put(item);
    request.onsuccess = () => {
      closeModal(itemModal);
      loadItems();
      loadProductsForCashier(); // Refresh cashier products
    };
  } else {
    const request = store.add(item);
    request.onsuccess = () => {
      closeModal(itemModal);
      loadItems();
      loadProductsForCashier(); // Refresh cashier products
    };
  }
}

function editItem(id) {
  const transaction = db.transaction(STORE_ITEMS, "readonly");
  const store = transaction.objectStore(STORE_ITEMS);
  const request = store.get(id);

  request.onsuccess = () => {
    openItemModal(request.result);
  };
}

function deleteItem(id) {
  if (confirm("Apakah Anda yakin ingin menghapus barang ini?")) {
    const transaction = db.transaction(STORE_ITEMS, "readwrite");
    const store = transaction.objectStore(STORE_ITEMS);
    store.delete(id);
    transaction.oncomplete = () => {
      loadItems();
      loadProductsForCashier(); // Refresh cashier products
    };
  }
}

function filterItems() {
  const searchTerm = searchItem.value.toLowerCase();
  const transaction = db.transaction(STORE_ITEMS, "readonly");
  const store = transaction.objectStore(STORE_ITEMS);
  const request = store.getAll();

  request.onsuccess = () => {
    const items = request.result.filter(item => 
      item.name.toLowerCase().includes(searchTerm) ||
      item.category.toLowerCase().includes(searchTerm)
    );
    renderItems(items);
  };
}

// ===== CASHIER FUNCTIONS =====
function loadProductsForCashier() {
  const transaction = db.transaction(STORE_ITEMS, "readonly");
  const store = transaction.objectStore(STORE_ITEMS);
  const request = store.getAll();

  request.onsuccess = () => {
    const products = request.result.filter(item => item.quantity > 0);
    renderProducts(products);
  };
}

function renderProducts(products) {
  productGrid.innerHTML = "";
  
  if (products.length === 0) {
    productGrid.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-box-open"></i>
        <p>Tidak ada produk tersedia</p>
      </div>
    `;
    return;
  }
  
  products.forEach(product => {
    const productCard = document.createElement("div");
    productCard.className = "product-card";
    productCard.innerHTML = `
      <div class="product-icon">
        <i class="fas fa-${getProductIcon(product.category)}"></i>
      </div>
      <h4>${product.name}</h4>
      <p>Rp${product.price.toLocaleString()}</p>
      <small>Stok: ${product.quantity}</small>
    `;
    productCard.addEventListener("click", () => addToCart(product));
    productGrid.appendChild(productCard);
  });
}

function getProductIcon(category) {
  const icons = {
    food: "hamburger",
    drink: "wine-bottle",
    electronics: "mobile-alt",
    default: "box"
  };
  return icons[category] || icons.default;
}

function addToCart(product) {
  // Check if product already in cart
  const existingItem = currentCart.find(item => item.id === product.id);
  
  if (existingItem) {
    // Check if enough stock
    if (existingItem.quantity >= product.quantity) {
      alert("Stok tidak mencukupi!");
      return;
    }
    existingItem.quantity++;
  } else {
    // Add new item to cart
    currentCart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      maxQuantity: product.quantity
    });
  }
  
  updateCartDisplay();
}

function updateCartDisplay() {
  cartItems.innerHTML = "";
  
  if (currentCart.length === 0) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <i class="fas fa-cart-arrow-down"></i>
        <p>Keranjang kosong</p>
      </div>
    `;
  } else {
    currentCart.forEach(item => {
      const cartItem = document.createElement("div");
      cartItem.className = "cart-item";
      cartItem.innerHTML = `
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <p>Rp${item.price.toLocaleString()} × ${item.quantity} = Rp${(item.price * item.quantity).toLocaleString()}</p>
        </div>
        <div class="cart-item-actions">
          <button onclick="decreaseQuantity(${item.id})"><i class="fas fa-minus"></i></button>
          <input type="number" value="${item.quantity}" min="1" max="${item.maxQuantity}" 
                 onchange="updateQuantity(${item.id}, this.value)">
          <button onclick="increaseQuantity(${item.id})"><i class="fas fa-plus"></i></button>
          <button onclick="removeFromCart(${item.id})"><i class="fas fa-times"></i></button>
        </div>
      `;
      cartItems.appendChild(cartItem);
    });
  }
  
  // Update summary
  const total = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = currentCart.reduce((count, item) => count + item.quantity, 0);
  
  totalItems.textContent = itemCount;
  totalPrice.textContent = total.toLocaleString();
  checkoutAmount.textContent = total.toLocaleString();
}

function increaseQuantity(productId) {
  const item = currentCart.find(item => item.id === productId);
  if (item.quantity < item.maxQuantity) {
    item.quantity++;
    updateCartDisplay();
  } else {
    alert("Stok tidak mencukupi!");
  }
}

function decreaseQuantity(productId) {
  const item = currentCart.find(item => item.id === productId);
  if (item.quantity > 1) {
    item.quantity--;
    updateCartDisplay();
  } else {
    removeFromCart(productId);
  }
}

function updateQuantity(productId, newQuantity) {
  const item = currentCart.find(item => item.id === productId);
  newQuantity = parseInt(newQuantity);
  
  if (isNaN(newQuantity)) return;
  
  if (newQuantity < 1) {
    removeFromCart(productId);
  } else if (newQuantity > item.maxQuantity) {
    alert("Stok tidak mencukupi!");
    item.quantity = item.maxQuantity;
    updateCartDisplay();
  } else {
    item.quantity = newQuantity;
    updateCartDisplay();
  }
}

function removeFromCart(productId) {
  currentCart = currentCart.filter(item => item.id !== productId);
  updateCartDisplay();
}

function clearShoppingCart() {
  if (currentCart.length === 0) return;
  
  if (confirm("Apakah Anda yakin ingin mengosongkan keranjang?")) {
    currentCart = [];
    updateCartDisplay();
  }
}

function filterProducts() {
  const searchTerm = searchProduct.value.toLowerCase();
  const transaction = db.transaction(STORE_ITEMS, "readonly");
  const store = transaction.objectStore(STORE_ITEMS);
  const request = store.getAll();

  request.onsuccess = () => {
    const products = request.result.filter(item => 
      (item.name.toLowerCase().includes(searchTerm) ||
      item.category.toLowerCase().includes(searchTerm)) && 
      item.quantity > 0
    );
    renderProducts(products);
  };
}

// ===== PAYMENT FUNCTIONS =====
function openPaymentModal() {
  if (currentCart.length === 0) {
    alert("Keranjang belanja kosong!");
    return;
  }
  
  const total = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  paymentTotal.textContent = `Rp${total.toLocaleString()}`;
  amountPaid.textContent = "Rp0";
  changeAmount.textContent = "Rp0";
  cashAmount.value = "";
  
  openModal(paymentModal);
}

function calculateChange() {
  const total = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const paid = parseInt(cashAmount.value) || 0;
  
  amountPaid.textContent = `Rp${paid.toLocaleString()}`;
  
  if (paid >= total) {
    changeAmount.textContent = `Rp${(paid - total).toLocaleString()}`;
  } else {
    changeAmount.textContent = "Rp0";
  }
}

function processPayment() {
  const total = currentCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const paid = parseInt(cashAmount.value) || 0;
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
  
  if (paid < total && paymentMethod === "cash") {
    alert("Jumlah pembayaran kurang!");
    return;
  }
  
  // Create transaction record
  const transaction = {
    date: new Date(),
    items: currentCart,
    total,
    paymentMethod,
    amountPaid: paid
  };
  
  // Save transaction
  const tx = db.transaction(STORE_TRANSACTIONS, "readwrite");
  const store = tx.objectStore(STORE_TRANSACTIONS);
  const request = store.add(transaction);
  
  request.onsuccess = () => {
    // Update inventory quantities
    updateInventoryAfterPurchase();
    
    // Show receipt
    alert(`Pembayaran berhasil!\nTotal: Rp${total.toLocaleString()}\nKembalian: Rp${(paid - total).toLocaleString()}`);
    
    // Clear cart and close modal
    currentCart = [];
    updateCartDisplay();
    closeModal(paymentModal);
    
    // Refresh reports
    loadReports();
  };
}

function updateInventoryAfterPurchase() {
  const tx = db.transaction(STORE_ITEMS, "readwrite");
  const store = tx.objectStore(STORE_ITEMS);
  
  currentCart.forEach(cartItem => {
    const request = store.get(cartItem.id);
    
    request.onsuccess = () => {
      const product = request.result;
      product.quantity -= cartItem.quantity;
      store.put(product);
    };
  });
  
  // Refresh product displays
  tx.oncomplete = () => {
    loadItems();
    loadProductsForCashier();
  };
}

// ===== REPORTS FUNCTIONS =====
function loadReports() {
  loadInventoryStats();
  loadTodayTransactions();
}

function loadInventoryStats() {
  // Count total products
  const txItems = db.transaction(STORE_ITEMS, "readonly");
  const itemsStore = txItems.objectStore(STORE_ITEMS);
  const countRequest = itemsStore.count();
  
  countRequest.onsuccess = () => {
    totalProducts.textContent = countRequest.result;
  };
}

function loadTodayTransactions() {
  const tx = db.transaction(STORE_TRANSACTIONS, "readonly");
  const store = tx.objectStore(STORE_TRANSACTIONS);
  const index = store.index("date");
  
  // Get today's date at midnight
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get all transactions from today onward
  const range = IDBKeyRange.lowerBound(today);
  const request = index.getAll(range);
  
  request.onsuccess = () => {
    const transactions = request.result;
    
    // Calculate today's stats
    const todayStats = transactions.reduce((stats, tx) => {
      stats.count++;
      stats.revenue += tx.total;
      return stats;
    }, { count: 0, revenue: 0 });
    
    // Update UI
    todayTransactions.textContent = todayStats.count;
    todayRevenue.textContent = `Rp${todayStats.revenue.toLocaleString()}`;
    
    // Show recent transactions (last 5)
    renderRecentTransactions(transactions.slice(-5).reverse());
  };
}

function renderRecentTransactions(transactions) {
  transactionsTable.innerHTML = "";
  
  if (transactions.length === 0) {
    transactionsTable.innerHTML = `
      <tr>
        <td colspan="3" class="no-data">Tidak ada transaksi</td>
      </tr>
    `;
    return;
  }
  
  transactions.forEach(tx => {
    const row = document.createElement("tr");
    
    // Format date
    const date = new Date(tx.date);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Count items
    const itemCount = tx.items.reduce((count, item) => count + item.quantity, 0);
    
    row.innerHTML = `
      <td>${timeString}</td>
      <td>${itemCount} item</td>
      <td>Rp${tx.total.toLocaleString()}</td>
    `;
    transactionsTable.appendChild(row);
  });
}

// ===== UTILITY FUNCTIONS =====
function openModal(modal) {
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeModal(modal) {
  modal.style.display = "none";
  document.body.style.overflow = "auto";
}

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  // Set today's date as default in reports
  const today = new Date();
  document.getElementById("todayDate").textContent = today.toLocaleDateString('id-ID');
});