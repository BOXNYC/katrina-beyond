# Installing Barrier Island on the Museum iPad (and your team's iPhones)

How to put the Barrier Island app on the Louisiana State Museum's iPad for the
*Katrina and Beyond* exhibition, and on your team's iPhones for testing. It
uses **ad hoc distribution** from a personal (Individual) Apple Developer
account, built and signed in the cloud by **EAS Build**.

> Researched October 2026 against Apple Developer and Expo/EAS docs (Expo SDK 58,
> EAS CLI 25.x). If a screen doesn't match what's described here, ask Claude to
> re-check the current docs.

**Ad hoc builds expire.** An ad hoc app only opens while its provisioning
profile (and the certificate behind it) is valid, which is about 12 months.
Every year you have to renew and reinstall. That process is in
**[RENEWAL.md](RENEWAL.md)**.

**How to read the steps**

| Marker | Meaning |
| --- | --- |
| 🧑 **MANUAL** | You do this yourself: in a browser, on the MacBook Pro (M1, macOS 26.5.1), or on a device. Claude can't do it for you, usually because it needs your Apple login, 2FA, payment, or the physical device. |
| 🤖 **ASK CLAUDE** | Paste the quoted prompt into Claude Code from this repo and Claude will do the step. |

Commands that start with `!` are typed into Claude Code's prompt. They run
interactively in this session, so Claude can see the result.

---

## 1. Set up your personal Apple Developer account

### 1.1 🧑 MANUAL: Create a personal Apple Account
Use an Apple Account that is **not** tied to your company's developer team, so
this project stays completely separate.

1. Go to <https://account.apple.com> → **Create Your Apple Account**. Use a
   personal email address, not your company email.
2. Turn on **two-factor authentication** with your iPhone. Apple requires it for
   developer accounts.

### 1.2 🧑 MANUAL: Enroll in the Apple Developer Program as an Individual
It costs **$99/year**. The fastest route is the Apple Developer app on your iPhone:

1. Install **Apple Developer** from the App Store on your iPhone.
2. Open it → **Account** → sign in with the personal Apple Account from 1.1.
3. Tap **Enroll Now** → choose **Individual**.
4. Follow the prompts. The app scans your government-issued photo ID.
   - Enter your **real legal name**. Don't use a nickname or company name, or
     approval is delayed.
   - Pay with **your own credit card**. A card in someone else's name delays
     enrollment.
5. Approval usually takes a day or two. You'll get a welcome email.

