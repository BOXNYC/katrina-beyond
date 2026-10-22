# Yearly Renewal: Barrier Island Ad Hoc Build

The museum iPad runs an **ad hoc** build. It only opens while two things are
valid:

- the **ad hoc provisioning profile** embedded in the app (about 12 months from
  when it was created), and
- the **Apple Distribution certificate** that signed it (also about 12 months).
  A profile can't outlive its certificate.

Once either one expires, **the app won't open on the iPad** (or on any tester's
iPhone) until a freshly signed build is installed. This guide renews both and
reinstalls the app. It takes about 30 minutes of hands-on time plus a cloud
build, and someone has to be physically at the iPad for step 6.

Same markers as [DISTRIBUTION.md](DISTRIBUTION.md): 🧑 **MANUAL** = you do it,
🤖 **ASK CLAUDE** = paste the prompt into Claude Code from this repo.

> **When to do this:** about **30 days before** the expiration date in the
> exhibit binder. Set a recurring calendar reminder. You can renew early at any
> time; it just restarts the 12-month clock.

---

## 1. 🧑 MANUAL: Make sure the Apple Developer membership is active

1. Sign in at <https://developer.apple.com/account> with your company Apple
   Account, and select the **BOX Creative, LLC** team (Team ID `RK25ZT8XB9`).
2. **Membership details** should show an expiration date in the future. If it's
   about to expire, have the company's Account Holder renew it.
3. Confirm you still have **Certificates, Identifiers & Profiles** access (see
   [DISTRIBUTION.md, 1.1](DISTRIBUTION.md#11--manual-confirm-the-membership-and-your-role)).
   Roles sometimes change over a year.
4. Without an active membership you can't create a new certificate or
   profile, and none of the steps below will work.

> The Account Holder may **reset the team's device list** at the start of a new
> membership year. That affects every company project. If they do, make sure the
> **museum iPad** and anyone still testing are kept (or re-registered), or
> they'll be left out of the new profile.

## 2. 🤖 ASK CLAUDE: Check the current expiration dates

> "Check when the current barrier-island ad hoc build's provisioning profile and
> distribution certificate expire."

Claude downloads the latest `adhoc` build and decodes its embedded provisioning
profile to read the expiration date and the list of included devices. Note the
date, and confirm the museum iPad is on the list.

## 3. 🧑 MANUAL: Check the device list

Add any new testers (or a replacement iPad) now, before creating the new
profile. Follow [DISTRIBUTION.md, Section 3](DISTRIBUTION.md#3-register-the-devices):

```
! cd apps/barrier-island && npx eas-cli@latest device:create
```

## 4. 🧑 MANUAL: Retire the old signing credentials in EAS

You remove the old certificate and profile **from EAS only**, so the next build
generates fresh ones with a full year on them.

```
! cd apps/barrier-island && npx eas-cli@latest credentials --platform ios
```

1. Pick the **`adhoc`** build profile, and sign in with your company Apple
   Account (BOX Creative, LLC team) if asked.
2. Open the build credentials menu and **remove the provisioning profile**.
3. **Remove the distribution certificate** too.
   - ⚠️ If EAS asks whether to **also revoke/delete it on the Apple Developer
     Portal, answer No.** The app on the iPad is still signed with the old
     certificate. Revoking it can stop the exhibit **immediately**, before the
     new build is installed. Let the old certificate expire on its own. If it's a
     certificate other company apps use, revoking it would break those too.
4. Exit the menu.

> If Apple later says the team has hit the maximum number of distribution
> certificates, check with the company's Account Holder. Only certificates that
> have **already expired** are safe to revoke, at
> <https://developer.apple.com/account/resources/certificates/list>. Never
> revoke the one the iPad is using, or one another company app depends on.

## 5. 🧑 MANUAL: Create a newly signed build

Choose **one**:

**A. Code hasn't changed (fastest):** re-sign the existing build with new
credentials. Nothing gets recompiled, so it's exactly the same app as last year.

```
! cd apps/barrier-island && npx eas-cli@latest build:resign --platform ios --target-profile adhoc --source-profile adhoc
```

**B. Code changed, or the Expo SDK or iPadOS needs updates:** rebuild first.
> 🤖 "Check whether barrier-island builds against the latest Expo SDK and
> iPadOS, make any needed updates, and run lint and typecheck."

Then build:
```
! cd apps/barrier-island && npx eas-cli@latest build --platform ios --profile adhoc
```

Either way, when EAS asks:
- **Generate a new Apple Distribution Certificate?** → **Yes**
- **Generate a new provisioning profile?** → **Yes**
- **Which devices to include?** → **select all**, and make sure the museum iPad is checked

Wait for the build to finish. You'll get a new install link and QR code.

## 6. 🤖 ASK CLAUDE: Verify the new build

> "Verify the newest barrier-island adhoc build: show its provisioning profile
> expiration date and confirm the museum iPad is in its device list."

The new expiration date should be about one year out. If it's only weeks or
months away, the old certificate was reused, so repeat step 4.

## 7. 🧑 MANUAL: Install on the museum iPad (on site)

1. **Exit Guided Access:** triple-click the top (or Home) button → enter the
   passcode → **End**.
2. Make sure the iPad has internet access.
3. Open the new build link **in Safari** → **Install**. It installs over the
   existing app, so you don't need to delete anything.
4. Open Barrier Island. If the **Local Network** prompt reappears, tap **Allow**.
5. Confirm the display responds.
6. Restart Guided Access: open the app → triple-click → **Start**.

> **Already expired?** If the app won't open (it shows an "unavailable" message
> or closes right away), do the same steps. Installing the new build fixes it.

## 8. 🧑 MANUAL: Reinstall on testers' iPhones

Send teammates the new link. Their old installs stop working when the
old credentials expire.

## 9. 🧑 MANUAL: Update the records

1. Write the **new expiration date** in the exhibit binder.
2. Move your calendar reminder to **30 days before** the new date.
3. Commit any code changes from this renewal (step 5B), ideally before the build
   so it matches a commit.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| App won't open on the iPad | Profile or certificate expired | Do this whole guide. Install the new build. |
| "Unable to Install" / "Integrity could not be verified" | The iPad isn't in the new profile | Step 3, then re-sign (step 5A) and pick all devices |
| iPad asks for **Developer Mode** | iPadOS setting | **Settings → Privacy & Security → Developer Mode → On**, then restart |
| Build fails with a device/profile error right after renewing membership | Apple is still processing devices (24–72 hours) | Wait a day and retry step 5 |
| Display doesn't respond after reinstall | Local Network permission denied, or the controller's IP changed | **Settings → Privacy & Security → Local Network → Barrier Island → On**. If the IP changed: 🤖 "Set the barrier-island display host to `<IP>` in eas.json", then do step 5B. |
| EAS says "maximum number of certificates" | The company team has too many active distribution certs | Ask the Account Holder. Only already-expired ones are safe to revoke (see step 4). |

## Sources
- Expo: [App credentials](https://docs.expo.dev/app-signing/app-credentials/) ("Provisioning profiles expire after 12 months"; profiles must be regenerated when the certificate expires)
- Expo: [Internal distribution](https://docs.expo.dev/build/internal-distribution/) (`eas build:resign`, device registration delays)
- Apple: [Certificates overview](https://developer.apple.com/help/account/certificates/certificates-overview)
