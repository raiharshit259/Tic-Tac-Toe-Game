import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const GlassCard = ({ children, className, glow, ...props }: GlassCardProps) => (
  <motion.div
    className={cn("glass-card p-6", glow && "glow-primary", className)}
    {...props}
  >
    {children}
  </motion.div>
);
