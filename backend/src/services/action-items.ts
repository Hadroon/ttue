import { normalizeUrl } from "../utils/url";

/**
 * Registry of the entries the action forms can submit. Each kind says which action it belongs to,
 * whether it is shared or personal, how it nests under a parent entry, and how its fields are validated.
 */

export class ValidationError extends Error {}

type Validator = (value: unknown) => unknown;
type Shape = Record<string, Validator>;

const fail = (message: string): never => {
  throw new ValidationError(message);
};

const text = (label: string, max: number, required = true): Validator => value => {
  if (value === undefined || value === null || value === "") {
    return required ? fail(`${label} is required`) : "";
  }
  if (typeof value !== "string") return fail(`${label} must be text`);
  const trimmed = value.trim();
  if (!trimmed && required) return fail(`${label} is required`);
  if (trimmed.length > max) return fail(`${label} must be at most ${max} characters`);
  return trimmed;
};

const int = (label: string, min: number, max: number, fallback?: number): Validator => value => {
  if ((value === undefined || value === null) && fallback !== undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return fail(`${label} must be a whole number between ${min} and ${max}`);
  }
  return value;
};

const oneOf = (label: string, values: readonly string[], fallback?: string): Validator => value => {
  if ((value === undefined || value === null) && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !values.includes(value)) return fail(`${label} must be one of: ${values.join(", ")}`);
  return value;
};

const bool = (label: string, fallback = false): Validator => value => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") return fail(`${label} must be true or false`);
  return value;
};

const url = (label: string): Validator => value => normalizeUrl(value, 500) ?? fail(`${label} must be a valid http(s) link`);

const optionalUrl = (label: string): Validator => value => (value === undefined || value === null || value === "" ? "" : url(label)(value));

const number = (label: string, min: number, max: number): Validator => value => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return fail(`${label} must be a number between ${min} and ${max}`);
  }
  return value;
};

const timestamp = (label: string): Validator => value => {
  if (typeof value !== "string" || value.length > 40 || Number.isNaN(Date.parse(value))) {
    return fail(`${label} must be a valid date`);
  }
  return new Date(value).toISOString();
};

const list = (label: string, maxItems: number, item: Validator): Validator => value => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return fail(`${label} must be a list`);
  if (value.length > maxItems) return fail(`${label} can have at most ${maxItems} items`);
  return value.map(item);
};

const nullable = (validator: Validator): Validator => value => (value === undefined || value === null ? null : validator(value));

const object = (label: string, shape: Shape): Validator => value => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(`${label} must be an object`);
  return parseShape(shape, value as Record<string, unknown>);
};

function parseShape(shape: Shape, input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, validate] of Object.entries(shape)) out[key] = validate(input[key]);
  return out;
}

// Quadratic voting: casting n votes on a task costs n squared voice credits.
export const VOICE_CREDITS = 100;

const allocationVotes: Validator = value => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("votes must be an object keyed by task id");
  const out: Record<string, number> = {};
  let credits = 0;
  for (const [taskId, votes] of Object.entries(value)) {
    if (!/^\d+$/.test(taskId)) return fail("votes must be keyed by task id");
    const n = int("Votes", 0, 10)(votes) as number;
    if (n === 0) continue;
    out[taskId] = n;
    credits += n * n;
  }
  if (credits > VOICE_CREDITS) return fail(`Votes cost ${credits} credits, more than the ${VOICE_CREDITS} available`);
  return out;
};

export const TASK_STATUSES = ["Open", "Funded", "In Progress", "Verification", "Completed"] as const;

export const ACTION_KEYS = ["legal", "economic", "direct", "policy", "info", "protest"] as const;
export type ActionKey = (typeof ACTION_KEYS)[number];

