import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Switch,
  Button,
  addToast,
  Divider,
  Select,
  SelectItem,
  Tabs,
  Tab,
  RadioGroup,
  Radio,
  Spinner,
  Checkbox
} from '@heroui/react';

// Importera från vår utils/dashboard.ts fil
import { 
  getDefaultWidgets, 
  getDefaultDisplayOptions, 
  getDefaultDataOptions,
  getWidgetsFromStorage,
  getDisplayOptionsFromStorage,
  getDataOptionsFromStorage,
  saveWidgetsToStorage,
  saveDisplayOptionsToStorage,
  saveDataOptionsToStorage,
  resetAllSettingsToDefault,
  Widget,
  DisplayOptions,
  DataOptions
} from '@/utils/dashboard';

const DashboardSettings = () => {
  // State för widgets som kan visas på dashboard
  const [widgets, setWidgets] = useState<Widget[]>([]);
  
  // State för displayinställningar
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    theme: 'system',
    density: 'comfortable',
    tableRows: 10,
    chartStyle: 'gradient',
    useAnimations: true
  });
  
  // State för datainställningar
  const [dataOptions, setDataOptions] = useState<DataOptions>({
    refreshInterval: 0,
    dataTimespan: 14,
    includeClosedTickets: true,
    calculateAverages: true,
    groupByCategories: true
  });
  
  const [activeTab, setActiveTab] = useState('widgets');
  const [loading, setLoading] = useState(true);
  const [savingChanges, setSavingChanges] = useState(false);

  // Ladda alla inställningar vid komponentmontering
  useEffect(() => {
    const loadAllSettings = () => {
      setLoading(true);
      
      // Ladda widget-inställningar
      try {
        if (typeof window !== 'undefined') {
          const savedWidgets = getWidgetsFromStorage();
          setWidgets(savedWidgets);
        } else {
          setWidgets(getDefaultWidgets());
        }
      } catch (error) {
        console.error('Fel vid inläsning av widget-inställningar:', error);
        setWidgets(getDefaultWidgets());
      }
      
      // Ladda displayinställningar
      try {
        if (typeof window !== 'undefined') {
          const savedDisplayOptions = getDisplayOptionsFromStorage();
          setDisplayOptions(savedDisplayOptions);
        }
      } catch (error) {
        console.error('Fel vid inläsning av displayinställningar:', error);
      }
      
      // Ladda datainställningar
      try {
        if (typeof window !== 'undefined') {
          const savedDataOptions = getDataOptionsFromStorage();
          setDataOptions(savedDataOptions);
        }
      } catch (error) {
        console.error('Fel vid inläsning av datainställningar:', error);
      }
      
      setLoading(false);
    };

    loadAllSettings();
  }, []);
  
  // Funktion för att aktivera/inaktivera widget
  const toggleWidget = (id: string) => {
    const updatedWidgets = widgets.map(widget => 
      widget.id === id 
        ? { ...widget, enabled: !widget.enabled } 
        : widget
    );
    
    setWidgets(updatedWidgets);
    // Notifierar oss när knappen klickas, men sparar inte än
  };

  // Funktion för att uppdatera widgetstorlek
  const updateWidgetSize = (id: string, size: 'small' | 'medium' | 'large') => {
    const updatedWidgets = widgets.map(widget => 
      widget.id === id 
        ? { ...widget, size } 
        : widget
    );
    
    setWidgets(updatedWidgets);
    // Notifierar oss när storleken ändras, men sparar inte än
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
    // Notifierar oss när ordningen ändras, men sparar inte än
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
    // Notifierar oss när ordningen ändras, men sparar inte än
  };

  // Funktion för att spara alla ändringar
  const saveChanges = () => {
    setSavingChanges(true);
    
    try {
      // Spara alla ändringar till localStorage med hjälpfunktionerna
      saveWidgetsToStorage(widgets);
      saveDisplayOptionsToStorage(displayOptions);
      saveDataOptionsToStorage(dataOptions);
      
      // Triggrar custom event för att uppdatera dashboard
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('dashboard-settings-changed'));
      }
      
      // Simulerar en kort laddningstid
      setTimeout(() => {
        setSavingChanges(false);
        
        addToast({
          title: 'Framgång',
          description: 'Dashboard-inställningar sparade',
          color: 'success',
          variant: 'flat'
        });
      }, 600);
    } catch (error) {
      console.error("Fel vid sparande av inställningar:", error);
      setSavingChanges(false);
      
      addToast({
        title: 'Fel',
        description: 'Kunde inte spara inställningar',
        color: 'danger',
        variant: 'flat'
      });
    }
  };

  // Funktion för att återställa till standardinställningar
  const resetToDefaults = () => {
    if (confirm('Är du säker på att du vill återställa alla dashboard-inställningar till standard?')) {
      try {
        resetAllSettingsToDefault();
        
        // Uppdatera lokala states
        setWidgets(getDefaultWidgets());
        setDisplayOptions(getDefaultDisplayOptions());
        setDataOptions(getDefaultDataOptions());
        
        addToast({
          title: 'Framgång',
          description: 'Dashboard-inställningar återställda till standard',
          color: 'success',
          variant: 'flat'
        });
      } catch (error) {
        console.error("Fel vid återställning av inställningar:", error);
        
        addToast({
          title: 'Fel',
          description: 'Kunde inte återställa inställningar',
          color: 'danger',
          variant: 'flat'
        });
      }
    }
  };

  // Hantera ändringar i displayinställningar
  const handleDisplayOptionChange = (key: keyof DisplayOptions, value: any) => {
    setDisplayOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Hantera ändringar i datainställningar
  const handleDataOptionChange = (key: keyof DataOptions, value: any) => {
    setDataOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" color="primary" />
        <span className="ml-4">Laddar inställningar...</span>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Dashboard-inställningar</h2>
        <div className="flex gap-2">
          <Button color="danger" variant="flat" onPress={resetToDefaults}>
            Återställ standard
          </Button>
          <Button 
            color="primary" 
            onPress={saveChanges} 
            isLoading={savingChanges}
          >
            Spara ändringar
          </Button>
        </div>
      </div>
      
      <p className="text-default-500 mb-6">
        Anpassa hur din dashboard fungerar och visas för att få den perfekta överblicken över dina ärenden.
      </p>
      
      <Tabs 
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        variant="underlined"
        color="primary"
        className="mb-6"
      >
        <Tab key="widgets" title="Widgets" />
        <Tab key="appearance" title="Utseende" />
        <Tab key="data" title="Data" />
      </Tabs>
      
      {/* Widgets-tabben */}
      {activeTab === 'widgets' && (
        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-lg font-medium">Widgets och layout</h3>
            <p className="text-default-500 text-sm">
              Välj vilka widgets som ska visas och i vilken ordning. Du kan också ändra storlek på vissa widgets.
            </p>
          </CardHeader>
          <CardBody>
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
                    <div className="flex items-center gap-4">
                      {/* Storleksväljare, endast för vissa widgets som stöder storleksändring */}
                      {['activity_chart', 'performance_chart', 'progress_overview', 'status_distribution'].includes(widget.id) && (
                        <Select
                          size="sm"
                          label="Storlek"
                          labelPlacement="outside-left"
                          className="w-32"
                          selectedKeys={[widget.size || 'medium']}
                          onChange={(e) => updateWidgetSize(widget.id, e.target.value as 'small' | 'medium' | 'large')}
                        >
                          <SelectItem key="small" value="small">Liten</SelectItem>
                          <SelectItem key="medium" value="medium">Medium</SelectItem>
                          <SelectItem key="large" value="large">Stor</SelectItem>
                        </Select>
                      )}
                      
                      {/* Knappar för att flytta upp/ner i ordningen */}
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
                      
                      {/* Toggle för att aktivera/inaktivera widget */}
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
      )}
      
      {/* Utseende-tabben */}
      {activeTab === 'appearance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Generellt utseende</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Tema</h4>
                  <RadioGroup
                    value={displayOptions.theme}
                    onValueChange={(value) => handleDisplayOptionChange('theme', value)}
                  >
                    <Radio value="light">Ljust tema</Radio>
                    <Radio value="dark">Mörkt tema</Radio>
                    <Radio value="system">Följ systeminställning</Radio>
                  </RadioGroup>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Densitet</h4>
                  <RadioGroup
                    value={displayOptions.density}
                    onValueChange={(value) => handleDisplayOptionChange('density', value)}
                  >
                    <Radio value="compact">Kompakt</Radio>
                    <Radio value="comfortable">Standard</Radio>
                    <Radio value="spacious">Luftig</Radio>
                  </RadioGroup>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Animationer</h4>
                  <div className="flex items-center">
                    <Switch
                      isSelected={displayOptions.useAnimations}
                      onValueChange={(checked) => handleDisplayOptionChange('useAnimations', checked)}
                    />
                    <span className="ml-2">
                      {displayOptions.useAnimations ? 'Animationer påslagna' : 'Animationer avstängda'}
                    </span>
                  </div>
                  <p className="text-sm text-default-500 mt-1">
                    Slå av animationer för bättre prestanda på äldre enheter
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Grafik och tabeller</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Diagramstil</h4>
                  <RadioGroup
                    value={displayOptions.chartStyle}
                    onValueChange={(value) => handleDisplayOptionChange('chartStyle', value)}
                  >
                    <Radio value="filled">Fyllda</Radio>
                    <Radio value="gradient">Gradient</Radio>
                    <Radio value="transparent">Transparent</Radio>
                  </RadioGroup>
                  <p className="text-sm text-default-500 mt-1">
                    Välj stil för diagram och grafer på dashboarden
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Antal rader i tabeller</h4>
                  <RadioGroup
                    value={displayOptions.tableRows.toString()}
                    onValueChange={(value) => handleDataOptionChange('tableRows', parseInt(value))}
                  >
                    <Radio value="5">5 rader</Radio>
                    <Radio value="10">10 rader</Radio>
                    <Radio value="15">15 rader</Radio>
                    <Radio value="20">20 rader</Radio>
                  </RadioGroup>
                  <p className="text-sm text-default-500 mt-1">
                    Välj standard antal rader för tabeller på dashboarden
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
      
      {/* Data-tabben */}
      {activeTab === 'data' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Uppdatering och tidsperiod</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Automatisk uppdatering</h4>
                  <RadioGroup
                    value={dataOptions.refreshInterval.toString()}
                    onValueChange={(value) => handleDataOptionChange('refreshInterval', parseInt(value))}
                  >
                    <Radio value="0">Manuell uppdatering</Radio>
                    <Radio value="1">Varje minut</Radio>
                    <Radio value="5">Var 5:e minut</Radio>
                    <Radio value="15">Var 15:e minut</Radio>
                    <Radio value="30">Var 30:e minut</Radio>
                  </RadioGroup>
                  <p className="text-sm text-default-500 mt-1">
                    Välj hur ofta dashboarden ska uppdateras automatiskt
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Tidsperiod för data</h4>
                  <RadioGroup
                    value={dataOptions.dataTimespan.toString()}
                    onValueChange={(value) => handleDataOptionChange('dataTimespan', parseInt(value))}
                  >
                    <Radio value="7">Senaste veckan</Radio>
                    <Radio value="14">Senaste 2 veckorna</Radio>
                    <Radio value="30">Senaste månaden</Radio>
                    <Radio value="90">Senaste 3 månaderna</Radio>
                    <Radio value="180">Senaste 6 månaderna</Radio>
                  </RadioGroup>
                </div>
              </div>
            </CardBody>
          </Card>
          
          <Card>
            <CardHeader>
              <h3 className="text-lg font-medium">Databeräkningar</h3>
            </CardHeader>
            <CardBody>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Datavisningsalternativ</h4>
                  
                  <div className="space-y-2">
                    <Checkbox
                      isSelected={dataOptions.includeClosedTickets}
                      onValueChange={(checked) => handleDataOptionChange('includeClosedTickets', checked)}
                    >
                      Inkludera avslutade ärenden i statistiken
                    </Checkbox>
                    
                    <Checkbox
                      isSelected={dataOptions.calculateAverages}
                      onValueChange={(checked) => handleDataOptionChange('calculateAverages', checked)}
                    >
                      Beräkna genomsnitt (lösningstid, etc.)
                    </Checkbox>
                    
                    <Checkbox
                      isSelected={dataOptions.groupByCategories}
                      onValueChange={(checked) => handleDataOptionChange('groupByCategories', checked)}
                    >
                      Gruppera ärenden efter kategori
                    </Checkbox>
                  </div>
                  
                  <p className="text-sm text-default-500 mt-3">
                    Anpassa databeläkningar och grupperingar för statistikvisningar
                  </p>
                </div>
                
                <Divider />
                
                <div className="px-2 pt-2 pb-4">
                  <h4 className="font-medium mb-4">Dashboardprestanda</h4>
                  
                  <p className="text-sm mb-6">
                    Om du har många ärenden och upplever att dashboarden laddar långsamt, 
                    kan du justera dessa inställningar för att förbättra prestandan.
                  </p>
                  
                  <Button color="primary" variant="flat" fullWidth>
                    Analysera dashboardprestanda
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
};

export default DashboardSettings;