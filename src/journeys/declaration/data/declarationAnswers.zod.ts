import { z as zod } from "zod";

export const DeclarationAnswers = zod.object({
  declarationUfn: zod.string().optional(),
  declarationSignedDate: zod.string().optional(),
  declarationSignedConfirm: zod.boolean().optional(),
});

export type DeclarationAnswersInput = zod.input<typeof DeclarationAnswers>;
export type DeclarationAnswersOutput = zod.output<typeof DeclarationAnswers>;
