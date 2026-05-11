import {
  classifyShortActivity,
  SHORT_ACTIVITY_MIN_DURATION_S,
  SHORT_ACTIVITY_MIN_STROKES,
} from "@/lib/activity/short-activity";

describe("classifyShortActivity", () => {
  it("returns null when both thresholds are met exactly", () => {
    expect(
      classifyShortActivity(
        SHORT_ACTIVITY_MIN_STROKES,
        SHORT_ACTIVITY_MIN_DURATION_S,
      ),
    ).toBeNull();
  });

  it("returns null for an obviously valid recording", () => {
    expect(classifyShortActivity(120, 600)).toBeNull();
  });

  it("flags fewStrokes when strokes are below the threshold but duration is long enough", () => {
    expect(
      classifyShortActivity(
        SHORT_ACTIVITY_MIN_STROKES - 1,
        SHORT_ACTIVITY_MIN_DURATION_S,
      ),
    ).toBe("fewStrokes");
  });

  it("flags shortDuration when duration is below the threshold but strokes are enough", () => {
    expect(
      classifyShortActivity(
        SHORT_ACTIVITY_MIN_STROKES,
        SHORT_ACTIVITY_MIN_DURATION_S - 0.1,
      ),
    ).toBe("shortDuration");
  });

  it("flags both when neither threshold is met", () => {
    expect(classifyShortActivity(0, 0)).toBe("both");
    expect(
      classifyShortActivity(
        SHORT_ACTIVITY_MIN_STROKES - 1,
        SHORT_ACTIVITY_MIN_DURATION_S - 0.1,
      ),
    ).toBe("both");
  });

  it("treats just under the stroke threshold as fewStrokes", () => {
    expect(classifyShortActivity(9, 60)).toBe("fewStrokes");
  });

  it("treats just under the duration threshold as shortDuration", () => {
    expect(classifyShortActivity(50, 29.9)).toBe("shortDuration");
  });

  it("coerces non-finite inputs to 0 so a malformed recording trips the prompt", () => {
    expect(classifyShortActivity(Number.NaN, Number.NaN)).toBe("both");
    expect(classifyShortActivity(Number.POSITIVE_INFINITY, 60)).toBe(
      "fewStrokes",
    );
    expect(classifyShortActivity(50, Number.POSITIVE_INFINITY)).toBe(
      "shortDuration",
    );
  });

  it("treats negative inputs as below threshold", () => {
    expect(classifyShortActivity(-5, -1)).toBe("both");
  });
});
