import { EvidenceAnswers } from "#/journeys/evidence/evidence.answers.js";
import {
  Answer,
  Condition,
  PredicateExpr,
} from "@ministryofjustice/hmpps-forge/core/authoring";
import { and, or, not } from "@ministryofjustice/hmpps-forge/core/authoring";

interface SummaryField {
  completeWhen: PredicateExpr;
  visibleWhen: PredicateExpr | true;
}

type SummaryFieldKey =
  | EvidenceAnswers.capitalEvidence
  | EvidenceAnswers.doYouHaveEvidence
  | EvidenceAnswers.haveEvidenceOfCapital
  | EvidenceAnswers.haveEvidenceOfExpenditure
  | EvidenceAnswers.reasonForNoEvidence
  | EvidenceAnswers.moreDetailsForNoEvidence
  | "expenditureEvidence"
  | "incomeEvidence";

/**
 * Requires complete answers only for visible summary fields.
 * @returns The condition for submitting checked answers.
 */
export function checkAnswersComplete(): PredicateExpr {
  return and(
    Object.values(checkAnswersModel()).map(({ completeWhen, visibleWhen }) =>
      visibleWhen === true ? completeWhen : or(not(visibleWhen), completeWhen),
    ),
  );
}

const yesNo = (key: EvidenceAnswers): PredicateExpr =>
  Answer(key).match(Condition.Array.IsIn(["yes", "no"]));
const required = (key: EvidenceAnswers): PredicateExpr =>
  Answer(key).match(Condition.IsRequired());

export function checkAnswersModel(): Record<SummaryFieldKey, SummaryField> {
  const hasIncomeEvidence = Answer(EvidenceAnswers.doYouHaveEvidence).match(
    Condition.Equals("yes"),
  );

  const hasCapitalEvidence = Answer(
    EvidenceAnswers.haveEvidenceOfCapital,
  ).match(Condition.Equals("yes"));

  const hasExpenditureEvidence = Answer(
    EvidenceAnswers.haveEvidenceOfExpenditure,
  ).match(Condition.Equals("yes"));

  const incomeEvidenceComplete = or(
    Answer("employedEvidence").match(Condition.IsRequired()),
    Answer("selfEmployedEvidence").match(Condition.IsRequired()),
    Answer("benefitsInKindEvidence").match(Condition.IsRequired()),
    Answer("otherEvidence").match(Condition.IsRequired()),
    Answer("stateBenefitsEvidence").match(Condition.IsRequired()),
    Answer("asylumSupportEvidence").match(Condition.IsRequired()),
    Answer("taxCreditsEvidence").match(Condition.IsRequired()),
  );

  const capitalEvidenceComplete = Answer("capitalEvidence").match(
    Condition.IsRequired(),
  );

  const expenditureEvidenceComplete = or(
    Answer("incomeEvidence").match(Condition.IsRequired()),
    Answer("housingCostsEvidence").match(Condition.IsRequired()),
    Answer("childCareEvidence").match(Condition.IsRequired()),
    Answer("maintenanceEvidence").match(Condition.IsRequired()),
  );

  return {
    doYouHaveEvidence: field({
      completeWhen: yesNo(EvidenceAnswers.doYouHaveEvidence),
      visibleWhen: true,
    }),
    reasonForNoEvidence: field({
      completeWhen: required(EvidenceAnswers.reasonForNoEvidence),
      visibleWhen: Answer(EvidenceAnswers.doYouHaveEvidence).match(
        Condition.Equals("no"),
      ),
    }),
    moreDetailsForNoEvidence: field({
      completeWhen: required(EvidenceAnswers.moreDetailsForNoEvidence),
      visibleWhen: Answer(EvidenceAnswers.doYouHaveEvidence).match(
        Condition.Equals("no"),
      ),
    }),
    incomeEvidence: field({
      completeWhen: incomeEvidenceComplete,
      visibleWhen: hasIncomeEvidence,
    }),
    haveEvidenceOfExpenditure: field({
      completeWhen: yesNo(EvidenceAnswers.haveEvidenceOfExpenditure),
      visibleWhen: Answer(EvidenceAnswers.doYouHaveEvidence).match(
        Condition.Equals("yes"),
      ),
    }),
    expenditureEvidence: field({
      completeWhen: expenditureEvidenceComplete,
      visibleWhen: hasExpenditureEvidence,
    }),
    haveEvidenceOfCapital: field({
      completeWhen: yesNo(EvidenceAnswers.haveEvidenceOfCapital),
      visibleWhen: Answer(EvidenceAnswers.doYouHaveEvidence).match(
        Condition.Equals("yes"),
      ),
    }),
    capitalEvidence: field({
      completeWhen: capitalEvidenceComplete,
      visibleWhen: hasCapitalEvidence,
    }),
  };
}

/**
 * Pairs a field's completeness rule with its visibility rule.
 * @param rules The field's completeness and visibility rules.
 * @param rules.completeWhen Whether the field has all required answers.
 * @param rules.visibleWhen Whether the field applies to the current answers.
 * @returns The field's summary rules.
 */
function field({ completeWhen, visibleWhen }: SummaryField): SummaryField {
  return { completeWhen, visibleWhen };
}
