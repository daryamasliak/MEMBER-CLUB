import { db } from "../firebase.js";

import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { showToast } from "../components/toast.js";
import { requireRole } from "../components/auth-guard.js";

import { createDataTable } from "../components/data-table.js";

let applicationsTable;

const tableBody = document.querySelector("#applications-table-body");
const tableContainer = document.querySelector("#applications-table-container");
const emptyState = document.querySelector("#applications-empty");

const searchInput = document.querySelector("#application-search");
const statusFilter = document.querySelector("#status-filter");
const typeFilter = document.querySelector("#type-filter");
const dateSort = document.querySelector("#date-sort");
const clearFiltersButton = document.querySelector("#clear-filters");
const emptyClearFiltersButton = document.querySelector("#empty-clear-filters");

const statTotal = document.querySelector("#stat-total");
const statNew = document.querySelector("#stat-new");
const statReviewing = document.querySelector("#stat-reviewing");
const statWaitlist = document.querySelector("#stat-waitlist");

const applicationDialog = document.querySelector("#application-dialog");
const closeDialogButton = document.querySelector("#close-application-dialog");
const applicationDetails = document.querySelector("#application-details");
const applicationStatusSelect = document.querySelector("#application-status");
const saveStatusButton = document.querySelector("#save-application-status");

const historyToggleButton = document.querySelector(
  "#toggle-application-history",
);
const applicationHistory = document.querySelector("#application-history");
const applicationHistoryList = document.querySelector(
  "#application-history-list",
);

let applications = [];
let selectedApplicationId = null;
let unsubscribeApplications = null;
let currentStaff = null;
let isHistoryVisible = false;

const STATUS_LABELS = {
  new: "New",
  reviewing: "Reviewing",
  approved: "Approved",
  waitlist: "Waitlist",
  rejected: "Rejected",
};

