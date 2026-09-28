import unittest

from core import AgentRuntime, AllowListPolicy, Decision, ScriptedModel
from sources import FixtureSource, normalize_cve


class RuntimeTests(unittest.TestCase):
    def test_normalize_cve(self):
        self.assertEqual(normalize_cve(" cve-2099-0001 "), "CVE-2099-0001")

    def test_invalid_cve_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "INVALID_CVE"):
            normalize_cve("CVE-99-1")

    def test_read_only_tool_then_final(self):
        source = FixtureSource()
        model = ScriptedModel(
            [
                Decision("tool", "lookup_fixture", {"cve": "CVE-2099-0001"}),
                Decision("final", answer="done"),
            ]
        )
        runtime = AgentRuntime(
            model,
            {"lookup_fixture": lambda cve: source.lookup(cve).evidence_id},
            AllowListPolicy({"lookup_fixture"}),
        )
        self.assertEqual(runtime.run("lookup"), "done")

    def test_policy_denies_unapproved_tool(self):
        model = ScriptedModel([Decision("tool", "send_report", {"target": "x"})])
        runtime = AgentRuntime(
            model,
            {"send_report": lambda target: target},
            AllowListPolicy(set()),
        )
        with self.assertRaisesRegex(PermissionError, "POLICY_DENIED"):
            runtime.run("send")

    def test_step_budget_stops_loop(self):
        model = ScriptedModel(
            [
                Decision("tool", "lookup", {"cve": "CVE-2099-0001"}),
                Decision("tool", "lookup", {"cve": "CVE-2099-0001"}),
            ]
        )
        runtime = AgentRuntime(
            model,
            {"lookup": lambda cve: cve},
            AllowListPolicy({"lookup"}),
            max_steps=1,
        )
        with self.assertRaisesRegex(RuntimeError, "STEP_BUDGET_EXCEEDED"):
            runtime.run("loop")


if __name__ == "__main__":
    unittest.main()
