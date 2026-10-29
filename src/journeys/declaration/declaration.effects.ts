import { EffectRegistry } from "@ministryofjustice/hmpps-forge/core/authoring";

import type { EditApplicationEffectsDeps } from "#/journeys/edit-application/editApplication.types.js";

import { editApplicationEffects } from "#/journeys/edit-application/editApplication.effects.js";

import { submitSignedDeclaration } from "./effects/submitSignedDeclaration.js";

const registry = new EffectRegistry<EditApplicationEffectsDeps>();

const effects = {
  ...editApplicationEffects,
  submitSignedDeclaration: registry.register(submitSignedDeclaration),
};

export { registry as declarationEffectRegistry, effects as declarationEffects };
