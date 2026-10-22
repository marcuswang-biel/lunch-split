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
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';

import Loader from '@/components/loader';
import { RequireAuth } from '@/components/require-auth';
import { ORDER_ERROR_MESSAGES } from '@/features/orders/order-errors';

export const Route = createFileRoute('/orders/')({
	component: () => (
		<RequireAuth>
			<OrdersPage />
		</RequireAuth>
	),
});

function padTwo(value: number): string {
	return String(value).padStart(2, '0');
}

function defaultCutoffLocal(): string {
	const date = new Date(Date.now() + 60 * 60 * 1000);
	date.setSeconds(0, 0);
	return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}T${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

function OrdersPage() {
	const { t, i18n } = useLingui();
	const navigate = useNavigate();
	const orders = useQuery(convexQuery(api.orders.list, {}));
	const openOrder = useConvexMutation(api.orders.open);
	const [restaurant, setRestaurant] = useState('');
	const [cutoff, setCutoff] = useState(defaultCutoffLocal);
	const [error, setError] = useState<string | null>(null);

	const describeError = (failure: unknown) => {
		const code = convexErrorCode(failure);
		const descriptor = isAppErrorCode(code) ? ORDER_ERROR_MESSAGES[code] : undefined;
		return descriptor ? t(descriptor) : t`操作失敗，請再試一次。`;
	};

	const formatWhen = (timestamp: number) =>
		new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
			timestamp,
		);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError(null);
		const closesAt = new Date(cutoff).getTime();
		if (!cutoff || Number.isNaN(closesAt) || closesAt <= Date.now()) {
			setError(t`截單時間要晚於現在。`);
			return;
		}
		try {
			const orderId = await openOrder({ restaurant, closesAt });
			await navigate({ to: '/orders/$orderId', params: { orderId } });
		} catch (failure) {
			setError(describeError(failure));
		}
	};

	return (
		<div className="mx-auto grid max-w-3xl gap-6 p-6">
			<Card>
				<CardHeader>
					<CardTitle>
						<Trans>開一單</Trans>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={handleSubmit}
						className="grid gap-4 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
					>
						<div className="space-y-2">
							<Label htmlFor="order-restaurant">
								<Trans>店名</Trans>
							</Label>
							<Input
								id="order-restaurant"
								value={restaurant}
								onChange={(event) => setRestaurant(event.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="order-cutoff">
								<Trans>截單時間</Trans>
							</Label>
							<Input
								id="order-cutoff"
								type="datetime-local"
								value={cutoff}
								onChange={(event) => setCutoff(event.target.value)}
								required
							/>
						</div>
						<Button type="submit">
							<Trans>開單</Trans>
						</Button>
					</form>
					{error && (
						<p role="alert" className="text-destructive mt-3 text-sm">
							{error}
						</p>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>
						<Trans>拼單</Trans>
					</CardTitle>
				</CardHeader>
				<CardContent>
					{orders.isPending ? (
						<Loader />
					) : orders.data && orders.data.length > 0 ? (
						<ul className="divide-y">
							{orders.data.map((order) => (
								<li key={order._id}>
									<Link
										to="/orders/$orderId"
										params={{ orderId: order._id }}
										className="hover:bg-accent flex items-baseline justify-between gap-4 rounded-md px-1 py-3"
									>
										<span className="min-w-0">
											<span className="block truncate font-medium">{order.restaurant}</span>
											<span className="text-muted-foreground block text-sm">
												{formatWhen(order.closesAt)}
											</span>
										</span>
										<span className="text-sm">
											{order.status === 'closed' ? <Trans>已截單</Trans> : <Trans>開放中</Trans>}
										</span>
									</Link>
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground text-sm">
							<Trans>還沒有拼單。</Trans>
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
