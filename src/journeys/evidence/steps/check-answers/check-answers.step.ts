import {
  access,
  Condition,
  Data,
  Format,
  Params,
  redirect,
  step,
  submit,
  tieBreaker,
} from "@ministryofjustice/hmpps-forge/core/authoring";

import { evidenceEffects } from "#/journeys/evidence/evidence.effects.js";
import {
  heading,
  summaryList,
} from "#/journeys/evidence/steps/check-answers/check-answers.blocks.js";
import {
  CONTEXT_DATA_KEYS,
  PARAMS_KEYS,
} from "#/journeys/journey.constants.js";
import { submitButton } from "#/journeys/shared.blocks.js";
import { t } from "#/lib/i18n.js";

const TIE_BREAKER_PRIORITY = 100;

export const checkAnswersStep = (): ReturnType<typeof step> =>
  step({
    blocks: [heading, summaryList, submitButton()],
    code: "check-answers",
    onAccess: [
      access({ effects: [evidenceEffects.setEvidenceAnswersComplete()] }),
      access({
        next: [redirect({ goto: "have-evidence" })],
        when: Data(CONTEXT_DATA_KEYS.evidenceAnswersComplete).match(
          Condition.Equals(false),
        ),
      }),
    ],
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
    title: t("journeys.createApplication.checkAnswers.title"),
  });
