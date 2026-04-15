#!/usr/bin/env bash

set -euo pipefail

AGENT_BIN="${AGENT_BIN:-agent}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${ROOT_DIR:-$SCRIPT_DIR}"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
OUT_DIR=""
FIRST_ONLY=0
PLAN_ONLY=0

changes=(
  "add-web-meeting-processing"
  "add-transcript-sharing-and-exports"
  "add-transcript-management"
)

usage() {
  cat <<EOF
Usage: $(basename "$0") [--first-only] [--plan-only] [--out-dir PATH]

Options:
  --first-only   Run only the first change in the list
  --plan-only    Generate and save plans, but skip the build step
  --out-dir      Write artifacts to the given directory
  -h, --help     Show this help text
EOF
}

make_plan_prompt() {
  local change="$1"

  printf '%s\n' \
    "read: openspec/scope-ranking-context-2026-04-15.md" \
    "how do you suggest to split ${change} ?" \
    "" \
    "Make a plan" \
    "- The very first todo must be to preserve a frozen copy of the original change under openspec/split-audit/ in order to check at the end that full scope was properly split and nothing was forgotten" \
    "- Use this plan as an example format for the plan you will create: .cursor/plans/split_bootstrap_change_7deb20d6.plan.md"
}

make_build_prompt() {
  local change="$1"

  printf '%s\n' \
    "Build the plan you just created for ${change}." \
    "Work in this workspace and carry out the plan." \
    "If you get blocked, explain the blocker clearly." \
    "When finished, print a concise summary of what changed."
}

run_plan_stream() {
  local change="$1"
  local plan_prompt="$2"
  local plan_stream_path="$3"

  "$AGENT_BIN" \
    -p \
    --trust \
    --output-format stream-json \
    --stream-partial-output \
    --model "gpt-5.4-xhigh-fast" \
    --plan \
    "$plan_prompt" | python3 -c "$(cat <<'PY'
import json
import pathlib
import shutil
import sys
import textwrap

stream_path = pathlib.Path(sys.argv[1])
change = sys.argv[2]
stream_path.parent.mkdir(parents=True, exist_ok=True)

TAIL_CHARS = 1000
thinking_tail = ""
preview_line_count = 0
stderr_is_tty = sys.stderr.isatty()
plan_request_accepted = False
plan_tool_completed = False
result_completed = False


def sanitize(text: str) -> str:
    return text.replace("\r", " ").replace("\n", " ")


def build_preview_lines(text: str) -> list[str]:
    prefix = f"[{change}] thinking: "
    snippet = text[-TAIL_CHARS:] if text else "..."

    if not stderr_is_tty:
        return [prefix + snippet]

    columns = shutil.get_terminal_size(fallback=(120, 24)).columns
    columns = max(columns, len(prefix) + 20)
    content_width = max(columns - len(prefix), 20)
    wrapped = textwrap.wrap(
        snippet,
        width=content_width,
        replace_whitespace=False,
        drop_whitespace=False,
    ) or ["..."]

    lines = [prefix + wrapped[0]]
    indent = " " * len(prefix)
    lines.extend(indent + part for part in wrapped[1:])
    return lines


def show_ephemeral(text: str) -> None:
    global preview_line_count

    if not stderr_is_tty:
        return

    lines = build_preview_lines(text)
    clear_ephemeral()

    for index, line in enumerate(lines):
        if index > 0:
            sys.stderr.write("\n")
        sys.stderr.write(line)
    sys.stderr.flush()
    preview_line_count = len(lines)


def clear_ephemeral() -> None:
    global preview_line_count

    if not stderr_is_tty or preview_line_count == 0:
        return

    for index in range(preview_line_count):
        sys.stderr.write("\r\033[2K")
        if index < preview_line_count - 1:
            sys.stderr.write("\033[1A")
    sys.stderr.flush()
    preview_line_count = 0


with stream_path.open("w", encoding="utf-8") as output:
    for raw_line in sys.stdin:
        output.write(raw_line)
        output.flush()

        line = raw_line.strip()
        if not line:
            continue

        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue

        event_type = payload.get("type")
        subtype = payload.get("subtype")

        if event_type == "thinking" and subtype == "delta":
            thinking_tail = (thinking_tail + sanitize(payload.get("text", "")))[-TAIL_CHARS:]
            show_ephemeral(thinking_tail)
            continue

        if event_type == "thinking" and subtype == "completed":
            clear_ephemeral()
            print(f"[{change}] thinking complete", file=sys.stderr, flush=True)
            continue

        if (
            event_type == "interaction_query"
            and subtype == "response"
            and payload.get("query_type") == "createPlanRequestQuery"
        ):
            response = payload.get("response", {}).get("createPlanRequestResponse", {}).get("result", {})
            if isinstance(response, dict) and "success" in response:
                plan_request_accepted = True
                clear_ephemeral()
                print(f"[{change}] plan accepted", file=sys.stderr, flush=True)
            continue

        if event_type == "tool_call" and subtype == "completed":
            tool_call = payload.get("tool_call", {})
            create_plan = tool_call.get("createPlanToolCall", {})
            args = create_plan.get("args", {})

            if isinstance(args, dict) and args.get("plan"):
                plan_tool_completed = True
                clear_ephemeral()
                print(f"[{change}] plan captured", file=sys.stderr, flush=True)
            continue

        if event_type == "result" and subtype == "success":
            result_completed = True
            duration_ms = payload.get("duration_ms")
            clear_ephemeral()
            if duration_ms is None:
                print(f"[{change}] stream complete", file=sys.stderr, flush=True)
            else:
                print(f"[{change}] stream complete ({duration_ms} ms)", file=sys.stderr, flush=True)

clear_ephemeral()

if not plan_request_accepted:
    print(f"[{change}] warning: no accepted createPlan response seen", file=sys.stderr, flush=True)

if not plan_tool_completed:
    print(f"[{change}] warning: no completed createPlan tool call seen", file=sys.stderr, flush=True)

if not result_completed:
    print(f"[{change}] warning: no final result event seen", file=sys.stderr, flush=True)
PY
)" "$plan_stream_path" "$change"
}

