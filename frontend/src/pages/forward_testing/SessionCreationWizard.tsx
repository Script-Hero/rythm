import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useForwardTesting } from '@/contexts/ForwardTestingContext';
import type { Strategy } from '@/types/strategy';

// Import wizard step components
import { WizardStepNav } from './components/WizardStepNav';
import { WizardStrategyStep } from './components/WizardStrategyStep';
import { WizardBasicStep } from './components/WizardBasicStep';
import { WizardRiskStep } from './components/WizardRiskStep';
import { WizardReviewStep } from './components/WizardReviewStep';

interface SessionSettings {
  // Basic settings
  name: string;
  symbol: string;
  timeframe: string;
  speed: number;
  initialBalance: number;
  
  // Execution settings
  slippage: number;
  commission: number;
  commissionType: 'fixed' | 'percentage';
  
  // Risk management
  maxDrawdown: number;
  maxPositions: number;
  maxDailyTrades: number;
  maxDailyLoss: number;
  stopLossDefault: number;
  takeProfitDefault: number;
  autoStop: boolean;
  
  // Market session filters
  enableMarketHours: boolean;
  marketOpenHour: number;
  marketCloseHour: number;
  enableWeekends: boolean;
}

const WIZARD_STEPS = [
  {
    id: 'strategy',
    title: 'Strategy',
    description: 'Select trading strategy',
    completed: false,
  },
  {
    id: 'basic',
    title: 'Basic',
    description: 'Session settings',
    completed: false,
  },
  {
    id: 'risk',
    title: 'Risk',
    description: 'Risk management',
    completed: false,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Final review',
    completed: false,
  },
];

const SessionCreationWizard = () => {
  const navigate = useNavigate();
  const { createSession } = useForwardTesting();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const [settings, setSettings] = useState<SessionSettings>({
    // Basic settings
    name: '',
    symbol: 'BTC/USD',
    timeframe: '1m',
    speed: 1,
    initialBalance: 10000,
    
    // Execution settings
    slippage: 0.001, // 0.1%
    commission: 0.1,
    commissionType: 'percentage',
    
    // Risk management
    maxDrawdown: 10,
    maxPositions: 5,
    maxDailyTrades: 0, // 0 = unlimited
    maxDailyLoss: 0,   // 0 = unlimited
    stopLossDefault: 0, // 0 = none
    takeProfitDefault: 0, // 0 = none
    autoStop: true,
    
    // Market session filters
    enableMarketHours: false,
    marketOpenHour: 9,  // 9 AM
    marketCloseHour: 17, // 5 PM
    enableWeekends: true,
  });

  const updateSettings = (updates: Partial<SessionSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case 0: // Strategy step
        return selectedStrategy !== null;
      case 1: // Basic step
        return settings.name.trim() !== '' && settings.symbol !== '' && settings.initialBalance >= 100;
      case 2: // Risk step
        return settings.maxDrawdown > 0 && settings.maxPositions > 0;
      case 3: // Review step
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCreateSession = async () => {
    if (!selectedStrategy) {
      toast.error('Please select a strategy');
      return;
    }

    setIsCreating(true);
    try {
      const sessionName = settings.name || `${selectedStrategy.name} - ${new Date().toLocaleString()}`;
      const sessionId = await createSession(sessionName, selectedStrategy, settings);
      
      if (sessionId) {
        toast.success('Forward testing session created successfully!');
        navigate(`/forward-testing/session/${sessionId}`);
      } else {
        toast.error('Failed to create session');
      }
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <WizardStrategyStep
            selectedStrategy={selectedStrategy}
            onStrategySelect={setSelectedStrategy}
          />
        );
      case 1:
        return (
          <WizardBasicStep
            settings={settings}
            onSettingsChange={updateSettings}
          />
        );
      case 2:
        return (
          <WizardRiskStep
            settings={settings}
            onSettingsChange={updateSettings}
          />
        );
      case 3:
        return (
          <WizardReviewStep
            selectedStrategy={selectedStrategy}
            settings={settings}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/forward-testing')}
          className="mr-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Sessions
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Create Forward Testing Session</h1>
          <p className="text-muted-foreground">
            Set up a new paper trading session for your strategy
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <WizardStepNav
        steps={WIZARD_STEPS.map((step, index) => ({
          ...step,
          completed: index < currentStep
        }))}
        currentStep={currentStep}
      />

      {/* Backend Notice */}
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Note:</strong> Full session management requires backend database updates. 
          This wizard creates sessions using the existing API with enhanced frontend management.
        </AlertDescription>
      </Alert>

      {/* Step Content */}
      <Card className="mb-6">
        <CardContent className="p-6">
          {renderCurrentStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {currentStep < WIZARD_STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceedToNext()}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleCreateSession}
              disabled={!canProceedToNext() || isCreating}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCreating ? 'Creating...' : 'Create Session'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionCreationWizard;