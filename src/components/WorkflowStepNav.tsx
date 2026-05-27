import React from 'react';
import { WORKFLOW_STEPS, type WorkflowStepId } from '../workflowSteps';

type WorkflowStepNavProps = {
  currentStep: WorkflowStepId;
  availableStepIds: Set<WorkflowStepId>;
  onStepChange: (stepId: WorkflowStepId) => void;
};

export function WorkflowStepNav({
  currentStep,
  availableStepIds,
  onStepChange,
}: WorkflowStepNavProps) {
  return (
    <nav className="workflow-nav panel" aria-label="分步工作流导航">
      <p className="eyebrow">Workflow</p>
      <h2>处理步骤</h2>
      <ol className="workflow-nav__list">
        {WORKFLOW_STEPS.map((step, index) => {
          const isAvailable = availableStepIds.has(step.id);
          const isCurrent = step.id === currentStep;

          return (
            <li key={step.id}>
              <button
                type="button"
                className={isCurrent ? 'workflow-step workflow-step--current' : 'workflow-step'}
                onClick={() => onStepChange(step.id)}
                disabled={!isAvailable}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span className="workflow-step__index">{String(index + 1).padStart(2, '0')}</span>
                <span className="workflow-step__body">
                  <strong>{step.title}</strong>
                  <span>{step.description}</span>
                </span>
                <span className="workflow-step__status">{isAvailable ? '可用' : '待完成'}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
