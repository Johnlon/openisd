import type {BoxType} from '../../engine/index.js';

/** A page of the New project wizard. `.value` is the one string that crosses a boundary. */
export class WizardStep {
  static readonly DRIVER = new WizardStep('driver', () => 'Select driver for project');
  static readonly COUNT = new WizardStep('count', () => 'Number of drivers and placement');
  static readonly BOX_TYPE = new WizardStep('box-type', () => 'Type of design');
  /** The page after the box type, for every box type: the volume and tuning, with the alignment where there is one, or the radiator. */
  static readonly BOX_DETAILS = new WizardStep('box-details', boxDetailsLabel);
  static readonly PROJECT_INFO = new WizardStep('project-info', () => 'Project Information');

  /** `.value` is the wire string; `labelFor` names the page for a box type. */
  private constructor(readonly value: string, readonly labelFor: (type: BoxType) => string) {}
}

/** The title of the box details page, by box type. */
function boxDetailsLabel(type: BoxType): string {
  switch (type) {
    case 'sealed':
      return 'Sealed Alignment';
    case 'vented':
      return 'Vented Alignment';
    case 'box-passive-radiator':
      return 'Passive Radiator';
    case 'bandpass4':
    case 'bandpass6':
    case 'abc':
      return 'Chambers';
  }
}

/** The pages a New project wizard visits for one box type, in order, with their numbers and titles. */
export class WizardPlan {
  readonly steps: readonly WizardStep[];
  readonly total: number;

  private constructor(private readonly type: BoxType) {
    this.steps = [
      WizardStep.DRIVER,
      WizardStep.COUNT,
      WizardStep.BOX_TYPE,
      WizardStep.BOX_DETAILS,
      WizardStep.PROJECT_INFO,
    ];
    this.total = this.steps.length;
  }

  static of(type: BoxType): WizardPlan {
    return new WizardPlan(type);
  }

  /** The page's place in this plan, from 1; null where the plan skips the page. */
  numberOf(step: WizardStep): number | null {
    const index = this.steps.indexOf(step);
    return index < 0 ? null : index + 1;
  }

  /** The page after `step`; null at the last page. */
  next(step: WizardStep): WizardStep | null {
    const index = this.steps.indexOf(step);
    return index < 0 ? null : this.steps[index + 1] ?? null;
  }

  /** The page before `step`; null at the first page. */
  back(step: WizardStep): WizardStep | null {
    const index = this.steps.indexOf(step);
    return index <= 0 ? null : this.steps[index - 1] ?? null;
  }

  labelOf(step: WizardStep): string {
    return step.labelFor(this.type);
  }
}
