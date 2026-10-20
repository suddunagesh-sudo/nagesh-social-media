import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { useCallback, useEffect, useRef, useState } from 'react'

export default function HomeScreen() {
  const webView = useRef<WebView>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [hasLoadError, setHasLoadError] = useState(false)

  const goBack = useCallback(() => {
    if (!canGoBack) return false
    webView.current?.goBack()
    return true
  }, [canGoBack])

  const retry = useCallback(() => {
    setHasLoadError(false)
    webView.current?.reload()
  }, [])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack)
    return () => subscription.remove()
  }, [goBack])

  return (
    <View style={styles.container}>
      <WebView
        ref={webView}
        source={{ uri: 'https://nagesh-social-final.vercel.app' }}
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        startInLoadingState
        onNavigationStateChange={({ canGoBack: hasHistory }) => setCanGoBack(hasHistory)}
        onLoadStart={() => setHasLoadError(false)}
        onError={() => setHasLoadError(true)}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.statusCode >= 400) setHasLoadError(true)
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#0f766e" size="large" />
          </View>
        )}
        renderError={() => (
          <Pressable accessibilityRole="button" onPress={retry} style={styles.loading}>
            <Text style={styles.errorMessage}>Unable to load the app. Tap to retry.</Text>
          </Pressable>
        )}
        style={styles.webView}
      />
      {hasLoadError ? (
        <Pressable accessibilityRole="button" onPress={retry} style={styles.errorOverlay}>
          <Text style={styles.errorMessage}>Unable to load the app. Tap to retry.</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webView: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  errorMessage: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '600',
  },
})
