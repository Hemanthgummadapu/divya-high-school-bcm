import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALL_GRADES,
  EXCLUDED_RELEASE_SUBJECTS,
  SUBJECTS_BY_GRADE,
  getSubjectsForGrade,
  isSupportedSubject,
  isValidSubjectForGrade,
  listSupportedGradeSubjectPairs,
} from "../src/lib/subjects.mjs";
import { parseListQuery, validateQuestionFields } from "../src/lib/question-bank-v2-review.mjs";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const uploadRoute = readFileSync(
  join(root, "src/app/api/question-papers/route.ts"),
  "utf8",
);
const questionCreate = readFileSync(
  join(root, "src/app/api/questions/route.ts"),
  "utf8",
);
const pageSource = readFileSync(
  join(root, "src/app/academics/question-papers/page.tsx"),
  "utf8",
);

test("Telugu and Hindi are offered by every class", () => {
  // They were held back while the paper generator drew glyphs without running
  // a font's shaping tables, which broke Telugu conjuncts and put Devanagari
  // vowel signs on the wrong side. Papers are laid out by a shaping engine
  // now, so a first- or second-language paper can be built like any other.
  for (const grade of ALL_GRADES) {
    const subjects = getSubjectsForGrade(grade);
    assert.equal(subjects.includes("Telugu"), true);
    assert.equal(subjects.includes("Hindi"), true);
    assert.equal(isValidSubjectForGrade("Telugu", grade), true);
    assert.equal(isValidSubjectForGrade("Hindi", grade), true);
  }
  assert.deepEqual(EXCLUDED_RELEASE_SUBJECTS, []);
  assert.equal(isSupportedSubject("Telugu"), true);
  assert.equal(isSupportedSubject("Hindi"), true);
});

test("every remaining configured grade and subject is accepted", () => {
  const pairs = listSupportedGradeSubjectPairs();
  assert.ok(pairs.length >= 40);
  for (const { grade, subject } of pairs) {
    assert.equal(isValidSubjectForGrade(subject, grade), true);
    assert.equal(isSupportedSubject(subject), true);
    const created = validateQuestionFields(
      {
        questionText: "Define force.",
        questionType: "Short",
        marks: 2,
        grade,
        subject,
        academicYear: 2026,
      },
      { requireClassification: true },
    );
    assert.equal(created.ok, true, `${grade}/${subject} should be accepted`);
  }
});

test("server filters and create/upload paths accept Telugu and Hindi", () => {
  assert.equal(parseListQuery(new URLSearchParams("subject=Telugu")).ok, true);
  assert.equal(parseListQuery(new URLSearchParams("subject=Hindi")).ok, true);
  assert.equal(
    parseListQuery(new URLSearchParams("grade=10&subject=Telugu")).ok,
    true,
  );
  assert.equal(
    parseListQuery(new URLSearchParams("grade=10&subject=Mathematics")).ok,
    true,
  );
  // A subject still has to belong to the class it is filed under, so an
  // unknown subject is refused exactly as before.
  assert.equal(parseListQuery(new URLSearchParams("subject=Sanskrit")).ok, false);
  const accepted = validateQuestionFields(
    {
      questionText: "ఈ వాక్యాన్ని అనువదించండి.",
      questionType: "Short",
      marks: 2,
      grade: 10,
      subject: "Telugu",
      academicYear: 2026,
    },
    { requireClassification: true },
  );
  assert.equal(accepted.ok, true);
  assert.match(uploadRoute, /isValidSubjectForGrade\(subject, gradeNum\)/);
  assert.match(questionCreate, /isValidSubjectForGrade\(subject, grade\)/);
  assert.match(pageSource, /getSubjectsForGrade/);
  assert.doesNotMatch(pageSource, /"Telugu"|"Hindi"/);
});

test("class 1-7 keep Science and class 8-10 keep Physics and Biology", () => {
  assert.deepEqual(SUBJECTS_BY_GRADE[1], [
    "Telugu",
    "Hindi",
    "English",
    "Mathematics",
    "Science",
    "Social Studies",
  ]);
  assert.deepEqual(SUBJECTS_BY_GRADE[10], [
    "Telugu",
    "Hindi",
    "English",
    "Mathematics",
    "Physics",
    "Biology",
    "Social Studies",
  ]);
  assert.equal(isValidSubjectForGrade("Science", 8), false);
  assert.equal(isValidSubjectForGrade("Physics", 7), false);
});
