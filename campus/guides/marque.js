// Crédit sous le pied de chaque page (hors couverture) : conception et
// développement José Kouadio, Markel Technology, avec son logo.
(() => {
  const logo = new URL("markel-technology.png", document.currentScript.src).href;
  for (const page of document.querySelectorAll(".page:not(.couverture)")) {
    if (!page.querySelector(".pied")) continue;
    const credit = document.createElement("div");
    credit.className = "credit-page";
    credit.innerHTML = `<img src="${logo}" alt="Markel Technology"><span>Conçu et développé par <b>José Kouadio</b> · <b>Markel Technology</b></span>`;
    page.appendChild(credit);
  }
})();
