import { api } from '@lunch-split/backend/convex/_generated/api';
import { useQuery } from 'convex/react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSignOut } from '@/auth';

/** Office lunch orders, live from Convex (same query the web app uses). */
export function OrdersList() {
	const orders = useQuery(api.orders.list);
	const viewer = useQuery(api.viewer.get);
	const signOut = useSignOut();

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.muted}>{viewer?.email ?? viewer?.subject ?? ''}</Text>
				<Pressable onPress={() => void signOut()}>
					<Text style={styles.link}>Sign out</Text>
				</Pressable>
			</View>
			{orders === undefined ? (
				<ActivityIndicator />
			) : (
				<FlatList
					data={orders}
					keyExtractor={(order) => order._id}
					ListEmptyComponent={<Text style={styles.muted}>No orders yet.</Text>}
					renderItem={({ item }) => (
						<View style={styles.row}>
							<Text style={styles.title}>{item.restaurant}</Text>
							<Text style={styles.muted}>
								{new Date(item.closesAt).toLocaleString()} ·{' '}
								{item.status === 'closed' ? 'Closed' : 'Open'}
							</Text>
						</View>
					)}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 16, gap: 12 },
	header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
	row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#d4d4d4' },
	title: { fontSize: 16, fontWeight: '500' },
	muted: { color: '#737373' },
	link: { color: '#2563eb', fontWeight: '500' },
});
