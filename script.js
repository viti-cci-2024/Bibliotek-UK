// script.js

// Variables globales
const showBooksButton = document.getElementById("show-books");
const clearBooksButton = document.getElementById("clear-books");
const booksListDiv = document.getElementById("books-list");
const searchAuthorInput = document.getElementById("search-author");
const searchAuthorButton = document.getElementById("search-author-btn");
const searchTitleInput = document.getElementById("search-title");
const searchTitleButton = document.getElementById("search-title-btn");
const searchResultsDiv = document.getElementById("search-results");
const authButton = document.getElementById("auth-button");
const authModal = document.getElementById("auth-modal");
const closeModalButton = document.getElementById("close-modal");
const loginButton = document.getElementById("login-button");
const authErrorDiv = document.getElementById("auth-error");
const userStatusSpan = document.getElementById("user-status");
const addBookSection = document.getElementById("add-book-section");
const addBookButton = document.getElementById("add-book-button");
const bookTitleInput = document.getElementById("book-title");
const bookAuthorInput = document.getElementById("book-author");

// Bouton "Gestion des Membres"
const membersButton = document.getElementById("members-button");

// Suivi de la connexion
let isConnected = false;
let currentUser = { nom: "", prenom: "", statut: "" };

// Variables pour la modification de livre
const editModal = document.getElementById("edit-modal");
const closeEditModalButton = document.getElementById("close-edit-modal");
const validateEditButton = document.getElementById("validate-edit-button");
const editTitleInput = document.getElementById("edit-title");
const editAuthorInput = document.getElementById("edit-author");
const editErrorDiv = document.getElementById("edit-error");
let bookToEdit = null;

/**
 * =========================
 * 1. NOUVEAU : Fonctions de validation & affichage d'erreurs
 * =========================
 */

// Valide le formulaire de connexion
function validateLoginForm(name, firstname, password) {
  const errors = [];
  if (!name) errors.push("Last Name is required");
  if (!firstname) errors.push("First Name is required");
  if (!password) errors.push("Password is required.");
  if (password && password.length < 4) {
    errors.push("Password must contain at least 4 characters.");
  }
  return errors;
}

// Affiche un tableau d'erreurs dans un conteneur (ex: authErrorDiv)
function displayErrors(errors, container) {
  // On vide d'abord le conteneur
  container.innerHTML = "";
  if (!errors || errors.length === 0) return;

  // On crée une liste <ul> pour énumérer chaque message
  const ul = document.createElement("ul");
  errors.forEach((msg) => {
    const li = document.createElement("li");
    li.textContent = msg;
    ul.appendChild(li);
  });
  container.appendChild(ul);

  // Optionnel : focus sur la zone d'erreur pour l'accessibilité
  container.setAttribute("tabindex", "-1");
  container.focus();
}

/**
 * =========================
 * 2. Initialisation IndexedDB
 * =========================
 */
const initializeIndexedDB = async () => {
  return new Promise((resolve, reject) => {
    // Version 2 (ou plus) pour inclure autoIncrement sur "members"
    const request = indexedDB.open("Bibliotheque", 2);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("books")) {
        db.createObjectStore("books", { keyPath: "titre" });
      }
      if (!db.objectStoreNames.contains("members")) {
        db.createObjectStore("members", { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      console.log("Base IndexedDB initialisée (script.js).");
      resolve(request.result);
    };

    request.onerror = (event) => {
      console.error(
        "Erreur lors de l'initialisation d'IndexedDB :",
        event.target.error
      );
      reject(event.target.error);
    };
  });
};

/**
 * =========================
 * 3. Chargement initial des données
 * =========================
 */
const loadInitialBooks = async (db) => {
  try {
    const response = await fetch("books.json");
    const booksData = await response.json();

    const transaction = db.transaction("books", "readwrite");
    const booksStore = transaction.objectStore("books");

    booksData.forEach((book) => booksStore.put(book));

    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    console.log("Livres chargés avec succès.");
  } catch (error) {
    console.error("Erreur lors du chargement des livres :", error);
  }
};

const loadInitialMembers = async (db) => {
  try {
    const response = await fetch("membres.json");
    const membersData = await response.json();

    const transaction = db.transaction("members", "readwrite");
    const membersStore = transaction.objectStore("members");

    membersData.forEach((member) => membersStore.put(member));

    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    console.log("Membres chargés avec succès.");
  } catch (error) {
    console.error("Erreur lors du chargement des membres :", error);
  }
};

const checkDataLoaded = async (db, storeName) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const countRequest = store.count();

    countRequest.onsuccess = () => resolve(countRequest.result > 0);
    countRequest.onerror = () => reject(countRequest.error);
  });
};

