# GitHub Actions se signed AAB banana

Local Android Studio build ki zaroorat nahi hai. `.github/workflows/build-aab.yml` GitHub ke cloud runner par app build karke signed Android App Bundle (AAB) artifact upload karega.

## 1. Keystore banayein

1. JDK install ho aur `keytool` PATH mein available ho. Windows par project folder se `create-keystore.bat` chalayein.
2. `keytool` jab keystore password aur key password pooche, tab aapka diya hua password enter karein. Dono prompts ke liye wahi password use karein jo neeche GitHub Secrets mein dalenge. Password script mein hardcode nahi hai.
3. Certificate ki details pooche jaane par bhar kar confirm karein. Keystore file `my-release-key.jks` banegi.
4. Keystore ko surakshit jagah par backup karein. Is file ko GitHub par commit ya public share na karein. App updates ke liye isi upload key ki zaroorat hogi.

> Saral ya aasani se guess hone wala password upload key ko kam surakshit banata hai. Behtar hai ek lamba, unique password use karke use password manager mein save karein.

## 2. Keystore ko Base64 banayein

Project folder mein `encode-keystore.bat` chalayein. Yeh `my-release-key.jks` ko Base64 mein convert karke `my-release-key-base64.txt` banayegi.

Is `.txt` file ka poora content private signing-key data hai. Use sirf GitHub Secret mein paste karein; issue, chat, email ya repository mein share/commit na karein. Secret save hone ke baad local Base64 `.txt` file delete kar dein. `.gitignore` mein keystore aur Base64 file dono ignore hain.

## 3. GitHub Secrets add karein

GitHub repository mein **Settings > Secrets and variables > Actions > New repository secret** kholein. Neeche diye gaye exact naam se chaar repository secrets banayein:

| Secret name | Secret ki value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `my-release-key-base64.txt` ka poora Base64 content |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore banate waqt dala gaya keystore password |
| `ANDROID_KEY_ALIAS` | `my-key-alias` |
| `ANDROID_KEY_PASSWORD` | Key password; agar prompt par wahi password dala tha to wahi password |

Secrets ko workflow YAML ya kisi project file mein na likhein.

## 4. Workflow chalayein aur AAB download karein

- Workflow `main` branch par push se khud chalega.
- Build successful ho jaane par us workflow run ko kholein.
- **Artifacts** section se `app-release-aab` download karein. ZIP extract karne par `app-release.aab` milega.
- AAB ko Play Console ke testing ya production release mein upload karein.

Workflow Node 20, Java 17 aur Android SDK GitHub runner par setup karke web build, Capacitor copy aur signed `bundleRelease` karta hai. Is process ke liye local Android Studio build ki zaroorat nahi.