const TYPE_LABELS = {
  membership: "Membership",
  event: "Event",
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
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  const date = getDateValue(value);

  if (!date) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getSafeStatus(status) {
  return Object.hasOwn(STATUS_LABELS, status) ? status : "new";
}

function subscribeToApplications() {
  if (unsubscribeApplications) {
    unsubscribeApplications();
  }

  const applicationsRef = collection(db, "applications");

  unsubscribeApplications = onSnapshot(
    applicationsRef,
    (snapshot) => {
      applications = snapshot.docs.map((documentSnapshot) => ({
        ...documentSnapshot.data(),
        id: documentSnapshot.id,
      }));

      applicationsTable.setData(applications);
      updateStatistics();

      console.log(`Firebase: loaded ${applications.length} application(s).`);
    },
    (error) => {
      console.error("Error loading applications:", error);

      if (error.code === "permission-denied") {
        showToast(
          "Access denied. Check your Firestore rules and admin UID.",
          "error",
        );
      } else {
        showToast("Could not load applications. Check the console.", "error");
      }
    },
  );
}

function getStatusBadge(status) {
  const safeStatus = getSafeStatus(status);

  return `
    <span class="status-badge status-badge--${safeStatus}">
      ${STATUS_LABELS[safeStatus]}
    </span>
  `;
}

function getApplicationRows(data, searchTerm) {
  const selectedStatus = statusFilter?.value ?? "all";
  const selectedType = typeFilter?.value ?? "all";
  const selectedSort = dateSort?.value ?? "newest";

  const filtered = data.filter((application) => {
    const searchableText = [
      application.fullName,
      application.name,
      application.email,
      application.message,
      application.eventName,
    ]
      .map((value) => String(value ?? ""))
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchableText.includes(searchTerm);

    const matchesStatus =
      selectedStatus === "all" ||
      (application.status ?? "new") === selectedStatus;

    const matchesType =
      selectedType === "all" || application.type === selectedType;

    return matchesSearch && matchesStatus && matchesType;
  });

  filtered.sort((a, b) => {
    const dateA = getDateValue(a.createdAt)?.getTime() ?? 0;
    const dateB = getDateValue(b.createdAt)?.getTime() ?? 0;

    return selectedSort === "oldest" ? dateA - dateB : dateB - dateA;
  });

  return filtered;
}

function renderApplicationRow(application) {
  const name = application.fullName ?? application.name ?? "Unnamed applicant";

  const email = application.email ?? "No email";
  const type = TYPE_LABELS[application.type] ?? "Other";
  const status = getSafeStatus(application.status);

  return `
    <tr>
      <td>
        <div class="applicant-cell">
          <span class="applicant-avatar">
            ${escapeHTML(getInitials(name))}
          </span>
          <div class="applicant-info">
            <span class="applicant-name">
              ${escapeHTML(name)}
            </span>
            <span class="applicant-email">
              ${escapeHTML(email)}
            </span>
          </div>
        </div>
      </td>
      <td>${escapeHTML(type)}</td>
      <td>${escapeHTML(formatDate(application.createdAt))}</td>
      <td>${getStatusBadge(status)}</td>
      <td>
        <button
          class="button button--secondary button--small"
          type="button"
          data-review-id="${escapeHTML(application.id)}"
        >Review</button>
      </td>
    </tr>
  `;
}

function initApplicationsTable() {
  applicationsTable = createDataTable({
    tbody: tableBody,
    searchInput,

    getRows: getApplicationRows,
    renderRow: renderApplicationRow,

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
  const countByStatus = (status) =>
    applications.filter(
      (application) => (application.status ?? "new") === status,
    ).length;

  if (statTotal) {
    statTotal.textContent = applications.length;
  }

  if (statNew) {
    statNew.textContent = countByStatus("new");
  }

  if (statReviewing) {
    statReviewing.textContent = countByStatus("reviewing");
  }

  if (statWaitlist) {
    statWaitlist.textContent = countByStatus("waitlist");
  }
}

function openApplication(applicationId) {
  const application = applications.find((item) => item.id === applicationId);

  if (!application || !applicationDialog || !applicationDetails) {
    return;
  }

  selectedApplicationId = application.id;
  isHistoryVisible = false;

  if (applicationHistory) {
    applicationHistory.hidden = true;
  }

  if (historyToggleButton) {
    historyToggleButton.setAttribute("aria-expanded", "false");
  }

  if (applicationHistoryList) {
    applicationHistoryList.innerHTML = "";
  }

  const name = application.fullName ?? application.name ?? "Unnamed applicant";

  const email = application.email ?? "—";
  const type = TYPE_LABELS[application.type] ?? "Other";
  const message = application.message ?? "No message provided.";
  const eventName = application.eventName ?? "";
  const status = getSafeStatus(application.status);

  applicationDetails.innerHTML = `
    <div class="application-detail">
      <span class="application-detail__label">Full name</span>
      <p>${escapeHTML(name)}</p>
    </div>

    <div class="application-detail">
      <span class="application-detail__label">Email</span>
      <p>${escapeHTML(email)}</p>
    </div>

    <div class="application-detail">
      <span class="application-detail__label">Application type</span>
      <p>${escapeHTML(type)}</p>
    </div>

    ${
      eventName
        ? `
      <div class="application-detail">
        <span class="application-detail__label">Event</span>
        <p>${escapeHTML(eventName)}</p>
      </div>
    `
        : ""
    }

    <div class="application-detail">
      <span class="application-detail__label">Submitted</span>
      <p>${escapeHTML(formatDate(application.createdAt))}</p>
    </div>

    <div class="application-detail">
      <span class="application-detail__label">Message</span>
      <p>${escapeHTML(message).replace(/\n/g, "<br>")}</p>
    </div>
  `;

  if (applicationStatusSelect) {
    applicationStatusSelect.value = status;
  }

  applicationDialog.showModal();
}

async function loadApplicationHistory(applicationId) {
  if (!applicationHistoryList) return;

  applicationHistoryList.innerHTML = `
    <p class="history-message">Loading history...</p>
  `;

  try {
    const historyRef = collection(db, "applications", applicationId, "history");

    const historyQuery = query(historyRef, orderBy("changedAt", "desc"));

    const snapshot = await getDocs(historyQuery);

    if (selectedApplicationId !== applicationId) return;

    if (snapshot.empty) {
      applicationHistoryList.innerHTML = `
        <p class="history-message">
          No status changes recorded yet.
        </p>
      `;
      return;
    }

    applicationHistoryList.innerHTML = snapshot.docs
      .map((documentSnapshot) => {
        const entry = documentSnapshot.data();

        const fromStatus = getSafeStatus(entry.fromStatus);
        const toStatus = getSafeStatus(entry.toStatus);

        const staffName = escapeHTML(
          entry.changedByName ?? "Unknown staff member",
        );

        const staffRole = escapeHTML(entry.changedByRole ?? "Staff");

        return `
          <article class="history-item">
            <div class="history-item__marker"></div>

            <div class="history-item__content">
              <p class="history-item__transition">
                <span class="history-status history-status--${fromStatus}">
                  ${STATUS_LABELS[fromStatus]}
                </span>

                <span aria-hidden="true">→</span>

                <span class="history-status history-status--${toStatus}">
                  ${STATUS_LABELS[toStatus]}
                </span>
              </p>

              <p class="history-item__meta">
                ${staffName} · ${staffRole}
              </p>

              <time class="history-item__date">
                ${escapeHTML(formatDateTime(entry.changedAt))}
              </time>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading application history:", error);

    applicationHistoryList.innerHTML = `
      <p class="history-message history-message--error">
        Could not load application history.
      </p>
    `;

    showToast("Could not load application history.", "error");
  }
}

async function toggleApplicationHistory() {
  if (!selectedApplicationId || !applicationHistory) {
    return;
  }

  isHistoryVisible = !isHistoryVisible;

  applicationHistory.hidden = !isHistoryVisible;

  historyToggleButton?.setAttribute("aria-expanded", String(isHistoryVisible));

  if (isHistoryVisible) {
    await loadApplicationHistory(selectedApplicationId);
  }
}

async function updateApplicationStatus() {
  if (!selectedApplicationId || !applicationStatusSelect || !currentStaff) {
    return;
  }

  const newStatus = applicationStatusSelect.value;

  if (!Object.hasOwn(STATUS_LABELS, newStatus)) {
    showToast("Please select a valid status.", "error");
    return;
  }

  if (saveStatusButton) {
    saveStatusButton.disabled = true;
    saveStatusButton.textContent = "Saving...";
  }

  try {
    const applicationRef = doc(db, "applications", selectedApplicationId);

    const historyRef = doc(collection(applicationRef, "history"));

    const statusChanged = await runTransaction(db, async (transaction) => {
      const applicationSnapshot = await transaction.get(applicationRef);

      if (!applicationSnapshot.exists()) {
        throw new Error("Application not found.");
      }

      const previousStatus = applicationSnapshot.data().status ?? "new";

      if (previousStatus === newStatus) {
        return false;
      }

      transaction.update(applicationRef, {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      transaction.set(historyRef, {
        fromStatus: previousStatus,
        toStatus: newStatus,
        changedAt: serverTimestamp(),
        changedByUid: currentStaff.user.uid,
        changedByName: currentStaff.name,
        changedByRole: currentStaff.role,
      });

      return true;
    });

    applicationDialog?.close();

    if (statusChanged) {
      showToast("Application status updated.");
    } else {
      showToast("The application already has this status.");
    }
  } catch (error) {
    console.error("Error updating application:", error);

    showToast("Could not update status. Check Firestore permissions.", "error");
  } finally {
    if (saveStatusButton) {
      saveStatusButton.disabled = false;
      saveStatusButton.textContent = "Save changes";
    }
  }
}

function clearFilters() {
  if (searchInput) searchInput.value = "";
  if (statusFilter) statusFilter.value = "all";
  if (typeFilter) typeFilter.value = "all";
  if (dateSort) dateSort.value = "newest";

  applicationsTable.refresh();
}

statusFilter?.addEventListener("change", () => {
  applicationsTable.refresh();
});

typeFilter?.addEventListener("change", () => {
  applicationsTable.refresh();
});

dateSort?.addEventListener("change", () => {
  applicationsTable.refresh();
});

clearFiltersButton?.addEventListener("click", clearFilters);
emptyClearFiltersButton?.addEventListener("click", clearFilters);

tableBody?.addEventListener("click", (event) => {
  const reviewButton = event.target.closest("[data-review-id]");

  if (reviewButton) {
    openApplication(reviewButton.dataset.reviewId);
  }
});

saveStatusButton?.addEventListener("click", updateApplicationStatus);

historyToggleButton?.addEventListener("click", toggleApplicationHistory);

closeDialogButton?.addEventListener("click", () => {
  applicationDialog?.close();
});

applicationDialog?.addEventListener("click", (event) => {
  if (event.target === applicationDialog) {
    applicationDialog.close();
  }
});

async function initApplicationsPage() {
  const staff = await requireRole(["admin", "manager"]);

  if (!staff) return;

  currentStaff = staff;

  initApplicationsTable();
  subscribeToApplications();
}

initApplicationsPage();
