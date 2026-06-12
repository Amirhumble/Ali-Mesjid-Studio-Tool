import { useEffect } from 'react';

/**
 * ScrollToTop component ensures that the window scrolls to the top
 * whenever a navigation event occurs (hash change or popstate).
 * This provides a consistent "new page" feel across the application.
 */
const ScrollToTop = () => {
  useEffect(() => {
    const handleNavigation = () => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant' // Instant reset as per typical SPA behavior
      });
    };

    // Listen for browser navigation (Back/Forward)
    window.addEventListener('popstate', handleNavigation);
    
    // Listen for hash changes (if using hash-based navigation)
    window.addEventListener('hashchange', handleNavigation);

    // Initial check (optional, but good for completeness)
    handleNavigation();

    return () => {
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('hashchange', handleNavigation);
    };
  }, []);

  return null;
};

export default ScrollToTop;
