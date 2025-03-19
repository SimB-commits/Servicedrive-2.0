// components/Stepper.tsx
import React from 'react';

interface StepperProps {
  activeStep: number;
  children: React.ReactNode[];
  alternativeLabel?: boolean;
}

interface StepProps {
  children: React.ReactNode;
}

interface StepLabelProps {
  children: React.ReactNode;
}

export const Step: React.FC<StepProps> = ({ children }) => {
  return <>{children}</>;
};

export const StepLabel: React.FC<StepLabelProps> = ({ children }) => {
  return <>{children}</>;
};

export const Stepper: React.FC<StepperProps> = ({ 
  activeStep, 
  children, 
  alternativeLabel = false 
}) => {
  // Filtrera ut endast Step-komponenter bland barnen
  const steps = React.Children.toArray(children);
  
  return (
    <div className="w-full">
      <div className={`flex ${alternativeLabel ? 'flex-row justify-between' : 'flex-col'} w-full`}>
        {steps.map((step, index) => {
          const active = index === activeStep;
          const completed = index < activeStep;
          // Hämta StepLabel från Step-komponentens barn
          const stepChildren = React.Children.toArray((step as React.ReactElement).props.children);
          const label = stepChildren.find(
            (child) => React.isValidElement(child) && child.type === StepLabel
          );
          
          return (
            <div 
              key={index} 
              className={`relative ${alternativeLabel ? 'flex-1 text-center' : 'flex items-center'}`}
            >
              <div className="flex items-center">
                {!alternativeLabel && (
                  <div 
                    className={`flex items-center justify-center rounded-full w-8 h-8 mr-4 ${
                      active ? 'bg-primary text-white' : 
                      completed ? 'bg-success-500 text-white' : 
                      'bg-default-100 text-default-500'
                    }`}
                  >
                    {completed ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path 
                          d="M5 13L9 17L19 7" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />
                      </svg>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                )}
                
                {alternativeLabel ? (
                  <div className="flex flex-col items-center w-full">
                    <div 
                      className={`flex items-center justify-center rounded-full w-8 h-8 mx-auto ${
                        active ? 'bg-primary text-white' : 
                        completed ? 'bg-success-500 text-white' : 
                        'bg-default-100 text-default-500'
                      }`}
                    >
                      {completed ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path 
                            d="M5 13L9 17L19 7" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                          />
                        </svg>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    
                    <div className={`mt-2 ${
                      active ? 'text-primary font-medium' : 
                      completed ? 'text-success-500' : 
                      'text-default-500'
                    }`}>
                      {label && React.isValidElement(label) ? label.props.children : `Steg ${index + 1}`}
                    </div>
                  </div>
                ) : (
                  <div className={`${
                    active ? 'text-primary font-medium' : 
                    completed ? 'text-success-500' : 
                    'text-default-500'
                  }`}>
                    {label && React.isValidElement(label) ? label.props.children : `Steg ${index + 1}`}
                  </div>
                )}
              </div>
              
              {/* Connector line */}
              {index < steps.length - 1 && alternativeLabel && (
                <div className={`absolute top-4 left-1/2 w-full h-px ${
                  index < activeStep ? 'bg-success-500' : 'bg-default-200'
                }`}></div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Progress line for alternative label (horizontal) */}
      {alternativeLabel && (
        <div className="relative w-full h-px bg-default-200 mt-4">
          <div 
            className="absolute h-px bg-success-500 transition-all" 
            style={{ 
              width: `${Math.max(0, Math.min(100, (activeStep / (steps.length - 1)) * 100))}%` 
            }}
          ></div>
        </div>
      )}
    </div>
  );
};