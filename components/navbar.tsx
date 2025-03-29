// components/navbar.tsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarBrand,
  NavbarItem,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Avatar,
  Input,
  Badge,
  Spinner
} from "@heroui/react";
import NextLink from "next/link";
import { useSession } from "next-auth/react";
import clsx from "clsx";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { SearchIcon, Logo } from "@/components/icons";
import MobileMenu from "./MobileMenu";
import StoreSelector from "./StoreSelector";

// Importera ikoner manuellt då vi inte har uppdaterat icons.tsx ännu
const BellIcon = ({ size = 24, ...props }) => (
  <svg 
    height={size} 
    viewBox="0 0 24 24" 
    width={size} 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const LogoutIcon = ({ size = 24, ...props }) => (
  <svg 
    height={size}
    viewBox="0 0 24 24" 
    width={size} 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const Navbar = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Detect scroll for visual effects
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSearches = localStorage.getItem('recentSearches');
      if (storedSearches) {
        try {
          setRecentSearches(JSON.parse(storedSearches));
        } catch (e) {
          console.error("Failed to parse recent searches:", e);
        }
      }
    }
  }, []);

  // Mock function to fetch notification count
  useEffect(() => {
    // I en verklig app skulle detta vara ett API-anrop
    setNotificationCount(3);
  }, []);

  // Check if the current route is active
  const isActive = (href: string) => {
    return router.pathname === href;
  };

  // Handle search query change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Återställ eventuella felmeddelanden när användaren ändrar söktermen
    if (searchError) {
      setSearchError(null);
    }
  };

  // Navigate to search page with query
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedQuery = searchQuery.trim();
    
    if (trimmedQuery) {
      // Enkel validering
      if (trimmedQuery.length < 2) {
        setSearchError("Söktermen måste vara minst 2 tecken");
        return;
      }
      
      setSearchError(null);
      setIsSearching(true);
      
      try {
        // Spara till senaste sökningar (max 5)
        const updatedSearches = [
          trimmedQuery, 
          ...recentSearches.filter(s => s !== trimmedQuery)
        ].slice(0, 5);
        
        setRecentSearches(updatedSearches);
        
        // Spara till localStorage med felhantering
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
          }
        } catch (storageError) {
          console.error("Failed to save recent searches:", storageError);
          // Fortsätt trots fel med localStorage - det är inte kritiskt
        }
        
        // Navigera till söksidan
        router.push(`/sok?q=${encodeURIComponent(trimmedQuery)}`);
        
        // Stäng sökfältet och återställ söktermen
        setShowSearchBar(false);
        setSearchQuery("");
      } catch (error) {
        console.error("Search error:", error);
        setSearchError("Ett fel inträffade. Försök igen.");
      } finally {
        setIsSearching(false);
      }
    }
  };
  
  // Hantera val av tidigare sökning
  const handleSelectRecentSearch = (search: string) => {
    router.push(`/sok?q=${encodeURIComponent(search)}`);
    setShowSearchBar(false);
    setSearchQuery("");
  };

  // Close search bar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const searchBar = document.getElementById('global-search-bar');
      if (showSearchBar && searchBar && !searchBar.contains(e.target as Node)) {
        setShowSearchBar(false);
        setSearchError(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearchBar]);

  return (
    <HeroUINavbar 
      maxWidth="xl"
      position="sticky"
      className={clsx(
        "transition-all duration-200",
        scrolled ? "shadow-md bg-background/90 backdrop-blur-md py-1" : "py-2"
      )}
      isBordered={!scrolled}
    >
      {/* Left section: Logo and main navigation */}
      <NavbarContent className="gap-10">
        <NavbarBrand>
          <NextLink href="/dashboard" className="flex items-center gap-2">
            <Logo className="text-primary h-10 w-10" />
            <span className="font-bold text-lg text-inherit hidden sm:block">Servicedrive</span>
          </NextLink>
        </NavbarBrand>

        {/* Main navigation - desktop only */}
        <div className="hidden md:flex gap-1">
          {siteConfig.navItems.filter(item => item.href).map((item) => (
            <Button
              key={item.href}
              as={NextLink}
              href={item.href}
              variant={isActive(item.href) ? "flat" : "light"}
              color={isActive(item.href) ? "primary" : "default"}
              className="px-3 font-medium"
              size="sm"
            >
              {item.label}
            </Button>
          ))}
        </div>
      </NavbarContent>

      {/* Center section: Store selector or search bar */}
      <NavbarContent className="flex-1 justify-center">
      {showSearchBar ? (
  <div className="w-full max-w-xl" id="global-search-bar">
    <form onSubmit={handleSearch}>
      <Dropdown isOpen={recentSearches.length > 0 && searchQuery === ""}>
        <DropdownTrigger>
          <Input
            classNames={{
              inputWrapper: "bg-default-100 shadow-sm",
              input: "text-sm"
            }}
            placeholder="Sök efter ärenden, kunder eller inställningar..."
            startContent={<SearchIcon className="text-default-400" />}
            endContent={
              <>
                {isSearching && <Spinner size="sm" className="mr-2" />}
                <Button
                  type="button"
                  size="sm"
                  variant="light"
                  onPress={() => {
                    setShowSearchBar(false);
                    setSearchError(null);
                  }}
                  isDisabled={isSearching}
                >
                  Avbryt
                </Button>
              </>
            }
            autoFocus
            className="w-full"
            value={searchQuery}
            onValueChange={handleSearchChange}
            isDisabled={isSearching}
            isInvalid={!!searchError}
          />
        </DropdownTrigger>
        <DropdownMenu aria-label="Senaste sökningar">
          <DropdownItem key="recent-header" isReadOnly className="opacity-70">
            Senaste sökningar
          </DropdownItem>
          {recentSearches.map((search, index) => (
            <DropdownItem 
              key={`recent-search-${index}`}
              onPress={() => handleSelectRecentSearch(search)}
            >
              <div className="flex items-center gap-2">
                <SearchIcon className="w-4 h-4 text-default-400" />
                {search}
              </div>
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
      {searchError && (
        <p className="text-danger text-xs mt-1 px-2">{searchError}</p>
      )}
    </form>
  </div>
) : (
  <div className="hidden md:flex justify-center">
    <StoreSelector />
  </div>
)}
      </NavbarContent>

      {/* Right section: Actions and user menu */}
      <NavbarContent className="gap-2" justify="end">
        {!showSearchBar && (
          <>
            <NavbarItem>
              <Button
                isIconOnly
                variant="light"
                aria-label="Sök"
                onPress={() => setShowSearchBar(true)}
              >
                <SearchIcon />
              </Button>
            </NavbarItem>
            
            <NavbarItem>
              <ThemeSwitch />
            </NavbarItem>

            <NavbarItem>
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="light" className="p-0">
                    <Avatar
                      name={session?.user?.firstName || "User"}
                      size="sm"
                      color="primary"
                      className="transition-transform"
                    />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Användarmeny">
                  <DropdownItem key="profile" textValue="Profile">
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold">{session?.user?.firstName || "Användare"}</p>
                      <p className="text-xs text-default-500">{session?.user?.email || ""}</p>
                    </div>
                  </DropdownItem>
                  <DropdownItem key="settings">
                    <NextLink href="/installningar" className="block w-full">
                      Inställningar
                    </NextLink>
                  </DropdownItem>
                  <DropdownItem key="analytics">
                    <NextLink href="/statistik" className="block w-full">
                      Statistik
                    </NextLink>
                  </DropdownItem>
                  <DropdownItem key="help">
                    <NextLink href="/hjalp" className="block w-full">
                      Hjälp & support
                    </NextLink>
                  </DropdownItem>
                  <DropdownItem key="logout" className="text-danger" color="danger">
                    <NextLink href="/auth/logout" className="block w-full">
                      <div className="flex items-center gap-2">
                        <LogoutIcon className="w-4 h-4" />
                        Logga ut
                      </div>
                    </NextLink>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </NavbarItem>
          </>
        )}

        {/* Mobile menu button - only visible on small screens */}
        <div className="md:hidden">
          <MobileMenu />
        </div>
      </NavbarContent>
    </HeroUINavbar>
  );
};