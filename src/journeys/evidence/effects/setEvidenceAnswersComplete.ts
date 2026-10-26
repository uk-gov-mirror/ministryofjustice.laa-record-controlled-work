import type { EvidenceContext } from "#/journeys/evidence/evidence.types.js";

import {
  CapitalEvidence,
  EvidenceAnswers,
  ExpenditureEvidence,
  IncomeEvidence,
} from "#/journeys/evidence/evidence.answers.js";
import { CONTEXT_DATA_KEYS } from "#/journeys/journey.constants.js";

const NO_ITEMS = 0;

const hasValue = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.length > NO_ITEMS
    : value !== undefined && value !== null && value !== "";

const hasAnyValue = (
  answers: Record<string, unknown>,
  keys: readonly EvidenceAnswers[],
): boolean => keys.some((key) => hasValue(answers[key]));

const isSectionComplete = (
  answers: Record<string, unknown>,
  hasEvidenceKey: EvidenceAnswers,
  evidenceKeys: readonly EvidenceAnswers[],
): boolean =>
  answers[hasEvidenceKey] === "no" ||
  (answers[hasEvidenceKey] === "yes" && hasAnyValue(answers, evidenceKeys));

const areEvidenceAnswersComplete = (
  answers: Record<string, unknown>,
): boolean => {
  if (answers[EvidenceAnswers.doYouHaveEvidence] === "no") {
    return (
      hasValue(answers[EvidenceAnswers.reasonForNoEvidence]) &&
      hasValue(answers[EvidenceAnswers.moreDetailsForNoEvidence])
    );
  }

  return (
    answers[EvidenceAnswers.doYouHaveEvidence] === "yes" &&
    hasAnyValue(answers, IncomeEvidence) &&
    isSectionComplete(
      answers,
      EvidenceAnswers.haveEvidenceOfExpenditure,
      ExpenditureEvidence,
    ) &&
    isSectionComplete(
      answers,
      EvidenceAnswers.haveEvidenceOfCapital,
      CapitalEvidence,
    )
  );
};

export const setEvidenceAnswersComplete =
  () =>
  (context: EvidenceContext): void => {
    context.setData(
      CONTEXT_DATA_KEYS.evidenceAnswersComplete,
      areEvidenceAnswersComplete(context.getAllAnswers()),
    );
  };
