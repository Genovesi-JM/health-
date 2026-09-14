"""Offline coverage tests for the constrained JSX route inventory."""
import importlib.util
from pathlib import Path
import re
import unittest


REPO = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("phase1_inventory", REPO / "scripts/kaya_phase1_inventory.py")
INVENTORY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INVENTORY)


class WebRouteInventoryTests(unittest.TestCase):
    def test_real_preserved_legacy_routes_match_existing_inventory(self):
        source = (REPO / "frontend/src/LegacyApp.tsx").read_text()
        old_literals = set(re.findall(r'<Route\s+path="([^"]+)"', source))
        self.assertGreater(len(old_literals), 60)
        self.assertEqual(INVENTORY.extract_web_routes(source), old_literals)

    def test_attribute_order_quotes_whitespace_and_comparison_operators(self):
        source = '''
            <Route element={<Page />} path='/first' />
            <Route\ncaseSensitive element={a > b ? <First /> : <Second />}\npath = "/second" />
            <Route index element={<Index />} />
            <Route path="*" element={<Missing />} />
        '''
        self.assertEqual(INVENTORY.extract_web_routes(source), {"/first", "/second", "*"})

    def test_nested_jsx_braces_strings_and_comments_do_not_truncate_tag(self):
        source = '''<Route element={<Page config={{end: ">", nested: {value: "}"}}}
                    child={<Child text=">" />} note={`value ${fn({key: ">"})}`} />}
                    path="/nested" />'''
        self.assertEqual(INVENTORY.extract_web_routes(source), {"/nested"})

    def test_route_inside_element_expression_is_inventoried(self):
        source = '<Route element={<Routes><Route path="/nested" /></Routes>} path="/outer" />'
        self.assertEqual(INVENTORY.extract_web_routes(source), {"/nested", "/outer"})

    def test_comments_strings_and_other_component_names_are_ignored(self):
        source = '''
            // <Route path="/comment" />
            {/* <Route path='/jsx-comment' /> */}
            const sample = '<Route path="/string" />';
            const template = `<Route path="/template" />`;
            <Router path="/router" /><RouteCard path="/card" />
            <Route element={<Real />} path="/real" />
        '''
        self.assertEqual(INVENTORY.extract_web_routes(source), {"/real"})

    def test_html_character_references_match_jsx_literal_value(self):
        self.assertEqual(INVENTORY.extract_web_routes('<Route path="/a&amp;b" />'), {"/a&b"})

    def test_dynamic_and_spread_routes_fail_closed(self):
        sources = [
            '<Route path={ROUTE} element={<Page />} />',
            '<Route element={<Page />} path={"/literal-expression"} />',
            '<Route {...props} path="/literal" />',
            '<Route path="/literal" {...props} />',
            '<Route {...{ path: "/object" }} />',
            '<Route path="/first" path="/second" />',
            '<Route path />', '<Route path=unquoted />', '<Route path="relative" />',
        ]
        for source in sources:
            with self.subTest(source=source), self.assertRaises(INVENTORY.InventoryError):
                INVENTORY.extract_web_routes(source)

    def test_unterminated_syntax_fails_closed(self):
        for source in ['<Route path="/x', '<Route element={<Page />', '<Route path="/x"', '/* unfinished']:
            with self.subTest(source=source), self.assertRaises(INVENTORY.InventoryError):
                INVENTORY.extract_web_routes(source)


if __name__ == "__main__":
    unittest.main()
