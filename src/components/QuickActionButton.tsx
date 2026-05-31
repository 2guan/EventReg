import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface QuickActionButtonProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconBgColor: string;
  iconColor: string;
  to: string;
  delay?: number;
}

export default function QuickActionButton({
  title,
  description,
  icon: Icon,
  iconBgColor,
  iconColor,
  to,
  delay = 0
}: QuickActionButtonProps) {
  // Ensure Icon is treated as a valid React component
  const IconComponent = Icon as React.ElementType;
  const MotionLink = motion(Link);

  return (
    <MotionLink
      to={to}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
    >
      <div className={`${iconBgColor} p-3 rounded-full mb-3`}>
        <IconComponent className={`h-6 w-6 ${iconColor}`} />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </MotionLink>
  );
}