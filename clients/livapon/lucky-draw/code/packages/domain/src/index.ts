export type ParticipantCategory = {
  id: string;
  code: string;
  capacityWeight: number;
};

export type ParticipantCount = {
  participantCategoryId: string;
  quantity: number;
};

export type CapacityResult = {
  attendeeCount: number;
  capacityWeight: number;
};

export type CapacityEvaluation = {
  status: "AVAILABLE" | "CAPACITY_CONFLICT";
  requestedWeight: number;
  remainingWeight: number;
};

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_CONFIRMED"
  | "CONFIRMED"
  | "CANCEL_REQUESTED"
  | "CANCELLATION_APPROVED"
  | "CANCELLED"
  | "COMPLETED"
  | "NO_SHOW"
  | "CAPACITY_CONFLICT"
  | "PROVIDER_CANCELLED";

export type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "SUSPENDED";

export type SessionReservationStatus = "RESERVED" | "COMPLETED" | "CANCELLED";

export type ReservationDenyReason =
  | "ENROLLMENT_NOT_ACTIVE"
  | "ALREADY_RESERVED"
  | "KIT_NOT_SHIPPED"
  | "PREVIOUS_NOT_COMPLETED";

export function sumParticipantWeights(
  categories: ParticipantCategory[],
  counts: ParticipantCount[]
): CapacityResult {
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  return counts.reduce<CapacityResult>(
    (total, count) => {
      const category = categoryById.get(count.participantCategoryId);
      if (!category) {
        throw new Error(`Unknown participant category: ${count.participantCategoryId}`);
      }

      return {
        attendeeCount: total.attendeeCount + count.quantity,
        capacityWeight: total.capacityWeight + count.quantity * category.capacityWeight
      };
    },
    { attendeeCount: 0, capacityWeight: 0 }
  );
}

export function evaluateCapacity(input: {
  slotCapacity: number;
  existingWeight: number;
  categories: ParticipantCategory[];
  requestedCounts: ParticipantCount[];
}): CapacityEvaluation {
  const requested = sumParticipantWeights(input.categories, input.requestedCounts);
  const availableWeight = input.slotCapacity - input.existingWeight;
  const remainingWeight = Math.max(0, availableWeight - requested.capacityWeight);

  return {
    status: requested.capacityWeight <= availableWeight ? "AVAILABLE" : "CAPACITY_CONFLICT",
    requestedWeight: requested.capacityWeight,
    remainingWeight
  };
}

const allowedSessionReservationTransitions: Record<SessionReservationStatus, SessionReservationStatus[]> = {
  RESERVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};

export function canTransitionSessionReservation(
  from: SessionReservationStatus,
  to: SessionReservationStatus
): boolean {
  return allowedSessionReservationTransitions[from]?.includes(to) ?? false;
}

// Time-based session completion: a reserved session is "done" once its slot end
// time has passed and the slot was not cancelled. No attendance measurement (B3).
export function evaluateSessionCompletion(input: {
  slotEndsAt: Date;
  slotCancelled: boolean;
  now: Date;
}): { completed: boolean; completedAt?: Date } {
  if (input.slotCancelled) {
    return { completed: false };
  }
  if (input.now.getTime() >= input.slotEndsAt.getTime()) {
    return { completed: true, completedAt: input.slotEndsAt };
  }
  return { completed: false };
}

// Progressive gate for reserving a course session (B2). The first session is
// gated by kit shipment; every later session is gated by completing the previous
// one. sequenceNo is 1-based in course order.
export function canReserveSession(input: {
  enrollmentStatus: EnrollmentStatus;
  kitShipped: boolean;
  sequenceNo: number;
  alreadyReserved: boolean;
  previousSessionCompleted: boolean;
}): { allowed: boolean; reason?: ReservationDenyReason } {
  if (input.enrollmentStatus !== "ACTIVE") {
    return { allowed: false, reason: "ENROLLMENT_NOT_ACTIVE" };
  }
  if (input.alreadyReserved) {
    return { allowed: false, reason: "ALREADY_RESERVED" };
  }
  if (!input.kitShipped) {
    return { allowed: false, reason: "KIT_NOT_SHIPPED" };
  }
  if (input.sequenceNo > 1 && !input.previousSessionCompleted) {
    return { allowed: false, reason: "PREVIOUS_NOT_COMPLETED" };
  }
  return { allowed: true };
}

// Course session slots are single-seat (no participant categories), so capacity
// is a headcount. `capacity <= 0` means the slot has not been opened yet — that
// is reported as NOT_OPEN, never as a silent "full".
export function evaluateSessionSlotCapacity(input: {
  capacity: number;
  reservedCount: number;
}): "AVAILABLE" | "FULL" | "NOT_OPEN" {
  if (input.capacity <= 0) {
    return "NOT_OPEN";
  }
  if (input.reservedCount >= input.capacity) {
    return "FULL";
  }
  return "AVAILABLE";
}

export type CourseSessionProgress = {
  sessionId: string;
  sequenceNo: number;
  reserved: boolean;
  completed: boolean;
  reservable: { allowed: boolean; reason?: ReservationDenyReason };
};

