/**
 * The box-loss Q at and above which a box counts as lossless. A Ql or Qa this large (or larger)
 * has no measurable effect, so it is how a project states "no leak" / "no absorption" — WinISD
 * has no lossless switch, only these two fields.
 */
export const LOSSLESS_Q = 1e6;
