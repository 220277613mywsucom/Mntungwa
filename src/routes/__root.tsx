import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { PresenceProvider } from "@/lib/presence";
import { BlocksProvider } from "@/lib/blocks";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient-brand">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That page doesn't exist on Nexus.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-white shadow-glow"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Nexus — Social for UWC students" },
      {
        name: "description",
        content:
          "The social platform exclusively for University of the Western Cape students. Connect, post, chat, join campus groups.",
      },
      { property: "og:title", content: "Nexus — Social for UWC students" },
      {
        property: "og:description",
        content: "Posts, profiles, DMs and campus groups — only for UWC students.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Nexus — Social for UWC students" },
      { name: "description", content: "Nexus is a UWC student social media platform for posting, messaging, and stories." },
      { property: "og:description", content: "Nexus is a UWC student social media platform for posting, messaging, and stories." },
      { name: "twitter:description", content: "Nexus is a UWC student social media platform for posting, messaging, and stories." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5304169b-431b-41bd-9b79-ac442a68bd4f/id-preview-7f2b4208--38a54105-9b85-4cff-a669-1c7a29fabfa3.lovable.app-1776747331806.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5304169b-431b-41bd-9b79-ac442a68bd4f/id-preview-7f2b4208--38a54105-9b85-4cff-a669-1c7a29fabfa3.lovable.app-1776747331806.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <BlocksProvider>
        <PresenceProvider>
          <Outlet />
          <Toaster />
        </PresenceProvider>
      </BlocksProvider>
    </AuthProvider>
  );
}
