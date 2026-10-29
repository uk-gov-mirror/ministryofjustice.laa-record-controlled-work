import type { Application } from "#/api/clients/rcw/model/application.zod.gen.js";
import type { EditApplicationContext } from "#/journeys/edit-application/editApplication.types.js";

import { CONTEXT_DATA_KEYS } from "#/journeys/journey.constants.js";
import { getJourneyDraftKey } from "#/journeys/journeyDraftKey.js";
import { getSessionDataOrThrow } from "#/journeys/shared.helper.js";
import { DeclarationDto } from "#/api/dto/declaration/declaration.dto.js";
import { logger } from "#/logger.js";

export const loadDeclarationAsAnswers =
  () =>
  (context: EditApplicationContext, journeyCode: string): void => {
    const session = getSessionDataOrThrow(context);
    const draftKey = getJourneyDraftKey(context, journeyCode);

logger.error("MMMMMM session drafts", session.journeyDrafts?.[draftKey]);

    if (session.journeyDrafts?.[draftKey]) {
      return;
    }

    const application: Application = context.getData(
      CONTEXT_DATA_KEYS.application,
    );

    logger.error("MMMMMM application", application.ufn);

    const answersArray = application
      ? DeclarationDto.toAnswers(application)
      : {};

    logger.error("MMMMMM answersArray", answersArray);

    for (const [code, value] of Object.entries(answersArray)) {
      context.setAnswer(code, value);
    }

    session.journeyDrafts ??= {};

    session.journeyDrafts[draftKey] = {
      ...session.journeyDrafts[draftKey],
      ...context.getAllAnswers(),
    };
  };
