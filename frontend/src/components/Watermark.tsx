import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { WatermarkConfig } from '../styles/designSystem';

export const ScreenWatermark: React.FC = () => {
  if (!WatermarkConfig.screen.enabled) {
    return null;
  }

  const { width, height } = Dimensions.get('window');
  
  // Calculate how many watermarks we need to tile the screen
  const watermarkWidth = 200;
  const watermarkHeight = 80;
  const cols = Math.ceil(width / watermarkWidth) + 2;
  const rows = Math.ceil(height / watermarkHeight) + 2;
  
  const watermarks = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      watermarks.push(
        <Text
          key={`${row}-${col}`}
          style={[
            styles.watermarkText,
            {
              position: 'absolute',
              left: col * watermarkWidth - watermarkWidth / 2,
              top: row * watermarkHeight - watermarkHeight / 2,
              transform: [{ rotate: `${WatermarkConfig.screen.style.rotation}deg` }],
              opacity: WatermarkConfig.screen.style.opacity,
              fontSize: WatermarkConfig.screen.style.fontSize,
              color: WatermarkConfig.screen.style.color,
            }
          ]}
        >
          {WatermarkConfig.screen.text}
        </Text>
      );
    }
  }

  return (
    <View style={styles.watermarkContainer} pointerEvents="none">
      {watermarks}
    </View>
  );
};

export const MediaWatermark: React.FC<{ visible?: boolean }> = ({ visible = true }) => {
  if (!WatermarkConfig.media.enabled || !visible) {
    return null;
  }

  return (
    <View style={styles.mediaWatermarkContainer}>
      <Text style={styles.mediaWatermarkText}>
        {WatermarkConfig.media.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  watermarkContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  watermarkText: {
    fontFamily: 'Inter',
    fontWeight: '600',
    letterSpacing: 2,
  },
  mediaWatermarkContainer: {
    position: 'absolute',
    bottom: WatermarkConfig.media.padding,
    right: WatermarkConfig.media.padding,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mediaWatermarkText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Inter',
    opacity: WatermarkConfig.media.opacity,
  },
});

export default ScreenWatermark;