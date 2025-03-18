// components/StoreSelector.tsx
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
  company?: string;
}

interface StoreSelectorProps {
  fullWidth?: boolean;
}

const StoreSelector: React.FC<StoreSelectorProps> = ({ fullWidth = false }) => {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStores = async () => {
      if (!session) return;
      
      try {
        setLoading(true);
        const res = await fetch('/api/stores');
        
        if (res.ok) {
          const data = await res.json();
          setStores(data);
          
          // Sätt den aktuella butiken baserat på session
          const currentStoreId = session?.user?.storeId;
          const currentStore = data.find(store => store.id === currentStoreId) || data[0];
          setSelectedStore(currentStore);
        } else {
          console.error("Failed to fetch stores:", await res.text());
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching stores:", error);
        setLoading(false);
      }
    };

    fetchStores();
  }, [session]);

  const handleStoreChange = async (storeId: number) => {
    // Hitta vald butik
    const store = stores.find(s => s.id === storeId);
    if (!store) return;
    
    setLoading(true);
    
    try {
      // Anropa API för att byta aktiv butik
      const res = await fetch('/api/stores/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storeId }),
      });

      if (res.ok) {
        // Uppdatera session med nytt storeId
        await update({ storeId });
        
        // Visuellt uppdatera vald butik
        setSelectedStore(store);
        
        // Force-omladda sidan för att alla komponenter ska uppdateras med data från den nya butiken
        router.reload();
      } else {
        const data = await res.json();
        console.error("Failed to switch store:", data);
      }
    } catch (error) {
      console.error("Error switching store:", error);
    } finally {
      setLoading(false);
    }
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

  // Dölj helt om det inte finns några butiker eller bara finns en butik
  if (!selectedStore || stores.length <= 1) {
    return (
      <Button
        variant="flat" 
        size="sm"
        disabled
        className={fullWidth ? "w-full opacity-70" : "opacity-70"}
        startContent={<StoreIcon className="text-primary" />}
      >
        {selectedStore?.name || "Ingen butik vald"}
      </Button>
    );
  }

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          variant="flat"
          size="sm"
          className={`${fullWidth ? "w-full justify-between" : ""} flex items-center gap-1`}
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