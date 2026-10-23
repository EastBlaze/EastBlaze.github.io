(() => {
  "use strict";

  const TERMS = {
    backend: { label: "백엔드", words: ["백엔드", "서버 개발", "서버", "backend", "back-end", "api", "rest api"] },
    frontend: { label: "프론트엔드", words: ["프론트엔드", "프런트엔드", "frontend", "front-end", "ui 개발", "웹 프론트"] },
    visualization: { label: "데이터 시각화", words: ["시각화", "대시보드", "그래프", "차트", "visualization", "dashboard", "chart"] },
    ai: { label: "AI 응용", words: ["인공지능", "ai", "딥러닝", "머신러닝", "machine learning", "deep learning", "ml", "llm"] },
    operations: { label: "인프라·운영", words: ["인프라", "devops", "sre", "운영 최적화", "운영 자동화", "infrastructure"] },
    mobile: { label: "모바일 앱", words: ["모바일", "mobile", "크로스플랫폼", "앱 개발"] },
    data: { label: "데이터 처리", words: ["데이터 처리", "데이터 파이프라인", "데이터 설계", "data processing", "data pipeline"] },
    database: { label: "DB 설계", words: ["데이터베이스", "database", "db 설계", "db modeling", "sql", "db"] },
    media: { label: "미디어", words: ["미디어", "방송", "media", "영상 서비스"] },
    video: { label: "영상 처리", words: ["영상 처리", "동영상", "video", "영상 분석"] },
    pipeline: { label: "파이프라인", words: ["파이프라인", "pipeline"] },
    search: { label: "검색", words: ["검색", "search", "retrieval"] },
    nlp: { label: "자연어 처리", words: ["자연어", "nlp", "natural language"] },
    vision: { label: "이미지 인식", words: ["이미지 인식", "컴퓨터 비전", "computer vision", "opencv"] },
    performance: { label: "성능 개선", words: ["병목", "성능 최적화", "성능 개선", "performance", "latency", "throughput"] },
    cost: { label: "비용 최적화", words: ["비용 절감", "비용 최적화", "cost optimization", "cost reduction"] },
    cloud: { label: "클라우드", words: ["클라우드", "cloud", "gcp", "google cloud"] },
    aws: { label: "AWS", words: ["aws", "amazon web services"] },
    vue: { label: "Vue.js", words: ["vue", "vue.js", "vuejs"] },
    quasar: { label: "Quasar", words: ["quasar"] },
    d3: { label: "D3.js", words: ["d3", "d3.js", "d3js"] },
    pwa: { label: "PWA", words: ["pwa", "progressive web app"] },
    flutter: { label: "Flutter", words: ["flutter"] },
    ios: { label: "iOS", words: ["ios"] },
    android: { label: "Android", words: ["android"] },
    firebase: { label: "Firebase", words: ["firebase"] },
    node: { label: "Node.js", words: ["node.js", "nodejs", "node"] },
    python: { label: "Python", words: ["python", "파이썬"] },
    queue: { label: "작업 큐", words: ["메시지 큐", "작업 큐", "job queue", "message queue", "zmq", "zeromq"] },
    automation: { label: "자동화", words: ["자동화", "automation", "정산 자동화"] }
  };
  const ROLE_LABELS = {
    all: "전체", backend: "백엔드", frontend: "프론트엔드·시각화",
    ai: "AI 응용", operations: "인프라·최적화", mobile: "모바일"
  };
  const ROLE_KEYS = {
    all: [], backend: ["backend"], frontend: ["frontend", "visualization"],
    ai: ["ai", "vision", "nlp"], operations: ["operations", "cloud", "performance", "cost"],
    mobile: ["mobile", "flutter", "ios", "android"]
  };
  const state = { focus: "all", needs: [], projects: [] };
  const $ = (selector) => document.querySelector(selector);
  const all = (selector) => Array.from(document.querySelectorAll(selector));

  function matchesWord(source, word) {
    const value = source.toLowerCase();
    const term = word.toLowerCase();
    const at = value.indexOf(term);
    if (at < 0) return false;
    if (!/^[a-z0-9 .+-]+$/.test(term)) return true;
    let index = at;
    while (index !== -1) {
      const before = index === 0 ? "" : value[index - 1];
      const after = value[index + term.length] || "";
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
      index = value.indexOf(term, index + 1);
    }
    return false;
  }

  function extractNeeds(text) {
    const clean = text.trim().toLowerCase();
    return Object.keys(TERMS).filter((key) => TERMS[key].words.some((word) => matchesWord(clean, word)));
  }

  function evidencesFor(project, keys) {
    return project.evidence.filter((entry) => keys.some((key) => entry.keys.includes(key)));
  }

  function roleMatch(project) {
    return ROLE_KEYS[state.focus].some((key) =>
      project.facets.includes(key) || evidencesFor(project, [key]).length > 0);
  }

  function rank(project) {
    const matchedNeedKeys = state.needs.filter((key) => evidencesFor(project, [key]).length > 0);
    const role = roleMatch(project);
    return {
      project,
      role,
      matchedNeedKeys,
      matchedEvidence: evidencesFor(project, matchedNeedKeys),
      score: matchedNeedKeys.length * 10 + (role ? 5 : 0)
    };
  }

  function element(tag, className, content) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (content !== undefined) el.textContent = content;
    return el;
  }

  function createCard(result, index) {
    const project = result.project;
    const card = element("article", "project-card" + (result.score > 0 ? " featured" : ""));
    const top = element("div", "project-topline");
    top.append(element("span", "project-index", String(index + 1).padStart(2, "0") + " / PROJECT"));
    if (state.needs.length && result.matchedNeedKeys.length) {
      top.append(element("span", "project-label", "요구사항 일치 " + result.matchedNeedKeys.length + "개"));
    } else if (result.role) {
      top.append(element("span", "project-label", "선택 분야 관련"));
    }
    card.append(top, element("h3", "", project.title), element("p", "", project.subtitle));

    const tags = element("div", "tag-list");
    project.tags.forEach((tag) => tags.append(element("span", "tag", tag)));
    card.append(tags);

    const relevant = result.matchedEvidence.length ? result.matchedEvidence :
      (result.role ? evidencesFor(project, ROLE_KEYS[state.focus]) : []);
    if (relevant.length) {
      const reasons = element("div", "match-reasons");
      reasons.append(element("strong", "", result.matchedEvidence.length ? "요구사항과 연결되는 구현 근거" : "선택 분야와 연결되는 구현 근거"));
      const list = element("ul");
      relevant.forEach((entry) => list.append(element("li", "", entry.text)));
      reasons.append(list);
      card.append(reasons);
    }

    const details = element("details");
    const summary = element("summary", "", "프로젝트의 전체 구현 내용 보기");
    const descList = element("dl");
    project.evidence.forEach((entry) => {
      descList.append(element("dt", "", entry.label), element("dd", "", entry.text));
    });
    details.append(summary, descList);
    card.append(details);
    return card;
  }

  function render() {
    const ranked = state.projects.map(rank).sort((a, b) => b.score - a.score);
    const list = $("#project-list");
    const fragment = document.createDocumentFragment();
    ranked.forEach((result, index) => fragment.append(createCard(result, index)));
    list.replaceChildren(fragment);

    const count = ranked.filter((result) => result.score > 0).length;
    $("#project-summary").textContent = !state.needs.length && state.focus === "all"
      ? "기존 이력서의 프로젝트 5개를 모두 보여드립니다."
      : "전체 " + ranked.length + "개 중 관련 경험 " + count + "개를 우선 배치했습니다. 모든 프로젝트를 계속 볼 수 있습니다.";

    all("[data-focus]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.focus === state.focus));
    });

    const requirementBox = $("#requirements");
    requirementBox.replaceChildren();
    state.needs.forEach((key) => requirementBox.append(element("span", "requirement", TERMS[key].label)));
    requirementBox.hidden = state.needs.length === 0;
  }

  function analysisText() {
    if (!state.needs.length) {
      return state.focus === "all"
        ? "관심 분야를 선택하거나 채용 공고를 입력해 보세요."
        : ROLE_LABELS[state.focus] + " 관련 경험을 위쪽에 배치했습니다.";
    }
    const missing = state.needs.filter((key) =>
      !state.projects.some((project) => evidencesFor(project, [key]).length > 0));
    const found = state.needs.length - missing.length;
    let message = "요구사항 " + state.needs.length + "개 항목을 추출했고, 현재 기록에서 " + found + "개 항목의 구현 근거를 찾았습니다.";
    if (missing.length) {
      message += " 확인된 근거가 없는 항목: " + missing.map((key) => TERMS[key].label).join(", ") + ".";
    }
    return message;
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete("focus");
    url.searchParams.delete("needs");
    if (state.focus !== "all") url.searchParams.set("focus", state.focus);
    if (state.needs.length) url.searchParams.set("needs", state.needs.join(","));
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function setFocus(focus) {
    if (!Object.prototype.hasOwnProperty.call(ROLE_LABELS, focus)) return;
    state.focus = focus;
    render();
    $("#analysis-status").textContent = analysisText();
    syncUrl();
  }

  function analyze() {
    const input = $("#job-description").value;
    state.needs = extractNeeds(input);
    render();
    $("#analysis-status").textContent = input.trim() && !state.needs.length
      ? "알려진 기술·업무 키워드를 찾지 못했습니다. 분야를 직접 선택하거나 기술명을 포함해 다시 입력해 주세요."
      : analysisText();
    syncUrl();
  }

  function restoreUrlState() {
    const params = new URLSearchParams(window.location.search);
    const focus = params.get("focus");
    if (focus && Object.prototype.hasOwnProperty.call(ROLE_LABELS, focus)) state.focus = focus;
    const received = (params.get("needs") || "").split(",");
    state.needs = Array.from(new Set(received.filter((key) => Object.prototype.hasOwnProperty.call(TERMS, key)))).slice(0, 30);
  }

  async function shareView() {
    const url = new URL(window.location.href);
    url.hash = "projects";
    try {
      await navigator.clipboard.writeText(url.toString());
      $("#analysis-status").textContent = "현재 보기 링크를 복사했습니다. 채용 공고 원문은 포함되지 않습니다.";
    } catch (error) {
      window.prompt("아래 링크를 복사해 공유하세요.", url.toString());
    }
  }

  async function initialize() {
    restoreUrlState();
    all("[data-focus]").forEach((button) => button.addEventListener("click", () => setFocus(button.dataset.focus)));
    $("#analyze-job").addEventListener("click", analyze);
    $("#clear-job").addEventListener("click", () => {
      $("#job-description").value = "";
      state.needs = [];
      render();
      $("#analysis-status").textContent = analysisText();
      syncUrl();
    });
    $("#share-view").addEventListener("click", shareView);
    $("#scroll-to-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    const onScroll = () => $("#scroll-to-top").classList.toggle("visible", window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    try {
      const response = await fetch("./projects.json");
      if (!response.ok) throw new Error("HTTP " + response.status);
      const payload = await response.json();
      if (!Array.isArray(payload.projects)) throw new Error("잘못된 데이터 형식");
      state.projects = payload.projects;
      render();
      $("#analysis-status").textContent = analysisText();
    } catch (error) {
      $("#project-list").replaceChildren(element("p", "empty-state", "프로젝트를 불러오지 못했습니다. 페이지를 새로고침해 주세요."));
      $("#analysis-status").textContent = "프로젝트 데이터를 읽을 수 없어 분석 기능을 사용할 수 없습니다.";
      $("#analyze-job").disabled = true;
    }
  }

  initialize();
})();
