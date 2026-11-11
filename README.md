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

## Static release assets

Production HTML links to content-hashed copies of `project-view.js`, `index.js`
and `index.css`. The original filenames remain editable sources. After changing
any of them, run:

```sh
python3 scripts/build_assets.py
python3 scripts/build_assets.py --check
python3 -m unittest discover -s tests -p test_assets.py
```

Commit the updated HTML and generated assets together. Keep previously generated
hashed assets so cached HTML from an earlier release can still load its matching
code. CI rejects stale HTML references, missing generated files and changed bytes.

This prevents the production failure where fresh HTML without search controls
loaded a cached old `index.js` and threw while registering the removed search
button. The CDN advertises a longer cache lifetime for JS/CSS than HTML, so
successful deployment and fresh HTTP fetches alone cannot prove returning-user
browser behavior. Verify the actual production page after deployment too.
