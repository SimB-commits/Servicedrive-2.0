// components/customer/CustomerInfo.tsx
import React from "react";
import { Card, CardBody, CardHeader, Divider } from "@heroui/react";

interface CustomerInfoProps {
  customer: {
    id: number;
    firstName?: string;
    lastName?: string;
    email: string;
    phoneNumber?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    country?: string;
    dateOfBirth?: string;
    newsletter: boolean;
    loyal: boolean;
    dynamicFields?: { [key: string]: any };
    createdAt: string;
  };
}

/**
 * Återanvändbar komponent för att visa kundinformation
 */
const CustomerInfo: React.FC<CustomerInfoProps> = ({ customer }) => {
  // Formatera datum
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("sv-SE");
    } catch (e) {
      return "-";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="px-6 py-4">
        <h2 className="text-lg font-medium">Kundinformation</h2>
      </CardHeader>
      
      <CardBody className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Grundläggande information */}
          <div className="space-y-4">
            <div>
              <h3 className="text-md font-medium mb-3">Kontaktuppgifter</h3>
              <div className="space-y-2">
                <div className="flex flex-col md:flex-row">
                  <span className="text-default-500 md:w-32 font-medium">Namn:</span>
                  <span>
                    {customer.firstName || customer.lastName
                      ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim()
                      : "-"}
                  </span>
                </div>
                
                <div className="flex flex-col md:flex-row">
                  <span className="text-default-500 md:w-32 font-medium">E-post:</span>
                  <span>{customer.email || "-"}</span>
                </div>
                
                <div className="flex flex-col md:flex-row">
                  <span className="text-default-500 md:w-32 font-medium">Telefon:</span>
                  <span>{customer.phoneNumber || "-"}</span>
                </div>
              </div>
            </div>
            
            <Divider />
            
            <div>
              <h3 className="text-md font-medium mb-3">Adress</h3>
              <div className="space-y-2">
                <div className="flex flex-col md:flex-row">
                  <span className="text-default-500 md:w-32 font-medium">Adress:</span>
                  <span>{customer.address || "-"}</span>
                </div>
                
                <div className="flex flex-col md:flex-row">
                  <span className="text-default-500 md:w-32 font-medium">Postnummer:</span>
                  <span>{customer.postalCode || "-"}</span>
                </div>
                
                <div className="flex flex-col md:flex-row">
                  <span className="text-default-500 md:w-32 font-medium">Ort:</span>
                  <span>{customer.city || "-"}</span>
                </div>
                
                <div className="flex flex-col md:flex-row">
                  <span className="text-default-500 md:w-32 font-medium">Land:</span>
                  <span>{customer.country || "-"}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Övrigt information */}
          <div className="space-y-4">
            <div>
              <h3 className="text-md font-medium mb-3">Övrig information</h3>
              <div className="space-y-2">
                <div className="flex flex-col md:flex-row">
                  <span className="text-default-500 md:w-32 font-medium">Födelsedatum:</span>
                  <span>{formatDate(customer.dateOfBirth)}</span>
                </div>
                
                <div className="flex flex-col md:flex-row">
                  <span className="text-default-500 md:w-32 font-medium">Nyhetsbrev:</span>
                  <span>{customer.newsletter ? "Ja" : "Nej"}</span>
                </div>
                
                <div className="flex flex-col md:flex-row">
                  <span className="text-default-500 md:w-32 font-medium">Stamkund:</span>
                  <span>
                    {customer.loyal ? (
                      <span className="text-success font-medium">Ja</span>
                    ) : (
                      <span>Nej</span>
                    )}
                  </span>
                </div>
                
                <div className="flex flex-col md:flex-row">
                  <span className="text-default-500 md:w-32 font-medium">Kund sedan:</span>
                  <span>{formatDate(customer.createdAt)}</span>
                </div>
              </div>
            </div>
            
            {/* Visa dynamiska fält om de finns */}
            {customer.dynamicFields && Object.keys(customer.dynamicFields).length > 0 && (
              <>
                <Divider />
                
                <div>
                  <h3 className="text-md font-medium mb-3">Anpassade fält</h3>
                  <div className="space-y-2">
                    {Object.entries(customer.dynamicFields).map(([key, value]) => (
                      <div key={key} className="flex flex-col md:flex-row">
                        <span className="text-default-500 md:w-32 font-medium">{key}:</span>
                        <span>{value !== null && value !== undefined ? String(value) : "-"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default CustomerInfo;