import { Trans } from '@lingui/react/macro';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lunch-split/web-ui';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useConvexAuth } from 'convex/react';

import { SignInPanel } from '@/auth';
import Loader from '@/components/loader';

export const Route = createFileRoute('/sign-in')({
	component: SignInPage,
});

function SignInPage() {
	const { isAuthenticated, isLoading } = useConvexAuth();
	if (isLoading) return <Loader />;
	if (isAuthenticated) return <Navigate to="/orders" replace />;

	return (
		<div className="flex min-h-full items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl">
						<Trans>登入</Trans>
					</CardTitle>
					<CardDescription>
						<Trans>登入以加入拼單</Trans>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<SignInPanel />
				</CardContent>
			</Card>
		</div>
	);
}
