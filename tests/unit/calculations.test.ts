import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRound } from "../../src/calculations/index.ts";
import {
  createLevelOneLoadQuestion,
  createLevelOneLoadRound,
  createLevelOnePackQuestion,
  createLevelOnePackRound,
  createLevelOneShipQuestion,
  createLevelOneShipRound,
} from "../../src/calculations/level-1/round-1.ts";

describe("Pack It calculations", () => {
  it("creates a deterministic Level 1 Load question", () => {
    const question = createLevelOneLoadQuestion([], () => 0);

    assert.deepEqual(question, {
      level: 1,
      round: "load",
      subtype: "find-unit",
      pair: {
        item: "apple",
        itemPlural: "apples",
        container: "crate",
        containerPlural: "crates",
        itemEmoji: "🍎",
        containerEmoji: "📦",
        palette: "#dc2626",
      },
      totalA: 4,
      groupsA: 2,
      unitRate: 2,
      answer: 2,
      answerUnit: "apples per crate",
      questionText: "There are 4 apples that have to be packed equally into 2 crates. How many shall each crate have?",
      blackboardSteps: [
        "Total apples = 4.",
        "Total crates = 2.",
        "∴ Apples per crate = 4 ÷ 2 = 2.",
      ],
      isFraction: false,
    });
  });

  it("creates ten Level 1 Load questions with bounded values", () => {
    const round = createLevelOneLoadRound(() => 0.25);

    assert.equal(round.level, 1);
    assert.equal(round.round, "load");
    assert.equal(round.questions.length, 10);

    for (const question of round.questions) {
      assert.equal(question.subtype, "find-unit");
      assert.ok(question.groupsA >= 2 && question.groupsA <= 4);
      assert.ok(question.unitRate >= 2 && question.unitRate <= 6);
      assert.equal(question.totalA, question.groupsA * question.unitRate);
      assert.ok(question.totalA <= 24);
    }
  });

  it("creates the other Level 1 rounds with matching round names", () => {
    const packRound = createLevelOnePackRound(() => 0.25);
    const shipRound = createLevelOneShipRound(() => 0.25);

    assert.equal(packRound.round, "pack");
    assert.equal(shipRound.round, "ship");
    assert.ok(packRound.questions.every((question) => question.round === "pack"));
    assert.ok(shipRound.questions.every((question) => question.round === "ship"));
  });

  it("uses larger value ranges for Level 1 Pack and Ship", () => {
    const packQuestion = createLevelOnePackQuestion([], () => 0.99);
    const shipQuestion = createLevelOneShipQuestion([], () => 0.99);

    assert.ok(packQuestion.groupsA >= 4 && packQuestion.groupsA <= 5);
    assert.ok(packQuestion.unitRate <= 8);
    assert.ok(packQuestion.totalA <= 40);
    assert.ok(packQuestion.totalA >= 10 && packQuestion.totalA <= 99);
    assert.ok(shipQuestion.groupsA >= 4 && shipQuestion.groupsA <= 5);
    assert.ok(shipQuestion.unitRate <= 8);
    assert.ok(shipQuestion.totalA <= 40);
    assert.ok(shipQuestion.totalA >= 10 && shipQuestion.totalA <= 99);
  });

  it("does not repeat the same Level 1 Load question wording twice in a row", () => {
    const round = createLevelOneLoadRound(() => 0);

    for (let index = 1; index < round.questions.length; index += 1) {
      assert.notEqual(
        round.questions[index]?.questionText,
        round.questions[index - 1]?.questionText,
      );
    }
  });

  it("uses a broad wording bank across deterministic samples", () => {
    const seen = new Set<string>();

    for (let index = 0; index < 24; index += 1) {
      const sample = createLevelOneLoadQuestion([], () => index / 24);
      seen.add(sample.questionText);
    }

    assert.ok(seen.size >= 12);
  });

  it("dispatches the implemented round through the facade", () => {
    const round = createRound(1, "load", () => 0);

    assert.equal(round.questions[0].answer, 2);
  });

  it("dispatches all implemented Level 1 rounds through the facade", () => {
    assert.equal(createRound(1, "pack", () => 0).round, "pack");
    assert.equal(createRound(1, "ship", () => 0).round, "ship");
  });

  it("throws for rounds that are not implemented yet", () => {
    assert.throws(() => createRound(2, "load", () => 0), /Round not implemented yet/);
  });
});
