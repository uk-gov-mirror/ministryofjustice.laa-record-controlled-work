import type { RenderBlock } from "@ministryofjustice/hmpps-forge/core/framework";
import type {
  TestRedirectResult,
  TestRenderResult,
} from "@ministryofjustice/hmpps-forge/core/testing";

import { expect } from "chai";

import { AnswerKey } from "#/journeys/AnswerKey.enum.js";
import { createApplicationEffectsRegistry } from "#/journeys/create-application/create-application.effects.js";
import { createApplicationJourney } from "#/journeys/create-application/create-application.journey.js";

import { createApplicationTestClient } from "../../utils/helpers.js";

describe("Parental responsibility step", () => {
  const stepUrl = "/cases/new/parental-responsibility";
  const client = createApplicationTestClient(
    createApplicationJourney,
    createApplicationEffectsRegistry,
  );

  describe(`GET ${stepUrl}`, () => {
    let renderResult: TestRenderResult;
    let radioInput: RenderBlock;

    before(async () => {
      const result = await client.get(stepUrl);
      expect(result.type).to.equal("render");
      renderResult = result as TestRenderResult;
      [radioInput] = renderResult.getBlocksByVariant("govukRadioInput");
    });

    it("has the expected title", () => {
      expect(renderResult.context.step.title).to.equal(
        "Does the client have parental responsibility for the child in these proceedings?",
      );
    });

    it("renders the expected radio options", () => {
      const buttons = radioInput.properties.items as {
        text: string;
        value: string;
      }[];

      expect(buttons).to.have.lengthOf(2);
      expect(buttons).to.deep.include.members([
        { text: "Yes", value: "yes" },
        { text: "No", value: "no" },
      ]);
    });
  });

  describe(`POST ${stepUrl}`, () => {
    // TODO MEM-1055: Enable when the Confirm Merits step is available.
    it.skip("redirects No to Confirm Merits", async () => {
      const result = (await client.post(stepUrl, {
        body: { careProceedingsParentalResponsibility: "no" },
      })) as TestRedirectResult;

      expect(result.type).to.equal("redirect");
      expect(result.url).to.equal("/cases/new/confirm-merits");
    });

    // TODO MEM-1055: Enable when the Confirm Merits step is available.
    it.skip("redirects Yes to Confirm Merits", async () => {
      const result = (await client.post(stepUrl, {
        body: { careProceedingsParentalResponsibility: "yes" },
      })) as TestRedirectResult;

      expect(result.type).to.equal("redirect");
      expect(result.url).to.equal("/cases/new/confirm-merits");
    });

    for (const answer of ["yes", "no"]) {
      it(`returns to Check your answers after changing to '${answer}'`, async () => {
        const result = (await client.post(stepUrl, {
          query: { returnTo: "check-answers" },
          body: { careProceedingsParentalResponsibility: answer },
        })) as TestRedirectResult;

        expect(result.type).to.equal("redirect");
        expect(result.url).to.equal("/cases/new/check-answers");
      });
    }

    it("shows the required error and leaves the draft unchanged when unanswered", async () => {
      const session = { journeyDrafts: { createApplication: { ecf: "no" } } };
      const result = await client.post(stepUrl, { body: {}, session });

      expect(result.type).to.equal("render");
      const renderResult = result as TestRenderResult;
      expect(renderResult.context.showValidationFailures).to.equal(true);
      expect(
        renderResult
          .getValidationErrorsByFieldCode(
            AnswerKey.careProceedingsParentalResponsibility,
          )
          .map((error) => error.message),
      ).to.include(
        "Select if your client has parental responsibility for the child in these proceedings",
      );
      expect(session.journeyDrafts.createApplication).to.deep.equal({
        ecf: "no",
      });
    });

    for (const answer of ["yes", "no"]) {
      it(`saves '${answer}' before continuing`, async () => {
        const session = { journeyDrafts: { createApplication: { ecf: "no" } } };
        const result = (await client.post(stepUrl, {
          body: { careProceedingsParentalResponsibility: answer },
          session,
        })) as TestRedirectResult;

        expect(result.type).to.equal("redirect");
        expect(result.url).to.equal("/cases/new/legal-aid-before");
        expect(session.journeyDrafts.createApplication).to.deep.equal({
          ecf: "no",
          careProceedingsParentalResponsibility: answer,
        });
      });
    }
  });
});
