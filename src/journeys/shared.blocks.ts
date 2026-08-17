import {
  Condition,
  Self,
  validation,
} from "@ministryofjustice/hmpps-forge/core/authoring";
import {
  HtmlBlock,
  type ResolvableString,
} from "@ministryofjustice/hmpps-forge/core/components";
import {
  GovUKBackLink,
  GovUKButton,
  GovUKHeading,
  GovUKRadioInput,
} from "@ministryofjustice/hmpps-forge/govuk-components";

import { H1 } from "#/lib/constants/headings.js";
import { t } from "#/lib/i18n.js";

export const backLink = (url: ResolvableString): GovUKBackLink =>
  GovUKBackLink({
    href: url,
  });

export const heading = (text: string): HtmlBlock =>
  GovUKHeading({
    level: H1,
    text,
  });

export const caption = (text: string): HtmlBlock =>
  HtmlBlock({
    content: `<span class="govuk-caption-l">${text}</span>`,
  });

export const continueButton = (): GovUKButton =>
  GovUKButton({ text: t("common.continue") });

export const submitButton = GovUKButton({
  text: t("common.submit"),
});

export const button = (text: string): GovUKButton => GovUKButton({ text });

export const yesOrNoRadioInput = (
  code: string,
  question: string,
  validationErrorMessage: string,
  isPageHeading = true,
): GovUKRadioInput =>
  GovUKRadioInput({
    code,
    fieldset: {
      legend: {
        classes: "govuk-fieldset__legend--l",
        isPageHeading,
        text: question,
      },
    },
    items: [
      {
        text: t("common.yes"),
        value: "yes",
      },
      {
        text: t("common.no"),
        value: "no",
      },
    ],
    validWhen: [
      validation({
        condition: Self().match(Condition.IsRequired()),
        message: validationErrorMessage,
      }),
    ],
  });
