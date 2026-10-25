import { startCourseSelection } from "./question.js";

const PROMPT =
  "👦 Подобрать курс\n\nНапишите возраст ребёнка и его интересы (программирование, ИИ, дизайн, игры и т.д.), и мы подберём подходящий курс.";

export default async function handleCourseSelection(ctx) {
  await startCourseSelection(ctx, PROMPT);
}
