import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, StatusBar, Modal, ActivityIndicator, SafeAreaView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, UrlTile, Polyline } from 'react-native-maps';
import api from '../services/api';

export default function DashboardScreen({ navigation }) {
    const [data, setData] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Modal & Accordion States
    const [showCompleted, setShowCompleted] = useState(false);
    const [expandedTripId, setExpandedTripId] = useState(null);
    const [tripRoutes, setTripRoutes] = useState({}); // Cache routes so we don't refetch on every toggle
    const [loadingRouteId, setLoadingRouteId] = useState(null);

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

    // Toggle the accordion map and fetch history if we don't have it yet
    const toggleTripMap = async (trip) => {
        if (expandedTripId === trip.trip_id) {
            setExpandedTripId(null); // Collapse if already open
            return;
        }

        setExpandedTripId(trip.trip_id);

        // Fetch GPS history only if we haven't cached it for this trip
        if (!tripRoutes[trip.trip_id]) {
            setLoadingRouteId(trip.trip_id);
            try {
                const res = await api.get(`/gps/history/${trip.trip_id}`);
                if (res.data?.success && res.data?.data?.length > 0) {
                    const coords = res.data.data.map(loc => ({
                        latitude: parseFloat(loc.latitude),
                        longitude: parseFloat(loc.longitude)
                    }));
                    setTripRoutes(prev => ({ ...prev, [trip.trip_id]: coords }));
                } else {
                    setTripRoutes(prev => ({ ...prev, [trip.trip_id]: [] })); // empty array = no data
                }
            } catch (error) {
                console.log("Failed to fetch trip history:", error);
                setTripRoutes(prev => ({ ...prev, [trip.trip_id]: [] }));
            } finally {
                setLoadingRouteId(null);
            }
        }
    };

    // Helper to calculate the perfect zoom box for the inline map
    const getRegionForCoordinates = (points) => {
        if (!points || points.length === 0) return null;
        let minX, maxX, minY, maxY;
        ((point) => {
            minX = point.latitude; maxX = point.latitude;
            minY = point.longitude; maxY = point.longitude;
        })(points[0]);

        points.forEach((point) => {
            minX = Math.min(minX, point.latitude);
            maxX = Math.max(maxX, point.latitude);
            minY = Math.min(minY, point.longitude);
            maxY = Math.max(maxY, point.longitude);
        });

        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        const deltaX = (maxX - minX) * 1.5; // 1.5 adds a nice padding around the line
        const deltaY = (maxY - minY) * 1.5;

        return {
            latitude: midX,
            longitude: midY,
            latitudeDelta: Math.max(deltaX, 0.01),
            longitudeDelta: Math.max(deltaY, 0.01)
        };
    };

    const getStatusColor = (id) => {
        if (id === 5) return { bg: '#FEF3C7', text: '#D97706', label: 'Pending' };
        if (id === 7) return { bg: '#DBEAFE', text: '#2563EB', label: 'Accepted' };
        if (id === 9) return { bg: '#D1FAE5', text: '#059669', label: 'Ongoing' };
        return { bg: '#E5E7EB', text: '#374151', label: 'Unknown' };
    };

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

    const renderUpcomingTrip = ({ item }) => {
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

    const renderCompletedTrip = ({ item }) => {
        const isExpanded = expandedTripId === item.trip_id;
        const coords = tripRoutes[item.trip_id];
        const isLoading = loadingRouteId === item.trip_id;
        const mapRegion = getRegionForCoordinates(coords);

        return (
            <View style={styles.completedCard}>
                <TouchableOpacity
                    style={styles.completedCardClickable}
                    onPress={() => toggleTripMap(item)}
                    activeOpacity={0.7}
                >
                    <View style={styles.completedCardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={styles.completedDate}>{item.trip_date}</Text>
                            <Text style={styles.completedPlate}>{item.vehicle_no_daftar}</Text>
                        </View>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color="#9CA3AF" />
                    </View>
                    <Text style={styles.completedDestination}>{item.destination_to}</Text>
                    <View style={styles.completedStatsRow}>
                        <View style={styles.completedStat}>
                            <Ionicons name="speedometer-outline" size={14} color="#6B7280" />
                            <Text style={styles.completedStatText}>{item.distance_km || 0} km</Text>
                        </View>
                        <View style={styles.completedStat}>
                            <MaterialCommunityIcons name="speedometer" size={14} color="#6B7280" />
                            <Text style={styles.completedStatText}>Max {item.max_speed || 0} km/h</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Inline Accordion Minimap */}
                {isExpanded && (
                    <View style={styles.inlineMapContainer}>
                        {isLoading ? (
                            <View style={styles.inlineMapLoading}>
                                <ActivityIndicator size="small" color="#2563EB" />
                                <Text style={styles.inlineLoadingText}>Loading route...</Text>
                            </View>
                        ) : coords && coords.length > 0 ? (
                            <MapView
                                style={styles.inlineMap}
                                initialRegion={mapRegion}
                                scrollEnabled={false} // Disabled so it doesn't fight with FlatList scrolling
                                zoomEnabled={false}
                                pitchEnabled={false}
                                rotateEnabled={false}
                            >
                                <UrlTile
                                    urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
                                    maximumZ={19}
                                    flipY={false}
                                />
                                <Polyline
                                    coordinates={coords}
                                    strokeColor="#2563EB"
                                    strokeWidth={3}
                                />
                                {/* Start Point */}
                                <Marker coordinate={coords[0]}>
                                    <View style={styles.startMarkerSmall} />
                                </Marker>
                                {/* End Point */}
                                <Marker coordinate={coords[coords.length - 1]}>
                                    <View style={styles.endMarkerSmall} />
                                </Marker>
                            </MapView>
                        ) : (
                            <View style={styles.inlineMapLoading}>
                                <Text style={styles.inlineLoadingText}>No GPS data recorded.</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello,</Text>
                    <Text style={styles.username}>{data?.driver_name || 'Driver'}</Text>
                </View>
                <TouchableOpacity
                    style={styles.statsPill}
                    onPress={() => setShowCompleted(true)}
                >
                    <Text style={styles.pillText}>{data?.stats?.total_trips || 0} Completed</Text>
                </TouchableOpacity>
            </View>

            {/* Dashboard Overview Stats (Fixed spacing & margins) */}
            <View style={styles.overviewContainer}>
                <View style={styles.overviewRow}>
                    <View style={styles.overviewBox}>
                        <View style={styles.overviewIconWrap}>
                            <Ionicons name="map-outline" size={20} color="#059669" />
                        </View>
                        <View>
                            <Text style={styles.overviewLabel}>Total Distance</Text>
                            <Text style={styles.overviewValue}>{data?.stats?.total_distance || 0} <Text style={{ fontSize: 12 }}>km</Text></Text>
                        </View>
                    </View>
                    <View style={styles.overviewBox}>
                        <View style={[styles.overviewIconWrap, { backgroundColor: '#FEE2E2' }]}>
                            <Ionicons name="flag-outline" size={20} color="#DC2626" />
                        </View>
                        <View>
                            <Text style={styles.overviewLabel}>Total Trips</Text>
                            <Text style={styles.overviewValue}>{data?.stats?.total_trips || 0}</Text>
                        </View>
                    </View>
                </View>
                <View style={[styles.overviewBoxLocation]}>
                    <View style={[styles.overviewIconWrap, { backgroundColor: '#FEF3C7', marginRight: 12 }]}>
                        <Ionicons name="location-outline" size={20} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.overviewLabel}>Last Location Visited</Text>
                        <Text style={styles.overviewValueLocation} numberOfLines={1}>
                            {data?.stats?.last_location || 'No recent location'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Main List */}
            <FlatList
                data={data?.upcoming_trips || []}
                keyExtractor={item => item.trip_id.toString()}
                renderItem={renderUpcomingTrip}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListHeaderComponent={renderActiveTrip}
                ListEmptyComponent={
                    !data?.active_trip && (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No upcoming assignments</Text>
                        </View>
                    )
                }
            />

            {/* Completed Trips Modal */}
            <Modal
                visible={showCompleted}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => {
                    setShowCompleted(false);
                    setExpandedTripId(null); // Reset expansions when closed
                }}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Completed Missions</Text>
                        <TouchableOpacity onPress={() => {
                            setShowCompleted(false);
                            setExpandedTripId(null);
                        }} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#1F2937" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={data?.completed_trips || []}
                        keyExtractor={item => item.trip_id.toString()}
                        renderItem={renderCompletedTrip}
                        contentContainerStyle={{ padding: 20 }}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No completed trips found.</Text>
                            </View>
                        }
                    />
                </SafeAreaView>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
    greeting: { fontSize: 16, color: '#6B7280' },
    username: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
    statsPill: { backgroundColor: '#E0F2FE', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    pillText: { color: '#0284C7', fontWeight: '700' },

    // Dashboard Overview (Fixed Layout)
    overviewContainer: { paddingHorizontal: 20, marginBottom: 10 },
    overviewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    overviewBox: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, flex: 1, marginHorizontal: 4, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    overviewBoxLocation: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginHorizontal: 4, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    overviewIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    overviewLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 2 },
    overviewValue: { fontSize: 18, color: '#1E293B', fontWeight: '800' },
    overviewValueLocation: { fontSize: 15, color: '#1E293B', fontWeight: '800' },

    listContent: { padding: 20 },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#6B7280', marginBottom: 10, letterSpacing: 1 },

    // Active Card Styles
    activeSection: { marginBottom: 20 },
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
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    badgeText: { fontSize: 12, fontWeight: '700' },
    date: { fontSize: 12, color: '#9CA3AF' },
    tripTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
    tripPurpose: { fontSize: 14, color: '#6B7280' },

    emptyState: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#9CA3AF' },

    // Modal Base
    modalContainer: { flex: 1, backgroundColor: '#F9FAFB' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937' },
    closeButton: { padding: 4, backgroundColor: '#F3F4F6', borderRadius: 20 },

    // Completed List Modal Items
    completedCard: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
    completedCardClickable: { padding: 16 },
    completedCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    completedDate: { fontSize: 12, color: '#6B7280', fontWeight: '600', marginRight: 8 },
    completedPlate: { fontSize: 11, backgroundColor: '#F3F4F6', color: '#4B5563', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontWeight: 'bold', overflow: 'hidden' },
    completedDestination: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
    completedStatsRow: { flexDirection: 'row', alignItems: 'center' },
    completedStat: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 10, borderWidth: 1, borderColor: '#F3F4F6' },
    completedStatText: { fontSize: 12, color: '#4B5563', marginLeft: 4, fontWeight: '600' },

    // Inline Accordion Map
    inlineMapContainer: { height: 200, backgroundColor: '#F3F4F6', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    inlineMap: { ...StyleSheet.absoluteFillObject },
    inlineMapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    inlineLoadingText: { marginTop: 8, color: '#6B7280', fontSize: 12 },
    startMarkerSmall: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: '#FFF' },
    endMarkerSmall: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FFF' },
});