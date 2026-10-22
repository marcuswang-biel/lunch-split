export type OrderStatus = 'open' | 'closed';

/** The slice of an order the rules need. The handler reads it; the rule does not. */
export type OrderWindow = {
	readonly status: OrderStatus;
	readonly closesAt: number;
};

/** Closed status and a reached cutoff are the same lock. */
export const isOrderLocked = (order: OrderWindow, now: number): boolean =>
	order.status === 'closed' || now >= order.closesAt;
