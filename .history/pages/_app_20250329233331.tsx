import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { HeroUIProvider } from "@heroui/system";
import { addToast, ToastProvider } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useRouter } from "next/router";
import { fontSans, fontMono } from "@/config/fonts";
import "@/styles/globals.css";
import DefaultLayout from "@/layouts/default";

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
          <main className="text-foreground bg-background">
            <DefaultLayout>
              <Component {...pageProps} />
            </DefaultLayout>
          </main>
        </HeroUIProvider>
      </NextThemesProvider>
    </SessionProvider>
  );
}

export const fonts = {
  sans: fontSans.style.fontFamily,
  mono: fontMono.style.fontFamily,
};
