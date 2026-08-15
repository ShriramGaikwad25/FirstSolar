interface Step {
  name: string;
}

interface WizardStepsProps {
  currentStep: number;
  steps: Step[];
  onStepChange: (step: number) => void; 
  validationStatus: boolean[]; 
}

const WizardSteps: React.FC<WizardStepsProps> = ({ currentStep, steps, onStepChange, validationStatus }) => {

  return (
    <div className="max-w-2xl mx-auto flex justify-between items-center mb-6">
      {steps.map((step, index) => {
       
        const isClickable = validationStatus.slice(0, index).every(Boolean); 
       
        return (
            <div key={index} className="flex flex-col items-center relative">
              <button
                className={`w-8 h-8 flex items-center justify-center rounded-full text-white text-sm font-bold
                  ${index <= currentStep ? "bg-blue-500" : `${isClickable ? "bg-blue-200" : "bg-gray-300"}`}  
                  ${isClickable ? "cursor-pointer" : "cursor-not-allowed"}
                `}
                onClick={() => isClickable && onStepChange(index)}>
                {index + 1}
            </button>
            <span className={`mt-2 text-sm ${isClickable ? "text-black font-semibold" : "text-gray-500"}`}>
              {step.name}
            </span>
          {index < steps.length - 1 && (
              <div className={`h-2 w-[100px] rounded-full absolute top-3 -right-20  ${currentStep >= index + 1 || validationStatus[index] ? "bg-blue-200" : "bg-gray-300"}`}>
                <div
                  className="h-full w-1/2 bg-blue-500 rounded-full transition-all duration-300"
                  style={{
                    width: currentStep >= index + 1 ? "100%" : "0%",
                  }}
                ></div>
              </div>
          )}
        </div>
      )
    }
    )}
    </div>
  );
};

export default WizardSteps;
