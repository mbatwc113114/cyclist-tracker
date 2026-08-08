import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Map, Plus, Users, User } from 'lucide-react';
import { Haptics } from '../utils/haptics';

export default function Navigation() {
  const handleTap = () => Haptics.light();

  return (
    <nav className="nav-bar">
      <div className="nav-links">
        
        <NavLink onClick={handleTap} to="/dashboard" className={({isActive}) => isActive ? "active" : ""}>
          {({isActive}) => (
            <>
              <Home size={22} strokeWidth={1.8} fill={isActive ? "currentColor" : "none"} />
              <span className="nav-text">Home</span>
            </>
          )}
        </NavLink>
        
        <NavLink onClick={handleTap} to="/maps" className={({isActive}) => isActive ? "active" : ""}>
          {({isActive}) => (
            <>
              <Map size={22} strokeWidth={1.8} fill={isActive ? "currentColor" : "none"} />
              <span className="nav-text">Maps</span>
            </>
          )}
        </NavLink>
        
        <NavLink onClick={handleTap} to="/record" style={{textDecoration: 'none'}}>
          <div className="nav-record-btn">
             <Plus size={24} strokeWidth={2.5} />
          </div>
        </NavLink>

        <NavLink onClick={handleTap} to="/clubs" className={({isActive}) => isActive ? "active" : ""}>
          {({isActive}) => (
            <>
              <Users size={22} strokeWidth={1.8} fill={isActive ? "currentColor" : "none"} />
              <span className="nav-text">Clubs</span>
            </>
          )}
        </NavLink>
        
        <NavLink onClick={handleTap} to="/profile" className={({isActive}) => isActive ? "active" : ""}>
          {({isActive}) => (
            <>
              <User size={22} strokeWidth={1.8} fill={isActive ? "currentColor" : "none"} />
              <span className="nav-text">You</span>
            </>
          )}
        </NavLink>

      </div>
    </nav>
  );
}
