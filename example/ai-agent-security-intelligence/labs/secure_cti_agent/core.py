from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Iterable, Literal, Protocol


@dataclass(frozen=True)
class Decision:
    kind: Literal["tool", "final"]
    name: str | None = None
    arguments: dict[str, Any] | None = None
    answer: str | None = None


class Model(Protocol):
    def decide(self, transcript: list[dict[str, Any]]) -> Decision: ...


class Policy(Protocol):
    def authorize(self, tool_name: str, arguments: dict[str, Any]) -> None: ...


Tool = Callable[..., str]


class ScriptedModel:
    """Deterministic model substitute used for orchestration tests."""

    def __init__(self, decisions: Iterable[Decision]):
        self._decisions = iter(decisions)

    def decide(self, transcript: list[dict[str, Any]]) -> Decision:
        del transcript
        return next(self._decisions)


class AllowListPolicy:
    def __init__(self, allowed_tools: set[str]):
        self.allowed_tools = set(allowed_tools)

    def authorize(self, tool_name: str, arguments: dict[str, Any]) -> None:
        del arguments
        if tool_name not in self.allowed_tools:
            raise PermissionError(f"POLICY_DENIED: {tool_name}")


class AgentRuntime:
    """A deliberately small runtime: propose, validate, authorize, execute, observe."""

    def __init__(
        self,
        model: Model,
        tools: dict[str, Tool],
        policy: Policy,
        *,
        max_steps: int = 6,
    ):
        if max_steps < 1:
            raise ValueError("max_steps must be positive")
        self.model = model
        self.tools = dict(tools)
        self.policy = policy
        self.max_steps = max_steps

    def run(self, task: str) -> str:
        transcript: list[dict[str, Any]] = [{"role": "user", "content": task}]
        for _ in range(self.max_steps):
            decision = self.model.decide(transcript)
            if decision.kind == "final":
                return decision.answer or ""
            if decision.kind != "tool" or not decision.name:
                raise ValueError("INVALID_DECISION")
            if decision.name not in self.tools:
                raise ValueError("UNKNOWN_TOOL")
            arguments = decision.arguments or {}
            if not isinstance(arguments, dict):
                raise ValueError("INVALID_ARGUMENTS")
            self.policy.authorize(decision.name, arguments)
            observation = self.tools[decision.name](**arguments)
            transcript.append(
                {
                    "role": "tool",
                    "name": decision.name,
                    "content": observation,
                }
            )
        raise RuntimeError("STEP_BUDGET_EXCEEDED")
