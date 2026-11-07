import { db } from "../firebase.js";

import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { showToast } from "../components/toast.js";
import { requireRole, isAdmin } from "../components/auth-guard.js";

import { createDataTable } from "../components/data-table.js";

let membersTable;

const tableBody = document.querySelector("#members-table-body");
const tableContainer = document.querySelector("#members-table-container");
const emptyState = document.querySelector("#members-empty");

const searchInput = document.querySelector("#member-search");
const roleFilter = document.querySelector("#role-filter");
const statusFilter = document.querySelector("#status-filter");
const clearFiltersButton = document.querySelector("#clear-filters");
const emptyClearFiltersButton = document.querySelector("#empty-clear-filters");

const statTotal = document.querySelector("#stat-total");
const statMembers = document.querySelector("#stat-members");
const statStaff = document.querySelector("#stat-staff");
const statInactive = document.querySelector("#stat-inactive");

const currentUserLabel = document.querySelector("#current-user");
const addMemberButton = document.querySelector("#add-member-button");

const memberDialog = document.querySelector("#member-dialog");
const memberDialogTitle = document.querySelector("#member-dialog-title");
const closeMemberDialogButton = document.querySelector("#close-member-dialog");
const cancelMemberButton = document.querySelector("#cancel-member");
const memberForm = document.querySelector("#member-form");
const saveMemberButton = document.querySelector("#save-member");
const nameInput = document.querySelector("#member-name");
const emailInput = document.querySelector("#member-email");
const phoneInput = document.querySelector("#member-phone");
const statusSelect = document.querySelector("#member-status");

const deleteDialog = document.querySelector("#delete-dialog");
const deleteMessage = document.querySelector("#delete-message");
const cancelDeleteButton = document.querySelector("#cancel-delete");
const confirmDeleteButton = document.querySelector("#confirm-delete");

let people = [];
let editingId = null;
let deletingId = null;
let currentStaff = null;

const ROLE_LABELS = {
  member: "Member",
  manager: "Manager",
  admin: "Admin",
};

