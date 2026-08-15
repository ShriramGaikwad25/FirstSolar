import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";
import QueryProvider from "./QueryProvider";
import { LoadingProvider } from "@/contexts/LoadingContext";
import { PageTransitionLoader } from "@/components/PageTransitionLoader";
import { ActionPanelProvider } from "@/contexts/ActionPanelContext";
import ActionPanel from "@/components/ActionPanel";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthWrapper } from "@/components/AuthWrapper";
import { RightSidebarProvider } from "@/contexts/RightSidebarContext";
import { LeftSidebarProvider } from "@/contexts/LeftSidebarContext";
import { CartProvider } from "@/contexts/CartContext";
import { SelectedUsersProvider } from "@/contexts/SelectedUsersContext";
import { ItemDetailsProvider } from "@/contexts/ItemDetailsContext";
import RightSideBarHost from "@/components/RightSideBarHost";
import LayoutContentShift from "@/components/LayoutContentShift";
import { SkipLink } from "@/components/SkipLink";
import { ChartJsAppFontSync } from "@/components/ChartJsAppFontSync";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KeyForge",
  description: "Identity Security Posture Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ChartJsAppFontSync />
        <SkipLink />
        <AuthProvider>
          <QueryProvider>
            <LoadingProvider>
              <ActionPanelProvider>
                <CartProvider>
                  <SelectedUsersProvider>
                    <ItemDetailsProvider>
                      <RightSidebarProvider>
                      <LeftSidebarProvider>
                        <AuthWrapper>
                          <LayoutContentShift>
                            {children}
                          </LayoutContentShift>
                        </AuthWrapper>
                        <RightSideBarHost />
                        <PageTransitionLoader />
                        <ActionPanel />
                      </LeftSidebarProvider>
                    </RightSidebarProvider>
                    </ItemDetailsProvider>
                  </SelectedUsersProvider>
                </CartProvider>
              </ActionPanelProvider>
            </LoadingProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