/**
 * =========================
 * 4. Gestion des livres
 * =========================
 */
const getAllData = async (db, storeName) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);

    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const searchData = async (db, storeName, field, query) => {
  const data = await getAllData(db, storeName);
  return data.filter((item) =>
    item[field].toLowerCase().includes(query.toLowerCase())
  );
};

const updateBook = async (db, oldTitle, updatedBook) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("books", "readwrite");
    const booksStore = transaction.objectStore("books");

    if (oldTitle !== updatedBook.titre) {
      // Supprime l'ancien enregistrement
      booksStore.delete(oldTitle).onsuccess = () => {
        booksStore.put(updatedBook).onsuccess = () => {
          console.log("Livre mis à jour :", updatedBook);
          resolve();
        };
        booksStore.put(updatedBook).onerror = () => {
          console.error(
            "Error while updating the book",
            booksStore.error
          );
          reject(booksStore.error);
        };
      };
      booksStore.delete(oldTitle).onerror = () => {
        console.error(
          "Error while deleting the book",
          booksStore.error
        );
        reject(booksStore.error);
      };
    } else {
      // Titre inchangé
      booksStore.put(updatedBook).onsuccess = () => {
        console.log("Livre mis à jour :", updatedBook);
        resolve();
      };
      booksStore.put(updatedBook).onerror = () => {
        console.error(
          "Erreur lors de la mise à jour du livre :",
          booksStore.error
        );
        reject(booksStore.error);
      };
    }
  });
};

const deleteBook = async (db, title) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("books", "readwrite");
    const booksStore = transaction.objectStore("books");

    const request = booksStore.delete(title);
    request.onsuccess = () => {
      console.log("Livre supprimé :", title);
      resolve();
    };
    request.onerror = () => {
      console.error("Erreur lors de la suppression du livre :", request.error);
      reject(request.error);
    };
  });
};

const addBook = async (db, title, author) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("books", "readwrite");
    const booksStore = transaction.objectStore("books");

    const newBook = {
      titre: title,
      auteur: author,
      etat: "Available",
      emprunteur: null,
    };

    const request = booksStore.add(newBook);
    request.onsuccess = () => {
      console.log("Livre ajouté :", newBook);
      resolve();
    };
    request.onerror = () => {
      console.error("Erreur lors de l'ajout du livre :", request.error);
      reject(request.error);
    };
  });
};

/**
 * =========================
 * 5. Affichage & interactions
 * =========================
 */
