import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// REPLACE WITH YOUR LOCAL IP ADDRESS (e.g., 192.168.1.15)
// Do NOT use localhost for physical devices
const BASE_URL = 'http://180.74.194.142/api';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Interceptor to add Token to every request
api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;