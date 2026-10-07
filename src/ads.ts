import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

const BANNER_AD_ID = 'ca-app-pub-4617950866037211/1757579965'
const INTERSTITIAL_AD_ID = 'ca-app-pub-4617950866037211/9308766921'
const REWARDED_AD_ID = 'ca-app-pub-4617950866037211/6379351252'

const TEST_AD_IDS = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
}

const useTestAds = import.meta.env.DEV || import.meta.env.VITE_ADMOB_TEST_MODE === 'true'

const adIds = useTestAds
  ? TEST_AD_IDS
  : {
      banner: BANNER_AD_ID,
      interstitial: INTERSTITIAL_AD_ID,
      rewarded: REWARDED_AD_ID,
    }

export async function initializeAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    await AdMob.initialize({
      initializeForTesting: useTestAds,
    })
  } catch (error) {
    console.error('AdMob initialization failed:', error)
  }
}

export async function showBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    await AdMob.showBanner({
      adId: adIds.banner,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
    })
  } catch (error) {
    console.error('Failed to show banner ad:', error)
  }
}

export async function showInterstitial(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    await AdMob.prepareInterstitial({ adId: adIds.interstitial })
    await AdMob.showInterstitial()
  } catch (error) {
    console.error('Failed to show interstitial ad:', error)
  }
}

export async function showRewarded(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    await AdMob.prepareRewardVideoAd({ adId: adIds.rewarded })
    await AdMob.showRewardVideoAd()
  } catch (error) {
    console.error('Failed to show rewarded ad:', error)
  }
}