const displaySearchResults = (results, container) => {
  booksListDiv.style.display = "none";
  container.innerHTML = "";

  if (results.length === 0) {
    container.innerHTML = "<p>No results found</p>";
    return;
  }

  const table = document.createElement("table");
  table.classList.add(
    "table",
    "table-bordered",
    "table-striped",
    "table-hover",
    "table-sm"
  ); // Applique les classes Bootstrap pour améliorer la présentation
  table.innerHTML = `
        <thead>
            <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Status</th>
                ${isConnected ? "<th>Emprunteur</th>" : ""}
                ${isConnected ? "<th>Actions</th>" : ""}
            </tr>
        </thead>
    `;
  const tbody = document.createElement("tbody");

  results.forEach((book) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
          <td>${book.titre}</td>
          <td>${book.auteur}</td>
          <td class="${
            book.etat === "Available" ? "text-success fs-6" : "text-danger fs-6"
          }">${book.etat}</td>
          ${
            isConnected
              ? `<td>${book.emprunteur || "N/A"}</td>`
              : ""
          }
          ${
            isConnected
              ? ` 
              <td>
                  <div class="d-flex flex-wrap justify-content-around">
                      ${
                        book.etat === "Available"
                          ? `<button class="btn btn-info btn-sm borrow-book" data-title="${book.titre}">Borrow</button>`
                          : `<button class="btn btn-warning btn-sm return-book" data-title="${book.titre}">Return</button>`
                      }
                      <button class="btn btn-primary btn-sm edit-book" data-title="${book.titre}">
                        Modify
                      </button>
                      <button class="btn btn-secondary btn-sm delete-book" data-title="${book.titre}">
                      <i class="bi bi-trash"></i> Remove
                      </button>
                  </div>
              </td>`
              : ""
          }
      `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);

  if (isConnected) {
    // Emprunter, Retourner, Supprimer, Modifier (même logique que plus haut)
    const borrowButtons = document.querySelectorAll(".borrow-book");
    borrowButtons.forEach((button) => {
      button.addEventListener("click", async (event) => {
        const title = event.target.getAttribute("data-title");
        const book = results.find((b) => b.titre === title);
        if (book) {
          book.etat = "Borrowed";
          book.emprunteur = `${currentUser.prenom} ${currentUser.nom}`;
          const db = await initializeIndexedDB();
          await updateBook(db, book.titre, book);
          displaySearchResults(
            await searchData(db, "books", "titre", ""),
            container
          );
        }
      });
    });

    const returnButtons = document.querySelectorAll(".return-book");
    returnButtons.forEach((button) => {
      button.addEventListener("click", async (event) => {
        const title = event.target.getAttribute("data-title");
        const book = results.find((b) => b.titre === title);
        if (book) {
          book.etat = "Available";
          book.emprunteur = null;
          const db = await initializeIndexedDB();
          await updateBook(db, book.titre, book);
          displaySearchResults(
            await searchData(db, "books", "titre", ""),
            container
          );
        }
      });
    });

    const deleteButtons = document.querySelectorAll(".delete-book");
    deleteButtons.forEach((button) => {
      button.addEventListener("click", async (event) => {
        const title = event.target.getAttribute("data-title");
        const db = await initializeIndexedDB();
        await deleteBook(db, title);
        displaySearchResults(
          await searchData(db, "books", "titre", ""),
          container
        );
      });
    });

    const editButtons = document.querySelectorAll(".edit-book");
    editButtons.forEach((button) => {
      button.addEventListener("click", async (event) => {
        const title = event.target.getAttribute("data-title");
        const db = await initializeIndexedDB();
        const books = await getAllData(db, "books");
        const book = books.find((b) => b.titre === title);
        if (book) {
          bookToEdit = book;
          editTitleInput.value = book.titre;
          editAuthorInput.value = book.auteur;
          editErrorDiv.textContent = "";
          editModal.style.display = "flex";
        }
      });
    });
  }
};


const displayBooks = async (db, container) => {
  try {
    searchResultsDiv.innerHTML = "";
    container.style.display = "block";

    const books = await getAllData(db, "books");
    container.innerHTML = "";

    if (books.length === 0) {
      container.innerHTML = "<p>No books available.</p>";
      return;
    }

    const table = document.createElement("table");
    table.classList.add(
      "table",
      "table-bordered",
      "table-striped",
      "table-hover",
      "table-sm"
    ); // Applique les classes Bootstrap pour améliorer la présentation
    table.innerHTML = `
            <thead>
                <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Status</th>
                    ${isConnected ? "<th>Emprunteur</th>" : ""}
                    ${isConnected ? "<th>Actions</th>" : ""}
                </tr>
            </thead>
        `;
    const tbody = document.createElement("tbody");

    books.forEach((book) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${book.titre}</td>
                <td>${book.auteur}</td>
                <td class="fs-6 ${
                  book.etat === "Available" ? "text-success fs-6" : "text-danger fs-6"
                }">${book.etat}</td>
                ${isConnected ? `<td class="fs-6">${book.emprunteur || "N/A"}</td>` : ""}
                ${
                  isConnected
                    ? ` 
                    <td>
                      <div class="d-flex justify-content-around">
                        ${
                          book.etat === "Available"
                            ? `<button class="btn btn-info btn-sm borrow-book" data-title="${book.titre}">Borrow</button>`
                            : `<button class="btn btn-warning btn-sm return-book" data-title="${book.titre}">Return</button>`
                        }
                        <button class="btn btn-primary btn-sm edit-book" data-title="${book.titre}">
                          Modify
                        </button>
                        <button class="btn btn-secondary btn-sm delete-book" data-title="${book.titre}">
                        <i class="bi bi-trash"></i> Remove
                        </button>
                      </div>
                    </td>`
                    : ""
                }
            `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    // Ajout des événements (emprunter, retourner, modifier, supprimer)
    if (isConnected) {
      const borrowButtons = document.querySelectorAll(".borrow-book");
      borrowButtons.forEach((button) => {
        button.addEventListener("click", async (event) => {
          const title = event.target.getAttribute("data-title");
          const book = books.find((b) => b.titre === title);
          if (book) {
            book.etat = "Borrowed";
            book.emprunteur = `${currentUser.prenom} ${currentUser.nom}`;
            await updateBook(db, book.titre, book);
            await displayBooks(db, container);
          }
        });
      });

      const returnButtons = document.querySelectorAll(".return-book");
      returnButtons.forEach((button) => {
        button.addEventListener("click", async (event) => {
          const title = event.target.getAttribute("data-title");
          const book = books.find((b) => b.titre === title);
          if (book) {
            book.etat = "Available";
            book.emprunteur = null;
            await updateBook(db, book.titre, book);
            await displayBooks(db, container);
          }
        });
      });

      const deleteButtons = document.querySelectorAll(".delete-book");
      deleteButtons.forEach((button) => {
        button.addEventListener("click", async (event) => {
          const title = event.target.getAttribute("data-title");
          await deleteBook(db, title);
          await displayBooks(db, container);
        });
      });

      const editButtons = document.querySelectorAll(".edit-book");
      editButtons.forEach((button) => {
        button.addEventListener("click", async (event) => {
          const title = event.target.getAttribute("data-title");
          const books = await getAllData(db, "books");
          const book = books.find((b) => b.titre === title);
          if (book) {
            bookToEdit = book;
            editTitleInput.value = book.titre;
            editAuthorInput.value = book.auteur;
            editErrorDiv.textContent = "";
            editModal.style.display = "flex";
          }
        });
      });
    }
  } catch (error) {
    console.error("Erreur lors de l'affichage des livres :", error);
    container.innerHTML = "<p>Error while retrieving books.</p>";
  }
};



