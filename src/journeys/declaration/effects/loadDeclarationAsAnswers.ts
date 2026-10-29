import type { Application } from "#/api/clients/rcw/model/application.zod.gen.js";
import type { EditApplicationContext } from "#/journeys/edit-application/editApplication.types.js";

import { DeclarationDto } from "#/api/dto/declaration/declaration.dto.js";
import { CONTEXT_DATA_KEYS } from "#/journeys/journey.constants.js";
import { getJourneyDraftKey } from "#/journeys/journeyDraftKey.js";
import { getSessionDataOrThrow } from "#/journeys/shared.helper.js";

export const loadDeclarationAsAnswers =
  () =>
  (context: EditApplicationContext, journeyCode: string): void => {
    const session = getSessionDataOrThrow(context);
    const draftKey = getJourneyDraftKey(context, journeyCode);

    if (session.journeyDrafts?.[draftKey]) {
      return;
    }

    const application: Application = context.getData(
      CONTEXT_DATA_KEYS.application,
    );

    const answersArray = DeclarationDto.toAnswers(application);

    for (const [code, value] of Object.entries(answersArray)) {
      context.setAnswer(code, value);
    }

    session.journeyDrafts ??= {};

    session.journeyDrafts[draftKey] = {
      ...session.journeyDrafts[draftKey],
      ...context.getAllAnswers(),
    };
  };
