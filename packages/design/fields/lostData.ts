/** The sentence for saved data that was in this browser at the last start and is gone now. All
 *  user-facing wording lives here, not in a skin: a second skin says the same thing. */
export function lostDataSentence(what: string, plural: boolean, when: string): string {
  const were = plural ? 'were' : 'was';
  const they = plural ? 'they are' : 'it is';
  return [what, were, 'in this browser at', `${when},`, they, 'gone now.'].join(' ');
}
