import {
  Condition,
  Self,
  Transformer,
  validation,
} from "@ministryofjustice/hmpps-forge/core/authoring";
import {
  GovUKBody,
  GovUKCheckboxInput,
  GovUKHeading,
} from "@ministryofjustice/hmpps-forge/govuk-components";

import { AnswerKey } from "#/journeys/AnswerKey.enum.js";
import { H1 } from "#/lib/constants/headings.js";
import { fixedT } from "#/lib/i18n.js";

const confirmMeritsT = fixedT("journeys.createApplication.confirmMerits");

/**
 * Creates the Confirm Merits explanatory text.
 * @returns The body block containing the regulations link.
 */
export function body(): GovUKBody {
  // TODO: Replace the temporary destination in this translation when the correct URL is known.
  return GovUKBody({ text: confirmMeritsT("body") });
}

/**
 * Creates the required confirmation checkbox.
 * @returns The Confirm Merits checkbox block.
 */
export function checkbox(): GovUKCheckboxInput {
  return GovUKCheckboxInput({
    code: AnswerKey.confirmMerits,
    formatters: [Transformer.Array.First()],
    items: [
      {
        text: confirmMeritsT("checkboxLabel"),
        value: "yes",
      },
    ],
    validWhen: [
      validation({
        condition: Self().match(Condition.IsRequired()),
        message: confirmMeritsT("validation.required"),
      }),
    ],
  });
}

/**
 * Creates the Confirm Merits page heading.
 * @returns The page heading block.
 */
export function heading(): GovUKHeading {
  return GovUKHeading({
    level: H1,
    text: confirmMeritsT("title"),
  });
}
