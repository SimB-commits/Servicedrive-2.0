import React, { useState, useEffect } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Spinner
} from "@heroui/react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { ChevronDownIcon, StoreIcon } from "@/components/icons";

interface Store {
  id: number;
  name: string;
}

interface StoreSelectorProps {
  fullWidth?: boolean;
}

const StoreSelector: React.FC<StoreSelectorProps> = ({ fullWidth = false }) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      if (!session) return;
      
      try {
        setLoading(true);
        // I en riktig implementation skulle detta vara ett API-anrop
        // för att hämta alla butiker som användaren har åtkomst till
        
        // Simulerat API-anrop
        setTimeout(() => {
          // Demo-data - i en verklig app hämtas detta från API
          const mockStores = [
            { id: 1, name: "Huvudkontor" },
            { id: 2, name: "Filial Stockholm" },
            { id: 3, name: "Filial Göteborg" }
          ];
          
          setStores(mockStores);
          
          // Sätt den aktuella butiken baserat på session eller första butik som default
          const currentStoreId = session?.user?.storeId || mockStores[0]?.id;
          const currentStore = mockStores.find(store => store.id === currentStoreId) || mockStores[0];
          setSelectedStore(currentStore);
          
          setLoading(false);
        }, 500);
      } catch (error) {
        console.error("Failed to fetch stores:", error);
        setLoading(false);
      }
    };

    fetchStores();
  }, [session]);

  const handleStoreChange = async (storeId: number) => {
    // Hitta vald butik
    const store = stores.find(s => s.id === storeId);
    if (!store) return;
    
    setSelectedStore(store);
    
    // I en verklig implementation skulle vi uppdatera användarens session
    // med det nya storeId via ett API-anrop och sedan uppdatera sidan
    
    // Exempel:
    // await fetch('/api/user/update-store', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ storeId })
    // });
    
    // Ladda om sidan eller bara uppdatera data baserat på den nya butiken
    router.reload();
  };

  if (loading) {
    return (
      <Button
        variant="flat"
        size="sm"
        disabled
        className={fullWidth ? "w-full" : ""}
        startContent={<Spinner size="sm" />}
      >
        Laddar...
      </Button>
    );
  }

  if (!selectedStore || stores.length <= 1) {
    return null; // Visa inte selektorn om det bara finns en butik
  }

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          variant="flat"
          size="sm"
          className={`${fullWidth ? "w-full" : ""} flex items-center gap-1`}
          endContent={<ChevronDownIcon className="text-xs" />}
          startContent={<StoreIcon className="text-primary" />}
        >
          {selectedStore.name}
        </Button>
      </DropdownTrigger>
      <DropdownMenu 
        aria-label="Byt butik"
        onAction={(key) => handleStoreChange(Number(key))}
        selectionMode="single"
        selectedKeys={new Set([selectedStore.id.toString()])}
      >
        {stores.map((store) => (
          <DropdownItem key={store.id.toString()}>
            {store.name}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

export default StoreSelector;