import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Form,
  Tabs,
  Tab,
  Divider,
  addToast,
  Popover,
  PopoverTrigger,
  PopoverContent
} from '@heroui/react';

// Editor-komponenter
const EditorToolbar = ({ onInsertVariable, onFormat }) => {
  const [showVariableMenu, setShowVariableMenu] = useState(false);
  
  return (
    <div className="flex flex-wrap gap-2 p-2 bg-default-100 border border-default-200 rounded mb-2">
      {/* Textformatering */}
      <div className="flex gap-1">
        <button 
          type="button"
          onClick={() => onFormat('bold')}
          className="p-1 rounded hover:bg-default-200"
          title="Fet text"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 12a4 4 0 0 0 0-8H6v8"/><path d="M15 20a4 4 0 0 0 0-8H6v8Z"/></svg>
        </button>
        <button 
          type="button"
          onClick={() => onFormat('italic')}
          className="p-1 rounded hover:bg-default-200"
          title="Kursiv text"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
        </button>
        <button 
          type="button"
          onClick={() => onFormat('underline')}
          className="p-1 rounded hover:bg-default-200"
          title="Understruken text"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/></svg>
        </button>
      </div>
      
      <Divider orientation="vertical" className="h-6" />
      
      {/* Paragraf och listor */}
      <div className="flex gap-1">
        <button 
          type="button"
          onClick={() => onFormat('h2')}
          className="p-1 rounded hover:bg-default-200"
          title="Rubrik"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3 4"/><path d="m20 12-3 4"/><path d="M20 18V6"/></svg>
        </button>
        <button 
          type="button"
          onClick={() => onFormat('p')}
          className="p-1 rounded hover:bg-default-200"
          title="Paragraf"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2.5"/><path d="M12 13v7"/><path d="m9 16 3-3 3 3"/></svg>
        </button>
        <button 
          type="button"
          onClick={() => onFormat('ul')}
          className="p-1 rounded hover:bg-default-200"
          title="Punktlista"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
        </button>
        <button 
          type="button"
          onClick={() => onFormat('ol')}
          className="p-1 rounded hover:bg-default-200"
          title="Numrerad lista"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
        </button>
      </div>
      
      <Divider orientation="vertical" className="h-6" />
      
      {/* Variabler */}
      <Popover placement="bottom" showArrow={true}>
        <PopoverTrigger>
          <button 
            type="button"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-default-200"
            title="Infoga variabel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2H3v16h5v4l4-4h5l4-4V2z"/><path d="M10 8h4"/><path d="M10 12h4"/><path d="M10 16h4"/></svg>
            <span>Variabel</span>
          </button>
        </PopoverTrigger>
        <PopoverContent>
          <div className="p-2 w-64">
            <div className="font-medium text-sm mb-2">Kundvariabler</div>
            <div className="grid grid-cols-2 gap-1 mb-3">
              <Button size="sm" variant="flat" onPress={() => onInsertVariable('kundNamn')}>Kundnamn</Button>
              <Button size="sm" variant="flat" onPress={() => onInsertVariable('kundEmail')}>Kund E-post</Button>
            </div>
            
            <div className="font-medium text-sm mb-2">Ärendevariabler</div>
            <div className="grid grid-cols-2 gap-1 mb-3">
              <Button size="sm" variant="flat" onPress={() => onInsertVariable('ärendeID')}>Ärende ID</Button>
              <Button size="sm" variant="flat" onPress={() => onInsertVariable('ärendeTyp')}>Ärendetyp</Button>
              <Button size="sm" variant="flat" onPress={() => onInsertVariable('ärendeStatus')}>Status</Button>
              <Button size="sm" variant="flat" onPress={() => onInsertVariable('deadline')}>Deadline</Button>
              <Button size="sm" variant="flat" onPress={() => onInsertVariable('gammalStatus')}>Tidigare status</Button>
              <Button size="sm" variant="flat" onPress={() => onInsertVariable('ärendeLänk')}>Ärendelänk</Button>
            </div>
            
            <div className="font-medium text-sm mb-2">Övriga variabler</div>
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant="flat" onPress={() => onInsertVariable('handläggare')}>Handläggare</Button>
              <Button size="sm" variant="flat" onPress={() => onInsertVariable('företagsNamn')}>Företagsnamn</Button>
              
              <Button size="sm" variant="flat" onPress={() => onInsertVariable('aktuellDatum')}>Dagens datum</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      <Divider orientation="vertical" className="h-6" />
      
      {/* Färgval */}
      <div className="flex gap-1">
        <button 
          type="button"
          onClick={() => onFormat('textColor', '#000000')}
          className="p-1 rounded hover:bg-default-200"
          title="Textfärg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 15-3 7h7l-4-7z"/><path d="m15 4-7 3 4 4"/><path d="M20 6a2 2 0 0 0-2-2"/><path d="M20 10a2 2 0 0 1-2 2"/><path d="M20 18a2 2 0 0 0-2-2"/><path d="M4 14a2 2 0 0 0-2-2"/><path d="M20 14a2 2 0 0 1-2-2"/><path d="M14 20a2 2 0 0 0-2 2"/><path d="M14 12a2 2 0 0 1-2 2"/><path d="M14 4a2 2 0 0 0-2 2"/></svg>
        </button>
        <button 
          type="button"
          onClick={() => onFormat('highlight', '#ffd700')}
          className="p-1 rounded hover:bg-default-200"
          title="Bakgrundsfärg"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/></svg>
        </button>
      </div>
      
      <Divider orientation="vertical" className="h-6" />
      
      {/* CTA-knappar */}
      <button 
        type="button"
        onClick={() => onFormat('button')}
        className="flex items-center gap-1 px-2 py-1 rounded hover:bg-default-200"
        title="Infoga knapp"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="10" x="3" y="7" rx="1"/><path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/><path d="M7 17v2a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2"/></svg>
        <span>CTA-knapp</span>
      </button>
    </div>
  );
};

