// Compatibility barrel. Each implementation module declares "use server".
// Do not add that directive here: Next requires declarations in action modules.
export { generatePlan, resetPlan, pickWildcardMeal } from "./actions/plan-actions";
export { removeFromSlot, assignRecipeToSlot, addCourseToDay, removeCourseFromDay } from "./actions/slot-actions";
export type { ChangedSlot } from "./actions/slot-actions";
export { castVote } from "./actions/vote-actions";
export { getAIUsageThisWeek, suggestWithAI, planWeekWithAI, suggestForSlot } from "./actions/ai-actions";
export { generateShoppingList } from "./actions/shopping-actions";
