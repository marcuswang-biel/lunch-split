import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/** Stored order status. English codes; clients translate the label. */
export const orderStatusValidator = v.union(v.literal('open'), v.literal('closed'));

export default defineSchema({
	/**
	 * One lunch order for the office. Anyone signed in may read it. `openerId`
	 * is the auth subject of the person who opened it. `closesAt` is the cutoff;
	 * a scheduled job sets `status` to `closed` at that time.
	 */
	orders: defineTable({
		openerId: v.string(),
		restaurant: v.string(),
		closesAt: v.number(),
		status: orderStatusValidator,
		createdAt: v.number(),
	}).index('by_createdAt', ['createdAt']),

	/**
	 * One dish on an order. `ownerId` is the auth subject of the person who
	 * ordered it, and `ownerLabel` is the email or name shown to the office.
	 * Only that person may change the row, and only while the order is open.
	 */
	dishes: defineTable({
		orderId: v.id('orders'),
		ownerId: v.string(),
		ownerLabel: v.string(),
		name: v.string(),
		priceCents: v.number(),
		createdAt: v.number(),
	}).index('by_order_and_createdAt', ['orderId', 'createdAt']),
});
