import type { Application } from "#/api/clients/rcw/model/application.zod.gen.js";
import {
  UpdateApplicationDeclarationBody,
} from "#/api/clients/rcw/model/updateApplicationDeclarationBody.zod.gen.js";
import { DeclarationAnswers } from "#/journeys/declaration/declaration.types.js";
import { AnswerKey as A } from "#/journeys/declaration/declaration.answers.js";


/**
 *  Data Transfer Object for Declaration answers, mapping between the application's declaration answers and the API request format.
 */
export class DeclarationDto {
  public declarationUfn?: string;
  public declarationSignedDate?: string;
  public declarationSignedConfirm?: string[];

  /**
   * Constructs a DeclarationDto from the given declaration answers.
   * @param evidence The declaration answers from the application.
   */
  public constructor(evidence: DeclarationAnswers) {
    Object.assign(this, evidence);
  }

  /**
   * Creates a DeclarationDto from the given declaration answers.
   * @param answers The declaration answers from the application.
   * @returns An instance of DeclarationDto containing the mapped declaration answers.
   */
  public static fromAnswers(answers: DeclarationAnswers): DeclarationDto {
    return new DeclarationDto({
      declarationUfn: answers[A.DECLARATION_UFN],
      declarationSignedDate: answers[A.DECLARATION_SIGNED_DATE],
      declarationSignedConfirm: answers[A.DECLARATION_SIGNED_CONFIRM],
    });
  }

  /**
   * Converts the given API declaration format to the application's declaration answers format.
   * @param declaration The declaration from the API.
   * @returns The application's declaration answers format.
   */
  public static toAnswers(application: Application): DeclarationAnswers {
    return {
      [A.DECLARATION_UFN]: application.ufn ?? undefined,
      [A.DECLARATION_SIGNED_DATE]: application.declaration?.dateSigned ?? undefined,
      [A.DECLARATION_SIGNED_CONFIRM]: application.declaration?.declarationConfirmation
        ? ["yes"]
        : ["no"],
    };
  }

  public toRcwApi(): UpdateApplicationDeclarationBody {
    if (!this.declarationSignedDate) {
      throw new Error("Declaration signed date is required");
    }

    return {
      ufn: this.declarationUfn,
      dateSigned: new Date(this.declarationSignedDate).toISOString(),
      declarationConfirmation: this.declarationSignedConfirm?.[0] === "yes",
    };
  }
}
