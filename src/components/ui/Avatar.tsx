import Image from "next/image";
import { cn, getInitials } from "@/lib/utils";

const AVATAR_PALETTE = [
  "#E85D8E", "#6C63FF", "#22C55E", "#F59E0B",
  "#EF4444", "#06B6D4", "#8B5CF6", "#EC4899",
] as const;

function colorFor(name: string): string {
  if (!name) return AVATAR_PALETTE[0];
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}

export function Avatar({ name, imageUrl, size = 40, className }: AvatarProps) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={size}
        height={size}
        className={cn("rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const color = colorFor(name);
  const initials = getInitials(name);
  return (
    <div
      className={cn("flex items-center justify-center rounded-full border-[1.5px] font-bold flex-shrink-0", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}22`,
        borderColor: `${color}44`,
        color,
        fontSize: size * 0.36,
      }}
    >
      {initials}
    </div>
  );
}
