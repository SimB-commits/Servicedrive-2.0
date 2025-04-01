// pages/_app.tsx
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { HeroUIProvider } from "@heroui/system";
import { addToast, ToastProvider } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useRouter } from "next/router";
import { fontSans, fontMono } from "@/config/fonts";
import "@/styles/globals.css";
import DefaultLayout from "@/layouts/default";
import { SubscriptionProvider } from "@/context/SubscriptionContext";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();

  // Global wrapper-funktion som endast navigerar om målet skiljer sig från nuvarande URL
  const safeNavigate = (url: string) => {
    if (router.asPath !== url) {
      router.push(url);
    }
  };

  return (
    <SessionProvider session={session}>
      <NextThemesProvider attribute="class" defaultTheme="light">
        <HeroUIProvider navigate={safeNavigate}>
          <ToastProvider />
          {/* Lägg till SubscriptionProvider här, inom session men utanför layout */}
          <SubscriptionProvider>
            <main className="text-foreground bg-background">
              <DefaultLayout>
                <Component {...pageProps} />
              </DefaultLayout>
            </main>
          </SubscriptionProvider>
        </HeroUIProvider>
      </NextThemesProvider>
    </SessionProvider>
  );
}

export const fonts = {
  sans: fontSans.style.fontFamily,
  mono: fontMono.style.fontFamily,
};