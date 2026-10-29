import { z as zod } from "zod";

export const DeclarationAnswers = zod.object({
  declarationSignedConfirm: zod.boolean().optional(),
  declarationSignedDate: zod.string().optional(),
  declarationUfn: zod.string().optional(),
});

export type DeclarationAnswersInput = zod.input<typeof DeclarationAnswers>;
export type DeclarationAnswersOutput = zod.output<typeof DeclarationAnswers>;
