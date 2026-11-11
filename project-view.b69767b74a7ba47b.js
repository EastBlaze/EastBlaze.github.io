// Pure field ordering and URL state, shared by the browser and Node contract tests.
(() => {
  "use strict";
  const ROLE_KEYS = {
    all: [], backend: ["backend"], frontend: ["frontend", "visualization"],
    ai: ["ai", "vision", "nlp"], operations: ["operations", "cloud", "performance", "cost"],
    mobile: ["mobile", "flutter", "ios", "android"]
  };
  const isFocus = (focus) => Object.prototype.hasOwnProperty.call(ROLE_KEYS, focus);
  const readFocus = (href) => {
    const focus = new URL(href).searchParams.get("focus");
    return isFocus(focus) ? focus : "all";
  };
  const focusUrl = (href, focus) => {
    const url = new URL(href);
    url.searchParams.delete("focus");
    url.searchParams.delete("needs");
    if (isFocus(focus) && focus !== "all") url.searchParams.set("focus", focus);
    return url.href;
  };
  const rankProjects = (projects, focus) => {
    const keys = ROLE_KEYS[isFocus(focus) ? focus : "all"];
    // Only declared public facets and evidence keys establish field relevance.
    // Stable sorting preserves the original order within each group; no card is hidden.
    return projects.map((project) => {
      const evidence = project.evidence.filter((entry) => keys.some((key) => entry.keys.includes(key)));
      const role = evidence.length > 0 || keys.some((key) => project.facets.includes(key));
      return { project, role, evidence };
    }).sort((a, b) => Number(b.role) - Number(a.role));
  };
  const api = Object.freeze({ isFocus, readFocus, focusUrl, rankProjects });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.ResumeView = api;
})();
