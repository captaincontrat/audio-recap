export interface SummaryFormatDefinition {
  key: string;
  label: string;
  matchDescription: string;
  template: string;
}

export const GENERAL_SUMMARY_FORMAT_KEY = "general";
const GENERAL_SUMMARY_FORMAT: SummaryFormatDefinition = {
  key: GENERAL_SUMMARY_FORMAT_KEY,
  label: "General meeting",
  matchDescription:
    "Fallback format for meetings that do not clearly match a more specific type, or when the evidence is too mixed or too weak to choose a specialized template confidently.",
  template: [
    "# [Meeting title]",
    "## Participants",
    "## Objective",
    "## Agenda",
    "## Key discussion points",
    "## Decisions",
    "## Action items",
    "## Open questions",
    "## Risks and watchouts",
    "## Next steps",
    "## References",
    "",
    "In `## Action items`, prefer a table with columns `Action | Owner | Due date | Notes` when supported by the source material.",
  ].join("\n"),
};

const BUILT_IN_SUMMARY_FORMATS_DATA: ReadonlyArray<SummaryFormatDefinition> = [
  {
    key: "project",
    label: "Project meeting",
    matchDescription: "Project or delivery follow-up focused on milestones, status, blockers, priorities, dependencies, risks, and next execution steps.",
    template: [
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
  },
  {
    key: "client",
    label: "Client meeting",
    matchDescription:
      "Client-facing meeting covering customer goals, validations, objections, commitments, delivery expectations, satisfaction, or commercial follow-up.",
    template: [
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
  },
  {
    key: "codir",
    label: "Executive committee",
    matchDescription:
      "Executive, leadership, or management committee meeting covering business performance, budget, operations, organization, strategic arbitrations, or top-level risks.",
    template: [
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
  },
  {
    key: "brainstorming",
    label: "Brainstorming workshop",
    matchDescription:
      "Creative or discovery workshop focused on generating ideas, exploring options, clustering themes, prioritizing concepts, or selecting experiments.",
    template: [
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
  },
  GENERAL_SUMMARY_FORMAT,
];

export const BUILT_IN_SUMMARY_FORMATS = BUILT_IN_SUMMARY_FORMATS_DATA.map(cloneSummaryFormat);

export function resolveSummaryFormatCatalog(summaryFormats?: string): SummaryFormatDefinition[] {
  const customFormats = parseSummaryFormats(summaryFormats);
  const mergedFormats = mergeSummaryFormats(BUILT_IN_SUMMARY_FORMATS_DATA, customFormats);

  return mergedFormats.map(cloneSummaryFormat);
}

export function serializeSummaryFormatCatalog(formats: ReadonlyArray<SummaryFormatDefinition>): string {
  return JSON.stringify(
    {
      formats: formats.map((format) => ({
        key: format.key,
        label: format.label,
        matchDescription: format.matchDescription,
        template: format.template,
      })),
    },
    null,
    2,
  );
}

function parseSummaryFormats(summaryFormats?: string): SummaryFormatDefinition[] {
  const normalizedInput = summaryFormats?.trim() ?? "";

  if (!normalizedInput) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(normalizedInput);
  } catch (error) {
    throw new Error("Invalid `summaryFormats` JSON. Expected a JSON array or an object with a `formats` array.", {
      cause: error,
    });
  }

  const rawFormats = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.formats) ? parsed.formats : null;

  if (!rawFormats) {
    throw new Error("Invalid `summaryFormats` JSON. Expected a JSON array or an object with a `formats` array.");
  }

  return rawFormats.map((rawFormat, index) => normalizeSummaryFormatDefinition(rawFormat, index));
}

function mergeSummaryFormats(
  builtInFormats: ReadonlyArray<SummaryFormatDefinition>,
  customFormats: ReadonlyArray<SummaryFormatDefinition>,
): SummaryFormatDefinition[] {
  const mergedMap = new Map<string, SummaryFormatDefinition>();

  for (const format of builtInFormats) {
    if (format.key === GENERAL_SUMMARY_FORMAT_KEY) {
      continue;
    }

    mergedMap.set(format.key, cloneSummaryFormat(format));
  }

  for (const format of customFormats) {
    if (format.key === GENERAL_SUMMARY_FORMAT_KEY) {
      continue;
    }

    mergedMap.set(format.key, cloneSummaryFormat(format));
  }

  const resolvedGeneralFormat = customFormats.find((format) => format.key === GENERAL_SUMMARY_FORMAT_KEY) ?? GENERAL_SUMMARY_FORMAT;

  mergedMap.set(GENERAL_SUMMARY_FORMAT_KEY, cloneSummaryFormat(resolvedGeneralFormat));

  return Array.from(mergedMap.values());
}

function normalizeSummaryFormatDefinition(rawFormat: unknown, index: number): SummaryFormatDefinition {
  if (!isRecord(rawFormat)) {
    throw new Error(`Invalid summary format at index ${index}. Expected an object definition.`);
  }

  const key = readRequiredString(rawFormat, ["key"], `Invalid summary format at index ${index}. Missing non-empty \`key\`.`).toLowerCase();
  const matchDescription = readRequiredString(
    rawFormat,
    ["matchDescription", "whenToUse", "description"],
    `Invalid summary format "${key}". Missing non-empty \`matchDescription\`, \`whenToUse\`, or \`description\`.`,
  );
  const template = readRequiredTemplate(rawFormat, `Invalid summary format "${key}". Missing non-empty \`template\` or \`structure\`.`);
  const label = readOptionalString(rawFormat, ["label"]) ?? humanizeSummaryFormatKey(key);

  return {
    key,
    label,
    matchDescription,
    template,
  };
}

function readRequiredTemplate(rawFormat: Record<string, unknown>, errorMessage: string): string {
  const explicitTemplate = readOptionalString(rawFormat, ["template"]);

  if (explicitTemplate) {
    return explicitTemplate;
  }

  const rawStructure = rawFormat.structure;

  if (typeof rawStructure === "string" && rawStructure.trim().length > 0) {
    return rawStructure.trim();
  }

  if (Array.isArray(rawStructure)) {
    const structureLines = rawStructure.filter((line): line is string => typeof line === "string" && line.trim().length > 0).map((line) => line.trim());

    if (structureLines.length > 0) {
      return structureLines.join("\n");
    }
  }

  throw new Error(errorMessage);
}

function readRequiredString(rawFormat: Record<string, unknown>, keys: string[], errorMessage: string): string {
  const value = readOptionalString(rawFormat, keys);

  if (!value) {
    throw new Error(errorMessage);
  }

  return value;
}

function readOptionalString(rawFormat: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = rawFormat[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function humanizeSummaryFormatKey(key: string): string {
  return key
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function cloneSummaryFormat(format: SummaryFormatDefinition): SummaryFormatDefinition {
  return {
    key: format.key,
    label: format.label,
    matchDescription: format.matchDescription,
    template: format.template,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