// Assembles a learner's progress through a course: per-session reserved/completed
// state, whether each session is currently reservable (progressive gate), and
// whether the whole course is complete (final session held). Pure — the API layer
// feeds it loaded rows and persists the completion result.
export function evaluateCourseProgress(input: {
  enrollmentStatus: EnrollmentStatus;
  kitShipped: boolean;
  now: Date;
  sessions: Array<{ id: string; sequenceNo: number }>;
  reservations: Array<{
    sessionId: string;
    status: SessionReservationStatus;
    slotEndsAt: Date;
    slotCancelled: boolean;
  }>;
}): { sessions: CourseSessionProgress[]; courseCompleted: boolean; courseCompletedAt?: Date } {
  const ordered = [...input.sessions].sort((a, b) => a.sequenceNo - b.sequenceNo);
  const activeReservationBySession = new Map(
    input.reservations.filter((reservation) => reservation.status !== "CANCELLED").map((reservation) => [reservation.sessionId, reservation])
  );

  const sessions: CourseSessionProgress[] = [];
  let previousSessionCompleted = false;
  for (const session of ordered) {
    const reservation = activeReservationBySession.get(session.id);
    const reserved = reservation != null;
    const completed = reservation
      ? evaluateSessionCompletion({ slotEndsAt: reservation.slotEndsAt, slotCancelled: reservation.slotCancelled, now: input.now }).completed
      : false;
    const reservable = canReserveSession({
      enrollmentStatus: input.enrollmentStatus,
      kitShipped: input.kitShipped,
      sequenceNo: session.sequenceNo,
      alreadyReserved: reserved,
      previousSessionCompleted
    });
    sessions.push({ sessionId: session.id, sequenceNo: session.sequenceNo, reserved, completed, reservable });
    previousSessionCompleted = completed;
  }

  const finalSession = sessions[sessions.length - 1];
  const finalReservation = finalSession ? activeReservationBySession.get(finalSession.sessionId) : undefined;
  const courseCompleted = finalSession?.completed ?? false;

  return {
    sessions,
    courseCompleted,
    courseCompletedAt: courseCompleted && finalReservation ? finalReservation.slotEndsAt : undefined
  };
}

export function calculateCancellationQuote(input: {
  requestedAt: Date;
  slotStartsAt: Date;
  totalAmountCents: number;
  timeZone: string;
}): { feeRate: number; feeAmountCents: number; refundAmountCents: number } {
  const daysBefore = calendarDaysBetween(input.requestedAt, input.slotStartsAt, input.timeZone);
  let feeRate = 1;

  if (daysBefore >= 7) {
    feeRate = 0;
  } else if (daysBefore >= 2) {
    feeRate = 0.3;
  } else if (daysBefore >= 1) {
    feeRate = 0.5;
  }

  const feeAmountCents = Math.round(input.totalAmountCents * feeRate);

  return {
    feeRate,
    feeAmountCents,
    refundAmountCents: Math.max(0, input.totalAmountCents - feeAmountCents)
  };
}

export function evaluateCourseCompletion(input: {
  enrollmentStatus: EnrollmentStatus;
  finalSessionBookingStatus: BookingStatus;
  finalSlotEndsAt: Date;
  finalSlotCancelled: boolean;
  now: Date;
}): { completed: boolean; completedAt?: Date; reason?: string } {
  if (input.enrollmentStatus !== "ACTIVE") {
    return { completed: false, reason: "ENROLLMENT_NOT_ACTIVE" };
  }

  if (input.finalSessionBookingStatus !== "CONFIRMED") {
    return { completed: false, reason: "FINAL_SESSION_NOT_CONFIRMED" };
  }

  if (input.finalSlotCancelled) {
    return { completed: false, reason: "FINAL_SLOT_CANCELLED" };
  }

  if (input.finalSlotEndsAt.getTime() > input.now.getTime()) {
    return { completed: false, reason: "FINAL_SLOT_NOT_ENDED" };
  }

  return { completed: true, completedAt: input.now };
}

export function evaluatePremiumEligibility(input: {
  loggedIn: boolean;
  enrollmentStatus?: EnrollmentStatus;
  courseCompleted: boolean;
  suspended: boolean;
  refunded: boolean;
  now: Date;
  saleStartsAt?: Date;
  saleEndsAt?: Date;
}): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!input.loggedIn) {
    reasons.push("LOGIN_REQUIRED");
  }

  if (input.enrollmentStatus !== "ACTIVE" && input.enrollmentStatus !== "COMPLETED") {
    reasons.push("ENROLLMENT_NOT_ACTIVE");
  }

  if (!input.courseCompleted) {
    reasons.push("COURSE_NOT_COMPLETED");
  }

  if (input.suspended) {
    reasons.push("USER_SUSPENDED");
  }

  if (input.refunded) {
    reasons.push("ORDER_REFUNDED");
  }

  if (input.saleStartsAt && input.now < input.saleStartsAt) {
    reasons.push("SALE_NOT_STARTED");
  }

  if (input.saleEndsAt && input.now > input.saleEndsAt) {
    reasons.push("SALE_ENDED");
  }

  return { eligible: reasons.length === 0, reasons };
}

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return allowedBookingTransitions[from]?.includes(to) ?? false;
}

