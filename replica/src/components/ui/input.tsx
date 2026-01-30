import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-[#1C1C1C] px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'autofill:!bg-[#1C1C1C] autofill:!text-white',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };

// Autofill background fix for all browsers
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    input:-webkit-autofill,
    input:-webkit-autofill:focus,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:active {
      -webkit-box-shadow: 0 0 0 1000px #1C1C1C inset !important;
      box-shadow: 0 0 0 1000px #1C1C1C inset !important;
      -webkit-text-fill-color: #fff !important;
      caret-color: #fff !important;
      color: #fff !important;
      transition: background-color 9999s ease-in-out 0s;
    }
  `;
  document.head.appendChild(style);
}