const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function getInitials(name) {
  return (
    String(name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function getDateValue(value) {
  if (value && typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function formatDate(value) {
  const date = getDateValue(value);

  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getSafeRole(role) {
  return Object.hasOwn(ROLE_LABELS, role) ? role : "member";
}

function getSafeStatus(status) {
  return Object.hasOwn(STATUS_LABELS, status) ? status : "active";
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getErrorMessage(error, fallback) {
  if (error?.code === "permission-denied") {
    return "You do not have permission to do this.";
  }

  return fallback;
}

function subscribeToPeople() {
  onSnapshot(
    collection(db, "users"),
    (snapshot) => {
      people = snapshot.docs.map((documentSnapshot) => ({
        ...documentSnapshot.data(),
        id: documentSnapshot.id,
      }));

      membersTable.setData(people);
      updateStatistics();
    },
    (error) => {
      console.error("Error loading people:", error);
      showToast(getErrorMessage(error, "Could not load people."), "error");
    },
  );
}

function getMemberRows(data, searchTerm) {
  const selectedRole = roleFilter?.value ?? "all";
  const selectedStatus = statusFilter?.value ?? "all";

  return data
    .filter((person) => {
      const searchableText = [person.name, person.email, person.phone]
        .map((value) => String(value ?? ""))
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(searchTerm);

      const matchesRole =
        selectedRole === "all" || getSafeRole(person.role) === selectedRole;

      const matchesStatus =
        selectedStatus === "all" ||
        getSafeStatus(person.status) === selectedStatus;

      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? ""), "en", {
        sensitivity: "base",
      }),
    );
}

function renderMemberRow(person) {
  const name = person.name ?? "Unnamed";
  const email = person.email ?? "No email";
  const phone = person.phone || "—";
  const role = getSafeRole(person.role);
  const status = getSafeStatus(person.status);

  const canDelete = isAdmin(currentStaff);
  const showDelete = canDelete && role === "member";

  return `
    <tr>
      <td>
        <div class="applicant-cell">
          <span class="applicant-avatar">
            ${escapeHTML(getInitials(name))}
          </span>
          <div class="applicant-info">
            <span class="applicant-name">${escapeHTML(name)}</span>
            <span class="applicant-email">${escapeHTML(email)}</span>
          </div>
        </div>
      </td>
      <td>${escapeHTML(phone)}</td>
      <td>
        <span class="status-badge status-badge--${role}">
          ${ROLE_LABELS[role]}
        </span>
      </td>
      <td>
        <span class="status-badge status-badge--${status}">
          ${STATUS_LABELS[status]}
        </span>
      </td>
      <td>${escapeHTML(formatDate(person.createdAt))}</td>
      <td>
        <div class="row-actions">
          <button
            class="button button--secondary button--small"
            type="button"
            data-edit-id="${escapeHTML(person.id)}"
          >Edit</button>

          ${
            showDelete
              ? `<button
                  class="button button--danger button--small"
                  type="button"
                  data-delete-id="${escapeHTML(person.id)}"
                >Delete</button>`
              : ""
          }
        </div>
      </td>
    </tr>
  `;
}

function initMembersTable() {
  membersTable = createDataTable({
    tbody: tableBody,
    searchInput,

    getRows: getMemberRows,
    renderRow: renderMemberRow,

    onRender(rows) {
      const hasResults = rows.length > 0;

      if (tableContainer) {
        tableContainer.hidden = !hasResults;
      }

      if (emptyState) {
        emptyState.hidden = hasResults;
      }
    },

    debounceMs: 300,
  });
}

function updateStatistics() {
  const countByRole = (role) =>
    people.filter((person) => getSafeRole(person.role) === role).length;

  if (statTotal) statTotal.textContent = people.length;
  if (statMembers) statMembers.textContent = countByRole("member");
  if (statStaff) {
    statStaff.textContent = countByRole("admin") + countByRole("manager");
  }
  if (statInactive) {
    statInactive.textContent = people.filter(
      (person) => getSafeStatus(person.status) === "inactive",
    ).length;
  }
}

function clearFilters() {
  if (searchInput) searchInput.value = "";
  if (roleFilter) roleFilter.value = "all";
  if (statusFilter) statusFilter.value = "all";

  membersTable.refresh();
}

function resetFormErrors() {
  [nameInput, emailInput].forEach((input) => {
    input?.removeAttribute("aria-invalid");
  });
}

function openCreateDialog() {
  editingId = null;
  memberForm.reset();
  resetFormErrors();

  memberDialogTitle.textContent = "Add member";
  statusSelect.value = "active";

  memberDialog.showModal();
  nameInput.focus();
}

function openEditDialog(personId) {
  const person = people.find((item) => item.id === personId);

  if (!person) {
    showToast("Person not found.", "error");
    return;
  }

  editingId = person.id;
  resetFormErrors();

  memberDialogTitle.textContent = "Edit person";
  nameInput.value = person.name ?? "";
  emailInput.value = person.email ?? "";
  phoneInput.value = person.phone ?? "";
  statusSelect.value = getSafeStatus(person.status);

  memberDialog.showModal();
  nameInput.focus();
}

function validateForm() {
  resetFormErrors();

  const name = nameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();
  const phone = phoneInput.value.trim();
  const status = getSafeStatus(statusSelect.value);

  if (name.length < 2) {
    nameInput.setAttribute("aria-invalid", "true");
    nameInput.focus();
    showToast("Please enter the full name.", "error");
    return null;
  }

  if (!isValidEmail(email)) {
    emailInput.setAttribute("aria-invalid", "true");
    emailInput.focus();
    showToast("Please enter a valid email address.", "error");
    return null;
  }

  const emailTaken = people.some(
    (person) =>
      person.id !== editingId &&
      String(person.email ?? "").toLowerCase() === email,
  );

  if (emailTaken) {
    emailInput.setAttribute("aria-invalid", "true");
    emailInput.focus();
    showToast("A person with this email already exists.", "error");
    return null;
  }

  return { name, email, phone, status };
}

async function saveMember(event) {
  event.preventDefault();

  const values = validateForm();

  if (!values) {
    return;
  }

  saveMemberButton.disabled = true;
  saveMemberButton.textContent = "Saving...";

  try {
    if (editingId) {
      await updateDoc(doc(db, "users", editingId), {
        ...values,
        updatedAt: serverTimestamp(),
      });

      showToast("Changes saved.");
    } else {
      await addDoc(collection(db, "users"), {
        ...values,
        role: "member",
        authUid: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showToast("Member added.");
    }

    memberDialog.close();
  } catch (error) {
    console.error("Error saving member:", error);
    showToast(
      getErrorMessage(error, "Could not save. Please try again."),
      "error",
    );
  } finally {
    saveMemberButton.disabled = false;
    saveMemberButton.textContent = "Save";
  }
}

function openDeleteDialog(personId) {
  const person = people.find((item) => item.id === personId);

  if (!person) {
    showToast("Person not found.", "error");
    return;
  }

  deletingId = person.id;
  deleteMessage.textContent = `Delete ${person.name ?? "this person"}? This cannot be undone.`;
  deleteDialog.showModal();
}

async function deleteMember() {
  if (!deletingId) {
    return;
  }

  if (!isAdmin(currentStaff)) {
    showToast("Only administrators can delete people.", "error");
    return;
  }

  confirmDeleteButton.disabled = true;
  confirmDeleteButton.textContent = "Deleting...";

  try {
    await deleteDoc(doc(db, "users", deletingId));

    deleteDialog.close();
    showToast("Member deleted.");
  } catch (error) {
    console.error("Error deleting member:", error);
    showToast(
      getErrorMessage(error, "Could not delete. Please try again."),
      "error",
    );
  } finally {
    deletingId = null;
    confirmDeleteButton.disabled = false;
    confirmDeleteButton.textContent = "Delete";
  }
}

roleFilter?.addEventListener("change", () => {
  membersTable.refresh();
});

statusFilter?.addEventListener("change", () => {
  membersTable.refresh();
});

clearFiltersButton?.addEventListener("click", clearFilters);
emptyClearFiltersButton?.addEventListener("click", clearFilters);

addMemberButton?.addEventListener("click", openCreateDialog);
memberForm?.addEventListener("submit", saveMember);

closeMemberDialogButton?.addEventListener("click", () => memberDialog.close());
cancelMemberButton?.addEventListener("click", () => memberDialog.close());
cancelDeleteButton?.addEventListener("click", () => deleteDialog.close());
confirmDeleteButton?.addEventListener("click", deleteMember);

memberDialog?.addEventListener("click", (event) => {
  if (event.target === memberDialog) {
    memberDialog.close();
  }
});

deleteDialog?.addEventListener("click", (event) => {
  if (event.target === deleteDialog) {
    deleteDialog.close();
  }
});

tableBody?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-id]");
  const deleteButton = event.target.closest("[data-delete-id]");

  if (editButton) {
    openEditDialog(editButton.dataset.editId);
  }

  if (deleteButton) {
    openDeleteDialog(deleteButton.dataset.deleteId);
  }
});

async function initMembersPage() {
  currentStaff = await requireRole(["admin"]);

  if (!currentStaff) return;

  if (currentUserLabel) {
    currentUserLabel.textContent = `${currentStaff.name} · ${ROLE_LABELS[currentStaff.role] ?? currentStaff.role}`;
  }

  initMembersTable();
  subscribeToPeople();
}

initMembersPage();
