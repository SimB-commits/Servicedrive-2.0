// components/email/TemplateSettings.tsx
import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardBody, 
  Select, 
  SelectItem,
  Button, 
  addToast, 
  Spinner, 
  Divider,
  Accordion,
  AccordionItem
} from '@heroui/react';
import MailTemplateTest from './MailTemplateTest';

interface MailTemplate {
  id: number;
  name: string;
  subject: string;
}

// Definiera MailTemplateUsage typen för att matcha typen i Prisma Schema
// Ta bort STATUS_UPDATE från listan över tillgängliga val
type MailTemplateUsage = 'NEW_TICKET' | 'MANUAL' | 'REMINDER' | 'FOLLOW_UP';

// Mappa MailTemplateUsage till användarvänliga namn
const usageLabels: Record<MailTemplateUsage, string> = {
  NEW_TICKET: 'Bekräftelsemail vid nya ärenden',
  MANUAL: 'Manuella utskick',
  REMINDER: 'Påminnelsemail',
  FOLLOW_UP: 'Uppföljningsmail'
};

// Mappa MailTemplateUsage till beskrivningar
const usageDescriptions: Record<MailTemplateUsage, string> = {
  NEW_TICKET: 'Denna mall används automatiskt för att skicka ett bekräftelsemail när ett nytt ärende skapas.',
  MANUAL: 'Denna mall används som förval vid manuella mailutskick.',
  REMINDER: 'Denna mall används för automatiska påminnelser om ärenden som närmar sig deadline.',
  FOLLOW_UP: 'Denna mall används för automatiska uppföljningsmail efter att ett ärende har stängts.'
};

interface TemplateSettingsProps {
  onSettingsUpdated?: () => void;
}

