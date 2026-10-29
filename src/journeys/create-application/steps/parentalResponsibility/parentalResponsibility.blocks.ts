import type { GovUKRadioInput } from "@ministryofjustice/hmpps-forge/govuk-components";

import { AnswerKey } from "#/journeys/AnswerKey.enum.js";
import { yesOrNoRadioInput } from "#/journeys/shared.blocks.js";
import { t } from "#/lib/i18n.js";

const TITLE = t("journeys.createApplication.parentalResponsibility.title");
const REQUIRED_VALIDATION = t(
  "journeys.createApplication.parentalResponsibility.validation.required",
);

/**
 * Creates the radio input for the Parental Responsibility question step.
 *
 * @returns A GovUK radio input with Yes and No options.
 */
export function parentalResponsibilityQuestion(): GovUKRadioInput {
  return yesOrNoRadioInput(
    AnswerKey.careProceedingsParentalResponsibility,
    TITLE,
    REQUIRED_VALIDATION,
  );
}
