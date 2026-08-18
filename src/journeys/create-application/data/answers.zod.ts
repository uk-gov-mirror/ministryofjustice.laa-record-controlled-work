import { z as zod } from "zod";

import { AnswerKey } from "#/journeys/AnswerKey.enum.js";

export const Answers = zod.object({
  [AnswerKey.addressLine1]: zod.string(),
  [AnswerKey.addressLine2]: zod.string().optional(),
  [AnswerKey.addressLine3]: zod.string().optional(),
  [AnswerKey.addressLine4]: zod.string().optional(),
  [AnswerKey.country]: zod.string(),
  [AnswerKey.county]: zod.string().optional(),
  [AnswerKey.dateOfBirth]: zod.string(),
  [AnswerKey.ecf]: zod.string(),
  [AnswerKey.firstName]: zod.string(),
  [AnswerKey.hasNINumber]: zod.string(),
  [AnswerKey.haveAHomeAddress]: zod.string(),
  [AnswerKey.lastName]: zod.string(),
  [AnswerKey.legalAidBefore]: zod.string(),
  [AnswerKey.legalAidLast6Months]: zod.string().optional(),
  [AnswerKey.niNumber]: zod.string().optional(),
  [AnswerKey.postcode]: zod.string().optional(),
  [AnswerKey.reasonForYes]: zod.string().optional(),
  [AnswerKey.townOrCity]: zod.string().optional(),
});

export type Answers = zod.input<typeof Answers>;
export type AnswersOutput = zod.output<typeof Answers>;
