# An imported passive radiator can have an unavailable resonance with no explanation

Opening [the passive-radiator project fixture](../packages/ui/test/fixtures/pr-resonance-underflow.owpr) keeps its entered moving mass and compliance. Both are finite, but their product underflows to zero. The engine calculates an infinite free-air resonance with added mass. The readout shows a dash and gives no reason.

The import should open the project and keep its entered data. The resonance should be unavailable with a reason from the engine. The import regression checks this through the app's file handler and the readout's warning button.

T943, the non-finite result guard, preserves unbounded maximum SPL and power samples when that curve's advisory names both missing limits. This follows John's ruling QO143, “state Pe or Xmax to bound this curve”. Other non-finite samples produce a structured failure.
