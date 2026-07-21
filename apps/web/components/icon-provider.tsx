"use client";

import { IconContext } from "@phosphor-icons/react";

export function IconProvider({ children }: { children: React.ReactNode }) {
  return (
    <IconContext.Provider
      value={{ color: "currentColor", weight: "regular", mirrored: false }}
    >
      {children}
    </IconContext.Provider>
  );
}
