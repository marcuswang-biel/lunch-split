// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexErrorCode } from '@lunch-split/shared/convex-error';
import { APP_ERROR_CODES } from '@lunch-split/shared/error-codes';
import { describe, expect, it, vi } from 'vitest';

import { convexTest, signIn } from '../../test/harness';
import { api } from '../_generated/api';
import schema from '../schema';

const modules = import.meta.glob(['../**/*.ts', '../**/*.js', '!../**/*.d.ts', '!../**/*.test.ts']);

async function codeOf(promise: Promise<unknown>) {
	try {
		await promise;
	} catch (error) {
		return convexErrorCode(error);
	}
	throw new Error('expected the call to fail');
}

describe('orders', () => {
	it('rejects anonymous callers', async () => {
		const t = convexTest(schema, modules);
		expect(await codeOf(t.query(api.orders.list, {}))).toBe(APP_ERROR_CODES.unauthenticated);
		expect(
			await codeOf(
				t.mutation(api.orders.open, { restaurant: '茶餐廳', closesAt: Date.now() + 60_000 }),
			),
		).toBe(APP_ERROR_CODES.unauthenticated);
	});

	it('shares a new dish with the other signed-in user', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');
		const bob = await signIn(t, 'bob@example.com');
		const orderId = await alice.as.mutation(api.orders.open, {
			restaurant: '  茶餐廳  ',
			closesAt: Date.now() + 60_000,
		});

		await alice.as.mutation(api.orders.addDish, {
			orderId,
			name: '  乾炒牛河  ',
			priceCents: 6_800,
		});

		const dishes = await bob.as.query(api.orders.listDishes, { orderId });
		expect(dishes).toHaveLength(1);
		expect(dishes[0]).toMatchObject({
			name: '乾炒牛河',
			priceCents: 6_800,
			ownerId: alice.userId,
			ownerLabel: 'alice@example.com',
		});
		const listed = await bob.as.query(api.orders.list, {});
		expect(listed.map((order) => order.restaurant)).toEqual(['茶餐廳']);
	});

	it('lets only the dish owner revise or remove it', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');
		const bob = await signIn(t, 'bob@example.com');
		const orderId = await alice.as.mutation(api.orders.open, {
			restaurant: '茶餐廳',
			closesAt: Date.now() + 60_000,
		});
		const dishId = await alice.as.mutation(api.orders.addDish, {
			orderId,
			name: '乾炒牛河',
			priceCents: 6_800,
		});

		expect(
			await codeOf(
				bob.as.mutation(api.orders.reviseDish, { dishId, name: '奶茶', priceCents: 1_800 }),
			),
		).toBe(APP_ERROR_CODES.notDishOwner);
		expect(await codeOf(bob.as.mutation(api.orders.removeDish, { dishId }))).toBe(
			APP_ERROR_CODES.notDishOwner,
		);

		await alice.as.mutation(api.orders.reviseDish, { dishId, name: '  奶茶  ', priceCents: 1_800 });
		const revised = await alice.as.query(api.orders.listDishes, { orderId });
		expect(revised[0]).toMatchObject({ name: '奶茶', priceCents: 1_800 });

		await alice.as.mutation(api.orders.removeDish, { dishId });
		expect(await alice.as.query(api.orders.listDishes, { orderId })).toEqual([]);
	});

	it('maps invalid input and writes nothing', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');

		expect(
			await codeOf(
				alice.as.mutation(api.orders.open, { restaurant: '   ', closesAt: Date.now() + 60_000 }),
			),
		).toBe(APP_ERROR_CODES.orderInvalid);
		expect(
			await codeOf(
				alice.as.mutation(api.orders.open, { restaurant: '茶餐廳', closesAt: Date.now() }),
			),
		).toBe(APP_ERROR_CODES.orderInvalid);
		expect(await alice.as.query(api.orders.list, {})).toEqual([]);

		const orderId = await alice.as.mutation(api.orders.open, {
			restaurant: '茶餐廳',
			closesAt: Date.now() + 60_000,
		});
		expect(
			await codeOf(alice.as.mutation(api.orders.addDish, { orderId, name: ' ', priceCents: 100 })),
		).toBe(APP_ERROR_CODES.dishInvalid);
		expect(await alice.as.query(api.orders.listDishes, { orderId })).toEqual([]);
	});

	it('rejects changes once the cutoff time has arrived, before the scheduler runs', async () => {
		const t = convexTest(schema, modules);
		const alice = await signIn(t, 'alice@example.com');
		const orderId = await alice.as.mutation(api.orders.open, {
			restaurant: '茶餐廳',
			closesAt: Date.now() + 60_000,
		});
		const dishId = await alice.as.mutation(api.orders.addDish, {
			orderId,
			name: '乾炒牛河',
			priceCents: 6_800,
		});
		await t.run(async (ctx) => {
			await ctx.db.patch('orders', orderId, { closesAt: Date.now() - 1 });
		});

		expect(
			await codeOf(
				alice.as.mutation(api.orders.addDish, { orderId, name: '奶茶', priceCents: 1_800 }),
			),
		).toBe(APP_ERROR_CODES.orderClosed);
		expect(
			await codeOf(
				alice.as.mutation(api.orders.reviseDish, { dishId, name: '奶茶', priceCents: 1_800 }),
			),
		).toBe(APP_ERROR_CODES.orderClosed);
		expect(await codeOf(alice.as.mutation(api.orders.removeDish, { dishId }))).toBe(
			APP_ERROR_CODES.orderClosed,
		);
	});

	it('closes the order when the scheduled cutoff runs', async () => {
		vi.useFakeTimers();
		try {
			const t = convexTest(schema, modules);
			const alice = await signIn(t, 'alice@example.com');
			const closesAt = Date.now() + 60_000;
			const orderId = await alice.as.mutation(api.orders.open, {
				restaurant: '茶餐廳',
				closesAt,
			});
			const dishId = await alice.as.mutation(api.orders.addDish, {
				orderId,
				name: '乾炒牛河',
				priceCents: 6_800,
			});

			expect((await alice.as.query(api.orders.get, { orderId }))?.status).toBe('open');
			await t.finishAllScheduledFunctions(() => {
				vi.advanceTimersByTime(60_000);
			});

			expect((await alice.as.query(api.orders.get, { orderId }))?.status).toBe('closed');
			expect(
				await codeOf(
					alice.as.mutation(api.orders.reviseDish, { dishId, name: '奶茶', priceCents: 1_800 }),
				),
			).toBe(APP_ERROR_CODES.orderClosed);
		} finally {
			vi.useRealTimers();
		}
	});
});
