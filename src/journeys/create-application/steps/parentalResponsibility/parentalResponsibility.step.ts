import {
  redirect,
  step,
  type StepDefinition,
  submit,
  type SubmitHook,
} from "@ministryofjustice/hmpps-forge/core/authoring";

import { CreateApplicationEffects } from "#/journeys/create-application/create-application.effects.js";
import { parentalResponsibilityQuestion } from "#/journeys/create-application/steps/parentalResponsibility/parentalResponsibility.blocks.js";
import {
  clientDetailsCaption,
  continueButton,
} from "#/journeys/shared.blocks.js";
import {
  hasCheckAnswersInQuery,
  redirectToCheckAnswers,
} from "#/journeys/shared.hook.js";
import { StepCode } from "#/journeys/StepCode.enum.js";
import { t } from "#/lib/i18n.js";

const TITLE = t("journeys.createApplication.parentalResponsibility.title");

/**
 * Renders the Parental Responsibility question step.
 * @param journeyCode - The journey code for saving draft answers
 * @returns {StepDefinition} The step definition for the Parental Responsibility question step.
 */
export function parentalResponsibilityStep(
  journeyCode: string,
): StepDefinition {
  return step({
    blocks: [
      clientDetailsCaption(),
      parentalResponsibilityQuestion(),
      continueButton(),
    ],
    code: StepCode.PARENTAL_RESPONSIBILITY,
    onSubmission: [saveParentalResponsibility(journeyCode)],
    path: StepCode.PARENTAL_RESPONSIBILITY,
    reachability: {
      entryWhen: hasCheckAnswersInQuery,
    },
    title: TITLE,
  });
}

/**
 * Handles form submission for the Parental Responsibility question step.
 * Saves the answer and continues, or returns to Check your answers when editing.
 *
 * @param {string} journeyCode - The journey code for saving draft answers
 * @returns {SubmitHook} A submit hook with validation and conditional routing logic
 */
function saveParentalResponsibility(journeyCode: string): SubmitHook {
  return submit({
    onValid: {
      effects: [CreateApplicationEffects.saveDraftAnswers(journeyCode)],
      next: [
        redirectToCheckAnswers,
        tempRedirectToLegalAidBefore,
        redirectToConfirmMerits,
      ],
    },
    validate: true,
  });
}

/**
 * Temporarily redirects to "Legal Aid Before" until the Confirm Merits page is available.
 * @todo MEM-1055: Remove this and use redirectToConfirmMerits when that step is available.
 */
const tempRedirectToLegalAidBefore = redirect({
  goto: "legal-aid-before",
});

/**
 * Redirects to the "Confirm Merits" page regardless of the parental responsibility answer.
 */
const redirectToConfirmMerits = redirect({
  goto: "confirm-merits",
});