/**
 * =========================
 * 6. Gestion de l’ajout de livre
 * =========================
 */
addBookButton.addEventListener("click", async () => {
  const title = bookTitleInput.value.trim();
  const author = bookAuthorInput.value.trim();


  if (!title || !author) {
    console.error("Titre et auteur sont obligatoires.");
    return;
  }

  try {
    const db = await initializeIndexedDB();
    await addBook(db, title, author);
    bookTitleInput.value = "";
    bookAuthorInput.value = "";
    await displayBooks(db, booksListDiv);
  } catch (error) {
    console.error("Erreur lors de l'ajout du livre :", error);
  }
});

/**
 * =========================
 * 7. Effacer la liste
 * =========================
 */
clearBooksButton.addEventListener("click", () => {
  booksListDiv.innerHTML = "";
  booksListDiv.style.display = "none";
  searchResultsDiv.innerHTML = "";
  console.log("Liste des livres effacée.");
});

/**
 * =========================
 * 8. Recherche
 * =========================
 */
searchAuthorButton.addEventListener("click", async () => {
  const query = searchAuthorInput.value.trim();
  if (!query) {
    searchResultsDiv.innerHTML =
      "<p>Please enter an author to search for</p>";
    return;
  }

  try {
    const db = await initializeIndexedDB();
    const results = await searchData(db, "books", "auteur", query);
    displaySearchResults(results, searchResultsDiv);
  } catch (error) {
    console.error("Erreur lors de la recherche par auteur :", error);
    searchResultsDiv.innerHTML =
      "<p>Error while searching. Please try again.</p>";
  }
});

searchTitleButton.addEventListener("click", async () => {
  const query = searchTitleInput.value.trim();
  if (!query) {
    searchResultsDiv.innerHTML =
      "<p>Please enter a title to search for.</p>";
    return;
  }

  try {
    const db = await initializeIndexedDB();
    const results = await searchData(db, "books", "titre", query);
    displaySearchResults(results, searchResultsDiv);
  } catch (error) {
    console.error("Erreur lors de la recherche par titre :", error);
    searchResultsDiv.innerHTML =
      "<p>Error while searching. Please try again.</p>";
  }
});

/**
 * =========================
 * 9. Connexion / Déconnexion
 * =========================
 */
authButton.addEventListener("click", () => {
  if (!isConnected) {
    authModal.style.display = "flex";
    authErrorDiv.textContent = "";
  } else {
    isConnected = false;
    currentUser = { nom: "", prenom: "", statut: "" };
    localStorage.removeItem("isConnected");
    localStorage.removeItem("currentUser");
    addBookSection.style.display = "none";
    booksListDiv.innerHTML = "";
    searchResultsDiv.innerHTML = "";
    updateAuthButton();
    console.log("Utilisateur déconnecté.");
  }
});

closeModalButton.addEventListener("click", () => {
  authModal.style.display = "none";
});

