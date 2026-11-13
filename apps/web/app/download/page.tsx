// /download (S11): Tegata on your phone. The promise on the lit stage beside the real app, then a card per way in, the
// visitor's own platform first (from the user agent): iPhone through Apple's public TestFlight link (always offered;
// while Apple reviews the beta it says so in one line), Android as the APK itself with its version, size and
// SHA-256, and the web app, which works on any phone today. On a desktop each card carries a QR for the phone in your
// other hand. Release facts live in ./release.ts. Ported from Kawase's /download (the owner's own), in Tegata's design.
import { ArrowRight, ArrowUpRight, Download, Globe } from "lucide-react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import Link from "next/link"
import type { ReactNode } from "react"

import { BusinessSeal, Lockup, TegataSeal } from "@/components/brand/seal"
import { buttonVariants } from "@/components/kit/button-variants"
import { Paper, Stage } from "@/components/kit/stage"
import { Mark } from "@/components/marks/mark"
import { cn } from "@/lib/utils"

import { Checksum, QrPlate } from "./parts"
import { ANDROID, githubPublic, IOS, isTestflightLink, testflightOpen } from "./release"

export const metadata: Metadata = {
  title: "Get the app",
  description:
    "Tegata on iPhone and Android: get paid, pay your team and hear the seal, with the same email sign-in.",
}

const SITE = "https://tegata.xyz"
type Platform = "ios" | "android" | "desktop"

function platformOf(agent: string): Platform {
  if (/iPhone|iPad|iPod/i.test(agent)) return "ios"
  if (/Android/i.test(agent)) return "android"
  return "desktop"
}

// Decimal megabytes, as GitHub and the release notes count them.
const MB = 1_000_000

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 814 1000"
      className={className}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  )
}

function AndroidGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 150" className={className} aria-hidden focusable="false">
      <path
        fill="#34A853"
        d="M255.285 143.47c-.084-.524-.164-1.042-.251-1.56a128.119 128.119 0 0 0-12.794-38.288 128.778 128.778 0 0 0-23.45-31.86 129.166 129.166 0 0 0-22.713-18.005c.049-.08.09-.168.14-.25 2.582-4.461 5.172-8.917 7.755-13.38l7.576-13.068c1.818-3.126 3.632-6.26 5.438-9.386a11.776 11.776 0 0 0 .662-10.484 11.668 11.668 0 0 0-4.823-5.536 11.85 11.85 0 0 0-5.004-1.61 11.963 11.963 0 0 0-2.218.018 11.738 11.738 0 0 0-8.968 5.798c-1.814 3.127-3.628 6.26-5.438 9.386l-7.576 13.069c-2.583 4.462-5.173 8.918-7.755 13.38-.282.487-.567.973-.848 1.467-.392-.157-.78-.313-1.172-.462-14.24-5.43-29.688-8.4-45.836-8.4-.442 0-.879 0-1.324.006-14.357.143-28.152 2.64-41.022 7.12a119.434 119.434 0 0 0-4.42 1.642c-.262-.455-.532-.911-.79-1.367-2.583-4.462-5.173-8.918-7.755-13.38L65.123 15.25c-1.818-3.126-3.632-6.259-5.439-9.386A11.736 11.736 0 0 0 48.5.048 11.71 11.71 0 0 0 43.49 1.66a11.716 11.716 0 0 0-4.077 4.063c-.281.474-.532.967-.742 1.473a11.808 11.808 0 0 0-.365 8.188c.259.786.594 1.554 1.023 2.296a3973.32 3973.32 0 0 1 5.439 9.386c2.53 4.357 5.054 8.713 7.58 13.069 2.582 4.462 5.168 8.918 7.75 13.38.02.038.046.075.065.112A129.184 129.184 0 0 0 45.32 64.38a129.693 129.693 0 0 0-22.2 24.015 127.737 127.737 0 0 0-9.34 15.24 128.238 128.238 0 0 0-10.843 28.764 130.743 130.743 0 0 0-1.951 9.524c-.087.518-.167 1.042-.247 1.56A124.978 124.978 0 0 0 0 149.118h256c-.205-1.891-.449-3.77-.734-5.636l.019-.012Z"
      />
      <path
        fill="#202124"
        d="M194.59 113.712c5.122-3.41 5.867-11.3 1.661-17.62-4.203-6.323-11.763-8.682-16.883-5.273-5.122 3.41-5.868 11.3-1.662 17.621 4.203 6.322 11.764 8.682 16.883 5.272ZM78.518 108.462c4.206-6.321 3.46-14.21-1.662-17.62-5.123-3.41-12.68-1.05-16.886 5.27-4.203 6.323-3.458 14.212 1.662 17.622 5.122 3.41 12.683 1.05 16.886-5.272Z"
      />
    </svg>
  )
}

function GitHubGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12.02c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-1.97c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.53 11.53 0 0 0 23.5 12.02C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

/** A phone around a real capture of the app. */
function Phone({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={cn(
        "w-[230px] shrink-0 rounded-[44px] bg-black p-[9px] shadow-[0_24px_60px_#16130f80] sm:w-[250px]",
        className,
      )}
    >
      <img src={src} alt={alt} className="block w-full rounded-[36px]" width={603} height={1311} />
    </div>
  )
}

function Card({
  id,
  title,
  glyph,
  state,
  mine,
  children,
  qr,
}: {
  id: string
  title: string
  glyph: ReactNode
  state: string
  mine: boolean
  children: ReactNode
  qr?: ReactNode
}) {
  return (
    <article
      id={id}
      className="flex scroll-mt-24 flex-col gap-5 rounded-[24px] bg-card p-6 sm:p-7"
      aria-label={title}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-[14px] bg-secondary [&_svg]:size-6">
            {glyph}
          </span>
          <div>
            <h2 className="display text-[28px] leading-none">{title}</h2>
            <p className="mt-1.5 text-detail font-medium text-muted-foreground">{state}</p>
          </div>
        </div>
        {mine ? (
          <span className="shrink-0 rounded-full bg-shu-wash px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-shu-ink">
            This phone
          </span>
        ) : null}
      </header>
      <div className="flex flex-1 flex-col gap-4 text-[16px] text-muted-foreground">{children}</div>
      {qr ? <div className="hidden lg:block">{qr}</div> : null}
    </article>
  )
}

function Steps({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-3 text-foreground">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-[12px] font-bold text-background">
            {index + 1}
          </span>
          <span className="text-[15px]">{step}</span>
        </li>
      ))}
    </ol>
  )
}

