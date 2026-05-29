import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableWithoutFeedback } from 'react-native';
import Video, { OnBufferData, OnLoadData, OnProgressData } from 'react-native-video';
import { tokens } from '@/theme/tokens';

interface VideoPlayerProps {
  uri: string;
  isActive: boolean;
  isPaused?: boolean;
  isMuted?: boolean;
  onPress?: (event: any) => void;
  onProgress?: (progress: number) => void;
  onLoad?: (duration: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  uri,
  isActive,
  isPaused = false,
  isMuted = false,
  onPress,
  onProgress,
  onLoad,
}) => {
  const videoRef = useRef<React.ElementRef<typeof Video>>(null);
  const [isBuffering, setIsBuffering] = useState(false);
  const [duration, setDuration] = useState(0);

  const handleBuffer = useCallback(({ isBuffering: buffering }: OnBufferData) => {
    setIsBuffering(buffering);
  }, []);

  const handleLoad = useCallback(
    (data: OnLoadData) => {
      setDuration(data.duration);
      onLoad?.(data.duration);
    },
    [onLoad]
  );

  const handleProgress = useCallback(
    (data: OnProgressData) => {
      if (duration > 0) {
        onProgress?.(data.currentTime / duration);
      }
    },
    [duration, onProgress]
  );

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <View style={styles.container}>
        <Video
          ref={videoRef}
          source={{ uri }}
          style={styles.video}
          resizeMode="cover"
          repeat
          paused={!isActive || isPaused}
          muted={isMuted}
          onBuffer={handleBuffer}
          onLoad={handleLoad}
          onProgress={handleProgress}
          playInBackground={false}
          playWhenInactive={false}
        />
        {isBuffering && (
          <View style={styles.bufferingContainer}>
            <ActivityIndicator size="large" color={tokens.colors.white} />
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.black,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bufferingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
