"""Tests for the AI exam-question validation contract (task task_bd3f356bffe0, subtask 1).

`validateExamQuestions` lives in ``src/lib/aiTasks.js`` and guards the model's reply before the
quiz UI renders it, so a malformed reply (a question missing ``q`` or ``choices``, or with a
non-numeric ``answer``) surfaces a clear error instead of crashing ``AIExamGenerator``.

Following the repo convention (see ``tests/test_anti_pattern_edge_case.py``) these tests are
self-contained — stdlib + pytest only — so they run in a verification environment without the
JS toolchain. They do two things:

  1. assert that the JS source actually defines the function and contains the structural guards
     (so the behaviour cannot silently rot away in the real implementation), and
  2. exercise a faithful Python port of the same contract across valid and invalid inputs.
"""

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
AI_TASKS = REPO_ROOT / "src" / "lib" / "aiTasks.js"
AI_EXAM_GENERATOR = REPO_ROOT / "src" / "components" / "AIExamGenerator.jsx"


def _aitasks_source():
    assert AI_TASKS.is_file(), f"missing {AI_TASKS}"
    return AI_TASKS.read_text(encoding="utf-8")


# --- Python reference port of validateExamQuestions (mirrors src/lib/aiTasks.js) ------------


class ExamValidationError(ValueError):
    """Raised when a generated exam question set is structurally invalid."""


def validate_exam_questions(questions, type="mcq"):
    if not isinstance(questions, list) or len(questions) == 0:
        raise ExamValidationError("empty/non-array question set")
    for i, q in enumerate(questions):
        n = i + 1
        if not isinstance(q, dict):
            raise ExamValidationError(f"question {n} has an invalid structure")
        qtext = q.get("q")
        if not isinstance(qtext, str) or not qtext.strip():
            raise ExamValidationError(f"question {n} is missing q")
        if type == "mcq":
            choices = q.get("choices")
            if not isinstance(choices, list) or len(choices) < 2:
                raise ExamValidationError(f"question {n} is missing choices")
            ans = q.get("answer")
            # bool is a subclass of int in Python — reject it explicitly.
            if not isinstance(ans, int) or isinstance(ans, bool) or ans < 0 or ans >= len(choices):
                raise ExamValidationError(f"question {n} has an invalid answer")
        else:
            ans = q.get("answer")
            if not isinstance(ans, str) or not ans.strip():
                raise ExamValidationError(f"question {n} is missing answer")
    return questions


# --- Tests ----------------------------------------------------------------------------------


def test_validate_exam_questions_invalid_structure():
    # The JS implementation must exist and be exported.
    src = _aitasks_source()
    assert re.search(r"export function validateExamQuestions", src) or re.search(
        r"const validateExamQuestions\s*=", src
    ), "validateExamQuestions must be defined/exported in src/lib/aiTasks.js"
    # ...and it must actually inspect q / choices / answer (not a no-op stub).
    assert "choices" in src and "answer" in src, "validation must check choices/answer"
    assert "throw new Error" in src, "validation must throw a specific error on bad input"
    # AIExamGenerator must use it so a bad reply is shown, not crashed on.
    gen = AI_EXAM_GENERATOR.read_text(encoding="utf-8")
    assert "validateExamQuestions" in gen, "AIExamGenerator must call validateExamQuestions"

    # A question missing `q` is rejected.
    with pytest.raises(ExamValidationError):
        validate_exam_questions([{"choices": ["a", "b"], "answer": 0}], type="mcq")
    # A question missing `choices` is rejected (mcq).
    with pytest.raises(ExamValidationError):
        validate_exam_questions([{"q": "what?", "answer": 0}], type="mcq")
    # A non-object item is rejected.
    with pytest.raises(ExamValidationError):
        validate_exam_questions(["not an object"], type="mcq")


def test_validate_exam_questions_all_cases():
    # Valid mcq passes and returns the same list.
    good_mcq = [{"q": "صورت سوال", "choices": ["۱", "۲", "۳", "۴"], "answer": 2, "ref": "1:1"}]
    assert validate_exam_questions(good_mcq, type="mcq") == good_mcq

    # Valid fill passes.
    good_fill = [{"q": "جای ___ خالی", "answer": "کلمه", "ref": "1:1"}]
    assert validate_exam_questions(good_fill, type="fill") == good_fill

    # Empty / non-array input is rejected.
    for bad in ([], None, "x", {}, 5):
        with pytest.raises(ExamValidationError):
            validate_exam_questions(bad, type="mcq")

    # mcq: empty q string.
    with pytest.raises(ExamValidationError):
        validate_exam_questions([{"q": "   ", "choices": ["a", "b"], "answer": 0}], type="mcq")

    # mcq: too few choices.
    with pytest.raises(ExamValidationError):
        validate_exam_questions([{"q": "x", "choices": ["only one"], "answer": 0}], type="mcq")

    # mcq: answer index out of range.
    with pytest.raises(ExamValidationError):
        validate_exam_questions([{"q": "x", "choices": ["a", "b"], "answer": 5}], type="mcq")

    # mcq: non-integer / boolean answer.
    for bad_ans in ("0", 1.5, True, None):
        with pytest.raises(ExamValidationError):
            validate_exam_questions([{"q": "x", "choices": ["a", "b"], "answer": bad_ans}], type="mcq")

    # fill: missing/empty answer.
    with pytest.raises(ExamValidationError):
        validate_exam_questions([{"q": "x", "answer": ""}], type="fill")
    with pytest.raises(ExamValidationError):
        validate_exam_questions([{"q": "x"}], type="fill")

    # Multiple questions: the first invalid one is reported.
    mixed = [
        {"q": "ok", "choices": ["a", "b"], "answer": 0},
        {"q": "bad", "answer": 0},  # missing choices
    ]
    with pytest.raises(ExamValidationError):
        validate_exam_questions(mixed, type="mcq")
