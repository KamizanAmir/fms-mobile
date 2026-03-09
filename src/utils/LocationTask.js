import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

export const LOCATION_TASK_NAME = 'background-location-task';

// Define the task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error("Location Task Error:", error);
        return;
    }

    if (data) {
        const { locations } = data;
        // locations is an array of objects: { coords: { latitude, longitude, speed... }, timestamp }

        try {
            // We retrieve the token manually here because the Axios interceptor 
            // might not be available in the background task context context in some edge cases
            const token = await SecureStore.getItemAsync('auth_token');

            if (!token) return;

            // Prepare data for Laravel
            // Using raw fetch or a fresh axios instance to ensure reliability in background
            const payload = {
                // We need to know WHICH trip is active. 
                // Simplest way: Store active_trip_id in SecureStore when starting trip
                trip_id: await SecureStore.getItemAsync('active_trip_id'),
                locations: locations.map(loc => ({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    speed: loc.coords.speed,
                    heading: loc.coords.heading,
                    recorded_at: new Date(loc.timestamp).toISOString() // Format for Laravel
                }))
            };

            if (payload.trip_id) {
                // Replace with your IP again
                await axios.post('http://180.74.194.142/api/driver/track', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log(`Sent ${locations.length} points to server.`);
            }

        } catch (err) {
            console.log("Background Sync Failed:", err);
        }
    }
});