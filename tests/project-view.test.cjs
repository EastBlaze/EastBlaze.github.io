const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { isFocus, readFocus, focusUrl, rankProjects } = require('../project-view.js');
const projects = require('../projects.json').projects;
const ids = results => results.map(result => result.project.id);

test('focus URL ignores retired needs, rejects unknown roles and preserves unrelated state', () => {
  for (const focus of ['all', 'backend', 'frontend', 'ai', 'operations', 'mobile']) {
    assert.equal(isFocus(focus), true);
    const url = focusUrl('https://eastblaze.dev/?needs=aws&needs=vue&utm_source=test#projects', focus);
    assert.equal(readFocus(url), focus);
    assert.equal(new URL(url).searchParams.has('needs'), false);
    assert.equal(new URL(url).searchParams.get('utm_source'), 'test');
    assert.equal(new URL(url).hash, '#projects');
    assert.equal(focusUrl(url, focus), url);
  }
  for (const invalid of ['', '__proto__', 'constructor', 'unknown', 'AI']) {
    assert.equal(readFocus(`https://eastblaze.dev/?focus=${invalid}&needs=aws`), 'all');
    assert.equal(new URL(focusUrl('https://eastblaze.dev/?focus=ai', invalid)).search, '');
  }
  assert.equal(readFocus('https://eastblaze.dev/?needs=aws'), 'all');
});

test('field ordering retains every project with stable related and unrelated groups', () => {
  const fixture = [
    { id: 'plain', facets: [], evidence: [{ keys: [], text: 'backend is only incidental prose' }] },
    { id: 'facet', facets: ['backend'], evidence: [] },
    { id: 'evidence', facets: [], evidence: [{ keys: ['backend'], text: 'Public backend work' }] },
    { id: 'other', facets: [], evidence: [] },
  ];
  const before = JSON.stringify(fixture);
  const ranked = rankProjects(fixture, 'backend');
  assert.deepEqual(ids(ranked), ['facet', 'evidence', 'plain', 'other']);
  assert.deepEqual(ranked.map(r => r.role), [true, true, false, false]);
  assert.deepEqual(ranked[1].evidence, fixture[2].evidence);
  assert.deepEqual(ids(rankProjects(fixture, 'all')), ['plain', 'facet', 'evidence', 'other']);
  assert.deepEqual(ids(rankProjects(fixture, '__proto__')), ['plain', 'facet', 'evidence', 'other']);
  assert.equal(JSON.stringify(fixture), before);
  assert.deepEqual(rankProjects([], 'ai'), []);
});

test('all six public field choices have independently specified stable orders', () => {
  const expected = {
    all: ['video-scoover', 'pig-management', 'solar-dashboard', 'social-app', 'activity-measurement'],
    backend: ['video-scoover', 'pig-management', 'social-app', 'activity-measurement', 'solar-dashboard'],
    frontend: ['solar-dashboard', 'social-app', 'video-scoover', 'pig-management', 'activity-measurement'],
    ai: ['video-scoover', 'activity-measurement', 'pig-management', 'solar-dashboard', 'social-app'],
    operations: ['pig-management', 'social-app', 'activity-measurement', 'video-scoover', 'solar-dashboard'],
    mobile: ['social-app', 'video-scoover', 'pig-management', 'solar-dashboard', 'activity-measurement'],
  };
  for (const [focus, order] of Object.entries(expected)) assert.deepEqual(ids(rankProjects(projects, focus)), order);
});

