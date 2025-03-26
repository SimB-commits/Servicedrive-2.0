// components/help/HelpOverlay.tsx
import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Tabs,
  Tab,
  Button
} from '@heroui/react';
import GettingStartedGuide from './GettingStartedGuide';
import ContactSupport from './ContactSupport';
import { GuideIcon, ContactIcon } from '../icons';


type HelpOverlayProps = {
  onClose: () => void;
};

const HelpOverlay: React.FC<HelpOverlayProps> = ({ onClose }) => {
  const [selectedTab, setSelectedTab] = useState('guide');

  return (
    <Card className="w-[350px] md:w-[450px] shadow-xl overflow-hidden">
      <CardHeader className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Hjälpcenter</h3>
        <Button 
          isIconOnly 
          size="sm" 
          variant="light" 
          onPress={onClose}
        >
          ✕
        </Button>
      </CardHeader>
      
      <Tabs 
        selectedKey={selectedTab}
        onSelectionChange={(key) => setSelectedTab(key as string)}
        variant="underlined"
        color="primary"
        fullWidth
      >
        <Tab 
          key="guide" 
          title={
            <div className="flex items-center gap-2">
              <GuideIcon size={18} />
              <span>Kom igång</span>
            </div>
          }
        >
          <CardBody className="max-h-[400px] overflow-y-auto px-4">
            <GettingStartedGuide />
          </CardBody>
        </Tab>
        <Tab 
          key="contact" 
          title={
            <div className="flex items-center gap-2">
              <ContactIcon size={18} />
              <span>Kontakta support</span>
            </div>
          }
        >
          <CardBody className="max-h-[400px] overflow-y-auto px-4">
            <ContactSupport />
          </CardBody>
        </Tab>
      </Tabs>
      
      <CardFooter className="flex justify-between px-4 py-3">
        <div className="text-xs text-default-500">Servicedrive v1.0</div>
        <Button size="sm" color="primary" variant="flat" onPress={onClose}>
          Stäng
        </Button>
      </CardFooter>
    </Card>
  );
};

export default HelpOverlay;