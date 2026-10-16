/**
 * Shared settings for the Help Agent shown in every experience.
 *
 * The agent never generates text. Each experience hands it a short list of
 * tips ranked from most to least useful, and the player can step through them.
 * Keep copy at about a 7th–8th grade reading level (target audience: ages 9–14,
 * but written to work for teens and adults too).
 */
const helpAgent = {
  /** Placeholder until the team settles on a local personality (likeness and
   *  legal questions are still open). */
  name: "Help Agent",
  /** Set to an image path (e.g. a bundled image) to replace the placeholder art. */
  avatarSrc: undefined as string | undefined,
  openLabel: "Need a hint?",
  nextTipLabel: "Another tip",
  closeLabel: "Got it",
  /** Shown when the player has seen every tip. */
  outOfTips: "That's all my tips. You've got this!",
};

export default helpAgent;
