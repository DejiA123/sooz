import { Link } from "react-router-dom";

export const TopBar = () => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b flex items-center justify-between px-4 py-2 md:px-6">
      <Link to="/" className="flex items-center">
        <img
          src="/sooz-logo.png"
          alt="SOOZ"
          className="h-12 w-auto object-contain text-foreground"
        />
      </Link>
    </div>
  );
};
