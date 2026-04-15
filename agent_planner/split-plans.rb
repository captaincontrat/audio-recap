#!/usr/bin/env ruby
# frozen_string_literal: true

require_relative "helpers"

module AgentPlanner
  module SplitPlans
    extend self

    # Edit these constants directly when you want to change behavior.
    CHANGES = [
      "add-web-meeting-processing",
      "add-transcript-sharing-and-exports",
      "add-transcript-management"
    ].freeze

    FIRST_ONLY = false
    PLAN_ONLY = false
    ROOT_DIR = AgentPlanner::WORKSPACE
    OUT_DIR = File.join(ROOT_DIR, "tmp", "agent-plan-builds", AgentPlanner.timestamp)
    MODEL = AgentPlanner::DEFAULT_MODEL

    def main
      changes = FIRST_ONLY ? [CHANGES.first] : CHANGES
      out_dir = OUT_DIR

      AgentPlanner.emit_log("Writing artifacts to #{out_dir}")

      plan_file_paths = create_all_plans(changes, out_dir)
      request_commit_and_push("after creating all plans")

      if PLAN_ONLY
        AgentPlanner.emit_log("Skipping build/apply stages (--plan-only)")
        AgentPlanner.emit_log("All runs completed. Inspect artifacts under #{out_dir}")
        return
      end

      build_all_plans(plan_file_paths)
      request_commit_and_push("after building all plans")

      ordered_changes = request_ordered_changes(changes, out_dir)
      process_changes_in_order(ordered_changes)

      AgentPlanner.emit_log("All runs completed. Inspect artifacts under #{out_dir}")
    rescue AgentPlanner::Error, Errno::ENOENT => e
      AgentPlanner.emit_log(e.message, io: $stderr)
      exit 1
    end

    def create_all_plans(changes, out_dir)
      AgentPlanner.emit_log("Creating plans for: #{changes.join(', ')}")

      changes.to_h do |change|
        [change, create_plan(change, out_dir)]
      end
    end

    def create_plan(change, out_dir)
      AgentPlanner.plan(
        make_plan_prompt(change),
        label: change,
        model: MODEL,
        run_dir: run_dir_for(change, out_dir),
        plan_filename: "#{change}.plan.md"
      )
    end

    def build_all_plans(plan_file_paths)
      AgentPlanner.emit_log("Building plans for: #{plan_file_paths.keys.join(', ')}")

      plan_file_paths.each do |change, plan_file_path|
        build_plan(change, plan_file_path)
      end
    end

    def build_plan(change, plan_file_path)
      AgentPlanner.build_plan(
        plan_file_path,
        prompt: make_build_prompt(change),
        label: change,
        model: MODEL,
        build_dir: File.dirname(plan_file_path),
        stream_filename: "build.stream.jsonl",
        result_filename: "build-output.txt",
        metadata_filename: "build-metadata.json"
      )
    end

    def request_commit_and_push(stage)
      AgentPlanner.emit_log("Requesting commit and push #{stage}")
      AgentPlanner.start_session(
        make_commit_and_push_prompt(stage),
        label: "commit-push #{stage}",
        model: MODEL
      )
    end

    def request_ordered_changes(seed_changes, out_dir)
      AgentPlanner.emit_log("Requesting ordered change list")
      _session_id, result_text = start_session_with_result(
        make_change_order_prompt(seed_changes),
        label: "ordered-changes"
      )
      ordered_changes = parse_change_names(result_text)
      AgentPlanner.write_text(File.join(out_dir, "ordered-changes.txt"), ordered_changes.join(", "))
      AgentPlanner.emit_log("Ordered changes: #{ordered_changes.join(', ')}")
      ordered_changes
    end

    def process_changes_in_order(changes)
      changes.each do |change|
        process_change(change)
      end
    end

    def process_change(change)
      AgentPlanner.emit_log("[#{change}] starting apply/sync/archive workflow")
      session_id = AgentPlanner.start_session("/openspec-apply-change #{change}", label: "#{change} apply", model: MODEL)
      AgentPlanner.ask_session(session_id, make_sync_prompt(change), label: "#{change} sync", model: MODEL)
      AgentPlanner.ask_session(session_id, "/openspec-archive-change #{change}", label: "#{change} archive", model: MODEL)
      request_commit_and_push("after applying #{change}")
      AgentPlanner.emit_log("[#{change}] done")
    end

    def run_dir_for(change, out_dir)
      File.join(out_dir, change)
    end

    def start_session_with_result(prompt, label:)
      session_id = AgentPlanner.start_session(prompt, label: label, model: MODEL)
      result_path = File.join(AgentPlanner::OUTPUT_ROOT, "sessions", session_id, "messages", "001-start", "result.txt")
      [session_id, AgentPlanner.read_required_text(result_path)]
    end

    def parse_change_names(text)
      changes = text.to_s.split(/[,\n]/).map { |entry| normalize_change_name(entry) }.reject(&:empty?).uniq
      raise AgentPlanner::Error, "Expected comma-separated change names, got: #{text.inspect}" if changes.empty?

      invalid_changes = changes.reject { |change| change.match?(/\A[a-z0-9][a-z0-9-]*\z/) }
      return changes if invalid_changes.empty?

      raise AgentPlanner::Error, "Invalid change names returned: #{invalid_changes.join(', ')}"
    end

    def normalize_change_name(text)
      value = text.to_s.strip
      value = value.sub(/\A\d+\.\s*/, "")
      value = value.sub(/\A[-*]\s*/, "")
      value = value.gsub(/\A[[:punct:]]+|[[:punct:]]+\z/, "")
      value.strip
    end

    def make_plan_prompt(change)
      [
        "read: openspec/scope-ranking-context-2026-04-15.md",
        "how do you suggest to split #{change} ?",
        "",
        "Make a plan",
        "- The very first todo must be to preserve a frozen copy of the original change under openspec/split-audit/ in order to check at the end that full scope was properly split and nothing was forgotten",
        "- Use this plan as an example format for the plan you will create: .cursor/plans/split_bootstrap_change_7deb20d6.plan.md"
      ].join("\n")
    end

    def make_build_prompt(change)
      [
        "Build the plan you just created for #{change}.",
        "Work in this workspace and carry out the plan.",
        "Mark the todos as completed as you go.",
        "If you get blocked, explain the blocker clearly.",
        "When finished, print a concise summary of what changed."
      ].join("\n")
    end

    def make_commit_and_push_prompt(stage)
      [
        "Commit and push the current changes #{stage}.",
        "Create a focused and exaustive commit message.",
        "Push the current branch after the commit succeeds.",
        "Do not make unrelated edits.",
        "If there is nothing to commit, say so clearly."
      ].join("\n")
    end

    def make_change_order_prompt(seed_changes)
      [
        "Inspect the OpenSpec changes currently present in this workspace.",
        "List the change names that should be performed in order, from first to last.",
        "Return only the names separated by commas.",
        "Do not number them.",
        "Do not add any explanation.",
        "eg: change-1, change-2, change-3"
      ].join("\n")
    end

    def make_sync_prompt(change)
      [
        "Sync the change #{change} with OpenSpec now.",
        "Use the appropriate sync workflow for this change, but do not archive it yet."
      ].join("\n")
    end

  end
end

AgentPlanner::SplitPlans.main if $PROGRAM_NAME == __FILE__
