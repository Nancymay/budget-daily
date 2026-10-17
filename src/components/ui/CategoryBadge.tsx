import type { ResolvedCategoryStyle } from "../../lib/categoryStyle";
import { Icon } from "./Icon";

interface CategoryBadgeProps {
  look: Pick<ResolvedCategoryStyle, "path" | "fg" | "bg">;
  size?: number;
}

export function CategoryBadge({ look, size = 44 }: CategoryBadgeProps) {
  return (
    <span
      className="cat-badge"
      style={{ width: size, height: size, borderRadius: Math.round(size / 3.1), background: look.bg }}
    >
      <Icon path={look.path} color={look.fg} size={Math.round(size / 2)} strokeWidth={2.1} />
    </span>
  );
}
