import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("apt", Path(__file__).with_name("playwright-ci-apt.py"))
apt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(apt)

MS = "https://packages.microsoft.com/ubuntu/24.04/prod"
UB = "http://archive.ubuntu.com/ubuntu"

class AptSourcesTests(unittest.TestCase):
    def test_list_preserves_other_sources_and_is_idempotent(self):
        other = f"deb {UB} noble main\ndeb https://packages.microsoft.com/repos/azure-cli noble main\n"
        line = f"deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft.gpg] {MS} noble main\n"
        result = apt.filter_list(other + line)
        self.assertEqual(result, other + "# Disabled for Playwright CI: " + line)
        self.assertEqual(apt.filter_list(result), result)

    def test_deb822_single_source(self):
        src = f"Types: deb\nURIs: {MS}\nSuites: noble\nSigned-By: /key.gpg\n"
        other = f"Types: deb\nURIs: {UB}\nSuites: noble\n"
        result = apt.filter_sources(src + "\n" + other)
        self.assertEqual(result, "Enabled: no\n" + src + "\n" + other)
        self.assertEqual(apt.filter_sources(result), result)

    def test_deb822_mixed_uris(self):
        src = f"Types: deb\nURIs: {MS}\n {UB}\nSuites: noble\nSigned-By: /key.gpg\n"
        self.assertEqual(apt.filter_sources(src), f"Types: deb\nURIs: {UB}\nSuites: noble\nSigned-By: /key.gpg\n")

    def test_existing_enabled_field(self):
        src = f"Types: deb\nEnabled: yes\nURIs: {MS}\nSuites: noble\n"
        self.assertEqual(apt.filter_sources(src), src.replace("Enabled: yes", "Enabled: no"))

    def test_unrelated_or_lookalike_feed(self):
        for uri in [UB, MS.replace("24.04", "22.04"), MS.replace(".com", ".com.example.org"), MS + "/other"]:
            self.assertFalse(apt.microsoft_feed(uri))

if __name__ == "__main__":
    unittest.main()
