import { Pressable, Text } from "react-native";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  fullWidth?: boolean;
};

export default function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  fullWidth = true,
}: Props) {
  const getBackgroundColor = () => {
    if (disabled) return "bg-muted";

    switch (variant) {
      case "primary":
        return "bg-primary";
      case "secondary":
        return "bg-secondary";
      case "danger":
        return "bg-destructive";
      default:
        return "bg-primary";
    }
  };

  const getTextColor = () => {
    if (variant === "secondary") return "text-secondary-foreground";
    return "text-primary-foreground";
  };

  return (
    <Pressable
      className={`
        rounded-lg items-center justify-center p-4 
        ${getBackgroundColor()}
        ${fullWidth ? "w-full" : "px-6"}
        ${disabled ? "opacity-70" : ""}
      `}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text className={`font-sans-bold text-center text-base ${getTextColor()}`}>{label}</Text>
    </Pressable>
  );
}
