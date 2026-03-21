import { type ReactNode, type HTMLAttributes, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps extends HTMLAttributes<HTMLDivElement> {
  readonly content: ReactNode;
  readonly children: ReactNode;
}

export function Tooltip({ content, children, className, ...props }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const show = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), 200);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      {...props}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md"
        >
          {content}
        </div>
      )}
    </div>
  );
}
