import { Effect, Schema } from 'effect';

import { DishDraft, type DishRequest } from './dish-draft';
import { InvalidDish, NotDishOwner, OrderClosed } from './errors';
import { isOrderLocked, type OrderWindow } from './order-window';

const rejectIfLocked = (order: OrderWindow, now: number) =>
	Effect.gen(function* () {
		if (isOrderLocked(order, now)) {
			return yield* new OrderClosed({ closesAt: order.closesAt });
		}
	});

const rejectUnlessOwner = (dishOwnerId: string, actorId: string) =>
	Effect.gen(function* () {
		if (dishOwnerId !== actorId) {
			return yield* new NotDishOwner({ actorId, dishOwnerId });
		}
	});

const decodeDish = (request: DishRequest) =>
	Schema.decodeEffect(DishDraft)(request).pipe(
		Effect.mapError((error) => new InvalidDish({ reason: error.message })),
	);

/**
 * Anyone signed in may add a dish, until the order locks.
 * The caller supplies `now` and the order window; this function does no I/O.
 */
export const addDish = (request: DishRequest, order: OrderWindow, now: number) =>
	Effect.gen(function* () {
		yield* rejectIfLocked(order, now);
		return yield* decodeDish(request);
	});

/**
 * Two rules, in order: a locked order rejects everyone, then only the dish
 * owner may change it.
 */
export const reviseDish = (
	request: DishRequest,
	order: OrderWindow,
	dishOwnerId: string,
	actorId: string,
	now: number,
) =>
	Effect.gen(function* () {
		yield* rejectIfLocked(order, now);
		yield* rejectUnlessOwner(dishOwnerId, actorId);
		return yield* decodeDish(request);
	});

/** Same two rules as {@link reviseDish}, with nothing left to decode. */
export const removeDish = (order: OrderWindow, dishOwnerId: string, actorId: string, now: number) =>
	Effect.gen(function* () {
		yield* rejectIfLocked(order, now);
		yield* rejectUnlessOwner(dishOwnerId, actorId);
	});
