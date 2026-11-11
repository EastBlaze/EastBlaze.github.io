(() => {
  "use strict";

  const { isFocus, readFocus, focusUrl, rankProjects } = window.ResumeView;
  const state = { focus: "all", projects: [], hoveredProjectId: null, focusedProjectId: null, visibleProjectId: null };
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const centerCandidates = new Set();
  let cardObserver = null;
  let mobileFrame = null;
  let lastHighlightedId = undefined;
  // Only technologies verified in the public resume are connected to project cards.
  const ICONS = {
    "JavaScript": "js", "Vue.js": "vue", "D3.js": "d3",
    "Node.js": "nodejs", "Elixir": "elixir", "Ruby on Rails": "rails",
    "PostgreSQL": "postgresql", "Google Cloud": "gcp",
    "AWS": "aws", "Flutter": "flutter", "Firebase": "firebase",
    "Python": "py"
  };
  const AMBIENT_ROWS = [
    ["js", "vue", "d3", "nodejs", "elixir", "rails", "postgresql", "gcp", "aws", "flutter", "firebase", "py"],
    ["aws", "python", "firebase", "flutter", "gcp", "postgresql", "rails", "elixir", "nodejs", "d3", "vue", "js"],
    ["d3", "js", "aws", "vue", "firebase", "py", "nodejs", "gcp", "flutter", "postgresql", "elixir", "rails"]
  ].map((row) => row.map((icon) => icon === "python" ? "py" : icon));

  const $ = (selector) => document.querySelector(selector);
  const all = (selector) => Array.from(document.querySelectorAll(selector));

  function element(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  }

  function renderAmbient() {
    const root = $("#ambient-stack");
    if (!root) return;
    const fragment = document.createDocumentFragment();
    for (const row of AMBIENT_ROWS) {
      const lane = element("div", "ambient-lane");
      for (let repeat = 0; repeat < 2; repeat++) {
        const sequence = element("div", "ambient-sequence");
        for (const icon of row) {
          const img = element("img", "ambient-icon");
          img.dataset.techIcon = icon;
          img.src = "https://skillicons.dev/icons?i=" + encodeURIComponent(icon);
          img.alt = "";
          img.loading = "lazy";
          img.decoding = "async";
          img.width = 66;
          img.height = 66;
          sequence.append(img);
        }
        lane.append(sequence);
      }
      fragment.append(lane);
    }
    root.replaceChildren(fragment);
    updateHighlights();
  }

  function activeProjectId() {
    // Pointer movement is transient; keyboard focus remains usable on all devices.
    if (finePointer.matches && state.hoveredProjectId) return state.hoveredProjectId;
    if (state.focusedProjectId && document.activeElement?.matches(":focus-visible")) return state.focusedProjectId;
    return finePointer.matches ? null : state.visibleProjectId;
  }

  function updateHighlights() {
    const id = activeProjectId();
    if (id === lastHighlightedId) return;
    lastHighlightedId = id;
    const project = state.projects.find((p) => p.id === id);
    const activeIcons = new Set((project?.technologies || []).map((name) => ICONS[name]).filter(Boolean));
    all(".ambient-icon").forEach((icon) => {
      icon.classList.toggle("is-active", activeIcons.has(icon.dataset.techIcon));
    });
    all(".project-card").forEach((card) => {
      card.classList.toggle("is-highlighted", card.dataset.projectId === id);
    });
  }

  function evaluateMobileCenter() {
    mobileFrame = null;
    if (finePointer.matches) return;
    const cards = [...centerCandidates];
    const centerY = window.innerHeight / 2;
    const top = window.innerHeight * 0.3;
    const bottom = window.innerHeight * 0.7;
    let winner = null;
    let winnerDistance = Infinity;
    let currentDistance = Infinity;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, top);
      const visibleBottom = Math.min(rect.bottom, bottom);
      if (visibleBottom <= visibleTop) continue;
      const distance = Math.abs((visibleTop + visibleBottom) / 2 - centerY);
      if (card.dataset.projectId === state.visibleProjectId) currentDistance = distance;
      if (distance < winnerDistance) {
        winner = card.dataset.projectId;
        winnerDistance = distance;
      }
    }
    // A small margin prevents rapid switching near the boundary of two cards.
    if (state.visibleProjectId && Number.isFinite(currentDistance) && currentDistance <= winnerDistance + 24) {
      winner = state.visibleProjectId;
    }
    if (winner !== state.visibleProjectId) {
      state.visibleProjectId = winner;
      updateHighlights();
    }
  }

  function scheduleMobileCenter() {
    if (finePointer.matches || mobileFrame !== null) return;
    mobileFrame = requestAnimationFrame(evaluateMobileCenter);
  }

  function observeProjectCards() {
    cardObserver?.disconnect();
    cardObserver = null;
    centerCandidates.clear();
    state.visibleProjectId = null;
    state.hoveredProjectId = null;
    lastHighlightedId = undefined;
    if (!finePointer.matches) {
      if ("IntersectionObserver" in window) {
        cardObserver = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) centerCandidates.add(entry.target);
            else centerCandidates.delete(entry.target);
          }
          scheduleMobileCenter();
        }, {
          rootMargin: "-30% 0px -30% 0px",
          threshold: [0, 0.25, 0.5, 0.75, 1]
        });
        all(".project-card").forEach((card) => cardObserver.observe(card));
      } else {
        // Older browsers can still use geometry-only highlighting on scroll.
        all(".project-card").forEach((card) => centerCandidates.add(card));
      }
      scheduleMobileCenter();
    }
    updateHighlights();
  }

  function createCard(result, index) {
    const project = result.project;
    const card = element("article", "project-card" + (result.role ? " featured" : ""));
    card.dataset.projectId = project.id;
    card.addEventListener("mouseenter", () => {
      if (!finePointer.matches) return;
      state.hoveredProjectId = project.id;
      updateHighlights();
    });
    card.addEventListener("mouseleave", () => {
      if (state.hoveredProjectId !== project.id) return;
      state.hoveredProjectId = null;
      updateHighlights();
    });
    card.addEventListener("focusin", () => {
      state.focusedProjectId = project.id;
      updateHighlights();
    });
    card.addEventListener("focusout", (event) => {
      if (card.contains(event.relatedTarget)) return;
      if (state.focusedProjectId === project.id) state.focusedProjectId = null;
      updateHighlights();
    });
    const top = element("div", "project-topline");
    top.append(element("span", "project-index", String(index + 1).padStart(2, "0") + " / PROJECT"));
    if (result.role) top.append(element("span", "project-label", "선택 분야 관련"));
    card.append(top, element("h3", "", project.title), element("p", "", project.subtitle));

    if (project.technologies?.length) {
      const tech = element("div", "project-tech");
      const strong = element("strong", "", "사용 기술 ");
      tech.append(strong, document.createTextNode(project.technologies.join(" · ")));
      card.append(tech);
    }

    const tags = element("div", "tag-list");
    project.tags.forEach((tag) => tags.append(element("span", "tag", tag)));
    card.append(tags);

    const relevant = result.evidence;
    if (relevant.length) {
      const reasons = element("div", "match-reasons");
      reasons.append(element("strong", "", "관련 작업"));
      const list = element("ul");
      relevant.forEach((entry) => list.append(element("li", "", entry.text)));
      reasons.append(list);
      card.append(reasons);
    }

    const details = element("details");
    const summary = element("summary", "", "자세히 보기");
    const descList = element("dl");
    project.evidence.forEach((entry) => {
      descList.append(element("dt", "", entry.label), element("dd", "", entry.text));
    });
    details.append(summary, descList);
    card.append(details);
    return card;
  }

  function render() {
    const ranked = rankProjects(state.projects, state.focus);
    const list = $("#project-list");
    const fragment = document.createDocumentFragment();
    ranked.forEach((result, index) => fragment.append(createCard(result, index)));
    list.replaceChildren(fragment);
    observeProjectCards();

    all("[data-focus]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.focus === state.focus));
    });
  }

  function syncUrl() {
    const url = focusUrl(window.location.href, state.focus);
    if (url !== window.location.href) window.history.replaceState(null, "", url);
  }

  function restoreUrlState() {
    state.focus = readFocus(window.location.href);
    // Retired search links must never apply hidden ranking conditions.
    syncUrl();
  }

  function setFocus(focus) {
    if (!isFocus(focus)) return;
    state.focus = focus;
    render();
    syncUrl();
  }

  async function initialize() {
    const projectControls = all("[data-focus]");
    restoreUrlState();
    all("[data-focus]").forEach((button) => button.addEventListener("click", () => setFocus(button.dataset.focus)));
    window.addEventListener("popstate", () => {
      restoreUrlState();
      if (state.projects.length) render();
    });
    const topButton = $("#scroll-to-top");
    topButton.addEventListener("click", () => {
      $(".logo").focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    });
    const onScroll = () => {
      const visible = window.scrollY > 400;
      if (!visible && document.activeElement === topButton) $(".logo").focus({ preventScroll: true });
      topButton.disabled = !visible;
      topButton.classList.toggle("visible", visible);
      scheduleMobileCenter();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", scheduleMobileCenter, { passive: true });
    const onPointerChange = () => observeProjectCards();
    if (finePointer.addEventListener) finePointer.addEventListener("change", onPointerChange);
    else finePointer.addListener(onPointerChange);
    onScroll();

    try {
      const response = await fetch("./projects.json");
      if (!response.ok) throw new Error("HTTP " + response.status);
      const payload = await response.json();
      if (!Array.isArray(payload.projects)) throw new Error("잘못된 데이터 형식");
      state.projects = payload.projects;
      renderAmbient();
      render();
      projectControls.forEach((control) => { control.disabled = false; });
    } catch (error) {
      $("#project-list").replaceChildren(element("p", "empty-state", "프로젝트를 불러오지 못했습니다. 페이지를 새로고침해 주세요."));
    }
  }

  initialize();
})();
