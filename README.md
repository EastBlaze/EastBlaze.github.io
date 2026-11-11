# eastblaze.github.io
main page for eastblaze

## Public Markdown resume

The navigation's **For AI · Markdown 이력서** link serves `/resume.md` as a
static text file. It contains only information already published in the resume.

`index.html` remains the source for the introduction, skills, technology groups,
and contact links; `projects.json` remains the source for project content.
After editing either source (or `CNAME`), regenerate the checked-in Markdown:

```sh
python3 scripts/generate_resume.py
python3 scripts/generate_resume.py --check
```

Do not edit `resume.md` directly. The **Resume Markdown** CI check detects drift.
Python's standard library is sufficient; the site itself needs no runtime build
or JavaScript to serve this file. `.nojekyll` keeps GitHub Pages from converting
Markdown to HTML.

## Testing approach

See [TESTING.md](TESTING.md) for the production UI and isolated search experiment
contracts, code-first checks, MacMini testbed, remaining browser checks, and
independent retrieval-quality gates. A passing experiment is not approval to
change the public resume or deploy semantic search.

## Current project browsing

The public page temporarily omits job-description search and result summaries.
Field buttons move related projects first and keep every project visible.
The default-order button restores the original order. Only `focus` is restored
from links. Retired `needs` parameters are ignored and removed on initialization,
field changes and history navigation, including when loading projects fails.

Run `node --test tests/*.test.cjs` for field-ordering, URL and DOM initialization
contracts. Historical search code, measurements and provenance are preserved
byte-for-byte under `experiments/search/historical/pr8/`; see the experiment
[README](experiments/search/README.md) before reproducing or starting new work.
