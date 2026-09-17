'use client';

import React from 'react';

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

export const Link: React.FC<LinkProps> = ({ href, children, className, onClick, ...props }) => {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (onClick) {
          onClick(e);
        }
      }}
      {...props}
    >
      {children}
    </a>
  );
};

export default Link;
