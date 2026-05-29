import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { tokens } from '@/theme/tokens';
import { ForYouScreen } from '@/screens/ForYouScreen';
import { ExploreScreen } from '@/screens/ExploreScreen';
import { CreateScreen } from '@/screens/CreateScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { InboxListScreen } from '@/screens/inbox/InboxListScreen';

const Tab = createBottomTabNavigator();

function CreateButton() {
  return (
    <View style={styles.createButton}>
      <View style={styles.createButtonGradientLeft} />
      <View style={styles.createButtonCenter}>
        <Text style={styles.createButtonIcon}>+</Text>
      </View>
      <View style={styles.createButtonGradientRight} />
    </View>
  );
}

export const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: tokens.colors.white,
        tabBarInactiveTintColor: tokens.colors.text.secondary,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={ForYouScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>🔍</Text>,
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateScreen}
        options={{
          tabBarIcon: () => <CreateButton />,
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxListScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>💬</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: tokens.colors.black,
    borderTopWidth: 0,
    height: tokens.bottomNav.height,
    paddingBottom: 4,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabIcon: {
    fontSize: tokens.bottomNav.iconSize,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    borderRadius: tokens.radius.sm,
    overflow: 'hidden',
  },
  createButtonGradientLeft: {
    width: 8,
    height: '100%',
    backgroundColor: tokens.colors.brand.secondary,
    borderTopLeftRadius: tokens.radius.sm,
    borderBottomLeftRadius: tokens.radius.sm,
  },
  createButtonCenter: {
    height: '100%',
    paddingHorizontal: 8,
    backgroundColor: tokens.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.black,
  },
  createButtonGradientRight: {
    width: 8,
    height: '100%',
    backgroundColor: tokens.colors.brand.primary,
    borderTopRightRadius: tokens.radius.sm,
    borderBottomRightRadius: tokens.radius.sm,
  },
});
