import React from 'react';
import { motion } from 'framer-motion';

// L2 Design System
// Ensure 'motion.css' is imported globally in your app entry point

interface L2ComponentProps {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

/**
 * L2 Systems Standard Component
 * Implements "Sliding Obsidian Slabs" physics.
 */
export const L2Button: React.FC<L2ComponentProps> = ({ 
  label, 
  onClick, 
  variant = 'primary' 
}) => {
  
  // Use tokens from design-tokens.json for colors
  const variants = {
    primary: 'bg-[#7F00FF] hover:bg-[#9D4DFF] text-white', // Electric Violet
    secondary: 'bg-[#1A1A1A] hover:bg-[#252525] text-[#A0A0A0] border border-[#333]', // Gunmetal
    danger: 'bg-transparent border border-[#FF0055] text-[#FF0055] hover:bg-[#FF0055] hover:text-white'
  };

  return (
    <motion.button
      onClick={onClick}
      className={`
        relative px-6 py-3 font-mono text-sm tracking-wider uppercase 
        rounded-sm overflow-hidden l2-transition
        ${variants[variant]}
      `}
      // Framer Motion properties for "heavy" feel
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98, y: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 25 // High damping = Heavy mass
      }}
    >
      {/* Scanline overlay effect */}
      <div className="absolute inset-0 bg-[url('/assets/noise.png')] opacity-10 pointer-events-none" />
      
      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">
        {variant === 'primary' && <span className="w-2 h-2 bg-[#00F0FF] rounded-full animate-pulse" />}
        {label}
      </span>
    </motion.button>
  );
};
