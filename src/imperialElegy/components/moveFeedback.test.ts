import {
  canProbeRefusal,
  FEEDBACK_POLL_MS,
  FEEDBACK_TIMEOUT_MS,
  FEEDBACK_TIMEOUT_REMOTE_MS,
  feedbackTimeoutMs,
  moveWasRefused,
  refusalNotice,
} from "./moveFeedback";

const bi = (en: string, zh: string): string => en;

describe("refusal detection", () => {
  test("a state counter that did not advance means the engine refused the move", () => {
    expect(moveWasRefused(7, 7)).toBe(true);
    expect(moveWasRefused(7, undefined)).toBe(false);
    expect(moveWasRefused(7, 8)).toBe(false);
  });

  test("the board only probes when the host supplies a counter", () => {
    expect(canProbeRefusal(0)).toBe(true);
    expect(canProbeRefusal(12)).toBe(true);
    expect(canProbeRefusal(undefined)).toBe(false);
  });

  test("hotseat reacts fast, remote waits for a queued update", () => {
    expect(feedbackTimeoutMs(true)).toBe(FEEDBACK_TIMEOUT_MS);
    expect(feedbackTimeoutMs(false)).toBe(FEEDBACK_TIMEOUT_REMOTE_MS);
    expect(FEEDBACK_TIMEOUT_MS).toBeLessThan(FEEDBACK_TIMEOUT_REMOTE_MS);
    expect(FEEDBACK_POLL_MS).toBeLessThan(FEEDBACK_TIMEOUT_MS);
  });
});

describe("refusal notice", () => {
  test("names the action and carries the UI's own reason", () => {
    const notice = refusalNotice({label: "Declare war (3 CP)", reason: "Needs 3 CP in this impulse."}, bi);
    expect(notice).toEqual({
      title: "Not allowed: Declare war (3 CP)",
      body: "Needs 3 CP in this impulse.",
      tone: "warn",
    });
  });

  test("falls back to a generic body when the control has no reason", () => {
    const notice = refusalNotice({label: "Move unit"}, bi);
    expect(notice.title).toBe("Not allowed: Move unit");
    expect(notice.body).toContain("rules do not allow");
    expect(notice.tone).toBe("warn");
  });

  test("is bilingual when the locale is Chinese", () => {
    const zh = (en: string, _zh: string): string => _zh;
    const notice = refusalNotice({label: "宣战"}, zh);
    expect(notice.title).toBe("无法执行：宣战");
    expect(notice.body).toContain("当前规则");
  });
});
