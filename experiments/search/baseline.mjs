// Execute only the pinned source's ranking definitions. Never import/modify the site UI.
export function baseline(source, browserWindow = { matchMedia: () => ({ matches: false }) }) {
  const marker = '  function element(';
  const boundary = source.indexOf(marker);
  if (!source.startsWith('(() => {') || boundary < 0 || source.indexOf(marker, boundary + marker.length) !== -1) {
    throw new Error('Unsupported baseline source layout; review the adapter before rerunning');
  }
  const prefix = source.slice(0, boundary).replace('(() => {', 'return (() => {');
  return new Function('window', 'document', prefix + `
    return (query, projects) => {
      state.needs = extractNeeds(query);
      state.projects = projects;
      return {
        needs: [...state.needs],
        ranking: projects.map(rank).sort((a, b) =>
          b.matchedTechnologyKeys.length - a.matchedTechnologyKeys.length || b.score - a.score
        ).map(r => ({ id: r.project.id, score: r.score,
          matchedTechnologyKeys: r.matchedTechnologyKeys, relatedNeedKeys: r.relatedNeedKeys })),
      };
    };
  })();`)(browserWindow, {});
}
