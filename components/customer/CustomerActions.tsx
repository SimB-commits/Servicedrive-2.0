// components/customer/CustomerActions.tsx
import React from "react";
import { useRouter } from "next/router";
import { Button } from "@heroui/react";
import { DeleteIcon, EditIcon, PrinterIcon } from "@/components/icons";

interface CustomerActionsProps {
  customer: {
    id: number;
    firstName?: string;
    lastName?: string;
  };
  onEdit: () => void;
  onDelete: () => void;
  onPrint: () => void;
}

/**
 * Återanvändbar komponent för kundåtgärder
 */
const CustomerActions: React.FC<CustomerActionsProps> = ({ 
  customer, 
  onEdit, 
  onDelete,
  onPrint 
}) => {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        color="primary"
        variant="flat"
        onPress={onEdit}
        startContent={<EditIcon />}
      >
        Redigera kund
      </Button>
      
      <Button
        variant="flat"
        onPress={onPrint}
        startContent={<PrinterIcon />}
      >
        Skriv ut
      </Button>
      
      <Button
        color="danger"
        variant="flat"
        onPress={onDelete}
        startContent={<DeleteIcon />}
      >
        Ta bort
      </Button>
      
      <Button
        variant="flat"
        onPress={() => router.push(`/nytt-arende?customerId=${customer.id}`)}
      >
        Skapa ärende
      </Button>
      
      <Button
        variant="flat"
        onPress={() => router.push("/kunder")}
      >
        Tillbaka
      </Button>
    </div>
  );
};

export default CustomerActions;