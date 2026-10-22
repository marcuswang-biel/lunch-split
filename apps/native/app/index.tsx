import { useConvexAuth } from 'convex/react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { SignInScreen } from '@/auth';
import { OrdersList } from '@/components/orders-list';

export default function HomeScreen() {
	const { isAuthenticated, isLoading } = useConvexAuth();

	if (isLoading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator />
			</View>
		);
	}
	return isAuthenticated ? <OrdersList /> : <SignInScreen />;
}

const styles = StyleSheet.create({
	center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
