import { describe, expect, it } from "vitest";

import {
  BUILT_IN_SUMMARY_FORMATS,
  GENERAL_SUMMARY_FORMAT_KEY,
  resolveSummaryFormatCatalog,
  serializeSummaryFormatCatalog,
} from "../src/openai/summary-formats.js";

describe("summary format catalog", () => {
  it("returns built-in formats with general as the final fallback", () => {
    const formats = resolveSummaryFormatCatalog();

    expect(formats.map((format) => format.key)).toEqual(BUILT_IN_SUMMARY_FORMATS.map((format) => format.key));
    expect(formats.at(-1)?.key).toBe(GENERAL_SUMMARY_FORMAT_KEY);
  });

  it("ships the curated English built-in templates exactly", () => {
    const formats = resolveSummaryFormatCatalog();
    const expectedTemplates = {
      project: [
        "**Meeting minutes - Project meeting [Project name]**",
        "",
        "**Date:**",
        "**Time:**",
        "**Location / video call:**",
        "**Facilitator:**",
        "**Recorder:**",
        "",
        "## Participants",
        "",
        "**Present:**",
        "**Absent / excused:**",
        "",
        "## Meeting objective",
        "",
        "Review project progress, identify blockers, arbitrate priorities, and define the next steps.",
        "",
        "## Overall progress",
        "",
        "* Milestones achieved:",
        "* Milestones in progress:",
        "* Delayed milestones:",
        "* Warning points:",
        "",
        "## Topics discussed",
        "",
        "### 1. Progress by workstream",
        "",
        "* Workstream / work package:",
        "* Status:",
        "* Comments:",
        "",
        "### 2. Blockers / risks",
        "",
        "* Identified blocker:",
        "* Impact:",
        "* Need for arbitration:",
        "* Decision made:",
        "",
        "### 3. Priorities until the next meeting",
        "",
        "* Priority 1:",
        "* Priority 2:",
        "* Priority 3:",
        "",
        "## Decisions made",
        "",
        "*",
        "*",
        "*",
        "",
        "## Action plan",
        "",
        "| Action | Owner | Due date | Dependency / note |",
        "| ------ | ----- | -------- | ----------------- |",
        "|        |       |          |                   |",
        "|        |       |          |                   |",
        "|        |       |          |                   |",
        "",
        "## Open points",
        "",
        "*",
        "*",
        "",
        "## Next milestone / next meeting",
        "",
        "**Date:**",
        "**Objective:**",
      ].join("\n"),
      client: [
        "**Meeting minutes - Client meeting [Client name / company]**",
        "",
        "**Date:**",
        "**Time:**",
        "**Location / video call:**",
        "**Client-side attendees:**",
        "**Team-side attendees:**",
        "**Recorder:**",
        "",
        "## Context / objective",
        "",
        "Specify the purpose of the discussion: kickoff, follow-up, scoping, arbitration, review, satisfaction check, etc.",
        "",
        "## Key points discussed",
        "",
        "### 1. Client needs / expectations",
        "",
        "*",
        "*",
        "*",
        "",
        "### 2. Items presented or validated",
        "",
        "*",
        "*",
        "*",
        "",
        "### 3. Client questions / objections",
        "",
        "*",
        "*",
        "*",
        "",
        "## Decisions / validations obtained",
        "",
        "* Validation of:",
        "* Arbitration on:",
        "* Items to revise:",
        "",
        "## Commitments made",
        "",
        "### Client side",
        "",
        "*",
        "*",
        "*",
        "",
        "### Team side",
        "",
        "*",
        "*",
        "*",
        "",
        "## Actions to take",
        "",
        "| Action | Owner | Due date | Status / note |",
        "| ------ | ----- | -------- | ------------- |",
        "|        |       |          |               |",
        "|        |       |          |               |",
        "|        |       |          |               |",
        "",
        "## Watch points",
        "",
        "* Timeline risk:",
        "* Risk of misunderstanding:",
        "* Dependency / approval risk:",
        "",
        "## Next contact",
        "",
        "**Planned date:**",
        "**Format:**",
        "**Objective:**",
      ].join("\n"),
      codir: [
        "**Meeting minutes - Executive committee**",
        "",
        "**Date:**",
        "**Time:**",
        "**Location / video call:**",
        "**Chair:**",
        "**Recorder:**",
        "",
        "## Participants",
        "",
        "**Present:**",
        "**Absent / excused:**",
        "",
        "## Agenda",
        "",
        "1.",
        "2.",
        "3.",
        "4.",
        "",
        "## Executive summary",
        "",
        "In 5 lines maximum:",
        "",
        "* Key highlights:",
        "* Major decisions:",
        "* Alerts:",
        "* Arbitrations to follow up:",
        "",
        "## Topic review",
        "",
        "### 1. Business / activity",
        "",
        "* Key KPIs:",
        "* Variance vs target:",
        "* Explanations:",
        "* Decision / direction:",
        "",
        "### 2. Finance / budget",
        "",
        "* Situation:",
        "* Warning points:",
        "* Arbitrations:",
        "",
        "### 3. Operations / delivery",
        "",
        "* Critical topics:",
        "* Capacity / workload:",
        "* Operational risks:",
        "",
        "### 4. HR / organization",
        "",
        "* Hiring:",
        "* Organization:",
        "* Sensitive points:",
        "",
        "### 5. Strategic topics",
        "",
        "* Opportunities:",
        "* Arbitrations:",
        "* Decisions:",
        "",
        "## Executive committee decisions",
        "",
        "* Decision 1:",
        "* Decision 2:",
        "* Decision 3:",
        "",
        "## Agreed actions",
        "",
        "| Action | Sponsor / owner | Due date | Priority level |",
        "| ------ | --------------- | -------- | -------------- |",
        "|        |                 |          |                |",
        "|        |                 |          |                |",
        "|        |                 |          |                |",
        "",
        "## Topics to follow up at the next executive committee",
        "",
        "*",
        "*",
        "*",
        "",
        "## Appendices / reference documents",
        "",
        "*",
        "*",
        "*",
      ].join("\n"),
      brainstorming: [
        "**Meeting minutes - Brainstorming workshop [Topic]**",
        "",
        "**Date:**",
        "**Time:**",
        "**Location / video call:**",
        "**Facilitator:**",
        "**Recorder:**",
        "",
        "## Participants",
        "",
        "*",
        "*",
        "*",
        "",
        "## Workshop objective",
        "",
        "State the problem to solve clearly.",
        "",
        "## Starting question",
        "",
        "*Example: How can we improve [X] without degrading [Y]?*",
        "",
        "## Workshop ground rules",
        "",
        "* No judgment during ideation",
        "* Seek quantity before selection",
        "* Build on each other's ideas",
        "* Stay focused on the topic",
        "",
        "## Ideas generated",
        "",
        "### Theme 1",
        "",
        "*",
        "*",
        "*",
        "",
        "### Theme 2",
        "",
        "*",
        "*",
        "*",
        "",
        "### Theme 3",
        "",
        "*",
        "*",
        "*",
        "",
        "## Groupings / main directions",
        "",
        "* Direction 1:",
        "* Direction 2:",
        "* Direction 3:",
        "",
        "## Selection criteria",
        "",
        "* Impact",
        "* Feasibility",
        "* Cost / effort",
        "* Timeline",
        "* Originality / differentiation",
        "",
        "## Prioritized ideas",
        "",
        "| Idea | Why it stands out | Priority level | Next step |",
        "| ---- | ----------------- | -------------- | --------- |",
        "|      |                   |                |           |",
        "|      |                   |                |           |",
        "|      |                   |                |           |",
        "",
        "## End-of-workshop decisions",
        "",
        "* Ideas to explore:",
        "* Ideas to drop:",
        "* Tests / prototypes to launch:",
        "",
        "## Actions to take",
        "",
        "| Action | Owner | Due date | Comment |",
        "| ------ | ----- | -------- | ------- |",
        "|        |       |          |         |",
        "|        |       |          |         |",
        "|        |       |          |         |",
        "",
        "## Conclusion",
        "",
        "* Key takeaway:",
        "* What still needs exploration:",
        "* Date of the next check-in:",
      ].join("\n"),
    } as const;

    for (const [key, template] of Object.entries(expectedTemplates)) {
      expect(formats.find((format) => format.key === key)?.template).toBe(template);
    }
  });

  it("accepts a direct JSON array and humanizes labels when omitted", () => {
    const formats = resolveSummaryFormatCatalog(
      JSON.stringify([
        {
          key: "upsell-accounting-client",
          description: "Commercial follow-up focused on upsell opportunities with an accounting client.",
          structure: ["# [Meeting title]", "## Commercial context", "## Upsell signals", "## Next actions"],
        },
      ]),
    );

    expect(formats.map((format) => format.key)).toContain("upsell-accounting-client");
    expect(formats.find((format) => format.key === "upsell-accounting-client")).toMatchObject({
      label: "Upsell Accounting Client",
      matchDescription: "Commercial follow-up focused on upsell opportunities with an accounting client.",
      template: "# [Meeting title]\n## Commercial context\n## Upsell signals\n## Next actions",
    });
    expect(formats.at(-1)?.key).toBe(GENERAL_SUMMARY_FORMAT_KEY);
  });

  it("merges custom formats by key and allows overriding built-in templates", () => {
    const formats = resolveSummaryFormatCatalog(
      JSON.stringify({
        formats: [
          {
            key: "client",
            label: "Client meeting",
            matchDescription: "Customer meeting focused on approvals and commitments.",
            template: "# [Meeting title]\n## Customer recap\n## Commitments\n## Next contact",
          },
          {
            key: "general",
            label: "General fallback",
            whenToUse: "Fallback for mixed evidence.",
            template: "# [Meeting title]\n## Key points\n## Actions",
          },
        ],
      }),
    );

    expect(formats.find((format) => format.key === "client")).toMatchObject({
      matchDescription: "Customer meeting focused on approvals and commitments.",
      template: "# [Meeting title]\n## Customer recap\n## Commitments\n## Next contact",
    });
    expect(formats.at(-1)).toMatchObject({
      key: GENERAL_SUMMARY_FORMAT_KEY,
      label: "General fallback",
      template: "# [Meeting title]\n## Key points\n## Actions",
    });
  });

  it("accepts the `structure` string alias for custom templates", () => {
    const formats = resolveSummaryFormatCatalog(
      JSON.stringify([
        {
          key: "ops-review",
          matchDescription: "Operations review focused on incidents, SLAs, and mitigation plans.",
          structure: "# [Meeting title]\n## Incident review\n## Mitigations\n## Next actions",
        },
      ]),
    );

    expect(formats.find((format) => format.key === "ops-review")).toMatchObject({
      template: "# [Meeting title]\n## Incident review\n## Mitigations\n## Next actions",
    });
  });

  it("serializes the merged catalog as stable JSON", () => {
    const serialized = serializeSummaryFormatCatalog(resolveSummaryFormatCatalog());

    expect(serialized).toContain('"formats"');
    expect(serialized).toContain('"key": "project"');
    expect(serialized).toContain('"key": "general"');
  });

  it("rejects invalid summary format JSON", () => {
    expect(() => resolveSummaryFormatCatalog("{")).toThrow("Invalid `summaryFormats` JSON. Expected a JSON array or an object with a `formats` array.");
  });

  it("rejects unsupported top-level shapes and malformed format definitions", () => {
    expect(() => resolveSummaryFormatCatalog(JSON.stringify({ foo: [] }))).toThrow(
      "Invalid `summaryFormats` JSON. Expected a JSON array or an object with a `formats` array.",
    );
    expect(() => resolveSummaryFormatCatalog(JSON.stringify([null]))).toThrow("Invalid summary format at index 0. Expected an object definition.");
    expect(() => resolveSummaryFormatCatalog(JSON.stringify([{}]))).toThrow("Invalid summary format at index 0. Missing non-empty `key`.");
    expect(() =>
      resolveSummaryFormatCatalog(
        JSON.stringify([
          {
            key: "upsell",
            template: "# [Meeting title]\n## Actions",
          },
        ]),
      ),
    ).toThrow('Invalid summary format "upsell". Missing non-empty `matchDescription`, `whenToUse`, or `description`.');
    expect(() =>
      resolveSummaryFormatCatalog(
        JSON.stringify([
          {
            key: "upsell",
            matchDescription: "Sales expansion review.",
            structure: [null, "   "],
          },
        ]),
      ),
    ).toThrow('Invalid summary format "upsell". Missing non-empty `template` or `structure`.');
    expect(() =>
      resolveSummaryFormatCatalog(
        JSON.stringify([
          {
            key: "upsell",
            matchDescription: "Sales expansion review.",
          },
        ]),
      ),
    ).toThrow('Invalid summary format "upsell". Missing non-empty `template` or `structure`.');
  });
});
