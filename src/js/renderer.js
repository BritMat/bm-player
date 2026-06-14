// Opens the custom context menu when right-clicking the app
window.addEventListener('contextmenu', (e) => {
  e.preventDefault(); 
  if (window.api && window.api.showContextMenu) {
    window.api.showContextMenu();
  }
});