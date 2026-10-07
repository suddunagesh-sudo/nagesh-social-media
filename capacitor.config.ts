import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nagesh.socialmedia.lifetime',
  appName: 'Nagesh Social Media - Lifetime',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-4617950866037211~7047611269',
      publisherId: 'ca-app-pub-4617950866037211',
      bannerAdUnitId: 'ca-app-pub-4617950866037211/1757579965',
      interstitialAdUnitId: 'ca-app-pub-4617950866037211/9308766921',
      rewardedAdUnitId: 'ca-app-pub-4617950866037211/6379351252',
    },
  },
}

export default config
