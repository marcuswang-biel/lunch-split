import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';

import type { OrderWindow } from './order-window';

import { addDish, removeDish, reviseDish } from './change-dish';
import { closeIfDue } from './close-order';
import { InvalidDish, InvalidOrder, NotDishOwner, OrderClosed } from './errors';
import { openOrder } from './open-order';

const now = 1_700_000_000_000;
const openWindow: OrderWindow = { status: 'open', closesAt: now + 60_000 };
const closedWindow: OrderWindow = { status: 'closed', closesAt: now + 60_000 };

describe('openOrder', () => {
	it.effect('trims the restaurant and keeps a future cutoff', () =>
		Effect.gen(function* () {
			const draft = yield* openOrder({ restaurant: '  茶餐廳  ', closesAt: now + 1 }, now);
			expect(draft).toEqual({ restaurant: '茶餐廳', closesAt: now + 1 });
		}),
	);

	it.effect('rejects a blank restaurant', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(openOrder({ restaurant: '   ', closesAt: now + 1 }, now));
			expect(error).toBeInstanceOf(InvalidOrder);
		}),
	);

	it.effect('rejects a cutoff that is not still ahead', () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(openOrder({ restaurant: '茶餐廳', closesAt: now }, now));
			expect(error).toBeInstanceOf(InvalidOrder);
		}),
	);
});

describe('changeDish', () => {
	it.effect('lets anyone add a dish while the order is open', () =>
		Effect.gen(function* () {
			const dish = yield* addDish({ name: '  乾炒牛河  ', priceCents: 6_800 }, openWindow, now);
			expect(dish).toEqual({ name: '乾炒牛河', priceCents: 6_800 });
		}),
	);

	it.effect('lets the owner revise their own dish', () =>
		Effect.gen(function* () {
			const dish = yield* reviseDish(
				{ name: '奶茶', priceCents: 1_800 },
				openWindow,
				'alice',
				'alice',
				now,
			);
			expect(dish.name).toBe('奶茶');
		}),
	);

	it.effect('lets the owner remove their own dish', () =>
		Effect.gen(function* () {
			yield* removeDish(openWindow, 'alice', 'alice', now);
		}),
	);

	it.effect("rejects a change to someone else's dish", () =>
		Effect.gen(function* () {
			const revised = yield* Effect.flip(
				reviseDish({ name: '奶茶', priceCents: 1_800 }, openWindow, 'alice', 'bob', now),
			);
			const removed = yield* Effect.flip(removeDish(openWindow, 'alice', 'bob', now));
			expect(revised).toBeInstanceOf(NotDishOwner);
			expect(removed).toBeInstanceOf(NotDishOwner);
			expect(revised).toMatchObject({ actorId: 'bob', dishOwnerId: 'alice' });
		}),
	);

	it.effect('rejects every change once the order is closed', () =>
		Effect.gen(function* () {
			const added = yield* Effect.flip(
				addDish({ name: '奶茶', priceCents: 1_800 }, closedWindow, now),
			);
			const revised = yield* Effect.flip(
				reviseDish({ name: '奶茶', priceCents: 1_800 }, closedWindow, 'alice', 'alice', now),
			);
			const removed = yield* Effect.flip(removeDish(closedWindow, 'alice', 'alice', now));
			expect(added).toBeInstanceOf(OrderClosed);
			expect(revised).toBeInstanceOf(OrderClosed);
			expect(removed).toBeInstanceOf(OrderClosed);
		}),
	);

	it.effect('rejects every change once the cutoff time has arrived', () =>
		Effect.gen(function* () {
			const due: OrderWindow = { status: 'open', closesAt: now };
			const added = yield* Effect.flip(addDish({ name: '奶茶', priceCents: 1_800 }, due, now));
			const revised = yield* Effect.flip(
				reviseDish({ name: '奶茶', priceCents: 1_800 }, due, 'alice', 'bob', now),
			);
			expect(added).toBeInstanceOf(OrderClosed);
			expect(revised).toBeInstanceOf(OrderClosed);
		}),
	);

	it.effect('rejects a blank name or a non-positive price', () =>
		Effect.gen(function* () {
			const blank = yield* Effect.flip(addDish({ name: '  ', priceCents: 100 }, openWindow, now));
			const free = yield* Effect.flip(addDish({ name: '白飯', priceCents: 0 }, openWindow, now));
			const fraction = yield* Effect.flip(
				addDish({ name: '白飯', priceCents: 10.5 }, openWindow, now),
			);
			expect(blank).toBeInstanceOf(InvalidDish);
			expect(free).toBeInstanceOf(InvalidDish);
			expect(fraction).toBeInstanceOf(InvalidDish);
		}),
	);
});

describe('closeIfDue', () => {
	it.effect('stays open before the cutoff', () =>
		Effect.gen(function* () {
			expect(yield* closeIfDue(openWindow, now)).toBe('open');
		}),
	);

	it.effect('closes when the cutoff arrives and stays closed', () =>
		Effect.gen(function* () {
			expect(yield* closeIfDue(openWindow, openWindow.closesAt)).toBe('closed');
			expect(yield* closeIfDue(closedWindow, now)).toBe('closed');
		}),
	);
});
