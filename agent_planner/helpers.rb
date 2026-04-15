#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "io/console"
require "json"
require "open3"
require "securerandom"
require "shellwords"
require "time"
require "yaml"

module AgentPlanner
  AGENT_BIN = ENV.fetch("AGENT_PLANNER_BIN", "agent")
  WORKSPACE = ENV.fetch("AGENT_PLANNER_WORKSPACE", File.expand_path("..", __dir__))
  OUTPUT_ROOT = ENV.fetch("AGENT_PLANNER_OUTPUT_ROOT", File.join(WORKSPACE, "out", "agent_planner"))
  DEFAULT_MODEL = ENV.fetch("AGENT_PLANNER_MODEL", "gpt-5.4-xhigh-fast")
  PLAN_MODEL = ENV.fetch("AGENT_PLANNER_PLAN_MODEL", DEFAULT_MODEL)
  TRUST_WORKSPACE = ENV.fetch("AGENT_PLANNER_TRUST", "1") == "1"
  FORCE_COMMANDS = ENV.fetch("AGENT_PLANNER_FORCE", "1") == "1"
  APPROVE_MCPS = ENV.fetch("AGENT_PLANNER_APPROVE_MCPS", "0") == "1"
  STREAM_PARTIAL_OUTPUT = ENV.fetch("AGENT_PLANNER_STREAM_PARTIAL_OUTPUT", "1") == "1"
  VERBOSE = ENV.fetch("AGENT_PLANNER_VERBOSE", "1") == "1"
  EXTRA_AGENT_ARGS = Shellwords.split(ENV.fetch("AGENT_PLANNER_EXTRA_ARGS", ""))
  DEFAULT_BUILD_PROMPT = ENV.fetch("AGENT_PLANNER_BUILD_PROMPT", <<~PROMPT).strip
    Build the plan you just created.
    Work in this workspace and carry out the plan.
    If you get blocked, explain the blocker clearly.
    When finished, print a concise summary of what changed.
  PROMPT

  RunResult = Struct.new(:session_id, :result_text, :stream_path, :run_dir, :prompt_path, keyword_init: true)
  BuiltCommand = Struct.new(:argv, :prompt_path, keyword_init: true)
  PlanResult = Struct.new(
    :session_id,
    :plan_path,
    :plan_text,
    :result_text,
    :stream_path,
    :run_dir,
    keyword_init: true
  )

  class Error < StandardError; end
  class CommandFailed < Error; end
  class MissingSessionId < Error; end
  class MissingResultText < Error; end
  class PlanExtractionError < Error; end
  class AmbiguousYesNo < Error; end

  module_function

  def plan(prompt, label: nil, model: PLAN_MODEL, run_dir: nil, plan_filename: "plan.md", metadata_filename: "metadata.json")
    run_label = label || "plan"
    run_dir = resolve_run_dir(run_dir, category: "plans", label_source: run_label || prompt)
    emit_log("[#{run_label}] generating plan...")

    run = run_agent(
      prompt: prompt,
      mode: :plan,
      model: model,
      run_dir: run_dir,
      stream_filename: "plan.stream.jsonl",
      label: run_label
    )

    extracted = extract_plan_artifacts(run.stream_path, run_dir, plan_filename: plan_filename)
    write_json(
      File.join(run_dir, metadata_filename),
      {
        "kind" => "plan",
        "created_at" => Time.now.utc.iso8601,
        "workspace" => WORKSPACE,
        "model" => model,
        "prompt_path" => run.prompt_path,
        "session_id" => extracted.session_id,
        "plan_path" => extracted.plan_path,
        "plan_result_path" => File.join(run_dir, "plan-result.md")
      }
    )

    log("Plan saved to #{extracted.plan_path}")
    extracted.plan_path
  end

  def build_plan(
    plan_file_path,
    prompt: DEFAULT_BUILD_PROMPT,
    label: nil,
    model: DEFAULT_MODEL,
    build_dir: nil,
    stream_filename: "response.stream.jsonl",
    result_filename: "result.txt",
    metadata_filename: "metadata.json"
  )
    run_label = label || "build"
    plan_dir = File.expand_path(File.dirname(plan_file_path))
    session_id = read_required_text(File.join(plan_dir, "session_id.txt"))
    build_dir =
      if build_dir
        File.expand_path(build_dir, WORKSPACE)
      else
        next_numbered_dir(File.join(plan_dir, "builds"), run_label)
      end
    emit_log("[#{run_label}] building plan...")

    run = run_agent(
      prompt: prompt,
      resume: session_id,
      model: model,
      run_dir: build_dir,
      stream_filename: stream_filename,
      label: run_label
    )

    ensure_matching_session_id!(expected: session_id, actual: run.session_id, context: build_dir)
    result_path = File.join(build_dir, result_filename)
    write_text(result_path, run.result_text)
    write_json(
      File.join(build_dir, metadata_filename),
      {
        "kind" => "build_plan",
        "created_at" => Time.now.utc.iso8601,
        "workspace" => WORKSPACE,
        "model" => model,
        "prompt_path" => run.prompt_path,
        "session_id" => session_id,
        "plan_file_path" => File.expand_path(plan_file_path),
        "result_path" => result_path
      }
    )

    log("Build result saved to #{result_path}")
    run.result_text
  end

  def start_session(prompt, label: nil, model: DEFAULT_MODEL)
    pending_root = unique_run_dir(File.join("sessions", "_pending"), label || prompt)
    message_dir = File.join(pending_root, "messages", "001-start")

    run = run_agent(
      prompt: prompt,
      model: model,
      run_dir: message_dir,
      stream_filename: "response.stream.jsonl",
      label: label || "start-session"
    )

    session_dir = finalize_session_dir(pending_root, run.session_id)
    final_message_dir = File.join(session_dir, "messages", "001-start")
    write_text(File.join(final_message_dir, "result.txt"), run.result_text)
    write_text(File.join(session_dir, "session_id.txt"), run.session_id)
    upsert_session_metadata(session_dir, run.session_id, final_message_dir, model: model, created_at: Time.now.utc.iso8601)

    log("Session started: #{run.session_id}")
    run.session_id
  end

  def ask_session(session_id, prompt, label: "ask", model: DEFAULT_MODEL)
    session_id = session_id.to_s.strip
    raise MissingSessionId, "Session id cannot be empty" if session_id.empty?

    session_dir = ensure_session_dir(session_id)
    message_dir = next_numbered_dir(File.join(session_dir, "messages"), label)

    run = run_agent(
      prompt: prompt,
      resume: session_id,
      model: model,
      run_dir: message_dir,
      stream_filename: "response.stream.jsonl",
      label: label
    )

    ensure_matching_session_id!(expected: session_id, actual: run.session_id, context: message_dir)
    write_text(File.join(message_dir, "result.txt"), run.result_text)
    upsert_session_metadata(session_dir, session_id, message_dir, model: model)
    run.result_text
  end

  def yes_no(question, session_id: nil, label: "yes-no", model: DEFAULT_MODEL)
    prompt = <<~PROMPT
      #{question.to_s.strip}

      Answer with exactly one word: YES or NO.
    PROMPT

    response =
      if session_id
        ask_session(session_id, prompt, label: label, model: model)
      else
        run_dir = unique_run_dir("checks", label)

        run = run_agent(
          prompt: prompt,
          model: model,
          run_dir: run_dir,
          stream_filename: "response.stream.jsonl",
          label: label
        )

        write_text(File.join(run_dir, "result.txt"), run.result_text)
        write_json(
          File.join(run_dir, "metadata.json"),
          {
            "kind" => "yes_no",
            "created_at" => Time.now.utc.iso8601,
            "workspace" => WORKSPACE,
            "model" => model,
            "prompt_path" => run.prompt_path,
            "session_id" => run.session_id,
            "result_path" => File.join(run_dir, "result.txt")
          }
        )
        run.result_text
      end

    parse_yes_no(response)
  end

  def run_agent(prompt:, run_dir:, label:, model:, stream_filename:, mode: nil, resume: nil)
    raise Error, "Prompt cannot be empty" if prompt.to_s.strip.empty?

    stream_path = File.join(run_dir, stream_filename)
    command = build_command(prompt: prompt, model: model, mode: mode, resume: resume, artifacts_dir: run_dir)
    log("Running #{label}: #{command.argv.map { |part| Shellwords.escape(part) }.join(' ')}")

    session_id = nil
    assistant_text = +""
    result_text = nil

    run_command_to_file!(
      command: command.argv,
      output_path: stream_path,
      working_directory: WORKSPACE,
      label: label
    ) do |_line, payload|
      next unless payload

      session_id ||= payload["session_id"]
      assistant_text << extract_assistant_text(payload)

      if payload["type"] == "result" && payload["subtype"] == "success" && payload.key?("result")
        candidate = payload["result"].to_s
        result_text = candidate unless candidate.empty?
      end
    end

    result_text ||= assistant_text unless assistant_text.empty?

    raise MissingSessionId, "No session_id found in #{stream_path}" if session_id.to_s.empty?
    raise MissingResultText, "No final result text found in #{stream_path}" if result_text.to_s.empty?

    RunResult.new(
      session_id: session_id,
      result_text: ensure_trailing_newline(result_text),
      stream_path: stream_path,
      run_dir: run_dir,
      prompt_path: command.prompt_path
    )
  end

  # Cursor's plan mode exposes the authored plan through a tool call, so we
  # lift the important pieces into stable files that scripts can reuse later.
  def extract_plan_artifacts(stream_path, run_dir, plan_filename: "plan.md")
    session_id = nil
    assistant_text = +""
    plan_request_tool_call_id = nil
    plan_request_accepted = false
    plan_tool_completed = false
    plan_args = nil
    plan_text = nil
    result_text = nil

    File.foreach(stream_path) do |line|
      payload = parse_json_line(line)
      next unless payload

      session_id ||= payload["session_id"]
      assistant_text << extract_assistant_text(payload)

      if payload["type"] == "interaction_query" &&
         payload["subtype"] == "request" &&
         payload["query_type"] == "createPlanRequestQuery"
        request = payload.dig("query", "createPlanRequestQuery") || {}
        plan_request_tool_call_id ||= request["toolCallId"]
      end

      if payload["type"] == "interaction_query" &&
         payload["subtype"] == "response" &&
         payload["query_type"] == "createPlanRequestQuery"
        result = payload.dig("response", "createPlanRequestResponse", "result")
        plan_request_accepted = true if result.is_a?(Hash) && result.key?("success")
      end

      if payload["type"] == "tool_call"
        create_plan = payload.dig("tool_call", "createPlanToolCall")
        next unless create_plan.is_a?(Hash)

        call_id = payload["call_id"]
        next if plan_request_tool_call_id && call_id && call_id != plan_request_tool_call_id

        args = create_plan["args"]
        if args.is_a?(Hash) && args["plan"]
          plan_args = args
          plan_text = args["plan"].to_s
        end

        plan_tool_completed = true if payload["subtype"] == "completed"
      end

      if payload["type"] == "result" && payload["subtype"] == "success" && payload.key?("result")
        candidate = payload["result"].to_s
        result_text = candidate unless candidate.empty?
      end
    end

    result_text ||= assistant_text unless assistant_text.empty?

    raise PlanExtractionError, "No session_id found in #{stream_path}" if session_id.to_s.empty?
    raise PlanExtractionError, "No accepted createPlan response found in #{stream_path}" unless plan_request_accepted
    unless plan_tool_completed && plan_args && !plan_text.to_s.empty?
      raise PlanExtractionError, "No completed createPlan tool call with plan text found in #{stream_path}"
    end
    raise PlanExtractionError, "No final result text found in #{stream_path}" if result_text.to_s.empty?

    plan_path = File.join(run_dir, plan_filename)
    write_text(File.join(run_dir, "session_id.txt"), session_id)
    write_json(File.join(run_dir, "plan-args.json"), plan_args)
    write_text(plan_path, render_plan_document(plan_args))
    write_text(File.join(run_dir, "plan-result.md"), result_text)

    PlanResult.new(
      session_id: session_id,
      plan_path: plan_path,
      plan_text: plan_text,
      result_text: ensure_trailing_newline(result_text),
      stream_path: stream_path,
      run_dir: run_dir
    )
  end

  def build_command(
    prompt:,
    model:,
    mode: nil,
    resume: nil,
    output_format: "stream-json",
    stream_partial_output: STREAM_PARTIAL_OUTPUT,
    force: FORCE_COMMANDS,
    trust_workspace: TRUST_WORKSPACE,
    approve_mcps: APPROVE_MCPS,
    workspace: WORKSPACE,
    agent_bin: AGENT_BIN,
    extra_args: EXTRA_AGENT_ARGS,
    artifacts_dir: nil
  )
    prompt_path = write_prompt_artifact(artifacts_dir, prompt)
    command = [agent_bin, "-p"]
    command += ["--output-format", output_format] unless output_format.to_s.empty?
    command << "--stream-partial-output" if stream_partial_output
    command << "--trust" if trust_workspace
    command << "--force" if force
    command << "--approve-mcps" if approve_mcps
    command.concat(extra_args)
    command += ["--workspace", workspace] unless workspace.to_s.empty?
    command += ["--model", model] unless model.to_s.empty?
    command << "--plan" if mode == :plan
    command += ["--resume", resume.to_s] unless resume.to_s.strip.empty?
    command << prompt.to_s
    BuiltCommand.new(argv: command, prompt_path: prompt_path)
  end

  def write_prompt_artifact(artifacts_dir, prompt)
    return nil if artifacts_dir.to_s.strip.empty?

    path = File.join(artifacts_dir, "prompts", "#{timestamp}-#{SecureRandom.uuid}.md")
    write_text(path, prompt)
    path
  end

  def run_command_to_file!(command:, output_path:, working_directory: WORKSPACE, label:)
    status = nil
    display = AgentStreamDisplay.new(label)

    FileUtils.mkdir_p(File.dirname(output_path))
    begin
      File.open(output_path, "w", encoding: "utf-8") do |file|
        Open3.popen2e(*command, chdir: working_directory) do |stdin, output, wait_thr|
          stdin.close

          output.each_line do |line|
            payload = parse_json_line(line)
            display.on_output(line, payload)
            file.write(line)
            file.flush
            yield(line, payload) if block_given?
          end

          status = wait_thr.value
        end
      end
    ensure
      display.finish
    end

    return output_path if status&.success?

    code = status&.exitstatus || "unknown"
    raise CommandFailed, "agent exited with #{code}. Inspect #{output_path}"
  end

  def render_plan_document(plan_args)
    payload = {
      "name" => plan_args["name"].to_s,
      "overview" => plan_args["overview"].to_s,
      "todos" => normalize_todos(plan_args["todos"]),
      "isProject" => !!plan_args["isProject"]
    }

    phases = Array(plan_args["phases"]).map do |phase|
      {
        "name" => phase["name"].to_s,
        "todos" => normalize_todos(phase["todos"])
      }
    end
    payload["phases"] = phases unless phases.empty?

    yaml_body = YAML.dump(payload).sub(/\A---\s*\n/, "")
    <<~DOC
      ---
      #{yaml_body}---

      #{plan_args["plan"].to_s.rstrip}
    DOC
  end

  def normalize_todos(todos)
    Array(todos).map do |todo|
      {
        "id" => todo["id"].to_s,
        "content" => todo["content"].to_s,
        "status" => normalize_status(todo["status"])
      }
    end
  end

  def normalize_status(status)
    value = status.to_s
    value = value.delete_prefix("TODO_STATUS_")
    value.empty? ? "pending" : value.downcase
  end

  def parse_yes_no(text)
    token = text.to_s.strip.split(/\s+/, 2).first.to_s.downcase.gsub(/[^a-z]/, "")
    return true if %w[yes true].include?(token)
    return false if %w[no false].include?(token)

    raise AmbiguousYesNo, "Could not parse YES/NO from: #{text.inspect}"
  end

  def ensure_matching_session_id!(expected:, actual:, context:)
    return if expected.to_s == actual.to_s

    raise Error, "Expected session #{expected} but got #{actual} while processing #{context}"
  end

  def ensure_session_dir(session_id)
    session_dir = File.join(OUTPUT_ROOT, "sessions", session_id)
    FileUtils.mkdir_p(File.join(session_dir, "messages"))
    write_text(File.join(session_dir, "session_id.txt"), session_id) unless File.exist?(File.join(session_dir, "session_id.txt"))
    session_dir
  end

  def finalize_session_dir(pending_root, session_id)
    final_root = File.join(OUTPUT_ROOT, "sessions", session_id)
    FileUtils.mkdir_p(File.dirname(final_root))

    if Dir.exist?(final_root)
      raise Error, "Refusing to overwrite existing session directory #{final_root}"
    end

    FileUtils.mv(pending_root, final_root)
    final_root
  end

  def upsert_session_metadata(session_dir, session_id, last_message_dir, model:, created_at: nil)
    metadata_path = File.join(session_dir, "session.json")
    metadata =
      if File.exist?(metadata_path)
        JSON.parse(File.read(metadata_path))
      else
        {}
      end

    metadata["session_id"] = session_id
    metadata["workspace"] = WORKSPACE
    metadata["model"] ||= model
    metadata["created_at"] ||= created_at || Time.now.utc.iso8601
    metadata["updated_at"] = Time.now.utc.iso8601
    metadata["last_message_dir"] = last_message_dir
    write_json(metadata_path, metadata)
  end

  def resolve_run_dir(run_dir, category:, label_source:)
    return File.expand_path(run_dir, WORKSPACE) if run_dir

    unique_run_dir(category, label_source)
  end

  def unique_run_dir(category, label_source)
    base_name = "#{timestamp}-#{slug(label_source)}"
    root = File.join(OUTPUT_ROOT, category)
    FileUtils.mkdir_p(root)

    attempt = 0
    loop do
      suffix = attempt.zero? ? "" : "-#{attempt + 1}"
      run_dir = File.join(root, "#{base_name}#{suffix}")
      unless Dir.exist?(run_dir)
        FileUtils.mkdir_p(run_dir)
        return run_dir
      end
      attempt += 1
    end
  end

  def next_numbered_dir(parent_dir, label)
    FileUtils.mkdir_p(parent_dir)
    highest = Dir.children(parent_dir).filter_map { |name| name[/\A(\d+)-/, 1]&.to_i }.max || 0
    run_dir = File.join(parent_dir, format("%03d-%s", highest + 1, slug(label)))
    FileUtils.mkdir_p(run_dir)
    run_dir
  end

  def slug(source, max_length: 48)
    candidate = source.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-+|-+\z/, "")
    candidate = candidate[0, max_length]
    candidate = candidate.gsub(/-+\z/, "")
    candidate.empty? ? "run" : candidate
  end

  def timestamp
    Time.now.utc.strftime("%Y%m%d-%H%M%S")
  end

  def parse_json_line(line)
    payload = JSON.parse(line)
    payload.is_a?(Hash) ? payload : nil
  rescue JSON::ParserError
    nil
  end

  def extract_assistant_text(payload)
    return "" unless payload["type"] == "assistant"

    extract_text_blocks(payload.dig("message", "content"))
  end

  def extract_text_blocks(content_blocks)
    return "" unless content_blocks.is_a?(Array)

    content_blocks.filter_map do |block|
      next unless block.is_a?(Hash) && block["type"] == "text"

      block["text"].to_s
    end.join
  end

  def read_required_text(path)
    value = File.read(path, encoding: "utf-8").strip
    raise Error, "Expected non-empty file at #{path}" if value.empty?

    value
  rescue Errno::ENOENT
    raise Error, "Missing required file: #{path}"
  end

  def write_text(path, value)
    FileUtils.mkdir_p(File.dirname(path))
    File.write(path, ensure_trailing_newline(value.to_s), encoding: "utf-8")
  end

  def write_json(path, payload)
    write_text(path, JSON.pretty_generate(payload))
  end

  def timestamp_prefix(time = Time.now)
    time.strftime("%Y-%m-%d %H:%M:%S")
  end

  def timestamped_message(message, time: Time.now)
    "[#{timestamp_prefix(time)}] #{message}"
  end

  def emit_log(message, io: $stdout, time: Time.now)
    io.puts(timestamped_message(message, time: time))
    io.flush
  end

  def ensure_trailing_newline(text)
    text.end_with?("\n") ? text : "#{text}\n"
  end

  def log(message)
    emit_log("[agent_planner] #{message}") if VERBOSE
  end

  class AgentStreamDisplay
    TAIL_CHARS = 1000

    def initialize(label, io: $stderr)
      @label = label
      @io = io
      @thinking_tail = +""
      @assistant_text = +""
      @preview_line_count = 0
      @io_is_tty = @io.isatty
    end

    def on_output(line, payload)
      return show_raw_line(line) unless payload

      case payload["type"]
      when "thinking"
        update_thinking_preview(payload)
      when "assistant"
        update_assistant_preview(payload)
      when "tool_call"
        show_tool_call(payload)
      end
    end

    def finish
      return unless @io_is_tty
      return if @preview_line_count.zero?

      @io.print("\n")
      @io.flush
    end

    private

    def update_thinking_preview(payload)
      return unless payload["subtype"] == "delta"

      text = sanitize(payload["text"].to_s)
      return if text.empty?

      combined = @thinking_tail + text
      @thinking_tail = combined.length > TAIL_CHARS ? combined[-TAIL_CHARS, TAIL_CHARS] : combined
      show_ephemeral(@thinking_tail, source: "thinking")
    end

    def update_assistant_preview(payload)
      text = sanitize(AgentPlanner.extract_assistant_text(payload))
      return if text.empty?

      @assistant_text << text
      show_ephemeral(@assistant_text, source: "assistant")
    end

    def show_tool_call(payload)
      return unless payload["subtype"] == "started"

      tool_name = payload.fetch("tool_call", {}).keys.first
      return if tool_name.to_s.empty?

      persist_preview
      AgentPlanner.emit_log("[#{@label}] using: #{tool_name}", io: @io)
    end

    def show_raw_line(line)
      text = sanitize(line.to_s)
      return if text.empty?

      show_ephemeral(text, source: "stream")
    end

    def sanitize(text)
      text.tr("\r\n", "  ")
    end

    def show_ephemeral(text, source:)
      return unless @io_is_tty

      lines = build_preview_lines(text, source: source)
      clear_ephemeral

      lines.each_with_index do |line, index|
        @io.print("\n") if index.positive?
        @io.print(line)
      end
      @io.flush
      @preview_line_count = lines.length
    end

    def persist_preview
      return unless @io_is_tty
      return if @preview_line_count.zero?

      @io.print("\n")
      @io.flush
      @preview_line_count = 0
    end

    def clear_ephemeral
      return unless @io_is_tty
      return if @preview_line_count.zero?

      @preview_line_count.times do |index|
        @io.print("\r\e[2K")
        @io.print("\e[1A") if index < @preview_line_count - 1
      end
      @io.flush
      @preview_line_count = 0
    end

    def build_preview_lines(text, source:)
      prefix = AgentPlanner.timestamped_message("[#{@label}] #{source}:")
      snippet = text.empty? ? "..." : text

      return ["#{prefix} #{snippet}"] unless @io_is_tty

      columns = console_columns
      max_lines = max_preview_lines
      content_width = [columns - prefix.length - 1, 1].max
      wrapped = wrap_text(snippet, content_width)

      if wrapped.length > max_lines
        wrapped = wrapped.last(max_lines)
        if content_width > 3
          trimmed = wrapped.first[-(content_width - 3), content_width - 3] || wrapped.first
          wrapped[0] = "...#{trimmed}"
        end
      end

      lines = ["#{prefix} #{wrapped.first}"]
      indent = " " * (prefix.length + 1)
      wrapped.drop(1).each { |part| lines << "#{indent}#{part}" }
      lines
    end

    def wrap_text(text, width)
      chunks = text.scan(/.{1,#{width}}/m)
      chunks.empty? ? ["..."] : chunks
    end

    def console_columns
      console = IO.console
      columns = console&.winsize&.[](1) || 120
      columns.positive? ? columns : 120
    rescue NoMethodError
      120
    end

    def console_rows
      console = IO.console
      rows = console&.winsize&.[](0) || 24
      rows.positive? ? rows : 24
    rescue NoMethodError
      24
    end

    def max_preview_lines
      [console_rows - 2, 1].max
    end
  end
end
