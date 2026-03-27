import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";

interface ThemeToggleProps {
  theme: "light" | "dark";
  onToggle: () => void;
}

const ORBIT_RADIUS = 9;
const ORBIT_DURATION = 1;
const SUN_LIGHT_ANGLE = -90;
const SUN_DARK_ANGLE = 30;
const MOON_LIGHT_ANGLE = -210;
const MOON_DARK_ANGLE = -90;

const toRadians = (angle: number) => (angle * Math.PI) / 180;

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const sunAngle = useMotionValue(SUN_LIGHT_ANGLE);
  const moonAngle = useMotionValue(MOON_LIGHT_ANGLE);
  const sunOpacity = useMotionValue(theme === "light" ? 1 : 0);
  const moonOpacity = useMotionValue(theme === "dark" ? 1 : 0);
  const sunScale = useMotionValue(theme === "light" ? 1 : 0.9);
  const moonScale = useMotionValue(theme === "dark" ? 1 : 0.9);

  const sunX = useTransform(sunAngle, (angle) => ORBIT_RADIUS * Math.cos(toRadians(angle)));
  const sunY = useTransform(sunAngle, (angle) => ORBIT_RADIUS * Math.sin(toRadians(angle)));
  const moonX = useTransform(moonAngle, (angle) => ORBIT_RADIUS * Math.cos(toRadians(angle)));
  const moonY = useTransform(moonAngle, (angle) => ORBIT_RADIUS * Math.sin(toRadians(angle)));

  const previousThemeRef = useRef<"light" | "dark">(theme);
  const firstRenderRef = useRef(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const setRestingState = () => {
      if (theme === "light") {
        sunAngle.set(SUN_LIGHT_ANGLE);
        sunOpacity.set(1);
        sunScale.set(1);

        moonAngle.set(MOON_LIGHT_ANGLE);
        moonOpacity.set(0);
        moonScale.set(0.9);
      } else {
        sunAngle.set(SUN_DARK_ANGLE);
        sunOpacity.set(0);
        sunScale.set(0.9);

        moonAngle.set(MOON_DARK_ANGLE);
        moonOpacity.set(1);
        moonScale.set(1);
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

    const runOrbitAnimation = async () => {
      if (previousTheme === "light" && theme === "dark") {
        await Promise.all([
          animate(sunAngle, SUN_DARK_ANGLE, transition),
          animate(sunOpacity, 0, transition),
          animate(sunScale, 0.9, transition),
          animate(moonAngle, MOON_DARK_ANGLE, transition),
          animate(moonOpacity, 1, transition),
          animate(moonScale, 1, transition),
        ]);
      } else {
        await Promise.all([
          animate(moonAngle, MOON_LIGHT_ANGLE, transition),
          animate(moonOpacity, 0, transition),
          animate(moonScale, 0.9, transition),
          animate(sunAngle, SUN_LIGHT_ANGLE, transition),
          animate(sunOpacity, 1, transition),
          animate(sunScale, 1, transition),
        ]);
      }

      previousThemeRef.current = theme;
      setIsAnimating(false);
    };

    void runOrbitAnimation();
  }, [moonAngle, moonOpacity, moonScale, sunAngle, sunOpacity, sunScale, theme]);

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
          style={{
            x: sunX,
            y: sunY,
            opacity: sunOpacity,
            scale: sunScale,
            zIndex: theme === "light" ? 2 : 1,
            filter: theme === "light"
              ? "drop-shadow(0 0 8px rgba(251, 191, 36, 0.38))"
              : "drop-shadow(0 0 6px rgba(251, 191, 36, 0.28)) blur(0.7px)",
            willChange: "transform, opacity, filter",
          }}
        >
          <Sun size={16} />
        </motion.span>
        <motion.span
          className="absolute inset-0 grid place-items-center"
          style={{
            x: moonX,
            y: moonY,
            opacity: moonOpacity,
            scale: moonScale,
            zIndex: theme === "dark" ? 2 : 1,
            filter: theme === "dark"
              ? "drop-shadow(0 0 9px rgba(147, 197, 253, 0.36))"
              : "drop-shadow(0 0 7px rgba(147, 197, 253, 0.28)) blur(0.7px)",
            willChange: "transform, opacity, filter",
          }}
        >
          <Moon size={16} />
        </motion.span>
      </span>
    </motion.button>
  );
}
