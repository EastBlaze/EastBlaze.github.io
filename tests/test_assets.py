"""Deployment contracts: cached resources cannot cross release boundaries."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('build_assets', ROOT / 'scripts/build_assets.py')
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class AssetTests(unittest.TestCase):
    def fixture(self, root):
        (root / 'index.html').write_text('<link href="./index.css"><script src="./project-view.js" defer></script><script src="./index.js" defer></script><script src="./ui-controls.js" defer></script>')
        for name in assets.SOURCES:
            (root / name).write_bytes(('old ' + name).encode())

    def test_checked_in_deployment_links_and_bytes_match_current_sources(self):
        assets.build(ROOT, check=True)

    def test_new_html_cannot_reuse_cached_previous_script_or_css_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            old_names = assets.build(root)
            browser_cache = {name: (root / name).read_bytes() for name in old_names}
            for name in assets.SOURCES:
                (root / name).write_bytes(('new ' + name).encode())
            with self.assertRaises(ValueError):
                assets.build(root, check=True)
            new_names = assets.build(root)
            self.assertTrue(set(old_names).isdisjoint(new_names))
            html = (root / 'index.html').read_text()
            for name in new_names:
                self.assertIn('./' + name, html)
                received = browser_cache.get(name, (root / name).read_bytes())
                self.assertTrue(received.startswith(b'new '))
            for name in old_names:
                self.assertEqual((root / name).read_bytes(), browser_cache[name])
                self.assertNotIn('./' + name, html)
            assets.build(root, check=True)

    def test_missing_tampered_or_unversioned_assets_fail_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            with self.assertRaises(ValueError):
                assets.build(root, check=True)
            names = assets.build(root)
            (root / names[0]).write_bytes(b'tampered')
            with self.assertRaises(ValueError):
                assets.build(root, check=True)
            assets.build(root)
            (root / names[1]).unlink()
            with self.assertRaises(ValueError):
                assets.build(root, check=True)

    def test_output_is_deterministic_and_unrelated_links_are_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            page = root / 'index.html'
            page.write_text(page.read_text() + '<a href="./resume.md">Resume</a>')
            first = assets.build(root)
            html = page.read_text()
            self.assertEqual(assets.build(root), first)
            self.assertEqual(page.read_text(), html)
            self.assertIn('href="./resume.md"', html)


if __name__ == '__main__':
    unittest.main()
