import React, { useState, useEffect } from "react"; 
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../../assets/logo.png";

const logoVariants = {
  rest: { scale: 1, boxShadow: "0 0 0px #E8D8C4" },
  hover: {
    scale: 1.18,
    boxShadow: "0 0 40px #E8D8C4",
    transition: { type: "spring", stiffness: 300 },
  },
};

const linkVariants = {
  rest: {
    color: "#C7B7A3",
    boxShadow: "none",
    background: "transparent",
  },
  hover: {
    color: "#E8D8C4",
    boxShadow: "0 2px 12px #E8D8C4",
    background: "transparent",
    transition: { type: "spring", stiffness: 300 },
  },
};

const navVariants = {
  hidden: { y: 0, opacity: 1 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0 },
  },
};

const menuVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 60 },
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const loggedInUser = localStorage.getItem("loggedInUser");
  const role = localStorage.getItem("role");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  return (
    <motion.nav
      variants={navVariants}
      initial="hidden"
      animate="visible"
      className={
        scrolled
          ? "fixed top-4 left-1/2 transform -translate-x-1/2 mx-auto z-50 transition-all duration-300"
          : "fixed top-0 left-0 w-full z-50 transition-all duration-300"
      }
      style={{
        background: "rgba(86,28,36,0.92)", // #561C24 glassy
        backdropFilter: "blur(22px)",
        boxShadow: scrolled
          ? "0 8px 32px 0 rgba(199,183,163,0.12), 0 1.5px 8px 0 rgba(232,216,196,0.08)"
          : "0 2px 12px 0 rgba(199,183,163,0.06)",
        borderRadius: scrolled ? "2rem" : "0",
        padding: "0.5rem 0",
        maxWidth: scrolled ? "1100px" : "100vw",
        width: scrolled ? "100%" : "100vw",
      }}
    >
      <div
        className={`flex items-center justify-between h-20 ${
          scrolled ? "px-8" : "px-20"
        }`}
      >
        {/* Logo & Brand */}
        <Link to="/" className="flex items-center gap-4">
          <motion.img
            src={Logo}
            alt="BloodDetect logo"
            className="h-14 w-14 object-cover rounded-full shadow-lg cursor-pointer border-4 border-white"
            variants={logoVariants}
            initial="rest"
            whileHover="hover"
            style={{
              background: "#fff",
            }}
          />
          <div className="flex flex-col items-start">
            <span
              className="font-extrabold text-2xl tracking-tight select-none"
              style={{
                color: "#E8D8C4",
                letterSpacing: "0.04em",
              }}
            >
              Bindu
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: "#C7B7A3", opacity: 0.7 }}
            >
              AI-Powered Blood Detection
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-4">
          <NavLink to="/" label="Home" />
          <NavLink
            to="#about"
            label="About"
            onClick={(e) => {
              e.preventDefault();
              const aboutSection = document.getElementById("about");
              if (aboutSection)
                aboutSection.scrollIntoView({ behavior: "smooth" });
            }}
          />
          <NavLink to="/blood-bank" label="Blood Bank" />
          {/* NEW: Blood Donor page link */}
          <NavLink to="/blood-donors" label="Blood Donor" />
        </div>

        {/* Auth Buttons */}
        <div className="hidden md:flex items-center gap-2">
          {!loggedInUser ? (
            <>
              <ButtonLink to="/register" label="Register" variant="outline" />
              <ButtonLink to="/login" label="Login" variant="primary" />
            </>
          ) : (
            <>
              <button
                onClick={() =>
                  navigate(role === "admin" ? "/admin-dashboard" : "/dashboard")
                }
                className="px-5 py-2 rounded-xl font-semibold text-[#C7B7A3] bg-[#E8D8C4]/10 border border-[#C7B7A3] transition shadow cursor-pointer hover:scale-105"
                type="button"
                style={{
                  backdropFilter: "blur(8px)",
                  border: "1.5px solid #C7B7A3",
                }}
              >
                Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="px-5 py-2 rounded-xl font-semibold text-[#561C24] bg-gradient-to-r from-[#C7B7A3] to-[#E8D8C4] transition shadow cursor-pointer hover:scale-105"
                type="button"
                style={{
                  border: "1.5px solid #C7B7A3",
                  boxShadow: "0 2px 12px #C7B7A322",
                }}
              >
                Logout
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 rounded-xl bg-[#C7B7A3]/60 hover:bg-[#E8D8C4]/10 transition shadow"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <motion.svg
            width="32"
            height="32"
            fill="none"
            stroke="#E8D8C4"
            strokeWidth="2"
            initial={{ rotate: 0 }}
            animate={{ rotate: menuOpen ? 90 : 0 }}
            transition={{ type: "spring", stiffness: 120 }}
          >
            {menuOpen ? (
              <path d="M8 8L24 24M8 24L24 8" strokeLinecap="round" />
            ) : (
              <path d="M6 12h20M6 18h20" strokeLinecap="round" />
            )}
          </motion.svg>
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="md:hidden fixed top-24 right-4 w-72 h-[calc(100vh-6rem)] bg-[#561C24]/90 backdrop-blur-xl shadow-2xl border-l border-[#C7B7A3] flex flex-col px-8 py-10 gap-6 z-50 rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg, rgba(86,28,36,0.95) 60%, rgba(232,216,196,0.09) 100%)",
              border: "1.5px solid #C7B7A3",
            }}
          >
            <NavLink to="/" label="Home" onClick={() => setMenuOpen(false)} />
            <NavLink
              to="#about"
              label="About"
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                const aboutSection = document.getElementById("about");
                if (aboutSection)
                  aboutSection.scrollIntoView({ behavior: "smooth" });
              }}
            />
            <NavLink
              to="/blood-bank"
              label="Blood Bank"
              onClick={() => setMenuOpen(false)}
            />
            {/* NEW: Blood Donor mobile link */}
            <NavLink
              to="/blood-donors"
              label="Blood Donor"
              onClick={() => setMenuOpen(false)}
            />

            <div className="border-t border-[#C7B7A3] pt-4 mt-4 flex flex-col gap-2">
              {!loggedInUser ? (
                <>
                  <ButtonLink
                    to="/register"
                    label="Register"
                    variant="outline"
                    onClick={() => setMenuOpen(false)}
                  />
                  <ButtonLink
                    to="/login"
                    label="Login"
                    variant="primary"
                    onClick={() => setMenuOpen(false)}
                  />
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(
                        role === "admin" ? "/admin-dashboard" : "/dashboard"
                      );
                    }}
                    className="w-full px-5 py-2 rounded-xl font-semibold text-[#C7B7A3] bg-white/80 border border-[#C7B7A3] hover:bg-[#E8D8C4]/10 transition shadow"
                    type="button"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full px-5 py-2 rounded-xl font-semibold text-[#561C24] bg-gradient-to-r from-[#C7B7A3] to-[#E8D8C4] hover:from-[#E8D8C4] hover:to-[#C7B7A3] transition shadow"
                    type="button"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// NavLink component for links
function NavLink({ to, label, onClick }) {
  return (
    <motion.div
      className="inline-block"
      variants={linkVariants}
      initial="rest"
      whileHover="hover"
      style={{
        cursor: "pointer",
        borderRadius: "1rem",
        padding: "0.2rem 0.6rem",
      }}
    >
      <Link
        to={to}
        onClick={onClick}
        className="relative font-medium"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {label}
      </Link>
    </motion.div>
  );
}

// ButtonLink component for buttons
function ButtonLink({ to, label, variant, onClick }) {
  const base =
    "px-5 py-2 rounded-xl font-semibold transition w-full md:w-auto text-center shadow";
  const styles =
    variant === "primary"
      ? "bg-gradient-to-r from-[#C7B7A3] to-[#E8D8C4] text-[#561C24] border border-[#C7B7A3] hover:from-[#E8D8C4] hover:to-[#C7B7A3] hover:scale-105"
      : "bg-[#E8D8C4]/10 border border-[#C7B7A3] text-[#C7B7A3] hover:scale-105";
  return (
    <Link to={to} onClick={onClick} className={`${base} ${styles}`}>
      {label}
    </Link>
  );
}
