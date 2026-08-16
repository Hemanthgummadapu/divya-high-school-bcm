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

test("Telugu and Hindi are removed from every grade-to-subject list", () => {
  for (const grade of ALL_GRADES) {
    const subjects = getSubjectsForGrade(grade);
    assert.equal(subjects.includes("Telugu"), false);
    assert.equal(subjects.includes("Hindi"), false);
    assert.equal(isValidSubjectForGrade("Telugu", grade), false);
    assert.equal(isValidSubjectForGrade("Hindi", grade), false);
  }
  assert.deepEqual(EXCLUDED_RELEASE_SUBJECTS, ["Telugu", "Hindi"]);
  assert.equal(isSupportedSubject("Telugu"), false);
  assert.equal(isSupportedSubject("Hindi"), false);
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

test("server filters and create/upload paths reject Telugu and Hindi", () => {
  assert.equal(parseListQuery(new URLSearchParams("subject=Telugu")).ok, false);
  assert.equal(parseListQuery(new URLSearchParams("subject=Hindi")).ok, false);
  assert.equal(
    parseListQuery(new URLSearchParams("grade=10&subject=Telugu")).ok,
    false,
  );
  assert.equal(
    parseListQuery(new URLSearchParams("grade=10&subject=Mathematics")).ok,
    true,
  );
  const rejected = validateQuestionFields(
    {
      questionText: "Translate this sentence.",
      questionType: "Short",
      marks: 2,
      grade: 10,
      subject: "Telugu",
      academicYear: 2026,
    },
    { requireClassification: true },
  );
  assert.equal(rejected.ok, false);
  assert.match(uploadRoute, /isValidSubjectForGrade\(subject, gradeNum\)/);
  assert.match(questionCreate, /isValidSubjectForGrade\(subject, grade\)/);
  assert.match(pageSource, /getSubjectsForGrade/);
  assert.doesNotMatch(pageSource, /"Telugu"|"Hindi"/);
});

test("class 1-7 keep Science and class 8-10 keep Physics and Biology", () => {
  assert.deepEqual(SUBJECTS_BY_GRADE[1], [
    "English",
    "Mathematics",
    "Science",
    "Social Studies",
  ]);
  assert.deepEqual(SUBJECTS_BY_GRADE[10], [
    "English",
    "Mathematics",
    "Physics",
    "Biology",
    "Social Studies",
  ]);
  assert.equal(isValidSubjectForGrade("Science", 8), false);
  assert.equal(isValidSubjectForGrade("Physics", 7), false);
});