(You can also enroll on the web at <https://developer.apple.com/programs/enroll/>.)

### 1.3 🧑 MANUAL: Confirm the membership is active
Sign in at <https://developer.apple.com/account> with the personal account.
**Membership details** should show **Individual**, your name, a **Team ID**,
and an expiration date one year out.

> **Put the membership expiration date in your calendar.** If the membership
> lapses, you can't renew the app's signing. [RENEWAL.md](RENEWAL.md) covers this.

You don't need App Store Connect, TestFlight, or any agreements for ad hoc.

---

## 2. Set up Expo (EAS)

### 2.1 🧑 MANUAL: Create a free Expo account
Sign up at <https://expo.dev/signup>. EAS Build compiles and signs the iOS app in
Expo's cloud, so you don't need Xcode. The free tier's monthly iOS build
allowance is plenty for this project.

### 2.2 🧑 MANUAL: Log in and link the project
```
! cd apps/barrier-island && npx eas-cli@latest login
! cd apps/barrier-island && npx eas-cli@latest init
```
`eas init` creates the project on your Expo account and writes its `projectId`
into `app.json`.

### 2.3 🧑 MANUAL: Commit the project link
Commit the `projectId` that `eas init` added to `apps/barrier-island/app.json`,
along with the distribution config already in the repo (`eas.json`, `app.json`,
`package.json`, `pnpm-lock.yaml`, and these guides). EAS builds from your git
repository, so commit before every build to keep each build matched to a commit.

### Already set up in the repo
There's nothing to do here.
- **`eas.json`** has one build profile, `adhoc`. It uses internal (ad hoc)
  distribution and bumps the build number automatically on each build. Builds
  use Node 24.21.0 and pnpm 12.8.1 to match this monorepo.
- **`app.json`** sets the home-screen name to **Barrier Island**. It also adds
  the **Local Network** permission text: since iOS 14, the app's first TCP
  connection to the display (`src/lib/modelLink.ts`) shows a permission
  prompt. It also declares that the app uses no non-exempt encryption.

### 2.4 🤖 ASK CLAUDE: Set the display's address
The display's IP and port get baked into the app at build time. `eas.json`
currently has the placeholder `192.168.1.50:9000`. Get the display controller's
real IP and port from the museum's AV/IT contact, and ask them to give it a
**static IP / DHCP reservation** so it never changes.

> "Set the barrier-island display host to `<IP>` and port `<port>` in eas.json."

Then 🧑 **MANUAL:** commit the `eas.json` change.

---

## 3. Register the devices

Ad hoc builds only install on devices whose ID (UDID) is in the provisioning
profile. Register the museum iPad and every tester's iPhone **before** building.
An Individual account allows 100 iPhones and 100 iPads per membership year, and
removing a device doesn't free its slot until the membership renews.

### 3.1 🧑 MANUAL: Create a registration link
```
! cd apps/barrier-island && npx eas-cli@latest device:create
```
1. Sign in with your **personal** Apple Account when prompted, and pick the
   personal team if more than one is listed.
2. Choose **Website** to get a URL and QR code.

### 3.2 🧑 MANUAL: Register each device
On **each** device, the museum iPad included:
1. Open the URL or scan the QR code **in Safari**.
2. Tap through to download the configuration profile → **Allow**.
3. Open **Settings** → tap **Profile Downloaded** at the top (or *General → VPN &
   Device Management*) → **Install** → enter the device passcode.
4. Safari returns to the Expo page and the device is registered.

Give each device a clear name (e.g. *LSM Exhibit iPad*, *Joe iPhone*). To rename
or check them later:

> 🤖 "List the registered barrier-island devices." (This runs `eas device:list`.)

> For a newly renewed or new membership, Apple can take **24–72 hours** to
> process new devices. If the first build fails to include a device, wait and
> try again.

---

## 4. Build the app

### 4.1 🧑 MANUAL: First build (interactive, one time)
The first build has to be interactive. EAS signs in to Apple and creates the
**Apple Distribution certificate** and **ad hoc provisioning profile** for you:
```
! cd apps/barrier-island && npx eas-cli@latest build --platform ios --profile adhoc
```
- Answer **Yes** to logging in to your Apple account (the personal one).
- Answer **Yes** to generating a new Apple Distribution Certificate.
- When asked which devices to include in the profile, **select all of them**.

The build runs in the cloud (~10–20 minutes). Then you get a build page URL and QR code.

### 4.2 🤖 ASK CLAUDE: Later builds
Once the credentials exist, Claude can start builds for you:
> "Build barrier-island for iOS with the adhoc profile and give me the install link."

If you've registered new devices since the last build, run 4.1 again
interactively so you can add them to the profile. Or re-sign the last build
without rebuilding:
```
! cd apps/barrier-island && npx eas-cli@latest build:resign --platform ios --target-profile adhoc --source-profile adhoc
```

### 4.3 Test the TCP connection before installing at the museum
This is the first native build of the app, and the first time
`react-native-tcp-socket` runs in a native build. `expo-doctor` warns that it's
"untested on New Architecture." Check that it connects on an iPhone (step 5),
either to the real display or to a test listener on your Mac:

> 🤖 "Run a TCP listener on my Mac that prints what barrier-island sends, and
> tell me what IP to put in eas.json for testing."

If it doesn't connect:
> 🤖 "The barrier-island TCP connection fails on device. Diagnose it."

---

## 5. Install on your team's iPhones

### 5.1 🧑 MANUAL: Each teammate, on their registered iPhone
1. Open the build page link or QR code from step 4 **in Safari**.
2. Tap **Install** → confirm. The app appears on the home screen.
3. If iOS says the app requires **Developer Mode**, turn it on in **Settings →
   Privacy & Security → Developer Mode** and restart.
4. When the app first connects to the display, tap **Allow** on the
   Local Network prompt.

To push a new version to the team, build again (4.2) and send the new link.
Installing over the existing app keeps it in place.

---

## 6. Install on the museum iPad and set it up as a kiosk

### 6.1 🧑 MANUAL: Install
1. Connect the iPad to Wi-Fi with internet access.
2. Open the build link **in Safari** → **Install**.
   If the iPad asks for **Developer Mode**, turn it on as in 5.1.
3. Connect the iPad to the **same network/VLAN as the display controller**.
4. Open Barrier Island → tap **Allow** on the **Local Network** prompt.
   If someone taps *Don't Allow*, fix it in **Settings → Privacy & Security →
   Local Network → Barrier Island**.
5. Confirm the display responds.

### 6.2 🧑 MANUAL: Lock it down
1. **Settings → Display & Brightness → Auto-Lock → Never.**
2. **Settings → Accessibility → Guided Access → On.** Set a passcode (keep it in
   the exhibit binder), set *Display Auto-Lock* to **Never**, and turn on the
   **Accessibility Shortcut** for Guided Access.
3. Open Barrier Island → **triple-click the top button** (or Home button) → in
   *Options* turn off **Volume Buttons**, **Motion** (if orientation should stay
   fixed), and **Keyboards** → **Start**.
   - To exit: triple-click and enter the passcode.
   - After a power loss, the iPad restarts **outside** Guided Access. Facilities
     staff need to know to reopen the app and triple-click.
4. **Settings → General → Software Update → Automatic Updates → off.** An
   iPadOS update could change behavior mid-exhibit, so update deliberately,
   after testing on an iPhone first.
5. Turn off notifications and Siri, and keep the iPad permanently powered.

### 6.3 🧑 MANUAL: Write it down for the exhibit binder
- Display controller IP and port
- Guided Access passcode and iPad device passcode
- The app's **expiration date** and the renewal instructions
  ([RENEWAL.md](RENEWAL.md))
- Your contact info, for when the app needs renewing

> 🤖 "Tell me exactly when the current barrier-island ad hoc build expires."
> (Claude downloads the latest build and reads the expiration date out of its
> embedded provisioning profile.)

---

## Quick reference: prompts

| Step | Prompt |
| --- | --- |
| 2.4 | "Set the barrier-island display host to `<IP>` and port `<port>` in eas.json." |
| 3 | "List the registered barrier-island devices." |
| 4.2 | "Build barrier-island for iOS with the adhoc profile and give me the install link." |
| 4.3 | "Run a TCP listener on my Mac that prints what barrier-island sends." |
| 6.3 | "Tell me exactly when the current barrier-island ad hoc build expires." |
| Yearly | See [RENEWAL.md](RENEWAL.md) |

## Sources
- Expo: [Internal distribution](https://docs.expo.dev/build/internal-distribution/)
- Expo: [App credentials](https://docs.expo.dev/app-signing/app-credentials/)
- Expo: [eas.json reference](https://docs.expo.dev/eas/json/)
- Expo: [SDK 58 app config](https://docs.expo.dev/versions/v58.0.0/config/app/)
- Apple: [Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment)
- Apple: [NSLocalNetworkUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nslocalnetworkusagedescription)
- Apple: [Use Guided Access on iPhone or iPad](https://support.apple.com/en-us/ht202612)