// Huvudkomponent för mallredigeraren
const MailTemplateForm = ({ 
  initialTemplate = { name: '', subject: '', body: '' },
  onSave,
  onCancel,
  title = 'Skapa mailmall'
}) => {
  const [templateName, setTemplateName] = useState(initialTemplate.name);
  const [templateSubject, setTemplateSubject] = useState(initialTemplate.subject);
  const [templateBody, setTemplateBody] = useState(initialTemplate.body);
  const [htmlMode, setHtmlMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  const [validationErrors, setValidationErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Referens till editorns textarea
  const editorRef = React.useRef(null);

  // Validera formuläret
  const validateForm = () => {
    const errors = {};
    
    if (!templateName.trim()) {
      errors.templateName = 'Mall-namn är obligatoriskt';
    }
    
    if (!templateSubject.trim()) {
      errors.templateSubject = 'Ämne är obligatoriskt';
    }
    
    if (!templateBody.trim()) {
      errors.templateBody = 'Innehåll är obligatoriskt';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Hantera formatering i editorn
  const handleFormat = (format, value) => {
    if (!editorRef.current) return;
    
    // Hämta editorns värde och cursorposition
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = templateBody.substring(start, end);
    
    let replacement = '';
    
    // Applicera olika formateringar baserat på format
    switch(format) {
      case 'bold':
        replacement = `<strong>${selectedText}</strong>`;
        break;
      case 'italic':
        replacement = `<em>${selectedText}</em>`;
        break;
      case 'underline':
        replacement = `<u>${selectedText}</u>`;
        break;
      case 'h2':
        replacement = `<h2>${selectedText}</h2>`;
        break;
      case 'p':
        replacement = `<p>${selectedText}</p>`;
        break;
      case 'ul':
        replacement = `<ul>\n  <li>${selectedText || 'Listpunkt'}</li>\n  <li>Ny punkt</li>\n</ul>`;
        break;
      case 'ol':
        replacement = `<ol>\n  <li>${selectedText || 'Listpunkt 1'}</li>\n  <li>Listpunkt 2</li>\n</ol>`;
        break;
      case 'textColor':
        replacement = `<span style="color: ${value}">${selectedText}</span>`;
        break;
      case 'highlight':
        replacement = `<span style="background-color: ${value}">${selectedText}</span>`;
        break;
      case 'button':
        replacement = `<div style="text-align: center; margin: 20px 0;">\n  <a href="{ärendeLänk}" style="background-color: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; font-weight: bold;">\n    ${selectedText || 'Klicka här'}\n  </a>\n</div>`;
        break;
      default:
        return;
    }
    
    // Uppdatera innehållet
    const newBody = 
      templateBody.substring(0, start) + 
      replacement + 
      templateBody.substring(end);
    
    setTemplateBody(newBody);
    
    // Fokusera tillbaka och uppdatera cursorposition
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + replacement.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  // Hantera infogning av variabler
  const handleInsertVariable = (variable) => {
    if (!editorRef.current) return;
    
    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    const replacement = `{${variable}}`;
    const newBody = 
      templateBody.substring(0, start) + 
      replacement + 
      templateBody.substring(end);
    
    setTemplateBody(newBody);
    
    // Fokusera tillbaka och uppdatera cursorposition
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + replacement.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  // Förhandsgranska mallfält med variabelersättningar
  const getPreviewContent = () => {
    // Skapa en uppsättning exempelvariabler
    const variables = {
      kundNamn: 'Anna Andersson',
      kundEmail: 'anna.andersson@example.com',
      ärendeID: '12345',
      ärendeTyp: 'Supportärende',
      ärendeStatus: 'Under behandling',
      ärendeDatum: new Date().toLocaleDateString('sv-SE'),
      ärendeLänk: 'https://app.servicedrive.se/arenden/12345',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE'),
      handläggare: 'Martin Svensson',
      företagsNamn: 'Demo Företag AB',
      gammalStatus: 'Ny',
      aktuellDatum: new Date().toLocaleDateString('sv-SE')
    };
    
    // Ersätt alla variabler i innehållet
    let previewContent = templateBody;
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      previewContent = previewContent.replace(regex, value);
    });
    
    return previewContent;
  };

  // Hantera sparande
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Anropa den medskickade spara-funktionen
      await onSave({
        name: templateName,
        subject: templateSubject,
        body: templateBody
      });
      
      addToast({
        title: 'Framgång',
        description: initialTemplate.id ? 'Mailmallen uppdaterades' : 'Mailmall skapades',
        color: 'success',
        variant: 'flat'
      });
    } catch (error) {
      console.error('Fel vid sparande av mailmall:', error);
      addToast({
        title: 'Fel',
        description: error.message || 'Kunde inte spara mailmallen',
        color: 'danger',
        variant: 'flat'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <Form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          <Input
            label="Mallnamn"
            placeholder="T.ex. Välkomstmail eller Statusuppdatering"
            value={templateName}
            onValueChange={setTemplateName}
            isInvalid={!!validationErrors.templateName}
            errorMessage={validationErrors.templateName}
          />
          
          <Input
            label="Ämne"
            placeholder="E-postens ämnesrad"
            value={templateSubject}
            onValueChange={setTemplateSubject}
            isInvalid={!!validationErrors.templateSubject}
            errorMessage={validationErrors.templateSubject}
          />
        </div>
        
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={setActiveTab}
          aria-label="Email editor tabs"
          variant="underlined"
          color="primary"
        >
          <Tab key="content" title="Innehåll">
            <div className="mt-4 space-y-2">
              {!htmlMode && (
                <EditorToolbar 
                  onInsertVariable={handleInsertVariable}
                  onFormat={handleFormat}
                />
              )}
              
              <div className="flex justify-end mb-2">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setHtmlMode(!htmlMode)}
                >
                  {htmlMode ? 'Stäng HTML-läge' : 'Redigera HTML'}
                </Button>
              </div>
              
              <Textarea
                ref={editorRef}
                placeholder={htmlMode 
                  ? "Skriv eller klistra in HTML-kod här..." 
                  : "Skriv innehållet i ditt e-postmeddelande här...\n\nTips: Du kan använda formateringsverktygen ovan och infoga variabler som {kundNamn} och {ärendeID}."}
                value={templateBody}
                onValueChange={setTemplateBody}
                isInvalid={!!validationErrors.templateBody}
                errorMessage={validationErrors.templateBody}
                minRows={12}
                maxRows={20}
                className={htmlMode ? "font-mono text-sm" : ""}
              />
            </div>
          </Tab>
          
          <Tab key="preview" title="Förhandsgranska">
            <div className="mt-4">
              <div className="border rounded-md p-6 bg-white">
                <div className="max-w-lg mx-auto">
                  <h3 className="font-medium mb-1">Ämne:</h3>
                  <div className="px-3 py-2 border rounded-md bg-default-50 mb-4">
                    {templateSubject}
                  </div>
                  
                  <h3 className="font-medium mb-1">Innehåll:</h3>
                  <div 
                    className="border rounded-md p-4 bg-white"
                    dangerouslySetInnerHTML={{ __html: getPreviewContent() }}
                  />
                </div>
              </div>
              
              <p className="text-sm text-default-500 mt-2">
                Förhandsgranskningen visar hur e-postmeddelandet kan se ut med exempeldata. 
                Faktiska utskick kommer att använda verklig kunddata.
              </p>
            </div>
          </Tab>
          
          <Tab key="help" title="Hjälp">
            <div className="mt-4 space-y-4">
              <div className="bg-default-50 p-4 rounded-md">
                <h3 className="font-medium mb-2">Variabelhjälp</h3>
                <p className="mb-2">
                  Du kan använda variabler i din mall som kommer att ersättas med verklig data när e-postmeddelandet skickas.
                  Variabler skrivs inom klammerparenteser, t.ex. {'{kundNamn}'}.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm mb-1">Kundvariabler:</h4>
                    <ul className="list-disc list-inside text-sm">
                      <li>{'{kundNamn}'} - Kundens fullständiga namn</li>
                      <li>{'{kundEmail}'} - Kundens e-postadress</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-1">Ärendevariabler:</h4>
                    <ul className="list-disc list-inside text-sm">
                      <li>{'{ärendeID}'} - Ärendets ID-nummer</li>
                      <li>{'{ärendeTyp}'} - Typ av ärende</li>
                      <li>{'{ärendeStatus}'} - Ärendets status</li>
                      <li>{'{ärendeDatum}'} - När ärendet skapades</li>
                      <li>{'{deadline}'} - Ärendets deadline</li>
                      <li>{'{ärendeLänk}'} - Länk till ärendet</li>
                      <li>{'{gammalStatus}'} - Tidigare status</li>
                    </ul>
                  </div>
                </div>
                
                <h4 className="font-medium text-sm mt-3 mb-1">Övriga variabler:</h4>
                <ul className="list-disc list-inside text-sm">
                  <li>{'{handläggare}'} - Namn på handläggaren</li>
                  <li>{'{företagsNamn}'} - Ditt företagsnamn</li>
                  
                  <li>{'{aktuellDatum}'} - Dagens datum</li>
                </ul>
              </div>
              
              <div className="bg-default-50 p-4 rounded-md">
                <h3 className="font-medium mb-2">Tips för effektiva mail</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Börja med en tydlig hälsning, t.ex. "Hej {'{kundNamn}'}"</li>
                  <li>Håll innehållet kortfattat och koncist</li>
                  <li>Använd rubriker och listor för att strukturera innehållet</li>
                  <li>Avsluta med en tydlig uppmaning eller nästa steg</li>
                  <li>Inkludera alltid kontaktinformation vid behov av hjälp</li>
                </ul>
              </div>
            </div>
          </Tab>
        </Tabs>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button 
            type="button" 
            variant="flat" 
            onPress={onCancel}
          >
            Avbryt
          </Button>
          <Button 
            color="primary" 
            type="submit"
            isLoading={submitting}
            isDisabled={submitting}
          >
            {initialTemplate.id ? 'Spara ändringar' : 'Skapa mall'}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default MailTemplateForm;