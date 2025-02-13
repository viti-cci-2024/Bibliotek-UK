// Références DOM
const membersListDiv = document.getElementById("members-list");
const addMemberButton = document.getElementById("add-member-button");
const memberModal = document.getElementById("member-modal");
const memberModalTitle = document.getElementById("member-modal-title");
const memberErrorDiv = document.getElementById("member-error");
const memberNomInput = document.getElementById("member-nom");
const memberPrenomInput = document.getElementById("member-prenom");
const memberStatutSelect = document.getElementById("member-statut");
const memberPasswordInput = document.getElementById("member-password");
const saveMemberButton = document.getElementById("save-member-button");
const closeMemberModalButton = document.getElementById("close-member-modal");
const authButton = document.getElementById("auth-button");
const userStatusSpan = document.getElementById("user-status");

// Variables pour suivre l'état de la modale
let isEditing = false;
let memberToEdit = null;

// Initialiser la modale avec Bootstrap
const memberModalInstance = new bootstrap.Modal(memberModal);

/**
 * =========================
 * 1. Fonction de validation & affichage d’erreurs
 * =========================
 */
function validateMemberForm(nom, prenom, statut, motDePasse) {
  const errors = [];

  if (!nom) errors.push("The Last Name field is required.");
  if (!prenom) errors.push("The First Name field is required.");
  if (!statut) errors.push("The Status field must be selected.");
  if (!motDePasse) {
    errors.push("The Password field is required.");
  } else if (motDePasse.length < 4) {
    errors.push("The password must be at least 4 characters long.");
  }

  return errors;
}

function displayErrors(errors, container) {
  container.innerHTML = "";
  if (!errors || errors.length === 0) return;

  const ul = document.createElement("ul");
  errors.forEach((msg) => {
    const li = document.createElement("li");
    li.textContent = msg;
    ul.appendChild(li);
  });
  container.appendChild(ul);
}

/**
 * =========================
 * 2. Initialiser IndexedDB
 * =========================
 */
const initializeIndexedDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("Bibliotheque", 2);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("members")) {
        db.createObjectStore("members", { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      console.log("IndexedDB initialisée pour `membres.html`.");
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
 * 3. Récupération des membres
 * =========================
 */
const getAllMembers = async (db) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("members", "readonly");
    const membersStore = transaction.objectStore("members");
    const request = membersStore.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const displayMembers = async (db) => {
  try {
    const members = await getAllMembers(db);
    console.log("Membres récupérés :", members);
    membersListDiv.innerHTML = ""; // Réinitialise la liste

    if (members.length === 0) {
      membersListDiv.innerHTML = "<p>No members found.</p>";
      return;
    }

    const table = document.createElement("table");
    table.classList.add("table", "table-bordered"); // Ajoute les classes Bootstrap pour la table
    table.innerHTML = `
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Statut</th>
                    <th>Actions</th>
                </tr>
            </thead>
        `;
    const tbody = document.createElement("tbody");

    members.forEach((member) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${member.id}</td>
                <td>${member.nom}</td>
                <td>${member.prenom}</td>
                <td>${member.statut}</td>
                <td>
                    <button class="action-button edit-button btn btn-warning" data-id="${member.id}">Modifier</button>
                    <button class="action-button delete-button btn btn-danger" data-id="${member.id}">Supprimer</button>
                </td>
            `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    membersListDiv.appendChild(table);

    // Bouton "Modifier"
    const editButtons = document.querySelectorAll(".edit-button");
    editButtons.forEach((button) => {
      button.addEventListener("click", async (event) => {
        const memberId = parseInt(event.target.getAttribute("data-id"));
        const member = members.find((m) => m.id === memberId);
        console.log(`Modifier le membre ID: ${memberId}`, member);
        if (member) {
          isEditing = true;
          memberToEdit = member;
          memberModalTitle.textContent = "Update Member";
          memberNomInput.value = member.nom;
          memberPrenomInput.value = member.prenom;
          memberStatutSelect.value = member.statut;
          memberPasswordInput.value = member.motDePasse || "";
          memberErrorDiv.textContent = "";
          memberModalInstance.show(); // Ouvre la modale
        }
      });
    });

    // Bouton "Supprimer"
    const deleteButtons = document.querySelectorAll(".delete-button");
    deleteButtons.forEach((button) => {
      button.addEventListener("click", async (event) => {
        const memberId = parseInt(event.target.getAttribute("data-id"));
        console.log(`Supprimer le membre ID: ${memberId}`);

        // Vérifier que l'ID est valide
        if (isNaN(memberId)) {
          console.error("ID du membre invalide.");
          return;
        }

        try {
          await deleteMember(db, memberId);
          displayMembers(db); // Met à jour la liste des membres après suppression, sans recharger la page
        } catch (error) {
          console.error("Erreur lors de la suppression du membre :", error);
        }
      });
    });
  } catch (error) {
    console.error("Erreur lors de l'affichage des membres :", error);
    membersListDiv.innerHTML =
      "<p>Error retrieving members.</p>";
  }
};

/**
 * =========================
 * 4. Ajouter / modifier un membre
 * =========================
 */
const saveMember = async (db) => {
  const nom = memberNomInput.value.trim();
  const prenom = memberPrenomInput.value.trim();
  const statut = memberStatutSelect.value;
  const motDePasse = memberPasswordInput.value.trim();

  const errors = validateMemberForm(nom, prenom, statut, motDePasse);
  if (errors.length > 0) {
    displayErrors(errors, memberErrorDiv);
    return;
  }

  try {
    const transaction = db.transaction("members", "readwrite");
    const membersStore = transaction.objectStore("members");

    if (isEditing && memberToEdit) {
      const updatedMember = {
        ...memberToEdit,
        nom,
        prenom,
        statut,
        motDePasse,
      };
      membersStore.put(updatedMember); // Met à jour le membre
      console.log("Membre mis à jour :", updatedMember);
    } else {
      const newMember = {
        nom,
        prenom,
        statut,
        motDePasse,
      };

      const request = membersStore.add(newMember); // Ajoute le membre

      request.onsuccess = function () {
        console.log("Nouveau membre ajouté avec succès :", newMember);
        displayMembers(db); // Rafraîchit la liste des membres après ajout
      };

      request.onerror = function (event) {
        console.error("Erreur lors de l'ajout du membre :", event.target.error);
      };
    }

    // Réinitialiser la modale après ajout ou modification
    isEditing = false;
    memberToEdit = null;
    memberModalTitle.textContent = "Add Member";
    memberNomInput.value = "";
    memberPrenomInput.value = "";
    memberStatutSelect.value = "Member";
    memberPasswordInput.value = "";
    memberErrorDiv.textContent = "";
    memberModalInstance.hide(); // Ferme la modale

    // Rafraîchir immédiatement la liste des membres
    displayMembers(db);
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du membre :", error);
    displayErrors(
      ["Error while saving. Please try again."],
      memberErrorDiv
    );
  }
};

// =========================
// Suppression du membre
// =========================
const deleteMember = async (db, memberId) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("members", "readwrite");
    const membersStore = transaction.objectStore("members");
    const request = membersStore.delete(memberId);

    request.onsuccess = () => {
      console.log(`Membre ID ${memberId} supprimé avec succès.`);
      resolve();
    };
    request.onerror = (event) => {
      console.error(
        `Erreur lors de la suppression du membre avec ID ${memberId}:`,
        event.target.error
      );
      reject(event.target.error);
    };
  });
};

// =========================
// Initialisation de la page
// =========================
document.addEventListener("DOMContentLoaded", () => {
  // Vérifier si l'utilisateur est connecté et s'il est administrateur
  const isConnected = localStorage.getItem("isConnected");
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));

  if (!isConnected || !currentUser || currentUser.statut !== "Administrateur") {
    // Afficher une alerte et rediriger l'utilisateur vers index.html
    alert("Sorry, you are not allowed to access this page.");
    window.location.href = "index.html";
  } else {
    // Afficher les informations de l'utilisateur connecté
    console.log("Utilisateur connecté :", currentUser);
    document.getElementById(
      "user-status"
    ).textContent = `Status : Connected (${currentUser.nom} ${currentUser.prenom}, ${currentUser.statut})`;
    document.getElementById("auth-button").innerHTML = '<i class="bi bi-box-arrow-right"></i>&nbsp;&nbsp;Déconnexion';
  }

  // Initialisation de la base de données et de l'affichage des membres
  initializeIndexedDB()
    .then((db) => {
      displayMembers(db);

      // Bouton pour ajouter un membre
      addMemberButton.addEventListener("click", () => {
        isEditing = false;
        memberModalTitle.textContent = "Add a member";
        memberNomInput.value = "";
        memberPrenomInput.value = "";
        memberStatutSelect.value = "Member";
        memberPasswordInput.value = "";
        memberErrorDiv.textContent = "";
        memberModalInstance.show(); // Ouvre la modale
      });

      // Enregistrer ou mettre à jour un membre
      saveMemberButton.addEventListener("click", () => {
        saveMember(db);
      });

      // Fermer la modale
      closeMemberModalButton.addEventListener("click", () => {
        memberModalInstance.hide(); // Ferme la modale
      });
    })
    .catch((error) => {
      console.error(
        "Erreur lors de l'initialisation de la base de données :",
        error
      );
    });

  // Déconnexion
  authButton.addEventListener("click", () => {
    // Supprimer les informations de connexion du localStorage
    localStorage.removeItem("isConnected");
    localStorage.removeItem("currentUser");

    // Mettre à jour l'affichage du statut de l'utilisateur
    userStatusSpan.textContent = "Status : Logged out";
    userStatusSpan.classList.remove("connected");
    authButton.textContent = "Connexion";

    // Rediriger vers la page index.html
    window.location.href = "index.html";
  });
});
