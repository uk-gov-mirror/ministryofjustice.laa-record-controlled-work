import {
  redirect,
  type RedirectOutcome,
  step,
  type StepDefinition,
  submit,
  type SubmitHook,
} from "@ministryofjustice/hmpps-forge/core/authoring";

import { CreateApplicationEffects } from "#/journeys/create-application/create-application.effects.js";
import {
  body,
  checkbox,
  heading,
} from "#/journeys/create-application/steps/confirmMerits/confirmMerits.blocks.js";
import { continueButton } from "#/journeys/shared.blocks.js";
import { redirectToCheckAnswers } from "#/journeys/shared.hook.js";
import { StepCode } from "#/journeys/StepCode.enum.js";
import { t } from "#/lib/i18n.js";

const TITLE = t("journeys.createApplication.confirmMerits.title");

/**
 * Defines the Confirm Merits step for a create or edit client details journey.
 * @param journeyCode Journey identifier used to save draft answers.
 * @returns The Confirm Merits step definition.
 */
export function confirmMeritsStep(journeyCode: string): StepDefinition {
  return step({
    blocks: [heading(), body(), checkbox(), continueButton()],
    code: StepCode.CONFIRM_MERITS,
    onSubmission: [saveConfirmMerits(journeyCode)],
    path: StepCode.CONFIRM_MERITS,
    title: TITLE,
  });
}

/**
 * Redirects to the Legal Aid Before step.
 * @returns The redirect outcome.
 */
function redirectToLegalAidBefore(): RedirectOutcome {
  return redirect({ goto: "legal-aid-before" });
}

/**
 * Saves the Confirm Merits answer and routes to the next step.
 * @param journeyCode Journey identifier used to save draft answers.
 * @returns The submission hook.
 */
function saveConfirmMerits(journeyCode: string): SubmitHook {
  return submit({
    onValid: {
      effects: [CreateApplicationEffects.saveDraftAnswers(journeyCode)],
      next: [redirectToCheckAnswers, redirectToLegalAidBefore()],
    },
    validate: true,
  });
}
