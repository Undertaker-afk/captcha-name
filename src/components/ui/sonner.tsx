"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--bg-1)",
          "--normal-text": "var(--fg)",
          "--normal-border": "var(--stroke)",
        } as React.CSSProperties
      }
      toastOptions={{
        className: "!rounded-none !py-3 !px-4 !gap-1.5",
        ...toastOptions,
      }}
      {...props}
    />
  );
};

export { Toaster };
