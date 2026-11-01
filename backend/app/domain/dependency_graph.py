"""Task dependency cycles (Kahn's algorithm) and completion gating."""

from __future__ import annotations

from collections import deque
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Protocol


class DependentLike(Protocol):
    @property
    def id(self) -> str: ...
    @property
    def status(self) -> str: ...
    @property
    def depends_on(self) -> Sequence[str]: ...


@dataclass(frozen=True)
class CycleResult:
    has_cycle: bool
    cycle_task_ids: list[str] = field(default_factory=list)


def detect_cycle(tasks: Sequence[DependentLike]) -> CycleResult:
    """Kahn's topological sort over `depends_on` edges to known task ids.

    When a cycle exists, `cycle_task_ids` lists every task that could not be ordered (members
    of a cycle and tasks blocked behind one), in input order. Mirrors detectTaskCycle in
    web/src/domain/timeline.ts, including counting a repeated dependency twice.
    """
    known = {t.id for t in tasks}
    in_degree: dict[str, int] = {t.id: 0 for t in tasks}
    dependents: dict[str, list[str]] = {t.id: [] for t in tasks}
    for t in tasks:
        deps = [d for d in t.depends_on if d in known]
        in_degree[t.id] = len(deps)
        for dep in deps:
            dependents[dep].append(t.id)

    queue = deque(tid for tid, deg in in_degree.items() if deg == 0)
    processed = 0
    while queue:
        current = queue.popleft()
        processed += 1
        for nxt in dependents[current]:
            in_degree[nxt] -= 1
            if in_degree[nxt] == 0:
                queue.append(nxt)

    if processed < len(tasks):
        return CycleResult(True, [t.id for t in tasks if in_degree.get(t.id, 0) > 0])
    return CycleResult(False)


@dataclass(frozen=True)
class CompletionGate:
    can_complete: bool
    blocking_task_ids: list[str]


def completion_gate(task: DependentLike, all_tasks: Sequence[DependentLike]) -> CompletionGate:
    """A task can be completed only when every task it depends on is done."""
    by_id = {t.id: t for t in all_tasks}
    blocking = [dep for dep in task.depends_on if dep in by_id and by_id[dep].status != "done"]
    return CompletionGate(not blocking, blocking)


def find_cycle_in_titles(edges: dict[str, list[str]]) -> set[str]:
    """Nodes that cannot be topologically ordered in a title -> [dependency titles] graph."""
    in_degree = {node: 0 for node in edges}
    dependents: dict[str, list[str]] = {node: [] for node in edges}
    for node, deps in edges.items():
        valid = [d for d in deps if d in edges]
        in_degree[node] = len(valid)
        for dep in valid:
            dependents[dep].append(node)
    queue = deque(n for n, deg in in_degree.items() if deg == 0)
    while queue:
        current = queue.popleft()
        for nxt in dependents[current]:
            in_degree[nxt] -= 1
            if in_degree[nxt] == 0:
                queue.append(nxt)
    return {n for n, deg in in_degree.items() if deg > 0}
