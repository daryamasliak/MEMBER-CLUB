let timeoutId = null;

export function showToast(message, type = "success") {
  const toast = document.querySelector("#toast");
  const dialog = document.querySelector("#application-dialog");

  if (!toast) {
    console.log(message);
    return;
  }

  clearTimeout(timeoutId);

  toast.textContent = message;
  toast.className = `toast toast--${type}`;
  toast.hidden = false;

  if (type === "error" && dialog?.open) {
    dialog.prepend(toast);

    dialog.addEventListener(
      "close",
      () => {
        document.body.append(toast);
      },
      { once: true },
    );
  } else if (toast.parentElement !== document.body) {
    document.body.append(toast);
  }

  timeoutId = setTimeout(() => {
    toast.hidden = true;

    if (toast.parentElement !== document.body) {
      document.body.append(toast);
    }
  }, 5000);
}
