// Hantera inställningar och kommunikation mellan komponenter
// utils/dashboard.ts
import { useState, useEffect } from 'react';

// Konstanter för localStorage-nycklar
export const DASHBOARD_SETTINGS_KEY = 'servicedrive_dashboard_settings';
export const DASHBOARD_DISPLAY_OPTIONS_KEY = 'servicedrive_dashboard_display_options';
export const DASHBOARD_DATA_OPTIONS_KEY = 'servicedrive_dashboard_data_options';

// Typer
export interface Widget {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  position: number;
  size?: 'small' | 'medium' | 'large';
}

export interface DisplayOptions {
  theme: 'light' | 'dark' | 'system';
  density: 'comfortable' | 'compact' | 'spacious';
  tableRows: number;
  chartStyle: 'filled' | 'gradient' | 'transparent';
  useAnimations: boolean;
}

export interface DataOptions {
  refreshInterval: number; // I minuter, 0 = ingen auto-refresh
  dataTimespan: number; // Antal dagar som ska visas i grafer
  includeClosedTickets: boolean;
  calculateAverages: boolean;
  groupByCategories: boolean;
}

// Standard widgets
export const getDefaultWidgets = (): Widget[] => {
  return [
    {
      id: 'summary_cards',
      name: 'Sammanfattningskort',
      description: 'Visar snabböversikt med antal ärenden och kunder',
      enabled: true,
      position: 1,
      size: 'medium'
    },
    {
      id: 'activity_chart',
      name: 'Aktivitetsgraf',
      description: 'Visar nya och avslutade ärenden över tid',
      enabled: true,
      position: 2,
      size: 'large'
    },
    {
      id: 'status_distribution',
      name: 'Statusfördelning',
      description: 'Visar fördelningen av ärenden per status',
      enabled: true,
      position: 3,
      size: 'medium'
    },
    {
      id: 'type_distribution',
      name: 'Ärendetypsfördelning',
      description: 'Visar antal ärenden per ärendetyp',
      enabled: true,
      position: 4,
      size: 'medium'
    },
    {
      id: 'performance_chart',
      name: 'Prestandaöversikt',
      description: 'Visar antal färdiga ärenden och genomsnittlig hanteringstid',
      enabled: true,
      position: 5,
      size: 'large'
    },
    {
      id: 'due_this_week',
      name: 'Kommande deadlines',
      description: 'Visar ärenden som ska vara färdiga denna vecka',
      enabled: true,
      position: 6,
      size: 'medium'
    },
    {
      id: 'recent_activity',
      name: 'Senaste aktivitet',
      description: 'Visar de senaste ärendena som skapats',
      enabled: true,
      position: 7,
      size: 'medium'
    },
    {
      id: 'progress_overview',
      name: 'Färdigställda ärenden',
      description: 'Visar en progress bar med totalt avslutade ärenden',
      enabled: true,
      position: 8,
      size: 'large'
    },
    {
      id: 'quick_actions',
      name: 'Snabbåtgärder',
      description: 'Knappar för vanliga åtgärder som att skapa nytt ärende',
      enabled: true,
      position: 9,
      size: 'medium'
    }
  ];
};

// Standard displayOptions
export const getDefaultDisplayOptions = (): DisplayOptions => {
  return {
    theme: 'system',
    density: 'comfortable',
    tableRows: 10,
    chartStyle: 'gradient',
    useAnimations: true
  };
};

// Standard dataOptions
export const getDefaultDataOptions = (): DataOptions => {
  return {
    refreshInterval: 0,
    dataTimespan: 14,
    includeClosedTickets: true,
    calculateAverages: true,
    groupByCategories: true
  };
};

// Funktion för att läsa widgets från localStorage
export const getWidgetsFromStorage = (): Widget[] => {
  if (typeof window === 'undefined') {
    return getDefaultWidgets();
  }
  
  try {
    const json = localStorage.getItem(DASHBOARD_SETTINGS_KEY);
    if (json) {
      return JSON.parse(json);
    }
  } catch (error) {
    console.error('Fel vid läsning av widgets från localStorage:', error);
  }
  return getDefaultWidgets();
};

// Funktion för att läsa displayOptions från localStorage
export const getDisplayOptionsFromStorage = (): DisplayOptions => {
  if (typeof window === 'undefined') {
    return getDefaultDisplayOptions();
  }
  
  try {
    const json = localStorage.getItem(DASHBOARD_DISPLAY_OPTIONS_KEY);
    if (json) {
      return JSON.parse(json);
    }
  } catch (error) {
    console.error('Fel vid läsning av displayOptions från localStorage:', error);
  }
  return getDefaultDisplayOptions();
};

// Funktion för att läsa dataOptions från localStorage
export const getDataOptionsFromStorage = (): DataOptions => {
  if (typeof window === 'undefined') {
    return getDefaultDataOptions();
  }
  
  try {
    const json = localStorage.getItem(DASHBOARD_DATA_OPTIONS_KEY);
    if (json) {
      return JSON.parse(json);
    }
  } catch (error) {
    console.error('Fel vid läsning av dataOptions från localStorage:', error);
  }
  return getDefaultDataOptions();
};

