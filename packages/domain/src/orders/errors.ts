import { Schema } from 'effect';

/** The order failed validation (blank restaurant, cutoff not in the future, …). */
export class InvalidOrder extends Schema.TaggedErrorClass<InvalidOrder>()('InvalidOrder', {
	reason: Schema.String,
}) {}

/** The dish failed validation (blank name, non-positive price, …). */
export class InvalidDish extends Schema.TaggedErrorClass<InvalidDish>()('InvalidDish', {
	reason: Schema.String,
}) {}

/** The cutoff has passed, or the order is already closed. Nobody may change it. */
export class OrderClosed extends Schema.TaggedErrorClass<OrderClosed>()('OrderClosed', {
	closesAt: Schema.Number,
}) {}

/** The actor is not the person who ordered this dish. */
export class NotDishOwner extends Schema.TaggedErrorClass<NotDishOwner>()('NotDishOwner', {
	actorId: Schema.String,
	dishOwnerId: Schema.String,
}) {}

export type OrderError = InvalidOrder | InvalidDish | OrderClosed | NotDishOwner;
