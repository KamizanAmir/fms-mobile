import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView, Dimensions, ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
// 1. Remove PROVIDER_GOOGLE, Import UrlTile
import MapView, { Marker, UrlTile } from 'react-native-maps';
import api from '../services/api';
import { LOCATION_TASK_NAME } from '../utils/LocationTask';

export default function TripScreen({ route, navigation }) {
    const { trip } = route.params;
    const [status, setStatus] = useState(trip.status_id);
    const [odo, setOdo] = useState('');
    const [currentLoc, setCurrentLoc] = useState(null);
    const [loading, setLoading] = useState(false);
    const mapRef = useRef(null);

    useEffect(() => {
        checkStatusAndLocation();
        navigation.setOptions({ title: trip.purpose });
    }, []);

    const checkStatusAndLocation = async () => {
        try {
            const { status: perm } = await Location.requestForegroundPermissionsAsync();
            if (perm === 'granted') {
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                setCurrentLoc({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                });
            } else {
                Alert.alert("Permission Required", "This screen requires location access to load the map.");
            }
        } catch (error) {
            console.log("Error checking location:", error);
            Alert.alert("Location Error", "Could not access location services.");
        }
    };

    const acceptTrip = async () => {
        try {
            await api.post(`/driver/trip/${trip.trip_id}/accept`);
            setStatus(7);
            Alert.alert("Success", "Mission Accepted");
        } catch (e) { Alert.alert("Error", "Action failed"); }
    };

    const startTrip = async () => {
        if (!odo) return Alert.alert("Odometer Required", "Please enter current mileage.");

        try {
            // Must have foreground before requesting background
            const { status: fgPerm } = await Location.requestForegroundPermissionsAsync();
            if (fgPerm !== 'granted') {
                return Alert.alert("Denied", "Foreground location required before background tracking.");
            }

            const { status: bgPerm } = await Location.requestBackgroundPermissionsAsync();
            if (bgPerm !== 'granted') {
                // Even if denied, log the trip but maybe fallback to a local solution if you still need it
                // We return here to be strict with tracking.
                return Alert.alert("Denied", "Background location required for tracking.");
            }

            setLoading(true);
            await api.post(`/driver/trip/${trip.trip_id}/start`, { odometer: odo });
            await SecureStore.setItemAsync('active_trip_id', String(trip.trip_id));

            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                accuracy: Location.Accuracy.Highest, // Boost accuracy for testing
                timeInterval: 5000,  // Check every 5 seconds
                distanceInterval: 0, // 0 meters (Trigger based on time, even if standing still)
                foregroundService: {
                    notificationTitle: "FMS Active",
                    notificationBody: "Logging trip data..."
                }
            });

            setStatus(9);
            setOdo('');
        } catch (error) {
            console.log("Start Trip Error:", error);
            Alert.alert("Error", error.message || "Could not start tracking.");
        } finally {
            setLoading(false);
        }
    };

    // --- SWAP DRIVER LOGIC ---
    const swapDriver = async () => {
        if (!odo) return Alert.alert("Required", "Enter current Odometer to swap.");
        Alert.alert("Swap Driver?", "This will end your driving session. Another driver must take over.", [
            { text: "Cancel", style: "cancel" },
            { text: "Confirm Swap", onPress: executeSwap }
        ]);
    };

    const executeSwap = async () => {
        setLoading(true);
        try {
            // 1. Stop tracking
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
            if (hasStarted) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

            // 2. Call Swap API (Ensure you added this route to Laravel!)
            await api.post(`/driver/trip/${trip.trip_id}/swap`, { odometer: odo });

            // 3. Cleanup local state
            await SecureStore.deleteItemAsync('active_trip_id');

            Alert.alert("Swapped", "Your session has ended. Handing over to next driver.");
            navigation.navigate('Dashboard');
        } catch (e) { Alert.alert("Error", "Failed to swap driver"); }
        setLoading(false);
    }
    // ---------------------------

    const stopTrip = async () => {
        if (!odo) return Alert.alert("Required", "Enter closing Odometer");
        Alert.alert("End Mission?", "Is this the FINAL destination?", [
            { text: "Cancel", style: "cancel" },
            { text: "Complete Mission", onPress: () => handleStop(true) }
        ]);
    };

    const handleStop = async (isFinal) => {
        setLoading(true);
        try {
            const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
            if (hasStarted) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);

            await api.post(`/driver/trip/${trip.trip_id}/stop`, { odometer: odo, is_final_stop: isFinal });
            await SecureStore.deleteItemAsync('active_trip_id');
            navigation.navigate('Dashboard');
        } catch (e) { Alert.alert("Error", "Failed to stop"); }
        setLoading(false);
    };

    return (
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
            {/* MAP SECTION */}
            <View style={styles.mapContainer}>
                {currentLoc ? (
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        // using default mapType instead of none to avoid Fabric crash
                        // mapType="standard"
                        initialRegion={currentLoc}
                        showsUserLocation={true}
                        followsUserLocation={true}
                        loadingEnabled={false} // Disable loading to prevent eternal spinner if Google base map is rate-limited
                        provider={null} // Force default provider (Apple Maps on iOS, Google Maps on Android)
                    >
                        {/* 3. UrlTile loads Free OpenStreetMap Images over the dummy Google Maps instance */}
                        <UrlTile
                            // This uses CartoDB's "Positron" map (Clean, professional, free for dev)
                            urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
                            maximumZ={19}
                            flipY={false}
                        />
                    </MapView>
                ) : (
                    <View style={styles.mapLoading}>
                        <ActivityIndicator size="large" color="#2563EB" />
                        <Text style={{ marginTop: 10, color: '#666' }}>Acquiring GPS...</Text>
                    </View>
                )}
                <View style={styles.destOverlay}>
                    <Text style={styles.destLabel}>DESTINATION</Text>
                    <Text style={styles.destText} numberOfLines={1}>{trip.destination_to}</Text>
                </View>
            </View>

            {/* CONTROLS SECTION */}
            <View style={styles.controls}>
                <View style={styles.statusRow}>
                    <View>
                        <Text style={styles.missionLabel}>Status</Text>
                        <Text style={styles.missionValue}>
                            {status === 9 ? 'ONGOING JOURNEY' : status === 7 ? 'READY TO START' : 'PENDING ACCEPTANCE'}
                        </Text>
                    </View>
                    {status === 9 && <View style={styles.liveIndicator}><Text style={styles.liveText}>LIVE</Text></View>}
                </View>

                {loading && <ActivityIndicator style={{ marginBottom: 20 }} size="large" color="#2563EB" />}

                {/* ACTION BUTTONS */}
                {!loading && status === 5 && (
                    <TouchableOpacity style={styles.btnPrimary} onPress={acceptTrip}>
                        <Text style={styles.btnText}>ACCEPT ASSIGNMENT</Text>
                    </TouchableOpacity>
                )}

                {!loading && status === 7 && (
                    <View>
                        <TextInput style={styles.input} placeholder="Enter Start Odometer" keyboardType="numeric" value={odo} onChangeText={setOdo} />
                        <TouchableOpacity style={styles.btnGreen} onPress={startTrip}>
                            <Ionicons name="play-circle" size={24} color="white" style={{ marginRight: 10 }} />
                            <Text style={styles.btnText}>START TRIP</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* STOP OR SWAP SECTION */}
                {!loading && status === 9 && (
                    <View>
                        <TextInput style={styles.input} placeholder="Enter Current/End Odometer" keyboardType="numeric" value={odo} onChangeText={setOdo} />

                        <View style={styles.rowButtons}>
                            {/* SWAP BUTTON */}
                            <TouchableOpacity style={[styles.rowBtn, styles.btnOrange]} onPress={swapDriver}>
                                <MaterialIcons name="swap-horiz" size={24} color="white" style={{ marginRight: 5 }} />
                                <Text style={styles.rowBtnText}>SWAP DRIVER</Text>
                            </TouchableOpacity>

                            {/* STOP BUTTON */}
                            <TouchableOpacity style={[styles.rowBtn, styles.btnRed]} onPress={stopTrip}>
                                <Ionicons name="stop-circle" size={24} color="white" style={{ marginRight: 5 }} />
                                <Text style={styles.rowBtnText}>COMPLETE TRIP</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    mapContainer: { height: Dimensions.get('window').height * 0.5, position: 'relative' },
    map: { ...StyleSheet.absoluteFillObject },
    mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' },

    destOverlay: { position: 'absolute', bottom: 20, left: 20, right: 20, backgroundColor: 'rgba(30, 58, 138, 0.9)', padding: 15, borderRadius: 12, elevation: 5 },
    destLabel: { color: '#93C5FD', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
    destText: { color: '#fff', fontSize: 20, fontWeight: '800' },

    controls: { flex: 1, padding: 24, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -30, shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 10 },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    missionLabel: { fontSize: 14, color: '#64748B', fontWeight: '600' },
    missionValue: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginTop: 4 },
    liveIndicator: { backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#22C55E' },
    liveText: { color: '#15803D', fontWeight: '800', fontSize: 12 },

    input: { borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 12, padding: 16, fontSize: 18, marginBottom: 20, backgroundColor: '#F8FAFC', color: '#1E293B', fontWeight: '600' },

    btnPrimary: { backgroundColor: '#2563EB', padding: 20, borderRadius: 16, alignItems: 'center' },
    btnGreen: { backgroundColor: '#059669', padding: 20, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },

    rowButtons: { flexDirection: 'row', justifyContent: 'space-between' },
    rowBtn: { flex: 1, paddingVertical: 18, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    btnOrange: { backgroundColor: '#D97706', marginRight: 10 },
    btnRed: { backgroundColor: '#DC2626', marginLeft: 10 },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
    rowBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 }
});