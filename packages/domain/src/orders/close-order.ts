import { Effect } from 'effect';

import { isOrderLocked, type OrderStatus, type OrderWindow } from './order-window';

/**
 * The cutoff decision. At or after `closesAt` the order is closed; before that
 * it stays as it is. Scheduling stays in the Convex handler.
 */
export const closeIfDue = (order: OrderWindow, now: number) =>
	Effect.sync((): OrderStatus => (isOrderLocked(order, now) ? 'closed' : order.status));
