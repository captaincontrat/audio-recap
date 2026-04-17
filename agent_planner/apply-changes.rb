#!/usr/bin/env ruby
# frozen_string_literal: true

require_relative "helpers"

module AgentPlanner
  module ApplyChanges
    extend self

    # Edit these constants directly when you want to change behavior.
    CHANGES = [
      "bootstrap-meeting-recap-web-platform",
      "add-workspace-foundation",
      "add-workspace-archival-lifecycle",
      "add-workspace-membership-and-invitations",
      "add-web-meeting-processing",
      "add-transcript-management",
      "add-transcript-curation-controls",
      "add-transcript-edit-sessions",
      "add-public-transcript-sharing",
      "add-client-side-transcript-export",
      "add-account-security-hardening",
      "add-account-closure-retention",
    ].freeze

    FIRST_ONLY = false

    def main
      changes = FIRST_ONLY ? CHANGES.first(1) : CHANGES
      raise AgentPlanner::Error, "CHANGES cannot be empty" if changes.empty?

      AgentPlanner.emit_log("Applying changes: #{changes.join(', ')}")
      changes.each { |change| process_change(change) }
      AgentPlanner.emit_log("All change workflows completed.")
    rescue AgentPlanner::Error, Errno::ENOENT => e
      AgentPlanner.emit_log(e.message, io: $stderr)
      exit 1
    end

    def process_change(change)
      AgentPlanner.emit_log("[#{change}] starting apply/sync/archive/commit workflow")

      session_id = AgentPlanner.start_session(
        "/openspec-apply-change #{change}",
        label: "#{change} apply"
      )

      AgentPlanner.ask_session(
        session_id,
        make_sync_prompt(change),
        label: "#{change} sync"
      )

      AgentPlanner.ask_session(
        session_id,
        "/openspec-archive-change #{change}",
        label: "#{change} archive"
      )

      AgentPlanner.ask_session(
        session_id,
        make_commit_and_push_prompt(change),
        label: "#{change} commit-push"
      )

      AgentPlanner.emit_log("[#{change}] done")
    end

    def make_sync_prompt(change)
      [
        "Sync the change #{change} with OpenSpec now.",
        "Use the appropriate sync workflow for this change before archiving it."
      ].join("\n")
    end

    def make_commit_and_push_prompt(change)
      [
        "Commit and push the current changes for #{change}.",
        "Create a focused and exhaustive commit message.",
        "Push the current branch after the commit succeeds.",
        "Do not make unrelated edits.",
        "If there is nothing to commit, say so clearly."
      ].join("\n")
    end
  end
end

AgentPlanner::ApplyChanges.main if $PROGRAM_NAME == __FILE__
