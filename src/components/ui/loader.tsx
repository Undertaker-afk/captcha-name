import * as React from "react";
import styled, { css } from "styled-components";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
}

interface StyledLoaderProps {
  $size: string;
}

const StyledLoader = styled.div<StyledLoaderProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;

  ${({ $size }: StyledLoaderProps) => {
    switch ($size) {
      case "sm":
        return css`
          font-size: 0.875rem;
        `;
      case "lg":
        return css`
          font-size: 1.125rem;
        `;
      case "xl":
        return css`
          font-size: 1.5rem;
        `;
      default:
        return css`
          font-size: 1rem;
        `;
    }
  }}

  .loader-content::before {
    content: "|";
    animation: spinnerAnimation 0.4s linear infinite;
  }
`;

const Loader = React.forwardRef<HTMLDivElement, LoaderProps>(
  ({ className, size = "md", ...props }, ref) => {
    return (
      <>
        <style jsx global>{`
          @keyframes spinnerAnimation {
            0% {
              content: "|";
            }
            25% {
              content: "/";
            }
            50% {
              content: "-";
            }
            75% {
              content: "\\";
            }
            100% {
              content: "|";
            }
          }
        `}</style>
        <StyledLoader
          ref={ref}
          $size={size}
          className={className}
          {...props}
        >
          <span className="loader-content" />
        </StyledLoader>
      </>
    );
  }
);
Loader.displayName = "Loader";

export { Loader };
