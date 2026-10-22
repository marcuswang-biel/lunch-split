import type { Id } from '@lunch-split/backend/convex/_generated/dataModel';

import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { Trans, useLingui } from '@lingui/react/macro';
import { api } from '@lunch-split/backend/convex/_generated/api';
import { convexErrorCode } from '@lunch-split/shared/convex-error';
import { isAppErrorCode } from '@lunch-split/shared/error-codes';
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Input,
	Label,
} from '@lunch-split/web-ui';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import Loader from '@/components/loader';
import { RequireAuth } from '@/components/require-auth';
import { centsToInput, formatCents, parseAmountToCents } from '@/features/orders/money';
import { ORDER_ERROR_MESSAGES } from '@/features/orders/order-errors';

export const Route = createFileRoute('/orders/$orderId')({
	component: () => (
		<RequireAuth>
			<OrderPage />
		</RequireAuth>
	),
});

function OrderPage() {
	const { orderId } = Route.useParams();
	// SAFETY: the path segment is the order id. Convex's v.id('orders') rejects anything else.
	const id = orderId as Id<'orders'>;
	const { t, i18n } = useLingui();
	const order = useQuery(convexQuery(api.orders.get, { orderId: id }));
	const dishes = useQuery(convexQuery(api.orders.listDishes, { orderId: id }));
	const viewer = useQuery(convexQuery(api.viewer.get, {}));
	const addDish = useConvexMutation(api.orders.addDish);
	const reviseDish = useConvexMutation(api.orders.reviseDish);
	const removeDish = useConvexMutation(api.orders.removeDish);
	const [name, setName] = useState('');
	const [price, setPrice] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	const describeError = (failure: unknown) => {
		const code = convexErrorCode(failure);
		const descriptor = isAppErrorCode(code) ? ORDER_ERROR_MESSAGES[code] : undefined;
		return descriptor ? t(descriptor) : t`操作失敗，請再試一次。`;
	};

	const formatWhen = (timestamp: number) =>
		new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
			timestamp,
		);

	const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		const priceCents = parseAmountToCents(price);
		if (priceCents === null || priceCents <= 0) {
			setError(t`價錢格式不正確。`);
			return;
		}
		try {
			await addDish({ orderId: id, name, priceCents });
			setName('');
			setPrice('');
		} catch (failure) {
			setError(describeError(failure));
		}
	};

	const handleRevise = async (
		dishId: Id<'dishes'>,
		nextName: string,
		nextPrice: string,
	): Promise<boolean> => {
		setError(null);
		const priceCents = parseAmountToCents(nextPrice);
		if (priceCents === null || priceCents <= 0) {
			setError(t`價錢格式不正確。`);
			return false;
		}
		try {
			await reviseDish({ dishId, name: nextName, priceCents });
			return true;
		} catch (failure) {
			setError(describeError(failure));
			return false;
		}
	};

	const handleRemove = async (dishId: Id<'dishes'>) => {
		setError(null);
		try {
			await removeDish({ dishId });
		} catch (failure) {
			setError(describeError(failure));
		}
	};

	if (order.isPending || dishes.isPending || viewer.isPending) return <Loader />;

	if (!order.data) {
		return (
			<div className="mx-auto max-w-3xl p-6">
				<p className="text-muted-foreground text-sm">
					<Trans>找不到這張單。</Trans>
				</p>
				<Link to="/orders" className="mt-3 inline-block text-sm underline-offset-4 hover:underline">
					<Trans>返回拼單</Trans>
				</Link>
			</div>
		);
	}

	const current = order.data;
	const locked = current.status === 'closed' || now >= current.closesAt;
	const rows = dishes.data ?? [];
	const total = rows.reduce((sum, dish) => sum + dish.priceCents, 0);
	const mine = viewer.data?.subject;

	return (
		<div className="mx-auto grid max-w-3xl gap-6 p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<h1 className="truncate text-2xl font-semibold">{current.restaurant}</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						{locked ? <Trans>已截單</Trans> : <Trans>開放中</Trans>}
						{' · '}
						{formatWhen(current.closesAt)}
					</p>
				</div>
				<Link to="/orders" className="shrink-0 text-sm underline-offset-4 hover:underline">
					<Trans>返回拼單</Trans>
				</Link>
			</div>

			{!locked && (
				<Card>
					<CardHeader>
						<CardTitle>
							<Trans>加菜</Trans>
						</CardTitle>
					</CardHeader>
					<CardContent>
						<form
							onSubmit={handleAdd}
							className="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
						>
							<div className="space-y-2">
								<Label htmlFor="dish-name">
									<Trans>菜名</Trans>
								</Label>
								<Input
									id="dish-name"
									value={name}
									onChange={(event) => setName(event.target.value)}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="dish-price">
									<Trans>價錢 (HKD)</Trans>
								</Label>
								<Input
									id="dish-price"
									inputMode="decimal"
									value={price}
									onChange={(event) => setPrice(event.target.value)}
									required
								/>
							</div>
							<Button type="submit">
								<Trans>加入</Trans>
							</Button>
						</form>
						<p className="text-muted-foreground mt-3 text-xs">
							<Trans>只能改自己點的菜。截單後誰都不能改。</Trans>
						</p>
					</CardContent>
				</Card>
			)}

			{error && (
				<p role="alert" className="text-destructive text-sm">
					{error}
				</p>
			)}

			<Card>
				<CardHeader>
					<CardTitle>
						<Trans>菜單</Trans>
					</CardTitle>
				</CardHeader>
				<CardContent>
					{rows.length > 0 ? (
						<ul className="divide-y">
							{rows.map((dish) => (
								<DishRow
									key={dish._id}
									dish={dish}
									mine={dish.ownerId === mine}
									locked={locked}
									onRevise={handleRevise}
									onRemove={handleRemove}
								/>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground text-sm">
							<Trans>還沒有菜。</Trans>
						</p>
					)}
					<p className="mt-3 flex items-baseline justify-between border-t pt-3 text-sm font-medium">
						<Trans>合計</Trans>
						<span>{formatCents(total)}</span>
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

function DishRow({
	dish,
	mine,
	locked,
	onRevise,
	onRemove,
}: {
	dish: {
		_id: Id<'dishes'>;
		name: string;
		priceCents: number;
		ownerLabel: string;
	};
	mine: boolean;
	locked: boolean;
	onRevise: (dishId: Id<'dishes'>, name: string, price: string) => Promise<boolean>;
	onRemove: (dishId: Id<'dishes'>) => Promise<void>;
}) {
	const { t } = useLingui();
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(dish.name);
	const [price, setPrice] = useState(() => centsToInput(dish.priceCents));
	const nameRef = useRef<HTMLInputElement>(null);
	const editRef = useRef<HTMLButtonElement>(null);
	const pendingFocus = useRef<'name' | 'edit' | null>(null);
	const formId = `dish-edit-${dish._id}`;

	useEffect(() => {
		if (pendingFocus.current === 'name') nameRef.current?.focus();
		if (pendingFocus.current === 'edit') editRef.current?.focus();
		pendingFocus.current = null;
	}, [editing]);

	const beginEdit = () => {
		setName(dish.name);
		setPrice(centsToInput(dish.priceCents));
		pendingFocus.current = 'name';
		setEditing(true);
	};

	const endEdit = () => {
		pendingFocus.current = 'edit';
		setEditing(false);
	};

	const removeButton = (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			aria-label={t`刪除`}
			onClick={() => void onRemove(dish._id)}
		>
			<Trash2 aria-hidden="true" />
		</Button>
	);

	if (!mine || locked) {
		return (
			<li className="flex items-baseline justify-between gap-4 py-3">
				<div className="min-w-0">
					<p className="truncate font-medium">{dish.name}</p>
					<p className="text-muted-foreground text-sm">{dish.ownerLabel}</p>
				</div>
				<p className="shrink-0 text-sm">{formatCents(dish.priceCents)}</p>
			</li>
		);
	}

	if (!editing) {
		return (
			<li className="flex items-center justify-between gap-4 py-3">
				<div className="min-w-0">
					<p className="truncate font-medium">{dish.name}</p>
					<p className="text-muted-foreground text-sm">{dish.ownerLabel}</p>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<p className="px-2 text-sm">{formatCents(dish.priceCents)}</p>
					<Button
						ref={editRef}
						type="button"
						variant="ghost"
						size="icon"
						aria-label={t`編輯`}
						aria-expanded={false}
						aria-controls={formId}
						onClick={beginEdit}
					>
						<Pencil aria-hidden="true" />
					</Button>
					{removeButton}
				</div>
			</li>
		);
	}

	return (
		<li className="grid gap-3 py-3">
			<p className="text-muted-foreground text-sm">{dish.ownerLabel}</p>
			<form
				id={formId}
				onSubmit={(event) => {
					event.preventDefault();
					void onRevise(dish._id, name, price).then((saved) => {
						if (saved) endEdit();
					});
				}}
				className="grid gap-3 sm:grid-cols-[1fr_8rem_auto_auto_auto] sm:items-end"
			>
				<div className="space-y-2">
					<Label htmlFor={`dish-name-${dish._id}`}>
						<Trans>菜名</Trans>
					</Label>
					<Input
						ref={nameRef}
						id={`dish-name-${dish._id}`}
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={`dish-price-${dish._id}`}>
						<Trans>價錢 (HKD)</Trans>
					</Label>
					<Input
						id={`dish-price-${dish._id}`}
						inputMode="decimal"
						value={price}
						onChange={(event) => setPrice(event.target.value)}
					/>
				</div>
				<Button type="submit">
					<Trans>儲存</Trans>
				</Button>
				<Button type="button" variant="ghost" onClick={endEdit}>
					<Trans>取消</Trans>
				</Button>
				{removeButton}
			</form>
		</li>
	);
}
