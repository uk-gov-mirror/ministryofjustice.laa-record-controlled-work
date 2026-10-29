import type { Application } from "#/api/clients/rcw/model/application.zod.gen.js";
import type { UpdateApplicationDeclarationBody } from "#/api/clients/rcw/model/updateApplicationDeclarationBody.zod.gen.js";
import type { DeclarationAnswers } from "#/journeys/declaration/declaration.types.js";

import { AnswerKey as A } from "#/journeys/declaration/declaration.answers.js";

/**
 *  Data Transfer Object for Declaration answers, mapping between the application's declaration answers and the API request format.
 */
export class DeclarationDto {
  public declarationSignedConfirm?: string[];
  public declarationSignedDate?: string;
  public declarationUfn?: string;

  /**
   * Constructs a DeclarationDto from the given declaration answers.
   * @param declaration The declaration answers from the application.
   */
  public constructor(declaration: DeclarationAnswers) {
    Object.assign(this, declaration);
  }

  /**
   * Creates a DeclarationDto from the given declaration answers.
   * @param answers The declaration answers from the application.
   * @returns An instance of DeclarationDto containing the mapped declaration answers.
   */
  public static fromAnswers(answers: DeclarationAnswers): DeclarationDto {
    return new DeclarationDto({
      declarationSignedConfirm: answers[A.DECLARATION_SIGNED_CONFIRM],
      declarationSignedDate: answers[A.DECLARATION_SIGNED_DATE],
      declarationUfn: answers[A.DECLARATION_UFN],
    });
  }

  /**
   * Converts the given API declaration format to the application's declaration answers format.
   * @param application The application containing the declaration data.
   * @returns The application's declaration answers format.
   */
  public static toAnswers(application: Application): DeclarationAnswers {
    return {
      [A.DECLARATION_SIGNED_CONFIRM]: application.declaration
        ?.declarationConfirmation
        ? ["yes"]
        : ["no"],
      [A.DECLARATION_SIGNED_DATE]:
        application.declaration?.dateSigned ?? undefined,
      [A.DECLARATION_UFN]: application.ufn ?? undefined,
    };
  }

  /**
   * Converts the DeclarationDto instance to the API request format.
   * @returns The API request body for updating the application declaration.
   */
  public toRcwApi(): UpdateApplicationDeclarationBody {
    if (!this.declarationSignedDate) {
      throw new Error("Declaration signed date is required");
    }

    return {
      dateSigned: new Date(this.declarationSignedDate).toISOString(),
      // The `govukCheckbox` component returns `string[]` even though we only have one checkbox, so we can expect the first value to be our confirmation.
      // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Just getting the first array value.
      declarationConfirmation: this.declarationSignedConfirm?.[0] === "yes",
      ufn: this.declarationUfn,
    };
  }
}
