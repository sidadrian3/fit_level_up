import { Zap } from "lucide-react";

const sizeMap = {
  sm: "w-10 h-10 rounded-full text-lg",
  md: "w-16 h-16 rounded-2xl text-3xl",
  lg: "w-24 h-24 rounded-2xl text-4xl",
};

const iconSizeMap = {
  sm: "w-5 h-5",
  md: "w-8 h-8",
  lg: "w-10 h-10",
};

export function UserAvatar({
  avatar,
  size = "md",
  className = "",
}: {
  avatar?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = sizeMap[size];

  return (
    <div className={`${sizeClass} bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center shrink-0 overflow-hidden ${className}`}>
      {avatar?.startsWith("http") ? (
        <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
      ) : avatar === "zap" ? (
        <Zap className={`${iconSizeMap[size]} text-accent-purple`} />
      ) : (
        avatar
      )}
    </div>
  );
}
