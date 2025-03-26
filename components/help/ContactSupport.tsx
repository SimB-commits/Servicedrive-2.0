// components/help/ContactSupport.tsx
import React, { useState } from 'react';
import {
  Input,
  Textarea,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Divider,
  addToast
} from '@heroui/react';
import { EmailIcon, PhoneIcon, TicketIcon} from '../icons';


const ContactSupport = () => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('generell');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validera formuläret
    if (!subject.trim() || !message.trim()) {
      addToast({
        title: 'Valideringsfel',
        description: 'Vänligen fyll i alla fält',
        color: 'danger',
        variant: 'flat'
      });
      return;
    }
    
    // Simulera sändning
    setSubmitting(true);
    
    setTimeout(() => {
      setSubmitting(false);
      
      addToast({
        title: 'Meddelande skickat',
        description: 'Vi återkommer så snart som möjligt!',
        color: 'success',
        variant: 'flat'
      });
      
      // Återställ formuläret
      setSubject('');
      setMessage('');
      setCategory('generell');
    }, 1500);
    
    // Här skulle vi annars anropa ett API för att skicka supportförfrågan
  };

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Kontakta support</h3>
        <p className="text-default-500 text-sm">
          Har du frågor eller behöver hjälp? Vi finns här för dig.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <Dropdown>
          <DropdownTrigger>
            <Button 
              variant="flat" 
              className="w-full justify-start"
              endContent={<span className="text-sm ml-1">▼</span>}
            >
              {category === 'teknisk' ? 'Tekniskt problem' : 
               category === 'fakturering' ? 'Fakturafråga' : 
               category === 'feature' ? 'Funktionsförslag' : 'Generell fråga'}
            </Button>
          </DropdownTrigger>
          <DropdownMenu 
            aria-label="Ärendekategori" 
            selectionMode="single"
            selectedKeys={[category]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0]?.toString();
              if (selected) setCategory(selected);
            }}
          >
            <DropdownItem key="generell">Generell fråga</DropdownItem>
            <DropdownItem key="teknisk">Tekniskt problem</DropdownItem>
            <DropdownItem key="fakturering">Fakturafråga</DropdownItem>
            <DropdownItem key="feature">Funktionsförslag</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        
        <Input
          label="Ämne"
          placeholder="Beskriv kort vad din fråga handlar om"
          value={subject}
          onValueChange={setSubject}
          isRequired
        />
        
        <Textarea
          label="Meddelande"
          placeholder="Beskriv ditt ärende så detaljerat som möjligt"
          value={message}
          onValueChange={setMessage}
          minRows={4}
          isRequired
        />
        
        <Button 
          type="submit" 
          color="primary" 
          className="w-full" 
          isLoading={submitting}
        >
          Skicka meddelande
        </Button>
      </form>
      
      <Divider className="my-4" />
      
      <div className="space-y-3">
        <h4 className="text-sm font-semibold">Andra kontaktvägar</h4>
        
        <div className="flex items-center gap-2">
          <EmailIcon className="text-default-500" />
          <span className="text-sm">support@servicedrive.se</span>
        </div>
        
        <div className="flex items-center gap-2">
          <PhoneIcon className="text-default-500" />
          <span className="text-sm">010-123 45 67 (vardagar 8-17)</span>
        </div>
        
        <div className="flex items-center gap-2">
          <TicketIcon className="text-default-500" />
          <a 
            href="https://support.servicedrive.se" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Supportportal
          </a>
        </div>
      </div>
    </div>
  );
};

export default ContactSupport;