function Facts({ facts }: { facts: [string, string][] }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {facts.map(([label, value]) => (
        <div key={label} className="rounded-[14px] bg-secondary px-3 py-2.5">
          <dt className="text-[12px] font-semibold text-text-3">{label}</dt>
          <dd className="tnum text-[15px] font-semibold text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default async function DownloadPage() {
  const platform = platformOf((await headers()).get("user-agent") ?? "")
  const github = ANDROID && (await githubPublic(ANDROID.github)) ? ANDROID.github : null
  // The public link is always offered, like Kawase's (Abu, 13 Nov: "just use the normal link"); while Apple's review
  // runs, the card says so in one line, and the same link starts taking testers the moment it passes.
  const testflight = isTestflightLink(IOS.testflight) ? IOS.testflight : null
  const testersIn = testflight ? await testflightOpen(testflight) : false

  const ios = (
    <Card
      key="ios"
      id="iphone"
      title="iPhone"
      glyph={<AppleGlyph />}
      state={testersIn ? "Public beta on TestFlight" : "Public beta · in Apple's review"}
      mine={platform === "ios"}
      qr={
        <QrPlate
          url={testflight ?? `${SITE}/signin`}
          caption={
            testflight
              ? "Opens the TestFlight invitation on your iPhone"
              : "Opens Tegata on your iPhone's browser meanwhile"
          }
        />
      }
    >
      {testflight ? (
        <>
          <Steps
            steps={[
              "Install TestFlight from the App Store.",
              "Open the invitation and tap Accept.",
              "Install Tegata and sign in with your email.",
            ]}
          />
          {testersIn ? null : (
            <p className="text-[14px] text-muted-foreground">
              Apple is reviewing the beta. If TestFlight says it isn&apos;t taking testers yet, the
              same link works as soon as it does.
            </p>
          )}
          <a href={testflight} className={cn(buttonVariants({ size: "lg" }), "mt-auto")}>
            Join the beta <ArrowUpRight />
          </a>
        </>
      ) : (
        <>
          <p>
            Build {IOS.build} of version {IOS.version} is with Apple. The invitation appears here
            the moment Apple lets testers in.
          </p>
          <Link
            href="/signin"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-auto")}
          >
            Use Tegata in Safari meanwhile <ArrowRight />
          </Link>
        </>
      )}
    </Card>
  )

  const android = (
    <Card
      key="android"
      id="android"
      title="Android"
      glyph={<AndroidGlyph className="!h-4 !w-auto" />}
      state={ANDROID ? `APK · version ${ANDROID.version} (${ANDROID.build})` : "APK on its way"}
      mine={platform === "android"}
      qr={
        ANDROID ? (
          <QrPlate url={ANDROID.url} caption="Downloads the APK on your Android phone" />
        ) : undefined
      }
    >
      {ANDROID ? (
        <>
          <Facts
            facts={[
              ["Version", `${ANDROID.version} (${ANDROID.build})`],
              ["Size", `${(ANDROID.sizeBytes / MB).toFixed(1)} MB`],
              [
                "Built",
                new Date(ANDROID.builtAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                }),
              ],
            ]}
          />
          <Checksum value={ANDROID.sha256} />
          <Steps
            steps={[
              "Download the APK on your phone.",
              "Open it and allow installs from your browser when Android asks.",
              "Play Protect may ask once: Tegata isn't on Google Play, so tap Install anyway.",
            ]}
          />
          <div className="mt-auto flex flex-col gap-2">
            <a href={ANDROID.url} className={buttonVariants({ size: "lg" })}>
              <Download /> Download the APK
            </a>
            {github ? (
              <a href={github} className={buttonVariants({ variant: "secondary", size: "md" })}>
                <GitHubGlyph className="size-[18px]" /> Same file on GitHub
              </a>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p>The first Android build is being made. It lands here with its version and checksum.</p>
          <Link
            href="/signin"
            className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-auto")}
          >
            Use Tegata in Chrome meanwhile <ArrowRight />
          </Link>
        </>
      )}
    </Card>
  )

  const web = (
    <Card
      key="web"
      id="web"
      title="Web"
      glyph={<Globe />}
      state="Any phone or computer, today"
      mine={platform === "desktop"}
      qr={<QrPlate url={`${SITE}/signin`} caption="Opens tegata.xyz on your phone" />}
    >
      <p>
        The same account everywhere: sign in with your email and your balance, links and seal are
        there.
      </p>
      <Link
        href="/signin"
        className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "mt-auto")}
      >
        Open Tegata <ArrowRight />
      </Link>
    </Card>
  )

  const cards =
    platform === "android"
      ? [android, ios, web]
      : platform === "desktop"
        ? [ios, android, web]
        : [ios, android, web]

  return (
    <main className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="Tegata home">
          <Lockup size={32} />
        </Link>
        <Link href="/signin" className={buttonVariants({ size: "sm" })}>
          Open Tegata
        </Link>
      </header>

      <section className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <Stage
          tone="lacquer"
          className="relative overflow-hidden px-6 pt-10 pb-0 sm:px-12 sm:pt-14"
          rounded
        >
          <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-6 pb-10 lg:pb-16">
              <div className="flex items-center gap-3">
                <TegataSeal size={56} tone="paper" tilt={-4} />
                <span className="rounded-full bg-white/20 px-3 py-1 text-[14px] font-semibold text-white">
                  iPhone · Android
                </span>
              </div>
              <h1 className="display text-[48px] leading-[0.92] text-white sm:text-[72px]">
                Tegata on your phone.
              </h1>
              <p className="max-w-[40ch] text-[18px] text-white/85">
                Get paid, pay your team and hear the seal land. Same email, same balance.
              </p>
              <div className="flex flex-wrap gap-2">
                <a href="#iphone" className={buttonVariants({ variant: "paper", size: "lg" })}>
                  <AppleGlyph className="size-5" /> iPhone
                </a>
                <a href="#android" className={buttonVariants({ variant: "paper", size: "lg" })}>
                  <AndroidGlyph className="!h-3.5 !w-auto" /> Android
                </a>
              </div>
              <span className="inline-flex items-center gap-2 text-[14px] font-medium text-white/85">
                <Mark id="usdc" chain="near" size={20} /> USDC on NEAR · fees paid by Tegata
              </span>
            </div>
            <div className="relative flex justify-center gap-4 self-end">
              <Phone
                src="/download/phone-home.webp"
                alt="Tegata's Home on an iPhone: the balance on the vermilion stage"
                className="translate-y-6"
              />
              <Phone
                src="/download/phone-link.webp"
                alt="A Tegata pay link on an iPhone: the amount, its QR and the business seal"
                className="hidden translate-y-14 sm:block"
              />
              <div className="absolute -top-6 -left-8 hidden rotate-[-8deg] lg:block">
                <Paper className="p-3">
                  <BusinessSeal name="Your business" band="Paid" size={84} />
                </Paper>
              </div>
            </div>
          </div>
        </Stage>
      </section>

      <section className="mx-auto grid max-w-[1240px] gap-4 px-5 py-12 sm:px-8 lg:grid-cols-3">
        {cards}
      </section>

      <footer className="mx-auto flex max-w-[1240px] items-center gap-2 px-5 pb-12 text-detail text-text-3 sm:px-8">
        <Mark id="near" size={18} /> Settled on NEAR · Powered by NEAR Intents
      </footer>
    </main>
  )
}
