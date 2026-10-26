import {
  Format,
  Params,
  redirect,
  step,
  submit,
  tieBreaker,
  validation,
} from "@ministryofjustice/hmpps-forge/core/authoring";

import { evidenceEffects } from "#/journeys/evidence/evidence.effects.js";
import {
  heading,
  summaryList,
} from "#/journeys/evidence/steps/check-answers/check-answers.blocks.js";
import { PARAMS_KEYS } from "#/journeys/journey.constants.js";
import { submitButton } from "#/journeys/shared.blocks.js";
import { t } from "#/lib/i18n.js";
import { checkAnswersComplete } from "#/journeys/evidence/steps/check-answers/check-answers.model.js";

const TIE_BREAKER_PRIORITY = 100;

export const checkAnswersStep = (): ReturnType<typeof step> =>
  step({
    blocks: [heading, summaryList, submitButton()],
    code: "check-answers",
    onSubmission: [
      submit({
        onValid: {
          effects: [evidenceEffects.updateEvidence("evidence")],
          next: [
            redirect({
              goto: Format(
                "/cases/%1/task-list",
                Params(PARAMS_KEYS.applicationID),
              ),
            }),
          ],
        },
        validate: true,
      }),
    ],
    path: "check-answers",
    reachability: {
      entryWhen: true,
      tieBreakers: [tieBreaker({ priority: TIE_BREAKER_PRIORITY })],
    },
    title: t("journeys.evidence.checkAnswers.title"),
    validWhen: [
      validation({
        condition: checkAnswersComplete(),
        message: t(
          "journeys.evidence.checkAnswers.validation.incomplete",
        ),
        submissionOnly: true,
      }),
    ],
  });
