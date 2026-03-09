import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';

export default function DashboardScreen({ navigation }) {
    const [data, setData] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDashboard = async () => {
        try {
            const res = await api.get('/driver/dashboard');
            setData(res.data);
        } catch (error) {
            console.log("Dashboard Error", error);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchDashboard();
        setRefreshing(false);
    };

    useFocusEffect(
        useCallback(() => {
            fetchDashboard();
        }, [])
    );

    const getStatusColor = (id) => {
        if (id === 5) return { bg: '#FEF3C7', text: '#D97706', label: 'Pending' };
        if (id === 7) return { bg: '#DBEAFE', text: '#2563EB', label: 'Accepted' };
        if (id === 9) return { bg: '#D1FAE5', text: '#059669', label: 'Ongoing' };
        return { bg: '#E5E7EB', text: '#374151', label: 'Unknown' };
    };

    // 1. RENDER ACTIVE TRIP CARD (THE FIX)
    const renderActiveTrip = () => {
        if (!data?.active_trip) return null;
        const item = data.active_trip;

        return (
            <View style={styles.activeSection}>
                <Text style={styles.sectionTitle}>CURRENT MISSION</Text>
                <TouchableOpacity
                    style={styles.activeCard}
                    onPress={() => navigation.navigate('Trip', { trip: item })}
                >
                    <View style={styles.activeHeader}>
                        <View style={styles.liveBadge}>
                            <View style={styles.pulseDot} />
                            <Text style={styles.liveText}>LIVE</Text>
                        </View>
                        <Text style={styles.activeDate}>{item.trip_date}</Text>
                    </View>

                    <Text style={styles.activeDestination}>{item.destination_to}</Text>
                    <Text style={styles.activePurpose}>{item.purpose}</Text>

                    <View style={styles.continueButton}>
                        <Text style={styles.continueText}>CONTINUE JOURNEY</Text>
                        <Ionicons name="arrow-forward-circle" size={24} color="#FFF" />
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    const renderTrip = ({ item }) => {
        const status = getStatusColor(item.status_id);
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('Trip', { trip: item })}
                activeOpacity={0.7}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.badge, { backgroundColor: status.bg }]}>
                        <Text style={[styles.badgeText, { color: status.text }]}>{status.label}</Text>
                    </View>
                    <Text style={styles.date}>{item.trip_date}</Text>
                </View>
                <Text style={styles.tripTitle}>{item.destination_to}</Text>
                <Text style={styles.tripPurpose} numberOfLines={1}>{item.purpose}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello,</Text>
                    <Text style={styles.username}>{data?.driver_name || 'Driver'}</Text>
                </View>
                <View style={styles.statsPill}>
                    <Text style={styles.pillText}>{data?.stats?.total_trips || 0} Completed</Text>
                </View>
            </View>

            <FlatList
                data={data?.upcoming_trips || []}
                keyExtractor={item => item.trip_id.toString()}
                renderItem={renderTrip}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListHeaderComponent={renderActiveTrip} // Insert Active Trip at the top
                ListEmptyComponent={
                    !data?.active_trip && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No upcoming assignments</Text>
                        </View>
                    )
                }
                ListHeaderComponentStyle={{ marginBottom: 20 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingTop: 60, backgroundColor: '#FFFFFF', marginBottom: 10 },
    greeting: { fontSize: 16, color: '#6B7280' },
    username: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
    statsPill: { backgroundColor: '#E0F2FE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    pillText: { color: '#0284C7', fontWeight: '700' },

    listContent: { padding: 20 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 10, letterSpacing: 1 },

    // Active Card Styles
    activeSection: { marginBottom: 10 },
    activeCard: { backgroundColor: '#2563EB', borderRadius: 16, padding: 20, elevation: 10, shadowColor: '#2563EB', shadowOpacity: 0.4, shadowRadius: 10 },
    activeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80', marginRight: 6 },
    liveText: { color: '#4ADE80', fontSize: 12, fontWeight: 'bold' },
    activeDate: { color: '#DBEAFE' },
    activeDestination: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
    activePurpose: { color: '#BFDBFE', fontSize: 14, marginBottom: 20 },
    continueButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', padding: 12, borderRadius: 8 },
    continueText: { color: '#FFF', fontWeight: 'bold', marginRight: 8 },

    // List Card Styles
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    badgeText: { fontSize: 12, fontWeight: '700' },
    date: { fontSize: 12, color: '#9CA3AF' },
    tripTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
    tripPurpose: { fontSize: 14, color: '#6B7280' },

    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#9CA3AF' }
});