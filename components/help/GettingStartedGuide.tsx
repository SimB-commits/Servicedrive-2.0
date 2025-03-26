// components/help/GettingStartedGuide.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Accordion,
  AccordionItem,
  Button,
  Progress,
  Divider
} from '@heroui/react';
import { CheckIcon } from '../icons';

// Guide step interface
interface GuideStep {
  title: string;
  description: string;
  url: string;
  buttonText: string;
  completed?: boolean;
}


const GettingStartedGuide = () => {
  const router = useRouter();
  const [expandedKeys, setExpandedKeys] = useState<string[]>(['0']); // Första steget expanderat initialt
  
  // Loading local storage data for completed steps
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('completedGuideSteps');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  // Guide steps
  const steps: GuideStep[] = [
    {
      title: "Skapa ärendetyper",
      description: "Skapa olika ärendetyper för att kategorisera ärenden och samla in relevant information för varje typ.",
      url: "/installningar?tab=arendetyper",
      buttonText: "Gå till ärendetyper",
      completed: completedSteps["arendetyper"]
    },
    {
      title: "Definiera statusar",
      description: "Anpassa statusflödet för dina ärenden med egna statusar och koppla mailmallar.",
      url: "/installningar?tab=arendestatusar",
      buttonText: "Hantera statusar",
      completed: completedSteps["arendestatusar"]
    },
    {
      title: "Skapa kundkortsmallar",
      description: "Utforma kundkort för att samla in viktig kundinformation som är relevant för din verksamhet.",
      url: "/installningar?tab=kundkortsmallar",
      buttonText: "Skapa kundkortsmall",
      completed: completedSteps["kundkortsmallar"]
    },
    {
      title: "Skapa mailmallar",
      description: "Automatisera kommunikationen med dina kunder genom att skapa mailmallar för olika statusar.",
      url: "/installningar?tab=mailmallar",
      buttonText: "Hantera mailmallar",
      completed: completedSteps["mailmallar"]
    },
    {
      title: "Konfigurera e-post",
      description: "Konfigurera e-postinställningar för att skicka automatiska meddelanden till kunder.",
      url: "/installningar?tab=email",
      buttonText: "E-postinställningar",
      completed: completedSteps["email"]
    }
  ];

  // Calculate progress
  const completedCount = steps.filter(step => step.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  // Mark a step as completed
  const markAsCompleted = (index: number) => {
    const newCompletedSteps = {
      ...completedSteps,
      [steps[index].url.split('=')[1]]: true
    };
    setCompletedSteps(newCompletedSteps);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('completedGuideSteps', JSON.stringify(newCompletedSteps));
    }
    
    // Expand next incomplete step if available
    const nextIncompleteIndex = steps.findIndex((step, i) => i > index && !step.completed);
    if (nextIncompleteIndex !== -1) {
      setExpandedKeys([nextIncompleteIndex.toString()]);
    }
  };

  // Navigate to a step and mark current as completed if requested
  const navigateToStep = (index: number, markComplete: boolean = false) => {
    if (markComplete) {
      markAsCompleted(index);
    }
    router.push(steps[index].url);
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h4 className="text-lg font-semibold mb-2">Kom igång med Servicedrive</h4>
        <p className="text-default-500 text-sm">
          Följ dessa steg för att konfigurera ditt konto
        </p>
      </div>
      
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm">{completedCount} av {steps.length} steg slutförda</span>
          <span className="text-sm font-semibold">{progress}%</span>
        </div>
        <Progress 
          value={progress} 
          color="primary" 
          size="sm"
          className="h-2" 
        />
      </div>
      
      <Accordion 
        variant="bordered"
        selectedKeys={new Set(expandedKeys)}
        onSelectionChange={(keys) => setExpandedKeys(Array.from(keys as Set<string>))}
      >
        {steps.map((step, index) => (
          <AccordionItem 
            key={index.toString()} 
            title={
              <div className="flex items-center gap-2">
                {step.completed ? (
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-success text-white">
                    <CheckIcon size={14} />
                  </span>
                ) : (
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-default-100 text-default-500">
                    {index + 1}
                  </span>
                )}
                <span className={step.completed ? "line-through text-default-400" : ""}>
                  {step.title}
                </span>
              </div>
            }
            aria-label={`Steg ${index + 1}: ${step.title}`}
            className={step.completed ? "opacity-75" : ""}
          >
            <div className="px-4 pb-2">
              <p className="text-sm mb-4">{step.description}</p>
              <div className="flex justify-between">
                <Button
                  size="sm"
                  color="primary"
                  variant={step.completed ? "flat" : "solid"}
                  onPress={() => navigateToStep(index)}
                >
                  {step.buttonText}
                </Button>
                {!step.completed && (
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => markAsCompleted(index)}
                  >
                    Markera som klar
                  </Button>
                )}
              </div>
            </div>
          </AccordionItem>
        ))}
      </Accordion>
      
      <Divider className="my-4" />
      
      <div className="text-center">
        <p className="text-sm text-default-500 mb-2">Behöver du mer hjälp?</p>
        <Button 
          size="sm" 
          variant="flat" 
          color="primary"
          onPress={() => window.open('https://docs.servicedrive.se', '_blank')}
        >
          Besök vår dokumentation
        </Button>
      </div>
    </div>
  );
};

export default GettingStartedGuide;