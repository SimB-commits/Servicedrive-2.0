import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarMenu,
  NavbarMenuToggle,
  NavbarBrand,
  NavbarItem,
  NavbarMenuItem,
  Link,
  Button,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem
} from "@heroui/react";
import { Kbd } from "@heroui/kbd";
import { link as linkStyles } from "@heroui/theme";
import NextLink from "next/link";
import clsx from "clsx";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { SearchIcon, Logo, ChevronDown } from "@/components/icons";

export const Navbar = () => {
  const searchInput = (
    <Input
      aria-label="Search"
      classNames={{
        inputWrapper: "bg-default-100",
        input: "text-sm",
      }}
      labelPlacement="outside"
      placeholder="Search..."
      startContent={
        <SearchIcon className="text-base text-default-400 pointer-events-none flex-shrink-0" />
      }
      type="search"
    />
  );

  return (
    <HeroUINavbar maxWidth="md" position="sticky" isBordered>
      <NavbarContent className="basis-1/5 sm:basis-full" justify="center">
        <NavbarBrand className="gap-3 max-w-fit">
          <NextLink className="flex justify-center items-center gap-1" href="/">
            <Logo />
            <p className="font-bold text-inherit">Servicedrive</p>
          </NextLink>
        </NavbarBrand>
        <div className="hidden lg:flex gap-4 justify-center">
          {siteConfig.navItems.map((item, index) => {
            if (index === 0) {
              return (
                <Dropdown key={item.href}>
                  <DropdownTrigger>
                    <NavbarItem>
                      <button
                        type="button"
                        className={clsx(
                          linkStyles({ color: "foreground" }),
                          "data-[active=true]:text-primary data-[active=true]:font-medium"
                        )}
                      >
                        <span className="flex items-center">
                          {item.label}
                          <ChevronDown className="ml-1 text-xs" />
                        </span>
                      </button>
                    </NavbarItem>
                  </DropdownTrigger>
                  <DropdownMenu>
                    {siteConfig.navMenuItems.map((dropdownItem) => (
                      <DropdownItem key={dropdownItem.href}>
                        <NextLink
                          className={clsx(
                            linkStyles({ color: "foreground" }),
                            "data-[active=true]:text-primary data-[active=true]:font-medium"
                          )}
                          color="foreground"
                          href={dropdownItem.href}
                        >
                          {dropdownItem.label}
                        </NextLink>
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              );
            }
            return (
              <NavbarItem key={item.href}>
                <NextLink
                  className={clsx(
                    linkStyles({ color: "foreground" }),
                    "data-[active=true]:text-primary data-[active=true]:font-medium"
                  )}
                  color="foreground"
                  href={item.href}
                >
                  {item.label}
                </NextLink>
              </NavbarItem>
            );
          })}
        </div>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex basis-1/5 sm:basis-full" justify="center">
        <NavbarItem className="hidden lg:flex">{searchInput}</NavbarItem>
      </NavbarContent>

      <NavbarContent className="sm:hidden basis-1 pl-4" justify="end">
        <NavbarMenuToggle />
      </NavbarContent>

      <NavbarMenu>
        {searchInput}
        <div className="mx-4 mt-2 flex flex-col gap-2">
          {siteConfig.navMenuItems.map((item, index) => (
            <NavbarMenuItem key={`${item}-${index}`}>
              <Link
                color={
                  index === 2
                    ? "primary"
                    : index === siteConfig.navMenuItems.length - 1
                      ? "danger"
                      : "foreground"
                }
                href="#"
                size="lg"
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
        </div>
      </NavbarMenu>
    </HeroUINavbar>
  );
};

