// components/subscription/SubscriptionSkeleton.tsx
import React from 'react';
import { Card, CardHeader, CardBody, CardFooter } from '@heroui/react';

/**
 * Skeletongränssnittskomponent för att visa under inladdning av prenumerationsinformation.
 * Detta förbättrar upplevelsen genom att direkt visa en liknande layout som den slutliga komponenten,
 * vilket minskar layoutskiften när data laddas.
 */
const SubscriptionSkeleton: React.FC = () => {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-7 w-32 bg-default-200 rounded animate-pulse"></div>
          <div className="h-4 w-44 bg-default-100 rounded mt-2 animate-pulse"></div>
        </div>
        <div className="flex flex-col sm:items-end mt-2 sm:mt-0">
          <div className="h-6 w-28 bg-primary-100 rounded animate-pulse"></div>
        </div>
      </CardHeader>
      
      <CardBody>
        <div className="space-y-6">
          <section>
            <div className="h-6 w-36 bg-default-200 rounded mb-3 animate-pulse"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <div className="h-4 w-28 bg-default-200 rounded animate-pulse"></div>
                    <div className="h-4 w-16 bg-default-100 rounded animate-pulse"></div>
                  </div>
                  <div className="h-2 w-full bg-default-100 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </section>
          
          <section>
            <div className="h-6 w-36 bg-default-200 rounded mb-3 animate-pulse"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array(12).fill(0).map((_, i) => (
                <div key={i} className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-default-200 mr-2"></div>
                  <div className="h-4 w-24 bg-default-100 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </CardBody>
      
      <CardFooter className="flex flex-col sm:flex-row gap-2 justify-between">
        <div>
          <div className="h-4 w-36 bg-default-100 rounded animate-pulse"></div>
        </div>
        
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-primary-100 rounded animate-pulse"></div>
          <div className="h-9 w-36 bg-default-100 rounded animate-pulse"></div>
        </div>
      </CardFooter>
    </Card>
  );
};

export default SubscriptionSkeleton;