// components/navbar.tsx
import React, { useState, useEffect, useRef } from "react";
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
  Spinner,
  Card,
  Chip,
  Divider
} from "@heroui/react";
import NextLink from "next/link";
import { useSession, signOut } from "next-auth/react";
import clsx from "clsx";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { SearchIcon, Logo, EyeIcon, BellIcon, LogoutIcon } from "@/components/icons";
import MobileMenu from "./MobileMenu";
import StoreSelector from "./StoreSelector";
import { SearchResults } from "@/types/search";
import { debounce } from "lodash";

export const Navbar = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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

  // Check if the current route is active
  const isActive = (href: string) => {
    return router.pathname === href;
  };

  // Handle search query change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchError) {
      setSearchError(null);
    }
    
    if (value.trim().length >= 2) {
      debouncedSearch(value);
    } else {
      setSearchResults(null);
    }
  };

  // Debounced search function to prevent too many API calls
  const debouncedSearch = useRef(
    debounce(async (query: string) => {
      if (query.trim().length < 2) return;
      
      setIsSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
          throw new Error('Sökningen misslyckades');
        }
        
        const data = await response.json();
        setSearchResults(data.results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchError('Ett fel uppstod vid sökningen');
      } finally {
        setIsSearching(false);
      }
    }, 300)
  ).current;

  // Navigate to search page with query
  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedQuery = searchQuery.trim();
    
    if (trimmedQuery.length < 2) {
      setSearchError("Söktermen måste vara minst 2 tecken");
      return;
    }
    
    // Save to recent searches
    saveRecentSearch(trimmedQuery);
    
    // Navigate to full search page
    router.push(`/sok?q=${encodeURIComponent(trimmedQuery)}`);
    setShowSearchBar(false);
    setSearchQuery("");
    setSearchResults(null);
  };
  
  // Save search to recent searches
  const saveRecentSearch = (query: string) => {
    const updatedSearches = [
      query, 
      ...recentSearches.filter(s => s !== query)
    ].slice(0, 5);
    
    setRecentSearches(updatedSearches);
    
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
      }
    } catch (storageError) {
      console.error("Failed to save recent searches:", storageError);
    }
  };
  
  // Handle click on search result
  const handleSelectResult = (url: string, query?: string) => {
    if (query) {
      saveRecentSearch(query);
    }
    
    router.push(url);
    setShowSearchBar(false);
    setSearchQuery("");
    setSearchResults(null);
  };
  
  // Handle selection of recent search
  const handleSelectRecentSearch = (search: string) => {
    setSearchQuery(search);
    debouncedSearch(search);
  };

  // Close search bar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showSearchBar && 
          searchContainerRef.current && 
          !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchBar(false);
        setSearchError(null);
        setSearchResults(null);
        setSearchQuery("");
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSearchBar]);

  // Focus search input when search bar is opened
  useEffect(() => {
    if (showSearchBar && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchBar]);

  // Get customer name or email
  const getCustomerName = (customer: any) => {
    if (!customer) return "-";
    
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
    }
    
    return customer.email || `Kund #${customer.id}`;
  };

  // Render dropdown results
  const renderSearchResults = () => {
    if (!searchResults) return null;
    
    const { customers, tickets, settings } = searchResults;
    const hasCustomers = customers && customers.length > 0;
    const hasTickets = tickets && tickets.length > 0;
    const hasSettings = settings && settings.length > 0;
    const hasResults = hasCustomers || hasTickets || hasSettings;
    
    if (!hasResults) {
      return (
        <div className="p-4 text-center text-default-500">
          Inga resultat hittades
        </div>
      );
    }
    
    return (
      <div className="search-results-container">
        {/* Customers */}
        {hasCustomers && (
          <div className="result-section">
            <div className="px-3 py-2 bg-default-50 flex justify-between items-center">
              <h3 className="text-sm font-medium">Kunder</h3>
              <Chip 
                size="sm" 
                variant="flat"
                color="primary"
              >
                {customers.length}
              </Chip>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              {customers.slice(0, 5).map((customer) => (
                <div 
                  key={`customer-${customer.id}`} 
                  className="p-3 hover:bg-default-100 cursor-pointer border-b border-default-100"
                  onClick={() => handleSelectResult(`/kunder/${customer.id}`, searchQuery)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-sm">{getCustomerName(customer)}</h4>
                      <p className="text-default-500 text-xs">{customer.email}</p>
                      {customer.phoneNumber && (
                        <p className="text-default-500 text-xs">{customer.phoneNumber}</p>
                      )}
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectResult(`/kunder/${customer.id}`, searchQuery);
                      }}
                    >
                      <EyeIcon size={16} />
                    </Button>
                  </div>
                </div>
              ))}
              
              {customers.length > 5 && (
                <div 
                  className="p-2 text-center text-primary text-sm hover:bg-default-100 cursor-pointer"
                  onClick={() => handleSelectResult(`/sok?q=${encodeURIComponent(searchQuery)}&type=customers`, searchQuery)}
                >
                  Visa alla {customers.length} kunder
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Tickets */}
        {hasTickets && (
          <div className="result-section">
            <div className="px-3 py-2 bg-default-50 flex justify-between items-center">
              <h3 className="text-sm font-medium">Ärenden</h3>
              <Chip 
                size="sm" 
                variant="flat"
                color="primary"
              >
                {tickets.length}
              </Chip>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              {tickets.slice(0, 5).map((ticket) => {
                // Get status display
                const statusName = ticket.customStatus 
                  ? ticket.customStatus.name 
                  : ticket.status || '-';
                
                const statusColor = ticket.customStatus 
                  ? ticket.customStatus.color 
                  : '#cccccc';
                
                return (
                  <div 
                    key={`ticket-${ticket.id}`} 
                    className="p-3 hover:bg-default-100 cursor-pointer border-b border-default-100"
                    onClick={() => handleSelectResult(`/arenden/${ticket.id}`, searchQuery)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">#{ticket.id}</h4>
                          <div className="flex items-center">
                            <div 
                              className="w-2 h-2 rounded-full mr-1" 
                              style={{ backgroundColor: statusColor }}
                            />
                            <span className="text-xs">{statusName}</span>
                          </div>
                        </div>
                        {ticket.ticketType && (
                          <p className="text-default-700 text-xs font-medium">
                            {ticket.ticketType.name}
                          </p>
                        )}
                        {ticket.customer && (
                          <p className="text-default-500 text-xs">
                            {getCustomerName(ticket.customer)}
                          </p>
                        )}
                      </div>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectResult(`/arenden/${ticket.id}`, searchQuery);
                        }}
                      >
                        <EyeIcon size={16} />
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {tickets.length > 5 && (
                <div 
                  className="p-2 text-center text-primary text-sm hover:bg-default-100 cursor-pointer"
                  onClick={() => handleSelectResult(`/sok?q=${encodeURIComponent(searchQuery)}&type=tickets`, searchQuery)}
                >
                  Visa alla {tickets.length} ärenden
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Settings */}
        {hasSettings && (
          <div className="result-section">
            <div className="px-3 py-2 bg-default-50 flex justify-between items-center">
              <h3 className="text-sm font-medium">Inställningar</h3>
              <Chip 
                size="sm" 
                variant="flat"
                color="primary"
              >
                {settings.length}
              </Chip>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              {settings.map((setting, index) => (
                <div 
                  key={`setting-${index}`} 
                  className="p-3 hover:bg-default-100 cursor-pointer border-b border-default-100"
                  onClick={() => handleSelectResult(setting.url, searchQuery)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-sm">{setting.name}</h4>
                      <p className="text-default-500 text-xs">{setting.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="p-2 text-center border-t">
          <Button 
            variant="flat" 
            color="primary"
            size="sm"
            onClick={() => handleSelectResult(`/sok?q=${encodeURIComponent(searchQuery)}`, searchQuery)}
          >
            Visa alla resultat
          </Button>
        </div>
      </div>
    );
  };

  // Render recent searches dropdown
  const renderRecentSearches = () => {
    if (recentSearches.length === 0 || searchQuery.trim() !== '') return null;
    
    return (
      <div className="recent-searches-container">
        <div className="px-3 py-2 bg-default-50">
          <h3 className="text-sm font-medium">Senaste sökningar</h3>
        </div>
        
        {recentSearches.map((search, index) => (
          <div 
            key={`recent-search-${index}`}
            className="p-3 hover:bg-default-100 cursor-pointer flex items-center"
            onClick={() => handleSelectRecentSearch(search)}
          >
            <SearchIcon className="w-4 h-4 text-default-400 mr-2" />
            <span className="text-sm">{search}</span>
          </div>
        ))}
      </div>
    );
  };

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
      <NavbarContent className="flex-1 justify-center relative">
        {showSearchBar ? (
          <div className="w-full max-w-xl relative" ref={searchContainerRef}>
            <form onSubmit={handleSubmitSearch}>
              <Input
                ref={searchInputRef}
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
                        setSearchResults(null);
                        setSearchQuery("");
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
              {searchError && (
                <p className="text-danger text-xs mt-1 px-2">{searchError}</p>
              )}

              {/* Dropdown for search results */}
              {(searchResults || (recentSearches.length > 0 && searchQuery.trim() === '')) && (
                <Card className="absolute mt-2 z-50 w-full shadow-xl max-h-[70vh] overflow-hidden">
                  {searchResults ? renderSearchResults() : renderRecentSearches()}
                </Card>
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
                  <DropdownItem 
                    key="logout" 
                    className="text-danger" 
                    color="danger"
                    onPress={async () => {
                      await signOut({ redirect: true, callbackUrl: '/auth/login' });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <LogoutIcon className="w-4 h-4" />
                      Logga ut
                    </div>
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