loginButton.addEventListener("click", async () => {
  const name = document.getElementById("auth-name").value.trim();
  const firstname = document.getElementById("auth-firstname").value.trim();
  const password = document.getElementById("auth-password").value;

  // ==============================
  // utilisation de validateLoginForm
  // ==============================
  const errors = validateLoginForm(name, firstname, password);
  if (errors.length > 0) {
    displayErrors(errors, authErrorDiv);
    return;
  }

  try {
    const db = await initializeIndexedDB();
    const members = await getAllData(db, "members");

    const user = members.find(
      (member) =>
        member.nom.toLowerCase() === name.toLowerCase() &&
        member.prenom.toLowerCase() === firstname.toLowerCase() &&
        member.motDePasse === password
    );

    if (user) {
      localStorage.setItem("isConnected", "true");
      localStorage.setItem("currentUser", JSON.stringify(user));
      console.log("Utilisateur connecté :", user);

      isConnected = true;
      currentUser = user;
      addBookSection.style.display = "block";
      authModal.style.display = "none";
      updateAuthButton();
    } else {
      displayErrors(["Incorrect credentials."], authErrorDiv);
    }
  } catch (error) {
    console.error("Erreur while connecting :", error);
    displayErrors(
      ["An error occurred. Please try again."],
      authErrorDiv
    );
  }
});

/**
 * =========================
 * 10. Modale de modification d'un livre
 * =========================
 */
closeEditModalButton.addEventListener("click", () => {
  editModal.style.display = "none";
});

validateEditButton.addEventListener("click", async () => {
  const newTitle = editTitleInput.value.trim();
  const newAuthor = editAuthorInput.value.trim();

  if (!newTitle || !newAuthor) {
    displayErrors(
      ["Please fill in all the fields (Title and Author)."],
      editErrorDiv
    );
    return;
  }

  try {
    const db = await initializeIndexedDB();

    // Vérifier si un livre avec ce titre existe déjà
    if (newTitle !== bookToEdit.titre) {
      const existingBook = await new Promise((resolve, reject) => {
        const transaction = db.transaction("books", "readonly");
        const booksStore = transaction.objectStore("books");
        const request = booksStore.get(newTitle);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (existingBook) {
        displayErrors(["A book with this title already exists."], editErrorDiv);
        return;
      }
    }

    const updatedBook = {
      ...bookToEdit,
      titre: newTitle,
      auteur: newAuthor,
    };

    await updateBook(db, bookToEdit.titre, updatedBook);
    editModal.style.display = "none";
    await displayBooks(db, booksListDiv);
  } catch (error) {
    console.error("Erreur lors de la modification du livre :", error);
    displayErrors(
      ["Error while editing. Please try again."],
      editErrorDiv
    );
  }
});

/**
 * =========================
 * 11. Mise à jour du bouton d'authentification
 * =========================
 */
const updateAuthButton = () => {
  if (isConnected) {
    authButton.innerHTML = '<i class="bi bi-box-arrow-right"></i>&nbsp;&nbsp;Deconnexion';
    membersButton.style.display = "inline-block";
    userStatusSpan.innerHTML = `🟢 Status : Connected (${currentUser.statut})`;
    userStatusSpan.classList.add("connected");
    userStatusSpan.classList.remove("disconnected");
  } else {
    authButton.innerHTML = '<i class="bi bi-person"></i> Connexion';
    membersButton.style.display = "none";
    userStatusSpan.innerHTML = "🔴 Status : logged off";
    userStatusSpan.classList.add("disconnected");
    userStatusSpan.classList.remove("connected");
  }
};

/**
 * =========================
 * 12. Bouton "Gestion des Membres"
 * =========================
 */
membersButton.addEventListener("click", () => {
  window.location.href = "membres.html";
});

/**
 * =========================
 * 13. Restauration de la connexion via localStorage
 * =========================
 */
document.addEventListener("DOMContentLoaded", async () => {
  const storedIsConnected = localStorage.getItem("isConnected");
  const storedUser = localStorage.getItem("currentUser");

  if (storedIsConnected === "true" && storedUser) {
    isConnected = true;
    currentUser = JSON.parse(storedUser);
    addBookSection.style.display = "block";
  } else {
    isConnected = false;
    currentUser = { nom: "", prenom: "", statut: "" };
    addBookSection.style.display = "none";
  }
  updateAuthButton();
});

/**
 * =========================
 * 14. Initialisation globale
 * =========================
 */
(async () => {
  const db = await initializeIndexedDB();

  const booksLoaded = await checkDataLoaded(db, "books");
  if (!booksLoaded) {
    await loadInitialBooks(db);
  } else {
    console.log("Les livres sont déjà chargés dans IndexedDB.");
  }

  const membersLoaded = await checkDataLoaded(db, "members");
  if (!membersLoaded) {
    await loadInitialMembers(db);
  } else {
    console.log("Les membres sont déjà chargés dans IndexedDB.");
  }

  showBooksButton.addEventListener("click", () =>
    displayBooks(db, booksListDiv)
  );

  booksListDiv.innerHTML = "";
  booksListDiv.style.display = "none";
})();
