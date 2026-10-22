/**
 * Lunch orders.
 *
 * Boundary (ADR 0001): authorize, read, run the Effect program in
 * `@lunch-split/domain/orders`, map tagged errors to `ConvexError` codes, then
 * write. The cutoff job is scheduled here; the rule only decides.
 */
import {
	addDish as addDishRule,
	closeIfDue,
	openOrder,
	removeDish as removeDishRule,
	reviseDish as reviseDishRule,
	type OrderError,
} from '@lunch-split/domain/orders';
import { APP_ERROR_CODES, type AppErrorData } from '@lunch-split/shared/error-codes';
import { ConvexError, v } from 'convex/values';
import { Cause, Effect, Exit } from 'effect';

import { internal } from './_generated/api';
import { query } from './_generated/server';
import { internalMutation, mutation } from './functions';
import { requireUserId } from './lib/identity';
import { orderStatusValidator } from './schema';

const orderValidator = v.object({
	_id: v.id('orders'),
	_creationTime: v.number(),
	openerId: v.string(),
	restaurant: v.string(),
	closesAt: v.number(),
	status: orderStatusValidator,
	createdAt: v.number(),
});

const dishValidator = v.object({
	_id: v.id('dishes'),
	_creationTime: v.number(),
	orderId: v.id('orders'),
	ownerId: v.string(),
	name: v.string(),
	priceCents: v.number(),
	createdAt: v.number(),
});

function toConvexError(error: OrderError): ConvexError<AppErrorData> {
	switch (error._tag) {
		case 'InvalidOrder':
			return new ConvexError({ code: APP_ERROR_CODES.orderInvalid, message: error.reason });
		case 'InvalidDish':
			return new ConvexError({ code: APP_ERROR_CODES.dishInvalid, message: error.reason });
		case 'OrderClosed':
			return new ConvexError({
				code: APP_ERROR_CODES.orderClosed,
				message: 'The order is closed.',
			});
		case 'NotDishOwner':
			return new ConvexError({
				code: APP_ERROR_CODES.notDishOwner,
				message: 'You can only change your own dish.',
			});
	}
}

async function runOrder<A, E extends OrderError>(program: Effect.Effect<A, E>): Promise<A> {
	const exit = await Effect.runPromiseExit(program);
	if (Exit.isFailure(exit)) {
		const failure = Cause.findErrorOption(exit.cause);
		if (failure._tag === 'Some') throw toConvexError(failure.value);
		throw Cause.squash(exit.cause);
	}
	return exit.value;
}

function notFound(message: string): ConvexError<AppErrorData> {
	return new ConvexError({ code: APP_ERROR_CODES.notFound, message });
}

/** Recent orders, newest first. Shared with everyone signed in. */
export const list = query({
	args: {},
	returns: v.array(orderValidator),
	handler: async (ctx) => {
		await requireUserId(ctx);
		return await ctx.db.query('orders').withIndex('by_createdAt').order('desc').take(100);
	},
});

/** One order, or null when it does not exist. */
export const get = query({
	args: { orderId: v.id('orders') },
	returns: v.union(orderValidator, v.null()),
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		return await ctx.db.get('orders', args.orderId);
	},
});

/** Dishes on an order, oldest first. */
export const listDishes = query({
	args: { orderId: v.id('orders') },
	returns: v.array(dishValidator),
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		return await ctx.db
			.query('dishes')
			.withIndex('by_order_and_createdAt', (q) => q.eq('orderId', args.orderId))
			.take(100);
	},
});

/** Open an order and schedule the cutoff. */
export const open = mutation({
	args: { restaurant: v.string(), closesAt: v.number() },
	returns: v.id('orders'),
	handler: async (ctx, args) => {
		const openerId = await requireUserId(ctx);
		const now = Date.now();
		const draft = await runOrder(openOrder(args, now));
		const orderId = await ctx.db.insert('orders', {
			openerId,
			restaurant: draft.restaurant,
			closesAt: draft.closesAt,
			status: 'open',
			createdAt: now,
		});
		await ctx.scheduler.runAt(draft.closesAt, internal.orders.close, { orderId });
		return orderId;
	},
});

/** Add your own dish while the order is still open. */
export const addDish = mutation({
	args: { orderId: v.id('orders'), name: v.string(), priceCents: v.number() },
	returns: v.id('dishes'),
	handler: async (ctx, args) => {
		const ownerId = await requireUserId(ctx);
		const order = await ctx.db.get('orders', args.orderId);
		if (!order) throw notFound('Order not found.');
		const now = Date.now();
		const draft = await runOrder(
			addDishRule({ name: args.name, priceCents: args.priceCents }, order, now),
		);
		return await ctx.db.insert('dishes', {
			orderId: args.orderId,
			ownerId,
			name: draft.name,
			priceCents: draft.priceCents,
			createdAt: now,
		});
	},
});

/** Change a dish you ordered, while the order is still open. */
export const reviseDish = mutation({
	args: { dishId: v.id('dishes'), name: v.string(), priceCents: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const actorId = await requireUserId(ctx);
		const dish = await ctx.db.get('dishes', args.dishId);
		if (!dish) throw notFound('Dish not found.');
		const order = await ctx.db.get('orders', dish.orderId);
		if (!order) throw notFound('Order not found.');
		const draft = await runOrder(
			reviseDishRule(
				{ name: args.name, priceCents: args.priceCents },
				order,
				dish.ownerId,
				actorId,
				Date.now(),
			),
		);
		await ctx.db.patch('dishes', args.dishId, {
			name: draft.name,
			priceCents: draft.priceCents,
		});
		return null;
	},
});

/** Remove a dish you ordered, while the order is still open. */
export const removeDish = mutation({
	args: { dishId: v.id('dishes') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const actorId = await requireUserId(ctx);
		const dish = await ctx.db.get('dishes', args.dishId);
		if (!dish) throw notFound('Dish not found.');
		const order = await ctx.db.get('orders', dish.orderId);
		if (!order) throw notFound('Order not found.');
		await runOrder(removeDishRule(order, dish.ownerId, actorId, Date.now()));
		await ctx.db.delete('dishes', args.dishId);
		return null;
	},
});

/** Scheduled at the cutoff. Idempotent if the order is already closed or gone. */
export const close = internalMutation({
	args: { orderId: v.id('orders') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const order = await ctx.db.get('orders', args.orderId);
		if (!order) return null;
		const status = await runOrder(closeIfDue(order, Date.now()));
		if (status === 'closed' && order.status !== 'closed') {
			await ctx.db.patch('orders', args.orderId, { status: 'closed' });
		}
		return null;
	},
});
