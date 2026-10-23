import type { RenderBlock } from "@ministryofjustice/hmpps-forge/core/framework";
import type { TestRenderResult } from "@ministryofjustice/hmpps-forge/core/testing";

import { expect } from "chai";

import { AnswerKey } from "#/journeys/AnswerKey.enum.js";
import { createApplicationEffectsRegistry } from "#/journeys/create-application/create-application.effects.js";
import { createApplicationJourney } from "#/journeys/create-application/create-application.journey.js";
import { H1 } from "#/lib/constants/headings.js";
import { createApplicationTestClient } from "#tests/integration/utils/helpers.js";

/**
 * Finds a rendered block whose text contains the requested content.
 * @param blocks The rendered blocks to search.
 * @param text The text to find.
 * @returns The matching block, if one exists.
 */
function findBlockWithText(
  blocks: RenderBlock[],
  text: string,
): RenderBlock | undefined {
  for (const block of blocks) {
    if (String(block.properties.text).includes(text)) {
      return block;
    }
  }

  return undefined;
}

/**
 * Gets the validation messages for a form field.
 * @param render The rendered form response.
 * @param fieldCode The field code to inspect.
 * @returns The validation messages for the field.
 */
function getValidationErrorMessages(
  render: TestRenderResult,
  fieldCode: string,
): string[] {
  const messages: string[] = [];

  for (const error of render.getValidationErrorsByFieldCode(fieldCode)) {
    messages.push(error.message);
  }

  return messages;
}

describe("Confirm Merits step", () => {
  const stepUrl = "/cases/new/confirm-merits";
  const client = createApplicationTestClient(
    createApplicationJourney,
    createApplicationEffectsRegistry,
  );

  describe(`GET ${stepUrl}`, () => {
    let render: TestRenderResult;

    before(async () => {
      const result = await client.get(stepUrl);

      if (result.type !== "render") {
        throw new Error("Expected Confirm Merits page to render");
      }

      render = result;
    });

    it("renders the expected heading", () => {
      expect(render.context.step.title).to.equal(
        "Confirm the case meets the merits criteria",
      );
      const heading = findBlockWithText(
        render.getBlocksByVariant("govukHeading"),
        render.context.step.title,
      );

      if (heading === undefined) {
        throw new Error("Expected Confirm Merits heading block");
      }

      expect(heading.properties.level).to.equal(H1);
    });

    it("renders the body and regulations link", () => {
      const body = findBlockWithText(
        render.getBlocksByVariant("govukBody"),
        "All legal aid cases must meet the relevant merits criteria set out in the",
      );

      if (body === undefined) {
        throw new Error("Expected Confirm Merits body block");
      }

      expect(body.properties.text).to.include(
        '<a class="govuk-link" href="https://example.com">Civil Legal Aid (Merits Criteria) Regulations (2013)</a>',
      );
    });

    it("renders one required confirmation checkbox", () => {
      const [checkbox] = render.getBlocksByVariant("govukCheckboxInput");

      expect(checkbox.properties.items).to.deep.equal([
        {
          text: "I confirm the case meets the criteria",
          value: "yes",
        },
      ]);
      expect(checkbox.properties.code).to.equal(AnswerKey.confirmMerits);
    });
  });

  describe(`POST ${stepUrl}`, () => {
    it("shows the required confirmation error when no checkbox is selected", async () => {
      const result = await client.post(stepUrl);

      if (result.type !== "render") {
        throw new Error("Expected validation error page to render");
      }

      expect(result.context.showValidationFailures).to.equal(true);
      expect(
        getValidationErrorMessages(result, AnswerKey.confirmMerits),
      ).to.deep.equal(["You must confirm the case meets the merits criteria"]);
    });

    it("saves a valid answer and redirects to Legal Aid Before", async () => {
      const result = await client.post(stepUrl, {
        body: {
          [AnswerKey.confirmMerits]: "yes",
        },
      });

      expect(result.type).to.equal("redirect");
      expect(result.url).to.equal("/cases/new/legal-aid-before");
    });

    it("returns to Check Answers when the confirmation is edited", async () => {
      const result = await client.post(stepUrl, {
        body: {
          [AnswerKey.confirmMerits]: "yes",
        },
        query: { returnTo: "check-answers" },
      });

      expect(result.type).to.equal("redirect");
      expect(result.url).to.equal("/cases/new/check-answers");
    });
  });
});
