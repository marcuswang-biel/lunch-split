import { Schema, SchemaTransformation } from 'effect';

/** Longest dish name, after trimming. */
export const DISH_NAME_MAX_LENGTH = 80;

/** HK$10,000. A single lunch dish above this is rejected. */
export const DISH_PRICE_MAX_CENTS = 1_000_000;

/**
 * A dish as added or revised. Decoding trims the name and requires a positive
 * whole number of cents within the price cap.
 */
export const DishDraft = Schema.Struct({
	name: Schema.String.pipe(Schema.decode(SchemaTransformation.trim())).check(
		Schema.isMinLength(1),
		Schema.isMaxLength(DISH_NAME_MAX_LENGTH),
	),
	priceCents: Schema.Int.check(
		Schema.isGreaterThan(0),
		Schema.isLessThanOrEqualTo(DISH_PRICE_MAX_CENTS),
	),
});

export type DishDraft = typeof DishDraft.Type;

/** The raw input a caller hands to a dish rule. */
export type DishRequest = typeof DishDraft.Encoded;