const TemplateSettings: React.FC<TemplateSettingsProps> = ({ onSettingsUpdated }) => {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Record<string, string | null>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItemKey, setExpandedItemKey] = useState<string | null>("general");

  // Hämta alla mailmallar
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/mail/templates');
        if (res.ok) {
          const data = await res.json();
          setTemplates(data);
        } else {
          console.error('Kunde inte hämta mailmallar');
          addToast({
            title: 'Fel',
            description: 'Kunde inte hämta mailmallar',
            color: 'danger',
            variant: 'flat'
          });
        }
      } catch (error) {
        console.error('Fel vid hämtning av mailmallar:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // Hämta nuvarande inställningar
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoadingSettings(true);
        setError(null);
        const res = await fetch('/api/mail/template-settings');
        if (res.ok) {
          const data = await res.json();
          
          // Ta bort STATUS_UPDATE från data om den finns
          const { STATUS_UPDATE, ...filteredData } = data;
          setSettings(filteredData);
          
          // Sätt valda mallar baserat på filtrerade inställningar
          const initialSelectedIds: Record<string, string | null> = {};
          Object.entries(filteredData).forEach(([usage, setting]) => {
            const typedSetting = setting as { templateId: number | null };
            initialSelectedIds[usage] = typedSetting.templateId ? typedSetting.templateId.toString() : null;
          });
          setSelectedTemplateIds(initialSelectedIds);
          setHasChanges(false);
        } else {
          console.error('Kunde inte hämta mallinställningar');
          const errorData = await res.json();
          setError(errorData.error || 'Kunde inte hämta inställningar');
        }
      } catch (error) {
        console.error('Fel vid hämtning av mallinställningar:', error);
        setError('Ett oväntat fel inträffade vid hämtning av inställningar');
      } finally {
        setLoadingSettings(false);
      }
    };

    fetchSettings();
  }, []);

  // Uppdatera hasChanges när selectedTemplateIds ändras
  useEffect(() => {
    // Kontrollera om nuvarande val skiljer sig från inställningarna
    let changed = false;
    
    Object.entries(selectedTemplateIds).forEach(([usage, selectedId]) => {
      const currentSetting = settings[usage];
      const currentId = currentSetting?.templateId;
      
      // Konvertera till nummer om inte null eller tom sträng
      const selectedIdNum = selectedId && selectedId !== "" ? Number(selectedId) : null;
      
      if (selectedIdNum !== currentId) {
        changed = true;
      }
    });
    
    setHasChanges(changed);
  }, [selectedTemplateIds, settings]);

  const handleTemplateChange = (usage: string, templateId: string | undefined) => {
    setSelectedTemplateIds(prev => ({
      ...prev,
      [usage]: templateId || null
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Samla ändringar
      const changedSettings = [];
      Object.entries(selectedTemplateIds).forEach(([usage, selectedId]) => {
        const currentSetting = settings[usage];
        const currentId = currentSetting?.templateId;
        
        // Säkerställ att tom sträng blir null
        const selectedIdNum = selectedId && selectedId !== "" ? Number(selectedId) : null;
        
        if (selectedIdNum !== currentId) {
          changedSettings.push({
            usage, 
            templateId: selectedIdNum
          });
        }
      });
      
      // Spara varje ändrad inställning
      const results = [];
      const updatedSettings = { ...settings };
      
      for (const setting of changedSettings) {
        try {
          const res = await fetch('/api/mail/template-settings', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(setting)
          });
          
          if (res.ok) {
            const data = await res.json();
            results.push({ success: true, data });
            updatedSettings[setting.usage] = data.setting;
          } else {
            const errorData = await res.json();
            results.push({ 
              success: false, 
              error: errorData.error || 'Kunde inte spara inställning'
            });
          }
        } catch (error) {
          console.error(`Fel vid sparande av inställning för ${setting.usage}:`, error);
          results.push({ 
            success: false, 
            error: 'Ett oväntat fel inträffade'
          });
        }
      }
      
      // Kontrollera alla resultat
      const allSuccessful = results.every(r => r.success);
      const failedSettings = results.filter(r => !r.success);
      
      if (allSuccessful) {
        addToast({
          title: 'Inställningar sparade',
          description: 'Mallinställningar har uppdaterats',
          color: 'success',
          variant: 'flat'
        });
        
        setSettings(updatedSettings);
        setHasChanges(false);
        
        // Meddela parent-komponenten om uppdatering
        if (onSettingsUpdated) {
          onSettingsUpdated();
        }
      } else {
        // Om någon request misslyckades
        const errorMessage = failedSettings.map(r => r.error).join(', ');
        setError(`Kunde inte spara alla inställningar: ${errorMessage}`);
        
        addToast({
          title: 'Fel',
          description: 'Kunde inte spara alla inställningar. Se felmeddelande för detaljer.',
          color: 'danger',
          variant: 'flat'
        });
      }
    } catch (error) {
      console.error('Fel vid sparande av inställningar:', error);
      setError('Ett oväntat fel inträffade vid sparande av inställningarna');
      
      addToast({
        title: 'Fel',
        description: 'Ett fel inträffade vid sparande av inställningarna',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSaving(false);
    }
  };

  // Rendera inställningar för de mest relevanta användningsområdena först
  const prioritizedUsages: MailTemplateUsage[] = ['NEW_TICKET'];
  const secondaryUsages: MailTemplateUsage[] = ['FOLLOW_UP', 'REMINDER', 'MANUAL'];
  
  if (loading || loadingSettings) {
    return (
      <Card>
        <CardBody className="flex justify-center items-center py-8">
          <Spinner size="md" />
          <p className="ml-3">Laddar inställningar...</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Mallinställningar för automatiska mail</h2>
      </CardHeader>
      <CardBody>
        {error && (
          <div className="bg-danger-50 border border-danger-200 text-danger p-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <Accordion 
          selectedKeys={expandedItemKey ? [expandedItemKey] : []}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys as Set<string>);
            setExpandedItemKey(selected.length > 0 ? selected[0] : null);
          }}
        >
          <AccordionItem 
            key="general" 
            title={
              <h3 className="text-md font-medium">Generella mailmallar</h3>
            }
            subtitle="Ställ in standardmallar för de vanligaste funktionerna"
          >
            <div className="space-y-6 mt-2">
              {prioritizedUsages.map(usage => (
                <div key={usage} className="border-b pb-4">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {usageLabels[usage] || usage}
                      </label>
                      <p className="text-xs text-default-500 mb-3">
                        {usageDescriptions[usage]}
                      </p>
                    </div>
                    
                    {selectedTemplateIds[usage] && (
                      <MailTemplateTest 
                        templateId={Number(selectedTemplateIds[usage])}
                        buttonText="Testa"
                        buttonSize="sm"
                      />
                    )}
                  </div>
                  
                  <Select
                    placeholder={`Välj mall för ${usageLabels[usage].toLowerCase()}`}
                    selectedKeys={selectedTemplateIds[usage] ? [selectedTemplateIds[usage] as string] : []}
                    onChange={e => handleTemplateChange(usage, e.target.value)}
                    className="max-w-md"
                  >
                    <SelectItem key="" value="">Ingen standardmall</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id.toString()} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </AccordionItem>
          
          {/* <AccordionItem 
            key="advanced" 
            title={
              <h3 className="text-md font-medium">Avancerade mailmallar</h3>
            }
            subtitle="Ställ in mallar för periodiska och automatiserade utskick"
          >
            <div className="space-y-6 mt-2">
              {secondaryUsages.map(usage => (
                <div key={usage} className="border-b pb-4 last:border-b-0">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        {usageLabels[usage] || usage}
                      </label>
                      <p className="text-xs text-default-500 mb-3">
                        {usageDescriptions[usage]}
                      </p>
                    </div>
                    
                    {selectedTemplateIds[usage] && (
                      <MailTemplateTest 
                        templateId={Number(selectedTemplateIds[usage])}
                        buttonText="Testa"
                        buttonSize="sm"
                      />
                    )}
                  </div>
                  
                  <Select
                    placeholder={`Välj mall för ${usageLabels[usage].toLowerCase()}`}
                    selectedKeys={selectedTemplateIds[usage] ? [selectedTemplateIds[usage] as string] : []}
                    onChange={e => handleTemplateChange(usage, e.target.value)}
                    className="max-w-md"
                  >
                    <SelectItem key="" value="">Ingen standardmall</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id.toString()} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </AccordionItem> */}
          
          
        </Accordion>

        <div className="flex justify-end mt-6">
          <Button 
            color="primary" 
            onPress={handleSaveSettings} 
            isLoading={saving}
            isDisabled={saving || !hasChanges}
          >
            Spara inställningar
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};

export default TemplateSettings;