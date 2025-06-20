// Inisialisasi IndexedDB
let db;
const DB_NAME = "InventoryDB";
const DB_VERSION = 1;
const STORE_NAME = "items";

const request = indexedDB.open(DB_NAME, DB_VERSION);

request.onupgradeneeded = (event) => {
  db = event.target.result;
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
  }
};

request.onsuccess = (event) => {
  db = event.target.result;
  loadItems();
};

request.onerror = (event) => {
  console.error("Database error:", event.target.error);
};

// DOM Elements
const itemList = document.getElementById("itemList");
const itemForm = document.getElementById("itemForm");
const itemModal = document.getElementById("itemModal");
const modalTitle = document.getElementById("modalTitle");
const addBtn = document.getElementById("addBtn");
const cancelBtn = document.getElementById("cancelBtn");

// Event Listeners
addBtn.addEventListener("click", () => openModal());
cancelBtn.addEventListener("click", () => closeModal());
itemForm.addEventListener("submit", (e) => {
  e.preventDefault();
  saveItem();
});

// Fungsi Buka/Tutup Modal
function openModal(item = null) {
  if (item) {
    modalTitle.textContent = "Edit Barang";
    document.getElementById("itemId").value = item.id;
    document.getElementById("itemName").value = item.name;
    document.getElementById("itemQty").value = item.quantity;
    document.getElementById("itemPrice").value = item.price;
  } else {
    modalTitle.textContent = "Tambah Barang";
    itemForm.reset();
  }
  itemModal.style.display = "flex";
}

function closeModal() {
  itemModal.style.display = "none";
}

// Fungsi CRUD
function loadItems() {
  const transaction = db.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();

  request.onsuccess = () => {
    const items = request.result;
    renderItems(items);
  };
}

function renderItems(items) {
  itemList.innerHTML = "";
  items.forEach((item) => {
    const itemCard = document.createElement("div");
    itemCard.className = "item-card";
    itemCard.innerHTML = `
      <div class="item-info">
        <h3>${item.name}</h3>
        <p>Jumlah: ${item.quantity} | Harga: Rp${item.price}</p>
      </div>
      <div class="item-actions">
        <button onclick="editItem(${item.id})">✏️</button>
        <button onclick="deleteItem(${item.id})">🗑️</button>
      </div>
    `;
    itemList.appendChild(itemCard);
  });
}

function saveItem() {
  const id = document.getElementById("itemId").value;
  const name = document.getElementById("itemName").value;
  const quantity = document.getElementById("itemQty").value;
  const price = document.getElementById("itemPrice").value;

  const item = { name, quantity, price };

  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);

  if (id) {
    item.id = parseInt(id);
    const request = store.put(item);
    request.onsuccess = () => {
      closeModal();
      loadItems();
    };
  } else {
    const request = store.add(item);
    request.onsuccess = () => {
      closeModal();
      loadItems();
    };
  }
}

window.editItem = (id) => {
  const transaction = db.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const request = store.get(id);

  request.onsuccess = () => {
    openModal(request.result);
  };
};

window.deleteItem = (id) => {
  if (confirm("Hapus barang ini?")) {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
    transaction.oncomplete = () => loadItems();
  }
};