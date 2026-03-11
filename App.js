// 1. Gesture Handler MUST be first
import 'react-native-gesture-handler';

// 2. Task Registry MUST be second (before React initializes)
import './src/utils/LocationTask';

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import TripScreen from './src/screens/TripScreen';

// Use Native Stack instead of standard Stack
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Trip" component={TripScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}