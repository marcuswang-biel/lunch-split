import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/** Stored claim status. English codes; clients translate the label. */
export const claimStatusValidator = v.union(v.literal('approved'), v.literal('pending'));

/** Stored order status. English codes; clients translate the label. */
export const orderStatusValidator = v.union(v.literal('open'), v.literal('closed'));

export default defineSchema({
	/**
	 * Example table. One row per expense claim. `ownerId` is the auth subject
	 * (`ctx.auth.getUserIdentity().subject`), so every read and write is scoped by it.
	 * Delete this table, `claims.ts` and `packages/domain/src/claims` when you start
	 * your own domain.
	 */
	claims: defineTable({
		ownerId: v.string(),
		title: v.string(),
		amountCents: v.number(),
		status: claimStatusValidator,
		createdAt: v.number(),
	}).index('by_owner_and_createdAt', ['ownerId', 'createdAt']),

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
	 * ordered it. Only that person may change the row, and only while the order
	 * is open.
	 */
	dishes: defineTable({
		orderId: v.id('orders'),
		ownerId: v.string(),
		name: v.string(),
		priceCents: v.number(),
		createdAt: v.number(),
	}).index('by_order_and_createdAt', ['orderId', 'createdAt']),
});