// Funktion för att spara widgets till localStorage och trigga en uppdatering
export const saveWidgetsToStorage = (widgets: Widget[]): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(DASHBOARD_SETTINGS_KEY, JSON.stringify(widgets));
    // Trigga en custom event som dashboard-komponenten kan lyssna på
    window.dispatchEvent(new Event('dashboard-settings-changed'));
  } catch (error) {
    console.error('Fel vid sparande av widgets till localStorage:', error);
  }
};

// Funktion för att spara displayOptions till localStorage och trigga en uppdatering
export const saveDisplayOptionsToStorage = (options: DisplayOptions): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(DASHBOARD_DISPLAY_OPTIONS_KEY, JSON.stringify(options));
    // Trigga en custom event som dashboard-komponenten kan lyssna på
    window.dispatchEvent(new Event('dashboard-settings-changed'));
  } catch (error) {
    console.error('Fel vid sparande av displayOptions till localStorage:', error);
  }
};

// Funktion för att spara dataOptions till localStorage och trigga en uppdatering
export const saveDataOptionsToStorage = (options: DataOptions): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(DASHBOARD_DATA_OPTIONS_KEY, JSON.stringify(options));
    // Trigga en custom event som dashboard-komponenten kan lyssna på
    window.dispatchEvent(new Event('dashboard-settings-changed'));
  } catch (error) {
    console.error('Fel vid sparande av dataOptions till localStorage:', error);
  }
};

// Funktion för att återställa alla inställningar till standard
export const resetAllSettingsToDefault = (): void => {
  try {
    saveWidgetsToStorage(getDefaultWidgets());
    saveDisplayOptionsToStorage(getDefaultDisplayOptions());
    saveDataOptionsToStorage(getDefaultDataOptions());
  } catch (error) {
    console.error('Fel vid återställning av inställningar:', error);
  }
};

// Funktion för att få aktiverade widgets i rätt ordning
export const getEnabledWidgets = (): Widget[] => {
  const widgets = getWidgetsFromStorage();
  return widgets
    .filter(widget => widget.enabled)
    .sort((a, b) => a.position - b.position);
};

// Funktion för att få storlek för en specifik widget
export const getWidgetSize = (widgets: Widget[], widgetId: string): string => {
  const widget = widgets.find(w => w.id === widgetId);
  if (!widget || !widget.size) return 'lg:col-span-6';
  
  switch (widget.size) {
    case 'small':
      return 'lg:col-span-4';
    case 'large':
      return 'lg:col-span-8';
    case 'medium':
    default:
      return 'lg:col-span-6';
  }
};

// Funktion för att få visuella egenskaper baserat på displayOptions
export const getChartStyle = (displayOptions: DisplayOptions) => {
  switch (displayOptions.chartStyle) {
    case 'filled':
      return { opacity: 1, strokeWidth: 2 };
    case 'gradient':
      return { opacity: 0.8, strokeWidth: 2 };
    case 'transparent':
      return { opacity: 0.6, strokeWidth: 1.5 };
    default:
      return { opacity: 0.8, strokeWidth: 2 };
  }
};

// Hook för att använda dashboard-inställningar i komponenter
export const useDashboardSettings = () => {
  const [widgets, setWidgets] = useState<Widget[]>(getWidgetsFromStorage());
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(getDisplayOptionsFromStorage());
  const [dataOptions, setDataOptions] = useState<DataOptions>(getDataOptionsFromStorage());
  
  // Uppdatera states när localStorage ändras
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleSettingsChange = () => {
      setWidgets(getWidgetsFromStorage());
      setDisplayOptions(getDisplayOptionsFromStorage());
      setDataOptions(getDataOptionsFromStorage());
    };
    
    // Lägg till eventlistener för vår custom event
    window.addEventListener('dashboard-settings-changed', handleSettingsChange);
    
    // Och standardeventet för localStorage-ändringar
    window.addEventListener('storage', (event) => {
      if (
        event.key === DASHBOARD_SETTINGS_KEY ||
        event.key === DASHBOARD_DISPLAY_OPTIONS_KEY ||
        event.key === DASHBOARD_DATA_OPTIONS_KEY
      ) {
        handleSettingsChange();
      }
    });
    
    return () => {
      window.removeEventListener('dashboard-settings-changed', handleSettingsChange);
      window.removeEventListener('storage', handleSettingsChange);
    };
  }, []);
  
  return {
    widgets,
    enabledWidgets: widgets.filter(w => w.enabled).sort((a, b) => a.position - b.position),
    displayOptions,
    dataOptions,
    saveWidgets: saveWidgetsToStorage,
    saveDisplayOptions: saveDisplayOptionsToStorage,
    saveDataOptions: saveDataOptionsToStorage,
    resetToDefaults: resetAllSettingsToDefault,
    getWidgetSize: (widgetId: string) => getWidgetSize(widgets, widgetId),
    chartStyle: getChartStyle(displayOptions),
  };
};