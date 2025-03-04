import React, { useState } from 'react';
import {
  Card,
  CardBody,
  Switch,
  Button,
  addToast,
  Divider
} from '@heroui/react';

// Typer för widgets
interface Widget {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  position: number;
}

const DashboardSettings = () => {
  // State för widgets som kan visas på dashboard
  const [widgets, setWidgets] = useState<Widget[]>([
    {
      id: 'active_tickets',
      name: 'Aktiva ärenden',
      description: 'Visar antal aktiva ärenden per ärendetyp',
      enabled: true,
      position: 1
    },
    {
      id: 'unread_messages',
      name: 'Olästa meddelanden',
      description: 'Visar antal olästa meddelanden från kunder',
      enabled: true,
      position: 2
    },
    {
      id: 'due_this_week',
      name: 'Kommande deadline',
      description: 'Ärenden som ska vara färdiga denna vecka',
      enabled: true,
      position: 3
    },
    {
      id: 'ticket_statistics',
      name: 'Ärendestatistik',
      description: 'Visar statistik över ärenden och genomsnittlig handläggningstid',
      enabled: false,
      position: 4
    },
    {
      id: 'recent_customers',
      name: 'Senaste kunder',
      description: 'Visar de senaste registrerade kunderna',
      enabled: false,
      position: 5
    }
  ]);

  // Funktion för att aktivera/inaktivera widget
  const toggleWidget = (id: string) => {
    setWidgets(
      widgets.map(widget => 
        widget.id === id 
          ? { ...widget, enabled: !widget.enabled } 
          : widget
      )
    );
    
    // I en riktig implementation skulle vi spara ändringarna till databasen här
    
    addToast({
      title: 'Framgång',
      description: 'Dashboard-inställningar uppdaterade',
      color: 'success',
      variant: 'flat'
    });
  };

  // Funktion för att flytta widget upp i ordningen
  const moveWidgetUp = (id: string) => {
    const currentIndex = widgets.findIndex(w => w.id === id);
    if (currentIndex <= 0) return; // Redan högst upp
    
    const newWidgets = [...widgets];
    // Byt plats på denna widget och den ovanför
    [newWidgets[currentIndex - 1], newWidgets[currentIndex]] = 
    [newWidgets[currentIndex], newWidgets[currentIndex - 1]];
    
    // Uppdatera position-värden
    newWidgets.forEach((widget, idx) => {
      widget.position = idx + 1;
    });
    
    setWidgets(newWidgets);
  };

  // Funktion för att flytta widget ner i ordningen
  const moveWidgetDown = (id: string) => {
    const currentIndex = widgets.findIndex(w => w.id === id);
    if (currentIndex >= widgets.length - 1) return; // Redan längst ner
    
    const newWidgets = [...widgets];
    // Byt plats på denna widget och den nedanför
    [newWidgets[currentIndex], newWidgets[currentIndex + 1]] = 
    [newWidgets[currentIndex + 1], newWidgets[currentIndex]];
    
    // Uppdatera position-värden
    newWidgets.forEach((widget, idx) => {
      widget.position = idx + 1;
    });
    
    setWidgets(newWidgets);
  };

  // Funktion för att spara alla ändringar
  const saveChanges = () => {
    // I en riktig implementation skulle vi spara alla ändringar till databasen här
    
    addToast({
      title: 'Framgång',
      description: 'Dashboard-inställningar sparade',
      color: 'success',
      variant: 'flat'
    });
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Dashboard-inställningar</h2>
        <Button color="primary" onPress={saveChanges}>
          Spara ändringar
        </Button>
      </div>
      
      <p className="text-default-500 mb-6">
        Anpassa din dashboard genom att välja vilka widgets som ska visas och i vilken ordning.
      </p>
      
      <Card className="mb-6">
        <CardBody>
          <h3 className="text-lg font-medium mb-4">Widgets</h3>
          
          {widgets
            .sort((a, b) => a.position - b.position)
            .map((widget, index) => (
              <React.Fragment key={widget.id}>
                {index > 0 && <Divider className="my-3" />}
                <div className="flex items-center justify-between py-2">
                  <div className="flex-grow">
                    <p className="font-medium">{widget.name}</p>
                    <p className="text-sm text-default-500">{widget.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <Button 
                        isIconOnly 
                        size="sm" 
                        variant="light"
                        isDisabled={index === 0}
                        onPress={() => moveWidgetUp(widget.id)}
                      >
                        ↑
                      </Button>
                      <Button 
                        isIconOnly 
                        size="sm" 
                        variant="light"
                        isDisabled={index === widgets.length - 1}
                        onPress={() => moveWidgetDown(widget.id)}
                      >
                        ↓
                      </Button>
                    </div>
                    <Switch 
                      isSelected={widget.enabled}
                      onValueChange={() => toggleWidget(widget.id)}
                    />
                  </div>
                </div>
              </React.Fragment>
            ))}
        </CardBody>
      </Card>
      
      <Card>
        <CardBody>
          <h3 className="text-lg font-medium mb-2">Visa antal rader i tabeller</h3>
          <p className="text-default-500 mb-4">
            Välj standardantal rader som ska visas i tabeller på din dashboard.
          </p>
          
          <div className="flex gap-3">
            <Button variant={widgets.length === 5 ? "solid" : "flat"}>5</Button>
            <Button variant={widgets.length === 10 ? "solid" : "flat"}>10</Button>
            <Button variant={widgets.length === 15 ? "solid" : "flat"}>15</Button>
            <Button variant={widgets.length === 20 ? "solid" : "flat"}>20</Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default DashboardSettings;