extract_plan_artifacts() {
  local change="$1"
  local plan_stream_path="$2"
  local run_dir="$3"

  python3 - "$change" "$plan_stream_path" "$run_dir" <<'PY'
import json
import pathlib
import sys

change = sys.argv[1]
stream_path = pathlib.Path(sys.argv[2])
run_dir = pathlib.Path(sys.argv[3])

session_id = None
plan_request_tool_call_id = None
plan_request_accepted = False
plan_tool_completed = False
plan_args = None
plan_text = None
result_text = None


def normalize_status(status):
    if not isinstance(status, str) or not status:
        return "pending"

    if status.startswith("TODO_STATUS_"):
        status = status[len("TODO_STATUS_"):]

    return status.lower()


def yaml_string(value):
    return json.dumps("" if value is None else str(value), ensure_ascii=False)


def render_todos(lines, todos, base_indent=""):
    for todo in todos:
        lines.append(f"{base_indent}  - id: {yaml_string(todo.get('id', ''))}")
        lines.append(f"{base_indent}    content: {yaml_string(todo.get('content', ''))}")
        lines.append(f"{base_indent}    status: {normalize_status(todo.get('status'))}")


def render_plan_document(args):
    lines = ["---"]
    lines.append(f"name: {yaml_string(args.get('name', ''))}")
    lines.append(f"overview: {yaml_string(args.get('overview', ''))}")
    lines.append("todos:")
    render_todos(lines, args.get("todos") or [])
    lines.append(f"isProject: {'true' if args.get('isProject') else 'false'}")

    phases = args.get("phases") or []
    if phases:
        lines.append("phases:")
        for phase in phases:
            lines.append(f"  - name: {yaml_string(phase.get('name', ''))}")
            lines.append("    todos:")
            render_todos(lines, phase.get("todos") or [], base_indent="    ")

    lines.append("---")
    lines.append("")
    lines.append((args.get("plan") or "").rstrip())
    lines.append("")
    return "\n".join(lines)

for raw_line in stream_path.read_text().splitlines():
    line = raw_line.strip()
    if not line:
        continue

    payload = json.loads(line)
    session_id = payload.get("session_id") or session_id

    if (
        payload.get("type") == "interaction_query"
        and payload.get("subtype") == "request"
        and payload.get("query_type") == "createPlanRequestQuery"
    ):
        request = payload.get("query", {}).get("createPlanRequestQuery", {})
        plan_request_tool_call_id = request.get("toolCallId") or plan_request_tool_call_id

    if (
        payload.get("type") == "interaction_query"
        and payload.get("subtype") == "response"
        and payload.get("query_type") == "createPlanRequestQuery"
    ):
        result = payload.get("response", {}).get("createPlanRequestResponse", {}).get("result", {})
        if isinstance(result, dict) and "success" in result:
            plan_request_accepted = True

    if payload.get("type") == "tool_call" and payload.get("subtype") == "completed":
        tool_call = payload.get("tool_call", {})
        create_plan = tool_call.get("createPlanToolCall")

        if isinstance(create_plan, dict):
            call_id = payload.get("call_id")
            if plan_request_tool_call_id and call_id and call_id != plan_request_tool_call_id:
                continue

            args = create_plan.get("args", {})
            if isinstance(args, dict) and args.get("plan"):
                plan_args = args
                plan_text = args["plan"]
                plan_tool_completed = True

    if (
        payload.get("type") == "result"
        and payload.get("subtype") == "success"
        and "result" in payload
    ):
        result_text = payload["result"]

if not session_id:
    raise SystemExit(f"No session_id found in {stream_path}")

if not plan_request_accepted:
    raise SystemExit(f"No accepted createPlan response found in {stream_path}")

if not plan_tool_completed or not plan_text or not plan_args:
    raise SystemExit(f"No completed createPlan tool call with plan text found in {stream_path}")

if result_text is None:
    raise SystemExit(f"No final result text found in {stream_path}")

(run_dir / "session_id.txt").write_text(f"{session_id}\n")
(run_dir / "plan-args.json").write_text(json.dumps(plan_args, indent=2) + "\n")
(run_dir / f"{change}.plan.md").write_text(render_plan_document(plan_args))
(run_dir / "plan-result.md").write_text(str(result_text).rstrip() + "\n")
PY
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --first-only)
      FIRST_ONLY=1
      shift
      ;;
    --plan-only)
      PLAN_ONLY=1
      shift
      ;;
    --out-dir)
      OUT_DIR="${2:-}"
      if [[ -z "$OUT_DIR" ]]; then
        printf 'Missing value for --out-dir\n' >&2
        exit 1
      fi
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="$ROOT_DIR/tmp/agent-plan-builds/$TIMESTAMP"
fi

