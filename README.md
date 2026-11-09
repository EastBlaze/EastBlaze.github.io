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