export function canTransitionEnrollment(from: EnrollmentStatus, to: EnrollmentStatus): boolean {
  return allowedEnrollmentTransitions[from]?.includes(to) ?? false;
}

const allowedBookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: ["PAYMENT_CONFIRMED"],
  PAYMENT_CONFIRMED: ["CONFIRMED", "CAPACITY_CONFLICT"],
  CONFIRMED: ["COMPLETED", "CANCEL_REQUESTED", "PROVIDER_CANCELLED", "NO_SHOW"],
  CANCEL_REQUESTED: ["CANCELLATION_APPROVED"],
  CANCELLATION_APPROVED: ["CANCELLED"],
  CANCELLED: [],
  COMPLETED: [],
  NO_SHOW: [],
  // A CAPACITY_CONFLICT booking is paid but unseated; a provider-initiated slot
  // cancellation must be able to refund it (otherwise the captured money is stranded).
  CAPACITY_CONFLICT: ["PROVIDER_CANCELLED"],
  PROVIDER_CANCELLED: []
};

const allowedEnrollmentTransitions: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  ACTIVE: ["COMPLETED", "CANCELLED", "SUSPENDED"],
  COMPLETED: [],
  CANCELLED: [],
  SUSPENDED: ["ACTIVE", "CANCELLED"]
};

// Cancellation fee tiers are day counts as observed at the event's own
// location (e.g. JST for Japan-held experiences), not UTC. A slot starting
// before 09:00 JST falls on the previous UTC calendar date, so a naive
// UTC-based day count shifts every tier boundary a full day — see issue #33.
function calendarDaysBetween(from: Date, to: Date, timeZone: string): number {
  const fromDate = calendarDateAsUtcMidnight(from, timeZone);
  const toDate = calendarDateAsUtcMidnight(to, timeZone);

  return Math.floor((toDate - fromDate) / 86_400_000);
}

function calendarDateAsUtcMidnight(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);

  return Date.UTC(get("year"), get("month") - 1, get("day"));
}

// ISO 4217 currencies whose minor unit is not the default 2 decimal places.
// The store's presentment currency drives how a money amount maps to integer
// minor units; JPY (zero-decimal) must NOT be multiplied by 100.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG",
  "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"
]);

const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

/** Number of minor-unit decimal places for an ISO 4217 currency code (default 2). */
export function currencyDecimals(currencyCode: string): number {
  const code = currencyCode.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return 0;
  }
  if (THREE_DECIMAL_CURRENCIES.has(code)) {
    return 3;
  }
  return 2;
}

/**
 * Convert a major-unit money amount (e.g. ¥18,000 or $12.34) into integer minor
 * units for storage. Zero-decimal currencies (JPY) use a factor of 1.
 */
export function toMinorUnits(amount: string | number | undefined | null, currencyCode: string): number {
  const factor = 10 ** currencyDecimals(currencyCode);
  return Math.round(Number(amount ?? 0) * factor);
}

/**
 * Convert integer minor units back into a major-unit money amount for display or
 * for handing an amount to Shopify. Inverse of {@link toMinorUnits}.
 */
export function fromMinorUnits(minor: number, currencyCode: string): number {
  const factor = 10 ** currencyDecimals(currencyCode);
  return minor / factor;
}

export type RaffleCampaignConfig = {
  campaignCode: string;
  opensAt: Date;
  closesAt: Date;
  serialDigits: number;
};

// Single fixed campaign for the 2026 LIVAPON Japan Festival raffle (Canada).
// Both instants fall inside DST (America/Toronto, EDT/UTC-4), so they are
// hardcoded as UTC rather than pulled through a timezone library:
// Aug 1 2026 00:00 EDT and Aug 15 2026 18:00 EDT.
export const RAFFLE_CAMPAIGNS: Record<string, RaffleCampaignConfig> = {
  ca26: {
    campaignCode: "ca26",
    opensAt: new Date("2026-08-01T04:00:00.000Z"),
    closesAt: new Date("2026-08-15T22:00:00.000Z"),
    serialDigits: 6
  }
};

export function getRaffleCampaign(campaignCode: string): RaffleCampaignConfig | undefined {
  return RAFFLE_CAMPAIGNS[campaignCode];
}

/** Display-facing raffle number, e.g. formatRaffleSerialNumber("ca26", 123) -> "ca26-000123". */
export function formatRaffleSerialNumber(campaignCode: string, serialNumber: number, digits = 6): string {
  return `${campaignCode}-${String(serialNumber).padStart(digits, "0")}`;
}

export type RaffleWindowStatus = "BEFORE_OPEN" | "OPEN" | "CLOSED";

/** Entries are accepted from opensAt through closesAt, inclusive of both endpoints. */
export function getRaffleWindowStatus(now: Date, opensAt: Date, closesAt: Date): RaffleWindowStatus {
  if (now.getTime() < opensAt.getTime()) {
    return "BEFORE_OPEN";
  }
  if (now.getTime() > closesAt.getTime()) {
    return "CLOSED";
  }
  return "OPEN";
}
