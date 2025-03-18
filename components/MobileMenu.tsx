import React, { useState } from "react";
import { useRouter } from "next/router";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider
} from "@heroui/react";
import NextLink from "next/link";
import { useSession, signOut } from "next-auth/react";

import { siteConfig } from "@/config/site";
import { MenuIcon, CloseIcon, LogoutIcon } from "@/components/icons";
import StoreSelector from "./StoreSelector";

const MobileMenu = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleNavigation = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await signOut({ redirect: true, callbackUrl: '/auth/login' });
  };

  const isActive = (href: string) => {
    return router.pathname === href;
  };

  return (
    <>
      <Button
        isIconOnly
        variant="light"
        aria-label="Meny"
        onPress={() => setIsOpen(true)}
      >
        <MenuIcon className="w-6 h-6" />
      </Button>
      
      <Modal 
        isOpen={isOpen} 
        onOpenChange={setIsOpen}
        placement="top"
        scrollBehavior="inside"
        size="full"
        hideCloseButton
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex justify-between items-center">
                <span className="text-lg font-bold">Meny</span>
                <Button
                  isIconOnly
                  variant="light"
                  aria-label="Stäng meny"
                  onPress={onClose}
                >
                  <CloseIcon className="w-5 h-5" />
                </Button>
              </ModalHeader>
              
              <ModalBody className="p-0">
                {/* StoreSelector tydligt synlig i mobilmenyn */}
                <div className="px-4 py-3 bg-default-50">
                  <p className="text-small text-default-500 font-medium mb-2">Aktiv butik</p>
                  <StoreSelector fullWidth />
                </div>
                
                <Divider className="my-2" />
                
                <div className="flex flex-col space-y-1">
                  {siteConfig.navItems.filter(item => item.href).map((item) => (
                    <Button
                      key={item.href}
                      className={`justify-start rounded-none px-4 py-6 ${isActive(item.href) ? 'bg-primary-50 text-primary border-l-4 border-primary' : ''}`}
                      variant="light"
                      size="lg"
                      onPress={() => router.push(item.href)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
                
                <Divider className="my-2" />
                
                <div className="px-4 py-2">
                  <p className="text-small text-default-500 font-medium mb-2">Inställningar</p>
                  <div className="flex flex-col space-y-1">
                    {siteConfig.navMenuItems
                      .filter(item => !siteConfig.navItems.some(navItem => navItem.href === item.href))
                      .map((item) => (
                        <Button
                          key={item.href}
                          className={`justify-start rounded-none px-4 py-3 ${isActive(item.href) ? 'bg-primary-50 text-primary' : ''}`}
                          variant="light"
                          size="sm"
                          onPress={() => router.push(item.href)}
                        >
                          {item.label}
                        </Button>
                      ))}
                  </div>
                </div>
              </ModalBody>
              
              <ModalFooter className="border-t">
                {session ? (
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-medium">{session.user?.firstName || 'Användare'}</p>
                        <p className="text-xs text-default-500">{session.user?.email || ''}</p>
                      </div>
                    </div>
                    <Button 
                      color="danger" 
                      variant="flat" 
                      startContent={<LogoutIcon />}
                      className="w-full"
                      onPress={handleLogout}
                    >
                      Logga ut
                    </Button>
                  </div>
                ) : (
                  <Button 
                    as={NextLink} 
                    href="/auth/login" 
                    color="primary"
                    className="w-full"
                  >
                    Logga in
                  </Button>
                )}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default MobileMenu;