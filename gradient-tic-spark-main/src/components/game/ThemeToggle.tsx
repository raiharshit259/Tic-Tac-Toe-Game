import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";

export const ThemeToggle = () => {
  const { theme, toggle } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <motion.button
      onClick={toggle}
      className="fixed top-4 right-4 z-50 w-10 h-10 rounded-xl glass-card flex items-center justify-center cursor-pointer"
      whileHover={{ scale: 1.08, boxShadow: "0 4px 16px -4px hsl(var(--primary) / 0.25)" }}
      whileTap={{ scale: 0.92 }}
      aria-label="Toggle theme"
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDark ? 0 : 180, scale: [0.8, 1] }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {isDark ? (
          <Moon size={16} className="text-muted-foreground" />
        ) : (
          <Sun size={16} className="text-foreground" />
        )}
      </motion.div>
    </motion.button>
  );
};