export interface KindDef {
  actionKey: ActionKey;
  /** shared entries are public; personal entries are only visible to their author */
  scope: "shared" | "personal";
  /** the kind of entry this one hangs off, and whether it must have one */
  parent?: { kind: string; required: boolean };
  /** at most one entry per user (and per parent, when there is a parent); a repeat submit replaces it */
  unique?: boolean;
  /** cap on entries one user may create per challenge */
  maxPerUser: number;
  /** numeric field that is summed across all users per parent, e.g. total pledged */
  sumField?: string;
  /** only rows where this boolean field is true count towards the sum */
  sumWhen?: string;
  /** the server marks new entries `approval: "Pending"`; an admin approves them before they can receive donations */
  approval?: boolean;
  shape: Shape;
  /** checks that span several fields, run after the fields themselves are valid */
  validate?: (data: Record<string, unknown>) => void;
}

export const KINDS: Record<string, KindDef> = {
  // Legal action
  case: {
    actionKey: "legal", scope: "shared", maxPerUser: 10, approval: true,
    shape: {
      target: text("Target entity", 200),
      jurisdiction: text("Jurisdiction", 200),
      basis: text("Legal basis", 100),
      budget: int("Retainer budget", 0, 1_000_000_000),
      lead: text("Legal lead", 200, false),
    },
  },
  filing: {
    actionKey: "legal", scope: "shared", parent: { kind: "case", required: true }, maxPerUser: 50,
    shape: { title: text("Filing title", 200), url: url("Filing link") },
  },
  evidence: {
    actionKey: "legal", scope: "shared", parent: { kind: "case", required: false }, maxPerUser: 100,
    shape: {
      name: text("File name", 255),
      size: int("File size", 0, 5_000_000_000),
      sha256: value => (typeof value === "string" && /^[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : fail("sha256 must be a 64 character hex digest")),
      confidentiality: oneOf("Confidentiality", ["Public", "Redacted", "Court-only"]),
      capturedAt: timestamp("Capture time"),
      location: text("Location", 200, false),
      device: text("Device", 200, false),
    },
  },
  lawyer_request: {
    actionKey: "legal", scope: "personal", unique: true, maxPerUser: 1,
    shape: { name: text("Name", 200), jurisdiction: text("Jurisdiction", 200) },
  },
  // Donations to a case go through Stripe and are recorded in the donations table, not here

  // Economic pressure
  target: {
    actionKey: "economic", scope: "shared", maxPerUser: 20,
    shape: {
      brand: text("Brand", 200),
      parent: text("Parent company", 200, false),
      alternative: nullable(object("Alternative", { name: text("Alternative name", 200), note: text("Alternative note", 500, false) })),
    },
  },
  // Anyone can map a sub-brand to a target; the citation lets others check it
  subsidiary: {
    actionKey: "economic", scope: "shared", parent: { kind: "target", required: true }, maxPerUser: 100,
    shape: { name: text("Sub-brand", 200), citation: url("Citation link") },
  },
  pledge: {
    actionKey: "economic", scope: "personal", parent: { kind: "target", required: true }, unique: true, maxPerUser: 50, sumField: "monthly",
    shape: {
      kind: oneOf("Pledge type", ["boycott", "buycott"]),
      monthly: int("Monthly amount", 0, 100_000),
      duration: text("Duration", 50, false),
      alternative: text("Alternative", 200, false),
    },
  },

  // Direct action
  task: {
    actionKey: "direct", scope: "shared", maxPerUser: 20, approval: true,
    shape: {
      title: text("Task title", 200),
      skills: list("Skills", 10, text("Skill", 50)),
      cost: int("Cost", 0, 1_000_000_000),
      milestones: list("Milestones", 20, text("Milestone", 200)),
      location: text("Location", 200, false),
      status: oneOf("Status", TASK_STATUSES, "Open"),
    },
  },
  application: {
    actionKey: "direct", scope: "personal", parent: { kind: "task", required: true }, unique: true, maxPerUser: 50,
    shape: { note: text("Note", 1000), availability: text("Availability", 200, false), tools: text("Tools", 200, false) },
  },
  proof: {
    actionKey: "direct", scope: "shared", parent: { kind: "task", required: true }, unique: true, maxPerUser: 50,
    shape: {
      beforeUrl: url("Before link"),
      afterUrl: url("After link"),
      note: text("Note", 1000, false),
      milestonesDone: int("Milestones done", 0, 20),
      receipts: int("Receipts", 0, 1000),
    },
  },
  allocation: {
    actionKey: "direct", scope: "personal", unique: true, maxPerUser: 1,
    shape: { votes: allocationVotes },
  },

  // Policy & lobbying
  bill_draft: {
    actionKey: "policy", scope: "personal", unique: true, maxPerUser: 1,
    shape: {
      title: text("Title", 200, false),
      intent: text("Intent", 2000, false),
      amendments: list("Amendments", 50, object("Amendment", {
        section: text("Section", 200),
        oldText: text("Current text", 5000, false),
        newText: text("Proposed text", 5000, false),
      })),
      impact: text("Impact", 5000, false),
      citations: text("Citations", 5000, false),
    },
  },
  representative: {
    actionKey: "policy", scope: "personal", maxPerUser: 20,
    shape: {
      name: text("Name", 200),
      office: text("Office", 200, false),
      email: text("Email", 200, false),
      phone: text("Phone", 50, false),
    },
  },
  outreach: {
    actionKey: "policy", scope: "personal", unique: true, maxPerUser: 1,
    shape: {
      postalCode: text("Postal code", 20, false),
      email: int("Emails", 0, 1_000_000, 0),
      call: int("Calls", 0, 1_000_000, 0),
      mail: int("Letters", 0, 1_000_000, 0),
    },
  },

  // Information campaigns
  media: {
    actionKey: "info", scope: "shared", maxPerUser: 50,
    shape: {
      title: text("Title", 200),
      type: oneOf("Type", ["Infographic", "Logo", "Video", "Press kit"]),
      url: url("Link"),
      license: text("License", 100, false),
    },
  },
  resolution: {
    actionKey: "info", scope: "shared", maxPerUser: 10,
    shape: {
      ticker: text("Ticker", 20),
      text: text("Resolution text", 5000),
      threshold: int("Share threshold", 0, 1_000_000_000),
    },
  },
  resolution_cosponsor: {
    actionKey: "info", scope: "personal", parent: { kind: "resolution", required: true }, unique: true, maxPerUser: 50, sumField: "shares", sumWhen: "cosponsor",
    shape: { shares: int("Shares", 0, 1_000_000_000), cosponsor: bool("Cosponsor") },
  },

  // Protests and public gatherings
  protest: {
    actionKey: "protest", scope: "shared", maxPerUser: 20,
    shape: {
      title: text("Title", 200),
      description: text("Description", 2000, false),
      startsAt: timestamp("Start time"),
      endsAt: nullable(timestamp("End time")),
      place: text("Meeting point", 200),
      city: text("City", 100),
      country: text("Country", 100, false),
      lat: nullable(number("Latitude", -90, 90)),
      lng: nullable(number("Longitude", -180, 180)),
      organizerName: text("Organiser", 200),
      organizerUrl: optionalUrl("Organiser link"),
    },
    validate: data => {
      if (data.endsAt && String(data.endsAt) < String(data.startsAt)) fail("The end time must be after the start time");
      if ((data.lat === null) !== (data.lng === null)) fail("Give both latitude and longitude, or neither");
    },
  },
};

export function getKind(kind: unknown): KindDef | null {
  return typeof kind === "string" && Object.hasOwn(KINDS, kind) ? KINDS[kind] : null;
}

/** Validate and clean an entry's fields; unknown fields are dropped. Throws ValidationError. */
export function parseItemData(def: KindDef, input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("data must be an object");
  const data = parseShape(def.shape, input as Record<string, unknown>);
  def.validate?.(data);
  return data;
}
