from core import AgentRuntime, AllowListPolicy, Decision, ScriptedModel
from sources import FixtureSource, evidence_to_text


def main() -> None:
    source = FixtureSource()

    def lookup_fixture(cve: str) -> str:
        return evidence_to_text(source.lookup(cve))

    model = ScriptedModel(
        [
            Decision("tool", name="lookup_fixture", arguments={"cve": "CVE-2099-0001"}),
            Decision(
                "final",
                answer=(
                    "演示完成：已从本地合成夹具读取证据。"
                    "真实报告必须引用 evidence_id，并标记 synthetic=true。"
                ),
            ),
        ]
    )
    runtime = AgentRuntime(
        model,
        tools={"lookup_fixture": lookup_fixture},
        policy=AllowListPolicy({"lookup_fixture"}),
        max_steps=3,
    )
    print(runtime.run("查询合成 CVE-2099-0001；禁止访问网络。"))


if __name__ == "__main__":
    main()
