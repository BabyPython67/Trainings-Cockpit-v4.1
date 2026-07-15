if (typeof window.React === "undefined" || typeof window.ReactDOM === "undefined") { window.__failMsg && window.__failMsg("Ein Baustein (React) wurde nicht geladen."); throw new Error("React missing"); }
module.exports = window.React;
