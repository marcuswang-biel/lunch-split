import { Effect, Schema } from 'effect';

import { InvalidOrder } from './errors';
import { OrderDraft, type OrderRequest } from './order-draft';

/**
 * Accepts an order when the restaurant name is usable and the cutoff is still
 * ahead of `now`. The caller writes the row and schedules the close.
 */
export const openOrder = (request: OrderRequest, now: number) =>
	Effect.gen(function* () {
		const draft = yield* Schema.decodeEffect(OrderDraft)(request).pipe(
			Effect.mapError((error) => new InvalidOrder({ reason: error.message })),
		);
		if (draft.closesAt <= now) {
			return yield* new InvalidOrder({ reason: 'Cutoff must be in the future.' });
		}
		return draft;
	});
