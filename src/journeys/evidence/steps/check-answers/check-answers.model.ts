import {
  Answer,
  Condition,
  type PredicateExpr,
} from "@ministryofjustice/hmpps-forge/core/authoring";
import { and, not, or } from "@ministryofjustice/hmpps-forge/core/authoring";

import { EvidenceAnswers } from "#/journeys/evidence/evidence.answers.js";

interface SummaryField {
  completeWhen: PredicateExpr;
  visibleWhen: PredicateExpr | true;
}

type SummaryFieldKey =
  | "expenditureEvidence"
  | "incomeEvidence"
  | EvidenceAnswers.capitalEvidence
  | EvidenceAnswers.doYouHaveEvidence
  | EvidenceAnswers.haveEvidenceOfCapital
  | EvidenceAnswers.haveEvidenceOfExpenditure
  | EvidenceAnswers.moreDetailsForNoEvidence
  | EvidenceAnswers.reasonForNoEvidence;

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

/**
 * Returns the model for the check answers step, defining the conditions for each summary field to be complete and visible.
 * @returns The check answers model.
 */
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
    Answer(EvidenceAnswers.employedEvidence).match(Condition.IsRequired()),
    Answer(EvidenceAnswers.selfEmployedEvidence).match(Condition.IsRequired()),
    Answer(EvidenceAnswers.benefitsInKindEvidence).match(
      Condition.IsRequired(),
    ),
    Answer(EvidenceAnswers.otherEvidence).match(Condition.IsRequired()),
    Answer(EvidenceAnswers.stateBenefitsEvidence).match(Condition.IsRequired()),
    Answer(EvidenceAnswers.asylumSupportEvidence).match(Condition.IsRequired()),
    Answer(EvidenceAnswers.taxCreditsEvidence).match(Condition.IsRequired()),
  );

  const capitalEvidenceComplete = Answer(EvidenceAnswers.capitalEvidence).match(
    Condition.IsRequired(),
  );

  const expenditureEvidenceComplete = or(
    Answer(EvidenceAnswers.incomeEvidence).match(Condition.IsRequired()),
    Answer(EvidenceAnswers.housingCostsEvidence).match(Condition.IsRequired()),
    Answer(EvidenceAnswers.childCareEvidence).match(Condition.IsRequired()),
    Answer(EvidenceAnswers.maintenanceEvidence).match(Condition.IsRequired()),
  );

  return {
    capitalEvidence: field({
      completeWhen: capitalEvidenceComplete,
      visibleWhen: hasCapitalEvidence,
    }),
    doYouHaveEvidence: field({
      completeWhen: yesNo(EvidenceAnswers.doYouHaveEvidence),
      visibleWhen: true,
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
    haveEvidenceOfExpenditure: field({
      completeWhen: yesNo(EvidenceAnswers.haveEvidenceOfExpenditure),
      visibleWhen: Answer(EvidenceAnswers.doYouHaveEvidence).match(
        Condition.Equals("yes"),
      ),
    }),
    incomeEvidence: field({
      completeWhen: incomeEvidenceComplete,
      visibleWhen: hasIncomeEvidence,
    }),
    moreDetailsForNoEvidence: field({
      completeWhen: required(EvidenceAnswers.moreDetailsForNoEvidence),
      visibleWhen: Answer(EvidenceAnswers.doYouHaveEvidence).match(
        Condition.Equals("no"),
      ),
    }),
    reasonForNoEvidence: field({
      completeWhen: required(EvidenceAnswers.reasonForNoEvidence),
      visibleWhen: Answer(EvidenceAnswers.doYouHaveEvidence).match(
        Condition.Equals("no"),
      ),
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
