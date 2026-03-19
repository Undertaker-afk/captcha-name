import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const cringeRatings = sqliteTable("cringe_ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  overallScore: integer("overall_score").notNull(),
  sweatRating: integer("sweat_rating").notNull(),
  doubleChinRating: integer("double_chin_rating").notNull(),
  regretRating: integer("regret_rating").notNull(),
  verdict: text("verdict").notNull(),
  roast: text("roast").notNull(),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});
