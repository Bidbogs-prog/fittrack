import type { GeminiSchema } from "@/lib/gemini";

/**
 * The meal parser's schema and system prompt, outside the "use server"
 * module so tests and evals can run the exact production prompt.
 */

export const PARSE_SCHEMA: GeminiSchema = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING", description: "Short display name for this food, max 60 chars" },
          portion: {
            type: "STRING",
            description: "The portion as understood, e.g. '1 large bowl' or '2 slices'",
          },
          grams: { type: "NUMBER", description: "Estimated edible weight in grams" },
          kcal: { type: "NUMBER", description: "Calories for the whole portion" },
          protein_g: { type: "NUMBER" },
          carbs_g: { type: "NUMBER" },
          fat_g: { type: "NUMBER" },
          fibre_g: { type: "NUMBER" },
          search_query: {
            type: "STRING",
            description:
              "2-3 generic words to find this food in the database, e.g. 'poulet grillé' or 'white rice'",
          },
        },
        required: [
          "name",
          "portion",
          "grams",
          "kcal",
          "protein_g",
          "carbs_g",
          "fat_g",
          "fibre_g",
          "search_query",
        ],
      },
    },
  },
  required: ["items"],
};
// Optional: the model fills refs only when the user points at their own meals.
(PARSE_SCHEMA.properties!).refs = {
  type: "ARRAY",
  description: "The user's saved meals, recipes or recent meals they asked to log, by catalogue id",
  items: {
    type: "OBJECT",
    properties: {
      ref: { type: "STRING", description: "A catalogue id exactly as listed, e.g. S2, R1, D4" },
      servings: {
        type: "NUMBER",
        description: "Multiplier: 1 = as saved; 2 = double; for recipes, number of servings",
      },
    },
    required: ["ref", "servings"],
  },
};

export const PARSE_SYSTEM_PROMPT = `You are the meal-parsing engine of So3ra, a nutrition tracker used mainly in Morocco. Given a user's description of a meal (text, photo, or both), split it into distinct food items and estimate each portion like a careful registered dietitian.

Rules:
- One item per distinct food. Composite dishes the user names as one thing (e.g. "tagine de poulet") stay one item unless the user lists components.
- grams is the edible cooked weight actually eaten. When the user gives an amount, respect it; otherwise assume typical portions, erring on the conservative side.
- kcal and macros are for the WHOLE portion, not per 100 g, and must be plausible for the grams given.
- The user may write in English, French, Arabic or Darija. Keep "name" in the language the user used; for photos use the photo's most likely local name.
- search_query: generic words that would match a food database built from Open Food Facts Morocco (mostly French product names) plus common whole foods in English. Prefer the French generic term for produce and dishes, the brand name for packaged products.
- A photo shows one meal: identify only foods you can actually see, plus obvious hidden staples (cooking oil) folded into the item's estimate.
- If nothing edible is described or visible, return an empty items array.

THE USER'S OWN MEALS: a catalogue of their saved meals (S…), recipes (R…) and meals logged in the last week (D…) may follow the description. When the user refers to one of them — "my protein shake breakfast", "my usual lunch", "same as yesterday's dinner", "2 servings of my harira" — put it in refs with its id and a servings multiplier instead of re-estimating it in items. Match by meaning and language (Darija, French, English), not exact spelling; for "yesterday's X" or "same as this morning" use the D entry with that date and meal. Only use ids that are listed. Anything else they mention still goes in items. If nothing in the catalogue fits, leave refs empty.`;
