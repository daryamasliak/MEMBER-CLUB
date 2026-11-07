export function createDataTable({
  tbody,
  searchInput,
  getRows,
  renderRow,
  onRender,
  debounceMs = 300,
}) {
  if (!tbody) {
    throw new Error("DataTable: tbody element is required.");
  }

  let data = [];
  let searchTimer = null;

  function render() {
    const searchTerm = searchInput?.value.trim().toLowerCase() ?? "";
    const rows = getRows(data, searchTerm);

    tbody.innerHTML = rows.map(renderRow).join("");

    onRender?.(rows);
  }

  function handleSearch() {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
      render();
    }, debounceMs);
  }

  searchInput?.addEventListener("input", handleSearch);

  return {
    setData(newData) {
      data = Array.isArray(newData) ? newData : [];
      render();
    },

    refresh() {
      clearTimeout(searchTimer);
      render();
    },

    destroy() {
      clearTimeout(searchTimer);
      searchInput?.removeEventListener("input", handleSearch);
    },
  };
}
