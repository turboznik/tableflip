// Sets the theme before the page is drawn, so dark mode doesn't flash white.
;(function () {
  var theme = null
  try {
    theme = localStorage.getItem("tableflip-theme")
  } catch (error) {
    // Storage can be blocked; fall back to the system setting.
  }
  var dark =
    theme === "dark" ||
    (theme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.add(dark ? "dark" : "light")
})()
