import nunjucks from "nunjucks";

import type {
  MeansAssessmentCalculationBreakdown,
  MeansAssessmentCalculationCell,
  MeansAssessmentCalculationPresentation,
  MeansAssessmentCalculationRow,
  MeansAssessmentCalculationTable,
} from "#/export/sections/meansAssessment/meansAssessment.types.js";

import { escapeHtml } from "#/export/export.helpers.js";

/**
 * Prepares calculation breakdowns for display with GOV.UK tables.
 * @param breakdowns Saved breakdowns in display order.
 * @returns Displayable tables or fallback messages, excluding omitted sections.
 */
export function toCalculationBreakdowns(
  breakdowns: MeansAssessmentCalculationBreakdown[],
): MeansAssessmentCalculationPresentation[] {
  return breakdowns.flatMap<MeansAssessmentCalculationPresentation>(
    (breakdown) => {
      if (breakdown.status === "ready") {
        return [
          {
            description: breakdown.description ?? [],
            heading: breakdown.heading,
            message: breakdown.message ?? null,
            tables: breakdown.tables.map((table) => ({
              caption: toTableCaption(table),
              captionClasses: "govuk-table__caption--m",
              classes: "app-means-assessment__calculation-table",
              firstCellIsHeader: true,
              rows: table.rows.map(toTableRow),
            })),
          },
        ];
      }

      if (breakdown.status === "unavailable" && breakdown.heading) {
        return [
          {
            description: [],
            heading: breakdown.heading,
            message: breakdown.message ?? null,
            tables: [],
          },
        ];
      }

      return [];
    },
  );
}

/**
 * Prepares a table caption with its optional monthly hint.
 * @param table Calculation table data.
 * @returns Plain heading text or escaped caption markup for the GOV.UK table macro.
 */
function toTableCaption(
  table: MeansAssessmentCalculationTable,
): nunjucks.runtime.SafeString | string {
  if (!table.hint) {
    return table.heading;
  }

  const heading = escapeHtml(table.heading);
  return new nunjucks.runtime.SafeString(
    `${heading}<br><span class="govuk-hint govuk-!-margin-bottom-0">${escapeHtml(table.hint)}</span>`,
  );
}

/**
 * Prepares accessible row headings, hint markup and amount cells.
 * @param row Formatted calculation row.
 * @returns Heading and amount cells for the GOV.UK table macro.
 */
function toTableRow(
  row: MeansAssessmentCalculationRow,
): MeansAssessmentCalculationCell[] {
  const emphasis = row.emphasis ? " app-calculation__cell--emphasis" : "";
  const classes = `app-calculation__row-heading${emphasis}`;
  const hints = [row.hint, row.additionalHint].filter((hint): hint is string =>
    Boolean(hint),
  );
  const heading: MeansAssessmentCalculationCell = hints.length
    ? {
        classes,
        html:
          escapeHtml(row.heading) +
          hints
            .map(
              (hint) =>
                ` <span class="govuk-hint govuk-!-margin-bottom-0">${escapeHtml(hint)}</span>`,
            )
            .join(""),
      }
    : { classes, text: row.heading };

  return [
    heading,
    {
      classes: `app-calculation__amount${emphasis}`,
      text: row.amount,
    },
  ];
}
