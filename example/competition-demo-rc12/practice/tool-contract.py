"""Offline teaching example: one tool, synthetic data, no model/network/filesystem calls."""
import json


def search_reports(component, limit):
    return [{"id": "SYNTH-001", "component": component, "source": "synthetic"}][:limit]


REGISTRY = {"search_reports": search_reports}


def reject_constant(value):
    raise ValueError("non-standard number")


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate key")
        result[key] = value
    return result


def dispatch(raw, allowed_tools, remaining_calls):
    # Simple, bounded input for a one-level teaching protocol.
    if not isinstance(raw, str) or len(raw) > 4096:
        return {"ok": False, "reason": "input_size"}
    try:
        proposal = json.loads(raw, parse_constant=reject_constant, object_pairs_hook=unique_pairs)
    except (ValueError, RecursionError):
        return {"ok": False, "reason": "parse"}
    if type(proposal) is not dict or set(proposal) != {"tool", "arguments"}:
        return {"ok": False, "reason": "shape"}
    tool, args = proposal["tool"], proposal["arguments"]
    if type(tool) is not str or tool not in REGISTRY:
        return {"ok": False, "reason": "unknown_tool"}
    if tool not in allowed_tools:
        return {"ok": False, "reason": "permission"}
    if type(remaining_calls) is not int or remaining_calls <= 0:
        return {"ok": False, "reason": "budget"}
    if type(args) is not dict or set(args) != {"component", "limit"}:
        return {"ok": False, "reason": "arguments"}
    if args["component"] != "component-a" or type(args["limit"]) is not int or not 1 <= args["limit"] <= 3:
        return {"ok": False, "reason": "arguments"}
    # Only this line executes the pre-registered synthetic function.
    result = REGISTRY[tool](args["component"], args["limit"])
    return {"ok": True, "data": result, "remaining_calls": remaining_calls - 1}


if __name__ == "__main__":
    valid = '{"tool":"search_reports","arguments":{"component":"component-a","limit":2}}'
    print(dispatch(valid, {"search_reports"}, 1))
    print(dispatch(valid, set(), 1))
    print(dispatch(valid, {"search_reports"}, 0))
    print(dispatch(valid.replace('"limit":2', '"limit":true'), {"search_reports"}, 1))
