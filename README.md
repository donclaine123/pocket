# pocket. — penny journal 📒

[![Download Android APK](https://img.shields.io/badge/Download-Android_APK-FF9E7E?style=for-the-badge&logo=android&logoColor=white)](https://github.com/donclaine123/pocket/releases/latest)
[![100% Offline](https://img.shields.io/badge/Offline-100%25_Private-92D8B9?style=for-the-badge&logo=shield&logoColor=white)](https://github.com/donclaine123/pocket)
[![Zero Ads](https://img.shields.io/badge/No_Ads-Zero_Tracking-F7C56B?style=for-the-badge)](https://github.com/donclaine123/pocket)

> *"A steady little habit beats a big reset ✿"*

**Pocket** is a cozy, distraction-free money diary designed to help you build mindful daily spending habits. Log expenses and income in just 3 seconds, see where your money goes at a glance, and enjoy a tactile, neobrutalist notebook experience that stays 100% private on your phone.

---

## 📥 How to Install on Android

1. Go to the **[Latest GitHub Releases](https://github.com/donclaine123/pocket/releases/latest)** tab of this repository.
2. Under **Assets**, download the **`pocket.apk`** file.
3. Open the downloaded file on your Android device and tap **Install** *(allow "Install unknown apps" if prompted by your browser)*.
4. Open **Pocket** and start journaling your finances immediately!

---

## ✨ What Does Pocket Do?

### 🔒 1. 100% Private & Works Offline
* **Zero Mandatory Accounts**: Start logging right away without creating an account or entering an email.
* **On-Device Privacy**: Your transactions and balance stay stored directly on your phone. No tracking, no third-party analytics, and no intrusive ads.

### ⚡ 2. Frictionless Daily Logging
* **3-Second Entry**: Quickly record expenses or income with amounts, custom notes, and categories.
* **Cozy Category Stamps**: Categorize entries with tilted sticker chips:
  * ☕ **Coffee** & Cafes
  * 🛒 **Groceries**
  * 🚌 **Transportation** & Commute
  * 🎬 **Fun** & Entertainment
  * ✈️ **Travel**
  * 💼 **Salary** & Earnings
  * 🍪 **Snacks** & Food
* **Haptic Tactility**: Enjoy subtle physical vibrations on taps, saves, and deletions for an authentic paper-notebook feel.

### 📅 3. Flexible 4-Stage Timeframe Views
Switch effortlessly between different perspectives on your money:
* **Daily (`☀️`)**: Focus on today's budget with day-by-day navigation (`Today`, `Yesterday`, etc.) and a 1-tap `[ ↺ Jump to current ]` button.
* **Weekly (`⏰`)**: View your Monday–Sunday cash flow and weekly habits.
* **Monthly (`📅`)**: Month-to-date tracking with live income vs. spent progress bars and net balance.
* **All History (`🗄️`)**: Lifetime monthly notebook archives and savings drilldowns.

### 🪙 4. 20+ Global Currencies
* Select your preferred primary currency in Settings:
  * 🇵🇭 **PHP (₱)**
  * 🇺🇸 **USD ($)**
  * 🇪🇺 **EUR (€)**
  * 🇬🇧 **GBP (£)**
  * 🇯🇵 **JPY (¥)**
  * 🇸🇬 **SGD (S$)**
  * 🇲🇾 **MYR (RM)**
  * 🇮🇩 **IDR (Rp)**
  * 🇹🇭 **THB (฿)**
  * 🇮🇳 **INR (₹)**
  * *...plus CAD, AUD, KRW, VND, BRL, and more!*
* All ledger cards, progress bars, input boxes, and even the pocket coin rivet dynamically adapt to your selected currency.

### 🔍 5. Search & Chronological Sorting
* **Instant Search**: Search through thousands of entries in real-time by note, amount, or category.
* **Sort Toggle (`↓ Newest` ⇄ `↑ Oldest`)**: Flip the entire notebook list with 1 tap so early dates (like the 1st of the month) appear right at the top without scrolling.

### 🛡️ 6. Safe Updates (Zero Data Loss)
* In-app update notifications install smoothly in-place without uninstalling the app.
* Your local guest records, history, and balance are always 100% protected and will never be wiped during an update.

### ☁️ 7. Optional Multi-Device Cloud Sync
* Stay completely offline forever as a guest, or connect your personal Supabase account whenever you want cross-device backup and real-time syncing.

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | **[React Native 0.76](https://reactnative.dev/)** & **[Expo SDK 52](https://expo.dev/)** | Cross-platform native mobile engine |
| **Routing** | **[Expo Router](https://docs.expo.dev/router/introduction/)** | Type-safe, file-based routing architecture |
| **List Virtualization** | **[Shopify FlashList](https://shopify.github.io/flash-list/)** | 60 FPS cell recycling handling 10,000+ entries with flat $O(1)$ memory |
| **Local Storage** | **[Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)** & **AsyncStorage** | Instant 0ms reads and writes with 100% offline persistence |
| **Cloud & Sync** | **[Supabase](https://supabase.com/)** & **[PowerSync](https://www.powersync.com/)** | Relational PostgreSQL with Row-Level Security (RLS) & local-first sync |
| **Auto-Updates** | **[expo-updates](https://docs.expo.dev/versions/latest/sdk/updates/)** | Seamless in-place OTA updates without erasing guest data |
| **Haptics & Hardware** | **`expo-haptics`** & **`expo-secure-store`** | Tactile vibrations and encrypted biometric auth storage |
| **Typography & Icons** | **Google Fonts** (Fredoka & DM Sans) & **[Lucide](https://lucide.dev/)** | Signature neobrutalist typography and cozy iconography |
| **Build & Packaging** | **[EAS Build](https://expo.dev/eas)** | Standalone Android APK builds and distribution |

---

## 🎨 Design Philosophy

Pocket is crafted with a **warm neobrutalist aesthetic**:
* Tactile, high-contrast borders and hard offset drop shadows.
* Soft cream and paper color palette (`#F7F0E3` / `#FFFDF7`) that goes easy on the eyes.
* Playful rounded sticker pills with organic degree tilts.
* Friendly, encouraging typography (Fredoka & DM Sans).

---

<p align="center">
  crafted with care · offline & private by design ✿
</p>
