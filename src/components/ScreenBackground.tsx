import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const bgImage = require('../../assets/da-header-bg.png');

export function ScreenBackground() {
  return (
    <>
      <Image source={bgImage} style={styles.image} resizeMode="cover" />
      <View style={styles.overlay} />
    </>
  );
}

export const BG_COLOR = '#0f172a';
export const OVERLAY_OPACITY = 'rgba(15, 23, 42, 0.55)';

const styles = StyleSheet.create({
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY_OPACITY,
  },
});
