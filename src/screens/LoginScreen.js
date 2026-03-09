import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Alert, StyleSheet,
    KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Missing Info', 'Please enter your ID and password.');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/mobile-login', { email, password });

            const token = response.data.token || response.data?.user?.password;
            if (!token) throw new Error("No token received. Raw data: " + JSON.stringify(response.data));

            await SecureStore.setItemAsync('auth_token', token);
            navigation.replace('Dashboard');

        } catch (error) {
            let detailedLog = "Unknown Error";

            if (error.response) {
                // The server received the request and returned an error code (e.g., 401, 404, 500)
                detailedLog = `Server Status: ${error.response.status}\nServer Response: ${JSON.stringify(error.response.data)}`;
            } else if (error.request) {
                // The request was sent but no response was received (Network block, IP unreachable)
                detailedLog = `Network Error: No response from server.\nAxios Error: ${error.message}`;
            } else {
                // The request failed to even send properly
                detailedLog = `Setup Error: ${error.message}`;
            }

            // Display the raw, detailed error log directly on the screen
            Alert.alert('Detailed Error Log', detailedLog);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <View style={styles.content}>
                <View style={styles.headerContainer}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="car-sport" size={40} color="#2563EB" />
                    </View>
                    <Text style={styles.title}>FMS Driver</Text>
                    <Text style={styles.subtitle}>Fleet Management System</Text>
                </View>

                <View style={styles.formContainer}>
                    <Text style={styles.label}>Tentera ID / Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter ID"
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Password"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={true}
                        value={password}
                        onChangeText={setPassword}
                    />

                    <TouchableOpacity
                        style={styles.button}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Sign In</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    content: { flex: 1, justifyContent: 'center', padding: 24 },
    headerContainer: { alignItems: 'center', marginBottom: 40 },
    iconCircle: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: '#DBEAFE',
        justifyContent: 'center', alignItems: 'center', marginBottom: 16
    },
    title: { fontSize: 28, fontWeight: '800', color: '#1F2937' },
    subtitle: { fontSize: 16, color: '#6B7280', marginTop: 4 },
    formContainer: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    input: {
        backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
        borderRadius: 8, padding: 12, fontSize: 16, color: '#1F2937', marginBottom: 20
    },
    button: {
        backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 8,
        alignItems: 'center', marginTop: 8
    },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});