// declarations.d.ts
declare module 'react-world-flags' {
  import React from 'react';
  
  interface FlagProps extends React.HTMLAttributes<HTMLImageElement> {
    code?: string;
    fallback?: React.ReactNode;
    height?: string | number;
    width?: string | number;
    alt?: string;
  }

  const Flag: React.FC<FlagProps>;
  export default Flag;
}