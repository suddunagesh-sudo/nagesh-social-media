import { useEffect, useRef } from 'react'
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const HERO_IMAGE = require('../assets/onboarding/hero.jpeg')
const ORBIT_IMAGES = [
  require('../assets/onboarding/1.jpeg'),
  require('../assets/onboarding/2.jpeg'),
  require('../assets/onboarding/3.jpeg'),
  require('../assets/onboarding/4.jpeg'),
  require('../assets/onboarding/5.jpeg'),
  require('../assets/onboarding/6.jpeg'),
]

const TAU = Math.PI * 2
const HERO_ASPECT_RATIO = 4 / 3
const PLANET_CROP_WIDTH = 360
const PLANET_CENTER_X = 640 / 1280
const PLANET_CENTER_Y = 660 / 960

export default function OnboardingScreen() {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const earthProgress = useRef(new Animated.Value(0)).current
  const orbitProgress = useRef(new Animated.Value(0)).current
  const heroDisplayWidth = Math.min(width, height * HERO_ASPECT_RATIO)
  const heroDisplayHeight = heroDisplayWidth / HERO_ASPECT_RATIO
  const heroLeft = (width - heroDisplayWidth) / 2
  const heroTop = (height - heroDisplayHeight) / 2
  const earthSize = Math.min(185, width * 0.48)
  const earthImageWidth = earthSize * (1280 / PLANET_CROP_WIDTH)
  const earthImageHeight = earthImageWidth / HERO_ASPECT_RATIO
  const earthImageLeft = earthSize / 2 - earthImageWidth * PLANET_CENTER_X
  const earthImageTop = earthSize / 2 - earthImageHeight * PLANET_CENTER_Y
  const earthCenterX = heroLeft + heroDisplayWidth * PLANET_CENTER_X
  const earthCenterY = heroTop + heroDisplayHeight * PLANET_CENTER_Y
  const orbitSize = Math.min(width * 0.94, height * 0.68, 650)
  const orbSize = Math.min(110, Math.max(72, orbitSize * 0.17))
  const orbitRadius = orbitSize / 2 - orbSize / 2

  useEffect(() => {
    const earthAnimation = Animated.loop(
      Animated.timing(earthProgress, {
        toValue: 1,
        duration: 6000,
        useNativeDriver: true,
      }),
    )
    const orbitAnimation = Animated.loop(
      Animated.timing(orbitProgress, {
        toValue: 1,
        duration: 28000,
        useNativeDriver: true,
      }),
    )
    earthAnimation.start()
    orbitAnimation.start()

    return () => {
      earthAnimation.stop()
      orbitAnimation.stop()
    }
  }, [earthProgress, orbitProgress])

  const earthRotation = earthProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  const orbitRotation = orbitProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <View style={styles.screen}>
      <Image source={HERO_IMAGE} style={styles.heroImage} resizeMode="contain" />

      <Text style={[styles.welcome, { top: insets.top + 20 }]}>
        Nagesh Social में आपका स्वागत है
      </Text>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbit,
          {
            width: orbitSize,
            height: orbitSize,
            left: earthCenterX - orbitSize / 2,
            top: earthCenterY - orbitSize / 2,
            transform: [{ rotate: orbitRotation }],
          },
        ]}
      >
        {ORBIT_IMAGES.map((image, index) => {
          const angle = -Math.PI / 2 + (TAU * index) / ORBIT_IMAGES.length
          const x = orbitSize / 2 + Math.cos(angle) * orbitRadius - orbSize / 2
          const y = orbitSize / 2 + Math.sin(angle) * orbitRadius - orbSize / 2

          return (
            <View
              key={index}
              style={[styles.orb, { width: orbSize, height: orbSize, left: x, top: y }]}
            >
              <Image source={image} style={styles.orbImage} resizeMode="cover" />
              <Text style={styles.orbSparkle} accessibilityElementsHidden>✦</Text>
            </View>
          )
        })}
      </Animated.View>

      <View
        style={[
          styles.srishti,
          {
            width: earthSize,
            height: earthSize,
            left: earthCenterX - earthSize / 2,
            top: earthCenterY - earthSize / 2,
          },
        ]}
      >
        <Animated.View style={[styles.earth, { transform: [{ rotate: earthRotation }] }]}>
          <Image
            source={HERO_IMAGE}
            resizeMode="cover"
            style={{
              position: 'absolute',
              left: earthImageLeft,
              top: earthImageTop,
              width: earthImageWidth,
              height: earthImageHeight,
            }}
          />
        </Animated.View>
        <View pointerEvents="none" style={styles.earthLight} />
      </View>

      <View style={[styles.buttonDock, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/home')}
          style={({ pressed }) => [styles.enterButton, pressed && styles.enterButtonPressed]}
        >
          <Text style={styles.enterButtonText}>सृष्टि में प्रवेश करें</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'black',
  },
  heroImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
  welcome: {
    position: 'absolute',
    zIndex: 5,
    left: 20,
    right: 20,
    color: 'white',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 36,
    textAlign: 'center',
    textShadowColor: 'rgba(120, 190, 255, 0.95)',
    textShadowRadius: 16,
  },
  orbit: {
    position: 'absolute',
    zIndex: 3,
  },
  orb: {
    position: 'absolute',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'gold',
    borderRadius: 999,
    backgroundColor: '#171326',
    shadowColor: 'gold',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 12,
  },
  orbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  orbSparkle: {
    position: 'absolute',
    top: 5,
    right: 9,
    color: '#fff1a8',
    fontSize: 18,
    textShadowColor: 'gold',
    textShadowRadius: 9,
  },
  srishti: {
    position: 'absolute',
    zIndex: 20,
    overflow: 'visible',
    borderRadius: 999,
  },
  earth: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.8)',
    borderRadius: 999,
    backgroundColor: '#08244d',
    shadowColor: 'cyan',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 18,
  },
  earthLight: {
    position: 'absolute',
    zIndex: -1,
    top: -30,
    right: -30,
    bottom: -30,
    left: -30,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 211, 238, 0.16)',
    shadowColor: 'cyan',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 20,
  },
  buttonDock: {
    position: 'absolute',
    zIndex: 30,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  enterButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    borderRadius: 30,
    backgroundColor: '#f5d260',
    shadowColor: '#ffd85c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  enterButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  enterButtonText: {
    color: '#281b00',
    fontSize: 16,
    fontWeight: '800',
  },
})
