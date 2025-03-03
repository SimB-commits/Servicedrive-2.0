export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Next.js + HeroUI",
  description: "Make beautiful websites regardless of your design experience.",
  navItems: [
    {
      label: "Meny",
      
    },
    {
      label: "Dashboard",
      href: "/",
    },
    {
      label: "Skapa Nytt",
      href: "/nytt-arende",
    },
    {
      label: "Ärenden",
      href: "/arenden",
    },
    
    
  ],
  navMenuItems: [
    {
      label: "Dashboard",
      href: "/",
    },
    {
      label: "Nytt Ärende",
      href: "/nytt-arende",
    },
    {
      label: "Ärenden",
      href: "/arenden",
    },
    {
      label: "Kunder",
      href: "/kunder",
    },
    {
      label: "Ärendetyper",
      href: "/arendetyper",
    },
    {
      label: "Kundkontakt",
      href: "/kundkontakt",
    },
    {
      label: "Inställningar",
      href: "/installningar",
    },
    {
      label: "Logout",
      href: "/logout",
    },
  ],
  links: {
    github: "https://github.com/heroui-inc/heroui",
    twitter: "https://twitter.com/hero_ui",
    docs: "https://heroui.com",
    discord: "https://discord.gg/9b6yyZKmH4",
    sponsor: "https://patreon.com/jrgarciadev",
  },
};