// A small boundary fake: real app code and ranking run unmodified, with no retired
// search elements. Geometry/focus appearance stay with the final browser smoke.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {};
    this.events = {}; this.className = ''; this.textContent = ''; this.disabled = true;
    this.classList = { toggle: (name, enabled) => {
      const values = new Set(this.className.split(' ').filter(Boolean));
      enabled ? values.add(name) : values.delete(name); this.className = [...values].join(' ');
    } };
  }
  append(...nodes) { for (const node of nodes) node.tagName === 'fragment' ? this.append(...node.children) : this.children.push(node); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  addEventListener(name, callback) { this.events[name] = callback; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() { this.focused = true; }
  scrollIntoView() { this.scrolledIntoView = true; }
}
function app({ href = 'https://eastblaze.dev/', response = { ok: true, json: async () => ({ projects }) } } = {}) {
  const root = new Element();
  const elements = Object.fromEntries(['project-list', 'ambient-stack', 'scroll-to-top'].map(id => [id, new Element()]));
  const logo = new Element('a'); logo.className = 'logo';
  const buttons = ['all', 'backend', 'frontend', 'ai', 'operations', 'mobile'].map(focus => {
    const button = new Element('button'); button.dataset.focus = focus;
    button.attributes['aria-pressed'] = String(focus === 'all'); return button;
  });
  const header = new Element('header'); header.className = 'site-header';
  header.append(logo);
  root.append(...Object.values(elements), header, ...buttons);
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  const all = selector => descendants(root).filter(node => selector === '[data-focus]'
    ? Boolean(node.dataset.focus) : node.className.split(' ').includes(selector.slice(1)));
  const document = {
    querySelector: selector => selector.startsWith('#') ? elements[selector.slice(1)] || descendants(root).find(node => node.id === selector.slice(1)) || null : all(selector)[0] || null,
    querySelectorAll: all, createElement: tag => new Element(tag),
    createDocumentFragment: () => new Element('fragment'), createTextNode: text => Object.assign(new Element('text'), { textContent: text }),
  };
  const requests = [], windowEvents = [];
  const window = {
    location: new URL(href), history: { replaceState: (_, __, url) => { window.location = new URL(url); } },
    matchMedia: () => ({ matches: true, addEventListener() {} }), scrollY: 0,
    addEventListener: (event, callback) => { windowEvents[event] = callback; }, scrollTo() {},
    removeEventListener: (event, callback) => { if (windowEvents[event] === callback) delete windowEvents[event]; },
  };
  const context = { window, document, URL, console, fetch: async path => { requests.push(path); return response; } };
  runInNewContext(readFileSync(require.resolve('../project-view.js'), 'utf8'), context);
  runInNewContext(readFileSync(require.resolve('../index.js'), 'utf8'), context);
  return { window, elements, header, buttons, requests, windowEvents, ready: () => new Promise(resolve => setImmediate(resolve)),
    cardIds: () => elements['project-list'].children.map(card => card.dataset.projectId) };
}

test('full app initializes without search elements, clears legacy needs before data loads', async () => {
  let resolveData;
  const pending = new Promise(resolve => { resolveData = resolve; });
  const ui = app({ href: 'https://eastblaze.dev/?needs=aws&focus=frontend#projects', response: { ok: true, json: () => pending } });
  assert.equal(ui.window.location.search, '?focus=frontend');
  assert.ok(ui.buttons.every(button => button.disabled));
  resolveData({ projects }); await ui.ready();
  assert.deepEqual(ui.requests, ['./projects.json']);
  assert.ok(ui.buttons.every(button => !button.disabled));
  assert.equal(ui.cardIds()[0], 'solar-dashboard');
  assert.equal(ui.cardIds().length, 5);
  assert.equal(ui.buttons[2].attributes['aria-pressed'], 'true');
});

test('repeated field choices restore base order and popstate cannot revive search', async () => {
  const ui = app({ href: 'https://eastblaze.dev/?needs=aws' }); await ui.ready();
  assert.deepEqual(ui.cardIds(), projects.map(project => project.id));
  for (let i = 0; i < 2; i++) ui.buttons[5].events.click();
  assert.equal(ui.cardIds()[0], 'social-app');
  assert.equal(new Set(ui.cardIds()).size, 5);
  ui.buttons[0].events.click();
  assert.deepEqual(ui.cardIds(), projects.map(project => project.id));
  assert.equal(ui.window.location.search, '');
  ui.window.location = new URL('https://eastblaze.dev/?focus=ai&needs=aws');
  ui.windowEvents.popstate();
  assert.equal(ui.window.location.search, '?focus=ai');
  assert.equal(ui.cardIds()[1], 'activity-measurement');
  assert.equal(ui.buttons[3].attributes['aria-pressed'], 'true');
});

test('failed project loading leaves readable failure, disabled controls, and clean legacy URL', async () => {
  for (const response of [{ ok: false, status: 503 }, { ok: true, json: async () => ({ projects: null }) }]) {
    const ui = app({ href: 'https://eastblaze.dev/?needs=aws', response }); await ui.ready();
    assert.equal(ui.window.location.search, '');
    assert.ok(ui.buttons.every(button => button.disabled));
    assert.match(ui.elements['project-list'].children[0].textContent, /불러오지 못했습니다/);
  }
});

test('blueprint cards expose every original evidence text with stable accessible anchors', async () => {
  const ui = app(); await ui.ready();
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  for (const project of projects) {
    const card = ui.elements['project-list'].children.find(node => node.dataset.projectId === project.id);
    assert.equal(card.id, 'project-' + project.id);
    assert.equal(card.tabIndex, 0);
    assert.equal(card.attributes['aria-labelledby'], 'title-' + project.id);
    assert.equal(descendants(card).find(node => node.tagName === 'h3').id, 'title-' + project.id);
    assert.deepEqual(descendants(card).filter(node => node.tagName === 'dd').map(node => node.textContent), project.evidence.map(entry => entry.text));
    assert.equal(descendants(card).some(node => node.tagName === 'details'), false);
  }
  const rails = ui.elements['ambient-stack'].children;
  assert.equal(rails.length, 3);
  for (const rail of rails) {
    assert.equal(rail.className, 'ambient-rail');
    assert.equal(rail.children[0].children.length, 4);
  }
});


test('desktop project index preserves public order and is not duplicated by sorting', async () => {
  const ui = app(); await ui.ready();
  const index = ui.header.children.find(node => node.className === 'project-index-nav');
  assert.equal(index.attributes['aria-label'], '프로젝트 바로가기');
  assert.deepEqual(index.children.filter(node => node.tagName === 'a').map(node => [node.href, node.textContent]),
    projects.map(project => ['#project-' + project.id, project.title]));
  ui.buttons[5].events.click(); ui.buttons[0].events.click();
  assert.equal(ui.header.children.filter(node => node.className === 'project-index-nav').length, 1);
});


test('initial project fragments wait for data and never override newer navigation', async () => {
  for (const interaction of [null, 'pointerdown', 'keydown', 'wheel', 'touchstart', 'hashchange']) {
    let resolveData;
    const pending = new Promise(resolve => { resolveData = resolve; });
    const ui = app({ href: 'https://eastblaze.dev/#project-activity-measurement', response: { ok: true, json: () => pending } });
    if (interaction) ui.windowEvents[interaction]();
    resolveData({ projects }); await ui.ready();
    const target = ui.elements['project-list'].children.find(card => card.id === 'project-activity-measurement');
    assert.equal(Boolean(target.scrolledIntoView), interaction === null);
    assert.equal(target.focused, undefined);
    for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'hashchange']) assert.equal(ui.windowEvents[event], undefined);
  }
});
