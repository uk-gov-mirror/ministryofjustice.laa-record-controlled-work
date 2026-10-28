import type { BlockDefinition } from "@ministryofjustice/hmpps-forge/core/components";

import {
  Data,
  Format,
  Transformer,
} from "@ministryofjustice/hmpps-forge/core/authoring";
import {
  GovUKBody,
  GovUKButton,
  GovUKButtonGroup,
  GovUKHeading,
  GovUKWarningText,
} from "@ministryofjustice/hmpps-forge/govuk-components";

import {
  CLIENT_DETAILS_DATA_KEYS,
  CONTEXT_DATA_KEYS,
} from "#/journeys/journey.constants.js";
import { H1 } from "#/lib/constants/headings.js";
import { i18next, t } from "#/lib/i18n.js";

/**
 * Generates an HTML unordered list from a translation key that returns an array of strings.
 * @param key - The key in the translation file
 * @param classes - The classes to apply to the unordered list
 * @returns An HTML string representing the unordered list
 */
function textListHtml(key: string, classes: string): string {
  const items = i18next.t(key, { returnObjects: true });

  if (!Array.isArray(items)) {
    return "";
  }

  const listItems = items
    .filter((item): item is string => typeof item === "string")
    .map((item) => `<li>${item}</li>`)
    .join("");

  return `<ul class="${classes}">${listItems}</ul>`;
}

export const confirmHeading = (): BlockDefinition =>
  GovUKHeading({
    level: H1,
    text: t("journeys.declaration.confirm.title"),
  });

const firstName = Data(CONTEXT_DATA_KEYS.application)
  .path(CLIENT_DETAILS_DATA_KEYS.firstName)
  .pipe(Transformer.String.EscapeHtml());

const lastName = Data(CONTEXT_DATA_KEYS.application)
  .path(CLIENT_DETAILS_DATA_KEYS.lastName)
  .pipe(Transformer.String.EscapeHtml());

export const clientName = Format("%1 %2", firstName, lastName);

const declarationListHtml = textListHtml(
  "journeys.declaration.confirm.declarationList",
  "govuk-list govuk-list--bullet govuk-!-margin-bottom-6",
);

export const confirmBody = (): BlockDefinition =>
  GovUKBody({
    classes: "govuk-body",
    text: Format(
      "%1 %2<br>%3",
      clientName,
      t("journeys.declaration.confirm.declarationText"),
      declarationListHtml,
    ),
  });

export const confirmWarning = (): BlockDefinition =>
  GovUKWarningText({
    html: `${t(
      "journeys.declaration.confirm.warningText",
    )} <br>${textListHtml("journeys.declaration.confirm.warningList", "govuk-list govuk-list--bullet govuk-!-margin-bottom-6 govuk-!-font-weight-bold")}`,
    iconFallbackText: "Warning",
  });

export const confirmButtonGroup = (): BlockDefinition =>
  GovUKButtonGroup({
    buttons: [
      GovUKButton({
        buttonType: "submit",
        text: t("journeys.declaration.confirm.confirmButton"),
        value: "continue",
      }),
      GovUKButton({
        buttonType: "submit",
        classes: "govuk-button--secondary",
        text: t("common.saveAndReturn"),
        value: "return",
      }),
    ],
  });
