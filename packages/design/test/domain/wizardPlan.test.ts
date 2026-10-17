import {describe, expect, it} from 'vitest';
import {WizardPlan, WizardStep} from '../../domain/index.js';
import type {BoxType} from '../../engine/index.js';

const ALL_BOX_TYPES: readonly BoxType[] = ['sealed', 'vented', 'bandpass4', 'bandpass6', 'box-passive-radiator', 'abc'];

describe('WizardPlan: the steps of the New project wizard, per box type', () => {
  it.each([
    ['sealed', ['driver', 'count', 'box-type', 'box-details', 'project-info']],
    ['vented', ['driver', 'count', 'box-type', 'box-details', 'project-info']],
    ['box-passive-radiator', ['driver', 'count', 'box-type', 'box-details', 'project-info']],
    ['bandpass4', ['driver', 'count', 'box-type', 'project-info']],
    ['bandpass6', ['driver', 'count', 'box-type', 'project-info']],
    ['abc', ['driver', 'count', 'box-type', 'project-info']],
  ] as const)('%s visits %j in order', (type, ids) => {
    expect(WizardPlan.of(type).steps.map(step => step.value)).toEqual(ids);
  });

  it('numbers the steps from 1 and counts them', () => {
    const plan = WizardPlan.of('sealed');
    expect(plan.total).toBe(5);
    expect(plan.numberOf(WizardStep.DRIVER)).toBe(1);
    expect(plan.numberOf(WizardStep.BOX_DETAILS)).toBe(4);
    expect(plan.numberOf(WizardStep.PROJECT_INFO)).toBe(5);
    const bandpass = WizardPlan.of('bandpass4');
    expect(bandpass.total).toBe(4);
    expect(bandpass.numberOf(WizardStep.PROJECT_INFO)).toBe(4);
  });

  it('a step the plan skips has no number', () => {
    expect(WizardPlan.of('abc').numberOf(WizardStep.BOX_DETAILS)).toBeNull();
  });

  it('next and back walk the plan and stop at its ends', () => {
    const plan = WizardPlan.of('bandpass6');
    expect(plan.next(WizardStep.BOX_TYPE)).toBe(WizardStep.PROJECT_INFO);
    expect(plan.back(WizardStep.PROJECT_INFO)).toBe(WizardStep.BOX_TYPE);
    expect(plan.back(WizardStep.DRIVER)).toBeNull();
    expect(plan.next(WizardStep.PROJECT_INFO)).toBeNull();
  });

  it('the box details step is named for the box type', () => {
    expect(WizardPlan.of('sealed').labelOf(WizardStep.BOX_DETAILS)).toBe('Sealed Alignment');
    expect(WizardPlan.of('vented').labelOf(WizardStep.BOX_DETAILS)).toBe('Vented Alignment');
    expect(WizardPlan.of('box-passive-radiator').labelOf(WizardStep.BOX_DETAILS)).toBe('Passive Radiator');
  });

  it('the other steps keep one label for every box type', () => {
    for (const type of ALL_BOX_TYPES) {
      const plan = WizardPlan.of(type);
      expect(plan.labelOf(WizardStep.DRIVER)).toBe('Select driver for project');
      expect(plan.labelOf(WizardStep.COUNT)).toBe('Number of drivers and placement');
      expect(plan.labelOf(WizardStep.BOX_TYPE)).toBe('Type of design');
      expect(plan.labelOf(WizardStep.PROJECT_INFO)).toBe('Project Information');
    }
  });

  it('every plan starts at the driver and ends at the project information', () => {
    for (const type of ALL_BOX_TYPES) {
      const {steps} = WizardPlan.of(type);
      expect(steps[0]).toBe(WizardStep.DRIVER);
      expect(steps[steps.length - 1]).toBe(WizardStep.PROJECT_INFO);
    }
  });
});
