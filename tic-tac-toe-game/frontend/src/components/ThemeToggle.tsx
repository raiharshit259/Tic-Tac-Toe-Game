import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { motion, useAnimationControls } from "framer-motion";

interface ThemeToggleProps {
  theme: "light" | "dark";
  onToggle: () => void;
}

const ORBIT_OFFSET = 12;
const ORBIT_DURATION = 0.72;

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const sunControls = useAnimationControls();
  const moonControls = useAnimationControls();
  const previousThemeRef = useRef<"light" | "dark">(theme);
  const firstRenderRef = useRef(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const setRestingState = () => {
      if (theme === "light") {
        sunControls.set({
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          opacity: 1,
          filter: "drop-shadow(0 0 8px rgba(251, 191, 36, 0.38)) blur(0px)",
          zIndex: 2,
        });
        moonControls.set({
          x: -ORBIT_OFFSET,
          y: ORBIT_OFFSET,
          rotate: -52,
          scale: 0.88,
          opacity: 0,
          filter: "drop-shadow(0 0 7px rgba(147, 197, 253, 0.28)) blur(1px)",
          zIndex: 1,
        });
      } else {
        moonControls.set({
          x: 0,
          y: 0,
          rotate: 0,
          scale: 1,
          opacity: 1,
          filter: "drop-shadow(0 0 9px rgba(147, 197, 253, 0.36)) blur(0px)",
          zIndex: 2,
        });
        sunControls.set({
          x: ORBIT_OFFSET,
          y: ORBIT_OFFSET,
          rotate: 52,
          scale: 0.88,
          opacity: 0,
          filter: "drop-shadow(0 0 6px rgba(251, 191, 36, 0.28)) blur(1px)",
          zIndex: 1,
        });
      }
    };

    if (firstRenderRef.current) {
      setRestingState();
      firstRenderRef.current = false;
      previousThemeRef.current = theme;
      return;
    }

    const previousTheme = previousThemeRef.current;
    if (previousTheme === theme) {
      setRestingState();
      return;
    }

    const transition = {
      duration: ORBIT_DURATION,
      ease: [0.42, 0, 0.2, 1] as const,
    };

    setIsAnimating(true);

    const animate = async () => {
      if (previousTheme === "light" && theme === "dark") {
        await Promise.all([
          sunControls.start({
            x: [0, 6, ORBIT_OFFSET],
            y: [0, 4, ORBIT_OFFSET],
            rotate: [0, 24, 52],
            scale: [1, 0.95, 0.88],
            opacity: [1, 0.62, 0],
            filter: [
              "drop-shadow(0 0 8px rgba(251, 191, 36, 0.38)) blur(0px)",
              "drop-shadow(0 0 10px rgba(251, 191, 36, 0.30)) blur(0.6px)",
              "drop-shadow(0 0 6px rgba(251, 191, 36, 0.20)) blur(1.2px)",
            ],
            zIndex: [2, 1, 1],
            transition,
          }),
          moonControls.start({
            x: [-ORBIT_OFFSET, -7, -2, 0],
            y: [ORBIT_OFFSET, 3, -2, 0],
            rotate: [-52, -20, -6, 0],
            scale: [0.88, 0.94, 0.99, 1],
            opacity: [0, 0.62, 0.92, 1],
            filter: [
              "drop-shadow(0 0 6px rgba(147, 197, 253, 0.20)) blur(1.2px)",
              "drop-shadow(0 0 8px rgba(147, 197, 253, 0.28)) blur(0.7px)",
              "drop-shadow(0 0 10px rgba(147, 197, 253, 0.34)) blur(0.2px)",
              "drop-shadow(0 0 9px rgba(147, 197, 253, 0.36)) blur(0px)",
            ],
            zIndex: [1, 1, 2, 2],
            transition,
          }),
        ]);
      } else {
        await Promise.all([
          moonControls.start({
            x: [0, -6, -ORBIT_OFFSET],
            y: [0, 4, ORBIT_OFFSET],
            rotate: [0, -24, -52],
            scale: [1, 0.95, 0.88],
            opacity: [1, 0.62, 0],
            filter: [
              "drop-shadow(0 0 9px rgba(147, 197, 253, 0.36)) blur(0px)",
              "drop-shadow(0 0 10px rgba(147, 197, 253, 0.30)) blur(0.6px)",
              "drop-shadow(0 0 6px rgba(147, 197, 253, 0.20)) blur(1.2px)",
            ],
            zIndex: [2, 1, 1],
            transition,
          }),
          sunControls.start({
            x: [ORBIT_OFFSET, 7, 2, 0],
            y: [ORBIT_OFFSET, 3, -2, 0],
            rotate: [52, 20, 6, 0],
            scale: [0.88, 0.94, 0.99, 1],
            opacity: [0, 0.62, 0.92, 1],
            filter: [
              "drop-shadow(0 0 6px rgba(251, 191, 36, 0.20)) blur(1.2px)",
              "drop-shadow(0 0 8px rgba(251, 191, 36, 0.28)) blur(0.7px)",
              "drop-shadow(0 0 10px rgba(251, 191, 36, 0.34)) blur(0.2px)",
              "drop-shadow(0 0 8px rgba(251, 191, 36, 0.38)) blur(0px)",
            ],
            zIndex: [1, 1, 2, 2],
            transition,
          }),
        ]);
      }

      previousThemeRef.current = theme;
      setIsAnimating(false);
    };

    void animate();
  }, [moonControls, sunControls, theme]);

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => {
        if (!isAnimating) {
          onToggle();
        }
      }}
      className="rounded-full bg-white/10 p-2.5 text-foreground shadow-lg backdrop-blur-md transition-colors border border-white/20 dark:bg-white/5 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10"
      aria-label="Toggle theme"
    >
      <span className="relative block h-4 w-4 overflow-visible">
        <motion.span
          className="absolute inset-0 grid place-items-center"
          animate={sunControls}
          style={{ willChange: "transform, opacity, filter" }}
        >
          <Sun size={16} />
        </motion.span>
        <motion.span
          className="absolute inset-0 grid place-items-center"
          animate={moonControls}
          style={{ willChange: "transform, opacity, filter" }}
        >
          <Moon size={16} />
        </motion.span>
      </span>
    </motion.button>
  );
}
