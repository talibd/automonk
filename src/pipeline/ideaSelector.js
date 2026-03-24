/**
 * Selects the best idea from the Claude-generated list.
 * Claude already ranks them 1-3 and suggests auto_selected_rank.
 * This function applies any additional system-level overrides.
 *
 * @param {object[]} ideas
 * @param {number} autoSelectedRank - Claude's suggested rank (1-3)
 * @returns {object} the selected idea
 */
function selectBestIdea(ideas, autoSelectedRank) {
  // Use Claude's recommendation (rank 1 by default)
  const rank = autoSelectedRank || 1;
  const selected = ideas.find(i => i.rank === rank) || ideas[0];
  return selected;
}

module.exports = { selectBestIdea };
