import { DeclarationDto } from "#/api/dto/declaration/declaration.dto.js";
import { DeclarationAnswers } from "#/journeys/declaration/declaration.types.js";
import { createSavedApplication } from "#tests/fixtures/application.fixtures.js";
import { expect } from "chai";

const declarationAnswers: DeclarationAnswers = {
  declarationUfn: "123456/789",
  declarationSignedDate: "2024-06-01",
  declarationSignedConfirm: ["yes"],
};

describe("DeclarationDto", () => {
  it("should map answers to API request format", () => {
    const expected = {
      ufn: "123456/789",
      dateSigned: new Date("2024-06-01").toISOString(),
      declarationConfirmation: true,
    };

    const result = DeclarationDto.fromAnswers(declarationAnswers).toRcwApi();
    expect(result).to.deep.equal(expected);
  });

  it("should map 'no' confirmation to false in API request format", () => {
    const noConfirmationAnswers: DeclarationAnswers = {
      declarationUfn: "123456/789",
      declarationSignedDate: "2024-06-01",
      declarationSignedConfirm: ["no"],
    };

    const expected = {
      ufn: "123456/789",
      dateSigned: new Date("2024-06-01").toISOString(),
      declarationConfirmation: false,
    };

    const result = DeclarationDto.fromAnswers(noConfirmationAnswers).toRcwApi();
    expect(result).to.deep.equal(expected);
  });

  it("should map the response back to the answers array", () => {
    const application = createSavedApplication();

    const expectedAnswers = {
      declarationUfn: application.ufn,
      declarationSignedDate: application.declaration?.dateSigned,
      declarationSignedConfirm: application.declaration?.declarationConfirmation
        ? ["yes"]
        : ["no"],
    };

    const result = DeclarationDto.toAnswers(application);
    expect(result).to.deep.equal(expectedAnswers);
  });
});
