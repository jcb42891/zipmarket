import assert from "node:assert/strict";
import test from "node:test";

import { reduceInfoChipOpenState } from "./info-chip";

test("reduceInfoChipOpenState toggles open and closed", () => {
  assert.equal(reduceInfoChipOpenState(false, { type: "toggle" }), true);
  assert.equal(reduceInfoChipOpenState(true, { type: "toggle" }), false);
});

test("reduceInfoChipOpenState dismisses on explicit dismiss and escape key", () => {
  assert.equal(reduceInfoChipOpenState(true, { type: "dismiss" }), false);
  assert.equal(reduceInfoChipOpenState(true, { type: "keydown", key: "Escape" }), false);
  assert.equal(reduceInfoChipOpenState(true, { type: "keydown", key: "Enter" }), true);
});

test("reduceInfoChipOpenState dismisses on outside pointer down only", () => {
  assert.equal(
    reduceInfoChipOpenState(true, {
      type: "outside_pointer_down",
      isTargetInside: false
    }),
    false
  );
  assert.equal(
    reduceInfoChipOpenState(true, {
      type: "outside_pointer_down",
      isTargetInside: true
    }),
    true
  );
});
