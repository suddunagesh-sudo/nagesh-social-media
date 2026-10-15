import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: 'https://nagesh-social-media-lifetime-versio.vercel.app' }}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#0f766e" size="large" />
          </View>
        )}
        style={styles.webView}
      />
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
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
})
