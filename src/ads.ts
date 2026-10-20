import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

const adIds = {
  banner: 'ca-app-pub-835697046908969/6911529210',
  interstitial: 'ca-app-pub-835697046908969/3771105418',
  rewarded: 'ca-app-pub-835697046908969/4876392810',
}

let pageViewsSinceInterstitial = 0

export async function initializeAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  try {
    await AdMob.initialize({
      initializeForTesting: false,
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

export function trackPageView(): void {
  if (!Capacitor.isNativePlatform()) return

  pageViewsSinceInterstitial += 1
  if (pageViewsSinceInterstitial >= 3) {
    pageViewsSinceInterstitial = 0
    void showInterstitial()
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
