import { Schema, SchemaTransformation } from 'effect';

/** Longest restaurant name an order may carry, after trimming. */
export const RESTAURANT_MAX_LENGTH = 80;

/**
 * An order as opened, before the cutoff check. Decoding trims the restaurant
 * and requires a positive whole-number cutoff timestamp.
 */
export const OrderDraft = Schema.Struct({
	restaurant: Schema.String.pipe(Schema.decode(SchemaTransformation.trim())).check(
		Schema.isMinLength(1),
		Schema.isMaxLength(RESTAURANT_MAX_LENGTH),
	),
	closesAt: Schema.Int.check(Schema.isGreaterThan(0)),
});

export type OrderDraft = typeof OrderDraft.Type;

/** The raw input a caller hands to the open-order rule. */
export type OrderRequest = typeof OrderDraft.Encoded;