if [[ "$FIRST_ONLY" -eq 1 ]]; then
  changes=("${changes[0]}")
fi

cd "$ROOT_DIR"

mkdir -p "$OUT_DIR"

printf 'Writing artifacts to %s\n' "$OUT_DIR"

for change in "${changes[@]}"; do
  run_dir="$OUT_DIR/$change"
  mkdir -p "$run_dir"

  make_plan_prompt "$change" > "$run_dir/plan-prompt.txt"
  plan_prompt="$(<"$run_dir/plan-prompt.txt")"

  printf '\n[%s] generating plan...\n' "$change"
  run_plan_stream "$change" "$plan_prompt" "$run_dir/plan.stream.jsonl"

  extract_plan_artifacts "$change" "$run_dir/plan.stream.jsonl" "$run_dir"
  session_id="$(<"$run_dir/session_id.txt")"

  if [[ "$PLAN_ONLY" -eq 1 ]]; then
    printf '[%s] skipping build (--plan-only)\n' "$change"
    printf '[%s] done\n' "$change"
    continue
  fi

  make_build_prompt "$change" > "$run_dir/build-prompt.txt"
  build_prompt="$(<"$run_dir/build-prompt.txt")"

  printf '[%s] building plan...\n' "$change"
  "$AGENT_BIN" \
    -p \
    --trust \
    --force \
    --model "gpt-5.4-xhigh-fast" \
    --resume "$session_id" \
    "$build_prompt" \
    > "$run_dir/build-output.txt" 2>&1

  printf '[%s] done\n' "$change"
done

printf '\nAll runs completed. Inspect artifacts under %s\n' "$OUT_DIR"
