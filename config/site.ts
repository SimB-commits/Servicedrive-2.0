export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Servicedrive",
  description: "Hantera ärenden och kunder smidigt och enkelt.",
  navItems: [
    {
      label: "Meny",
      
    },
    {
      label: "Dashboard",
      href: "/dashboard",
    },
    {
      label: "Nytt Ärende",
      href: "/nytt-arende",
    },
    {
      label: "Ärendelista",
      href: "/arenden",
    },
    
    
  ],
  navMenuItems: [
    {
      label: "Dashboard",
      href: "/dashboard",
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
      label: "Inställningar",
      href: "/installningar",
    },
    {
      label: "Logga ut",
      href: "/auth/logout",
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
