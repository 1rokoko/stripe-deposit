import React, { useState, useEffect } from 'react';

// Hook for responsive breakpoints
export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState('lg');
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      
      if (width < 640) {
        setBreakpoint('xs');
        setIsMobile(true);
        setIsTablet(false);
        setIsDesktop(false);
      } else if (width < 768) {
        setBreakpoint('sm');
        setIsMobile(true);
        setIsTablet(false);
        setIsDesktop(false);
      } else if (width < 1024) {
        setBreakpoint('md');
        setIsMobile(false);
        setIsTablet(true);
        setIsDesktop(false);
      } else if (width < 1280) {
        setBreakpoint('lg');
        setIsMobile(false);
        setIsTablet(false);
        setIsDesktop(true);
      } else {
        setBreakpoint('xl');
        setIsMobile(false);
        setIsTablet(false);
        setIsDesktop(true);
      }
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return {
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isSmallScreen: isMobile || isTablet,
    isLargeScreen: isDesktop
  };
};

// Responsive Container Component
export const ResponsiveContainer = ({ 
  children, 
  maxWidth = 'xl',
  padding = true,
  className = '',
  ...props 
}) => {
  const containerClasses = [
    'container',
    `container-${maxWidth}`,
    padding ? 'px-4' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses} {...props}>
      {children}
    </div>
  );
};

// Responsive Grid Component
export const ResponsiveGrid = ({ 
  children,
  cols = { xs: 1, sm: 2, md: 3, lg: 4 },
  gap = 'md',
  className = '',
  ...props 
}) => {
  const gridClasses = [
    'grid',
    `gap-${gap}`,
    `grid-cols-${cols.xs}`,
    cols.sm ? `sm:grid-cols-${cols.sm}` : '',
    cols.md ? `md:grid-cols-${cols.md}` : '',
    cols.lg ? `lg:grid-cols-${cols.lg}` : '',
    cols.xl ? `xl:grid-cols-${cols.xl}` : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={gridClasses} {...props}>
      {children}
    </div>
  );
};

// Responsive Flex Component
export const ResponsiveFlex = ({ 
  children,
  direction = { xs: 'col', md: 'row' },
  align = 'center',
  justify = 'start',
  wrap = true,
  gap = 'md',
  className = '',
  ...props 
}) => {
  const flexClasses = [
    'flex',
    `flex-${direction.xs}`,
    direction.sm ? `sm:flex-${direction.sm}` : '',
    direction.md ? `md:flex-${direction.md}` : '',
    direction.lg ? `lg:flex-${direction.lg}` : '',
    `items-${align}`,
    `justify-${justify}`,
    wrap ? 'flex-wrap' : 'flex-nowrap',
    `gap-${gap}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={flexClasses} {...props}>
      {children}
    </div>
  );
};

// Responsive Card Component
export const ResponsiveCard = ({ 
  children,
  padding = 'md',
  shadow = 'sm',
  hover = true,
  className = '',
  ...props 
}) => {
  const cardClasses = [
    'card-responsive',
    `p-responsive-${padding}`,
    `shadow-${shadow}`,
    hover ? 'hover:shadow-md hover:-translate-y-1' : '',
    'transition-all duration-200',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses} {...props}>
      {children}
    </div>
  );
};

// Responsive Text Component
export const ResponsiveText = ({ 
  children,
  size = 'base',
  weight = 'normal',
  align = { xs: 'center', md: 'left' },
  className = '',
  as: Component = 'p',
  ...props 
}) => {
  const textClasses = [
    `text-responsive-${size}`,
    `font-${weight}`,
    `text-${align.xs}`,
    align.sm ? `sm:text-${align.sm}` : '',
    align.md ? `md:text-${align.md}` : '',
    align.lg ? `lg:text-${align.lg}` : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <Component className={textClasses} {...props}>
      {children}
    </Component>
  );
};

// Responsive Heading Component
export const ResponsiveHeading = ({ 
  children,
  level = 1,
  responsive = true,
  align = { xs: 'center', md: 'left' },
  className = '',
  ...props 
}) => {
  const Component = `h${level}`;
  
  const headingClasses = [
    responsive ? `heading-responsive-${level}` : '',
    `text-${align.xs}`,
    align.sm ? `sm:text-${align.sm}` : '',
    align.md ? `md:text-${align.md}` : '',
    align.lg ? `lg:text-${align.lg}` : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <Component className={headingClasses} {...props}>
      {children}
    </Component>
  );
};

// Responsive Show/Hide Component
export const ResponsiveShow = ({ 
  children,
  on = ['md'],
  className = '',
  ...props 
}) => {
  const showClasses = [
    'hidden', // Hidden by default
    ...on.map(breakpoint => `${breakpoint}:block`),
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={showClasses} {...props}>
      {children}
    </div>
  );
};

export const ResponsiveHide = ({ 
  children,
  on = ['xs', 'sm'],
  className = '',
  ...props 
}) => {
  const hideClasses = [
    'block', // Visible by default
    ...on.map(breakpoint => `${breakpoint}:hidden`),
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={hideClasses} {...props}>
      {children}
    </div>
  );
};

// Responsive Image Component
export const ResponsiveImage = ({ 
  src,
  alt,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  className = '',
  ...props 
}) => {
  return (
    <img
      src={src}
      alt={alt}
      sizes={sizes}
      className={`w-full h-auto object-cover ${className}`}
      loading="lazy"
      {...props}
    />
  );
};

// Responsive Layout Wrapper
export const ResponsiveLayout = ({ 
  children,
  sidebar = null,
  sidebarWidth = { md: '250px', lg: '300px' },
  sidebarCollapsed = false,
  className = '',
  ...props 
}) => {
  const { isMobile } = useBreakpoint();

  if (isMobile) {
    return (
      <div className={`responsive-layout-mobile ${className}`} {...props}>
        {children}
        {sidebar && (
          <div className="mobile-sidebar">
            {sidebar}
          </div>
        )}
        <style jsx>{`
          .responsive-layout-mobile {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }
          .mobile-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            z-index: 1000;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`responsive-layout-desktop ${className}`} {...props}>
      {sidebar && (
        <aside className="layout-sidebar">
          {sidebar}
        </aside>
      )}
      <main className="layout-main">
        {children}
      </main>
      <style jsx>{`
        .responsive-layout-desktop {
          display: grid;
          grid-template-columns: ${sidebar ? (sidebarCollapsed ? '60px' : sidebarWidth.lg) : '0'} 1fr;
          min-height: 100vh;
          transition: grid-template-columns 0.3s ease;
        }
        .layout-sidebar {
          background: var(--color-surface);
          border-right: 1px solid var(--color-border);
          overflow-y: auto;
        }
        .layout-main {
          overflow-x: auto;
          padding: var(--space-responsive-md);
        }
        @media (max-width: 1024px) {
          .responsive-layout-desktop {
            grid-template-columns: ${sidebar ? (sidebarCollapsed ? '60px' : sidebarWidth.md) : '0'} 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default {
  useBreakpoint,
  ResponsiveContainer,
  ResponsiveGrid,
  ResponsiveFlex,
  ResponsiveCard,
  ResponsiveText,
  ResponsiveHeading,
  ResponsiveShow,
  ResponsiveHide,
  ResponsiveImage,
  ResponsiveLayout
};
