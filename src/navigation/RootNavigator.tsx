import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { tokens } from '@/theme/tokens';
import { MainTabNavigator } from './MainTabNavigator';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { RegisterScreen } from '@/screens/auth/RegisterScreen';
import { SearchScreen } from '@/screens/explore/SearchScreen';
import { HashtagScreen } from '@/screens/explore/HashtagScreen';
import { SoundScreen } from '@/screens/explore/SoundScreen';
import { RecordScreen } from '@/screens/create/RecordScreen';
import { EditScreen } from '@/screens/create/EditScreen';
import { PublishScreen } from '@/screens/create/PublishScreen';
import { ChatScreen } from '@/screens/inbox/ChatScreen';
import { EditProfileScreen } from '@/screens/profile/EditProfileScreen';
import { SettingsScreen } from '@/screens/profile/SettingsScreen';
import { LiveScreen } from '@/screens/live/LiveScreen';
import { LiveBroadcastScreen } from '@/screens/live/LiveBroadcastScreen';
import { VideoCallScreen } from '@/screens/call/VideoCallScreen';
import { FollowingScreen } from '@/screens/feed/FollowingScreen';

export type RootStackParamList = {
  Auth: undefined;
  Login: undefined;
  Register: undefined;
  Main: undefined;
  Search: undefined;
  Hashtag: { hashtagId: string; name: string };
  Sound: { soundId: string };
  Record: undefined;
  Edit: { videoUri: string };
  Publish: { videoUri: string };
  Chat: { conversationId: string; username: string };
  EditProfile: undefined;
  Settings: undefined;
  Live: { liveId: string };
  LiveBroadcast: undefined;
  VideoCall: { userId: string; username: string };
  Following: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.colors.black },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Main" component={MainTabNavigator} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Hashtag" component={HashtagScreen} />
        <Stack.Screen name="Sound" component={SoundScreen} />
        <Stack.Screen name="Record" component={RecordScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Edit" component={EditScreen} />
        <Stack.Screen name="Publish" component={PublishScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Live" component={LiveScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="LiveBroadcast" component={LiveBroadcastScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="VideoCall" component={VideoCallScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Following" component={FollowingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
