// [IMPORTANT] This import must be at the very top, even before React
import 'react-native-gesture-handler';

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack'; // CHANGED THIS

// Import Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import TripScreen from './src/screens/TripScreen';

// Task Registry
import './src/utils/LocationTask';

// Use Native Stack instead of standard Stack
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false, // This is safer in Native Stack
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