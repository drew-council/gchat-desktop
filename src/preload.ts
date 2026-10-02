// Runs in every Chat window before the page's own scripts, in an isolated
// JavaScript world that still shares the page's DOM. Keybind and behavior
// patches go here; styling patches go in patches.css.
//
// For example, a capture-phase listener sees keys before Chat does:
//
//   window.addEventListener("keydown", (event) => { ... }, { capture: true });
