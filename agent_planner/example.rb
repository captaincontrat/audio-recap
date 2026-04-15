#!/usr/bin/env ruby
# frozen_string_literal: true

require_relative "helpers"

include AgentOrchestrator

def main
  # This example makes real `agent` CLI calls.
  # The plan/build prompts below try to keep generated work under ignored `out/`.

  plan_file_path = plan(
    <<~PROMPT,
      Create a plan for a small demo task that only writes files under
      `out/agent_orchestrator_demo/`.

      The demo task should produce:
      1. a markdown note that explains the orchestrator helper API
      2. a tiny checklist for running scripted agent workflows

      Do not modify tracked source files.
    PROMPT
    label: "demo-plan"
  )

  build_summary = build_plan(
    plan_file_path,
    prompt: <<~PROMPT,
      Build the plan you just created.
      Only write files under `out/agent_orchestrator_demo/`.
      Do not modify tracked source files.
      When finished, print a concise summary of what changed.
    PROMPT
    label: "demo-build"
  )

  # `start_session` returns the session id; the initial reply is saved on disk in
  # `out/agent_orchestrator/sessions/<session_id>/messages/001-start/result.txt`.
  session_id = start_session(
    "I need a release checklist for the Ruby agent orchestrator. Give me three options.",
    label: "release-checklist"
  )

  answer_text = ask_session(
    session_id,
    "Pick the safest checklist option and explain why in five bullets.",
    label: "pick-safest-option"
  )

  should_add_retries = yes_no(
    "Should this orchestrator add retry logic for transient CLI failures?",
    session_id: session_id,
    label: "retry-decision"
  )

  follow_up_prompt =
    if should_add_retries
      "Propose a minimal retry strategy with limits, backoff, and failure reporting."
    else
      "Keep retries out of scope and explain how to fail fast with clear logs."
    end

  answer_text = ask_session(session_id, follow_up_prompt, label: "follow-up")
  answer_text = ask_session(session_id, "Write the pre-final implementation checklist.", label: "pre-final")
  answer_text = ask_session(session_id, "Write the final operator-ready summary.", label: "final")

  puts
  puts "Plan file: #{plan_file_path}"
  puts "Build summary:"
  puts build_summary
  puts "Session id: #{session_id}"
  puts "Final answer:"
  puts answer_text
end

main if $PROGRAM_NAME == __FILE__
