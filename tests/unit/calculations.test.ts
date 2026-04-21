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
import {
  createLevelTwoLoadQuestion,
  createLevelTwoLoadRound,
  createLevelTwoPackQuestion,
  createLevelTwoPackRound,
  createLevelTwoShipQuestion,
  createLevelTwoShipRound,
} from "../../src/calculations/level-2/round-1.ts";

describe("Pack It Level 1 (multiplication) calculations", () => {
  it("creates Level 1 Load questions with find-total subtype and bounded values", () => {
    for (let index = 0; index < 24; index += 1) {
      const question = createLevelOneLoadQuestion([], () => index / 24);
      assert.equal(question.level, 1);
      assert.equal(question.round, "load");
      assert.equal(question.subtype, "find-total");
      assert.ok(question.unitRate >= 3 && question.unitRate <= 8);
      assert.ok(question.groupsA >= 3 && question.groupsA <= 8);
      assert.equal(question.totalA, question.groupsA * question.unitRate);
      assert.equal(question.answer, question.totalA);
      assert.equal(question.answerUnit, question.pair.itemPlural);
    }
  });

  it("creates ten Level 1 Load questions with matching shape", () => {
    const round = createLevelOneLoadRound(false, () => 0.25);

    assert.equal(round.level, 1);
    assert.equal(round.round, "load");
    assert.equal(round.questions.length, 10);

    for (const question of round.questions) {
      assert.equal(question.subtype, "find-total");
      assert.ok(question.groupsA >= 3 && question.groupsA <= 8);
      assert.ok(question.unitRate >= 3 && question.unitRate <= 8);
      assert.equal(question.totalA, question.groupsA * question.unitRate);
    }
  });

  it("creates matching Pack and Ship round names", () => {
    const packRound = createLevelOnePackRound(false, () => 0.25);
    const shipRound = createLevelOneShipRound(false, () => 0.25);

    assert.equal(packRound.round, "pack");
    assert.equal(shipRound.round, "ship");
    assert.ok(packRound.questions.every((question) => question.round === "pack"));
    assert.ok(shipRound.questions.every((question) => question.round === "ship"));
  });

  it("keeps Pack and Ship questions within the unit/groups bands", () => {
    const packQuestion = createLevelOnePackQuestion([], () => 0.99);
    const shipQuestion = createLevelOneShipQuestion([], () => 0.99);

    for (const question of [packQuestion, shipQuestion]) {
      assert.equal(question.subtype, "find-total");
      assert.ok(question.unitRate >= 3 && question.unitRate <= 8);
      assert.ok(question.groupsA >= 3 && question.groupsA <= 8);
      assert.equal(question.totalA, question.groupsA * question.unitRate);
    }
  });

  it("does not repeat the same Level 1 Load question wording twice in a row", () => {
    const round = createLevelOneLoadRound(false, () => 0);

    for (let index = 1; index < round.questions.length; index += 1) {
      assert.notEqual(
        round.questions[index]?.questionText,
        round.questions[index - 1]?.questionText,
      );
    }
  });

  it("dispatches Level 1 rounds through the facade", () => {
    const loadRound = createRound(1, "load", false, () => 0);
    const packRound = createRound(1, "pack", false, () => 0);
    const shipRound = createRound(1, "ship", false, () => 0);

    assert.equal(loadRound.level, 1);
    assert.equal(loadRound.round, "load");
    assert.equal(packRound.round, "pack");
    assert.equal(shipRound.round, "ship");
    assert.equal(loadRound.questions[0].subtype, "find-total");
  });
});

describe("Pack It Level 2 (find-unit) calculations", () => {
  it("creates a deterministic Level 2 Load question", () => {
    const question = createLevelTwoLoadQuestion([], () => 0);

    assert.equal(question.level, 2);
    assert.equal(question.round, "load");
    assert.equal(question.subtype, "find-unit");
    assert.equal(question.totalA, question.groupsA * question.unitRate);
    assert.equal(question.answer, question.unitRate);
    assert.equal(
      question.answerUnit,
      `${question.pair.itemPlural} per ${question.pair.container}`,
    );
  });

  it("creates ten Level 2 Load questions with bounded values", () => {
    const round = createLevelTwoLoadRound(false, () => 0.25);

    assert.equal(round.level, 2);
    assert.equal(round.round, "load");
    assert.equal(round.questions.length, 10);

    for (const question of round.questions) {
      assert.equal(question.subtype, "find-unit");
      assert.ok(question.groupsA >= 2 && question.groupsA <= 8);
      assert.ok(question.unitRate >= 2 && question.unitRate <= 10);
      assert.equal(question.totalA, question.groupsA * question.unitRate);
      assert.ok(question.totalA >= 20);
      assert.ok(question.totalA <= 80);
    }
  });

  it("creates matching Level 2 Pack and Ship round names", () => {
    const packRound = createLevelTwoPackRound(false, () => 0.25);
    const shipRound = createLevelTwoShipRound(false, () => 0.25);

    assert.equal(packRound.round, "pack");
    assert.equal(shipRound.round, "ship");
  });

  it("caps Level 2 Pack and Ship to ten items per container", () => {
    const packQuestion = createLevelTwoPackQuestion([], () => 0.99);
    const shipQuestion = createLevelTwoShipQuestion([], () => 0.99);

    for (const question of [packQuestion, shipQuestion]) {
      assert.equal(question.subtype, "find-unit");
      assert.ok(question.unitRate >= 3);
      assert.ok(question.unitRate <= 10);
      assert.ok(question.groupsA >= 2 && question.groupsA <= 8);
      assert.ok(question.totalA >= 20);
      assert.ok(question.totalA <= 80);
    }
  });

  it("dispatches Level 2 rounds through the facade", () => {
    const round = createRound(2, "load", false, () => 0);
    assert.equal(round.level, 2);
    assert.equal(round.questions[0].subtype, "find-unit");
  });
});

describe("Pack It facade", () => {
  it("throws for unimplemented levels", () => {
    assert.throws(() => createRound(3, "load", false, () => 0), /Round not implemented yet/);
  });
});
