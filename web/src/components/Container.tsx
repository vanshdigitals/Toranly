import React from 'react';

export interface ContainerProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  className?: string;
  children: React.ReactNode;
}

/**
 * Shared page container component aligning content to one centred column with equal side margins.
 * Widths come from tokens.css (--container-max, --container-pad):
 * - Width: 100% of viewport minus side padding, centred with equal automatic left and right margins.
 * - Max width: 1240px (<1440px), 1380px (1440-1919px), 1460px (>=1920px).
 * - Side padding: 16px (<640px), 24px (640-1023px), 32px (1024-1439px), 40px (1440-1919px), 48px (>=1920px).
 */
export const Container: React.FC<ContainerProps> = ({
  as: Component = 'div',
  className = '',
  children,
  ...rest
}) => {
  const combinedClassName = className ? `page-container ${className}` : 'page-container';
  return (
    <Component className={combinedClassName} {...rest}>
      {children}
    </Component>
  );
};
