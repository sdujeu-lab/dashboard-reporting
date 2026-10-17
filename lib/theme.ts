// Script inline exécuté dans <head> avant le premier rendu : choix enregistré,
// sinon préférence du système. Évite le flash du mauvais thème.
export const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`
